-- Add atomic service order creation and update procedure.
--
-- This function encapsulates inserting/updating a service order and synchronizing
-- its service_order_cleaning_staff links in a single database transaction.
-- It executes as SECURITY INVOKER with an explicit role guard allowing only
-- admin and secretaria application roles.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- 1. Preconditions
DO $preconditions$
BEGIN
  IF pg_catalog.to_regclass('public.service_orders') IS NULL THEN
    RAISE EXCEPTION 'Sprint 08 precondition failed: table public.service_orders not found';
  END IF;

  IF pg_catalog.to_regclass('public.service_order_cleaning_staff') IS NULL THEN
    RAISE EXCEPTION 'Sprint 08 precondition failed: table public.service_order_cleaning_staff not found';
  END IF;

  IF pg_catalog.to_regprocedure('public.get_my_role()') IS NULL THEN
    RAISE EXCEPTION 'Sprint 08 precondition failed: function public.get_my_role() not found';
  END IF;

  IF pg_catalog.to_regprocedure('public.save_service_order_atomic(uuid,uuid,uuid[],uuid,date,timestamptz,timestamptz,integer,integer,integer,integer,integer,integer,integer,integer,integer,text,text,numeric,text,numeric)') IS NOT NULL THEN
    RAISE EXCEPTION 'Sprint 08 precondition failed: save_service_order_atomic already exists';
  END IF;
END
$preconditions$;

