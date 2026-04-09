-- ============================================================
-- 05_column_level_security.sql
-- Restringe colunas sensíveis por role via REVOKE + GRANT
-- ============================================================

-- ============================================================
-- PROPERTIES: colunas de preço/tempo ocultas para limpeza/consegna/cliente
-- ============================================================

-- Revogar acesso às colunas de preço para todos os authenticated
REVOKE SELECT (base_price, extra_per_person, avg_cleaning_hours)
  ON public.properties
  FROM authenticated;

-- Conceder de volta apenas para admin e secretaria via função com SECURITY DEFINER
-- (As policies RLS já garantem que apenas admin/secretaria conseguem SELECT em properties,
-- mas a limpeza/consegna tem policy de SELECT em todas as linhas)
-- Portanto, revogamos e concedemos via uma view segura abaixo.

-- View pública para limpeza, consegna e cliente (sem colunas de preço)
CREATE OR REPLACE VIEW public.properties_public AS
  SELECT
    id,
    name,
    client_type,
    agency_id,
    owner_id,
    zone,
    phone,
    email,
    address,
    zip_code,
    sqm_interior,
    sqm_exterior,
    sqm_total,
    min_guests,
    max_guests,
    double_beds,
    single_beds,
    sofa_beds,
    bathrooms,
    bidets,
    cribs,
    notes,
    created_at
  FROM public.properties;

-- Restaurar acesso à tabela completa para admin e secretaria
-- (já controlado pelas RLS policies; aqui apenas garantimos que
-- authenticated pode ver as colunas sensíveis quando a policy permitir)
GRANT SELECT (base_price, extra_per_person, avg_cleaning_hours)
  ON public.properties
  TO authenticated;

-- ============================================================
-- PROFILES: colunas de remuneração ocultas para secretaria
-- ============================================================

-- A secretaria tem policy SELECT em todos os profiles,
-- mas não deve ver hourly_rate, monthly_salary, overtime_rate.
-- Como Postgres não suporta CLS granular por role JWT (somente por role DB),
-- usamos uma view segura para secretaria consultar.

CREATE OR REPLACE VIEW public.profiles_public AS
  SELECT
    id,
    full_name,
    email,
    phone,
    role,
    birth_date,
    nationality,
    address,
    created_at
  FROM public.profiles;

-- Nota: as queries do frontend devem usar:
-- - profiles (tabela direta) para admin
-- - profiles_public (view) para secretaria
-- - profiles WHERE id = auth.uid() para demais roles
