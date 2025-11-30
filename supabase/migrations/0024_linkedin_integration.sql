-- ============================================
-- LinkedIn Integration Tables
-- Manages LinkedIn automation tasks and credentials
-- ============================================

-- LinkedIn account credentials (encrypted)
CREATE TABLE IF NOT EXISTS public.linkedin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL, -- Clerk user who owns this account

  -- Account details
  account_name TEXT NOT NULL, -- Display name for this account
  linkedin_email TEXT,
  linkedin_profile_url TEXT,

  -- Extension connection
  extension_id TEXT, -- Chrome extension instance ID
  is_connected BOOLEAN DEFAULT false,
  last_connected_at TIMESTAMPTZ,

  -- Rate limit tracking
  daily_limits JSONB DEFAULT '{
    "connections": 20,
    "messages": 50,
    "profile_views": 100,
    "likes": 50
  }',

  daily_usage JSONB DEFAULT '{
    "connections": 0,
    "messages": 0,
    "profile_views": 0,
    "likes": 0
  }',

  usage_reset_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 day',

  -- Status
  is_active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'disconnected', -- connected, disconnected, rate_limited, suspended
  status_message TEXT,

  UNIQUE(organization_id, linkedin_email)
);

-- LinkedIn automation tasks
CREATE TABLE IF NOT EXISTS public.linkedin_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  organization_id TEXT NOT NULL,
  linkedin_account_id UUID REFERENCES public.linkedin_accounts(id),

  -- Task source
  lead_id UUID REFERENCES public.sales_leads(id),
  enrollment_id UUID REFERENCES public.sequence_enrollments(id),
  sequence_step_id UUID REFERENCES public.sequence_steps(id),

  -- Task details
  action_type TEXT NOT NULL CHECK (action_type IN (
    'connect',
    'message',
    'view_profile',
    'like_post',
    'comment',
    'follow',
    'unfollow',
    'extract_profile'
  )),

  -- Target information
  profile_url TEXT,
  post_url TEXT,

  -- Content
  message_content TEXT,
  connection_note TEXT,
  comment_text TEXT,

  -- Automation settings
  automation_mode TEXT DEFAULT 'semi_auto' CHECK (automation_mode IN (
    'full_auto',    -- Execute without review
    'semi_auto',    -- Queue for batch approval
    'assisted',     -- Create draft for manual send
    'manual'        -- Create task only
  )),

  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  execute_after TIMESTAMPTZ, -- For delays between actions

  -- Execution
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'queued',
    'processing',
    'completed',
    'failed',
    'skipped',
    'cancelled'
  )),

  priority INTEGER DEFAULT 100,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,

  -- Results
  executed_at TIMESTAMPTZ,
  executed_by TEXT, -- User ID if manual, 'automation' if auto
  result_data JSONB,
  error_message TEXT,

  -- Tracking
  review_required BOOLEAN DEFAULT false,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT
);

-- Index for task processing
CREATE INDEX idx_linkedin_tasks_pending ON public.linkedin_tasks(organization_id, status, priority DESC, created_at)
  WHERE status IN ('pending', 'queued');
CREATE INDEX idx_linkedin_tasks_lead ON public.linkedin_tasks(lead_id, created_at DESC);
CREATE INDEX idx_linkedin_tasks_enrollment ON public.linkedin_tasks(enrollment_id, created_at DESC);

-- LinkedIn profile data cache
CREATE TABLE IF NOT EXISTS public.linkedin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  profile_url TEXT UNIQUE NOT NULL,

  -- Profile information
  full_name TEXT,
  headline TEXT,
  location TEXT,
  about TEXT,

  -- Company information
  current_company TEXT,
  current_title TEXT,
  company_size TEXT,
  industry TEXT,

  -- Engagement data
  connection_degree INTEGER, -- 1st, 2nd, 3rd degree
  is_connected BOOLEAN DEFAULT false,
  connected_at TIMESTAMPTZ,

  followers_count INTEGER,
  connections_count INTEGER,

  -- Extracted data
  experience JSONB, -- Array of experience objects
  education JSONB, -- Array of education objects
  skills JSONB, -- Array of skills

  -- Activity
  recent_posts JSONB, -- Recent post data
  last_active TIMESTAMPTZ,

  -- Enrichment
  email_discovered TEXT,
  phone_discovered TEXT,
  personal_website TEXT,

  -- Update tracking
  last_scraped_at TIMESTAMPTZ,
  scrape_count INTEGER DEFAULT 0
);

-- LinkedIn engagement log
CREATE TABLE IF NOT EXISTS public.linkedin_engagement_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  organization_id TEXT NOT NULL,
  task_id UUID REFERENCES public.linkedin_tasks(id),
  lead_id UUID REFERENCES public.sales_leads(id),

  -- Action details
  action_type TEXT NOT NULL,
  target_url TEXT,

  -- Results
  success BOOLEAN NOT NULL,
  response_data JSONB,

  -- Tracking
  automation_mode TEXT,
  executed_by TEXT,
  execution_time_ms INTEGER
);

