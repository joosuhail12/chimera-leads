ALTER TABLE public.outbound_emails
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'transactional';

CREATE INDEX IF NOT EXISTS idx_outbound_emails_category
  ON public.outbound_emails (category);
