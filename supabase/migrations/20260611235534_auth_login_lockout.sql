BEGIN;

CREATE TABLE public.auth_login_attempts (
  email_key      TEXT NOT NULL,
  ip_key         TEXT NOT NULL,
  failed_count   INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  locked_until   TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (email_key, ip_key)
);

CREATE INDEX auth_login_attempts_locked_until_idx
  ON public.auth_login_attempts (locked_until)
  WHERE locked_until IS NOT NULL;

ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.auth_login_attempts FROM anon;
REVOKE ALL ON public.auth_login_attempts FROM authenticated;

COMMIT;
