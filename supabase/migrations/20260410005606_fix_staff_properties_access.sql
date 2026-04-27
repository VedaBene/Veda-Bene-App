
-- 1. Corrigir policy de properties para limpeza/consegna:
--    restringir às linhas cujas OS foram atribuídas ao funcionário
DROP POLICY IF EXISTS "properties_limpeza_consegna_select" ON properties;
CREATE POLICY "properties_limpeza_consegna_select" ON properties
FOR SELECT TO authenticated
USING (
  get_my_role() = ANY (ARRAY['"limpeza"'::text, '"consegna"'::text])
  AND id IN (
    SELECT property_id FROM service_orders
    WHERE cleaning_staff_id = auth.uid() OR consegna_staff_id = auth.uid()
  )
);

-- 2. Remover acesso de limpeza/consegna a agencies e owners
--    (eles não precisam ver nome, email ou telefone do cliente)
DROP POLICY IF EXISTS "agencies_others_select" ON agencies;
DROP POLICY IF EXISTS "owners_others_select" ON owners;
;
