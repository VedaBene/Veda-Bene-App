-- Minimal Supabase-like catalog used only by the disposable Postgres migration
-- smoke test. It is not applied to hosted environments.

DO $$
BEGIN
  CREATE ROLE anon;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE ROLE authenticated;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE SCHEMA storage;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY
);

CREATE TABLE public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'open'
);

CREATE TABLE storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN NOT NULL DEFAULT FALSE,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[]
);

CREATE TABLE storage.objects (
  bucket_id TEXT NOT NULL
);

CREATE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT '"admin"'::TEXT;
$$;
