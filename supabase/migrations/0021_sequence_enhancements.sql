-- Migration: Sequence Enrollment Enhancements
-- Description: Adds suppression management, unsubscribe preferences, auto-enrollment rules, and A/B testing
-- Author: Claude
-- Date: 2025-11-29

-- ============================================
-- PHASE 1: SUPPRESSION & UNSUBSCRIBE MANAGEMENT
-- ============================================

-- Suppression list for leads who should not be enrolled
CREATE TABLE IF NOT EXISTS public.sequence_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id TEXT NOT NULL,

  -- Suppression target (at least one must be set)
  email TEXT,
  domain TEXT,
  lead_id UUID REFERENCES public.sales_leads(id) ON DELETE CASCADE,

  -- Suppression details
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'competitor', 'customer', 'manual', 'invalid')),
  source TEXT CHECK (source IN ('manual', 'import', 'auto', 'unsubscribe_link', 'bounce_webhook')),

  -- Optional expiration for temporary suppressions
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  added_by TEXT REFERENCES public.admin_users(clerk_user_id),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Ensure at least one suppression target is set
  CONSTRAINT must_have_target CHECK (
    email IS NOT NULL OR domain IS NOT NULL OR lead_id IS NOT NULL
  ),

  -- Unique constraints per organization
  CONSTRAINT unique_org_email UNIQUE(organization_id, email),
  CONSTRAINT unique_org_lead UNIQUE(organization_id, lead_id)
);

-- Unsubscribe preferences for granular control
CREATE TABLE IF NOT EXISTS public.unsubscribe_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id TEXT NOT NULL,

  -- Lead identification
  lead_id UUID REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  email TEXT NOT NULL,

  -- Granular preferences
  all_sequences BOOLEAN DEFAULT false,
  marketing_emails BOOLEAN DEFAULT false,
  transactional_emails BOOLEAN DEFAULT false,

  -- Frequency preferences
  max_emails_per_week INTEGER,
  preferred_send_days INTEGER[], -- 0=Sunday, 6=Saturday
  preferred_send_time_start TIME,
  preferred_send_time_end TIME,

  -- Channel preferences
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,

  -- Specific sequence opt-outs
  excluded_sequence_template_ids UUID[] DEFAULT '{}',
  excluded_sequence_categories TEXT[] DEFAULT '{}',

  -- Tracking
  unsubscribe_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  last_updated_at TIMESTAMPTZ,
  unsubscribe_reason TEXT,
  unsubscribe_feedback TEXT,

  CONSTRAINT unique_org_lead_prefs UNIQUE(organization_id, lead_id),
  CONSTRAINT unique_org_email_prefs UNIQUE(organization_id, email)
);

-- Add fields to leads for better enrollment management
ALTER TABLE public.sales_leads
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS email_valid BOOLEAN,
ADD COLUMN IF NOT EXISTS email_validated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_validation_error TEXT,
ADD COLUMN IF NOT EXISTS last_bounce_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bounce_count INTEGER DEFAULT 0;

-- ============================================
-- PHASE 2: AUTO-ENROLLMENT RULES
-- ============================================

-- Auto-enrollment rules for sequences
CREATE TABLE IF NOT EXISTS public.sequence_auto_enrollment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id TEXT NOT NULL,

  -- Rule configuration
  name TEXT NOT NULL,
  description TEXT,
  template_id UUID NOT NULL REFERENCES public.sequence_templates(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100, -- Lower number = higher priority

  -- Trigger conditions
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'lead_created',
    'lead_status_change',
    'lead_score_threshold',
    'form_submission',
    'tag_added',
    'field_updated',
    'webhook',
    'scheduled'
  )),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Lead filters (all must match)
  lead_filters JSONB DEFAULT '{}'::jsonb,
  /* Example:
  {
    "status": ["new", "contacted"],
    "tags": {"includes": ["hot-lead"], "excludes": ["customer"]},
    "score": {"min": 70},
    "custom_fields": {"industry": "SaaS"}
  }
  */

  -- Enrollment settings
  delay_minutes INTEGER DEFAULT 0,
  max_enrollments_per_day INTEGER,
  max_total_enrollments INTEGER,

  -- Execution window
  execute_between_start TIME,
  execute_between_end TIME,
  execute_on_days INTEGER[], -- 0=Sunday, 6=Saturday

  -- Tracking
  last_triggered_at TIMESTAMPTZ,
  total_enrollments INTEGER DEFAULT 0,

  created_by TEXT REFERENCES public.admin_users(clerk_user_id),
  last_modified_by TEXT REFERENCES public.admin_users(clerk_user_id),

  CONSTRAINT unique_rule_name UNIQUE(organization_id, name)
);

