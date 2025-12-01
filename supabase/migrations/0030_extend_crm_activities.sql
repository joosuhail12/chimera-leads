-- Extend CRM Activities to support Contacts and Accounts

ALTER TABLE public.crm_activities
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.sales_contacts (id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.sales_accounts (id) ON DELETE CASCADE;

-- Make lead_id nullable
ALTER TABLE public.crm_activities
ALTER COLUMN lead_id DROP NOT NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON public.crm_activities (contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_account ON public.crm_activities (account_id);

-- Add constraint to ensure at least one target is set (optional, but good for data integrity)
-- ALTER TABLE public.crm_activities
-- ADD CONSTRAINT crm_activities_target_check 
-- CHECK (
--   (lead_id IS NOT NULL) OR 
--   (contact_id IS NOT NULL) OR 
--   (account_id IS NOT NULL)
-- );
