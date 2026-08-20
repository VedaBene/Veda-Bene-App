BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(21);

-- Clean any fixture state
DELETE FROM public.auth_login_attempts
WHERE email_key IN (
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  '4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce'
);

-- 1. Schema & function existence
SELECT has_function('public', 'record_failed_login', ARRAY['text', 'text'], 'Function public.record_failed_login(text, text) exists');

-- 2. First failure: inserts record with count = 1 and locked_until = NULL
SELECT results_eq(
  $$SELECT failed_count, (locked_until IS NULL)
    FROM public.record_failed_login(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9'
    )$$,
  $$VALUES (1, true)$$,
  'First failed login attempt sets count to 1 and locked_until to NULL'
);

-- 3. Second failure: updates count to 2, locked_until = NULL
SELECT results_eq(
  $$SELECT failed_count, (locked_until IS NULL)
    FROM public.record_failed_login(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9'
    )$$,
  $$VALUES (2, true)$$,
  'Second failed login attempt sets count to 2'
);

-- 4. Third failure: updates count to 3, locked_until = NULL
SELECT results_eq(
  $$SELECT failed_count, (locked_until IS NULL)
    FROM public.record_failed_login(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9'
    )$$,
  $$VALUES (3, true)$$,
  'Third failed login attempt sets count to 3'
);

-- 5. Fourth failure: reaches threshold, count = 4, locked_until is set to future
SELECT results_eq(
  $$SELECT failed_count, (locked_until > statement_timestamp())
    FROM public.record_failed_login(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9'
    )$$,
  $$VALUES (4, true)$$,
  'Fourth failed login attempt triggers 24h lockout with locked_until in future'
);

-- 6. Verify table state directly for the locked record
SELECT results_eq(
  $$SELECT failed_count, (locked_until > statement_timestamp())
    FROM public.auth_login_attempts
    WHERE email_key = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      AND ip_key = 'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9'$$,
  $$VALUES (4, true)$$,
  'Table public.auth_login_attempts stores failed_count=4 and active lockout timestamp'
);

-- 7. Fifth attempt while locked: lock remains active
SELECT results_eq(
  $$SELECT (failed_count >= 4), (locked_until > statement_timestamp())
    FROM public.record_failed_login(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9'
    )$$,
  $$VALUES (true, true)$$,
  'Subsequent attempt while locked preserves the active lockout window'
);

-- 8. Isolation: second user attempt has count = 1 and does not share state
SELECT results_eq(
  $$SELECT failed_count, (locked_until IS NULL)
    FROM public.record_failed_login(
      '4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce',
      '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a'
    )$$,
  $$VALUES (1, true)$$,
  'Distinct user identity starts at count=1 and does not inherit lockout from other user'
);

-- 9. Expired lockout: simulate expired lock for user 1
UPDATE public.auth_login_attempts
SET locked_until = statement_timestamp() - interval '1 minute'
WHERE email_key = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  AND ip_key = 'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9';

-- 10. Next attempt after expired lockout resets count to 1 and clears locked_until
SELECT results_eq(
  $$SELECT failed_count, (locked_until IS NULL)
    FROM public.record_failed_login(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9'
    )$$,
  $$VALUES (1, true)$$,
  'Attempt after expired lockout resets failed_count to 1 and unlocks'
);

-- 11. Clear / delete removes the attempt record (login success flow)
DELETE FROM public.auth_login_attempts
WHERE email_key = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  AND ip_key = 'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9';

SELECT is_empty(
  $$SELECT 1 FROM public.auth_login_attempts
    WHERE email_key = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      AND ip_key = 'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9'$$,
  'Deleting attempt record on login success completely clears state'
);

-- 12. Input validation: invalid email_key format rejected with 22023
SELECT throws_ok(
  $$SELECT public.record_failed_login('invalid-key', 'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9')$$,
  '22023',
  'Invalid email_key format',
  'Invalid email_key format throws 22023 exception'
);

-- 13. Input validation: invalid ip_key format rejected with 22023
SELECT throws_ok(
  $$SELECT public.record_failed_login('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'short-key')$$,
  '22023',
  'Invalid ip_key format',
  'Invalid ip_key format throws 22023 exception'
);

-- 14. Input validation: NULL email_key rejected with 22023
SELECT throws_ok(
  $$SELECT public.record_failed_login(NULL, 'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9')$$,
  '22023',
  'Invalid email_key format',
  'NULL email_key throws 22023 exception'
);

-- 15. Security grants: anon cannot execute record_failed_login
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.record_failed_login(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9'
  )$$,
  '42501',
  NULL,
  'Role anon cannot execute public.record_failed_login (permission denied)'
);

-- 16. Security grants: anon cannot SELECT from auth_login_attempts
SELECT throws_ok(
  'SELECT * FROM public.auth_login_attempts',
  '42501',
  NULL,
  'Role anon cannot SELECT from public.auth_login_attempts (permission denied)'
);

-- 17. Security grants: anon cannot INSERT into auth_login_attempts
SELECT throws_ok(
  $$INSERT INTO public.auth_login_attempts (email_key, ip_key) VALUES (
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9'
  )$$,
  '42501',
  NULL,
  'Role anon cannot INSERT into public.auth_login_attempts (permission denied)'
);

-- 18. Security grants: authenticated cannot execute record_failed_login
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.record_failed_login(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9'
  )$$,
  '42501',
  NULL,
  'Role authenticated cannot execute public.record_failed_login (permission denied)'
);

-- 19. Security grants: authenticated cannot SELECT from auth_login_attempts
SELECT throws_ok(
  'SELECT * FROM public.auth_login_attempts',
  '42501',
  NULL,
  'Role authenticated cannot SELECT from public.auth_login_attempts (permission denied)'
);

-- 20. Security grants: authenticated cannot INSERT into auth_login_attempts
SELECT throws_ok(
  $$INSERT INTO public.auth_login_attempts (email_key, ip_key) VALUES (
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9'
  )$$,
  '42501',
  NULL,
  'Role authenticated cannot INSERT into public.auth_login_attempts (permission denied)'
);

-- 21. Security grants: service_role can execute record_failed_login
SET LOCAL ROLE service_role;
SELECT lives_ok(
  $$SELECT public.record_failed_login(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'ca978112ca1bbdcaf064278e4a1f2de05288647b0e5412461cf7e30f823f92e9'
  )$$,
  'Role service_role can execute public.record_failed_login'
);

-- 22. Security grants: service_role can query auth_login_attempts
SELECT lives_ok(
  $$SELECT failed_count FROM public.auth_login_attempts
    WHERE email_key = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'$$,
  'Role service_role can query public.auth_login_attempts'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
