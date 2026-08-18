BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(46);

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

CREATE FUNCTION pg_temp.authenticate_without_app_role(user_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  SELECT set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', user_id, 'role', 'authenticated')::text,
    true
  );
$$;

INSERT INTO auth.users (id, email)
VALUES
  ('60000000-0000-0000-0000-000000000001', 'admin@guard.example.invalid'),
  ('60000000-0000-0000-0000-000000000002', 'secretaria@guard.example.invalid'),
  ('60000000-0000-0000-0000-000000000003', 'limpeza@guard.example.invalid'),
  ('60000000-0000-0000-0000-000000000004', 'consegna@guard.example.invalid'),
  ('60000000-0000-0000-0000-000000000005', 'cliente@guard.example.invalid');

UPDATE public.profiles
SET
  full_name = CASE id
    WHEN '60000000-0000-0000-0000-000000000001' THEN 'Guard Admin'
    WHEN '60000000-0000-0000-0000-000000000002' THEN 'Guard Secretaria'
    WHEN '60000000-0000-0000-0000-000000000003' THEN 'Guard Limpeza'
    WHEN '60000000-0000-0000-0000-000000000004' THEN 'Guard Consegna'
    ELSE 'Guard Cliente'
  END,
  role = CASE id
    WHEN '60000000-0000-0000-0000-000000000001' THEN 'admin'
    WHEN '60000000-0000-0000-0000-000000000002' THEN 'secretaria'
    WHEN '60000000-0000-0000-0000-000000000003' THEN 'limpeza'
    WHEN '60000000-0000-0000-0000-000000000004' THEN 'consegna'
    ELSE 'cliente'
  END;

INSERT INTO public.owners (id, name, email)
VALUES
  ('61000000-0000-0000-0000-000000000001', 'Guard Client Owner', 'cliente@guard.example.invalid'),
  ('61000000-0000-0000-0000-000000000002', 'Guard Other Owner', 'other@guard.example.invalid');

INSERT INTO public.properties (id, name, client_type, owner_id, zone)
VALUES
  ('62000000-0000-0000-0000-000000000001', 'Guard Client Property', 'particular', '61000000-0000-0000-0000-000000000001', 'Other areas'),
  ('62000000-0000-0000-0000-000000000002', 'Guard Operational Property', 'particular', '61000000-0000-0000-0000-000000000002', 'Other areas'),
  ('62000000-0000-0000-0000-000000000003', 'Guard Alternate Property', 'particular', '61000000-0000-0000-0000-000000000002', 'Other areas');

