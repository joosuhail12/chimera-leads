-- CRM Activities
CREATE TYPE activity_type AS ENUM ('note', 'call', 'meeting', 'email', 'status_change');

CREATE TABLE IF NOT EXISTS public.crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lead_id UUID NOT NULL REFERENCES public.sales_leads (id) ON DELETE CASCADE,
  type activity_type NOT NULL,
  content TEXT,
  outcome TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT REFERENCES public.admin_users (clerk_user_id),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON public.crm_activities (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_occurred ON public.crm_activities (occurred_at DESC);

-- CRM Tasks
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');

CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lead_id UUID REFERENCES public.sales_leads (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  status task_status NOT NULL DEFAULT 'pending',
  priority task_priority NOT NULL DEFAULT 'medium',
  assigned_to TEXT REFERENCES public.admin_users (clerk_user_id),
  created_by TEXT REFERENCES public.admin_users (clerk_user_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_lead ON public.crm_tasks (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned ON public.crm_tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON public.crm_tasks (status);
