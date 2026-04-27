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
  );;
