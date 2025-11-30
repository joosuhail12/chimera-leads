-- Migration: Add template variables and metadata
-- This migration adds personalization support to email templates

-- Add subject line and preheader columns to email_templates
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS subject_line TEXT,
  ADD COLUMN IF NOT EXISTS preheader_text TEXT;

-- Create table to store variables detected/used in each template
CREATE TABLE IF NOT EXISTS public.email_template_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.email_templates (id) ON DELETE CASCADE,
  variable_key TEXT NOT NULL,
  variable_type TEXT NOT NULL, -- 'contact', 'custom', 'campaign', 'system'
  default_value TEXT,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, variable_key)
);

CREATE INDEX IF NOT EXISTS idx_template_variables_template_id
  ON public.email_template_variables (template_id);

-- Create table to store sample data per template (for preview purposes)
CREATE TABLE IF NOT EXISTS public.email_template_sample_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.email_templates (id) ON DELETE CASCADE,
  sample_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id)
);

CREATE INDEX IF NOT EXISTS idx_template_sample_data_template_id
  ON public.email_template_sample_data (template_id);

-- Add updated_at trigger for sample_data table
CREATE OR REPLACE FUNCTION public.update_email_template_sample_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_template_sample_data_updated_at
  BEFORE UPDATE ON public.email_template_sample_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_template_sample_data_updated_at();

-- Add comments for documentation
COMMENT ON COLUMN public.email_templates.subject_line IS 'Email subject line with support for {{variable}} syntax';
COMMENT ON COLUMN public.email_templates.preheader_text IS 'Email preheader/preview text shown in inbox';
COMMENT ON TABLE public.email_template_variables IS 'Tracks variables used in each template for validation and defaults';
COMMENT ON TABLE public.email_template_sample_data IS 'Stores sample data for variable preview in template builder';
