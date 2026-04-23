-- Restrict staff property visibility to properties linked to their assigned service orders.

CREATE OR REPLACE FUNCTION public.staff_property_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT property_id
  FROM public.service_orders
  WHERE cleaning_staff_id = uid OR consegna_staff_id = uid;
$function$;

DROP POLICY IF EXISTS "properties_limpeza_consegna_select" ON public.properties;

CREATE POLICY "properties_limpeza_consegna_select"
  ON public.properties FOR SELECT
  USING (
    public.get_my_role() IN ('"limpeza"', '"consegna"')
    AND id IN (
      SELECT public.staff_property_ids(auth.uid()) AS staff_property_ids
    )
  );
