-- Corrige critério de urgência de < 3h para <= 3h (3 horas ou menos)
ALTER TABLE public.service_orders DROP COLUMN is_urgent;
ALTER TABLE public.service_orders ADD COLUMN is_urgent BOOLEAN GENERATED ALWAYS AS (
  CASE
    WHEN checkin_at IS NOT NULL AND checkout_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (checkin_at - checkout_at)) / 3600 <= 3
    ELSE FALSE
  END
) STORED;
