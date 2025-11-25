DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'custom_entity_type'
  ) THEN
    CREATE TYPE custom_entity_type AS ENUM (
      'sales_leads',
      'audience',
      'startup_applications'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'custom_field_type'
  ) THEN
    CREATE TYPE custom_field_type AS ENUM (
      'text',
      'number',
      'boolean',
      'date',
      'select',
      'multiselect'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type custom_entity_type NOT NULL,
  name TEXT NOT NULL,
  field_key TEXT NOT NULL,
  description TEXT,
  field_type custom_field_type NOT NULL DEFAULT 'text',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, field_key)
);

CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES public.custom_field_definitions (id) ON DELETE CASCADE,
  entity_type custom_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  value_text TEXT,
  value_number NUMERIC,
  value_boolean BOOLEAN,
  value_date DATE,
  value_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (definition_id, entity_id)
);

CREATE OR REPLACE FUNCTION public.custom_field_definitions_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.custom_field_values_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.ensure_custom_field_entity_match()
RETURNS TRIGGER AS $$
DECLARE
  target_entity custom_entity_type;
BEGIN
  SELECT entity_type INTO target_entity
  FROM public.custom_field_definitions
  WHERE id = NEW.definition_id;

  IF target_entity IS NULL THEN
    RAISE EXCEPTION 'Custom field definition not found for %', NEW.definition_id;
  END IF;

  IF target_entity <> NEW.entity_type THEN
    RAISE EXCEPTION 'Definition % applies to %, but value was provided for %', NEW.definition_id, target_entity, NEW.entity_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_custom_field_definitions_updated_at ON public.custom_field_definitions;
CREATE TRIGGER trg_custom_field_definitions_updated_at
BEFORE UPDATE ON public.custom_field_definitions
FOR EACH ROW
EXECUTE FUNCTION public.custom_field_definitions_set_updated_at();

DROP TRIGGER IF EXISTS trg_custom_field_values_updated_at ON public.custom_field_values;
CREATE TRIGGER trg_custom_field_values_updated_at
BEFORE UPDATE ON public.custom_field_values
FOR EACH ROW
EXECUTE FUNCTION public.custom_field_values_set_updated_at();

DROP TRIGGER IF EXISTS trg_custom_field_entity_match ON public.custom_field_values;
CREATE TRIGGER trg_custom_field_entity_match
BEFORE INSERT OR UPDATE ON public.custom_field_values
FOR EACH ROW
EXECUTE FUNCTION public.ensure_custom_field_entity_match();
