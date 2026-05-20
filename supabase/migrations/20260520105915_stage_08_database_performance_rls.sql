-- Stage 8: evidence-based database performance and RLS review.
--
-- Evidence:
-- - Stage 6/8 reporting and dashboard queries repeatedly filter completed
--   service orders by status = 'done' and completed_at ranges.
-- - Service-order lists and top-property dashboard queries filter by status
--   and cleaning_date ranges/order.
-- - ADR 003/005 cliente RLS helper resolves properties via owner/agency email
--   matches.
-- - Supabase Advisor reported auth_rls_initplan warnings on the policies
--   updated below.

BEGIN;

CREATE INDEX IF NOT EXISTS service_orders_done_completed_at_idx
  ON public.service_orders (completed_at)
  WHERE status = 'done' AND completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS service_orders_done_cleaning_date_idx
  ON public.service_orders (cleaning_date DESC)
  WHERE status = 'done' AND cleaning_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS service_orders_active_cleaning_date_idx
  ON public.service_orders (cleaning_date DESC)
  WHERE status IN ('open', 'in_progress') AND cleaning_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS owners_email_idx
  ON public.owners (email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS agencies_email_idx
  ON public.agencies (email)
  WHERE email IS NOT NULL;

ALTER POLICY "profiles_self_select"
  ON public.profiles
  USING (
    (SELECT public.get_my_role()) IN ('"limpeza"', '"consegna"', '"cliente"')
    AND id = (SELECT auth.uid())
  );

ALTER POLICY "profiles_staff_peer_select"
  ON public.profiles
  USING (
    (SELECT public.get_my_role()) IN ('"limpeza"', '"consegna"')
    AND id IN (
      SELECT consegna_staff_id
      FROM public.service_orders
      WHERE cleaning_staff_id = (SELECT auth.uid())
        AND consegna_staff_id IS NOT NULL
      UNION
      SELECT cleaning_staff_id
      FROM public.service_orders
      WHERE consegna_staff_id = (SELECT auth.uid())
        AND cleaning_staff_id IS NOT NULL
    )
  );

ALTER POLICY "properties_cliente_select"
  ON public.properties
  TO authenticated
  USING (
    (SELECT public.get_my_role()) = '"cliente"'
    AND id IN (
      SELECT private.client_property_ids((SELECT auth.uid())) AS client_property_ids
    )
  );

ALTER POLICY "properties_limpeza_consegna_select"
  ON public.properties
  TO authenticated
  USING (
    (SELECT public.get_my_role()) IN ('"limpeza"', '"consegna"')
    AND id IN (
      SELECT private.staff_property_ids((SELECT auth.uid())) AS staff_property_ids
    )
  );

ALTER POLICY "service_orders_limpeza_select"
  ON public.service_orders
  USING (
    (SELECT public.get_my_role()) = '"limpeza"'
    AND cleaning_staff_id = (SELECT auth.uid())
  );

ALTER POLICY "service_orders_consegna_select"
  ON public.service_orders
  USING (
    (SELECT public.get_my_role()) = '"consegna"'
    AND consegna_staff_id = (SELECT auth.uid())
  );

ALTER POLICY "service_orders_cliente_select"
  ON public.service_orders
  TO authenticated
  USING (
    (SELECT public.get_my_role()) = '"cliente"'
    AND property_id IN (
      SELECT private.client_property_ids((SELECT auth.uid())) AS client_property_ids
    )
  );

ALTER POLICY "service_orders_limpeza_update"
  ON public.service_orders
  USING (
    (SELECT public.get_my_role()) = '"limpeza"'
    AND cleaning_staff_id = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT public.get_my_role()) = '"limpeza"'
    AND cleaning_staff_id = (SELECT auth.uid())
  );

COMMIT;