-- 2. Atomic procedure definition
CREATE FUNCTION public.save_service_order_atomic(
  p_order_id UUID DEFAULT NULL,
  p_property_id UUID DEFAULT NULL,
  p_cleaning_staff_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_consegna_staff_id UUID DEFAULT NULL,
  p_cleaning_date DATE DEFAULT NULL,
  p_checkout_at TIMESTAMPTZ DEFAULT NULL,
  p_checkin_at TIMESTAMPTZ DEFAULT NULL,
  p_real_guests INTEGER DEFAULT NULL,
  p_double_beds INTEGER DEFAULT 0,
  p_single_beds INTEGER DEFAULT 0,
  p_sofa_beds INTEGER DEFAULT 0,
  p_armchair_beds INTEGER DEFAULT 0,
  p_bedrooms INTEGER DEFAULT 0,
  p_bathrooms INTEGER DEFAULT 0,
  p_bidets INTEGER DEFAULT 0,
  p_cribs INTEGER DEFAULT 0,
  p_cleaning_notes TEXT DEFAULT NULL,
  p_extra_services_description TEXT DEFAULT NULL,
  p_extra_services_price NUMERIC DEFAULT 0,
  p_pricing_mode TEXT DEFAULT 'standard',
  p_total_price NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_role text := public.get_my_role();
  v_result_id UUID;
  v_cleaned_staff_ids UUID[];
  v_valid_staff_count INTEGER;
BEGIN
  -- 1. Strict role authorization
  IF v_role NOT IN ('"admin"', '"secretaria"') THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Acesso não autorizado para salvar ordem de serviço.';
  END IF;

  -- 2. Field and foreign key validation
  IF p_property_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Imóvel é obrigatório.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = p_property_id) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Imóvel não encontrado.';
  END IF;

  IF p_pricing_mode NOT IN ('standard', 'ripasso', 'out_long_stay') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Modo de precificação inválido.';
  END IF;

  IF coalesce(p_double_beds, 0) < 0 OR coalesce(p_single_beds, 0) < 0 OR
     coalesce(p_sofa_beds, 0) < 0 OR coalesce(p_armchair_beds, 0) < 0 OR
     coalesce(p_bedrooms, 0) < 0 OR coalesce(p_bathrooms, 0) < 0 OR
     coalesce(p_bidets, 0) < 0 OR coalesce(p_cribs, 0) < 0 OR
     coalesce(p_real_guests, 0) < 0 OR coalesce(p_extra_services_price, 0) < 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Valores e quantidades não podem ser negativos.';
  END IF;

  -- Deduplicate and sanitize cleaning staff array
  SELECT ARRAY(
    SELECT DISTINCT u
    FROM unnest(coalesce(p_cleaning_staff_ids, ARRAY[]::UUID[])) AS u
    WHERE u IS NOT NULL
  ) INTO v_cleaned_staff_ids;

  IF cardinality(v_cleaned_staff_ids) > 3 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Máximo de 3 responsáveis de limpeza permitidos.';
  END IF;

  IF cardinality(v_cleaned_staff_ids) > 0 THEN
    SELECT count(*) INTO v_valid_staff_count
    FROM public.profiles
    WHERE id = ANY(v_cleaned_staff_ids);

    IF v_valid_staff_count <> cardinality(v_cleaned_staff_ids) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'Um ou mais funcionários de limpeza são inválidos.';
    END IF;
  END IF;

  IF p_consegna_staff_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_consegna_staff_id) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Entregador inválido.';
  END IF;

  -- 3. Update existing service order
  IF p_order_id IS NOT NULL THEN
    PERFORM 1
    FROM public.service_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0002',
        MESSAGE = 'Ordem de serviço não encontrada.';
    END IF;

    UPDATE public.service_orders
    SET
      property_id = p_property_id,
      consegna_staff_id = p_consegna_staff_id,
      cleaning_date = p_cleaning_date,
      checkout_at = p_checkout_at,
      checkin_at = p_checkin_at,
      real_guests = p_real_guests,
      double_beds = coalesce(p_double_beds, 0),
      single_beds = coalesce(p_single_beds, 0),
      sofa_beds = coalesce(p_sofa_beds, 0),
      armchair_beds = coalesce(p_armchair_beds, 0),
      bedrooms = coalesce(p_bedrooms, 0),
      bathrooms = coalesce(p_bathrooms, 0),
      bidets = coalesce(p_bidets, 0),
      cribs = coalesce(p_cribs, 0),
      cleaning_notes = p_cleaning_notes,
      extra_services_description = p_extra_services_description,
      extra_services_price = coalesce(p_extra_services_price, 0),
      pricing_mode = p_pricing_mode,
      total_price = p_total_price
    WHERE id = p_order_id;

    -- Sincronização atômica dos vínculos de limpeza
    DELETE FROM public.service_order_cleaning_staff
    WHERE service_order_id = p_order_id
      AND (cardinality(v_cleaned_staff_ids) = 0 OR profile_id <> ALL(v_cleaned_staff_ids));

    IF cardinality(v_cleaned_staff_ids) > 0 THEN
      INSERT INTO public.service_order_cleaning_staff (service_order_id, profile_id)
      SELECT p_order_id, staff_id
      FROM unnest(v_cleaned_staff_ids) AS staff_id
      ORDER BY staff_id
      ON CONFLICT (service_order_id, profile_id) DO NOTHING;
    END IF;

    RETURN p_order_id;
  END IF;

  -- 4. Create new service order
  INSERT INTO public.service_orders (
    property_id,
    consegna_staff_id,
    cleaning_date,
    checkout_at,
    checkin_at,
    status,
    real_guests,
    double_beds,
    single_beds,
    sofa_beds,
    armchair_beds,
    bedrooms,
    bathrooms,
    bidets,
    cribs,
    cleaning_notes,
    extra_services_description,
    extra_services_price,
    pricing_mode,
    total_price,
    cleaning_cycle
  ) VALUES (
    p_property_id,
    p_consegna_staff_id,
    p_cleaning_date,
    p_checkout_at,
    p_checkin_at,
    'open',
    p_real_guests,
    coalesce(p_double_beds, 0),
    coalesce(p_single_beds, 0),
    coalesce(p_sofa_beds, 0),
    coalesce(p_armchair_beds, 0),
    coalesce(p_bedrooms, 0),
    coalesce(p_bathrooms, 0),
    coalesce(p_bidets, 0),
    coalesce(p_cribs, 0),
    p_cleaning_notes,
    p_extra_services_description,
    coalesce(p_extra_services_price, 0),
    p_pricing_mode,
    p_total_price,
    1
  ) RETURNING id INTO v_result_id;

  IF cardinality(v_cleaned_staff_ids) > 0 THEN
    INSERT INTO public.service_order_cleaning_staff (service_order_id, profile_id)
    SELECT v_result_id, staff_id
    FROM unnest(v_cleaned_staff_ids) AS staff_id
    ORDER BY staff_id;
  END IF;

  RETURN v_result_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_service_order_atomic(uuid,uuid,uuid[],uuid,date,timestamptz,timestamptz,integer,integer,integer,integer,integer,integer,integer,integer,integer,text,text,numeric,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_service_order_atomic(uuid,uuid,uuid[],uuid,date,timestamptz,timestamptz,integer,integer,integer,integer,integer,integer,integer,integer,integer,text,text,numeric,text,numeric) TO authenticated, service_role;

COMMENT ON FUNCTION public.save_service_order_atomic IS 'Creates or updates a service order and synchronizes staff links atomically.';

COMMIT;
