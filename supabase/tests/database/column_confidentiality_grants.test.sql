BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(68);

CREATE FUNCTION pg_temp.authenticate_as(user_id uuid, app_role text)
RETURNS void
LANGUAGE sql
AS $$
  SELECT set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', user_id,
      'role', 'authenticated',
      'app_role', app_role
    )::text,
    true
  );
$$;

-- Catalog contract: no table-level SELECT can neutralize column privileges.
SELECT ok(NOT has_table_privilege('authenticated', 'public.profiles', 'SELECT'),
  '[SPRINT 05][catalog][profiles] no authenticated table-level SELECT');
SELECT ok(NOT has_table_privilege('authenticated', 'public.properties', 'SELECT'),
  '[SPRINT 05][catalog][properties] no authenticated table-level SELECT');
SELECT ok(NOT has_table_privilege('authenticated', 'public.service_orders', 'SELECT'),
  '[SPRINT 05][catalog][service_orders] no authenticated table-level SELECT');

SELECT results_eq(
  $$SELECT array_agg(acl.privilege_type::text COLLATE "C" ORDER BY acl.privilege_type::text COLLATE "C") COLLATE "C"
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
    JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
    WHERE namespace.nspname = 'public' AND relation.relname = 'profiles'
      AND grantee.rolname = 'authenticated'$$,
  $$VALUES (ARRAY['DELETE', 'INSERT', 'UPDATE']::text[] COLLATE "C")$$,
  '[SPRINT 05][catalog][profiles] exact authenticated table privileges'
);
SELECT results_eq(
  $$SELECT array_agg(acl.privilege_type::text COLLATE "C" ORDER BY acl.privilege_type::text COLLATE "C") COLLATE "C"
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
    JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
    WHERE namespace.nspname = 'public' AND relation.relname = 'properties'
      AND grantee.rolname = 'authenticated'$$,
  $$VALUES (ARRAY['DELETE', 'INSERT', 'UPDATE']::text[] COLLATE "C")$$,
  '[SPRINT 05][catalog][properties] exact authenticated table privileges'
);
SELECT results_eq(
  $$SELECT array_agg(acl.privilege_type::text COLLATE "C" ORDER BY acl.privilege_type::text COLLATE "C") COLLATE "C"
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
    JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
    WHERE namespace.nspname = 'public' AND relation.relname = 'service_orders'
      AND grantee.rolname = 'authenticated'$$,
  $$VALUES (ARRAY['DELETE', 'INSERT', 'UPDATE']::text[] COLLATE "C")$$,
  '[SPRINT 05][catalog][service_orders] exact authenticated table privileges'
);

SELECT results_eq(
  $$SELECT array_agg((column_name::text COLLATE "C") ORDER BY ordinal_position) COLLATE "C"
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND has_column_privilege('authenticated', 'public.profiles', column_name, 'SELECT')$$,
  $$VALUES (ARRAY['id', 'full_name', 'role', 'created_at']::text[] COLLATE "C")$$,
  '[SPRINT 05][catalog][profiles] exact safe SELECT columns'
);
SELECT results_eq(
  $$SELECT array_agg((column_name::text COLLATE "C") ORDER BY ordinal_position) COLLATE "C"
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties'
      AND has_column_privilege('authenticated', 'public.properties', column_name, 'SELECT')$$,
  $$VALUES (ARRAY[
    'id', 'name', 'client_type', 'agency_id', 'owner_id', 'zone', 'phone',
    'email', 'address', 'zip_code', 'sqm_interior', 'sqm_exterior', 'sqm_total',
    'min_guests', 'max_guests', 'double_beds', 'single_beds', 'sofa_beds',
    'bathrooms', 'bidets', 'cribs', 'notes', 'created_at', 'bedrooms',
    'armchair_beds'
  ]::text[] COLLATE "C")$$,
  '[SPRINT 05][catalog][properties] exact safe SELECT columns'
);
SELECT results_eq(
  $$SELECT array_agg((column_name::text COLLATE "C") ORDER BY ordinal_position) COLLATE "C"
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_orders'
      AND has_column_privilege('authenticated', 'public.service_orders', column_name, 'SELECT')$$,
  $$VALUES (ARRAY[
    'id', 'property_id', 'cleaning_staff_id', 'consegna_staff_id',
    'cleaning_date', 'checkout_at', 'checkin_at', 'status', 'real_guests',
    'double_beds', 'single_beds', 'sofa_beds', 'bathrooms', 'bidets', 'cribs',
    'completed_at', 'created_at', 'started_at', 'completion_notes',
    'worked_minutes', 'bedrooms', 'armchair_beds', 'order_number', 'is_urgent',
    'cleaning_notes', 'pricing_mode', 'cleaning_cycle'
  ]::text[] COLLATE "C")$$,
  '[SPRINT 05][catalog][service_orders] exact safe SELECT columns'
);

