-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Shared enums
CREATE TYPE lead_status AS ENUM (
  'new',
  'contacted',
  'qualified',
  'demo_scheduled',
  'negotiation',
  'closed_won',
  'closed_lost',
  'spam'
);

CREATE TYPE lead_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE app_status AS ENUM (
  'pending',
  'under_review',
  'interview',
  'accepted',
  'rejected',
  'waitlisted'
);

CREATE TYPE program_tier AS ENUM ('standard', 'plus', 'partner');

CREATE TYPE booking_status AS ENUM (
  'scheduled',
  'rescheduled',
  'cancelled',
  'completed',
  'no_show'
);

-- Admin users synced from Clerk
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  team TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users (email);

-- Sales leads
CREATE TABLE IF NOT EXISTS public.sales_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  original_id UUID,
  status lead_status NOT NULL DEFAULT 'new',
  priority lead_priority NOT NULL DEFAULT 'medium',
  assigned_to TEXT REFERENCES public.admin_users (clerk_user_id),
  admin_notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  company_size TEXT,
  industry TEXT,
  timeline TEXT,
  phone TEXT,
  current_solution TEXT,
  message TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  referrer TEXT,
  landing_page TEXT,
  raw_payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales_leads (status);
CREATE INDEX IF NOT EXISTS idx_sales_assigned ON public.sales_leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_sales_email ON public.sales_leads (email);

-- Startup applications
CREATE TABLE IF NOT EXISTS public.startup_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  original_id UUID,
  status app_status NOT NULL DEFAULT 'pending',
  program_tier program_tier,
  reviewed_by TEXT REFERENCES public.admin_users (clerk_user_id),
  rejection_reason TEXT,
  admin_notes TEXT,
  company_name TEXT NOT NULL,
  website TEXT NOT NULL,
  email TEXT NOT NULL,
  founding_date TEXT,
  annual_revenue TEXT,
  total_funding TEXT,
  seats_needed TEXT,
  customer_status TEXT,
  current_tools TEXT,
  use_case TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  raw_payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_startup_status ON public.startup_applications (status);
CREATE INDEX IF NOT EXISTS idx_startup_email ON public.startup_applications (email);

-- Audience / newsletter contacts
CREATE TABLE IF NOT EXISTS public.audience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'blog',
  unsubscribed_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  customer_fit_score INT NOT NULL DEFAULT 0,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  raw_payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_audience_email ON public.audience (email);

-- Bookings
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lead_id UUID REFERENCES public.sales_leads (id),
  lead_email TEXT,
  event_title TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  timezone TEXT,
  location TEXT,
  meeting_url TEXT,
  notes TEXT,
  status booking_status NOT NULL DEFAULT 'scheduled',
  raw_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_bookings_start ON public.bookings (start_time DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON public.bookings (lead_email);

-- Ingestion events for observability
CREATE TABLE IF NOT EXISTS public.ingestion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  status TEXT NOT NULL,
  error_message TEXT,
  payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_ingestion_events_source ON public.ingestion_events (source);
CREATE INDEX IF NOT EXISTS idx_ingestion_events_status ON public.ingestion_events (status);

-- Dead-letter queue for failed ingestions
CREATE TABLE IF NOT EXISTS public.ingestion_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_event_id UUID REFERENCES public.ingestion_events (id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin activity logs
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_clerk_id TEXT REFERENCES public.admin_users (clerk_user_id),
  action TEXT NOT NULL,
  details JSONB,
  resource_type TEXT,
  resource_id UUID
);

CREATE INDEX IF NOT EXISTS idx_activity_actor ON public.admin_activity_logs (actor_clerk_id);
CREATE INDEX IF NOT EXISTS idx_activity_resource ON public.admin_activity_logs (resource_type, resource_id);
