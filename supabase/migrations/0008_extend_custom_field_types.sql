instimprovDO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'custom_field_type'::regtype
      AND enumlabel = 'long_text'
  ) THEN
    ALTER TYPE custom_field_type ADD VALUE 'long_text';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'custom_field_type'::regtype
      AND enumlabel = 'url'
  ) THEN
    ALTER TYPE custom_field_type ADD VALUE 'url';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'custom_field_type'::regtype
      AND enumlabel = 'email'
  ) THEN
    ALTER TYPE custom_field_type ADD VALUE 'email';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'custom_field_type'::regtype
      AND enumlabel = 'phone'
  ) THEN
    ALTER TYPE custom_field_type ADD VALUE 'phone';
  END IF;
END
$$;