SELECT ok(NOT has_column_privilege('authenticated', 'public.profiles', 'email', 'SELECT'), '[SPRINT 05][profiles] email restricted');
SELECT ok(NOT has_column_privilege('authenticated', 'public.profiles', 'phone', 'SELECT'), '[SPRINT 05][profiles] phone restricted');
SELECT ok(NOT has_column_privilege('authenticated', 'public.profiles', 'birth_date', 'SELECT'), '[SPRINT 05][profiles] birth_date restricted');
SELECT ok(NOT has_column_privilege('authenticated', 'public.profiles', 'nationality', 'SELECT'), '[SPRINT 05][profiles] nationality restricted');
SELECT ok(NOT has_column_privilege('authenticated', 'public.profiles', 'address', 'SELECT'), '[SPRINT 05][profiles] address restricted');
SELECT ok(NOT has_column_privilege('authenticated', 'public.profiles', 'hourly_rate', 'SELECT'), '[SPRINT 05][profiles] hourly_rate restricted');
SELECT ok(NOT has_column_privilege('authenticated', 'public.profiles', 'monthly_salary', 'SELECT'), '[SPRINT 05][profiles] monthly_salary restricted');
SELECT ok(NOT has_column_privilege('authenticated', 'public.profiles', 'overtime_rate', 'SELECT'), '[SPRINT 05][profiles] overtime_rate restricted');

SELECT ok(NOT has_column_privilege('authenticated', 'public.properties', 'base_price', 'SELECT'), '[SPRINT 05][properties] base_price restricted');
SELECT ok(NOT has_column_privilege('authenticated', 'public.properties', 'extra_per_person', 'SELECT'), '[SPRINT 05][properties] extra_per_person restricted');
SELECT ok(NOT has_column_privilege('authenticated', 'public.properties', 'avg_cleaning_hours', 'SELECT'), '[SPRINT 05][properties] avg_cleaning_hours restricted');

SELECT ok(NOT has_column_privilege('authenticated', 'public.service_orders', 'total_price', 'SELECT'), '[SPRINT 05][service_orders] total_price restricted');
SELECT ok(NOT has_column_privilege('authenticated', 'public.service_orders', 'extra_services_description', 'SELECT'), '[SPRINT 05][service_orders] extra_services_description restricted');
SELECT ok(NOT has_column_privilege('authenticated', 'public.service_orders', 'extra_services_price', 'SELECT'), '[SPRINT 05][service_orders] extra_services_price restricted');
SELECT ok(NOT has_column_privilege('authenticated', 'public.service_orders', 'consegna_fee', 'SELECT'), '[SPRINT 05][service_orders] consegna_fee restricted');

SELECT ok(has_table_privilege('service_role', 'public.profiles', 'SELECT'), '[SPRINT 05][service_role][profiles] full SELECT preserved');
SELECT ok(has_table_privilege('service_role', 'public.properties', 'SELECT'), '[SPRINT 05][service_role][properties] full SELECT preserved');
SELECT ok(has_table_privilege('service_role', 'public.service_orders', 'SELECT'), '[SPRINT 05][service_role][service_orders] full SELECT preserved');

