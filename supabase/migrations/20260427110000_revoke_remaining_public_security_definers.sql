-- Restrict direct API execution of remaining public SECURITY DEFINER functions.
-- The dashboard no longer depends on these RPC entrypoints.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_top_properties(DATE, DATE, INTEGER)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_monthly_stats(DATE)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;

COMMIT;
