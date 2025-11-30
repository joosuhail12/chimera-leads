ALTER TABLE public.email_templates
ADD COLUMN IF NOT EXISTS amp_html TEXT;
