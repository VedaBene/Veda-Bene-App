BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(49);

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

INSERT INTO auth.users (id, email)
VALUES
  ('11000000-0000-0000-0000-000000000001', 'admin@auth-matrix.example.invalid'),
  ('11000000-0000-0000-0000-000000000002', 'secretaria@auth-matrix.example.invalid'),
  ('11000000-0000-0000-0000-000000000003', 'limpeza@auth-matrix.example.invalid'),
  ('11000000-0000-0000-0000-000000000004', 'consegna@auth-matrix.example.invalid'),
  ('11000000-0000-0000-0000-000000000005', 'cliente@auth-matrix.example.invalid');

UPDATE public.profiles
SET
  full_name = CASE id
    WHEN '11000000-0000-0000-0000-000000000001' THEN 'Synthetic Admin'
    WHEN '11000000-0000-0000-0000-000000000002' THEN 'Synthetic Secretaria'
    WHEN '11000000-0000-0000-0000-000000000003' THEN 'Synthetic Limpeza'
    WHEN '11000000-0000-0000-0000-000000000004' THEN 'Synthetic Consegna'
    ELSE 'Synthetic Cliente'
  END,
  role = CASE id
    WHEN '11000000-0000-0000-0000-000000000001' THEN 'admin'
    WHEN '11000000-0000-0000-0000-000000000002' THEN 'secretaria'
    WHEN '11000000-0000-0000-0000-000000000003' THEN 'limpeza'
    WHEN '11000000-0000-0000-0000-000000000004' THEN 'consegna'
    ELSE 'cliente'
  END,
  hourly_rate = CASE id
    WHEN '11000000-0000-0000-0000-000000000001' THEN 101
    WHEN '11000000-0000-0000-0000-000000000002' THEN 102
    WHEN '11000000-0000-0000-0000-000000000003' THEN 103
    WHEN '11000000-0000-0000-0000-000000000004' THEN 104
    ELSE 105
  END;

INSERT INTO public.owners (id, name, email)
VALUES
  ('22000000-0000-0000-0000-000000000001', 'Synthetic Client Owner', 'cliente@auth-matrix.example.invalid'),
  ('22000000-0000-0000-0000-000000000002', 'Synthetic Unrelated Owner', 'unrelated@auth-matrix.example.invalid');

INSERT INTO public.properties (
  id, name, client_type, owner_id, zone, base_price, extra_per_person,
  avg_cleaning_hours
)
VALUES
  ('33000000-0000-0000-0000-000000000001', 'Synthetic Client Property', 'particular', '22000000-0000-0000-0000-000000000001', 'Other areas', 111.11, 11.11, 1.5),
  ('33000000-0000-0000-0000-000000000002', 'Synthetic Assigned Property', 'particular', '22000000-0000-0000-0000-000000000002', 'Other areas', 222.22, 22.22, 2.5),
  ('33000000-0000-0000-0000-000000000003', 'Synthetic Unrelated Property', 'particular', '22000000-0000-0000-0000-000000000002', 'Other areas', 333.33, 33.33, 3.5);

INSERT INTO public.service_orders (
  id, property_id, consegna_staff_id, cleaning_date, status, total_price
)
VALUES
  ('44000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000004', (timezone('Europe/Rome', now()))::date, 'open', 500),
  ('44000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', NULL, (timezone('Europe/Rome', now()))::date, 'done', 600),
  ('44000000-0000-0000-0000-000000000003', '33000000-0000-0000-0000-000000000003', NULL, (timezone('Europe/Rome', now()))::date, 'open', 700),
  ('44000000-0000-0000-0000-000000000004', '33000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000004', (timezone('Europe/Rome', now()))::date + 1, 'open', 800),
  ('44000000-0000-0000-0000-000000000005', '33000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000004', NULL, 'open', 900);

INSERT INTO public.service_order_cleaning_staff (service_order_id, profile_id)
VALUES
  ('44000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003'),
  ('44000000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000003'),
  ('44000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000003');

SET LOCAL ROLE authenticated;

-- Role × table × SELECT scope.
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000001', 'admin');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = '11000000-0000-0000-0000-000000000001')$$, ARRAY[true], '[CURRENT][admin][profiles][select][self] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000002', 'secretaria');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = '11000000-0000-0000-0000-000000000002')$$, ARRAY[true], '[CURRENT][secretaria][profiles][select][self] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000003', 'limpeza');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = '11000000-0000-0000-0000-000000000003')$$, ARRAY[true], '[CURRENT][limpeza][profiles][select][self] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000004', 'consegna');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = '11000000-0000-0000-0000-000000000004')$$, ARRAY[true], '[CURRENT][consegna][profiles][select][self] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000005', 'cliente');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = '11000000-0000-0000-0000-000000000005')$$, ARRAY[true], '[CURRENT][cliente][profiles][select][self] allowed');

SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000001', 'admin');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.properties WHERE id = '33000000-0000-0000-0000-000000000002')$$, ARRAY[true], '[CURRENT][admin][properties][select][assigned] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000002', 'secretaria');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.properties WHERE id = '33000000-0000-0000-0000-000000000002')$$, ARRAY[true], '[CURRENT][secretaria][properties][select][assigned] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000003', 'limpeza');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.properties WHERE id = '33000000-0000-0000-0000-000000000002')$$, ARRAY[true], '[CURRENT][limpeza][properties][select][assigned-today] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000004', 'consegna');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.properties WHERE id = '33000000-0000-0000-0000-000000000002')$$, ARRAY[true], '[CURRENT][consegna][properties][select][assigned-today] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000005', 'cliente');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.properties WHERE id = '33000000-0000-0000-0000-000000000001')$$, ARRAY[true], '[CURRENT][cliente][properties][select][owned] allowed');

SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000001', 'admin');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000001')$$, ARRAY[true], '[CURRENT][admin][service_orders][select][row] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000002', 'secretaria');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000001')$$, ARRAY[true], '[CURRENT][secretaria][service_orders][select][row] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000003', 'limpeza');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000001')$$, ARRAY[true], '[CURRENT][limpeza][service_orders][select][assigned-today] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000004', 'consegna');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000001')$$, ARRAY[true], '[CURRENT][consegna][service_orders][select][assigned-today] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000005', 'cliente');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000002')$$, ARRAY[true], '[CURRENT][cliente][service_orders][select][owned] allowed');

SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000001', 'admin');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000003')$$, ARRAY[true], '[CURRENT][admin][service_orders][select][unassigned] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000002', 'secretaria');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000003')$$, ARRAY[true], '[CURRENT][secretaria][service_orders][select][unassigned] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000003', 'limpeza');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000003')$$, ARRAY[false], '[CURRENT][limpeza][service_orders][select][unassigned] blocked');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000004', 'consegna');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000003')$$, ARRAY[false], '[CURRENT][consegna][service_orders][select][unassigned] blocked');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000005', 'cliente');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000003')$$, ARRAY[false], '[CURRENT][cliente][service_orders][select][foreign] blocked');

-- Role × service_orders × UPDATE × completion_notes.
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000001', 'admin');
SELECT results_eq($$UPDATE public.service_orders SET completion_notes = 'synthetic admin update' WHERE id = '44000000-0000-0000-0000-000000000001' RETURNING id$$, ARRAY['44000000-0000-0000-0000-000000000001'::uuid], '[CURRENT][admin][service_orders][update][completion_notes] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000002', 'secretaria');
SELECT results_eq($$UPDATE public.service_orders SET completion_notes = 'synthetic secretaria update' WHERE id = '44000000-0000-0000-0000-000000000001' RETURNING id$$, ARRAY['44000000-0000-0000-0000-000000000001'::uuid], '[CURRENT][secretaria][service_orders][update][completion_notes] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000003', 'limpeza');
SELECT results_eq($$UPDATE public.service_orders SET completion_notes = 'synthetic limpeza update' WHERE id = '44000000-0000-0000-0000-000000000001' RETURNING id$$, ARRAY['44000000-0000-0000-0000-000000000001'::uuid], '[CURRENT][limpeza][service_orders][update][completion_notes] allowed in assigned scope');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000004', 'consegna');
SELECT results_eq($$UPDATE public.service_orders SET completion_notes = 'synthetic consegna update' WHERE id = '44000000-0000-0000-0000-000000000001' RETURNING id$$, ARRAY[]::uuid[], '[CURRENT][consegna][service_orders][update][completion_notes] blocked by RLS');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000005', 'cliente');
SELECT results_eq($$UPDATE public.service_orders SET completion_notes = 'synthetic cliente update' WHERE id = '44000000-0000-0000-0000-000000000002' RETURNING id$$, ARRAY[]::uuid[], '[CURRENT][cliente][service_orders][update][completion_notes] blocked by RLS');

-- Direct sensitive-column reads. Non-admin successes are explicitly known gaps,
-- not the desired security contract; the target suite below records the inverse.
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000001', 'admin');
SELECT results_eq($$SELECT base_price FROM public.properties WHERE id = '33000000-0000-0000-0000-000000000002'$$, ARRAY[222.22::numeric], '[CURRENT][admin][properties][select][base_price] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000002', 'secretaria');
SELECT results_eq($$SELECT base_price FROM public.properties WHERE id = '33000000-0000-0000-0000-000000000002'$$, ARRAY[222.22::numeric], '[CURRENT][KNOWN UNSAFE][secretaria][properties][select][base_price] directly readable');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000003', 'limpeza');
SELECT results_eq($$SELECT base_price FROM public.properties WHERE id = '33000000-0000-0000-0000-000000000002'$$, ARRAY[222.22::numeric], '[CURRENT][KNOWN UNSAFE][limpeza][properties][select][base_price] directly readable');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000004', 'consegna');
SELECT results_eq($$SELECT base_price FROM public.properties WHERE id = '33000000-0000-0000-0000-000000000002'$$, ARRAY[222.22::numeric], '[CURRENT][KNOWN UNSAFE][consegna][properties][select][base_price] directly readable');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000005', 'cliente');
SELECT results_eq($$SELECT base_price FROM public.properties WHERE id = '33000000-0000-0000-0000-000000000001'$$, ARRAY[111.11::numeric], '[CURRENT][KNOWN UNSAFE][cliente][properties][select][base_price] directly readable');

SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000001', 'admin');
SELECT results_eq($$SELECT hourly_rate FROM public.profiles WHERE id = '11000000-0000-0000-0000-000000000001'$$, ARRAY[101::numeric], '[CURRENT][admin][profiles][select][hourly_rate] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000002', 'secretaria');
SELECT results_eq($$SELECT hourly_rate FROM public.profiles WHERE id = '11000000-0000-0000-0000-000000000002'$$, ARRAY[102::numeric], '[CURRENT][KNOWN UNSAFE][secretaria][profiles][select][hourly_rate] directly readable');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000003', 'limpeza');
SELECT results_eq($$SELECT hourly_rate FROM public.profiles WHERE id = '11000000-0000-0000-0000-000000000003'$$, ARRAY[103::numeric], '[CURRENT][KNOWN UNSAFE][limpeza][profiles][select][hourly_rate] directly readable');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000004', 'consegna');
SELECT results_eq($$SELECT hourly_rate FROM public.profiles WHERE id = '11000000-0000-0000-0000-000000000004'$$, ARRAY[104::numeric], '[CURRENT][KNOWN UNSAFE][consegna][profiles][select][hourly_rate] directly readable');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000005', 'cliente');
SELECT results_eq($$SELECT hourly_rate FROM public.profiles WHERE id = '11000000-0000-0000-0000-000000000005'$$, ARRAY[105::numeric], '[CURRENT][KNOWN UNSAFE][cliente][profiles][select][hourly_rate] directly readable');

SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000001', 'admin');
SELECT results_eq($$SELECT total_price FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000001'$$, ARRAY[500::numeric], '[CURRENT][admin][service_orders][select][total_price] allowed');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000002', 'secretaria');
SELECT results_eq($$SELECT total_price FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000001'$$, ARRAY[500::numeric], '[CURRENT][KNOWN UNSAFE][secretaria][service_orders][select][total_price] directly readable');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000003', 'limpeza');
SELECT results_eq($$SELECT total_price FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000001'$$, ARRAY[500::numeric], '[CURRENT][KNOWN UNSAFE][limpeza][service_orders][select][total_price] directly readable');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000004', 'consegna');
SELECT results_eq($$SELECT total_price FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000001'$$, ARRAY[500::numeric], '[CURRENT][KNOWN UNSAFE][consegna][service_orders][select][total_price] directly readable');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000005', 'cliente');
SELECT results_eq($$SELECT total_price FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000002'$$, ARRAY[600::numeric], '[CURRENT][KNOWN UNSAFE][cliente][service_orders][select][total_price] directly readable');

SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000003', 'limpeza');
SELECT results_eq($$UPDATE public.service_orders SET total_price = 777 WHERE id = '44000000-0000-0000-0000-000000000001' RETURNING total_price$$, ARRAY[777::numeric], '[CURRENT][KNOWN UNSAFE][limpeza][service_orders][update][total_price] directly mutable');

-- Direct privileged calls cannot be used to expand access.
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000001', 'admin');
SELECT throws_ok($$SELECT * FROM public.get_top_properties(current_date, current_date, 1)$$, '42501', NULL, '[CURRENT][admin][rpc][get_top_properties] direct execution blocked');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000002', 'secretaria');
SELECT throws_ok($$SELECT * FROM public.get_top_properties(current_date, current_date, 1)$$, '42501', NULL, '[CURRENT][secretaria][rpc][get_top_properties] direct execution blocked');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000003', 'limpeza');
SELECT throws_ok($$SELECT * FROM public.get_top_properties(current_date, current_date, 1)$$, '42501', NULL, '[CURRENT][limpeza][rpc][get_top_properties] direct execution blocked');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000004', 'consegna');
SELECT throws_ok($$SELECT * FROM public.get_top_properties(current_date, current_date, 1)$$, '42501', NULL, '[CURRENT][consegna][rpc][get_top_properties] direct execution blocked');
SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000005', 'cliente');
SELECT throws_ok($$SELECT * FROM public.get_top_properties(current_date, current_date, 1)$$, '42501', NULL, '[CURRENT][cliente][rpc][get_top_properties] direct execution blocked');

SELECT pg_temp.authenticate_as('11000000-0000-0000-0000-000000000003', 'limpeza');
SELECT results_eq($$SELECT count(*) FROM private.staff_property_ids('11000000-0000-0000-0000-000000000002')$$, ARRAY[0::bigint], '[CURRENT][limpeza][private helper][foreign uid] cannot widen access');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000004')$$, ARRAY[false], '[CURRENT][limpeza][service_orders][select][tomorrow] blocked in Europe/Rome');
SELECT results_eq($$SELECT EXISTS (SELECT 1 FROM public.service_orders WHERE id = '44000000-0000-0000-0000-000000000005')$$, ARRAY[false], '[CURRENT][limpeza][service_orders][select][null cleaning_date] blocked');

SELECT * FROM finish();
ROLLBACK;
