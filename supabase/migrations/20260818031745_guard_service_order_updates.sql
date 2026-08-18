-- Add a database-level column mutation guard for service orders.
--
-- The existing RLS policies remain the source of truth for row scope. This
-- trigger only constrains which columns an operational role may change after a
-- row has passed RLS. It does not query application tables or modify data.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
DECLARE
  actual_columns text[];
  actual_update_policies text[];
BEGIN
  IF pg_catalog.to_regclass('public.service_orders') IS NULL THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;

  IF pg_catalog.to_regnamespace('private') IS NULL THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;

  SELECT pg_catalog.array_agg(columns.column_name::text ORDER BY columns.ordinal_position)
  INTO actual_columns
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public'
    AND columns.table_name = 'service_orders';

  IF actual_columns IS DISTINCT FROM ARRAY[
    'id', 'property_id', 'cleaning_staff_id', 'consegna_staff_id',
    'cleaning_date', 'checkout_at', 'checkin_at', 'status', 'real_guests',
    'double_beds', 'single_beds', 'sofa_beds', 'bathrooms', 'bidets',
    'cribs', 'total_price', 'completed_at', 'created_at', 'started_at',
    'completion_notes', 'worked_minutes', 'bedrooms', 'armchair_beds',
    'order_number', 'is_urgent', 'cleaning_notes',
    'extra_services_description', 'extra_services_price', 'pricing_mode',
    'consegna_fee', 'cleaning_cycle'
  ]::text[] THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'service_orders'
      AND relation.relkind = 'r'
      AND relation.relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'get_my_role'
      AND pg_catalog.pg_get_function_identity_arguments(procedure.oid) = ''
      AND NOT procedure.prosecdef
      AND procedure.provolatile = 's'
      AND pg_catalog.pg_get_functiondef(procedure.oid) LIKE '%request.jwt.claims%'
      AND pg_catalog.pg_get_functiondef(procedure.oid) LIKE '%app_role%'
  ) THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;

  SELECT pg_catalog.array_agg(policies.policyname::text ORDER BY policies.policyname)
  INTO actual_update_policies
  FROM pg_catalog.pg_policies AS policies
  WHERE policies.schemaname = 'public'
    AND policies.tablename = 'service_orders'
    AND policies.cmd = 'UPDATE';

  IF actual_update_policies IS DISTINCT FROM ARRAY[
    'service_orders_admin_secretaria_update',
    'service_orders_limpeza_update'
  ]::text[] OR NOT pg_catalog.has_table_privilege(
    'authenticated', 'public.service_orders', 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies AS policies
    WHERE policies.schemaname = 'public'
      AND policies.tablename = 'service_orders'
      AND policies.policyname = 'service_orders_admin_secretaria_update'
      AND policies.permissive = 'PERMISSIVE'
      AND policies.roles = ARRAY['authenticated']::name[]
      AND policies.qual LIKE '%get_my_role%'
      AND policies.qual LIKE '%admin%'
      AND policies.qual LIKE '%secretaria%'
      AND policies.with_check LIKE '%get_my_role%'
      AND policies.with_check LIKE '%admin%'
      AND policies.with_check LIKE '%secretaria%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies AS policies
    WHERE policies.schemaname = 'public'
      AND policies.tablename = 'service_orders'
      AND policies.policyname = 'service_orders_limpeza_update'
      AND policies.permissive = 'PERMISSIVE'
      AND policies.roles = ARRAY['authenticated']::name[]
      AND policies.qual LIKE '%get_my_role%'
      AND policies.qual LIKE '%operational_staff_service_order_ids%'
      AND policies.with_check LIKE '%Europe/Rome%'
      AND policies.with_check LIKE '%service_order_cleaning_staff%'
  ) THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;

  IF pg_catalog.to_regprocedure('private.guard_service_order_update()') IS NOT NULL
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.pg_trigger AS trigger
       WHERE trigger.tgrelid = 'public.service_orders'::pg_catalog.regclass
         AND NOT trigger.tgisinternal
     ) THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS columns
    WHERE columns.table_schema = 'public'
      AND columns.table_name = 'service_orders'
      AND columns.column_name = 'is_urgent'
      AND columns.is_generated = 'ALWAYS'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS columns
    WHERE columns.table_schema = 'public'
      AND columns.table_name = 'service_orders'
      AND columns.column_name = 'worked_minutes'
      AND columns.is_generated = 'ALWAYS'
  ) THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;
END
$preconditions$;

CREATE FUNCTION private.guard_service_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  app_role text := public.get_my_role();
  database_now timestamptz := pg_catalog.statement_timestamp();
