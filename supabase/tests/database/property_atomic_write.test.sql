BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(34);

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
  ('80000000-0000-0000-0000-000000000001', 'admin@prop-atomic.test.invalid'),
  ('80000000-0000-0000-0000-000000000002', 'secretaria@prop-atomic.test.invalid'),
  ('80000000-0000-0000-0000-000000000003', 'limpeza@prop-atomic.test.invalid'),
  ('80000000-0000-0000-0000-000000000004', 'consegna@prop-atomic.test.invalid'),
  ('80000000-0000-0000-0000-000000000005', 'cliente@prop-atomic.test.invalid');

UPDATE public.profiles
SET
  full_name = CASE id
    WHEN '80000000-0000-0000-0000-000000000001' THEN 'Prop Admin'
    WHEN '80000000-0000-0000-0000-000000000002' THEN 'Prop Secretaria'
    WHEN '80000000-0000-0000-0000-000000000003' THEN 'Prop Limpeza'
    WHEN '80000000-0000-0000-0000-000000000004' THEN 'Prop Consegna'
    ELSE 'Prop Cliente'
  END,
  role = CASE id
    WHEN '80000000-0000-0000-0000-000000000001' THEN 'admin'
    WHEN '80000000-0000-0000-0000-000000000002' THEN 'secretaria'
    WHEN '80000000-0000-0000-0000-000000000003' THEN 'limpeza'
    WHEN '80000000-0000-0000-0000-000000000004' THEN 'consegna'
    ELSE 'cliente'
  END;

-- Fixture existing Agency and Owner
INSERT INTO public.agencies (id, name, email)
VALUES
  ('81000000-0000-0000-0000-000000000001', 'Existing Agency Has Email', 'agency.existing@atomic.test.invalid'),
  ('81000000-0000-0000-0000-000000000002', 'Existing Agency No Email', NULL);

INSERT INTO public.owners (id, name, email)
VALUES
  ('82000000-0000-0000-0000-000000000001', 'Existing Owner Has Email', 'owner.existing@atomic.test.invalid'),
  ('82000000-0000-0000-0000-000000000002', 'Existing Owner No Email', NULL);

-- 1. Schema & function presence
SELECT has_function(
  'public',
  'save_property_atomic',
  ARRAY[
    'uuid', 'text', 'text', 'text', 'text', 'text', 'text', 'text',
    'uuid', 'text', 'text', 'text', 'uuid', 'text', 'text', 'text',
    'numeric', 'numeric', 'numeric', 'integer', 'integer', 'integer',
    'integer', 'integer', 'integer', 'integer', 'integer', 'integer',
    'integer', 'numeric', 'numeric', 'numeric', 'text'
  ],
  'Function public.save_property_atomic exists with expected signature'
);

-- 2. Authorization: unauthenticated / missing app_role must fail
SELECT throws_ok(
  $$
    SELECT pg_temp.authenticate_without_app_role('80000000-0000-0000-0000-000000000005');
    SELECT public.save_property_atomic(
      p_name => 'Unauthorized Property',
      p_client_type => 'particular',
      p_zone => 'Colosseum',
      p_new_owner_name => 'Some Owner'
    );
  $$,
  '42501',
  NULL,
  'Calling save_property_atomic without admin role is rejected with 42501'
);

-- 3. Authorization: secretaria must fail
SELECT throws_ok(
  $$
    SELECT pg_temp.authenticate_as('80000000-0000-0000-0000-000000000002', 'secretaria');
    SELECT public.save_property_atomic(
      p_name => 'Secretaria Property',
      p_client_type => 'particular',
      p_zone => 'Colosseum',
      p_new_owner_name => 'Some Owner'
    );
  $$,
  '42501',
  NULL,
  'Calling save_property_atomic as secretaria is rejected with 42501'
);

-- 4. Authorization: limpeza must fail
SELECT throws_ok(
  $$
    SELECT pg_temp.authenticate_as('80000000-0000-0000-0000-000000000003', 'limpeza');
    SELECT public.save_property_atomic(
      p_name => 'Limpeza Property',
      p_client_type => 'particular',
      p_zone => 'Colosseum',
      p_new_owner_name => 'Some Owner'
    );
  $$,
  '42501',
  NULL,
  'Calling save_property_atomic as limpeza is rejected with 42501'
);