INSERT INTO auth.users (id, email)
VALUES
  ('71000000-0000-0000-0000-000000000001', 'admin@column-cutover.example.invalid'),
  ('71000000-0000-0000-0000-000000000002', 'secretaria@column-cutover.example.invalid'),
  ('71000000-0000-0000-0000-000000000003', 'limpeza@column-cutover.example.invalid'),
  ('71000000-0000-0000-0000-000000000004', 'consegna@column-cutover.example.invalid'),
  ('71000000-0000-0000-0000-000000000005', 'cliente@column-cutover.example.invalid');

UPDATE public.profiles
SET
  full_name = CASE id
    WHEN '71000000-0000-0000-0000-000000000001' THEN 'Column Admin'
    WHEN '71000000-0000-0000-0000-000000000002' THEN 'Column Secretaria'
    WHEN '71000000-0000-0000-0000-000000000003' THEN 'Column Limpeza'
    WHEN '71000000-0000-0000-0000-000000000004' THEN 'Column Consegna'
    ELSE 'Column Cliente'
  END,
  role = CASE id
    WHEN '71000000-0000-0000-0000-000000000001' THEN 'admin'
    WHEN '71000000-0000-0000-0000-000000000002' THEN 'secretaria'
    WHEN '71000000-0000-0000-0000-000000000003' THEN 'limpeza'
    WHEN '71000000-0000-0000-0000-000000000004' THEN 'consegna'
    ELSE 'cliente'
  END,
  phone = 'synthetic', birth_date = DATE '2000-01-01', nationality = 'synthetic',
  address = 'synthetic', hourly_rate = 10, monthly_salary = 1000, overtime_rate = 15;

INSERT INTO public.owners (id, name, email)
VALUES
  ('72000000-0000-0000-0000-000000000001', 'Column Client Owner', 'cliente@column-cutover.example.invalid'),
  ('72000000-0000-0000-0000-000000000002', 'Column Other Owner', 'other@column-cutover.example.invalid');

INSERT INTO public.properties (
  id, name, client_type, owner_id, zone, base_price, extra_per_person, avg_cleaning_hours
)
VALUES
  ('73000000-0000-0000-0000-000000000001', 'Column Client Property', 'particular', '72000000-0000-0000-0000-000000000001', 'Other areas', 101, 11, 1.5),
  ('73000000-0000-0000-0000-000000000002', 'Column Assigned Property', 'particular', '72000000-0000-0000-0000-000000000002', 'Other areas', 202, 22, 2.5);

INSERT INTO public.service_orders (
  id, property_id, consegna_staff_id, cleaning_date, status, total_price,
  extra_services_description, extra_services_price, consegna_fee
)
VALUES
  ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000004', (timezone('Europe/Rome', now()))::date, 'open', 500, 'synthetic extra', 25, 10),
  ('74000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000001', NULL, (timezone('Europe/Rome', now()))::date, 'done', 600, 'synthetic client extra', 35, 10);

INSERT INTO public.service_order_cleaning_staff (service_order_id, profile_id)
VALUES ('74000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003');

SET LOCAL ROLE authenticated;

