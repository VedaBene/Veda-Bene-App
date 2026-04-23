-- ============================================================
-- 04_rls_policies.sql
-- Habilita RLS e cria todas as políticas por tabela/operação
-- ============================================================

-- ============================================================
-- PROFILES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- admin: acesso total
CREATE POLICY "profiles_admin_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.get_my_role() = '"admin"');

CREATE POLICY "profiles_admin_insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = '"admin"');

CREATE POLICY "profiles_admin_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = '"admin"')
  WITH CHECK (public.get_my_role() = '"admin"');

CREATE POLICY "profiles_admin_delete"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.get_my_role() = '"admin"');

-- secretaria: SELECT em todos (CLS bloqueia colunas de remuneração)
CREATE POLICY "profiles_secretaria_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.get_my_role() = '"secretaria"');

-- limpeza, consegna, cliente: SELECT apenas no próprio registro
CREATE POLICY "profiles_self_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() IN ('"limpeza"', '"consegna"', '"cliente"')
    AND id = auth.uid()
  );

-- ============================================================
-- AGENCIES
-- ============================================================
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

-- admin e secretaria: SELECT/INSERT/UPDATE em todos
CREATE POLICY "agencies_admin_secretaria_select"
  ON public.agencies FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('"admin"', '"secretaria"'));

CREATE POLICY "agencies_admin_secretaria_insert"
  ON public.agencies FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() IN ('"admin"', '"secretaria"'));

CREATE POLICY "agencies_admin_secretaria_update"
  ON public.agencies FOR UPDATE
  TO authenticated
  USING (public.get_my_role() IN ('"admin"', '"secretaria"'))
  WITH CHECK (public.get_my_role() IN ('"admin"', '"secretaria"'));

-- demais roles: SELECT apenas nas agências vinculadas aos seus imóveis
CREATE POLICY "agencies_others_select"
  ON public.agencies FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() NOT IN ('"admin"', '"secretaria"')
    AND id IN (
      SELECT p.agency_id
      FROM public.properties p
      WHERE p.agency_id IS NOT NULL
        AND (
          -- limpeza/consegna: imóveis das suas OSs
          (public.get_my_role() IN ('"limpeza"', '"consegna"')
           AND p.id IN (
             SELECT so.property_id
             FROM public.service_orders so
             WHERE so.cleaning_staff_id = auth.uid()
                OR so.consegna_staff_id = auth.uid()
           ))
          OR
          -- cliente: imóveis pela agência (email match)
          (public.get_my_role() = '"cliente"'
           AND p.agency_id IN (
             SELECT a.id FROM public.agencies a
             JOIN public.profiles pr ON pr.email = a.email
             WHERE pr.id = auth.uid()
           ))
        )
    )
  );

-- ============================================================
-- OWNERS
-- ============================================================
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;

-- admin e secretaria: SELECT/INSERT/UPDATE em todos
CREATE POLICY "owners_admin_secretaria_select"
  ON public.owners FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('"admin"', '"secretaria"'));

CREATE POLICY "owners_admin_secretaria_insert"
  ON public.owners FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() IN ('"admin"', '"secretaria"'));

CREATE POLICY "owners_admin_secretaria_update"
  ON public.owners FOR UPDATE
  TO authenticated
  USING (public.get_my_role() IN ('"admin"', '"secretaria"'))
  WITH CHECK (public.get_my_role() IN ('"admin"', '"secretaria"'));

-- demais roles: SELECT apenas nos proprietários vinculados aos seus imóveis
CREATE POLICY "owners_others_select"
  ON public.owners FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() NOT IN ('"admin"', '"secretaria"')
    AND id IN (
      SELECT p.owner_id
      FROM public.properties p
      WHERE p.owner_id IS NOT NULL
        AND (
          (public.get_my_role() IN ('"limpeza"', '"consegna"')
           AND p.id IN (
             SELECT so.property_id
             FROM public.service_orders so
             WHERE so.cleaning_staff_id = auth.uid()
                OR so.consegna_staff_id = auth.uid()
           ))
          OR
          (public.get_my_role() = '"cliente"'
           AND p.owner_id IN (
             SELECT o.id FROM public.owners o
             JOIN public.profiles pr ON pr.email = o.email
             WHERE pr.id = auth.uid()
           ))
        )
    )
  );

-- ============================================================
-- PROPERTIES
-- ============================================================
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- admin e secretaria: SELECT/INSERT/UPDATE em todos
CREATE POLICY "properties_admin_secretaria_select"
  ON public.properties FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('"admin"', '"secretaria"'));

CREATE POLICY "properties_admin_secretaria_insert"
  ON public.properties FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() IN ('"admin"', '"secretaria"'));

CREATE POLICY "properties_admin_secretaria_update"
  ON public.properties FOR UPDATE
  TO authenticated
  USING (public.get_my_role() IN ('"admin"', '"secretaria"'))
  WITH CHECK (public.get_my_role() IN ('"admin"', '"secretaria"'));

-- limpeza e consegna: SELECT em todos os imóveis (CLS bloqueia preços)
CREATE POLICY "properties_limpeza_consegna_select"
  ON public.properties FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('"limpeza"', '"consegna"'));

-- cliente: SELECT apenas em imóveis onde é owner ou agency (por email)
CREATE POLICY "properties_cliente_select"
  ON public.properties FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = '"cliente"'
    AND (
      owner_id IN (
        SELECT o.id FROM public.owners o
        JOIN public.profiles pr ON pr.email = o.email
        WHERE pr.id = auth.uid()
      )
      OR
      agency_id IN (
        SELECT a.id FROM public.agencies a
        JOIN public.profiles pr ON pr.email = a.email
        WHERE pr.id = auth.uid()
      )
    )
  );

-- ============================================================
-- SERVICE_ORDERS
-- ============================================================
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

-- admin e secretaria: SELECT/INSERT/UPDATE em todos
CREATE POLICY "service_orders_admin_secretaria_select"
  ON public.service_orders FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('"admin"', '"secretaria"'));

CREATE POLICY "service_orders_admin_secretaria_insert"
  ON public.service_orders FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() IN ('"admin"', '"secretaria"'));

CREATE POLICY "service_orders_admin_secretaria_update"
  ON public.service_orders FOR UPDATE
  TO authenticated
  USING (public.get_my_role() IN ('"admin"', '"secretaria"'))
  WITH CHECK (public.get_my_role() IN ('"admin"', '"secretaria"'));

-- limpeza: SELECT apenas onde cleaning_staff_id = auth.uid()
CREATE POLICY "service_orders_limpeza_select"
  ON public.service_orders FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = '"limpeza"'
    AND cleaning_staff_id = auth.uid()
  );

-- consegna: SELECT apenas onde consegna_staff_id = auth.uid()
CREATE POLICY "service_orders_consegna_select"
  ON public.service_orders FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = '"consegna"'
    AND consegna_staff_id = auth.uid()
  );

-- cliente: SELECT apenas em OSs dos seus imóveis
CREATE POLICY "service_orders_cliente_select"
  ON public.service_orders FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = '"cliente"'
    AND property_id IN (
      SELECT p.id FROM public.properties p
      WHERE
        p.owner_id IN (
          SELECT o.id FROM public.owners o
          JOIN public.profiles pr ON pr.email = o.email
          WHERE pr.id = auth.uid()
        )
        OR
        p.agency_id IN (
          SELECT a.id FROM public.agencies a
          JOIN public.profiles pr ON pr.email = a.email
          WHERE pr.id = auth.uid()
        )
    )
  );
