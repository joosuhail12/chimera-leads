CREATE TABLE IF NOT EXISTS public.marketing_subscription_preferences (
  audience_id UUID PRIMARY KEY REFERENCES public.audience (id) ON DELETE CASCADE,
  email_status TEXT NOT NULL DEFAULT 'subscribed' CHECK (email_status IN ('subscribed', 'unsubscribed', 'transactional_only')),
  sms_status TEXT NOT NULL DEFAULT 'subscribed' CHECK (sms_status IN ('subscribed', 'unsubscribed', 'transactional_only')),
  push_status TEXT NOT NULL DEFAULT 'subscribed' CHECK (push_status IN ('subscribed', 'unsubscribed', 'transactional_only')),
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.marketing_subscription_preferences_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketing_subscription_preferences_updated_at ON public.marketing_subscription_preferences;
CREATE TRIGGER trg_marketing_subscription_preferences_updated_at
BEFORE UPDATE ON public.marketing_subscription_preferences
FOR EACH ROW
EXECUTE FUNCTION public.marketing_subscription_preferences_set_updated_at();

CREATE TABLE IF NOT EXISTS public.suppression_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'campaign', 'ad_hoc')),
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.suppression_lists_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_suppression_lists_updated_at ON public.suppression_lists;
CREATE TRIGGER trg_suppression_lists_updated_at
BEFORE UPDATE ON public.suppression_lists
FOR EACH ROW
EXECUTE FUNCTION public.suppression_lists_set_updated_at();

CREATE TABLE IF NOT EXISTS public.suppression_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suppression_list_id UUID NOT NULL REFERENCES public.suppression_lists (id) ON DELETE CASCADE,
  audience_id UUID REFERENCES public.audience (id) ON DELETE CASCADE,
  email TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  CONSTRAINT suppression_entries_target_check CHECK (audience_id IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_suppression_entries_audience_id ON public.suppression_entries (audience_id);
CREATE INDEX IF NOT EXISTS idx_suppression_entries_email ON public.suppression_entries (lower(email));

INSERT INTO public.suppression_lists (id, name, scope, description)
SELECT gen_random_uuid(), 'Global Suppression', 'global', 'Automatically excludes unsubscribes, bounces, and legal blocks.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.suppression_lists WHERE scope = 'global' AND name = 'Global Suppression'
);
