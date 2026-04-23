-- ============================================================
-- 08_time_tracking.sql
-- Adiciona rastreamento de tempo nas ordens de serviço:
--   started_at       — quando o funcionário iniciou a limpeza
--   completion_notes — observações ao concluir
--   worked_minutes   — minutos trabalhados (GENERATED de started_at→completed_at)
-- E adiciona política RLS de UPDATE para limpeza/consegna nas próprias OSs
-- ============================================================

ALTER TABLE public.service_orders
  ADD COLUMN started_at        TIMESTAMPTZ,
  ADD COLUMN completion_notes  TEXT,
  ADD COLUMN worked_minutes    INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN started_at IS NOT NULL AND completed_at IS NOT NULL
      THEN FLOOR(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60)::INTEGER
      ELSE NULL
    END
  ) STORED;

-- Permite que limpeza atualize as próprias OSs (início e conclusão)
CREATE POLICY "service_orders_limpeza_update"
  ON public.service_orders FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = '"limpeza"'
    AND cleaning_staff_id = auth.uid()
  )
  WITH CHECK (
    public.get_my_role() = '"limpeza"'
    AND cleaning_staff_id = auth.uid()
  );

-- Permite que consegna atualize as próprias OSs (início e conclusão)
CREATE POLICY "service_orders_consegna_update"
  ON public.service_orders FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = '"consegna"'
    AND consegna_staff_id = auth.uid()
  )
  WITH CHECK (
    public.get_my_role() = '"consegna"'
    AND consegna_staff_id = auth.uid()
  );
