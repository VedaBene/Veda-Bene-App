-- Visibilidade mútua entre limpeza e consegna + consegna read-only
CREATE POLICY "profiles_staff_peer_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() IN ('"limpeza"', '"consegna"')
    AND id IN (
      SELECT consegna_staff_id
      FROM public.service_orders
      WHERE cleaning_staff_id = auth.uid()
        AND consegna_staff_id IS NOT NULL
      UNION
      SELECT cleaning_staff_id
      FROM public.service_orders
      WHERE consegna_staff_id = auth.uid()
        AND cleaning_staff_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "service_orders_consegna_update" ON public.service_orders;
;