-- 5. Authorization: consegna must fail
SELECT throws_ok(
  $$
    SELECT pg_temp.authenticate_as('80000000-0000-0000-0000-000000000004', 'consegna');
    SELECT public.save_property_atomic(
      p_name => 'Consegna Property',
      p_client_type => 'particular',
      p_zone => 'Colosseum',
      p_new_owner_name => 'Some Owner'
    );
  $$,
  '42501',
  NULL,
  'Calling save_property_atomic as consegna is rejected with 42501'
);

-- 6. Authorization: cliente must fail
SELECT throws_ok(
  $$
    SELECT pg_temp.authenticate_as('80000000-0000-0000-0000-000000000005', 'cliente');
    SELECT public.save_property_atomic(
      p_name => 'Cliente Property',
      p_client_type => 'particular',
      p_zone => 'Colosseum',
      p_new_owner_name => 'Some Owner'
    );
  $$,
  '42501',
  NULL,
  'Calling save_property_atomic as cliente is rejected with 42501'
);

-- Authenticate as admin for write tests
SELECT pg_temp.authenticate_as('80000000-0000-0000-0000-000000000001', 'admin');

-- 7. Creation B2B with new agency (admin)
CREATE TEMP TABLE created_b2b_new_agency AS
SELECT public.save_property_atomic(
  p_name => 'B2B Navona Suite',
  p_client_type => 'rental',
  p_zone => 'Piazza Navona',
  p_new_agency_name => 'New Navona Agency',
  p_new_agency_email => 'contact@navonaagency.it',
  p_phone => '+39 06 999888',
  p_address => 'Piazza Navona 42',
  p_zip_code => '00186',
  p_sqm_interior => 90.5,
  p_double_beds => 2,
  p_bathrooms => 2,
  p_base_price => 150.00,
  p_extra_per_person => 25.00
) AS property_id;

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.properties p
    JOIN public.agencies a ON a.id = p.agency_id
    WHERE p.id = (SELECT property_id FROM created_b2b_new_agency)
      AND p.name = 'B2B Navona Suite'
      AND p.client_type = 'rental'
      AND p.owner_id IS NULL
      AND a.name = 'New Navona Agency'
      AND a.email = 'contact@navonaagency.it'
  ),
  'Admin creates B2B property with new agency atomically'
);

-- 8. Creation B2B with existing agency
CREATE TEMP TABLE created_b2b_existing_agency AS
SELECT public.save_property_atomic(
  p_name => 'B2B Colosseum Suite',
  p_client_type => 'rental',
  p_zone => 'Colosseum',
  p_agency_id => '81000000-0000-0000-0000-000000000001',
  p_base_price => 130.00
) AS property_id;

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = (SELECT property_id FROM created_b2b_existing_agency)
      AND p.agency_id = '81000000-0000-0000-0000-000000000001'
      AND p.owner_id IS NULL
      AND p.client_type = 'rental'
  ),
  'Admin creates B2B property linked to existing agency'
);

-- 9. Creation B2C with new owner
CREATE TEMP TABLE created_b2c_new_owner AS
SELECT public.save_property_atomic(
  p_name => 'B2C Trastevere Flat',
  p_client_type => 'particular',
  p_zone => 'Trastevere Area',
  p_new_owner_name => 'Giuseppe Verdi',
  p_new_owner_email => 'giuseppe.verdi@opera.it',
  p_double_beds => 1,
  p_bathrooms => 1
) AS property_id;

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.properties p
    JOIN public.owners o ON o.id = p.owner_id
    WHERE p.id = (SELECT property_id FROM created_b2c_new_owner)
      AND p.name = 'B2C Trastevere Flat'
      AND p.client_type = 'particular'
      AND p.agency_id IS NULL
      AND o.name = 'Giuseppe Verdi'
      AND o.email = 'giuseppe.verdi@opera.it'
  ),
  'Admin creates B2C property with new owner atomically'
);

-- 10. Creation B2C with existing owner
CREATE TEMP TABLE created_b2c_existing_owner AS
SELECT public.save_property_atomic(
  p_name => 'B2C Spanish Steps Loft',
  p_client_type => 'particular',
  p_zone => 'Spanish Steps',
  p_owner_id => '82000000-0000-0000-0000-000000000001'
) AS property_id;

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = (SELECT property_id FROM created_b2c_existing_owner)
      AND p.owner_id = '82000000-0000-0000-0000-000000000001'
      AND p.agency_id IS NULL
      AND p.client_type = 'particular'
  ),
  'Admin creates B2C property linked to existing owner'
);

