-- Read-only assertions to run after the cleaning-photo format migration in a
-- disposable database or isolated production-like copy.

DO $$
DECLARE
  column_default TEXT;
  column_nullable TEXT;
  invalid_rows BIGINT;
BEGIN
  SELECT c.column_default, c.is_nullable
  INTO column_default, column_nullable
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'service_order_photos'
    AND c.column_name = 'content_type';

  IF column_default IS DISTINCT FROM '''image/webp''::text'
    OR column_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'Unexpected service_order_photos.content_type contract';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.service_order_photos'::regclass
      AND conname = 'service_order_photos_content_type_supported'
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION 'Missing cleaning-photo content type constraint';
  END IF;

  EXECUTE 'SELECT count(*) FROM public.service_order_photos
           WHERE content_type NOT IN (''image/webp'', ''image/jpeg'')'
  INTO invalid_rows;
  IF invalid_rows <> 0 THEN
    RAISE EXCEPTION 'Found % cleaning-photo rows with an invalid content type', invalid_rows;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'service-order-photos'
      AND name = 'service-order-photos'
      AND public = FALSE
      AND file_size_limit = 2097152
      AND allowed_mime_types IS NOT DISTINCT FROM ARRAY['image/webp', 'image/jpeg']::TEXT[]
  ) THEN
    RAISE EXCEPTION 'Unexpected service-order-photos bucket contract';
  END IF;
END
$$;
