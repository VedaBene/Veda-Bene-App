-- Add bedrooms and armchair_beds to properties and service_orders

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS bedrooms       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS armchair_beds  INTEGER DEFAULT 0;

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS bedrooms       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS armchair_beds  INTEGER DEFAULT 0;