-- 11. Update: switch from rental to particular (with new owner)
SELECT is(
  public.save_property_atomic(
    p_property_id => (SELECT property_id FROM created_b2b_new_agency),
    p_name => 'Navona Suite Switched to Particular',
    p_client_type => 'particular',
    p_zone => 'Piazza Navona',
    p_new_owner_name => 'Marco Aurelio',
    p_new_owner_email => 'marco.aurelio@roma.it'
  ),
  (SELECT property_id FROM created_b2b_new_agency),
  'Switching property from rental to particular returns property ID'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.properties p
    JOIN public.owners o ON o.id = p.owner_id
    WHERE p.id = (SELECT property_id FROM created_b2b_new_agency)
      AND p.client_type = 'particular'
      AND p.agency_id IS NULL
      AND o.name = 'Marco Aurelio'
  ),
  'Property was successfully converted to particular with owner assigned and agency_id set to NULL'
);

-- 12. Update: switch from particular to rental (with existing agency)
SELECT is(
  public.save_property_atomic(
    p_property_id => (SELECT property_id FROM created_b2c_new_owner),
    p_name => 'Trastevere Flat Switched to Rental',
    p_client_type => 'rental',
    p_zone => 'Trastevere Area',
    p_agency_id => '81000000-0000-0000-0000-000000000001'
  ),
  (SELECT property_id FROM created_b2c_new_owner),
  'Switching property from particular to rental returns property ID'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = (SELECT property_id FROM created_b2c_new_owner)
      AND p.client_type = 'rental'
      AND p.owner_id IS NULL
      AND p.agency_id = '81000000-0000-0000-0000-000000000001'
  ),
  'Property was converted to rental with agency assigned and owner_id set to NULL'
);

-- 13. Update: update existing agency email when email was NULL
SELECT public.save_property_atomic(
  p_name => 'Parioli Villa',
  p_client_type => 'rental',
  p_zone => 'Parioli',
  p_agency_id => '81000000-0000-0000-0000-000000000002',
  p_existing_agency_email => 'parioli.agency@atomic.test.invalid'
);

SELECT is(
  (SELECT email FROM public.agencies WHERE id = '81000000-0000-0000-0000-000000000002'),
  'parioli.agency@atomic.test.invalid'::text,
  'Agency email was updated because it was previously NULL'
);

-- 14. Validation: attempting to update existing agency email when agency ALREADY has an email throws error 22023
SELECT throws_ok(
  $$
    SELECT public.save_property_atomic(
      p_name => 'Another Property',
      p_client_type => 'rental',
      p_zone => 'Parioli',
      p_agency_id => '81000000-0000-0000-0000-000000000001',
      p_existing_agency_email => 'try.overwrite@agency.it'
    );
  $$,
  '22023',
  NULL,
  'Attempting to overwrite non-null agency email throws 22023'
);

-- 15. Validation: attempting to update existing owner email when owner ALREADY has an email throws error 22023
SELECT throws_ok(
  $$
    SELECT public.save_property_atomic(
      p_name => 'Another Property 2',
      p_client_type => 'particular',
      p_zone => 'Colosseum',
      p_owner_id => '82000000-0000-0000-0000-000000000001',
      p_existing_owner_email => 'try.overwrite@owner.it'
    );
  $$,
  '22023',
  NULL,
  'Attempting to overwrite non-null owner email throws 22023'
);

-- 16. Validation: missing property name throws 22023
SELECT throws_ok(
  $$
    SELECT public.save_property_atomic(
      p_name => '   ',
      p_client_type => 'particular',
      p_zone => 'Colosseum',
      p_new_owner_name => 'Valid Owner'
    );
  $$,
  '22023',
  NULL,
  'Empty property name throws 22023'
);

-- 17. Validation: invalid client type throws 22023
SELECT throws_ok(
  $$
    SELECT public.save_property_atomic(
      p_name => 'Valid Name',
      p_client_type => 'invalid_client_type',
      p_zone => 'Colosseum'
    );
  $$,
  '22023',
  NULL,
  'Invalid client_type throws 22023'
);

