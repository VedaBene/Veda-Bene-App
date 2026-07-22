-- Additive foundation for private before/after cleaning photos.
-- The previously deployed application remains compatible with this expanded schema.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.service_orders
  ADD COLUMN cleaning_cycle INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.service_orders
  ADD CONSTRAINT service_orders_cleaning_cycle_positive
  CHECK (cleaning_cycle > 0);

CREATE TABLE public.service_order_photos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id      UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  cycle_no              INTEGER NOT NULL,
  phase                 TEXT NOT NULL CHECK (phase IN ('before', 'after')),
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
  display_path          TEXT NOT NULL UNIQUE,
  thumbnail_path        TEXT NOT NULL UNIQUE,
  uploaded_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sort_order            SMALLINT NOT NULL CHECK (sort_order BETWEEN 0 AND 7),
  width                 INTEGER,
  height                INTEGER,
  display_size_bytes    INTEGER,
  thumbnail_size_bytes  INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at              TIMESTAMPTZ,
  CONSTRAINT service_order_photos_cycle_positive CHECK (cycle_no > 0),
  CONSTRAINT service_order_photos_dimensions_positive CHECK (
    (width IS NULL AND height IS NULL)
    OR (width > 0 AND height > 0)
  ),
  CONSTRAINT service_order_photos_sizes_positive CHECK (
    (display_size_bytes IS NULL OR display_size_bytes > 0)
    AND (thumbnail_size_bytes IS NULL OR thumbnail_size_bytes > 0)
  ),
  CONSTRAINT service_order_photos_distinct_paths CHECK (display_path <> thumbnail_path),
  CONSTRAINT service_order_photos_ready_metadata CHECK (
    status = 'pending'
    OR (
      ready_at IS NOT NULL
      AND width IS NOT NULL
      AND height IS NOT NULL
      AND display_size_bytes IS NOT NULL
      AND thumbnail_size_bytes IS NOT NULL
    )
  ),
  CONSTRAINT service_order_photos_slot_unique
    UNIQUE (service_order_id, cycle_no, phase, sort_order)
);

COMMENT ON TABLE public.service_order_photos IS
  'Metadata for private, optimized before/after cleaning photos grouped by service-order cycle.';
COMMENT ON COLUMN public.service_order_photos.status IS
  'pending rows are invisible to authenticated users until both Storage variants are verified.';

CREATE INDEX service_order_photos_order_cycle_phase_idx
  ON public.service_order_photos (service_order_id, cycle_no DESC, phase, sort_order);

CREATE INDEX service_order_photos_uploaded_by_idx
  ON public.service_order_photos (uploaded_by, created_at DESC)
  WHERE uploaded_by IS NOT NULL;

CREATE INDEX service_order_photos_pending_created_at_idx
  ON public.service_order_photos (created_at)
  WHERE status = 'pending';

ALTER TABLE public.service_order_photos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.service_order_photos FROM anon, authenticated;
GRANT SELECT ON TABLE public.service_order_photos TO authenticated;

CREATE POLICY "service_order_photos_authorized_select"
  ON public.service_order_photos
  FOR SELECT
  TO authenticated
  USING (
    status = 'ready'
    AND EXISTS (
      -- service_orders RLS performs the assignment/ownership scoping. Clients
      -- receive photos only after the service order has been completed.
      SELECT 1
      FROM public.service_orders so
      WHERE so.id = service_order_photos.service_order_id
        AND (
          (SELECT public.get_my_role()) IN ('"admin"', '"secretaria"', '"limpeza"', '"consegna"')
          OR (
            (SELECT public.get_my_role()) = '"cliente"'
            AND so.status = 'done'
          )
        )
    )
  );

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'service-order-photos',
  'service-order-photos',
  FALSE,
  2097152,
  ARRAY['image/webp']::TEXT[]
)
ON CONFLICT (id) DO NOTHING;

-- Never overwrite an unexpected pre-existing bucket. Abort the whole migration
-- atomically so the drift can be investigated without changing production.
DO $$
BEGIN
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

-- Deliberately do not create storage.objects policies. Upload/download access
-- is granted only through short-lived signed URLs created on the server.

COMMIT;
