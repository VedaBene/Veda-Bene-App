-- Add atomic property and relations creation and update procedure.
--
-- This function encapsulates inserting/updating a property and resolving/creating
-- its associated agency (for rental) or owner (for particular) in a single database transaction.
-- It executes as SECURITY INVOKER with an explicit role guard allowing only the admin application role.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- 1. Preconditions
DO $preconditions$
BEGIN
  IF pg_catalog.to_regclass('public.properties') IS NULL THEN
    RAISE EXCEPTION 'Sprint 09 precondition failed: table public.properties not found';
  END IF;

  IF pg_catalog.to_regclass('public.agencies') IS NULL THEN
    RAISE EXCEPTION 'Sprint 09 precondition failed: table public.agencies not found';
  END IF;

  IF pg_catalog.to_regclass('public.owners') IS NULL THEN
    RAISE EXCEPTION 'Sprint 09 precondition failed: table public.owners not found';
  END IF;

  IF pg_catalog.to_regprocedure('public.get_my_role()') IS NULL THEN
    RAISE EXCEPTION 'Sprint 09 precondition failed: function public.get_my_role() not found';
  END IF;

  IF pg_catalog.to_regprocedure('public.save_property_atomic(uuid,text,text,text,text,text,text,text,uuid,text,text,text,uuid,text,text,text,numeric,numeric,numeric,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,numeric,numeric,numeric,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Sprint 09 precondition failed: save_property_atomic already exists';
  END IF;
END
$preconditions$;

-- 2. Atomic procedure definition
CREATE FUNCTION public.save_property_atomic(
  p_property_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_client_type TEXT DEFAULT NULL,
  p_zone TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_zip_code TEXT DEFAULT NULL,
  -- rental
  p_agency_id UUID DEFAULT NULL,
  p_new_agency_name TEXT DEFAULT NULL,
  p_new_agency_email TEXT DEFAULT NULL,
  p_existing_agency_email TEXT DEFAULT NULL,
  -- particular
  p_owner_id UUID DEFAULT NULL,
  p_new_owner_name TEXT DEFAULT NULL,
  p_new_owner_email TEXT DEFAULT NULL,
  p_existing_owner_email TEXT DEFAULT NULL,
  -- sqm
  p_sqm_interior NUMERIC DEFAULT NULL,
  p_sqm_exterior NUMERIC DEFAULT NULL,
  p_sqm_total NUMERIC DEFAULT NULL,
  -- capacity
  p_min_guests INTEGER DEFAULT NULL,
  p_max_guests INTEGER DEFAULT NULL,
  p_double_beds INTEGER DEFAULT 0,
  p_single_beds INTEGER DEFAULT 0,
  p_sofa_beds INTEGER DEFAULT 0,
  p_armchair_beds INTEGER DEFAULT 0,
  p_bedrooms INTEGER DEFAULT 0,
  p_bathrooms INTEGER DEFAULT 0,
  p_bidets INTEGER DEFAULT 0,
  p_cribs INTEGER DEFAULT 0,
  -- pricing
  p_base_price NUMERIC DEFAULT NULL,
  p_extra_per_person NUMERIC DEFAULT NULL,
  p_avg_cleaning_hours NUMERIC DEFAULT NULL,
  -- notes
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_role text := public.get_my_role();
  v_result_id UUID;
  v_agency_id UUID := NULL;
  v_owner_id UUID := NULL;
  v_agency_name text;
  v_agency_email text;
  v_owner_name text;
  v_owner_email text;
  v_curr_email text;
  v_clean_email text;
BEGIN
  -- 1. Strict role authorization
  IF v_role <> '"admin"' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Acesso não autorizado para salvar imóvel.';
  END IF;

  -- 2. Basic field validations
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Nome do imóvel é obrigatório.';
  END IF;

  IF p_client_type NOT IN ('rental', 'particular') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Tipo de cliente inválido.';
  END IF;

  IF p_zone NOT IN (
    'Saint Peter', 'Piazza Navona', 'Trastevere Area', 'Colosseum',
    'Spanish Steps', 'Trevi Fountain', 'Campo de''Fiori', 'Parioli',
    'Termini Station', 'Other areas'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Zona inválida.';
  END IF;

  IF coalesce(p_double_beds, 0) < 0 OR coalesce(p_single_beds, 0) < 0 OR
     coalesce(p_sofa_beds, 0) < 0 OR coalesce(p_armchair_beds, 0) < 0 OR
     coalesce(p_bedrooms, 0) < 0 OR coalesce(p_bathrooms, 0) < 0 OR
     coalesce(p_bidets, 0) < 0 OR coalesce(p_cribs, 0) < 0 OR
     coalesce(p_min_guests, 0) < 0 OR coalesce(p_max_guests, 0) < 0 OR
     coalesce(p_sqm_interior, 0) < 0 OR coalesce(p_sqm_exterior, 0) < 0 OR
     coalesce(p_sqm_total, 0) < 0 OR coalesce(p_base_price, 0) < 0 OR
     coalesce(p_extra_per_person, 0) < 0 OR coalesce(p_avg_cleaning_hours, 0) < 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Valores e quantidades não podem ser negativos.';
  END IF;

  -- Email format validations
  IF p_email IS NOT NULL AND trim(p_email) <> '' AND trim(p_email) !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Email do imóvel inválido.';
  END IF;

  IF p_new_agency_email IS NOT NULL AND trim(p_new_agency_email) <> '' AND trim(p_new_agency_email) !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Email da nova agência inválido.';
  END IF;

  IF p_existing_agency_email IS NOT NULL AND trim(p_existing_agency_email) <> '' AND trim(p_existing_agency_email) !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Email da agência existente inválido.';
  END IF;

  IF p_new_owner_email IS NOT NULL AND trim(p_new_owner_email) <> '' AND trim(p_new_owner_email) !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Email do novo proprietário inválido.';
  END IF;

  IF p_existing_owner_email IS NOT NULL AND trim(p_existing_owner_email) <> '' AND trim(p_existing_owner_email) !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Email do proprietário existente inválido.';
  END IF;

  -- 3. Atomic relation resolution
  IF p_client_type = 'rental' THEN
    v_owner_id := NULL;
    IF p_new_agency_name IS NOT NULL AND trim(p_new_agency_name) <> '' THEN
      v_agency_name := trim(p_new_agency_name);
      v_agency_email := nullif(lower(trim(p_new_agency_email)), '');
      INSERT INTO public.agencies (name, email)
      VALUES (v_agency_name, v_agency_email)
      RETURNING id INTO v_agency_id;
    ELSIF p_agency_id IS NOT NULL THEN
      SELECT id, email INTO v_agency_id, v_curr_email
      FROM public.agencies
      WHERE id = p_agency_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Agência não encontrada.';
      END IF;

      IF p_existing_agency_email IS NOT NULL AND trim(p_existing_agency_email) <> '' THEN
        v_clean_email := lower(trim(p_existing_agency_email));
        IF v_curr_email IS NOT NULL AND trim(v_curr_email) <> '' THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Questa agenzia ha già un''email registrata.';
        ELSE
          UPDATE public.agencies
          SET email = v_clean_email
          WHERE id = v_agency_id;
        END IF;
      END IF;
    ELSE
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Agência é obrigatória para imóveis do tipo agência.';
    END IF;
  ELSE
    v_agency_id := NULL;
    IF p_new_owner_name IS NOT NULL AND trim(p_new_owner_name) <> '' THEN
      v_owner_name := trim(p_new_owner_name);
      v_owner_email := nullif(lower(trim(p_new_owner_email)), '');
      INSERT INTO public.owners (name, email)
      VALUES (v_owner_name, v_owner_email)
      RETURNING id INTO v_owner_id;
    ELSIF p_owner_id IS NOT NULL THEN
      SELECT id, email INTO v_owner_id, v_curr_email
      FROM public.owners
      WHERE id = p_owner_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Proprietário não encontrado.';
      END IF;

      IF p_existing_owner_email IS NOT NULL AND trim(p_existing_owner_email) <> '' THEN
        v_clean_email := lower(trim(p_existing_owner_email));
        IF v_curr_email IS NOT NULL AND trim(v_curr_email) <> '' THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Questo proprietario ha già un''email registrata.';
        ELSE
          UPDATE public.owners
          SET email = v_clean_email
          WHERE id = v_owner_id;
        END IF;
      END IF;
    ELSE
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Proprietário é obrigatório para imóveis do tipo particular.';
    END IF;
  END IF;

  -- 4. Property persist
  IF p_property_id IS NOT NULL THEN
    PERFORM 1
    FROM public.properties
    WHERE id = p_property_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Imóvel não encontrado.';
    END IF;

    UPDATE public.properties
    SET
      name = trim(p_name),
      client_type = p_client_type,
      agency_id = v_agency_id,
      owner_id = v_owner_id,
      zone = p_zone,
      phone = nullif(trim(p_phone), ''),
      email = nullif(lower(trim(p_email)), ''),
      address = nullif(trim(p_address), ''),
      zip_code = nullif(trim(p_zip_code), ''),
      sqm_interior = p_sqm_interior,
      sqm_exterior = p_sqm_exterior,
      sqm_total = p_sqm_total,
      min_guests = p_min_guests,
      max_guests = p_max_guests,
      double_beds = coalesce(p_double_beds, 0),
      single_beds = coalesce(p_single_beds, 0),
      sofa_beds = coalesce(p_sofa_beds, 0),
      armchair_beds = coalesce(p_armchair_beds, 0),
      bedrooms = coalesce(p_bedrooms, 0),
      bathrooms = coalesce(p_bathrooms, 0),
      bidets = coalesce(p_bidets, 0),
      cribs = coalesce(p_cribs, 0),
      base_price = p_base_price,
      extra_per_person = p_extra_per_person,
      avg_cleaning_hours = p_avg_cleaning_hours,
      notes = nullif(trim(p_notes), '')
    WHERE id = p_property_id;

    RETURN p_property_id;
  END IF;

  -- Create mode
  INSERT INTO public.properties (
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
    armchair_beds,
    bedrooms,
    bathrooms,
    bidets,
    cribs,
    base_price,
    extra_per_person,
    avg_cleaning_hours,
    notes
  ) VALUES (
    trim(p_name),
    p_client_type,
    v_agency_id,
    v_owner_id,
    p_zone,
    nullif(trim(p_phone), ''),
    nullif(lower(trim(p_email)), ''),
    nullif(trim(p_address), ''),
    nullif(trim(p_zip_code), ''),
    p_sqm_interior,
    p_sqm_exterior,
    p_sqm_total,
    p_min_guests,
    p_max_guests,
    coalesce(p_double_beds, 0),
    coalesce(p_single_beds, 0),
    coalesce(p_sofa_beds, 0),
    coalesce(p_armchair_beds, 0),
    coalesce(p_bedrooms, 0),
    coalesce(p_bathrooms, 0),
    coalesce(p_bidets, 0),
    coalesce(p_cribs, 0),
    p_base_price,
    p_extra_per_person,
    p_avg_cleaning_hours,
    nullif(trim(p_notes), '')
  ) RETURNING id INTO v_result_id;

  RETURN v_result_id;
END;
$function$;

-- 3. Grants restritos
REVOKE ALL ON FUNCTION public.save_property_atomic(uuid,text,text,text,text,text,text,text,uuid,text,text,text,uuid,text,text,text,numeric,numeric,numeric,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,numeric,numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_property_atomic(uuid,text,text,text,text,text,text,text,uuid,text,text,text,uuid,text,text,text,numeric,numeric,numeric,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,numeric,numeric,numeric,text) TO authenticated, service_role;

COMMENT ON FUNCTION public.save_property_atomic IS 'Creates or updates a property and resolves its agency or owner relation atomically.';

COMMIT;
