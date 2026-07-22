BEGIN;

ALTER TABLE public.service_orders
  ADD COLUMN consegna_fee NUMERIC(10,2) NOT NULL DEFAULT 10
  CHECK (consegna_fee = 10);

-- OSs existentes já possuem um total persistido sem a taxa de Consegna.
-- A taxa é adicionada uma única vez ao migrar os dados históricos.
UPDATE public.service_orders
SET total_price = total_price + consegna_fee
WHERE total_price IS NOT NULL;

COMMIT;
