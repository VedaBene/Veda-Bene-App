
-- ============================================================
-- FIX: Infinite recursion in RLS policies
-- Causa: properties → service_orders → properties (loop)
-- Solução: SECURITY DEFINER functions que bypassam RLS
-- ============================================================

-- 1. Helper para limpeza/consegna: busca property_ids sem RLS em service_orders
CREATE OR REPLACE FUNCTION public.staff_property_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT property_id
  FROM service_orders
  WHERE cleaning_staff_id = uid OR consegna_staff_id = uid;
$$;

-- 2. Helper para cliente: busca property_ids sem RLS em properties
CREATE OR REPLACE FUNCTION public.client_property_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM properties p
  WHERE p.owner_id IN (
    SELECT o.id FROM owners o
    JOIN profiles pr ON pr.email = o.email
    WHERE pr.id = uid
  )
  OR p.agency_id IN (
    SELECT a.id FROM agencies a
    JOIN profiles pr ON pr.email = a.email
    WHERE pr.id = uid
  );
$$;

-- Garante acesso às funções
GRANT EXECUTE ON FUNCTION public.staff_property_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_property_ids(uuid)  TO authenticated;

-- 3. Recria policy de properties para limpeza/consegna (sem subquery com RLS)
DROP POLICY IF EXISTS properties_limpeza_consegna_select ON public.properties;
CREATE POLICY properties_limpeza_consegna_select ON public.properties
  FOR SELECT
  USING (
    get_my_role() = ANY (ARRAY['"limpeza"'::text, '"consegna"'::text])
    AND id IN (SELECT staff_property_ids(auth.uid()))
  );

-- 4. Recria policy de service_orders para cliente (sem subquery com RLS)
DROP POLICY IF EXISTS service_orders_cliente_select ON public.service_orders;
CREATE POLICY service_orders_cliente_select ON public.service_orders
  FOR SELECT
  USING (
    get_my_role() = '"cliente"'::text
    AND property_id IN (SELECT client_property_ids(auth.uid()))
  );
;
