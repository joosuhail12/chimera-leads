-- Migration: Add helper functions for sequence operations
-- Description: Creates database functions to support sequence execution and tracking
-- Author: Claude
-- Date: 2025-11-29

-- Function to increment enrollment metrics
CREATE OR REPLACE FUNCTION increment_enrollment_metric(
  p_enrollment_id UUID,
  p_metric TEXT
)
RETURNS VOID AS $$
BEGIN
  CASE p_metric
    WHEN 'emails_sent' THEN
      UPDATE public.sequence_enrollments
      SET emails_sent = emails_sent + 1
      WHERE id = p_enrollment_id;
    WHEN 'emails_opened' THEN
      UPDATE public.sequence_enrollments
      SET emails_opened = emails_opened + 1
      WHERE id = p_enrollment_id;
    WHEN 'emails_clicked' THEN
      UPDATE public.sequence_enrollments
      SET emails_clicked = emails_clicked + 1
      WHERE id = p_enrollment_id;
    WHEN 'emails_bounced' THEN
      UPDATE public.sequence_enrollments
      SET emails_bounced = emails_bounced + 1
      WHERE id = p_enrollment_id;
    WHEN 'replies_received' THEN
      UPDATE public.sequence_enrollments
      SET replies_received = replies_received + 1
      WHERE id = p_enrollment_id;
    WHEN 'meetings_booked' THEN
      UPDATE public.sequence_enrollments
      SET meetings_booked = meetings_booked + 1
      WHERE id = p_enrollment_id;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to reorder sequence steps after deletion
CREATE OR REPLACE FUNCTION reorder_sequence_steps(
  p_template_id UUID,
  p_deleted_step_number INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.sequence_steps
  SET step_number = step_number - 1
  WHERE template_id = p_template_id
    AND step_number > p_deleted_step_number;
END;
$$ LANGUAGE plpgsql;

-- Function to get next scheduled enrollments
CREATE OR REPLACE FUNCTION get_due_enrollments(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  enrollment_id UUID,
  lead_id UUID,
  template_id UUID,
  current_step INTEGER,
  next_step_scheduled_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id AS enrollment_id,
    se.lead_id,
    se.template_id,
    se.current_step,
    se.next_step_scheduled_at
  FROM public.sequence_enrollments se
  WHERE se.status = 'active'
    AND se.next_step_scheduled_at <= NOW()
  ORDER BY se.next_step_scheduled_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a lead has replied to any sequence email
CREATE OR REPLACE FUNCTION check_lead_replied(
  p_lead_email TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  reply_count INTEGER;
BEGIN
  -- This is a placeholder - in production, you'd check your email system
  -- For now, just return false
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate sequence performance metrics
CREATE OR REPLACE FUNCTION calculate_sequence_performance(
  p_template_id UUID
)
RETURNS TABLE (
  total_enrolled INTEGER,
  total_active INTEGER,
  total_completed INTEGER,
  avg_open_rate DECIMAL(5,2),
  avg_click_rate DECIMAL(5,2),
  avg_reply_rate DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_enrolled,
    COUNT(*) FILTER (WHERE status = 'active')::INTEGER AS total_active,
    COUNT(*) FILTER (WHERE status = 'completed')::INTEGER AS total_completed,
    COALESCE(
      AVG(
        CASE
          WHEN emails_sent > 0 THEN (emails_opened::DECIMAL / emails_sent * 100)
          ELSE 0
        END
      ), 0
    )::DECIMAL(5,2) AS avg_open_rate,
    COALESCE(
      AVG(
        CASE
          WHEN emails_sent > 0 THEN (emails_clicked::DECIMAL / emails_sent * 100)
          ELSE 0
        END
      ), 0
    )::DECIMAL(5,2) AS avg_click_rate,
    COALESCE(
      AVG(
        CASE
          WHEN emails_sent > 0 THEN (replies_received::DECIMAL / emails_sent * 100)
          ELSE 0
        END
      ), 0
    )::DECIMAL(5,2) AS avg_reply_rate
  FROM public.sequence_enrollments
  WHERE template_id = p_template_id;
END;
$$ LANGUAGE plpgsql;

-- Create an index for faster sequence execution queries
CREATE INDEX IF NOT EXISTS idx_enrollments_due_execution
ON public.sequence_enrollments(next_step_scheduled_at, status)
WHERE status = 'active' AND next_step_scheduled_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON FUNCTION increment_enrollment_metric IS 'Increments a specific metric for a sequence enrollment';
COMMENT ON FUNCTION reorder_sequence_steps IS 'Reorders step numbers after a step is deleted';
COMMENT ON FUNCTION get_due_enrollments IS 'Returns enrollments that are due for execution';
COMMENT ON FUNCTION check_lead_replied IS 'Checks if a lead has replied to sequence emails';
COMMENT ON FUNCTION calculate_sequence_performance IS 'Calculates performance metrics for a sequence template';