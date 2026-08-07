-- Restrict operational staff (Pulizia and Consegna) to assigned service orders
-- whose cleaning_date is no later than tomorrow in Europe/Rome.
--
-- This migration changes authorization metadata only. It does not update or
-- delete application data and remains compatible with the previous app version.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
DECLARE
  missing_policies text[];
BEGIN
  SELECT array_agg(expected.policy_name ORDER BY expected.policy_name)
  INTO missing_policies
  FROM (
    VALUES
      ('public', 'service_orders', 'service_orders_limpeza_select'),
      ('public', 'service_orders', 'service_orders_limpeza_update'),
      ('public', 'service_orders', 'service_orders_consegna_select'),
      ('public', 'service_order_cleaning_staff', 'service_order_cleaning_staff_select'),
      ('public', 'profiles', 'profiles_staff_peer_select'),
      ('public', 'properties', 'properties_limpeza_consegna_select')
  ) AS expected(schema_name, table_name, policy_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies existing
    WHERE existing.schemaname = expected.schema_name
      AND existing.tablename = expected.table_name
      AND existing.policyname = expected.policy_name
  );

  IF missing_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Authorization schema drift: missing policies %', missing_policies;
  END IF;

  IF pg_catalog.to_regclass('public.service_orders') IS NULL
     OR pg_catalog.to_regclass('public.service_order_cleaning_staff') IS NULL
     OR pg_catalog.to_regclass('public.profiles') IS NULL
     OR pg_catalog.to_regclass('public.properties') IS NULL THEN
    RAISE EXCEPTION 'Authorization schema drift: required tables are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_orders'
      AND column_name = 'cleaning_date'
      AND data_type = 'date'
  ) THEN
    RAISE EXCEPTION 'Authorization schema drift: service_orders.cleaning_date must be DATE';
  END IF;

  IF pg_catalog.to_regprocedure('private.staff_property_ids(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Authorization schema drift: private.staff_property_ids(uuid) is missing';
  END IF;

  IF pg_catalog.to_regprocedure('private.operational_staff_service_order_ids()') IS NOT NULL THEN
    RAISE EXCEPTION 'Authorization schema drift: operational visibility helper already exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_orders'
      AND policyname = 'service_orders_consegna_update'
  ) THEN
    RAISE EXCEPTION 'Authorization schema drift: Consegna must remain read-only';
  END IF;
END
$preconditions$;

CREATE FUNCTION private.operational_staff_service_order_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH viewer AS (
    SELECT
      (SELECT auth.uid()) AS user_id,
      (SELECT public.get_my_role()) AS app_role,
      (pg_catalog.timezone('Europe/Rome', pg_catalog.now()))::date + 1 AS max_cleaning_date
  )
  SELECT so.id
  FROM public.service_orders AS so
  CROSS JOIN viewer
  WHERE so.cleaning_date IS NOT NULL
    AND so.cleaning_date <= viewer.max_cleaning_date
    AND (
      (
        viewer.app_role = '"limpeza"'
        AND EXISTS (
          SELECT 1
          FROM public.service_order_cleaning_staff AS assignment
          WHERE assignment.service_order_id = so.id
            AND assignment.profile_id = viewer.user_id
        )
      )
      OR (
        viewer.app_role = '"consegna"'
        AND so.consegna_staff_id = viewer.user_id
      )
    );
$function$;

COMMENT ON FUNCTION private.operational_staff_service_order_ids() IS
  'Canonical RLS scope for Pulizia and Consegna: assigned service orders through tomorrow in Europe/Rome.';

GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE EXECUTE ON FUNCTION private.operational_staff_service_order_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.operational_staff_service_order_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION private.operational_staff_service_order_ids() FROM authenticated;
GRANT EXECUTE ON FUNCTION private.operational_staff_service_order_ids() TO authenticated;

-- Keep property metadata aligned with the same role, assignment and date scope.
-- The uid equality prevents callers from using this SECURITY DEFINER helper to
-- inspect another employee's property assignments.
CREATE OR REPLACE FUNCTION private.staff_property_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT DISTINCT so.property_id
  FROM public.service_orders AS so
  WHERE uid = (SELECT auth.uid())
    AND so.id IN (
      SELECT private.operational_staff_service_order_ids()
    );
$function$;

COMMENT ON FUNCTION private.staff_property_ids(uuid) IS
  'Property scope for the current Pulizia or Consegna user, derived from operationally visible service orders.';

REVOKE EXECUTE ON FUNCTION private.staff_property_ids(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.staff_property_ids(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION private.staff_property_ids(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION private.staff_property_ids(uuid) TO authenticated;

ALTER POLICY "service_orders_limpeza_select"
  ON public.service_orders
  TO authenticated
  USING (
    (SELECT public.get_my_role()) = '"limpeza"'
    AND id IN (
      SELECT private.operational_staff_service_order_ids()
    )
  );

ALTER POLICY "service_orders_consegna_select"
  ON public.service_orders
  TO authenticated
  USING (
    (SELECT public.get_my_role()) = '"consegna"'
    AND id IN (
      SELECT private.operational_staff_service_order_ids()
    )
  );

ALTER POLICY "service_orders_limpeza_update"
  ON public.service_orders
  TO authenticated
  USING (
    (SELECT public.get_my_role()) = '"limpeza"'
    AND id IN (
      SELECT private.operational_staff_service_order_ids()
    )
  )
  WITH CHECK (
    (SELECT public.get_my_role()) = '"limpeza"'
    AND cleaning_date IS NOT NULL
    AND cleaning_date <= (pg_catalog.timezone('Europe/Rome', pg_catalog.now()))::date + 1
    AND EXISTS (
      SELECT 1
      FROM public.service_order_cleaning_staff AS assignment
      WHERE assignment.service_order_id = id
        AND assignment.profile_id = (SELECT auth.uid())
    )
  );

-- Administrators and office staff retain their existing permissive ALL policy.
-- Operational users can inspect assignment rows only for orders they can see.
ALTER POLICY "service_order_cleaning_staff_select"
  ON public.service_order_cleaning_staff
  TO authenticated
  USING (
    (SELECT public.get_my_role()) IN ('"limpeza"', '"consegna"')
    AND service_order_id IN (
      SELECT private.operational_staff_service_order_ids()
    )
  );

-- Restrict peer names to employees attached to orders in the same visible scope.
ALTER POLICY "profiles_staff_peer_select"
  ON public.profiles
  TO authenticated
  USING (
    (SELECT public.get_my_role()) IN ('"limpeza"', '"consegna"')
    AND id IN (
      SELECT so.consegna_staff_id
      FROM public.service_orders AS so
      WHERE so.id IN (
        SELECT private.operational_staff_service_order_ids()
      )
        AND so.consegna_staff_id IS NOT NULL

      UNION

      SELECT assignment.profile_id
      FROM public.service_order_cleaning_staff AS assignment
      WHERE assignment.service_order_id IN (
        SELECT private.operational_staff_service_order_ids()
      )
    )
  );

COMMIT;
