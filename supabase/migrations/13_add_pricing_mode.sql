-- Modo de precificação da OS:
--   standard      -> base_price + extra_per_person * max(0, real_guests - min_guests) + extra_services_price
--   ripasso       -> base_price * 0.6 + extra_services_price
--   out_long_stay -> (worked_minutes / 60) * 25 + extra_services_price  (calculado ao finalizar)
ALTER TABLE service_orders
  ADD COLUMN pricing_mode TEXT NOT NULL DEFAULT 'standard'
    CHECK (pricing_mode IN ('standard', 'ripasso', 'out_long_stay'));
