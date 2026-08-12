-- Narrow the operational visibility ceiling from tomorrow to today in
-- Europe/Rome. Historical and overdue orders remain visible because this is
-- an upper bound only.
--
-- Authorization metadata only: no application rows are inserted, updated or
-- deleted by this migration.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
DECLARE
  helper_definition text;
  update_check_expression text;
BEGIN
  IF pg_catalog.to_regprocedure('private.operational_staff_service_order_ids()') IS NULL THEN
    RAISE EXCEPTION 'Authorization schema drift: operational visibility helper is missing';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(procedure.oid)
  INTO helper_definition
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'private'
    AND procedure.proname = 'operational_staff_service_order_ids'
    AND pg_catalog.pg_get_function_identity_arguments(procedure.oid) = ''
    AND procedure.prosecdef
    AND procedure.provolatile = 's';

  IF helper_definition IS NULL
     OR helper_definition NOT LIKE '%SET search_path TO ''''%'
     OR helper_definition NOT LIKE '%Europe/Rome%'
     OR helper_definition NOT LIKE '%+ 1 AS max_cleaning_date%'
     OR helper_definition NOT LIKE '%service_order_cleaning_staff%'
     OR helper_definition NOT LIKE '%consegna_staff_id%' THEN
    RAISE EXCEPTION 'Authorization schema drift: unexpected operational visibility helper contract';
  END IF;

  SELECT pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
  INTO update_check_expression
  FROM pg_catalog.pg_policy AS policy
  WHERE policy.polname = 'service_orders_limpeza_update'
    AND policy.polrelid = 'public.service_orders'::regclass
    AND policy.polroles = ARRAY[
      (SELECT role.oid FROM pg_catalog.pg_roles AS role WHERE role.rolname = 'authenticated')
    ];

  IF update_check_expression IS NULL
     OR update_check_expression NOT LIKE '%Europe/Rome%'
     OR update_check_expression NOT LIKE '%+ 1%'
     OR update_check_expression NOT LIKE '%service_order_cleaning_staff%' THEN
    RAISE EXCEPTION 'Authorization schema drift: unexpected Pulizia update policy contract';
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

CREATE OR REPLACE FUNCTION private.operational_staff_service_order_ids()
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
      (pg_catalog.timezone('Europe/Rome', pg_catalog.now()))::date AS max_cleaning_date
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
  'Canonical RLS scope for Pulizia and Consegna: assigned service orders through today in Europe/Rome.';

REVOKE EXECUTE ON FUNCTION private.operational_staff_service_order_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.operational_staff_service_order_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION private.operational_staff_service_order_ids() FROM authenticated;
GRANT EXECUTE ON FUNCTION private.operational_staff_service_order_ids() TO authenticated;

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
    AND cleaning_date <= (pg_catalog.timezone('Europe/Rome', pg_catalog.now()))::date
    AND EXISTS (
      SELECT 1
      FROM public.service_order_cleaning_staff AS assignment
      WHERE assignment.service_order_id = id
        AND assignment.profile_id = (SELECT auth.uid())
    )
  );

COMMIT;
