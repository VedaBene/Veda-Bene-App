BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(27);

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

-- Fixture Users & Profiles
INSERT INTO auth.users (id, email)
VALUES
  ('70000000-0000-0000-0000-000000000001', 'admin@atomic.test.invalid'),
  ('70000000-0000-0000-0000-000000000002', 'secretaria@atomic.test.invalid'),
  ('70000000-0000-0000-0000-000000000003', 'limpeza1@atomic.test.invalid'),
  ('70000000-0000-0000-0000-000000000004', 'limpeza2@atomic.test.invalid'),
  ('70000000-0000-0000-0000-000000000005', 'limpeza3@atomic.test.invalid'),
  ('70000000-0000-0000-0000-000000000006', 'consegna@atomic.test.invalid'),
  ('70000000-0000-0000-0000-000000000007', 'cliente@atomic.test.invalid');

UPDATE public.profiles
SET
  full_name = CASE id
    WHEN '70000000-0000-0000-0000-000000000001' THEN 'Atomic Admin'
    WHEN '70000000-0000-0000-0000-000000000002' THEN 'Atomic Secretaria'
    WHEN '70000000-0000-0000-0000-000000000003' THEN 'Atomic Limpeza 1'
    WHEN '70000000-0000-0000-0000-000000000004' THEN 'Atomic Limpeza 2'
    WHEN '70000000-0000-0000-0000-000000000005' THEN 'Atomic Limpeza 3'
    WHEN '70000000-0000-0000-0000-000000000006' THEN 'Atomic Consegna'
    ELSE 'Atomic Cliente'
  END,
  role = CASE id
    WHEN '70000000-0000-0000-0000-000000000001' THEN 'admin'
    WHEN '70000000-0000-0000-0000-000000000002' THEN 'secretaria'
    WHEN '70000000-0000-0000-0000-000000000003' THEN 'limpeza'
    WHEN '70000000-0000-0000-0000-000000000004' THEN 'limpeza'
    WHEN '70000000-0000-0000-0000-000000000005' THEN 'limpeza'
    WHEN '70000000-0000-0000-0000-000000000006' THEN 'consegna'
    ELSE 'cliente'
  END;

-- Fixture Properties
INSERT INTO public.owners (id, name, email)
VALUES ('71000000-0000-0000-0000-000000000001', 'Atomic Owner', 'owner@atomic.test.invalid');

INSERT INTO public.properties (id, name, client_type, owner_id, zone, base_price, extra_per_person)
VALUES
  ('72000000-0000-0000-0000-000000000001', 'Atomic Apartment', 'particular', '71000000-0000-0000-0000-000000000001', 'Other areas', 100.00, 20.00);

-- 1. Schema & function presence
SELECT has_function(
  'public',
  'save_service_order_atomic',
  ARRAY[
    'uuid', 'uuid', 'uuid[]', 'uuid', 'date', 'timestamptz', 'timestamptz',
    'integer', 'integer', 'integer', 'integer', 'integer', 'integer', 'integer',
    'integer', 'integer', 'text', 'text', 'numeric', 'text', 'numeric'
  ],
  'Function public.save_service_order_atomic exists with expected signature'
);

-- 2. Authorization: unauthenticated / missing app_role must fail
SELECT throws_ok(
  $$
    SELECT pg_temp.authenticate_without_app_role('70000000-0000-0000-0000-000000000007');
    SELECT public.save_service_order_atomic(
      p_property_id => '72000000-0000-0000-0000-000000000001'
    );
  $$,
  '42501',
  NULL,
  'Calling save_service_order_atomic without admin/secretaria role is rejected with 42501'
);

-- 3. Authorization: limpeza must fail
SELECT throws_ok(
  $$
    SELECT pg_temp.authenticate_as('70000000-0000-0000-0000-000000000003', 'limpeza');
    SELECT public.save_service_order_atomic(
      p_property_id => '72000000-0000-0000-0000-000000000001'
    );
  $$,
  '42501',
  NULL,
  'Calling save_service_order_atomic as limpeza is rejected with 42501'
);

