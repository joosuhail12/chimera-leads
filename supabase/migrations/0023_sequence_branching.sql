-- ============================================
-- Dynamic Sequence Branching System
-- Enables adaptive sequences with conditional paths
-- ============================================

-- Branch definitions for sequences
CREATE TABLE IF NOT EXISTS public.sequence_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Branch identification
  sequence_template_id UUID REFERENCES public.sequence_templates(id) ON DELETE CASCADE,
  parent_step_id UUID REFERENCES public.sequence_steps(id) ON DELETE CASCADE,
  branch_name TEXT NOT NULL,
  description TEXT,

  -- Branch conditions
  condition_type TEXT NOT NULL CHECK (condition_type IN (
    'behavior',          -- Based on behavioral events
    'engagement',        -- Based on email/message engagement
    'field_value',       -- Based on lead field values
    'score',            -- Based on lead score
    'time_elapsed',     -- Based on time since enrollment
    'previous_step',    -- Based on previous step outcome
    'custom',           -- Custom condition logic
    'default'           -- Fallback branch if no others match
  )),

  -- Condition configuration
  condition_config JSONB NOT NULL DEFAULT '{}',
  -- Examples:
  -- behavior: { "event_type": "page_visit", "url_contains": "/pricing" }
  -- engagement: { "opened_last_email": true, "clicked_link": true }
  -- field_value: { "field": "industry", "operator": "equals", "value": "SaaS" }
  -- score: { "min_score": 70, "score_type": "fit" }

  -- Branch destination
  next_step_id UUID REFERENCES public.sequence_steps(id),

  -- Evaluation order (lower numbers evaluated first)
  priority INTEGER DEFAULT 100,

  -- Tracking
  total_enrollments INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2),

  UNIQUE(parent_step_id, branch_name)
);

-- Index for branch evaluation
CREATE INDEX idx_sequence_branches_eval ON public.sequence_branches(parent_step_id, priority);
CREATE INDEX idx_sequence_branches_template ON public.sequence_branches(sequence_template_id);

-- Branch evaluation history
CREATE TABLE IF NOT EXISTS public.branch_evaluation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  enrollment_id UUID REFERENCES public.sequence_enrollments(id),
  step_id UUID REFERENCES public.sequence_steps(id),

  -- Evaluation details
  branches_evaluated JSONB[], -- Array of branches and their evaluation results
  selected_branch_id UUID REFERENCES public.sequence_branches(id),
  selected_reason TEXT,

  -- Lead context at evaluation time
  lead_context JSONB -- Snapshot of lead data used for evaluation
);

-- Index for history lookup
CREATE INDEX idx_branch_evaluation_enrollment ON public.branch_evaluation_logs(enrollment_id, created_at DESC);

-- Branch-specific content variants
CREATE TABLE IF NOT EXISTS public.branch_content_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  branch_id UUID REFERENCES public.sequence_branches(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.sequence_steps(id),

  -- Content customization for this branch
  content_overrides JSONB, -- Override specific parts of step content
  -- Example: { "subject": "Special offer for {{industry}}", "cta_button": "Get SaaS Pricing" }

  -- Personalization rules
  personalization_config JSONB,

  UNIQUE(branch_id, step_id)
);

