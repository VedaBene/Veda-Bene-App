-- ============================================================
-- 03_rls_helper.sql
-- Função helper get_my_role() e custom_access_token_hook
-- ============================================================

-- Função que lê app_role do JWT atual
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_role',
    current_setting('request.jwt.claims', true)::jsonb -> 'role'
  )::text::text
$$;

-- Custom Access Token Hook: injeta app_role no JWT a partir de profiles
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims       JSONB;
  user_role    TEXT;
BEGIN
  -- Buscar o role do usuário na tabela profiles
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = (event->>'user_id')::UUID;

  -- Fallback para 'cliente' se não encontrado
  IF user_role IS NULL THEN
    user_role := 'cliente';
  END IF;

  claims := event->'claims';
  claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Conceder permissão para o hook ser chamado pelo auth
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC, anon, authenticated;

-- ATENÇÃO: Após executar este script, vá em:
-- Authentication > Hooks > Custom Access Token Hook
-- e associe a função public.custom_access_token_hook
