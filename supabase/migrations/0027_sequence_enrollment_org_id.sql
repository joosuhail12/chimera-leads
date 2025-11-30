-- Ensure sequence enrollments carry organization context
ALTER TABLE public.sequence_enrollments
ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Backfill organization_id from the related lead records
UPDATE public.sequence_enrollments se
SET organization_id = sl.organization_id
FROM public.sales_leads sl
WHERE se.lead_id = sl.id
  AND (se.organization_id IS NULL OR se.organization_id = '');

-- Enforce NOT NULL once backfilled
ALTER TABLE public.sequence_enrollments
ALTER COLUMN organization_id SET NOT NULL;

-- Index for quicker org scoped lookups
CREATE INDEX IF NOT EXISTS idx_enrollments_org
  ON public.sequence_enrollments(organization_id, status);
