-- CRM Core Tables (Accounts & Contacts)

-- Sales Accounts (Organizations/Companies)
CREATE TABLE IF NOT EXISTS public.sales_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL, -- For multi-tenancy/clerk orgs
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  size TEXT, -- e.g. '1-10', '11-50'
  location TEXT,
  description TEXT,
  linkedin_url TEXT,
  website TEXT,
  annual_revenue TEXT,
  founded_year INTEGER,
  
  -- Metadata
  status TEXT DEFAULT 'active', -- active, churned, etc.
  assigned_to TEXT REFERENCES public.admin_users (clerk_user_id),
  created_by TEXT REFERENCES public.admin_users (clerk_user_id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sales_accounts_org ON public.sales_accounts (organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_accounts_domain ON public.sales_accounts (domain);
CREATE INDEX IF NOT EXISTS idx_sales_accounts_assigned ON public.sales_accounts (assigned_to);

-- Sales Contacts (People)
CREATE TABLE IF NOT EXISTS public.sales_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  account_id UUID REFERENCES public.sales_accounts (id) ON DELETE SET NULL,
  
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  title TEXT,
  
  linkedin_url TEXT,
  location TEXT,
  timezone TEXT,
  
  -- Status & Assignment
  status TEXT DEFAULT 'active', -- active, inactive, bounce, etc.
  lifecycle_stage TEXT DEFAULT 'lead', -- lead, mql, sql, customer, evangelist
  assigned_to TEXT REFERENCES public.admin_users (clerk_user_id),
  created_by TEXT REFERENCES public.admin_users (clerk_user_id),
  
  last_contacted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sales_contacts_org ON public.sales_contacts (organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_contacts_account ON public.sales_contacts (account_id);
CREATE INDEX IF NOT EXISTS idx_sales_contacts_email ON public.sales_contacts (email);
CREATE INDEX IF NOT EXISTS idx_sales_contacts_assigned ON public.sales_contacts (assigned_to);

-- Link Leads to Accounts (Optional conversion path or direct association)
ALTER TABLE public.sales_leads 
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.sales_accounts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_leads_account ON public.sales_leads (account_id);

-- Add triggers for updated_at
CREATE TRIGGER update_sales_accounts_updated_at BEFORE UPDATE ON public.sales_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_contacts_updated_at BEFORE UPDATE ON public.sales_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies (Draft - assuming similar pattern to other tables)
ALTER TABLE public.sales_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's accounts" ON public.sales_accounts
  FOR ALL USING (true); -- Adjust based on actual auth implementation

CREATE POLICY "Users can view their org's contacts" ON public.sales_contacts
  FOR ALL USING (true); -- Adjust based on actual auth implementation