-- Admin.
SELECT pg_temp.authenticate_as('71000000-0000-0000-0000-000000000001', 'admin');
SELECT results_eq($$SELECT full_name FROM public.profiles WHERE id = '71000000-0000-0000-0000-000000000001'$$, ARRAY['Column Admin'::text], '[SPRINT 05][admin][profiles] safe columns readable');
SELECT results_eq($$SELECT name FROM public.properties WHERE id = '73000000-0000-0000-0000-000000000002'$$, ARRAY['Column Assigned Property'::text], '[SPRINT 05][admin][properties] safe columns readable');
SELECT results_eq($$SELECT status FROM public.service_orders WHERE id = '74000000-0000-0000-0000-000000000001'$$, ARRAY['open'::text], '[SPRINT 05][admin][service_orders] safe columns readable');
SELECT throws_ok($$SELECT email, phone, birth_date, nationality, address, hourly_rate, monthly_salary, overtime_rate FROM public.profiles WHERE id = '71000000-0000-0000-0000-000000000001'$$, '42501', NULL, '[SPRINT 05][admin][profiles] restricted columns blocked directly');
SELECT throws_ok($$SELECT base_price, extra_per_person, avg_cleaning_hours FROM public.properties WHERE id = '73000000-0000-0000-0000-000000000002'$$, '42501', NULL, '[SPRINT 05][admin][properties] restricted columns blocked directly');
SELECT throws_ok($$SELECT total_price, extra_services_description, extra_services_price, consegna_fee FROM public.service_orders WHERE id = '74000000-0000-0000-0000-000000000001'$$, '42501', NULL, '[SPRINT 05][admin][service_orders] restricted columns blocked directly');

-- Secretaria.
SELECT pg_temp.authenticate_as('71000000-0000-0000-0000-000000000002', 'secretaria');
SELECT results_eq($$SELECT full_name FROM public.profiles WHERE id = '71000000-0000-0000-0000-000000000002'$$, ARRAY['Column Secretaria'::text], '[SPRINT 05][secretaria][profiles] safe columns readable');
SELECT results_eq($$SELECT name FROM public.properties WHERE id = '73000000-0000-0000-0000-000000000002'$$, ARRAY['Column Assigned Property'::text], '[SPRINT 05][secretaria][properties] safe columns readable');
SELECT results_eq($$SELECT status FROM public.service_orders WHERE id = '74000000-0000-0000-0000-000000000001'$$, ARRAY['open'::text], '[SPRINT 05][secretaria][service_orders] safe columns readable');
SELECT throws_ok($$SELECT email, phone, birth_date, nationality, address, hourly_rate, monthly_salary, overtime_rate FROM public.profiles WHERE id = '71000000-0000-0000-0000-000000000002'$$, '42501', NULL, '[SPRINT 05][secretaria][profiles] restricted columns blocked directly');
SELECT throws_ok($$SELECT base_price, extra_per_person, avg_cleaning_hours FROM public.properties WHERE id = '73000000-0000-0000-0000-000000000002'$$, '42501', NULL, '[SPRINT 05][secretaria][properties] restricted columns blocked directly');
SELECT throws_ok($$SELECT total_price, extra_services_description, extra_services_price, consegna_fee FROM public.service_orders WHERE id = '74000000-0000-0000-0000-000000000001'$$, '42501', NULL, '[SPRINT 05][secretaria][service_orders] restricted columns blocked directly');

-- Limpeza.
SELECT pg_temp.authenticate_as('71000000-0000-0000-0000-000000000003', 'limpeza');
SELECT results_eq($$SELECT full_name FROM public.profiles WHERE id = '71000000-0000-0000-0000-000000000003'$$, ARRAY['Column Limpeza'::text], '[SPRINT 05][limpeza][profiles] safe columns readable');
SELECT results_eq($$SELECT name FROM public.properties WHERE id = '73000000-0000-0000-0000-000000000002'$$, ARRAY['Column Assigned Property'::text], '[SPRINT 05][limpeza][properties] safe columns readable');
SELECT results_eq($$SELECT status FROM public.service_orders WHERE id = '74000000-0000-0000-0000-000000000001'$$, ARRAY['open'::text], '[SPRINT 05][limpeza][service_orders] safe columns readable');
SELECT throws_ok($$SELECT email, phone, birth_date, nationality, address, hourly_rate, monthly_salary, overtime_rate FROM public.profiles WHERE id = '71000000-0000-0000-0000-000000000003'$$, '42501', NULL, '[SPRINT 05][limpeza][profiles] restricted columns blocked directly');
SELECT throws_ok($$SELECT base_price, extra_per_person, avg_cleaning_hours FROM public.properties WHERE id = '73000000-0000-0000-0000-000000000002'$$, '42501', NULL, '[SPRINT 05][limpeza][properties] restricted columns blocked directly');
SELECT throws_ok($$SELECT total_price, extra_services_description, extra_services_price, consegna_fee FROM public.service_orders WHERE id = '74000000-0000-0000-0000-000000000001'$$, '42501', NULL, '[SPRINT 05][limpeza][service_orders] restricted columns blocked directly');

