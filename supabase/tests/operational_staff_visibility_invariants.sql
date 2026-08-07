-- Read-only authorization assertions to run after
-- 20260807193218_operational_staff_service_order_visibility.sql in a disposable
-- database or an isolated production-like copy.

DO $assertions$
DECLARE
  helper_definition text;
  property_helper_definition text;
  policy_name text;
  policy_expression text;
  update_check_expression text;
  unexpected_consegna_update boolean;
BEGIN
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
     OR helper_definition NOT LIKE '%cleaning_date IS NOT NULL%'
     OR helper_definition NOT LIKE '%service_order_cleaning_staff%'
     OR helper_definition NOT LIKE '%consegna_staff_id%' THEN
    RAISE EXCEPTION 'Unexpected operational visibility helper contract';
  END IF;

  IF pg_catalog.has_function_privilege(
    'anon',
    'private.operational_staff_service_order_ids()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon must not execute the operational visibility helper';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
    'authenticated',
    'private.operational_staff_service_order_ids()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated must execute the operational visibility helper for RLS';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(procedure.oid)
  INTO property_helper_definition
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'private'
    AND procedure.proname = 'staff_property_ids'
    AND pg_catalog.pg_get_function_identity_arguments(procedure.oid) = 'uid uuid';

  IF property_helper_definition IS NULL
     OR property_helper_definition NOT LIKE '%auth.uid()%'
     OR property_helper_definition NOT LIKE '%operational_staff_service_order_ids()%'
     OR property_helper_definition NOT LIKE '%SET search_path TO ''''%' THEN
    RAISE EXCEPTION 'Property visibility is not aligned with the operational scope';
  END IF;

  FOREACH policy_name IN ARRAY ARRAY[
    'service_orders_limpeza_select',
    'service_orders_limpeza_update',
    'service_orders_consegna_select',
    'service_order_cleaning_staff_select',
    'profiles_staff_peer_select'
  ]
  LOOP
    SELECT pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
    INTO policy_expression
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polname = policy_name
      AND policy.polrelid IN (
        'public.service_orders'::regclass,
        'public.service_order_cleaning_staff'::regclass,
        'public.profiles'::regclass
      )
      AND policy.polroles = ARRAY[
        (SELECT role.oid FROM pg_catalog.pg_roles AS role WHERE role.rolname = 'authenticated')
      ];

    IF policy_expression IS NULL
       OR policy_expression NOT LIKE '%operational_staff_service_order_ids%' THEN
      RAISE EXCEPTION 'Policy % is not restricted to the operational helper', policy_name;
    END IF;
  END LOOP;

  SELECT pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
  INTO update_check_expression
  FROM pg_catalog.pg_policy AS policy
  WHERE policy.polname = 'service_orders_limpeza_update'
    AND policy.polrelid = 'public.service_orders'::regclass;

  IF update_check_expression IS NULL
     OR update_check_expression NOT LIKE '%cleaning_date IS NOT NULL%'
     OR update_check_expression NOT LIKE '%Europe/Rome%'
     OR update_check_expression NOT LIKE '%service_order_cleaning_staff%' THEN
    RAISE EXCEPTION 'Pulizia update checks are not aligned with the operational scope';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_orders'
      AND policyname = 'service_orders_consegna_update'
  )
  INTO unexpected_consegna_update;

  IF unexpected_consegna_update THEN
    RAISE EXCEPTION 'Consegna must remain read-only';
  END IF;
END
$assertions$;
