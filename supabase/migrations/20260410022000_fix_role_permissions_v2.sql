
-- ============================================================
-- PROPERTIES: remover secretaria do write, admin-only
-- ============================================================

-- INSERT: era admin+secretaria → agora só admin
DROP POLICY IF EXISTS "properties_admin_secretaria_insert" ON properties;
CREATE POLICY "properties_admin_insert" ON properties
FOR INSERT TO authenticated
WITH CHECK (get_my_role() = '"admin"');

-- UPDATE: era admin+secretaria → agora só admin
DROP POLICY IF EXISTS "properties_admin_secretaria_update" ON properties;
CREATE POLICY "properties_admin_update" ON properties
FOR UPDATE TO authenticated
USING (get_my_role() = '"admin"')
WITH CHECK (get_my_role() = '"admin"');

-- DELETE: não existia → criar para admin
CREATE POLICY "properties_admin_delete" ON properties
FOR DELETE TO authenticated
USING (get_my_role() = '"admin"');

-- SELECT: manter admin+secretaria (secretaria lê, mas não escreve)
-- "properties_admin_secretaria_select" já existe, não alterar

-- ============================================================
-- SERVICE ORDERS: adicionar DELETE para admin+secretaria
-- ============================================================
CREATE POLICY "service_orders_admin_secretaria_delete" ON service_orders
FOR DELETE TO authenticated
USING (get_my_role() = ANY (ARRAY['"admin"'::text, '"secretaria"'::text]));

-- ============================================================
-- AGENCIES e OWNERS: remover secretaria do INSERT (segue properties)
-- ============================================================
DROP POLICY IF EXISTS "agencies_admin_secretaria_insert" ON agencies;
CREATE POLICY "agencies_admin_insert" ON agencies
FOR INSERT TO authenticated
WITH CHECK (get_my_role() = '"admin"');

DROP POLICY IF EXISTS "agencies_admin_secretaria_update" ON agencies;
CREATE POLICY "agencies_admin_update" ON agencies
FOR UPDATE TO authenticated
USING (get_my_role() = '"admin"')
WITH CHECK (get_my_role() = '"admin"');

DROP POLICY IF EXISTS "owners_admin_secretaria_insert" ON owners;
CREATE POLICY "owners_admin_insert" ON owners
FOR INSERT TO authenticated
WITH CHECK (get_my_role() = '"admin"');

DROP POLICY IF EXISTS "owners_admin_secretaria_update" ON owners;
CREATE POLICY "owners_admin_update" ON owners
FOR UPDATE TO authenticated
USING (get_my_role() = '"admin"')
WITH CHECK (get_my_role() = '"admin"');
;