-- Function to evaluate branch conditions
CREATE OR REPLACE FUNCTION evaluate_branch_condition(
  p_condition_type TEXT,
  p_condition_config JSONB,
  p_enrollment_id UUID,
  p_lead_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_result BOOLEAN DEFAULT false;
  v_lead_data JSONB;
  v_event_count INTEGER;
  v_last_engagement RECORD;
BEGIN
  -- Get lead data for evaluation
  SELECT row_to_json(l.*) INTO v_lead_data
  FROM sales_leads l
  WHERE l.id = p_lead_id;

  CASE p_condition_type
    WHEN 'behavior' THEN
      -- Check for recent behavioral events
      SELECT COUNT(*) INTO v_event_count
      FROM behavioral_events
      WHERE lead_id = p_lead_id
        AND event_type = p_condition_config->>'event_type'
        AND created_at > NOW() - INTERVAL '7 days'
        AND (
          p_condition_config->>'url_contains' IS NULL OR
          event_data->>'url' LIKE '%' || p_condition_config->>'url_contains' || '%'
        );
      v_result := v_event_count > 0;

    WHEN 'engagement' THEN
      -- Check email engagement
      SELECT
        opened_at IS NOT NULL as opened,
        clicked_at IS NOT NULL as clicked
      INTO v_last_engagement
      FROM sequence_email_logs
      WHERE enrollment_id = p_enrollment_id
      ORDER BY sent_at DESC
      LIMIT 1;

      IF p_condition_config->>'opened_last_email' = 'true' THEN
        v_result := v_last_engagement.opened;
      ELSIF p_condition_config->>'clicked_link' = 'true' THEN
        v_result := v_last_engagement.clicked;
      END IF;

    WHEN 'field_value' THEN
      -- Check lead field value
      DECLARE
        v_field_value TEXT;
        v_operator TEXT;
        v_compare_value TEXT;
      BEGIN
        v_field_value := v_lead_data->>(p_condition_config->>'field');
        v_operator := p_condition_config->>'operator';
        v_compare_value := p_condition_config->>'value';

        CASE v_operator
          WHEN 'equals' THEN
            v_result := v_field_value = v_compare_value;
          WHEN 'not_equals' THEN
            v_result := v_field_value != v_compare_value;
          WHEN 'contains' THEN
            v_result := v_field_value LIKE '%' || v_compare_value || '%';
          WHEN 'greater_than' THEN
            v_result := v_field_value::NUMERIC > v_compare_value::NUMERIC;
          WHEN 'less_than' THEN
            v_result := v_field_value::NUMERIC < v_compare_value::NUMERIC;
          WHEN 'in' THEN
            v_result := v_field_value = ANY(SELECT jsonb_array_elements_text(p_condition_config->'values'));
        END CASE;
      END;

    WHEN 'score' THEN
      -- Check lead score
      v_result := (v_lead_data->>'fit_score')::INTEGER >= (p_condition_config->>'min_score')::INTEGER;

    WHEN 'time_elapsed' THEN
      -- Check time since enrollment
      DECLARE
        v_enrollment_time TIMESTAMPTZ;
        v_hours_elapsed INTEGER;
      BEGIN
        SELECT created_at INTO v_enrollment_time
        FROM sequence_enrollments
        WHERE id = p_enrollment_id;

        v_hours_elapsed := EXTRACT(EPOCH FROM (NOW() - v_enrollment_time)) / 3600;
        v_result := v_hours_elapsed >= (p_condition_config->>'min_hours')::INTEGER;
      END;

    WHEN 'default' THEN
      -- Default branch always matches
      v_result := true;

    ELSE
      -- Unknown condition type
      v_result := false;
  END CASE;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to select next branch for enrollment
CREATE OR REPLACE FUNCTION select_next_branch(
  p_enrollment_id UUID,
  p_current_step_id UUID
) RETURNS UUID AS $$
DECLARE
  v_branch RECORD;
  v_lead_id UUID;
  v_selected_branch_id UUID;
  v_branches_evaluated JSONB[] DEFAULT '{}';
BEGIN
  -- Get lead ID from enrollment
  SELECT lead_id INTO v_lead_id
  FROM sequence_enrollments
  WHERE id = p_enrollment_id;

  -- Evaluate branches in priority order
  FOR v_branch IN
    SELECT * FROM sequence_branches
    WHERE parent_step_id = p_current_step_id
    ORDER BY priority, created_at
  LOOP
    -- Log evaluation attempt
    v_branches_evaluated := array_append(
      v_branches_evaluated,
      jsonb_build_object(
        'branch_id', v_branch.id,
        'branch_name', v_branch.branch_name,
        'condition_type', v_branch.condition_type
      )
    );

    -- Evaluate condition
    IF evaluate_branch_condition(
      v_branch.condition_type,
      v_branch.condition_config,
      p_enrollment_id,
      v_lead_id
    ) THEN
      v_selected_branch_id := v_branch.id;

      -- Log successful evaluation
      INSERT INTO branch_evaluation_logs (
        enrollment_id,
        step_id,
        branches_evaluated,
        selected_branch_id,
        selected_reason
      ) VALUES (
        p_enrollment_id,
        p_current_step_id,
        v_branches_evaluated,
        v_selected_branch_id,
        'Condition matched: ' || v_branch.condition_type
      );

      -- Update branch statistics
      UPDATE sequence_branches
      SET total_enrollments = total_enrollments + 1
      WHERE id = v_selected_branch_id;

      -- Return the next step ID for this branch
      RETURN v_branch.next_step_id;
    END IF;
  END LOOP;

  -- No branch matched, log and return NULL
  INSERT INTO branch_evaluation_logs (
    enrollment_id,
    step_id,
    branches_evaluated,
    selected_reason
  ) VALUES (
    p_enrollment_id,
    p_current_step_id,
    v_branches_evaluated,
    'No conditions matched'
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Sample branch configurations for common use cases
-- These are examples - uncomment and replace with actual IDs when implementing
-- INSERT INTO sequence_branches (
--   sequence_template_id,
--   parent_step_id,
--   branch_name,
--   description,
--   condition_type,
--   condition_config,
--   priority
-- ) VALUES
-- (
--   'template_uuid',
--   'step_uuid',
--   'High Engagement Path',
--   'Route to accelerated sequence for engaged prospects',
--   'engagement',
--   '{"opened_last_email": true, "clicked_link": true}',
--   10
-- ),
-- (
--   'template_uuid',
--   'step_uuid',
--   'Pricing Interest',
--   'Special sequence for prospects who viewed pricing',
--   'behavior',
--   '{"event_type": "page_visit", "url_contains": "/pricing"}',
--   20
-- ),
-- (
--   'template_uuid',
--   'step_uuid',
--   'Enterprise Path',
--   'Route enterprise companies to specialized sequence',
--   'field_value',
--   '{"field": "company_size", "operator": "greater_than", "value": "500"}',
--   30
-- );

-- Add triggers for updated_at
CREATE TRIGGER update_sequence_branches_updated_at
  BEFORE UPDATE ON public.sequence_branches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.sequence_branches TO authenticated;
GRANT ALL ON public.branch_evaluation_logs TO authenticated;
GRANT ALL ON public.branch_content_variants TO authenticated;