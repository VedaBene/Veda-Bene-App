-- Harden RLS helper exposure by moving SECURITY DEFINER functions out of the
-- public schema while preserving the existing policy behavior.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

CREATE OR REPLACE FUNCTION private.client_property_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.id
  FROM public.properties p
  WHERE p.owner_id IN (
    SELECT o.id
    FROM public.owners o
    JOIN public.profiles pr ON pr.email = o.email
    WHERE pr.id = uid
  )
  OR p.agency_id IN (
    SELECT a.id
    FROM public.agencies a
    JOIN public.profiles pr ON pr.email = a.email
    WHERE pr.id = uid
  );
$function$;

CREATE OR REPLACE FUNCTION private.staff_property_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT DISTINCT so.property_id
  FROM public.service_orders so
  WHERE so.cleaning_staff_id = uid OR so.consegna_staff_id = uid;
$function$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM anon, authenticated;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.client_property_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.staff_property_ids(UUID) TO authenticated;

DROP POLICY IF EXISTS "properties_cliente_select" ON public.properties;

CREATE POLICY "properties_cliente_select"
  ON public.properties FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = '"cliente"'
    AND id IN (
      SELECT private.client_property_ids(auth.uid()) AS client_property_ids
    )
  );

DROP POLICY IF EXISTS "service_orders_cliente_select" ON public.service_orders;

CREATE POLICY "service_orders_cliente_select"
  ON public.service_orders FOR SELECT
  USING (
    public.get_my_role() = '"cliente"'
    AND property_id IN (
      SELECT private.client_property_ids(auth.uid()) AS client_property_ids
    )
  );

DROP POLICY IF EXISTS "properties_limpeza_consegna_select" ON public.properties;

CREATE POLICY "properties_limpeza_consegna_select"
  ON public.properties FOR SELECT
  USING (
    public.get_my_role() IN ('"limpeza"', '"consegna"')
    AND id IN (
      SELECT private.staff_property_ids(auth.uid()) AS staff_property_ids
    )
  );

REVOKE EXECUTE ON FUNCTION public.client_property_ids(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.client_property_ids(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.staff_property_ids(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_property_ids(UUID) FROM anon, authenticated;

DROP FUNCTION public.client_property_ids(UUID);
DROP FUNCTION public.staff_property_ids(UUID);

COMMIT;
