BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(8);

-- These are the desired database guarantees for Sprints 04 and 05. They are
-- intentionally TODO while the current schema remains vulnerable. Keeping the
-- inverse assertions here makes the gap visible without redefining it as an
-- accepted behavior or weakening the current characterization suite.
SELECT todo_start('Open authorization gap; must be made green by Sprint 04/05 before removing TODO');

SELECT ok(
  NOT has_column_privilege('authenticated', 'public.profiles', 'hourly_rate', 'SELECT'),
  '[TARGET][OPEN GAP][profiles][select][hourly_rate] authenticated has no direct grant'
);
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.profiles', 'monthly_salary', 'SELECT'),
  '[TARGET][OPEN GAP][profiles][select][monthly_salary] authenticated has no direct grant'
);
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.properties', 'base_price', 'SELECT'),
  '[TARGET][OPEN GAP][properties][select][base_price] authenticated has no direct grant'
);
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.properties', 'extra_per_person', 'SELECT'),
  '[TARGET][OPEN GAP][properties][select][extra_per_person] authenticated has no direct grant'
);
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.properties', 'avg_cleaning_hours', 'SELECT'),
  '[TARGET][OPEN GAP][properties][select][avg_cleaning_hours] authenticated has no direct grant'
);
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.service_orders', 'total_price', 'SELECT'),
  '[TARGET][OPEN GAP][service_orders][select][total_price] authenticated has no direct grant'
);
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.service_orders', 'consegna_fee', 'SELECT'),
  '[TARGET][OPEN GAP][service_orders][select][consegna_fee] authenticated has no direct grant'
);

SELECT todo_end();

INSERT INTO auth.users (id, email)
VALUES ('55000000-0000-0000-0000-000000000001', 'target-limpeza@auth-matrix.example.invalid');
UPDATE public.profiles
SET full_name = 'Synthetic Target Limpeza', role = 'limpeza'
WHERE id = '55000000-0000-0000-0000-000000000001';

INSERT INTO public.owners (id, name, email)
VALUES ('56000000-0000-0000-0000-000000000001', 'Synthetic Target Owner', 'target-owner@auth-matrix.example.invalid');
INSERT INTO public.properties (id, name, client_type, owner_id, zone)
VALUES ('57000000-0000-0000-0000-000000000001', 'Synthetic Target Property', 'particular', '56000000-0000-0000-0000-000000000001', 'Other areas');
INSERT INTO public.service_orders (id, property_id, cleaning_date, total_price)
VALUES ('58000000-0000-0000-0000-000000000001', '57000000-0000-0000-0000-000000000001', (timezone('Europe/Rome', now()))::date, 100);
INSERT INTO public.service_order_cleaning_staff (service_order_id, profile_id)
VALUES ('58000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000001');

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '55000000-0000-0000-0000-000000000001',
    'role', 'authenticated',
    'app_role', 'limpeza'
  )::text,
  true
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$UPDATE public.service_orders SET total_price = 999 WHERE id = '58000000-0000-0000-0000-000000000001'$$,
  '42501',
  'Aggiornamento O.L. non autorizzato.',
  '[TARGET][SPRINT 04][limpeza][service_orders][update][total_price] blocked by database'
);

SELECT * FROM finish();
ROLLBACK;
