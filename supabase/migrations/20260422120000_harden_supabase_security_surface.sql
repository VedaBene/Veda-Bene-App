-- Stage 2 hardening:
-- 1. Remove public views that bypass RLS through SECURITY DEFINER.
-- 2. Pin search_path on public functions flagged by Supabase advisors.

BEGIN;

DROP VIEW IF EXISTS public.properties_public;
DROP VIEW IF EXISTS public.profiles_public;

ALTER FUNCTION public.get_my_role() SET search_path = public;
ALTER FUNCTION public.get_top_properties(date, date, integer) SET search_path = public;
ALTER FUNCTION public.get_monthly_stats(date) SET search_path = public;

COMMIT;