-- 4. Authorization: consegna must fail
SELECT throws_ok(
  $$
    SELECT pg_temp.authenticate_as('70000000-0000-0000-0000-000000000006', 'consegna');
    SELECT public.save_service_order_atomic(
      p_property_id => '72000000-0000-0000-0000-000000000001'
    );
  $$,
  '42501',
  NULL,
  'Calling save_service_order_atomic as consegna is rejected with 42501'
);

-- 5. Authorization: cliente must fail
SELECT throws_ok(
  $$
    SELECT pg_temp.authenticate_as('70000000-0000-0000-0000-000000000007', 'cliente');
    SELECT public.save_service_order_atomic(
      p_property_id => '72000000-0000-0000-0000-000000000001'
    );
  $$,
  '42501',
  NULL,
  'Calling save_service_order_atomic as cliente is rejected with 42501'
);

-- 6. Creation without staff links (admin)
SELECT pg_temp.authenticate_as('70000000-0000-0000-0000-000000000001', 'admin');

CREATE TEMP TABLE created_order_no_staff AS
SELECT public.save_service_order_atomic(
  p_property_id => '72000000-0000-0000-0000-000000000001',
  p_cleaning_staff_ids => ARRAY[]::UUID[],
  p_cleaning_date => '2026-08-25'::date,
  p_pricing_mode => 'standard',
  p_total_price => 120.00
) AS order_id;

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.service_orders so
    JOIN created_order_no_staff c ON c.order_id = so.id
    WHERE so.status = 'open' AND so.total_price = 120.00 AND so.cleaning_date = '2026-08-25'
  ),
  'Admin creates service order without staff links successfully'
);

SELECT is(
  (SELECT count(*) FROM public.service_order_cleaning_staff WHERE service_order_id = (SELECT order_id FROM created_order_no_staff)),
  0::bigint,
  'Order created without staff has 0 records in service_order_cleaning_staff'
);

-- 7. Creation with 1 staff link (secretaria)
SELECT pg_temp.authenticate_as('70000000-0000-0000-0000-000000000002', 'secretaria');

CREATE TEMP TABLE created_order_1_staff AS
SELECT public.save_service_order_atomic(
  p_property_id => '72000000-0000-0000-0000-000000000001',
  p_cleaning_staff_ids => ARRAY['70000000-0000-0000-0000-000000000003'::uuid],
  p_consegna_staff_id => '70000000-0000-0000-0000-000000000006'::uuid,
  p_cleaning_date => '2026-08-26'::date,
  p_pricing_mode => 'standard',
  p_total_price => 140.00
) AS order_id;

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.service_orders so
    JOIN created_order_1_staff c ON c.order_id = so.id
    WHERE so.consegna_staff_id = '70000000-0000-0000-0000-000000000006'
  ),
  'Secretaria creates service order with 1 staff and consegna successfully'
);

SELECT results_eq(
  $$
    SELECT profile_id
    FROM public.service_order_cleaning_staff
    WHERE service_order_id = (SELECT order_id FROM created_order_1_staff)
  $$,
  $$VALUES ('70000000-0000-0000-0000-000000000003'::uuid)$$,
  'Order has exactly 1 staff link in service_order_cleaning_staff'
);

-- 8. Creation with 3 staff links (admin)
SELECT pg_temp.authenticate_as('70000000-0000-0000-0000-000000000001', 'admin');

CREATE TEMP TABLE created_order_3_staff AS
SELECT public.save_service_order_atomic(
  p_property_id => '72000000-0000-0000-0000-000000000001',
  p_cleaning_staff_ids => ARRAY[
    '70000000-0000-0000-0000-000000000003'::uuid,
    '70000000-0000-0000-0000-000000000004'::uuid,
    '70000000-0000-0000-0000-000000000005'::uuid
  ],
  p_cleaning_date => '2026-08-27'::date,
  p_pricing_mode => 'ripasso',
  p_total_price => 60.00
) AS order_id;

SELECT is(
  (SELECT count(*) FROM public.service_order_cleaning_staff WHERE service_order_id = (SELECT order_id FROM created_order_3_staff)),
  3::bigint,
  'Order created with 3 staff members has exactly 3 rows in service_order_cleaning_staff'
);