-- Consegna.
SELECT pg_temp.authenticate_as('71000000-0000-0000-0000-000000000004', 'consegna');
SELECT results_eq($$SELECT full_name FROM public.profiles WHERE id = '71000000-0000-0000-0000-000000000004'$$, ARRAY['Column Consegna'::text], '[SPRINT 05][consegna][profiles] safe columns readable');
SELECT results_eq($$SELECT name FROM public.properties WHERE id = '73000000-0000-0000-0000-000000000002'$$, ARRAY['Column Assigned Property'::text], '[SPRINT 05][consegna][properties] safe columns readable');
SELECT results_eq($$SELECT status FROM public.service_orders WHERE id = '74000000-0000-0000-0000-000000000001'$$, ARRAY['open'::text], '[SPRINT 05][consegna][service_orders] safe columns readable');
SELECT throws_ok($$SELECT email, phone, birth_date, nationality, address, hourly_rate, monthly_salary, overtime_rate FROM public.profiles WHERE id = '71000000-0000-0000-0000-000000000004'$$, '42501', NULL, '[SPRINT 05][consegna][profiles] restricted columns blocked directly');
SELECT throws_ok($$SELECT base_price, extra_per_person, avg_cleaning_hours FROM public.properties WHERE id = '73000000-0000-0000-0000-000000000002'$$, '42501', NULL, '[SPRINT 05][consegna][properties] restricted columns blocked directly');
SELECT throws_ok($$SELECT total_price, extra_services_description, extra_services_price, consegna_fee FROM public.service_orders WHERE id = '74000000-0000-0000-0000-000000000001'$$, '42501', NULL, '[SPRINT 05][consegna][service_orders] restricted columns blocked directly');

-- Cliente.
SELECT pg_temp.authenticate_as('71000000-0000-0000-0000-000000000005', 'cliente');
SELECT results_eq($$SELECT full_name FROM public.profiles WHERE id = '71000000-0000-0000-0000-000000000005'$$, ARRAY['Column Cliente'::text], '[SPRINT 05][cliente][profiles] safe columns readable');
SELECT results_eq($$SELECT name FROM public.properties WHERE id = '73000000-0000-0000-0000-000000000001'$$, ARRAY['Column Client Property'::text], '[SPRINT 05][cliente][properties] safe columns readable');
SELECT results_eq($$SELECT status FROM public.service_orders WHERE id = '74000000-0000-0000-0000-000000000002'$$, ARRAY['done'::text], '[SPRINT 05][cliente][service_orders] safe columns readable');
SELECT throws_ok($$SELECT email, phone, birth_date, nationality, address, hourly_rate, monthly_salary, overtime_rate FROM public.profiles WHERE id = '71000000-0000-0000-0000-000000000005'$$, '42501', NULL, '[SPRINT 05][cliente][profiles] restricted columns blocked directly');
SELECT throws_ok($$SELECT base_price, extra_per_person, avg_cleaning_hours FROM public.properties WHERE id = '73000000-0000-0000-0000-000000000001'$$, '42501', NULL, '[SPRINT 05][cliente][properties] restricted columns blocked directly');
SELECT throws_ok($$SELECT total_price, extra_services_description, extra_services_price, consegna_fee FROM public.service_orders WHERE id = '74000000-0000-0000-0000-000000000002'$$, '42501', NULL, '[SPRINT 05][cliente][service_orders] restricted columns blocked directly');