-- 18. Validation: invalid zone throws 22023
SELECT throws_ok(
  $$
    SELECT public.save_property_atomic(
      p_name => 'Valid Name',
      p_client_type => 'particular',
      p_zone => 'Invalid Zone Name',
      p_new_owner_name => 'Valid Owner'
    );
  $$,
  '22023',
  NULL,
  'Invalid zone throws 22023'
);

-- 19. Validation: negative bed counts or dimensions throw 22023
SELECT throws_ok(
  $$
    SELECT public.save_property_atomic(
      p_name => 'Valid Name',
      p_client_type => 'particular',
      p_zone => 'Colosseum',
      p_new_owner_name => 'Valid Owner',
      p_double_beds => -2
    );
  $$,
  '22023',
  NULL,
  'Negative double_beds count throws 22023'
);

-- 20. Validation: invalid property email format throws 22023
SELECT throws_ok(
  $$
    SELECT public.save_property_atomic(
      p_name => 'Valid Name',
      p_client_type => 'particular',
      p_zone => 'Colosseum',
      p_new_owner_name => 'Valid Owner',
      p_email => 'bad-email-format'
    );
  $$,
  '22023',
  NULL,
  'Invalid property email format throws 22023'
);

-- 21. Validation: invalid new agency email format throws 22023
SELECT throws_ok(
  $$
    SELECT public.save_property_atomic(
      p_name => 'Valid Name',
      p_client_type => 'rental',
      p_zone => 'Colosseum',
      p_new_agency_name => 'Valid Agency',
      p_new_agency_email => 'bad-agency-email'
    );
  $$,
  '22023',
  NULL,
  'Invalid new agency email format throws 22023'
);

-- 22. Validation: invalid new owner email format throws 22023
SELECT throws_ok(
  $$
    SELECT public.save_property_atomic(
      p_name => 'Valid Name',
      p_client_type => 'particular',
      p_zone => 'Colosseum',
      p_new_owner_name => 'Valid Owner',
      p_new_owner_email => 'bad-owner-email'
    );
  $$,
  '22023',
  NULL,
  'Invalid new owner email format throws 22023'
);

-- 23. Validation: missing agency for rental throws 22023
SELECT throws_ok(
  $$
    SELECT public.save_property_atomic(
      p_name => 'Rental Without Agency',
      p_client_type => 'rental',
      p_zone => 'Colosseum'
    );
  $$,
  '22023',
  NULL,
  'Rental without agency throws 22023'
);

-- 24. Validation: missing owner for particular throws 22023
SELECT throws_ok(
  $$
    SELECT public.save_property_atomic(
      p_name => 'Particular Without Owner',
      p_client_type => 'particular',
      p_zone => 'Colosseum'
    );
  $$,
  '22023',
  NULL,
  'Particular without owner throws 22023'
);

-- 25. Validation: invalid agency UUID throws 23503
SELECT throws_ok(
  $$
    SELECT public.save_property_atomic(
      p_name => 'Rental Bad Agency ID',
      p_client_type => 'rental',
      p_zone => 'Colosseum',
      p_agency_id => '89999999-9999-9999-9999-999999999999'::uuid
    );
  $$,
  '23503',
  NULL,
  'Non-existent agency ID throws 23503'
);

-- 26. Validation: invalid owner UUID throws 23503
SELECT throws_ok(
  $$
    SELECT public.save_property_atomic(
      p_name => 'Particular Bad Owner ID',
      p_client_type => 'particular',
      p_zone => 'Colosseum',
      p_owner_id => '89999999-9999-9999-9999-999999999999'::uuid
    );
  $$,
  '23503',
  NULL,
  'Non-existent owner ID throws 23503'
);

-- 27. Non-existent property ID on update throws P0002
SELECT throws_ok(
  $$
    SELECT public.save_property_atomic(
      p_property_id => '88888888-8888-8888-8888-888888888888'::uuid,
      p_name => 'Ghost Property',
      p_client_type => 'particular',
      p_zone => 'Colosseum',
      p_owner_id => '82000000-0000-0000-0000-000000000001'
    );
  $$,
  'P0002',
  NULL,
  'Updating non-existent property throws P0002'
);

-- 28. Fault Injection / Atomicity: failure during property validation rolls back agency creation (zero orphan agency left)
CREATE TEMP TABLE count_before_fault_agency AS
SELECT
  (SELECT count(*) FROM public.agencies) AS agency_count,
  (SELECT count(*) FROM public.properties) AS property_count;

