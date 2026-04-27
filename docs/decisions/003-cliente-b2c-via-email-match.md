# ADR 003 — Identificação de cliente B2C via match de email

**Status**: Aceita
**Data**: 2026-04-10

## Contexto

O Veda Bene atende dois tipos de clientes:

- **B2B (rental)**: agência imobiliária com múltiplos imóveis (`agencies`)
- **B2C (particular)**: proprietário individual (`owners`)

O sistema também tem um perfil `cliente` em `profiles` (com login no Supabase
Auth) que precisa ver **apenas seus próprios imóveis e OS**.

Não havia coluna de FK direta entre `profiles` e `agencies`/`owners`. Tínhamos
duas opções:

1. Adicionar colunas `profile_id` em `agencies` e `owners`
2. Usar o **email** como chave natural — `profiles.email = owners.email` ou
   `profiles.email = agencies.email`

## Decisão

Adotamos a opção 2 (email-match), encapsulada na função SECURITY DEFINER
`client_property_ids(uid)`:

```sql
CREATE OR REPLACE FUNCTION public.client_property_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT p.id
  FROM public.properties p
  WHERE p.owner_id IN (
    SELECT o.id FROM public.owners o
    JOIN public.profiles pr ON pr.email = o.email
    WHERE pr.id = uid
  )
  OR p.agency_id IN (
    SELECT a.id FROM public.agencies a
    JOIN public.profiles pr ON pr.email = a.email
    WHERE pr.id = uid
  );
$$;
```

As policies de `properties` e `service_orders` usam essa função no `IN (...)`
para restringir as linhas visíveis ao `cliente`.

## Por que SECURITY DEFINER

A policy do role `cliente` em `properties` precisa fazer um JOIN em `owners`
e `agencies`. Mas essas tabelas têm RLS próprio que **bloqueia o cliente**.
Resultado: a policy nunca encontrava match, e o cliente via 0 imóveis (bug
real, ver migration `20260426120000_fix_properties_cliente_select_use_helper.sql`).

`SECURITY DEFINER` faz a função rodar com permissões do dono (postgres),
ignorando RLS dentro do JOIN. É seguro porque a função recebe `uid` como
parâmetro e a policy passa `auth.uid()` — não há como um cliente forjar outro
uid.

## Consequências

**Positivas**:
- Não exige coluna nova nem migração de dados
- Suporta múltiplos owners/agencies com mesmo email se necessário
- Onboarding de cliente: basta criar `profile` com mesmo email do `owner`/`agency`

**Negativas**:
- **Email é mutável** — se o admin mudar o email no `owners` mas não no
  `profiles` (ou vice-versa), o cliente perde acesso aos próprios imóveis
- Email é case-sensitive em comparação de string — pode dar mismatch sutil
  (`"João@x.com"` vs `"joao@x.com"`)
- Performance: o JOIN roda a cada query do cliente — `client_property_ids` é
  STABLE então o Postgres pode cachear, mas ainda assim é mais lento que FK
  direta
- A função SECURITY DEFINER é uma superfície de risco — qualquer alteração
  precisa garantir que `uid` continua sendo o único caminho de acesso

## Salvaguardas

1. `client_property_ids` recebe `uid` como parâmetro — sempre chamada com
   `auth.uid()` na policy. Não há overload sem parâmetro
2. `search_path` pinado em `public` (migration de hardening)
3. Função é STABLE, não VOLATILE — sinaliza ao Postgres que pode cachear
4. `LOWER()` nos emails seria uma melhoria futura (não implementado hoje)

## Alternativas consideradas

- **FK `profile_id` em owners/agencies**: mais robusto a longo prazo, mas
  exige migração de dados existentes e duplicação de identidade
  (`profile.email` + `owner.email`). Pode ser revisitado se email-match
  causar mais bugs.
- **Coluna `client_property_ids` materializada em profiles**: cacheável, mas
  precisaria de trigger para manter sincronizado a cada mudança de owner ou
  agency. Complexidade alta para benefício duvidoso.

## Referências

- `supabase/migrations/20260410234816_fix_rls_infinite_recursion.sql` —
  criação da função
- `supabase/migrations/20260426120000_fix_properties_cliente_select_use_helper.sql` —
  bug real causado por não usar a função no SELECT de properties
