-- Outbound emails logged before/after hitting SES
CREATE TABLE IF NOT EXISTS public.outbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_id TEXT UNIQUE,
  provider TEXT NOT NULL DEFAULT 'ses',
  status TEXT NOT NULL DEFAULT 'queued',
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  configuration_set TEXT,
  last_event_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_outbound_emails_message_id
  ON public.outbound_emails (message_id);

CREATE INDEX IF NOT EXISTS idx_outbound_emails_status
  ON public.outbound_emails (status);

-- Email tracking events captured from SNS
CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_id TEXT,
  event_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'ses',
  recipient TEXT,
  occurred_at TIMESTAMPTZ,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_events_message_id
  ON public.email_events (message_id);

CREATE INDEX IF NOT EXISTS idx_email_events_event_type
  ON public.email_events (event_type);
