-- Shared channel enum for marketing preferences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'marketing_channel'
  ) THEN
    CREATE TYPE marketing_channel AS ENUM ('email', 'sms', 'push');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.marketing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id UUID NOT NULL REFERENCES public.audience (id) ON DELETE CASCADE,
  channel marketing_channel NOT NULL DEFAULT 'email',
  is_subscribed BOOLEAN NOT NULL DEFAULT true,
  consent_collected_at TIMESTAMPTZ,
  consent_method TEXT,
  consent_ip INET,
  consent_user_agent TEXT,
  jurisdiction TEXT,
  lawful_basis TEXT,
  preference_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_reason TEXT,
  global_unsubscribed BOOLEAN NOT NULL DEFAULT false,
  global_unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (audience_id, channel)
);

CREATE OR REPLACE FUNCTION public.marketing_subscriptions_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketing_subscriptions_updated_at ON public.marketing_subscriptions;

CREATE TRIGGER trg_marketing_subscriptions_updated_at
BEFORE UPDATE ON public.marketing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.marketing_subscriptions_set_updated_at();
