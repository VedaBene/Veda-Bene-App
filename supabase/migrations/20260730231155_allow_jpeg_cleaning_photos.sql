-- Additive production compatibility expansion for cleaning-photo encodings.
--
-- Impact: preserves every existing row and object, records legacy rows as
-- image/webp, and allows new JPEG variants in the existing private bucket.
-- Compatibility: the previous application continues writing WebP and ignores
-- the new column. The new application requires this migration before rollout.
-- Expected lock: a brief ACCESS EXCLUSIVE lock on service_order_photos while
-- adding a constant-default column and constraint; bucket update is one row.
-- Rollback: disable CLEANING_PHOTOS_ENABLED and redeploy the previous compatible
-- application. Do not remove the column, constraint, MIME allowance, or objects.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Abort atomically if production differs from the exact state established by
-- 20260722041920_add_service_order_cleaning_photos.sql.
DO $$
BEGIN
  IF to_regclass('public.service_order_photos') IS NULL THEN
    RAISE EXCEPTION 'Missing required table public.service_order_photos';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_order_photos'
      AND column_name = 'content_type'
  ) THEN
    RAISE EXCEPTION 'Unexpected pre-existing column service_order_photos.content_type';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'service-order-photos'
      AND name = 'service-order-photos'
      AND public = FALSE
      AND file_size_limit = 2097152
      AND allowed_mime_types IS NOT DISTINCT FROM ARRAY['image/webp']::TEXT[]
  ) THEN
    RAISE EXCEPTION 'Unexpected configuration for storage bucket service-order-photos';
  END IF;
END
$$;

ALTER TABLE public.service_order_photos
  ADD COLUMN content_type TEXT NOT NULL DEFAULT 'image/webp';

ALTER TABLE public.service_order_photos
  ADD CONSTRAINT service_order_photos_content_type_supported
  CHECK (content_type IN ('image/webp', 'image/jpeg'));

COMMENT ON COLUMN public.service_order_photos.content_type IS
  'Verified MIME shared by the immutable display and thumbnail objects.';

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/webp', 'image/jpeg']::TEXT[]
WHERE id = 'service-order-photos';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'service-order-photos'
      AND name = 'service-order-photos'
      AND public = FALSE
      AND file_size_limit = 2097152
      AND allowed_mime_types IS NOT DISTINCT FROM ARRAY['image/webp', 'image/jpeg']::TEXT[]
  ) THEN
    RAISE EXCEPTION 'Failed to establish the cleaning-photo MIME contract';
  END IF;
END
$$;

COMMIT;