INSERT INTO public.service_orders (
  id, property_id, consegna_staff_id, cleaning_date, checkout_at, checkin_at,
  status, started_at, completed_at, completion_notes, total_price, pricing_mode,
  extra_services_price, cleaning_cycle
)
VALUES
  ('63000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000002', NULL, (timezone('Europe/Rome', now()))::date, now() - interval '3 hours', now() + interval '1 hour', 'open', NULL, NULL, NULL, 101, 'standard', 0, 1),
  ('63000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000002', NULL, (timezone('Europe/Rome', now()))::date, now() - interval '3 hours', now() + interval '1 hour', 'open', NULL, NULL, NULL, 102, 'standard', 0, 1),
  ('63000000-0000-0000-0000-000000000003', '62000000-0000-0000-0000-000000000002', NULL, (timezone('Europe/Rome', now()))::date, now() - interval '3 hours', now() + interval '1 hour', 'open', NULL, NULL, NULL, 103, 'standard', 0, 1),
  ('63000000-0000-0000-0000-000000000004', '62000000-0000-0000-0000-000000000002', NULL, (timezone('Europe/Rome', now()))::date, now() - interval '3 hours', now() + interval '1 hour', 'in_progress', statement_timestamp() - interval '65 minutes', NULL, NULL, 104, 'out_long_stay', 5, 1),
  ('63000000-0000-0000-0000-000000000005', '62000000-0000-0000-0000-000000000002', NULL, (timezone('Europe/Rome', now()))::date, now() - interval '3 hours', now() + interval '1 hour', 'open', NULL, NULL, NULL, 500, 'standard', 0, 1),
  ('63000000-0000-0000-0000-000000000006', '62000000-0000-0000-0000-000000000003', NULL, (timezone('Europe/Rome', now()))::date, now() - interval '3 hours', now() + interval '1 hour', 'open', NULL, NULL, NULL, 106, 'standard', 0, 1),
  ('63000000-0000-0000-0000-000000000007', '62000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000004', (timezone('Europe/Rome', now()))::date, now() - interval '3 hours', now() + interval '1 hour', 'open', NULL, NULL, NULL, 107, 'standard', 0, 1),
  ('63000000-0000-0000-0000-000000000008', '62000000-0000-0000-0000-000000000001', NULL, (timezone('Europe/Rome', now()))::date, now() - interval '3 hours', now() + interval '1 hour', 'open', NULL, NULL, NULL, 108, 'standard', 0, 1),
  ('63000000-0000-0000-0000-000000000009', '62000000-0000-0000-0000-000000000002', NULL, (timezone('Europe/Rome', now()))::date, now() - interval '4 hours', now() - interval '1 hour', 'done', now() - interval '3 hours', now() - interval '2 hours', 'old cycle', 109, 'standard', 0, 1),
  ('63000000-0000-0000-0000-000000000010', '62000000-0000-0000-0000-000000000002', NULL, (timezone('Europe/Rome', now()))::date, now() - interval '3 hours', now() + interval '1 hour', 'open', NULL, NULL, NULL, 110, 'standard', 0, 1);

INSERT INTO public.service_order_cleaning_staff (service_order_id, profile_id)
VALUES
  ('63000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003'),
  ('63000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000003'),
  ('63000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000003'),
  ('63000000-0000-0000-0000-000000000009', '60000000-0000-0000-0000-000000000003');

INSERT INTO public.service_order_photos (
  id, service_order_id, cycle_no, phase, status, content_type, display_path,
  thumbnail_path, uploaded_by, sort_order, width, height, display_size_bytes,
  thumbnail_size_bytes, ready_at
)
VALUES (
  '64000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000009',
  1,
  'before',
  'ready',
  'image/webp',
  'guard/before/display.webp',
  'guard/before/thumb.webp',
  '60000000-0000-0000-0000-000000000001',
  0,
  1600,
  1200,
  150000,
  12000,
  statement_timestamp()
);

CREATE TEMP TABLE guard_invariants AS
SELECT
  (SELECT count(*) FROM public.service_orders) AS order_count,
  (SELECT array_agg(id ORDER BY id) FROM public.service_orders) AS order_ids,
  (SELECT array_agg(order_number ORDER BY order_number) FROM public.service_orders) AS order_numbers,
  (SELECT md5(coalesce(string_agg(md5(to_jsonb(assignments)::text), '' ORDER BY service_order_id, profile_id), ''))
   FROM public.service_order_cleaning_staff AS assignments) AS assignment_digest,
  (SELECT md5(coalesce(string_agg(md5(to_jsonb(photos)::text), '' ORDER BY id), ''))
   FROM public.service_order_photos AS photos) AS photo_digest,
  (SELECT md5(coalesce(string_agg(grantee || ':' || privilege_type || ':' || is_grantable, ',' ORDER BY grantee, privilege_type), ''))
   FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name = 'service_orders'
     AND privilege_type = 'SELECT') AS select_grant_digest;

