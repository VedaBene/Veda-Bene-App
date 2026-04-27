# ADR 002 — CLS via filtro de `select()` na aplicação

**Status**: Aceita
**Data**: 2026-04-22

## Contexto

Algumas colunas só devem ser visíveis para certos roles:

- `properties.base_price`, `extra_per_person`, `avg_cleaning_hours` → apenas admin
- `profiles.hourly_rate`, `monthly_salary`, `overtime_rate` → apenas admin
- Notas de comissão e dados pessoais sensíveis → roles específicos

**Row Level Security** (RLS) protege *linhas* — uma policy `SELECT` decide se
o usuário pode ver uma linha inteira ou nenhuma. Não consegue esconder
*colunas* específicas.

Para esconder colunas precisamos de **Column Level Security** (CLS), que tem
três caminhos no Postgres/Supabase:

1. `REVOKE SELECT (col) ON tabela FROM role` + `GRANT SELECT (col) TO outro_role`
2. Views com `SECURITY INVOKER` que omitem as colunas sensíveis para certos roles
3. Filtragem na camada de aplicação (Server Components / Server Actions)

## Histórico

A migration `05_column_level_security.sql` originalmente tentou as opções 1+2
juntas: criou views `properties_public` e `profiles_public` e fez REVOKE/GRANT
nas colunas sensíveis. Isso **não funcionou** por dois motivos:

- O Supabase usa um único role Postgres `authenticated` para *todos* os usuários
  logados, independente do role de negócio. Logo, REVOKE/GRANT não consegue
  diferenciar admin de limpeza nesse nível.
- As views, ao serem usadas no PostgREST, vieram com `SECURITY DEFINER`
  implícito ou problemas de performance, e foram dropadas na migration
  `20260422120000_harden_supabase_security_surface.sql`.

Resultado: o REVOKE+GRANT da migration original cancelam-se mutuamente e as
views não existem mais. **A defesa real está só na aplicação hoje.**

## Decisão

CLS é implementada na camada de Server Components / Server Actions, escolhendo
explicitamente as colunas no `select()` baseado no role:

```ts
const propertiesSelect =
  role === 'admin' || role === 'secretaria'
    ? 'id, name, zone, address, client_type, base_price'
    : 'id, name, zone, address'

const { data } = await supabase.from('properties').select(propertiesSelect)
```

E view-models em `lib/server/view-models.ts` reforçam removendo campos sensíveis
do DTO antes de mandar para o cliente.

## Consequências

**Positivas**:
- Funciona sem hack no banco — comportamento previsível
- Fácil de auditar: basta procurar `from('properties').select(`
- Sem custo de manter views sincronizadas com o schema

**Negativas**:
- A defesa fica **toda em Server Components**. Se alguém criar uma página nova
  e esquecer de filtrar o select, vaza dado.
- Não há salvaguarda no banco — um bug de RLS combinado com select sem filtro
  pode expor `base_price` a um role não autorizado.
- Difícil de testar via SQL puro: precisa testar via aplicação rodando.

## Salvaguardas recomendadas

1. **Teste de integração por role** — logar como cada role e verificar quais
   campos chegam (planejado, ver auditoria princípio 8)
2. **Code review obrigatório** em qualquer arquivo `app/**/page.tsx` que use
   `from('properties')` ou `from('profiles')`
3. **Padrão de código**: sempre listar colunas explícitas, nunca `select('*')`

## Alternativas consideradas

- **REVOKE/GRANT no banco**: descartada — Supabase usa um único role
  `authenticated`, não diferencia.
- **Views `properties_public` / `profiles_public`**: tentada, dropada por causa
  de problemas com `SECURITY DEFINER` no PostgREST. Manter views sincronizadas
  com o schema também era custo alto.
- **Coluna `pg_policies` granular por coluna (PG 15+)**: viável tecnicamente,
  mas Supabase JS não tem boa ergonomia para isso e seria inconsistente com
  o resto do RLS via `get_my_role()`.

## Referências

- `supabase/migrations/20260408235214_05_column_level_security.sql` —
  tentativa original (REVOKE+GRANT cancelam-se hoje)
- `supabase/migrations/20260422120000_harden_supabase_security_surface.sql` —
  drop das views
- `app/(app)/properties/page.tsx` — exemplo do padrão de filtro
- `lib/server/view-models.ts` — DTO mapping por role
