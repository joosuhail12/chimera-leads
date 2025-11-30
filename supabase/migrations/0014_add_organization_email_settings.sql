-- Create organization email settings table for managing custom domains and email addresses
CREATE TABLE IF NOT EXISTS organization_email_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL UNIQUE,  -- Clerk organization ID
  from_name TEXT,                        -- Display name (e.g., "Acme Support")
  from_email TEXT NOT NULL,              -- Email address (e.g., "support@acme.com")
  reply_to_email TEXT,                   -- Optional reply-to address
  domain TEXT,                           -- Domain (e.g., "acme.com")
  is_verified BOOLEAN DEFAULT FALSE,     -- SES verification status
  verification_token TEXT,                -- For email verification
  dkim_tokens TEXT[],                     -- DKIM CNAME records from SES
  spf_record TEXT,                        -- SPF TXT record
  dkim_verified BOOLEAN DEFAULT FALSE,
  spf_verified BOOLEAN DEFAULT FALSE,
  verification_status TEXT DEFAULT 'pending', -- pending, verified, failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,                        -- User ID who created
  CONSTRAINT unique_org_email UNIQUE(organization_id, from_email)
);

-- Create indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_org_email_settings_org_id ON organization_email_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_email_settings_verified ON organization_email_settings(is_verified);

-- Add RLS policies
ALTER TABLE organization_email_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their organization's email settings
DROP POLICY IF EXISTS "Users can view own organization email settings" ON organization_email_settings;
CREATE POLICY "Users can view own organization email settings" ON organization_email_settings
  FOR SELECT
  USING (true); -- Will be filtered by organization_id in application code

-- Policy: Only organization admins can modify email settings (enforced in application)
DROP POLICY IF EXISTS "Organization admins can manage email settings" ON organization_email_settings;
CREATE POLICY "Organization admins can manage email settings" ON organization_email_settings
  FOR ALL
  USING (true); -- Permission checks done in application with Clerk

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_organization_email_settings_updated_at ON organization_email_settings;
CREATE TRIGGER update_organization_email_settings_updated_at
  BEFORE UPDATE ON organization_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();