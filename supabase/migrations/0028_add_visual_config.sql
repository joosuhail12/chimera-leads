-- Add visual_config to sequence_templates to store React Flow graph
ALTER TABLE sequence_templates
ADD COLUMN IF NOT EXISTS visual_config JSONB DEFAULT '{}';

-- Add next_step_id to sequence_steps to support direct linking (optional, but good for hybrid)
ALTER TABLE sequence_steps
ADD COLUMN IF NOT EXISTS next_step_id UUID REFERENCES sequence_steps(id);
