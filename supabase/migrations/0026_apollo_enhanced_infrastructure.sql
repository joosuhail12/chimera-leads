-- Apollo Enhanced Infrastructure Migration
-- Adds tables for Apollo sync state, webhooks, lists, lead scores, playbooks, and enrichment queue

-- Apollo sync state table (track API sync status)
CREATE TABLE IF NOT EXISTS apollo_sync_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id TEXT NOT NULL,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('lists', 'people', 'companies', 'sequences')),
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sync_status TEXT CHECK (sync_status IN ('idle', 'syncing', 'failed', 'completed')),
  sync_metadata JSONB DEFAULT '{}',
  error_message TEXT,
  records_synced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apollo webhooks table (store webhook events)
CREATE TABLE IF NOT EXISTS apollo_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id TEXT NOT NULL,
  webhook_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apollo lists table (synced Apollo lists)
CREATE TABLE IF NOT EXISTS apollo_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id TEXT NOT NULL,
  apollo_list_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  list_type TEXT CHECK (list_type IN ('static', 'dynamic', 'saved_search')),
  filters JSONB DEFAULT '{}',
  member_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  sync_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead scores table (AI-powered scoring)
CREATE TABLE IF NOT EXISTS lead_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id TEXT NOT NULL,
  lead_id UUID NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  scoring_model_version TEXT DEFAULT 'v1',
  factors JSONB NOT NULL DEFAULT '{}',
  ai_insights TEXT,
  recommendations JSONB DEFAULT '[]',
  score_breakdown JSONB DEFAULT '{}',
  previous_score INTEGER,
  score_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, lead_id)
);

-- Prospecting playbooks table (workflow templates)
CREATE TABLE IF NOT EXISTS prospecting_playbooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  playbook_type TEXT CHECK (playbook_type IN ('system', 'custom')),
  status TEXT CHECK (status IN ('draft', 'active', 'paused', 'archived')) DEFAULT 'draft',
  trigger_type TEXT CHECK (trigger_type IN ('manual', 'scheduled', 'webhook', 'event')),
  trigger_config JSONB DEFAULT '{}',
  steps JSONB NOT NULL DEFAULT '[]',
  visual_config JSONB DEFAULT '{}', -- Store React Flow diagram configuration
  created_by TEXT,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playbook executions table (track playbook runs)
CREATE TABLE IF NOT EXISTS playbook_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id TEXT NOT NULL,
  playbook_id UUID NOT NULL REFERENCES prospecting_playbooks(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('running', 'completed', 'failed', 'cancelled')) DEFAULT 'running',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  execution_context JSONB DEFAULT '{}',
  execution_log JSONB DEFAULT '[]',
  leads_processed INTEGER DEFAULT 0,
  leads_qualified INTEGER DEFAULT 0,
  leads_enrolled INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead enrichment queue table (async enrichment)
CREATE TABLE IF NOT EXISTS lead_enrichment_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id TEXT NOT NULL,
  lead_id UUID REFERENCES sales_leads(id) ON DELETE CASCADE,
  enrichment_type TEXT CHECK (enrichment_type IN ('person', 'company', 'both')) DEFAULT 'person',
  identifier TEXT NOT NULL, -- email or domain
  priority TEXT CHECK (priority IN ('high', 'normal', 'low')) DEFAULT 'normal',
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  playbook_id UUID REFERENCES prospecting_playbooks(id) ON DELETE SET NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  result JSONB,
  error_message TEXT,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apollo API usage tracking table
CREATE TABLE IF NOT EXISTS apollo_api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  credits_used INTEGER DEFAULT 1,
  response_time_ms INTEGER,
  cached BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_apollo_sync_state_org_type ON apollo_sync_state(organization_id, sync_type);
CREATE INDEX idx_apollo_sync_state_next_sync ON apollo_sync_state(next_sync_at) WHERE sync_status = 'idle';

CREATE INDEX idx_apollo_webhooks_org_processed ON apollo_webhooks(organization_id, processed);
CREATE INDEX idx_apollo_webhooks_created ON apollo_webhooks(created_at DESC);

CREATE INDEX idx_apollo_lists_org ON apollo_lists(organization_id);
CREATE INDEX idx_apollo_lists_apollo_id ON apollo_lists(apollo_list_id);

CREATE INDEX idx_lead_scores_org_lead ON lead_scores(organization_id, lead_id);
CREATE INDEX idx_lead_scores_score ON lead_scores(score DESC);
CREATE INDEX idx_lead_scores_updated ON lead_scores(updated_at DESC);

CREATE INDEX idx_playbooks_org_status ON prospecting_playbooks(organization_id, status);
CREATE INDEX idx_playbooks_next_run ON prospecting_playbooks(next_run_at) WHERE status = 'active';

CREATE INDEX idx_playbook_executions_playbook ON playbook_executions(playbook_id);
CREATE INDEX idx_playbook_executions_status ON playbook_executions(status);

CREATE INDEX idx_enrichment_queue_status ON lead_enrichment_queue(status, priority);
CREATE INDEX idx_enrichment_queue_org ON lead_enrichment_queue(organization_id);
CREATE INDEX idx_enrichment_queue_lead ON lead_enrichment_queue(lead_id);

CREATE INDEX idx_apollo_usage_org_date ON apollo_api_usage(organization_id, created_at DESC);
CREATE INDEX idx_apollo_usage_endpoint ON apollo_api_usage(endpoint, method);

-- Add company enrichment columns to sales_leads if not exists
ALTER TABLE sales_leads
ADD COLUMN IF NOT EXISTS apollo_company_id TEXT,
ADD COLUMN IF NOT EXISTS company_apollo_data JSONB,
ADD COLUMN IF NOT EXISTS company_enriched_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS technographics JSONB,
ADD COLUMN IF NOT EXISTS intent_signals JSONB;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_apollo_sync_state_updated_at BEFORE UPDATE ON apollo_sync_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_apollo_lists_updated_at BEFORE UPDATE ON apollo_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_scores_updated_at BEFORE UPDATE ON lead_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playbooks_updated_at BEFORE UPDATE ON prospecting_playbooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate lead score decay over time
CREATE OR REPLACE FUNCTION calculate_score_decay(
  original_score INTEGER,
  days_since_scoring INTEGER
) RETURNS INTEGER AS $$
BEGIN
  -- Decay 5% per week after 30 days
  IF days_since_scoring <= 30 THEN
    RETURN original_score;
  ELSE
    RETURN GREATEST(
      ROUND(original_score * POWER(0.95, (days_since_scoring - 30) / 7.0)),
      0
    )::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE apollo_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE apollo_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE apollo_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospecting_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_enrichment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE apollo_api_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (simplified - adjust based on your auth strategy)
CREATE POLICY "Users can view their org's Apollo data" ON apollo_sync_state
  FOR ALL USING (true); -- Adjust based on your auth

CREATE POLICY "Users can view their org's webhooks" ON apollo_webhooks
  FOR ALL USING (true);

CREATE POLICY "Users can manage their org's Apollo lists" ON apollo_lists
  FOR ALL USING (true);

CREATE POLICY "Users can manage their org's lead scores" ON lead_scores
  FOR ALL USING (true);

CREATE POLICY "Users can manage their org's playbooks" ON prospecting_playbooks
  FOR ALL USING (true);

CREATE POLICY "Users can view their org's executions" ON playbook_executions
  FOR ALL USING (true);

CREATE POLICY "Users can manage their org's enrichment queue" ON lead_enrichment_queue
  FOR ALL USING (true);

CREATE POLICY "Users can view their org's API usage" ON apollo_api_usage
  FOR ALL USING (true);