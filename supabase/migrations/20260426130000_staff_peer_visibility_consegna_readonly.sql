-- ============================================================
-- Visibilidade mútua entre limpeza e consegna + consegna read-only
--
-- 1. Limpeza e consegna passam a enxergar perfis de colegas que
--    compartilham uma OS com eles (apenas peer-staff atribuídos
--    juntos numa OS). O frontend já restringe os campos lidos a
--    (id, full_name).
--
-- 2. Consegna deixa de poder atualizar service_orders — torna-se
--    apenas leitura. As ações de iniciar/finalizar a limpeza
--    passam a ser exclusivas do responsável de limpeza.
-- ============================================================

BEGIN;

-- 1. Visibilidade mútua de peers (profiles) numa OS comum
CREATE POLICY "profiles_staff_peer_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() IN ('"limpeza"', '"consegna"')
    AND id IN (
      SELECT consegna_staff_id
      FROM public.service_orders
      WHERE cleaning_staff_id = auth.uid()
        AND consegna_staff_id IS NOT NULL
      UNION
      SELECT cleaning_staff_id
      FROM public.service_orders
      WHERE consegna_staff_id = auth.uid()
        AND cleaning_staff_id IS NOT NULL
    )
  );

-- 2. Remove permissão de UPDATE da consegna em service_orders
DROP POLICY IF EXISTS "service_orders_consegna_update" ON public.service_orders;

COMMIT;