-- Function, trigger and privilege contract.
SELECT has_function('private', 'guard_service_order_update', ARRAY[]::text[], '[SPRINT 04][schema] guard function exists');
SELECT has_trigger('public', 'service_orders', 'guard_service_order_updates', '[SPRINT 04][schema] guard trigger exists');
SELECT results_eq(
  $$SELECT NOT procedure.prosecdef FROM pg_catalog.pg_proc AS procedure JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace WHERE namespace.nspname = 'private' AND procedure.proname = 'guard_service_order_update'$$,
  ARRAY[true],
  '[SPRINT 04][schema] guard is SECURITY INVOKER'
);
SELECT results_eq(
  $$SELECT pg_catalog.pg_get_functiondef(procedure.oid) LIKE '%SET search_path TO ''''%' FROM pg_catalog.pg_proc AS procedure JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace WHERE namespace.nspname = 'private' AND procedure.proname = 'guard_service_order_update'$$,
  ARRAY[true],
  '[SPRINT 04][schema] guard has empty search_path'
);
SELECT ok(NOT has_function_privilege('public', 'private.guard_service_order_update()', 'EXECUTE'), '[SPRINT 04][grants] PUBLIC cannot execute guard directly');
SELECT ok(NOT has_function_privilege('anon', 'private.guard_service_order_update()', 'EXECUTE'), '[SPRINT 04][grants] anon cannot execute guard directly');
SELECT ok(NOT has_function_privilege('authenticated', 'private.guard_service_order_update()', 'EXECUTE'), '[SPRINT 04][grants] authenticated cannot execute guard directly');
SELECT ok(NOT has_function_privilege('service_role', 'private.guard_service_order_update()', 'EXECUTE'), '[SPRINT 04][grants] service_role cannot execute guard directly');

SET LOCAL ROLE authenticated;

-- Administrative creation, edition and cancellation remain unchanged.
SELECT pg_temp.authenticate_as('60000000-0000-0000-0000-000000000001', 'admin');
SELECT results_eq(
  $$INSERT INTO public.service_orders (id, property_id, cleaning_date, status, total_price) VALUES ('63000000-0000-0000-0000-000000000011', '62000000-0000-0000-0000-000000000002', (timezone('Europe/Rome', now()))::date, 'open', 111) RETURNING id$$,
  ARRAY['63000000-0000-0000-0000-000000000011'::uuid],
  '[SPRINT 04][admin][create] administrative creation remains allowed'
);
SELECT results_eq(
  $$UPDATE public.service_orders SET real_guests = 4, pricing_mode = 'ripasso', total_price = 222 WHERE id = '63000000-0000-0000-0000-000000000001' RETURNING id$$,
  ARRAY['63000000-0000-0000-0000-000000000001'::uuid],
  '[SPRINT 04][admin][update] administrative fields remain allowed'
);
SELECT results_eq(
  $$DELETE FROM public.service_orders WHERE id = '63000000-0000-0000-0000-000000000011' RETURNING id$$,
  ARRAY['63000000-0000-0000-0000-000000000011'::uuid],
  '[SPRINT 04][admin][cancel] authorized deletion remains allowed'
);

SELECT pg_temp.authenticate_as('60000000-0000-0000-0000-000000000002', 'secretaria');
SELECT results_eq(
  $$UPDATE public.service_orders SET cleaning_date = (timezone('Europe/Rome', now()))::date + 2, extra_services_description = 'authorized', extra_services_price = 12, pricing_mode = 'ripasso', total_price = 212 WHERE id = '63000000-0000-0000-0000-000000000002' RETURNING id$$,
  ARRAY['63000000-0000-0000-0000-000000000002'::uuid],
  '[SPRINT 04][secretaria][update] current administrative contract remains allowed'
);

-- Legitimate Pulizia tracking transitions and no-op.
SELECT pg_temp.authenticate_as('60000000-0000-0000-0000-000000000003', 'limpeza');
SELECT results_eq(
  $$UPDATE public.service_orders SET status = 'in_progress', started_at = statement_timestamp() WHERE id = '63000000-0000-0000-0000-000000000003' RETURNING id$$,
  ARRAY['63000000-0000-0000-0000-000000000003'::uuid],
  '[SPRINT 04][limpeza][tracking][start] assigned order starts legitimately'
);
SELECT results_eq(
  $$SELECT status = 'in_progress' AND started_at IS NOT NULL AND completed_at IS NULL FROM public.service_orders WHERE id = '63000000-0000-0000-0000-000000000003'$$,
  ARRAY[true],
  '[SPRINT 04][limpeza][tracking][start] start timestamp is persisted'
);
SELECT results_eq(
  $$UPDATE public.service_orders SET status = 'done', completed_at = statement_timestamp(), completion_notes = 'completed safely' WHERE id = '63000000-0000-0000-0000-000000000004' RETURNING id$$,
  ARRAY['63000000-0000-0000-0000-000000000004'::uuid],
  '[SPRINT 04][limpeza][tracking][finish] assigned order finishes legitimately'
);
SELECT results_eq(
  $$SELECT status = 'done' AND completed_at IS NOT NULL AND completion_notes = 'completed safely' AND worked_minutes BETWEEN 64 AND 66 FROM public.service_orders WHERE id = '63000000-0000-0000-0000-000000000004'$$,
  ARRAY[true],
  '[SPRINT 04][limpeza][tracking][finish] generated worked minutes remain functional'
);
SELECT results_eq(
  $$UPDATE public.service_orders SET status = status WHERE id = '63000000-0000-0000-0000-000000000005' RETURNING id$$,
  ARRAY['63000000-0000-0000-0000-000000000005'::uuid],
  '[SPRINT 04][limpeza][noop] unchanged writable columns are not rejected'
);

-- Reopening, cycle history and photos remain administrative concerns.
SELECT pg_temp.authenticate_as('60000000-0000-0000-0000-000000000001', 'admin');
SELECT results_eq(
  $$UPDATE public.service_orders SET status = 'open', started_at = NULL, completed_at = NULL, completion_notes = NULL, cleaning_cycle = 2 WHERE id = '63000000-0000-0000-0000-000000000009' RETURNING id$$,
  ARRAY['63000000-0000-0000-0000-000000000009'::uuid],
  '[SPRINT 04][admin][reopen] administrative reopen remains allowed'
);
SELECT results_eq(
  $$SELECT cleaning_cycle FROM public.service_orders WHERE id = '63000000-0000-0000-0000-000000000009'$$,
  ARRAY[2],
  '[SPRINT 04][photos][cycle] cleaning cycle increments normally'
);
SELECT results_eq(
  $$SELECT count(*) FROM public.service_order_photos WHERE id = '64000000-0000-0000-0000-000000000001' AND cycle_no = 1$$,
  ARRAY[1::bigint],
  '[SPRINT 04][photos][history] prior-cycle photo metadata is preserved'
);

-- The narrow server-only seam uses service_role only for total_price.
RESET ROLE;
SELECT pg_temp.authenticate_as('60000000-0000-0000-0000-000000000003', 'service_role');
SET LOCAL ROLE service_role;
SELECT results_eq(
  $$UPDATE public.service_orders SET total_price = 310 WHERE id = '63000000-0000-0000-0000-000000000010' RETURNING id$$,
  ARRAY['63000000-0000-0000-0000-000000000010'::uuid],
  '[SPRINT 04][server seam][pricing] technical service_role can persist recalculated total'
);
RESET ROLE;
SET LOCAL ROLE authenticated;

-- Direct negative mutations by Pulizia.
SELECT pg_temp.authenticate_as('60000000-0000-0000-0000-000000000003', 'limpeza');
SELECT throws_ok($$UPDATE public.service_orders SET total_price = 999 WHERE id = '63000000-0000-0000-0000-000000000005'$$, '42501', 'Aggiornamento O.L. non autorizzato.', '[SPRINT 04][limpeza][negative] price change blocked');
SELECT throws_ok($$UPDATE public.service_orders SET pricing_mode = 'ripasso' WHERE id = '63000000-0000-0000-0000-000000000005'$$, '42501', 'Aggiornamento O.L. non autorizzato.', '[SPRINT 04][limpeza][negative] pricing mode change blocked');
SELECT throws_ok($$UPDATE public.service_orders SET property_id = '62000000-0000-0000-0000-000000000003' WHERE id = '63000000-0000-0000-0000-000000000005'$$, '42501', 'Aggiornamento O.L. non autorizzato.', '[SPRINT 04][limpeza][negative] ownership change blocked');
SELECT throws_ok($$UPDATE public.service_orders SET consegna_staff_id = '60000000-0000-0000-0000-000000000004' WHERE id = '63000000-0000-0000-0000-000000000005'$$, '42501', 'Aggiornamento O.L. non autorizzato.', '[SPRINT 04][limpeza][negative] consegna assignment change blocked');
SELECT results_eq(
  $$DELETE FROM public.service_order_cleaning_staff WHERE service_order_id = '63000000-0000-0000-0000-000000000005' RETURNING service_order_id$$,
  ARRAY[]::uuid[],
  '[SPRINT 04][limpeza][negative] cleaning assignment relation remains protected by RLS'
);
SELECT throws_ok($$UPDATE public.service_orders SET cleaning_date = (timezone('Europe/Rome', now()))::date + 1 WHERE id = '63000000-0000-0000-0000-000000000005'$$, '42501', 'Aggiornamento O.L. non autorizzato.', '[SPRINT 04][limpeza][negative] administrative date change blocked');
SELECT throws_ok($$UPDATE public.service_orders SET cleaning_notes = 'forged' WHERE id = '63000000-0000-0000-0000-000000000005'$$, '42501', 'Aggiornamento O.L. non autorizzato.', '[SPRINT 04][limpeza][negative] non-tracking field change blocked');
SELECT throws_ok($$UPDATE public.service_orders SET extra_services_price = 40 WHERE id = '63000000-0000-0000-0000-000000000005'$$, '42501', 'Aggiornamento O.L. non autorizzato.', '[SPRINT 04][limpeza][negative] extras change blocked');
SELECT throws_ok($$UPDATE public.service_orders SET status = 'in_progress', started_at = statement_timestamp() - interval '1 day' WHERE id = '63000000-0000-0000-0000-000000000005'$$, '42501', 'Aggiornamento O.L. non autorizzato.', '[SPRINT 04][limpeza][negative] forged start timestamp blocked');
SELECT throws_ok($$UPDATE public.service_orders SET completed_at = statement_timestamp() WHERE id = '63000000-0000-0000-0000-000000000005'$$, '42501', 'Aggiornamento O.L. non autorizzato.', '[SPRINT 04][limpeza][negative] forged completion timestamp blocked');
SELECT throws_ok($$UPDATE public.service_orders SET status = 'done', completed_at = statement_timestamp() WHERE id = '63000000-0000-0000-0000-000000000005'$$, '42501', 'Aggiornamento O.L. non autorizzato.', '[SPRINT 04][limpeza][negative] skipped status transition blocked');
SELECT throws_ok($$UPDATE public.service_orders SET cleaning_cycle = 2 WHERE id = '63000000-0000-0000-0000-000000000005'$$, '42501', 'Aggiornamento O.L. non autorizzato.', '[SPRINT 04][limpeza][negative] cleaning cycle change blocked');

-- Row scope and read-only roles remain governed by RLS.
SELECT results_eq(
  $$UPDATE public.service_orders SET status = 'in_progress', started_at = statement_timestamp() WHERE id = '63000000-0000-0000-0000-000000000006' RETURNING id$$,
  ARRAY[]::uuid[],
  '[SPRINT 04][limpeza][negative] unassigned order remains blocked by RLS'
);
SELECT pg_temp.authenticate_as('60000000-0000-0000-0000-000000000004', 'consegna');
SELECT results_eq($$UPDATE public.service_orders SET status = status WHERE id = '63000000-0000-0000-0000-000000000007' RETURNING id$$, ARRAY[]::uuid[], '[SPRINT 04][consegna][negative] every update remains blocked');
SELECT pg_temp.authenticate_as('60000000-0000-0000-0000-000000000005', 'cliente');
SELECT results_eq($$UPDATE public.service_orders SET status = status WHERE id = '63000000-0000-0000-0000-000000000008' RETURNING id$$, ARRAY[]::uuid[], '[SPRINT 04][cliente][negative] every update remains blocked');
SELECT pg_temp.authenticate_as('60000000-0000-0000-0000-000000000003', 'invalid-role');
SELECT results_eq($$UPDATE public.service_orders SET status = status WHERE id = '63000000-0000-0000-0000-000000000005' RETURNING id$$, ARRAY[]::uuid[], '[SPRINT 04][invalid role][negative] invalid app role remains blocked');
SELECT pg_temp.authenticate_without_app_role('60000000-0000-0000-0000-000000000003');
SELECT results_eq($$UPDATE public.service_orders SET status = status WHERE id = '63000000-0000-0000-0000-000000000005' RETURNING id$$, ARRAY[]::uuid[], '[SPRINT 04][missing role][negative] missing app role remains blocked');

RESET ROLE;

-- Data, relations, photos, Storage-facing grants and policies are preserved.
SELECT results_eq($$SELECT count(*) FROM public.service_orders$$, $$SELECT order_count FROM guard_invariants$$, '[SPRINT 04][invariant] service-order row count is unchanged');
SELECT results_eq($$SELECT array_agg(id ORDER BY id) FROM public.service_orders$$, $$SELECT order_ids FROM guard_invariants$$, '[SPRINT 04][invariant] service-order ids are unchanged');
SELECT results_eq($$SELECT array_agg(order_number ORDER BY order_number) FROM public.service_orders$$, $$SELECT order_numbers FROM guard_invariants$$, '[SPRINT 04][invariant] order numbers are unchanged');
SELECT results_eq(
  $$SELECT md5(coalesce(string_agg(md5(to_jsonb(assignments)::text), '' ORDER BY service_order_id, profile_id), '')) FROM public.service_order_cleaning_staff AS assignments$$,
  $$SELECT assignment_digest FROM guard_invariants$$,
  '[SPRINT 04][invariant] cleaning-team relations are unchanged'
);
SELECT results_eq(
  $$SELECT md5(coalesce(string_agg(md5(to_jsonb(photos)::text), '' ORDER BY id), '')) FROM public.service_order_photos AS photos$$,
  $$SELECT photo_digest FROM guard_invariants$$,
  '[SPRINT 04][invariant] photo records are unchanged'
);
SELECT results_eq(
  $$SELECT md5(coalesce(string_agg(grantee || ':' || privilege_type || ':' || is_grantable, ',' ORDER BY grantee, privilege_type), '')) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'service_orders' AND privilege_type = 'SELECT'$$,
  $$SELECT select_grant_digest FROM guard_invariants$$,
  '[SPRINT 04][invariant] SELECT grants remain untouched before Sprint 05'
);
SELECT results_eq(
  $$SELECT string_agg(policyname, ',' ORDER BY policyname) COLLATE "C" = 'service_orders_admin_secretaria_update,service_orders_limpeza_update' COLLATE "C" FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'service_orders' AND cmd = 'UPDATE'$$,
  ARRAY[true],
  '[SPRINT 04][invariant] UPDATE policies remain unchanged'
);
SELECT results_eq(
  $$SELECT total_price = 500 AND pricing_mode = 'standard' AND property_id = '62000000-0000-0000-0000-000000000002'::uuid AND cleaning_date = (timezone('Europe/Rome', now()))::date AND cleaning_cycle = 1 FROM public.service_orders WHERE id = '63000000-0000-0000-0000-000000000005'$$,
  ARRAY[true],
  '[SPRINT 04][invariant] rejected mutations changed no protected value'
);

SELECT * FROM finish();
ROLLBACK;
