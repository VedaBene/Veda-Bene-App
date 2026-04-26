-- Fix: properties_cliente_select was still using the inline JOIN against
-- owners/agencies, which is blocked by those tables' own RLS for the cliente
-- role. As a result, clients could see their service orders (whose policy
-- already uses the client_property_ids helper) but not the linked property
-- itself, so property names showed as null in joins and the property list
-- appeared empty.
--
-- Replace the inline subquery with the SECURITY DEFINER helper, matching
-- the existing service_orders_cliente_select policy.

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
