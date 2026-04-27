
DROP POLICY IF EXISTS "properties_cliente_select" ON public.properties;

CREATE POLICY "properties_cliente_select"
  ON public.properties FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = '"cliente"'
    AND id IN (
      SELECT public.client_property_ids(auth.uid()) AS client_property_ids
    )
  );
;
