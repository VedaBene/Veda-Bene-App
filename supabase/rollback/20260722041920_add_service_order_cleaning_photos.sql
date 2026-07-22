-- Non-destructive emergency containment for migration 20260722041920 only.
-- Normal rollback: set CLEANING_PHOTOS_ENABLED=false and deploy the previous
-- compatible application. This script preserves all schema, metadata and files.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Use only if photo visibility must be contained immediately. Re-enable access
-- through a new reviewed forward migration after the incident is resolved.
REVOKE SELECT ON TABLE public.service_order_photos FROM authenticated;

COMMIT;
