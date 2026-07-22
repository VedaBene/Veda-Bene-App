BEGIN;

-- 1. Criar a tabela associativa intermediária
CREATE TABLE IF NOT EXISTS public.service_order_cleaning_staff (
  service_order_id  UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  profile_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (service_order_id, profile_id)
);

-- 2. Criar índice invertido para otimizar buscas por funcionário (RLS)
CREATE INDEX IF NOT EXISTS service_order_cleaning_staff_profile_idx 
  ON public.service_order_cleaning_staff (profile_id, service_order_id);

-- 3. Habilitar RLS na nova tabela
ALTER TABLE public.service_order_cleaning_staff ENABLE ROW LEVEL SECURITY;

-- 4. Definir políticas de RLS para a tabela associativa
DROP POLICY IF EXISTS "service_order_cleaning_staff_select" ON public.service_order_cleaning_staff;
CREATE POLICY "service_order_cleaning_staff_select"
  ON public.service_order_cleaning_staff FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "service_order_cleaning_staff_all_admin_secretaria" ON public.service_order_cleaning_staff;
CREATE POLICY "service_order_cleaning_staff_all_admin_secretaria"
  ON public.service_order_cleaning_staff FOR ALL
  TO authenticated
  USING (
    (SELECT public.get_my_role()) IN ('"admin"', '"secretaria"')
  )
  WITH CHECK (
    (SELECT public.get_my_role()) IN ('"admin"', '"secretaria"')
  );

-- 5. Migrar dados existentes da coluna antiga para a tabela intermediária
INSERT INTO public.service_order_cleaning_staff (service_order_id, profile_id)
SELECT id, cleaning_staff_id
FROM public.service_orders
WHERE cleaning_staff_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 6. Tornar a coluna antiga NULLABLE e adicionar comentário de depreciação
ALTER TABLE public.service_orders ALTER COLUMN cleaning_staff_id DROP NOT NULL;
COMMENT ON COLUMN public.service_orders.cleaning_staff_id IS 'DEPRECATED: Use service_order_cleaning_staff table instead.';

-- 7. Atualizar a função helper de segurança privada
CREATE OR REPLACE FUNCTION private.staff_property_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT DISTINCT so.property_id
  FROM public.service_orders so
  WHERE so.consegna_staff_id = uid
     OR EXISTS (
       SELECT 1 FROM public.service_order_cleaning_staff socs
       WHERE socs.service_order_id = so.id
         AND socs.profile_id = uid
     );
$function$;

-- 8. Atualizar policies de RLS da tabela service_orders
DROP POLICY IF EXISTS "service_orders_limpeza_select" ON public.service_orders;
CREATE POLICY "service_orders_limpeza_select"
  ON public.service_orders FOR SELECT
  USING (
    (SELECT public.get_my_role()) = '"limpeza"'
    AND EXISTS (
      SELECT 1 FROM public.service_order_cleaning_staff socs
      WHERE socs.service_order_id = id
        AND socs.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "service_orders_limpeza_update" ON public.service_orders;
CREATE POLICY "service_orders_limpeza_update"
  ON public.service_orders FOR UPDATE
  USING (
    (SELECT public.get_my_role()) = '"limpeza"'
    AND EXISTS (
      SELECT 1 FROM public.service_order_cleaning_staff socs
      WHERE socs.service_order_id = id
        AND socs.profile_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT public.get_my_role()) = '"limpeza"'
    AND EXISTS (
      SELECT 1 FROM public.service_order_cleaning_staff socs
      WHERE socs.service_order_id = id
        AND socs.profile_id = (SELECT auth.uid())
    )
  );

-- 9. Atualizar policy profiles_staff_peer_select na tabela profiles
DROP POLICY IF EXISTS "profiles_staff_peer_select" ON public.profiles;
CREATE POLICY "profiles_staff_peer_select"
  ON public.profiles FOR SELECT
  USING (
    (SELECT public.get_my_role()) IN ('"limpeza"', '"consegna"')
    AND id IN (
      -- Se eu sou da limpeza, vejo os entregadores das OSs que limpei
      SELECT consegna_staff_id
      FROM public.service_orders so
      JOIN public.service_order_cleaning_staff socs ON socs.service_order_id = so.id
      WHERE socs.profile_id = (SELECT auth.uid())
        AND so.consegna_staff_id IS NOT NULL
      
      UNION
      
      -- Se eu sou da limpeza, vejo outros prestadores de limpeza que limparam as mesmas OSs que eu
      SELECT socs_other.profile_id
      FROM public.service_order_cleaning_staff socs_self
      JOIN public.service_order_cleaning_staff socs_other 
        ON socs_other.service_order_id = socs_self.service_order_id
      WHERE socs_self.profile_id = (SELECT auth.uid())
      
      UNION
      
      -- Se eu sou entregador, vejo todos os prestadores de limpeza das OSs que entreguei
      SELECT socs.profile_id
      FROM public.service_orders so
      JOIN public.service_order_cleaning_staff socs ON socs.service_order_id = so.id
      WHERE so.consegna_staff_id = (SELECT auth.uid())
    )
  );

COMMIT;