DO $fault_injection_agency$
BEGIN
  PERFORM public.save_property_atomic(
    p_name => 'Property With Invalid Negative Price',
    p_client_type => 'rental',
    p_zone => 'Colosseum',
    p_new_agency_name => 'Temporary Agency To Be Rolled Back',
    p_new_agency_email => 'rollback@agency.it',
    p_base_price => -50.00
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$fault_injection_agency$;

SELECT is(
  (SELECT count(*) FROM public.agencies),
  (SELECT agency_count FROM count_before_fault_agency),
  'Failed property save rolled back newly created agency without leaving orphan agency'
);

SELECT is(
  (SELECT count(*) FROM public.properties),
  (SELECT property_count FROM count_before_fault_agency),
  'Failed property save left zero partial rows in properties'
);

-- 29. Fault Injection / Atomicity: failure during property validation rolls back owner creation (zero orphan owner left)
CREATE TEMP TABLE count_before_fault_owner AS
SELECT
  (SELECT count(*) FROM public.owners) AS owner_count,
  (SELECT count(*) FROM public.properties) AS property_count;

DO $fault_injection_owner$
BEGIN
  PERFORM public.save_property_atomic(
    p_name => 'Property With Invalid Negative Sqm',
    p_client_type => 'particular',
    p_zone => 'Colosseum',
    p_new_owner_name => 'Temporary Owner To Be Rolled Back',
    p_new_owner_email => 'rollback@owner.it',
    p_sqm_interior => -80.00
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$fault_injection_owner$;

SELECT is(
  (SELECT count(*) FROM public.owners),
  (SELECT owner_count FROM count_before_fault_owner),
  'Failed property save rolled back newly created owner without leaving orphan owner'
);

-- 30. Retry / Sequential creations with same owner email create associated property cleanly
CREATE TEMP TABLE retry_owner_1 AS
SELECT public.save_property_atomic(
  p_name => 'Retry Property 1',
  p_client_type => 'particular',
  p_zone => 'Termini Station',
  p_new_owner_name => 'Luigi Rossi',
  p_new_owner_email => 'luigi.rossi@atomic.test.invalid'
) AS prop_1;

CREATE TEMP TABLE retry_owner_2 AS
SELECT public.save_property_atomic(
  p_name => 'Retry Property 2',
  p_client_type => 'particular',
  p_zone => 'Termini Station',
  p_new_owner_name => 'Luigi Rossi 2',
  p_new_owner_email => 'luigi.rossi@atomic.test.invalid'
) AS prop_2;

SELECT ok(
  (SELECT count(*) FROM public.properties WHERE id IN ((SELECT prop_1 FROM retry_owner_1), (SELECT prop_2 FROM retry_owner_2))) = 2,
  'Two properties created in sequence with same owner email succeeded without corruption'
);

-- 31. Security grant: anon cannot execute save_property_atomic directly
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$
    SELECT public.save_property_atomic(
      p_name => 'Anon Property',
      p_client_type => 'particular',
      p_zone => 'Colosseum',
      p_owner_id => '82000000-0000-0000-0000-000000000001'
    );
  $$,
  '42501',
  NULL,
  'Role anon cannot execute public.save_property_atomic (permission denied)'
);
RESET ROLE;

-- Cleanup
DELETE FROM public.properties
WHERE id IN (
  (SELECT property_id FROM created_b2b_new_agency),
  (SELECT property_id FROM created_b2b_existing_agency),
  (SELECT property_id FROM created_b2c_new_owner),
  (SELECT property_id FROM created_b2c_existing_owner),
  (SELECT prop_1 FROM retry_owner_1),
  (SELECT prop_2 FROM retry_owner_2)
);

DELETE FROM public.agencies
WHERE id IN (
  '81000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000002'
);

DELETE FROM public.owners
WHERE id IN (
  '82000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000002'
);

DELETE FROM auth.users
WHERE id IN (
  '80000000-0000-0000-0000-000000000001',
  '80000000-0000-0000-0000-000000000002',
  '80000000-0000-0000-0000-000000000003',
  '80000000-0000-0000-0000-000000000004',
  '80000000-0000-0000-0000-000000000005'
);

SELECT * FROM finish();
ROLLBACK;