-- Wildcards cannot silently reopen restricted columns.
SELECT pg_temp.authenticate_as('71000000-0000-0000-0000-000000000001', 'admin');
SELECT throws_ok($$SELECT * FROM public.profiles LIMIT 1$$, '42501', NULL, '[SPRINT 05][wildcard][profiles] blocked');
SELECT throws_ok($$SELECT * FROM public.properties LIMIT 1$$, '42501', NULL, '[SPRINT 05][wildcard][properties] blocked');
SELECT throws_ok($$SELECT * FROM public.service_orders LIMIT 1$$, '42501', NULL, '[SPRINT 05][wildcard][service_orders] blocked');

-- Safe relational reads continue to obey RLS for every role.
SELECT pg_temp.authenticate_as('71000000-0000-0000-0000-000000000001', 'admin');
SELECT results_eq($$SELECT p.name FROM public.service_orders so JOIN public.properties p ON p.id = so.property_id WHERE so.id = '74000000-0000-0000-0000-000000000001'$$, ARRAY['Column Assigned Property'::text], '[SPRINT 05][admin][relational] safe join allowed');
SELECT pg_temp.authenticate_as('71000000-0000-0000-0000-000000000002', 'secretaria');
SELECT results_eq($$SELECT p.name FROM public.service_orders so JOIN public.properties p ON p.id = so.property_id WHERE so.id = '74000000-0000-0000-0000-000000000001'$$, ARRAY['Column Assigned Property'::text], '[SPRINT 05][secretaria][relational] safe join allowed');
SELECT pg_temp.authenticate_as('71000000-0000-0000-0000-000000000003', 'limpeza');
SELECT results_eq($$SELECT p.name FROM public.service_orders so JOIN public.properties p ON p.id = so.property_id WHERE so.id = '74000000-0000-0000-0000-000000000001'$$, ARRAY['Column Assigned Property'::text], '[SPRINT 05][limpeza][relational] safe join allowed');
SELECT pg_temp.authenticate_as('71000000-0000-0000-0000-000000000004', 'consegna');
SELECT results_eq($$SELECT p.name FROM public.service_orders so JOIN public.properties p ON p.id = so.property_id WHERE so.id = '74000000-0000-0000-0000-000000000001'$$, ARRAY['Column Assigned Property'::text], '[SPRINT 05][consegna][relational] safe join allowed');
SELECT pg_temp.authenticate_as('71000000-0000-0000-0000-000000000005', 'cliente');
SELECT results_eq($$SELECT p.name FROM public.service_orders so JOIN public.properties p ON p.id = so.property_id WHERE so.id = '74000000-0000-0000-0000-000000000002'$$, ARRAY['Column Client Property'::text], '[SPRINT 05][cliente][relational] safe join allowed');

SELECT pg_temp.authenticate_as('71000000-0000-0000-0000-000000000001', 'admin');
SELECT throws_ok($$SELECT p.base_price FROM public.service_orders so JOIN public.properties p ON p.id = so.property_id WHERE so.id = '74000000-0000-0000-0000-000000000001'$$, '42501', NULL, '[SPRINT 05][relational] restricted nested column remains blocked');

-- PII of peer profiles is not exposed by staff-peer RLS rows.
SELECT pg_temp.authenticate_as('71000000-0000-0000-0000-000000000003', 'limpeza');
SELECT throws_ok($$SELECT email FROM public.profiles WHERE id = '71000000-0000-0000-0000-000000000004'$$, '42501', NULL, '[SPRINT 05][limpeza][peer profile] PII blocked');
SELECT pg_temp.authenticate_as('71000000-0000-0000-0000-000000000004', 'consegna');
SELECT throws_ok($$SELECT hourly_rate FROM public.profiles WHERE id = '71000000-0000-0000-0000-000000000003'$$, '42501', NULL, '[SPRINT 05][consegna][peer profile] compensation blocked');

SELECT * FROM finish();
ROLLBACK;
