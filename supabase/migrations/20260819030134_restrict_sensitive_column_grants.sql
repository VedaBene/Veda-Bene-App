BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
DECLARE
  actual_columns text[];
  actual_table_privileges text[];
  actual_column_select_grants text[];
BEGIN
  IF pg_catalog.to_regclass('public.profiles') IS NULL
     OR pg_catalog.to_regclass('public.properties') IS NULL
     OR pg_catalog.to_regclass('public.service_orders') IS NULL THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  IF pg_catalog.to_regclass('public.profiles_public') IS NOT NULL
     OR pg_catalog.to_regclass('public.properties_public') IS NOT NULL THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  SELECT pg_catalog.array_agg(columns.column_name::text ORDER BY columns.ordinal_position)
  INTO actual_columns
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public' AND columns.table_name = 'profiles';

  IF actual_columns IS DISTINCT FROM ARRAY[
    'id', 'full_name', 'email', 'phone', 'role', 'birth_date', 'nationality',
    'address', 'hourly_rate', 'monthly_salary', 'overtime_rate', 'created_at'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  SELECT pg_catalog.array_agg(columns.column_name::text ORDER BY columns.ordinal_position)
  INTO actual_columns
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public' AND columns.table_name = 'properties';

  IF actual_columns IS DISTINCT FROM ARRAY[
    'id', 'name', 'client_type', 'agency_id', 'owner_id', 'zone', 'phone',
    'email', 'address', 'zip_code', 'sqm_interior', 'sqm_exterior', 'sqm_total',
    'min_guests', 'max_guests', 'double_beds', 'single_beds', 'sofa_beds',
    'bathrooms', 'bidets', 'cribs', 'base_price', 'extra_per_person',
    'avg_cleaning_hours', 'notes', 'created_at', 'bedrooms', 'armchair_beds'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  SELECT pg_catalog.array_agg(columns.column_name::text ORDER BY columns.ordinal_position)
  INTO actual_columns
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public' AND columns.table_name = 'service_orders';

  IF actual_columns IS DISTINCT FROM ARRAY[
    'id', 'property_id', 'cleaning_staff_id', 'consegna_staff_id',
    'cleaning_date', 'checkout_at', 'checkin_at', 'status', 'real_guests',
    'double_beds', 'single_beds', 'sofa_beds', 'bathrooms', 'bidets', 'cribs',
    'total_price', 'completed_at', 'created_at', 'started_at',
    'completion_notes', 'worked_minutes', 'bedrooms', 'armchair_beds',
    'order_number', 'is_urgent', 'cleaning_notes',
    'extra_services_description', 'extra_services_price', 'pricing_mode',
    'consegna_fee', 'cleaning_cycle'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname IN ('profiles', 'properties', 'service_orders')
      AND (relation.relkind <> 'r' OR NOT relation.relrowsecurity)
  ) THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  SELECT pg_catalog.array_agg(
    namespace.nspname || '.' || relation.relname || '.' || acl.privilege_type
    ORDER BY namespace.nspname, relation.relname, acl.privilege_type
  )
  INTO actual_table_privileges
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
  JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
  WHERE namespace.nspname = 'public'
    AND relation.relname IN ('profiles', 'properties', 'service_orders')
    AND grantee.rolname = 'authenticated';

  IF actual_table_privileges IS DISTINCT FROM ARRAY[
    'public.profiles.DELETE', 'public.profiles.INSERT',
    'public.profiles.MAINTAIN', 'public.profiles.REFERENCES',
    'public.profiles.SELECT', 'public.profiles.TRIGGER',
    'public.profiles.TRUNCATE', 'public.profiles.UPDATE',
    'public.properties.DELETE', 'public.properties.INSERT',
    'public.properties.MAINTAIN', 'public.properties.REFERENCES',
    'public.properties.SELECT', 'public.properties.TRIGGER',
    'public.properties.TRUNCATE', 'public.properties.UPDATE',
    'public.service_orders.DELETE', 'public.service_orders.INSERT',
    'public.service_orders.MAINTAIN', 'public.service_orders.REFERENCES',
    'public.service_orders.SELECT', 'public.service_orders.TRIGGER',
    'public.service_orders.TRUNCATE', 'public.service_orders.UPDATE'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  IF NOT pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.properties', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.service_orders', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.profiles', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.properties', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.service_orders', 'SELECT') THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  SELECT pg_catalog.array_agg(
    namespace.nspname || '.' || relation.relname || '.' || attribute.attname
    ORDER BY namespace.nspname, relation.relname, attribute.attnum
  )
  INTO actual_column_select_grants
  FROM pg_catalog.pg_attribute AS attribute
  JOIN pg_catalog.pg_class AS relation ON relation.oid = attribute.attrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
  JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
  WHERE namespace.nspname = 'public'
    AND relation.relname IN ('profiles', 'properties', 'service_orders')
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped
    AND grantee.rolname = 'authenticated'
    AND acl.privilege_type = 'SELECT';

  IF actual_column_select_grants IS NOT NULL THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;
END
$preconditions$;

REVOKE SELECT, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.profiles FROM authenticated;
REVOKE SELECT, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.properties FROM authenticated;
REVOKE SELECT, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.service_orders FROM authenticated;

GRANT SELECT (
  id, full_name, role, created_at
) ON TABLE public.profiles TO authenticated;

GRANT SELECT (
  id, name, client_type, agency_id, owner_id, zone, phone, email, address,
  zip_code, sqm_interior, sqm_exterior, sqm_total, min_guests, max_guests,
  double_beds, single_beds, sofa_beds, bathrooms, bidets, cribs, notes,
  created_at, bedrooms, armchair_beds
) ON TABLE public.properties TO authenticated;

GRANT SELECT (
  id, property_id, cleaning_staff_id, consegna_staff_id, cleaning_date,
  checkout_at, checkin_at, status, real_guests, double_beds, single_beds,
  sofa_beds, bathrooms, bidets, cribs, completed_at, created_at, started_at,
  completion_notes, worked_minutes, bedrooms, armchair_beds, order_number,
  is_urgent, cleaning_notes, pricing_mode, cleaning_cycle
) ON TABLE public.service_orders TO authenticated;

DO $postconditions$
DECLARE
  selectable_columns text[];
  actual_table_privileges text[];
BEGIN
  IF pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'SELECT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.properties', 'SELECT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.service_orders', 'SELECT') THEN
    RAISE EXCEPTION 'Column confidentiality cutover postcondition failed';
  END IF;

  SELECT pg_catalog.array_agg(
    namespace.nspname || '.' || relation.relname || '.' || acl.privilege_type
    ORDER BY namespace.nspname, relation.relname, acl.privilege_type
  )
  INTO actual_table_privileges
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
  JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
  WHERE namespace.nspname = 'public'
    AND relation.relname IN ('profiles', 'properties', 'service_orders')
    AND grantee.rolname = 'authenticated';

  IF actual_table_privileges IS DISTINCT FROM ARRAY[
    'public.profiles.DELETE', 'public.profiles.INSERT', 'public.profiles.UPDATE',
    'public.properties.DELETE', 'public.properties.INSERT',
    'public.properties.UPDATE', 'public.service_orders.DELETE',
    'public.service_orders.INSERT', 'public.service_orders.UPDATE'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover postcondition failed';
  END IF;

  SELECT pg_catalog.array_agg(columns.column_name::text ORDER BY columns.ordinal_position)
  INTO selectable_columns
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public'
    AND columns.table_name = 'profiles'
    AND pg_catalog.has_column_privilege(
      'authenticated', 'public.profiles', columns.column_name, 'SELECT'
    );

  IF selectable_columns IS DISTINCT FROM ARRAY[
    'id', 'full_name', 'role', 'created_at'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover postcondition failed';
  END IF;

  SELECT pg_catalog.array_agg(columns.column_name::text ORDER BY columns.ordinal_position)
  INTO selectable_columns
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public'
    AND columns.table_name = 'properties'
    AND pg_catalog.has_column_privilege(
      'authenticated', 'public.properties', columns.column_name, 'SELECT'
    );

  IF selectable_columns IS DISTINCT FROM ARRAY[
    'id', 'name', 'client_type', 'agency_id', 'owner_id', 'zone', 'phone',
    'email', 'address', 'zip_code', 'sqm_interior', 'sqm_exterior', 'sqm_total',
    'min_guests', 'max_guests', 'double_beds', 'single_beds', 'sofa_beds',
    'bathrooms', 'bidets', 'cribs', 'notes', 'created_at', 'bedrooms',
    'armchair_beds'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover postcondition failed';
  END IF;

  SELECT pg_catalog.array_agg(columns.column_name::text ORDER BY columns.ordinal_position)
  INTO selectable_columns
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public'
    AND columns.table_name = 'service_orders'
    AND pg_catalog.has_column_privilege(
      'authenticated', 'public.service_orders', columns.column_name, 'SELECT'
    );

  IF selectable_columns IS DISTINCT FROM ARRAY[
    'id', 'property_id', 'cleaning_staff_id', 'consegna_staff_id',
    'cleaning_date', 'checkout_at', 'checkin_at', 'status', 'real_guests',
    'double_beds', 'single_beds', 'sofa_beds', 'bathrooms', 'bidets', 'cribs',
    'completed_at', 'created_at', 'started_at', 'completion_notes',
    'worked_minutes', 'bedrooms', 'armchair_beds', 'order_number', 'is_urgent',
    'cleaning_notes', 'pricing_mode', 'cleaning_cycle'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover postcondition failed';
  END IF;

  IF NOT pg_catalog.has_table_privilege('service_role', 'public.profiles', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.properties', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.service_orders', 'SELECT') THEN
    RAISE EXCEPTION 'Column confidentiality cutover postcondition failed';
  END IF;
END
$postconditions$;

COMMIT;