BEGIN
  -- Technical database roles are not application business roles. service_role
  -- is used only through an authenticated, server-only, narrow adapter.
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF app_role IN ('"admin"', '"secretaria"') THEN
    RETURN NEW;
  END IF;

  IF app_role IS DISTINCT FROM '"limpeza"' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Aggiornamento O.L. non autorizzato.';
  END IF;

  -- Ignore a genuine no-op while keeping row scoping under RLS. Generated
  -- columns are intentionally excluded because PostgreSQL computes their NEW
  -- values after BEFORE triggers.
  IF ROW(
    NEW.id, NEW.property_id, NEW.cleaning_staff_id, NEW.consegna_staff_id,
    NEW.cleaning_date, NEW.checkout_at, NEW.checkin_at, NEW.status,
    NEW.real_guests, NEW.double_beds, NEW.single_beds, NEW.sofa_beds,
    NEW.bathrooms, NEW.bidets, NEW.cribs, NEW.total_price, NEW.completed_at,
    NEW.created_at, NEW.started_at, NEW.completion_notes, NEW.bedrooms,
    NEW.armchair_beds, NEW.order_number, NEW.cleaning_notes,
    NEW.extra_services_description, NEW.extra_services_price,
    NEW.pricing_mode, NEW.consegna_fee, NEW.cleaning_cycle
  ) IS NOT DISTINCT FROM ROW(
    OLD.id, OLD.property_id, OLD.cleaning_staff_id, OLD.consegna_staff_id,
    OLD.cleaning_date, OLD.checkout_at, OLD.checkin_at, OLD.status,
    OLD.real_guests, OLD.double_beds, OLD.single_beds, OLD.sofa_beds,
    OLD.bathrooms, OLD.bidets, OLD.cribs, OLD.total_price, OLD.completed_at,
    OLD.created_at, OLD.started_at, OLD.completion_notes, OLD.bedrooms,
    OLD.armchair_beds, OLD.order_number, OLD.cleaning_notes,
    OLD.extra_services_description, OLD.extra_services_price,
    OLD.pricing_mode, OLD.consegna_fee, OLD.cleaning_cycle
  ) THEN
    RETURN NEW;
  END IF;

  -- Normal start and legacy recovery of an in-progress order without a start
  -- timestamp. No other service-order field may change in this statement.
  IF OLD.status IN ('open', 'in_progress')
     AND NEW.status = 'in_progress'
     AND OLD.started_at IS NULL
     AND NEW.started_at IS NOT NULL
     AND NEW.started_at BETWEEN database_now - pg_catalog.make_interval(mins => 5)
                            AND database_now + pg_catalog.make_interval(mins => 1)
     AND ROW(
       NEW.id, NEW.property_id, NEW.cleaning_staff_id, NEW.consegna_staff_id,
       NEW.cleaning_date, NEW.checkout_at, NEW.checkin_at, NEW.real_guests,
       NEW.double_beds, NEW.single_beds, NEW.sofa_beds, NEW.bathrooms,
       NEW.bidets, NEW.cribs, NEW.total_price, NEW.completed_at, NEW.created_at,
       NEW.completion_notes, NEW.bedrooms, NEW.armchair_beds, NEW.order_number,
       NEW.cleaning_notes, NEW.extra_services_description,
       NEW.extra_services_price, NEW.pricing_mode, NEW.consegna_fee,
       NEW.cleaning_cycle
     ) IS NOT DISTINCT FROM ROW(
       OLD.id, OLD.property_id, OLD.cleaning_staff_id, OLD.consegna_staff_id,
       OLD.cleaning_date, OLD.checkout_at, OLD.checkin_at, OLD.real_guests,
       OLD.double_beds, OLD.single_beds, OLD.sofa_beds, OLD.bathrooms,
       OLD.bidets, OLD.cribs, OLD.total_price, OLD.completed_at, OLD.created_at,
       OLD.completion_notes, OLD.bedrooms, OLD.armchair_beds, OLD.order_number,
       OLD.cleaning_notes, OLD.extra_services_description,
       OLD.extra_services_price, OLD.pricing_mode, OLD.consegna_fee,
       OLD.cleaning_cycle
     ) THEN
    RETURN NEW;
  END IF;

  -- Completion may add notes and the database-near completion timestamp. The
  -- generated worked_minutes value is derived after this trigger.
  IF OLD.status = 'in_progress'
     AND NEW.status = 'done'
     AND OLD.started_at IS NOT NULL
     AND OLD.completed_at IS NULL
     AND NEW.completed_at IS NOT NULL
     AND NEW.completed_at >= OLD.started_at
     AND NEW.completed_at BETWEEN database_now - pg_catalog.make_interval(mins => 5)
                              AND database_now + pg_catalog.make_interval(mins => 1)
     AND ROW(
       NEW.id, NEW.property_id, NEW.cleaning_staff_id, NEW.consegna_staff_id,
       NEW.cleaning_date, NEW.checkout_at, NEW.checkin_at, NEW.real_guests,
       NEW.double_beds, NEW.single_beds, NEW.sofa_beds, NEW.bathrooms,
       NEW.bidets, NEW.cribs, NEW.total_price, NEW.created_at, NEW.started_at,
       NEW.bedrooms, NEW.armchair_beds, NEW.order_number, NEW.cleaning_notes,
       NEW.extra_services_description, NEW.extra_services_price,
       NEW.pricing_mode, NEW.consegna_fee, NEW.cleaning_cycle
     ) IS NOT DISTINCT FROM ROW(
       OLD.id, OLD.property_id, OLD.cleaning_staff_id, OLD.consegna_staff_id,
       OLD.cleaning_date, OLD.checkout_at, OLD.checkin_at, OLD.real_guests,
       OLD.double_beds, OLD.single_beds, OLD.sofa_beds, OLD.bathrooms,
       OLD.bidets, OLD.cribs, OLD.total_price, OLD.created_at, OLD.started_at,
       OLD.bedrooms, OLD.armchair_beds, OLD.order_number, OLD.cleaning_notes,
       OLD.extra_services_description, OLD.extra_services_price,
       OLD.pricing_mode, OLD.consegna_fee, OLD.cleaning_cycle
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = '42501',
    MESSAGE = 'Aggiornamento O.L. non autorizzato.';
END;
$function$;

REVOKE ALL ON FUNCTION private.guard_service_order_update()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER guard_service_order_updates
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_service_order_update();

COMMENT ON FUNCTION private.guard_service_order_update() IS
  'Guards service-order column mutations for operational application roles.';

COMMENT ON TRIGGER guard_service_order_updates ON public.service_orders IS
  'Allows Pulizia only the current start/finish tracking transitions.';

COMMIT;
