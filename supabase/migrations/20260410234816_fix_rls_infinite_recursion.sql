-- Replace recursive policy joins with helper functions and remove overly broad
-- cross-table policies that caused recursion/performance issues.

CREATE OR REPLACE FUNCTION public.client_property_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
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

DROP POLICY IF EXISTS "agencies_others_select" ON public.agencies;
DROP POLICY IF EXISTS "owners_others_select" ON public.owners;
DROP POLICY IF EXISTS "properties_cliente_select" ON public.properties;
DROP POLICY IF EXISTS "service_orders_cliente_select" ON public.service_orders;

CREATE POLICY "properties_cliente_select"
  ON public.properties FOR SELECT
  USING (
    public.get_my_role() = '"cliente"'
    AND id IN (
      SELECT public.client_property_ids(auth.uid()) AS client_property_ids
    )
  );

CREATE POLICY "service_orders_cliente_select"
  ON public.service_orders FOR SELECT
  USING (
    public.get_my_role() = '"cliente"'
    AND property_id IN (
      SELECT public.client_property_ids(auth.uid()) AS client_property_ids
    )
  );
