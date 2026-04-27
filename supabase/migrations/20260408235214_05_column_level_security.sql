-- View pública para limpeza, consegna e cliente (sem colunas de preço)
CREATE OR REPLACE VIEW public.properties_public AS
  SELECT
    id, name, client_type, agency_id, owner_id, zone,
    phone, email, address, zip_code,
    sqm_interior, sqm_exterior, sqm_total,
    min_guests, max_guests,
    double_beds, single_beds, sofa_beds, bathrooms, bidets, cribs,
    notes, created_at
  FROM public.properties;

-- View pública de profiles (sem colunas de remuneração) para secretaria
CREATE OR REPLACE VIEW public.profiles_public AS
  SELECT
    id, full_name, email, phone, role,
    birth_date, nationality, address, created_at
  FROM public.profiles;;
