-- Migration: Add Prospecting Sequences Tables
-- Description: Creates tables for automated outreach sequences including templates, steps, enrollments, and execution history
-- Author: Claude
-- Date: 2025-11-29

-- Sequence templates for reusable outreach workflows
CREATE TABLE IF NOT EXISTS public.sequence_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Organization for multi-tenancy
  organization_id TEXT NOT NULL,

  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('cold_outreach', 'nurture', 'follow_up', 'win_back', 'custom')),

  -- Settings stored as JSONB for flexibility
  settings JSONB DEFAULT '{
    "pauseOnReply": true,
    "pauseOnMeeting": true,
    "skipWeekends": true,
    "dailyLimit": 50,
    "timezone": "America/New_York"
  }'::jsonb,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_by TEXT REFERENCES public.admin_users(clerk_user_id),
  last_modified_by TEXT REFERENCES public.admin_users(clerk_user_id),

  -- Performance metrics (updated via triggers)
  total_enrolled INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  avg_reply_rate DECIMAL(5,2) DEFAULT 0,
  avg_open_rate DECIMAL(5,2) DEFAULT 0,

  -- Constraints
  CONSTRAINT sequence_template_name_org_unique UNIQUE(organization_id, name)
);

-- Sequence steps define the workflow
CREATE TABLE IF NOT EXISTS public.sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.sequence_templates(id) ON DELETE CASCADE,

  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('email', 'task', 'wait', 'conditional', 'webhook')),

  -- Timing configuration
  wait_days INTEGER DEFAULT 0 CHECK (wait_days >= 0),
  wait_hours INTEGER DEFAULT 0 CHECK (wait_hours >= 0 AND wait_hours < 24),
  send_time_window JSONB, -- {"start": "09:00", "end": "17:00", "timezone": "America/New_York"}

  -- Email content (for email steps)
  email_subject TEXT,
  email_body TEXT,
  email_from_name TEXT,
  email_reply_to TEXT,

  -- Task configuration (for task steps)
  task_title TEXT,
  task_description TEXT,
  task_priority TEXT DEFAULT 'medium' CHECK (task_priority IN ('low', 'medium', 'high')),
  task_due_days INTEGER DEFAULT 1,

  -- Conditional logic (for conditional steps)
  conditions JSONB, -- {"type": "email_opened", "value": true, "goto_step": 5}

  -- Webhook configuration (for webhook steps)
  webhook_url TEXT,
  webhook_method TEXT DEFAULT 'POST',
  webhook_headers JSONB,
  webhook_body JSONB,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT sequence_step_unique UNIQUE(template_id, step_number),
  CONSTRAINT valid_email_step CHECK (
    (step_type != 'email') OR
    (email_subject IS NOT NULL AND email_body IS NOT NULL)
  ),
  CONSTRAINT valid_task_step CHECK (
    (step_type != 'task') OR
    (task_title IS NOT NULL)
  )
);

-- Track lead enrollment in sequences
CREATE TABLE IF NOT EXISTS public.sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Relationships
  lead_id UUID NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.sequence_templates(id) ON DELETE CASCADE,

  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'stopped', 'failed')),
  current_step INTEGER DEFAULT 0,

  -- Pause/stop tracking
  paused_at TIMESTAMPTZ,
  paused_reason TEXT,
  resumed_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  stopped_reason TEXT,

  -- Scheduling
  last_step_executed_at TIMESTAMPTZ,
  next_step_scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Performance metrics
  emails_sent INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  emails_bounced INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  meetings_booked INTEGER DEFAULT 0,

  -- User tracking
  enrolled_by TEXT REFERENCES public.admin_users(clerk_user_id),
  stopped_by TEXT REFERENCES public.admin_users(clerk_user_id),

  -- Prevent duplicate enrollments
  CONSTRAINT unique_active_enrollment UNIQUE(lead_id, template_id)
);

-- Track execution history for each step
CREATE TABLE IF NOT EXISTS public.sequence_step_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Relationships
  enrollment_id UUID NOT NULL REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.sequence_steps(id) ON DELETE CASCADE,

  -- Execution details
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped', 'pending')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- For email steps - track sending details
  email_provider TEXT, -- 'gmail', 'outlook', 'ses'
  email_message_id TEXT, -- External email service ID
  email_thread_id TEXT,

  -- Tracking data
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,

  -- For task steps
  task_id UUID REFERENCES public.crm_tasks(id),

  -- For webhook steps
  webhook_response_code INTEGER,
  webhook_response_body JSONB,

  -- Metadata
  execution_metadata JSONB -- Store any additional execution-specific data
);

