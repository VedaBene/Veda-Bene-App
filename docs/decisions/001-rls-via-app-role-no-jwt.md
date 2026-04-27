# ADR 001 — RLS via `app_role` no JWT

**Status**: Aceita
**Data**: 2026-04-08

## Contexto

O Veda Bene tem 5 perfis de acesso (admin, secretaria, limpeza, consegna, cliente)
e cada perfil enxerga um subconjunto diferente das tabelas `properties`,
`service_orders`, `profiles` etc. A regra de visibilidade precisa ser aplicada
no banco (Row Level Security do Postgres/Supabase), não só no app —
caso contrário um cliente Supabase JS no frontend poderia bypassar.

A política RLS precisa saber **qual o role do usuário atual** a cada query.
Existiam três alternativas:

1. Consultar `profiles.role` dentro da policy a cada chamada
2. Injetar o role no JWT via `custom_access_token_hook` e ler do token
3. Usar `auth.jwt() ->> 'role'` direto, sem hook

## Decisão

Adotamos a opção 2: um Postgres function `custom_access_token_hook` (configurada
no Supabase Auth) injeta o claim `app_role` no JWT no momento do login.
A função `get_my_role()` lê esse claim para uso nas policies:

```sql
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT auth.jwt() -> 'app_role';
$$;
```

E as policies comparam contra valores **com aspas duplas embutidas**:

```sql
CREATE POLICY "..." ON public.properties
  USING (public.get_my_role() = '"admin"');
```

## Por que `'"admin"'` e não `'admin'`

A função `get_my_role()` usa o operador `->` (não `->>`), que retorna **JSONB**,
não `text`. Quando você compara um JSONB string com um literal SQL, o literal
precisa estar no formato JSON — ou seja, com aspas embutidas. Por isso
`'"admin"'` (aspas simples + aspas duplas) e não `'admin'`.

Trocar para `->>` simplificaria a comparação (`= 'admin'`), mas exigiria
reescrever todas as policies de uma vez. Mantivemos o padrão atual por
estabilidade.

## Consequências

**Positivas**:
- Zero queries extras na hora de avaliar policies — o role vem no token
- Performance previsível mesmo com muitas tabelas com RLS
- Funciona offline-friendly (token contém tudo)

**Negativas**:
- Usuário precisa fazer logout/login após mudança de role (token só é
  reemitido no refresh)
- Sintaxe `'"admin"'` é confusa para quem chega novo — fonte recorrente de bugs
- Requer manter o `custom_access_token_hook` configurado e testado

## Alternativas consideradas

- **Opção 1 (consultar profiles na policy)**: descartada por causa de
  performance e risco de recursão (RLS de profiles disparando RLS de profiles).
  De fato, isso já causou o bug corrigido na migration
  `20260410234816_fix_rls_infinite_recursion.sql`.
- **Opção 3 (sem hook)**: descartada porque o claim `role` padrão do Supabase
  JWT é `authenticated`, não o role de negócio. Precisaríamos de um claim
  customizado de qualquer forma.

## Referências

- `supabase/migrations/20260408235140_*_create_tables.sql` — definição original
- `supabase/migrations/20260422120000_harden_supabase_security_surface.sql` —
  pinagem de `search_path` em `get_my_role()`
