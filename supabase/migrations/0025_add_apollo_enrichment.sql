-- Add Apollo enrichment fields to sales_leads
ALTER TABLE public.sales_leads
ADD COLUMN IF NOT EXISTS apollo_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS apollo_data JSONB,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS twitter_url TEXT,
ADD COLUMN IF NOT EXISTS facebook_url TEXT,
ADD COLUMN IF NOT EXISTS github_url TEXT,
ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- Add index for Apollo ID lookup
CREATE INDEX IF NOT EXISTS idx_sales_leads_apollo_id ON public.sales_leads(apollo_id);
