-- ============================================
-- Behavioral Triggers System
-- Enables sequences to react to prospect actions in real-time
-- ============================================

-- Behavioral trigger rules table
CREATE TABLE IF NOT EXISTS public.sequence_behavioral_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id TEXT NOT NULL,

  -- Trigger identification
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Trigger configuration
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'page_visit',
    'email_open',
    'email_click',
    'email_reply',
    'form_submission',
    'linkedin_profile_view',
    'linkedin_connection_accepted',
    'meeting_booked',
    'document_viewed',
    'video_watched',
    'chat_interaction',
    'score_threshold',
    'custom_event'
  )),

  -- Conditions for trigger activation
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  -- Example conditions:
  -- For page_visit: { "url_contains": "/pricing", "duration_seconds": 30 }
  -- For email_click: { "link_contains": "demo", "click_count": 2 }
  -- For score_threshold: { "min_score": 70, "score_type": "engagement" }

  -- Action to take when triggered
  action_type TEXT NOT NULL CHECK (action_type IN (
    'enroll_in_sequence',
    'advance_to_step',
    'switch_branch',
    'pause_sequence',
    'resume_sequence',
    'add_tag',
    'update_field',
    'create_task',
    'send_notification',
    'webhook'
  )),

  -- Action configuration
  action_config JSONB NOT NULL DEFAULT '{}',
  -- Example configs:
  -- For enroll: { "sequence_id": "uuid", "skip_if_enrolled": true }
  -- For advance: { "target_step": 5 }
  -- For branch: { "branch_id": "uuid" }

  -- Timing and limits
  delay_minutes INTEGER DEFAULT 0,
  cooldown_hours INTEGER DEFAULT 24, -- Prevent repeated triggers
  max_triggers_per_lead INTEGER,
  max_triggers_total INTEGER,

  -- Filtering
  lead_filters JSONB DEFAULT '{}', -- Additional criteria for lead matching

  -- Priority for evaluation order
  priority INTEGER DEFAULT 100,

  -- Tracking
  total_triggers INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_by TEXT,

  UNIQUE(organization_id, name)
);

-- Index for fast lookup
CREATE INDEX idx_behavioral_triggers_active ON public.sequence_behavioral_triggers(organization_id, is_active, trigger_type);
CREATE INDEX idx_behavioral_triggers_priority ON public.sequence_behavioral_triggers(priority DESC);

-- Behavioral events tracking table
CREATE TABLE IF NOT EXISTS public.behavioral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id TEXT NOT NULL,

  -- Event source
  lead_id UUID REFERENCES public.sales_leads(id),
  contact_email TEXT,
  session_id TEXT,

  -- Event details
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  -- Example data:
  -- Page visit: { "url": "/pricing", "duration": 45, "referrer": "google" }
  -- Email open: { "email_id": "uuid", "campaign": "demo_followup" }

  -- Processing status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  matched_triggers UUID[], -- Array of trigger IDs that matched

  -- Source tracking
  source TEXT, -- 'website', 'email', 'linkedin', 'app', etc.
  ip_address INET,
  user_agent TEXT
);

-- Index for unprocessed events
CREATE INDEX idx_behavioral_events_unprocessed ON public.behavioral_events(organization_id, processed) WHERE processed = false;
CREATE INDEX idx_behavioral_events_lead ON public.behavioral_events(lead_id, created_at DESC);

-- Trigger execution log
CREATE TABLE IF NOT EXISTS public.trigger_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  trigger_id UUID REFERENCES public.sequence_behavioral_triggers(id),
  event_id UUID REFERENCES public.behavioral_events(id),
  lead_id UUID REFERENCES public.sales_leads(id),

  -- Execution details
  action_type TEXT NOT NULL,
  action_config JSONB,
  status TEXT CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,

  -- Results
  result_data JSONB,
  execution_time_ms INTEGER
);

