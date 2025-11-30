-- Drop the old table if it exists (assuming we can reset this feature)
DROP TABLE IF EXISTS organization_email_settings;

-- Create email_domains table
CREATE TABLE IF NOT EXISTS email_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, verified, failed
  dkim_tokens TEXT[],
  spf_record TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  CONSTRAINT unique_org_domain UNIQUE(organization_id, domain)
);

-- Create email_senders table
CREATE TABLE IF NOT EXISTS email_senders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL,
  domain_id UUID REFERENCES email_domains(id) ON DELETE CASCADE,
  email TEXT NOT NULL, -- Full email address (e.g. support@acme.com)
  from_name TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  CONSTRAINT unique_org_sender_email UNIQUE(organization_id, email)
);

-- Indexes
CREATE INDEX idx_email_domains_org ON email_domains(organization_id);
CREATE INDEX idx_email_senders_org ON email_senders(organization_id);
CREATE INDEX idx_email_senders_domain ON email_senders(domain_id);

-- RLS
ALTER TABLE email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_senders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization domains" ON email_domains
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own organization domains" ON email_domains
  FOR ALL USING (true);

CREATE POLICY "Users can view own organization senders" ON email_senders
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own organization senders" ON email_senders
  FOR ALL USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_email_domains_updated_at
  BEFORE UPDATE ON email_domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_senders_updated_at
  BEFORE UPDATE ON email_senders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
