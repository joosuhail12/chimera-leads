-- Migration: Add organization_id to core tables for multi-tenancy
-- Description: Adds organization_id field to sales_leads, audience, and related tables
-- Author: Claude
-- Date: 2025-11-29

-- Add organization_id to admin_users table
ALTER TABLE public.admin_users
ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Add organization_id to sales_leads table
ALTER TABLE public.sales_leads
ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Add organization_id to audience table
ALTER TABLE public.audience
ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Add organization_id to startup_applications table
ALTER TABLE public.startup_applications
ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Add organization_id to marketing_lists table
ALTER TABLE public.marketing_lists
ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Add organization_id to crm_activities table (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'crm_activities'
  ) THEN
    ALTER TABLE public.crm_activities
    ADD COLUMN IF NOT EXISTS organization_id TEXT;
  END IF;
END $$;

-- Add organization_id to crm_tasks table (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'crm_tasks'
  ) THEN
    ALTER TABLE public.crm_tasks
    ADD COLUMN IF NOT EXISTS organization_id TEXT;
  END IF;
END $$;

-- Add organization_id to email_templates table (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'email_templates'
  ) THEN
    ALTER TABLE public.email_templates
    ADD COLUMN IF NOT EXISTS organization_id TEXT;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_users_org ON public.admin_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_leads_org ON public.sales_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_audience_org ON public.audience(organization_id);
CREATE INDEX IF NOT EXISTS idx_startup_applications_org ON public.startup_applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_marketing_lists_org ON public.marketing_lists(organization_id);

-- Add index for crm_activities if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'crm_activities'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_crm_activities_org ON public.crm_activities(organization_id);
  END IF;
END $$;

-- Add index for crm_tasks if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'crm_tasks'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_crm_tasks_org ON public.crm_tasks(organization_id);
  END IF;
END $$;

-- Add index for email_templates if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'email_templates'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_email_templates_org ON public.email_templates(organization_id);
  END IF;
END $$;

-- IMPORTANT: After running this migration, you'll need to:
-- 1. Update existing records with the appropriate organization_id
-- 2. Make organization_id NOT NULL after data migration
-- 3. Update all queries to filter by organization_id
-- 4. Consider adding Row Level Security (RLS) policies

COMMENT ON COLUMN public.admin_users.organization_id IS 'Clerk organization ID for multi-tenancy';
COMMENT ON COLUMN public.sales_leads.organization_id IS 'Clerk organization ID for multi-tenancy';
COMMENT ON COLUMN public.audience.organization_id IS 'Clerk organization ID for multi-tenancy';
COMMENT ON COLUMN public.startup_applications.organization_id IS 'Clerk organization ID for multi-tenancy';
COMMENT ON COLUMN public.marketing_lists.organization_id IS 'Clerk organization ID for multi-tenancy';