-- Index for trigger history
CREATE INDEX idx_trigger_execution_trigger ON public.trigger_execution_log(trigger_id, created_at DESC);
CREATE INDEX idx_trigger_execution_lead ON public.trigger_execution_log(lead_id, created_at DESC);

-- Function to check cooldown period
CREATE OR REPLACE FUNCTION check_trigger_cooldown(
  p_trigger_id UUID,
  p_lead_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_cooldown_hours INTEGER;
  v_last_execution TIMESTAMPTZ;
BEGIN
  -- Get trigger cooldown period
  SELECT cooldown_hours
  INTO v_cooldown_hours
  FROM sequence_behavioral_triggers
  WHERE id = p_trigger_id;

  -- Check last execution for this lead
  SELECT MAX(created_at)
  INTO v_last_execution
  FROM trigger_execution_log
  WHERE trigger_id = p_trigger_id
    AND lead_id = p_lead_id
    AND status = 'success';

  -- If never executed or cooldown passed, return true
  IF v_last_execution IS NULL OR
     v_last_execution < NOW() - (v_cooldown_hours || ' hours')::INTERVAL THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to evaluate trigger conditions
CREATE OR REPLACE FUNCTION evaluate_trigger_conditions(
  p_trigger_conditions JSONB,
  p_event_data JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_key TEXT;
  v_condition JSONB;
  v_event_value TEXT;
BEGIN
  -- Iterate through all conditions
  FOR v_key, v_condition IN SELECT * FROM jsonb_each(p_trigger_conditions)
  LOOP
    -- Get the event value for this key
    v_event_value := p_event_data->>v_key;

    -- Check different condition types
    IF v_condition ? 'equals' THEN
      IF v_event_value != v_condition->>'equals' THEN
        RETURN false;
      END IF;
    END IF;

    IF v_condition ? 'contains' THEN
      IF v_event_value NOT LIKE '%' || (v_condition->>'contains') || '%' THEN
        RETURN false;
      END IF;
    END IF;

    IF v_condition ? 'gt' THEN
      IF (v_event_value::NUMERIC) <= (v_condition->>'gt')::NUMERIC THEN
        RETURN false;
      END IF;
    END IF;

    IF v_condition ? 'lt' THEN
      IF (v_event_value::NUMERIC) >= (v_condition->>'lt')::NUMERIC THEN
        RETURN false;
      END IF;
    END IF;

    IF v_condition ? 'in' THEN
      IF NOT (v_condition->'in' ? v_event_value) THEN
        RETURN false;
      END IF;
    END IF;
  END LOOP;

  -- All conditions passed
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Sample triggers for common use cases
INSERT INTO sequence_behavioral_triggers (
  organization_id,
  name,
  description,
  trigger_type,
  trigger_conditions,
  action_type,
  action_config,
  delay_minutes,
  priority
) VALUES
(
  'demo_org', -- Replace with actual org ID
  'Pricing Page Deep Engagement',
  'Trigger when someone spends significant time on pricing page',
  'page_visit',
  '{"url_contains": "/pricing", "duration_seconds": {"gt": 30}}',
  'switch_branch',
  '{"branch_name": "pricing_interested"}',
  5,
  90
),
(
  'demo_org',
  'High Email Engagement',
  'Move to fast track when someone opens multiple emails',
  'email_open',
  '{"open_count": {"gt": 3}, "time_window_hours": 24}',
  'advance_to_step',
  '{"steps_to_advance": 2}',
  0,
  85
),
(
  'demo_org',
  'Demo Link Click',
  'Enroll in demo sequence when demo link clicked',
  'email_click',
  '{"link_contains": "demo", "click_count": {"gt": 0}}',
  'enroll_in_sequence',
  '{"sequence_name": "demo_followup", "skip_if_enrolled": true}',
  1,
  95
)
ON CONFLICT DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_behavioral_triggers_updated_at
  BEFORE UPDATE ON public.sequence_behavioral_triggers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();