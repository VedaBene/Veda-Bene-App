-- Create atomic login lockout failure recording function.
--
-- Replaces application read-modify-upsert with an atomic PostgreSQL statement
-- using row-level locking on conflict to eliminate lost updates during concurrent
-- failed login bursts.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
BEGIN
  IF pg_catalog.to_regclass('public.auth_login_attempts') IS NULL THEN
    RAISE EXCEPTION 'Atomic login lockout precondition failed: table public.auth_login_attempts does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'auth_login_attempts'
      AND relation.relkind = 'r'
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Atomic login lockout precondition failed: table public.auth_login_attempts must have RLS enabled';
  END IF;

  IF pg_catalog.has_table_privilege('anon', 'public.auth_login_attempts', 'SELECT')
     OR pg_catalog.has_table_privilege('anon', 'public.auth_login_attempts', 'INSERT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.auth_login_attempts', 'SELECT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.auth_login_attempts', 'INSERT') THEN
    RAISE EXCEPTION 'Atomic login lockout precondition failed: public roles must not have table privileges on auth_login_attempts';
  END IF;

  IF pg_catalog.to_regprocedure('public.record_failed_login(text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Atomic login lockout precondition failed: function public.record_failed_login already exists';
  END IF;
END
$preconditions$;

CREATE FUNCTION public.record_failed_login(
  p_email_key text,
  p_ip_key text
)
RETURNS TABLE (
  email_key text,
  ip_key text,
  failed_count integer,
  locked_until timestamptz,
  last_failed_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
#variable_conflict use_column
BEGIN
  IF p_email_key IS NULL OR p_email_key !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Invalid email_key format';
  END IF;

  IF p_ip_key IS NULL OR p_ip_key !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Invalid ip_key format';
  END IF;

  RETURN QUERY
  INSERT INTO public.auth_login_attempts AS a (
    email_key,
    ip_key,
    failed_count,
    locked_until,
    last_failed_at,
    created_at,
    updated_at
  )
  VALUES (
    p_email_key,
    p_ip_key,
    1,
    NULL,
    pg_catalog.statement_timestamp(),
    pg_catalog.statement_timestamp(),
    pg_catalog.statement_timestamp()
  )
  ON CONFLICT ON CONSTRAINT auth_login_attempts_pkey DO UPDATE
  SET
    failed_count = CASE
      WHEN a.locked_until IS NOT NULL AND a.locked_until <= pg_catalog.statement_timestamp() THEN 1
      ELSE a.failed_count + 1
    END,
    locked_until = CASE
      WHEN a.locked_until IS NOT NULL AND a.locked_until <= pg_catalog.statement_timestamp() THEN NULL
      WHEN a.locked_until IS NOT NULL AND a.locked_until > pg_catalog.statement_timestamp() THEN a.locked_until
      WHEN (a.failed_count + 1) >= 4 THEN pg_catalog.statement_timestamp() + interval '24 hours'
      ELSE NULL
    END,
    last_failed_at = pg_catalog.statement_timestamp(),
    updated_at = pg_catalog.statement_timestamp()
  RETURNING
    a.email_key,
    a.ip_key,
    a.failed_count,
    a.locked_until,
    a.last_failed_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_failed_login(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_failed_login(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.record_failed_login(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_failed_login(text, text) TO service_role;

COMMENT ON FUNCTION public.record_failed_login(text, text) IS
  'Atomically records a failed login attempt and calculates lockout expiration without lost updates.';

COMMIT;