-- Track auto-enrollment execution history
CREATE TABLE IF NOT EXISTS public.sequence_auto_enrollment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  rule_id UUID NOT NULL REFERENCES public.sequence_auto_enrollment_rules(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.sales_leads(id) ON DELETE SET NULL,

  -- Execution details
  status TEXT NOT NULL CHECK (status IN ('enrolled', 'skipped', 'failed')),
  skip_reason TEXT, -- 'suppressed', 'already_enrolled', 'daily_limit', 'filters_not_matched'
  error_message TEXT,

  -- Audit
  trigger_data JSONB,
  filters_evaluated JSONB
);

-- ============================================
-- PHASE 3: A/B TESTING FRAMEWORK
-- ============================================

-- A/B test variants for sequences
CREATE TABLE IF NOT EXISTS public.sequence_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id TEXT NOT NULL,

  -- Test configuration
  name TEXT NOT NULL,
  description TEXT,
  template_id UUID NOT NULL REFERENCES public.sequence_templates(id) ON DELETE CASCADE,

  -- Variants
  variant_a_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  variant_b_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  variant_a_name TEXT DEFAULT 'Control',
  variant_b_name TEXT DEFAULT 'Variant',

  -- What to test
  test_type TEXT NOT NULL CHECK (test_type IN (
    'subject_line',
    'email_content',
    'send_time',
    'sequence_flow',
    'from_name',
    'call_to_action'
  )),

  -- Distribution
  traffic_split INTEGER DEFAULT 50 CHECK (traffic_split BETWEEN 1 AND 99), -- % to variant B

  -- Test settings
  min_sample_size INTEGER DEFAULT 100,
  confidence_level DECIMAL(3,2) DEFAULT 0.95,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Results
  variant_a_enrollments INTEGER DEFAULT 0,
  variant_b_enrollments INTEGER DEFAULT 0,
  variant_a_conversions INTEGER DEFAULT 0,
  variant_b_conversions INTEGER DEFAULT 0,

  winner TEXT CHECK (winner IN ('a', 'b', 'no_difference')),
  statistical_significance DECIMAL(3,2),
  lift_percentage DECIMAL(5,2),

  created_by TEXT REFERENCES public.admin_users(clerk_user_id),

  CONSTRAINT unique_test_name UNIQUE(organization_id, name)
);