-- 9. Validation: more than 3 staff members must fail
SELECT throws_ok(
  $$
    SELECT public.save_service_order_atomic(
      p_property_id => '72000000-0000-0000-0000-000000000001',
      p_cleaning_staff_ids => ARRAY[
        '70000000-0000-0000-0000-000000000003'::uuid,
        '70000000-0000-0000-0000-000000000004'::uuid,
        '70000000-0000-0000-0000-000000000005'::uuid,
        '70000000-0000-0000-0000-000000000006'::uuid
      ]
    );
  $$,
  '22023',
  NULL,
  'Attempting to assign 4 staff members fails with 22023 (max 3)'
);

-- 10. Update: replace staff links (from 3 staff to 2 different staff)
SELECT pg_temp.authenticate_as('70000000-0000-0000-0000-000000000002', 'secretaria');

SELECT is(
  public.save_service_order_atomic(
    p_order_id => (SELECT order_id FROM created_order_3_staff),
    p_property_id => '72000000-0000-0000-0000-000000000001',
    p_cleaning_staff_ids => ARRAY[
      '70000000-0000-0000-0000-000000000004'::uuid,
      '70000000-0000-0000-0000-000000000005'::uuid
    ],
    p_cleaning_date => '2026-08-28'::date,
    p_cleaning_notes => 'Updated notes',
    p_pricing_mode => 'standard',
    p_total_price => 110.00
  ),
  (SELECT order_id FROM created_order_3_staff),
  'Update returns the existing order id'
);

SELECT results_eq(
  $$
    SELECT profile_id
    FROM public.service_order_cleaning_staff
    WHERE service_order_id = (SELECT order_id FROM created_order_3_staff)
    ORDER BY profile_id
  $$,
  $$
    VALUES
      ('70000000-0000-0000-0000-000000000004'::uuid),
      ('70000000-0000-0000-0000-000000000005'::uuid)
  $$,
  'Staff associations were updated to exactly the 2 new staff members'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.service_orders
    WHERE id = (SELECT order_id FROM created_order_3_staff)
      AND cleaning_notes = 'Updated notes'
      AND cleaning_date = '2026-08-28'
      AND total_price = 110.00
  ),
  'Service order fields were updated correctly'
);

-- 11. Update: remove all staff links
SELECT is(
  public.save_service_order_atomic(
    p_order_id => (SELECT order_id FROM created_order_3_staff),
    p_property_id => '72000000-0000-0000-0000-000000000001',
    p_cleaning_staff_ids => ARRAY[]::UUID[],
    p_pricing_mode => 'standard',
    p_total_price => 100.00
  ),
  (SELECT order_id FROM created_order_3_staff),
  'Update with empty staff array succeeds'
);

SELECT is(
  (SELECT count(*) FROM public.service_order_cleaning_staff WHERE service_order_id = (SELECT order_id FROM created_order_3_staff)),
  0::bigint,
  'All staff links were removed on empty array update'
);

-- 12. Validation: invalid property ID throws 23503
SELECT throws_ok(
  $$
    SELECT public.save_service_order_atomic(
      p_property_id => '79999999-9999-9999-9999-999999999999'::uuid
    );
  $$,
  '23503',
  NULL,
  'Invalid property ID throws foreign key error 23503'
);

-- 13. Validation: invalid staff profile ID throws 23503
SELECT throws_ok(
  $$
    SELECT public.save_service_order_atomic(
      p_property_id => '72000000-0000-0000-0000-000000000001',
      p_cleaning_staff_ids => ARRAY['79999999-9999-9999-9999-999999999999'::uuid]
    );
  $$,
  '23503',
  NULL,
  'Invalid staff profile ID throws foreign key error 23503'
);

-- 14. Validation: invalid consegna profile ID throws 23503
SELECT throws_ok(
  $$
    SELECT public.save_service_order_atomic(
      p_property_id => '72000000-0000-0000-0000-000000000001',
      p_consegna_staff_id => '79999999-9999-9999-9999-999999999999'::uuid
    );
  $$,
  '23503',
  NULL,
  'Invalid consegna profile ID throws foreign key error 23503'
);

-- 15. Validation: missing property ID throws 22023
SELECT throws_ok(
  $$
    SELECT public.save_service_order_atomic(p_property_id => NULL);
  $$,
  '22023',
  NULL,
  'NULL property ID throws error 22023'
);

