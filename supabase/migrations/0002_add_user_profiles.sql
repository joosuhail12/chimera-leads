-- User profiles synced from Clerk for richer metadata
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  username TEXT,
  image_url TEXT,
  primary_phone TEXT,
  organization_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_user_profiles_admin_user
    FOREIGN KEY (clerk_user_id) REFERENCES public.admin_users (clerk_user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_clerk_user_id
  ON public.user_profiles (clerk_user_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email
  ON public.user_profiles (email);