-- Track which variant each enrollment belongs to
ALTER TABLE public.sequence_enrollments
ADD COLUMN IF NOT EXISTS ab_test_id UUID REFERENCES public.sequence_ab_tests(id),
ADD COLUMN IF NOT EXISTS ab_test_variant TEXT CHECK (ab_test_variant IN ('a', 'b'));

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Suppression indexes
CREATE INDEX IF NOT EXISTS idx_suppressions_org_email ON public.sequence_suppressions(organization_id, email) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_suppressions_org_domain ON public.sequence_suppressions(organization_id, domain) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_suppressions_org_lead ON public.sequence_suppressions(organization_id, lead_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_suppressions_expires ON public.sequence_suppressions(expires_at) WHERE expires_at IS NOT NULL;

-- Preferences indexes
CREATE INDEX IF NOT EXISTS idx_preferences_org_email ON public.unsubscribe_preferences(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_preferences_token ON public.unsubscribe_preferences(unsubscribe_token);

-- Auto-enrollment indexes
CREATE INDEX IF NOT EXISTS idx_auto_rules_org_active ON public.sequence_auto_enrollment_rules(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_auto_rules_template ON public.sequence_auto_enrollment_rules(template_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_auto_logs_rule ON public.sequence_auto_enrollment_logs(rule_id, created_at);

-- A/B test indexes
CREATE INDEX IF NOT EXISTS idx_ab_tests_org_status ON public.sequence_ab_tests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_ab_tests_template ON public.sequence_ab_tests(template_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_ab_test ON public.sequence_enrollments(ab_test_id, ab_test_variant);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if a lead can be enrolled (considering suppressions)
CREATE OR REPLACE FUNCTION can_enroll_lead(
  p_lead_id UUID,
  p_lead_email TEXT,
  p_organization_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  is_suppressed BOOLEAN;
BEGIN
  -- Check for active suppressions
  SELECT EXISTS (
    SELECT 1 FROM public.sequence_suppressions
    WHERE organization_id = p_organization_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (
        (lead_id = p_lead_id) OR
        (email = p_lead_email) OR
        (domain = split_part(p_lead_email, '@', 2))
      )
  ) INTO is_suppressed;

  -- Check for unsubscribe preferences
  IF NOT is_suppressed THEN
    SELECT EXISTS (
      SELECT 1 FROM public.unsubscribe_preferences
      WHERE organization_id = p_organization_id
        AND (lead_id = p_lead_id OR email = p_lead_email)
        AND all_sequences = true
    ) INTO is_suppressed;
  END IF;

  RETURN NOT is_suppressed;
END;
$$ LANGUAGE plpgsql;

-- Function to assign A/B test variant
CREATE OR REPLACE FUNCTION assign_ab_test_variant(
  p_test_id UUID
)
RETURNS TEXT AS $$
DECLARE
  test_record RECORD;
  random_value INTEGER;
BEGIN
  -- Get test configuration
  SELECT traffic_split, status
  INTO test_record
  FROM public.sequence_ab_tests
  WHERE id = p_test_id;

  -- Only assign if test is running
  IF test_record.status != 'running' THEN
    RETURN NULL;
  END IF;

  -- Random assignment based on traffic split
  random_value := floor(random() * 100);

  IF random_value < test_record.traffic_split THEN
    RETURN 'b';
  ELSE
    RETURN 'a';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamps
CREATE TRIGGER update_suppressions_updated_at
  BEFORE UPDATE ON public.sequence_suppressions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preferences_updated_at
  BEFORE UPDATE ON public.unsubscribe_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auto_rules_updated_at
  BEFORE UPDATE ON public.sequence_auto_enrollment_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ab_tests_updated_at
  BEFORE UPDATE ON public.sequence_ab_tests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION NOTES
-- ============================================

-- After running this migration:
-- 1. Run audit query to identify existing enrollments that should be paused
-- 2. Import any existing suppression lists
-- 3. Configure auto-enrollment rules based on business requirements
-- 4. Set up webhook endpoints for bounce/complaint handling
-- 5. Update email templates to include unsubscribe links

COMMENT ON TABLE public.sequence_suppressions IS 'Manages email/lead suppressions to prevent unwanted enrollments';
COMMENT ON TABLE public.unsubscribe_preferences IS 'Granular unsubscribe preferences for leads';
COMMENT ON TABLE public.sequence_auto_enrollment_rules IS 'Automated enrollment rules based on triggers and conditions';
COMMENT ON TABLE public.sequence_ab_tests IS 'A/B testing framework for optimizing sequences';
COMMENT ON FUNCTION can_enroll_lead IS 'Checks if a lead can be enrolled considering all suppression rules';
COMMENT ON FUNCTION assign_ab_test_variant IS 'Randomly assigns A/B test variant based on traffic split';