-- Index for engagement analytics
CREATE INDEX idx_linkedin_engagement_lead ON public.linkedin_engagement_log(lead_id, created_at DESC);
CREATE INDEX idx_linkedin_engagement_org ON public.linkedin_engagement_log(organization_id, created_at DESC);

-- LinkedIn sequence steps (extends regular sequence steps)
CREATE TABLE IF NOT EXISTS public.sequence_linkedin_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  sequence_step_id UUID REFERENCES public.sequence_steps(id) ON DELETE CASCADE,

  -- LinkedIn specific configuration
  action_type TEXT NOT NULL,

  -- Connection request settings
  connection_note_template TEXT,
  skip_if_connected BOOLEAN DEFAULT true,

  -- Message settings
  message_template TEXT,
  require_connection BOOLEAN DEFAULT true,

  -- Profile view settings
  view_duration_seconds INTEGER DEFAULT 5,
  scroll_profile BOOLEAN DEFAULT true,

  -- Engagement settings
  like_recent_posts INTEGER, -- Number of recent posts to like
  comment_templates JSONB, -- Array of comment templates

  -- Automation mode for this step
  automation_mode TEXT DEFAULT 'semi_auto',

  UNIQUE(sequence_step_id)
);

-- Function to reset daily LinkedIn usage
CREATE OR REPLACE FUNCTION reset_linkedin_daily_usage() RETURNS void AS $$
BEGIN
  UPDATE linkedin_accounts
  SET
    daily_usage = '{
      "connections": 0,
      "messages": 0,
      "profile_views": 0,
      "likes": 0
    }',
    usage_reset_at = NOW() + INTERVAL '1 day'
  WHERE usage_reset_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to check LinkedIn rate limits
CREATE OR REPLACE FUNCTION check_linkedin_rate_limit(
  p_account_id UUID,
  p_action_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_daily_limits JSONB;
  v_daily_usage JSONB;
  v_limit INTEGER;
  v_usage INTEGER;
BEGIN
  -- Get current limits and usage
  SELECT daily_limits, daily_usage
  INTO v_daily_limits, v_daily_usage
  FROM linkedin_accounts
  WHERE id = p_account_id;

  -- Map action type to usage category
  CASE p_action_type
    WHEN 'connect' THEN
      v_limit := (v_daily_limits->>'connections')::INTEGER;
      v_usage := (v_daily_usage->>'connections')::INTEGER;
    WHEN 'message' THEN
      v_limit := (v_daily_limits->>'messages')::INTEGER;
      v_usage := (v_daily_usage->>'messages')::INTEGER;
    WHEN 'view_profile' THEN
      v_limit := (v_daily_limits->>'profile_views')::INTEGER;
      v_usage := (v_daily_usage->>'profile_views')::INTEGER;
    WHEN 'like_post' THEN
      v_limit := (v_daily_limits->>'likes')::INTEGER;
      v_usage := (v_daily_usage->>'likes')::INTEGER;
    ELSE
      RETURN true; -- No limit for other actions
  END CASE;

  RETURN v_usage < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to increment LinkedIn usage
CREATE OR REPLACE FUNCTION increment_linkedin_usage(
  p_account_id UUID,
  p_action_type TEXT
) RETURNS void AS $$
DECLARE
  v_field TEXT;
BEGIN
  -- Map action type to usage field
  CASE p_action_type
    WHEN 'connect' THEN v_field := 'connections';
    WHEN 'message' THEN v_field := 'messages';
    WHEN 'view_profile' THEN v_field := 'profile_views';
    WHEN 'like_post' THEN v_field := 'likes';
    ELSE RETURN; -- No tracking for other actions
  END CASE;

  -- Increment the usage counter
  UPDATE linkedin_accounts
  SET daily_usage = jsonb_set(
    daily_usage,
    ARRAY[v_field],
    to_jsonb((daily_usage->>v_field)::INTEGER + 1)
  )
  WHERE id = p_account_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_linkedin_accounts_updated_at
  BEFORE UPDATE ON public.linkedin_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_linkedin_tasks_updated_at
  BEFORE UPDATE ON public.linkedin_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_linkedin_profiles_updated_at
  BEFORE UPDATE ON public.linkedin_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.linkedin_accounts TO authenticated;
GRANT ALL ON public.linkedin_tasks TO authenticated;
GRANT ALL ON public.linkedin_profiles TO authenticated;
GRANT ALL ON public.linkedin_engagement_log TO authenticated;
GRANT ALL ON public.sequence_linkedin_steps TO authenticated;