-- 16. Validation: invalid pricing mode throws 22023
SELECT throws_ok(
  $$
    SELECT public.save_service_order_atomic(
      p_property_id => '72000000-0000-0000-0000-000000000001',
      p_pricing_mode => 'invalid_mode'
    );
  $$,
  '22023',
  NULL,
  'Invalid pricing mode throws error 22023'
);

-- 17. Validation: negative bed counts throw 22023
SELECT throws_ok(
  $$
    SELECT public.save_service_order_atomic(
      p_property_id => '72000000-0000-0000-0000-000000000001',
      p_double_beds => -1
    );
  $$,
  '22023',
  NULL,
  'Negative double_beds count throws error 22023'
);

-- 18. Fault Injection / Atomicity: failure during staff insertion rolls back order creation
CREATE TEMP TABLE count_before AS
SELECT
  (SELECT count(*) FROM public.service_orders) AS so_count,
  (SELECT count(*) FROM public.service_order_cleaning_staff) AS socs_count;

DO $fault_injection$
BEGIN
  -- Attempt to insert an order with 1 valid staff and 1 invalid staff
  PERFORM public.save_service_order_atomic(
    p_property_id => '72000000-0000-0000-0000-000000000001',
    p_cleaning_staff_ids => ARRAY[
      '70000000-0000-0000-0000-000000000003'::uuid,
      '79999999-9999-9999-9999-999999999999'::uuid
    ]
  );
EXCEPTION WHEN OTHERS THEN
  -- Exception expected
  NULL;
END
$fault_injection$;

SELECT is(
  (SELECT count(*) FROM public.service_orders),
  (SELECT so_count FROM count_before),
  'Failed call left zero partial rows in service_orders'
);

SELECT is(
  (SELECT count(*) FROM public.service_order_cleaning_staff),
  (SELECT socs_count FROM count_before),
  'Failed call left zero partial rows in service_order_cleaning_staff'
);

-- 19. Deduplication in staff IDs array
CREATE TEMP TABLE created_order_dedup AS
SELECT public.save_service_order_atomic(
  p_property_id => '72000000-0000-0000-0000-000000000001',
  p_cleaning_staff_ids => ARRAY[
    '70000000-0000-0000-0000-000000000003'::uuid,
    '70000000-0000-0000-0000-000000000003'::uuid
  ]
) AS order_id;

SELECT is(
  (SELECT count(*) FROM public.service_order_cleaning_staff WHERE service_order_id = (SELECT order_id FROM created_order_dedup)),
  1::bigint,
  'Duplicate staff IDs in array are deduplicated cleanly to 1 row'
);

-- 20. Non-existent order ID on update throws P0002
SELECT throws_ok(
  $$
    SELECT public.save_service_order_atomic(
      p_order_id => '78888888-8888-8888-8888-888888888888'::uuid,
      p_property_id => '72000000-0000-0000-0000-000000000001'
    );
  $$,
  'P0002',
  NULL,
  'Updating non-existent order throws P0002'
);

-- 21. Security grant: anon cannot execute save_service_order_atomic directly
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$
    SELECT public.save_service_order_atomic(
      p_property_id => '72000000-0000-0000-0000-000000000001'
    );
  $$,
  '42501',
  NULL,
  'Role anon cannot execute public.save_service_order_atomic (permission denied)'
);
RESET ROLE;

-- Clean up fixture records
DELETE FROM public.service_orders
WHERE property_id = '72000000-0000-0000-0000-000000000001';

DELETE FROM public.properties
WHERE id = '72000000-0000-0000-0000-000000000001';

DELETE FROM public.owners
WHERE id = '71000000-0000-0000-0000-000000000001';

DELETE FROM auth.users
WHERE id IN (
  '70000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000002',
  '70000000-0000-0000-0000-000000000003',
  '70000000-0000-0000-0000-000000000004',
  '70000000-0000-0000-0000-000000000005',
  '70000000-0000-0000-0000-000000000006',
  '70000000-0000-0000-0000-000000000007'
);

SELECT * FROM finish();
ROLLBACK;