-- Email tracking events (opens, clicks, etc.)
CREATE TABLE IF NOT EXISTS public.sequence_email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Relationships
  execution_id UUID NOT NULL REFERENCES public.sequence_step_executions(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click', 'reply', 'bounce', 'unsubscribe', 'spam')),

  -- Tracking details
  ip_address INET,
  user_agent TEXT,
  location_country TEXT,
  location_city TEXT,

  -- For click events
  link_url TEXT,
  link_position INTEGER,

  -- For bounce events
  bounce_type TEXT, -- 'hard', 'soft', 'block'
  bounce_reason TEXT
);

-- Create indexes for performance
CREATE INDEX idx_sequence_templates_org ON public.sequence_templates(organization_id);
CREATE INDEX idx_sequence_templates_active ON public.sequence_templates(organization_id, is_active);
CREATE INDEX idx_sequence_steps_template ON public.sequence_steps(template_id, step_number);
CREATE INDEX idx_enrollments_lead ON public.sequence_enrollments(lead_id, status);
CREATE INDEX idx_enrollments_template ON public.sequence_enrollments(template_id, status);
CREATE INDEX idx_enrollments_scheduled ON public.sequence_enrollments(next_step_scheduled_at)
  WHERE status = 'active';
CREATE INDEX idx_executions_enrollment ON public.sequence_step_executions(enrollment_id, executed_at);
CREATE INDEX idx_email_events_execution ON public.sequence_email_events(execution_id, event_type);

-- Check if the function exists before creating
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Add updated_at trigger for sequence_templates
CREATE TRIGGER update_sequence_templates_updated_at
  BEFORE UPDATE ON public.sequence_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for sequence_steps
CREATE TRIGGER update_sequence_steps_updated_at
  BEFORE UPDATE ON public.sequence_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create a function to update sequence metrics
CREATE OR REPLACE FUNCTION update_sequence_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update template metrics when enrollment completes
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.sequence_templates
    SET
      total_completed = total_completed + 1,
      avg_reply_rate = (
        SELECT AVG(
          CASE
            WHEN emails_sent > 0 THEN (replies_received::float / emails_sent * 100)
            ELSE 0
          END
        )
        FROM public.sequence_enrollments
        WHERE template_id = NEW.template_id AND status = 'completed'
      ),
      avg_open_rate = (
        SELECT AVG(
          CASE
            WHEN emails_sent > 0 THEN (emails_opened::float / emails_sent * 100)
            ELSE 0
          END
        )
        FROM public.sequence_enrollments
        WHERE template_id = NEW.template_id AND status = 'completed'
      )
    WHERE id = NEW.template_id;
  END IF;

  -- Update total enrolled when new enrollment created
  IF TG_OP = 'INSERT' THEN
    UPDATE public.sequence_templates
    SET total_enrolled = total_enrolled + 1
    WHERE id = NEW.template_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating sequence metrics
CREATE TRIGGER update_sequence_metrics_trigger
AFTER INSERT OR UPDATE ON public.sequence_enrollments
FOR EACH ROW
EXECUTE FUNCTION update_sequence_metrics();

-- Add comments for documentation
COMMENT ON TABLE public.sequence_templates IS 'Reusable email sequence templates for automated outreach';
COMMENT ON TABLE public.sequence_steps IS 'Individual steps within a sequence template';
COMMENT ON TABLE public.sequence_enrollments IS 'Tracks leads enrolled in sequences';
COMMENT ON TABLE public.sequence_step_executions IS 'Execution history for each sequence step';
COMMENT ON TABLE public.sequence_email_events IS 'Email tracking events (opens, clicks, replies)';

COMMENT ON COLUMN public.sequence_templates.settings IS 'JSON settings including pauseOnReply, skipWeekends, dailyLimit, etc.';
COMMENT ON COLUMN public.sequence_steps.conditions IS 'Conditional logic for branching sequences';
COMMENT ON COLUMN public.sequence_enrollments.status IS 'Current status: active, paused, completed, stopped, or failed';
COMMENT ON COLUMN public.sequence_step_executions.email_message_id IS 'External email provider message ID for tracking';