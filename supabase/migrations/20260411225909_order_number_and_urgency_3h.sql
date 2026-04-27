-- 1. Adiciona número sequencial às ordens de serviço
CREATE SEQUENCE IF NOT EXISTS service_orders_order_number_seq;
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS order_number INTEGER DEFAULT nextval('service_orders_order_number_seq');
ALTER SEQUENCE service_orders_order_number_seq OWNED BY public.service_orders.order_number;

-- 2. Altera critério de urgência de 4h para 3h
ALTER TABLE public.service_orders DROP COLUMN is_urgent;
ALTER TABLE public.service_orders ADD COLUMN is_urgent BOOLEAN GENERATED ALWAYS AS (
  CASE
    WHEN checkin_at IS NOT NULL AND checkout_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (checkin_at - checkout_at)) / 3600 < 3
    ELSE FALSE
  END
) STORED;;
