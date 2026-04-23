-- ============================================================
-- 01_create_tables.sql
-- Cria as 4 tabelas principais na ordem correta (respeitando FK)
-- ============================================================

-- 1. profiles (vinculada a auth.users)
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  role            TEXT NOT NULL DEFAULT 'cliente'
                  CHECK (role IN ('admin', 'secretaria', 'limpeza', 'consegna', 'cliente')),
  birth_date      DATE,
  nationality     TEXT,
  address         TEXT,
  hourly_rate     NUMERIC(10, 2),
  monthly_salary  NUMERIC(10, 2),
  overtime_rate   NUMERIC(10, 2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. agencies
CREATE TABLE public.agencies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. owners
CREATE TABLE public.owners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. properties
CREATE TABLE public.properties (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  client_type         TEXT NOT NULL CHECK (client_type IN ('rental', 'particular')),
  agency_id           UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  owner_id            UUID REFERENCES public.owners(id) ON DELETE SET NULL,
  zone                TEXT NOT NULL CHECK (zone IN (
                        'Saint Peter',
                        'Piazza Navona',
                        'Trastevere Area',
                        'Colosseum',
                        'Spanish Steps',
                        'Trevi Fountain',
                        'Campo de''Fiori',
                        'Parioli',
                        'Termini Station',
                        'Other areas'
                      )),
  phone               TEXT,
  email               TEXT,
  address             TEXT,
  zip_code            TEXT,
  -- Metragem
  sqm_interior        NUMERIC(8, 2),
  sqm_exterior        NUMERIC(8, 2),
  sqm_total           NUMERIC(8, 2),
  -- Capacidade e Estrutura
  min_guests          INTEGER,
  max_guests          INTEGER,
  double_beds         INTEGER DEFAULT 0,
  single_beds         INTEGER DEFAULT 0,
  sofa_beds           INTEGER DEFAULT 0,
  bathrooms           INTEGER DEFAULT 0,
  bidets              INTEGER DEFAULT 0,
  cribs               INTEGER DEFAULT 0,
  -- Precificação e Tempo
  base_price          NUMERIC(10, 2),
  extra_per_person    NUMERIC(10, 2),
  avg_cleaning_hours  NUMERIC(4, 2),
  -- Observações
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. service_orders
CREATE TABLE public.service_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  cleaning_staff_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  consegna_staff_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cleaning_date       DATE,
  checkout_at         TIMESTAMPTZ,
  checkin_at          TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'in_progress', 'done')),
  -- Ocupação Real
  real_guests         INTEGER,
  double_beds         INTEGER DEFAULT 0,
  single_beds         INTEGER DEFAULT 0,
  sofa_beds           INTEGER DEFAULT 0,
  bathrooms           INTEGER DEFAULT 0,
  bidets              INTEGER DEFAULT 0,
  cribs               INTEGER DEFAULT 0,
  -- Financeiro
  total_price         NUMERIC(10, 2),
  -- Urgência: calculada se intervalo checkout→checkin < 4h
  is_urgent           BOOLEAN GENERATED ALWAYS AS (
                        CASE
                          WHEN checkin_at IS NOT NULL AND checkout_at IS NOT NULL
                          THEN EXTRACT(EPOCH FROM (checkin_at - checkout_at)) / 3600 < 4
                          ELSE FALSE
                        END
                      ) STORED,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
