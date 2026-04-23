-- Tighten write permissions after the first RLS rollout.

DROP POLICY IF EXISTS "agencies_admin_secretaria_insert" ON public.agencies;
DROP POLICY IF EXISTS "agencies_admin_secretaria_update" ON public.agencies;
DROP POLICY IF EXISTS "owners_admin_secretaria_insert" ON public.owners;
DROP POLICY IF EXISTS "owners_admin_secretaria_update" ON public.owners;
DROP POLICY IF EXISTS "properties_admin_secretaria_insert" ON public.properties;
DROP POLICY IF EXISTS "properties_admin_secretaria_update" ON public.properties;

CREATE POLICY "agencies_admin_insert"
  ON public.agencies FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = '"admin"');

CREATE POLICY "agencies_admin_update"
  ON public.agencies FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = '"admin"')
  WITH CHECK (public.get_my_role() = '"admin"');

CREATE POLICY "owners_admin_insert"
  ON public.owners FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = '"admin"');

CREATE POLICY "owners_admin_update"
  ON public.owners FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = '"admin"')
  WITH CHECK (public.get_my_role() = '"admin"');

CREATE POLICY "properties_admin_insert"
  ON public.properties FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = '"admin"');

CREATE POLICY "properties_admin_update"
  ON public.properties FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = '"admin"')
  WITH CHECK (public.get_my_role() = '"admin"');

CREATE POLICY "properties_admin_delete"
  ON public.properties FOR DELETE
  TO authenticated
  USING (public.get_my_role() = '"admin"');

CREATE POLICY "service_orders_admin_secretaria_delete"
  ON public.service_orders FOR DELETE
  TO authenticated
  USING (public.get_my_role() IN ('"admin"', '"secretaria"'));
