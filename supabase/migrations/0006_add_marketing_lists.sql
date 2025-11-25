DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'marketing_channel'
  ) THEN
    CREATE TYPE marketing_channel AS ENUM ('email', 'sms', 'push');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.marketing_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.marketing_list_members (
  list_id UUID NOT NULL REFERENCES public.marketing_lists (id) ON DELETE CASCADE,
  audience_id UUID NOT NULL REFERENCES public.audience (id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, audience_id)
);

CREATE OR REPLACE FUNCTION public.marketing_lists_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketing_lists_updated_at ON public.marketing_lists;
CREATE TRIGGER trg_marketing_lists_updated_at
BEFORE UPDATE ON public.marketing_lists
FOR EACH ROW
EXECUTE FUNCTION public.marketing_lists_set_updated_at();
