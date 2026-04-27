
-- Tópico 4: Observações de limpeza
ALTER TABLE service_orders
  ADD COLUMN cleaning_notes TEXT;

-- Tópico 5: Serviços extras
ALTER TABLE service_orders
  ADD COLUMN extra_services_description TEXT,
  ADD COLUMN extra_services_price NUMERIC(10,2) DEFAULT 0;
;
