# Sprint 05 — Dossiê DB-P do cutover de confidencialidade de colunas

**Status:** completed — implementação local, aplicação e validação remota
concluídas em 2026-08-19

**Data do diagnóstico:** 2026-08-19

**Classificação:** DB-P — migration de privilégios PostgreSQL, sem alteração de dados

## 1. Veredito arquitetural

A ADR 002 tornou `select()` explícito e DTOs mínimos uma defesa útil, mas não
uma barreira contra chamadas autenticadas diretas à Data API. O cutover deve
retirar o `SELECT` de tabela do role compartilhado `authenticated` e devolver
somente privilégios de coluna para o contrato seguro comum aos cinco papéis.
RLS continua delimitando linhas; os adapters server-only da Sprint 03 atendem
os casos autorizados que precisam das colunas retiradas.

Views não aumentam a profundidade desta interface e criariam outra superfície
para manter e auditar. Nenhuma view será criada. O seam permanece
`lib/server/data-access/sensitive-data.ts`: ele autentica e autoriza antes de
criar o client privilegiado, aceita operações de negócio estreitas e retorna
DTOs mínimos.

## 2. Gate e fontes

### 2.1 Dependências verificadas

- Sprints 00–04 constam como `completed` no roadmap e possuem commits e
  artefatos correspondentes.
- Sprint 01: runner descartável, matriz pgTAP e invariantes presentes.
- Sprint 03: matriz canônica, adapter server-only, teste arquitetural e smoke
  autenticado dos cinco papéis presentes.
- Sprint 04: migration `20260818031745_guard_service_order_updates.sql`, ADR
  017, 46 testes próprios e evidência remota registrada.
- Reexecução pré-Sprint 05 de `npm run test:supabase`: 103 pgTAP PASS; somente
  os sete TODOs de leitura reservados a esta sprint falharam como esperado;
  invariantes, fotos e lint dos schemas PASS.
- Alterações locais preexistentes `AGENTS.md` e `output/` estão preservadas e
  fora do escopo.

### 2.2 Documentação consultada

- Supabase: Column Level Security e Securing your API, consultados em
  2026-08-19.
- PostgreSQL: `GRANT`, `REVOKE` e privilégios de coluna.
- Next.js 16 local: Data Security e `use server`.
- ADRs 002, 005, 006 e 017, política de dados de produção e roadmap ativo.

Conclusões aplicáveis:

- grants decidem quais objetos/colunas a Data API alcança; RLS decide linhas;
- um grant de tabela neutraliza qualquer tentativa de revogar uma coluna;
- depois de privilégios por coluna, `select('*')` falha deliberadamente;
- todos os papéis de negócio usam o role PostgreSQL `authenticated`, portanto
  até `admin` deve obter colunas restritas pelo adapter server-only;
- `service_role` permanece integral e exclusivamente server-side; nenhum client
  privilegiado bruto é exportado.

## 3. Threat model e matriz final

### 3.1 Atores e caminhos

| Ator | Caminho legítimo | Caminho a bloquear |
|---|---|---|
| `admin` | telas, dashboard, extratos, CSV/PDF e adapters server-only | leitura manual das colunas restritas pela Data API |
| `secretaria` | operações de imóveis/O.S. e pricing server-side | preços, remuneração e PII de perfis pela Data API |
| `limpeza` | O.S. atribuídas até hoje e estimativas operacionais pelo adapter | preços, remuneração, PII de pares e extras financeiros diretos |
| `consegna` | O.S. atribuídas até hoje e estimativas operacionais pelo adapter | preços, remuneração, PII de pares e extras financeiros diretos |
| `cliente` | seus imóveis/O.S. e estimativa ligada à O.S. pelo adapter | preços, remuneração e extras financeiros diretos |
| `service_role` | somente adapters autenticados/autorizados no servidor | browser, client bundle, export genérico ou RPC pública |

### 3.2 Colunas com `SELECT` revogado de `authenticated`

| Tabela | Colunas restritas | Uso legítimo preservado |
|---|---|---|
| `profiles` | `email`, `phone`, `birth_date`, `nationality`, `address`, `hourly_rate`, `monthly_salary`, `overtime_rate` | administração de funcionários, A Pagar e dashboard via `loadEmployee*ForAdministration`, `loadPayableFinancialSource` e `loadDashboardFinancialSource` |
| `properties` | `base_price`, `extra_per_person`, `avg_cleaning_hours` | administração, pricing, estimativa operacional, A Pagar/A Receber e dashboard via operações `load*` do adapter |
| `service_orders` | `total_price`, `extra_services_description`, `extra_services_price`, `consegna_fee` | extras autorizados, pricing, A Receber e dashboard via `loadAuthorizedServiceOrderOperationalFinancialFields`, `loadAuthorizedOrderPricingContext`, `loadReceivableFinancialSource` e `loadDashboardFinancialSource` |

A ampliação de `profiles` fecha uma exposição descoberta na validação final:
`profiles_secretaria_select` e `profiles_staff_peer_select`, combinadas ao grant
de tabela, permitiam ler PII que a aplicação não entrega a esses papéis. O
adapter administrativo já cobre o único uso legítimo atual, exclusivo de
`admin`, portanto a restrição preserva comportamento.

### 3.3 Colunas seguras concedidas diretamente a `authenticated`

| Tabela | Colunas seguras |
|---|---|
| `profiles` | `id`, `full_name`, `role`, `created_at` |
| `properties` | `id`, `name`, `client_type`, `agency_id`, `owner_id`, `zone`, `phone`, `email`, `address`, `zip_code`, `sqm_interior`, `sqm_exterior`, `sqm_total`, `min_guests`, `max_guests`, `double_beds`, `single_beds`, `sofa_beds`, `bathrooms`, `bidets`, `cribs`, `notes`, `created_at`, `bedrooms`, `armchair_beds` |
| `service_orders` | `id`, `property_id`, `cleaning_staff_id`, `consegna_staff_id`, `cleaning_date`, `checkout_at`, `checkin_at`, `status`, `real_guests`, `double_beds`, `single_beds`, `sofa_beds`, `bathrooms`, `bidets`, `cribs`, `completed_at`, `created_at`, `started_at`, `completion_notes`, `worked_minutes`, `bedrooms`, `armchair_beds`, `order_number`, `is_urgent`, `cleaning_notes`, `pricing_mode`, `cleaning_cycle` |

`pricing_mode`, notas operacionais e campos necessários a listagens/joins
permanecem diretos para não alterar o contrato visível atual. Esta sprint
preserva os grants table-level de `INSERT`, `UPDATE` e `DELETE` necessários aos
fluxos atuais e não altera policies nem o guard da Sprint 04. Os privilégios
administrativos desnecessários `TRUNCATE`, `REFERENCES`, `TRIGGER` e `MAINTAIN`,
encontrados no preflight remoto, são revogados junto de `SELECT`; apenas este
último é reintroduzido por coluna segura.

## 4. Pré-condições e detecção de drift

A migration abortará atomicamente se:

- qualquer uma das três tabelas ou suas listas/ordens de colunas divergir;
- RLS não estiver habilitado em qualquer tabela;
- os grants table-level de `authenticated` divergirem do estado anterior exato
  (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` e
  `MAINTAIN`), ou já existirem ACLs de coluna específicas;
- `service_role` não mantiver `SELECT` integral necessário aos adapters;
- as views históricas `profiles_public` ou `properties_public` existirem;
- os postconditions não encontrarem exatamente as listas seguras aprovadas ou
  ainda encontrarem grant table-level de `SELECT` para `authenticated`.

Não há DDL com `IF EXISTS`/`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP`, upsert
ou fallback que aceite drift. O `IF EXISTS (SELECT ...)` do bloco de
preconditions faz o oposto: detecta RLS/tipo de relação incompatível e aborta a
transação.

## 5. SQL exato proposto

```sql
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
DECLARE
  actual_columns text[];
  actual_table_privileges text[];
  actual_column_select_grants text[];
BEGIN
  IF pg_catalog.to_regclass('public.profiles') IS NULL
     OR pg_catalog.to_regclass('public.properties') IS NULL
     OR pg_catalog.to_regclass('public.service_orders') IS NULL THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  IF pg_catalog.to_regclass('public.profiles_public') IS NOT NULL
     OR pg_catalog.to_regclass('public.properties_public') IS NOT NULL THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  SELECT pg_catalog.array_agg(columns.column_name::text ORDER BY columns.ordinal_position)
  INTO actual_columns
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public' AND columns.table_name = 'profiles';

  IF actual_columns IS DISTINCT FROM ARRAY[
    'id', 'full_name', 'email', 'phone', 'role', 'birth_date', 'nationality',
    'address', 'hourly_rate', 'monthly_salary', 'overtime_rate', 'created_at'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  SELECT pg_catalog.array_agg(columns.column_name::text ORDER BY columns.ordinal_position)
  INTO actual_columns
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public' AND columns.table_name = 'properties';

  IF actual_columns IS DISTINCT FROM ARRAY[
    'id', 'name', 'client_type', 'agency_id', 'owner_id', 'zone', 'phone',
    'email', 'address', 'zip_code', 'sqm_interior', 'sqm_exterior', 'sqm_total',
    'min_guests', 'max_guests', 'double_beds', 'single_beds', 'sofa_beds',
    'bathrooms', 'bidets', 'cribs', 'base_price', 'extra_per_person',
    'avg_cleaning_hours', 'notes', 'created_at', 'bedrooms', 'armchair_beds'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  SELECT pg_catalog.array_agg(columns.column_name::text ORDER BY columns.ordinal_position)
  INTO actual_columns
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public' AND columns.table_name = 'service_orders';

  IF actual_columns IS DISTINCT FROM ARRAY[
    'id', 'property_id', 'cleaning_staff_id', 'consegna_staff_id',
    'cleaning_date', 'checkout_at', 'checkin_at', 'status', 'real_guests',
    'double_beds', 'single_beds', 'sofa_beds', 'bathrooms', 'bidets', 'cribs',
    'total_price', 'completed_at', 'created_at', 'started_at',
    'completion_notes', 'worked_minutes', 'bedrooms', 'armchair_beds',
    'order_number', 'is_urgent', 'cleaning_notes',
    'extra_services_description', 'extra_services_price', 'pricing_mode',
    'consegna_fee', 'cleaning_cycle'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname IN ('profiles', 'properties', 'service_orders')
      AND (relation.relkind <> 'r' OR NOT relation.relrowsecurity)
  ) THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  SELECT pg_catalog.array_agg(
    namespace.nspname || '.' || relation.relname || '.' || acl.privilege_type
    ORDER BY namespace.nspname, relation.relname, acl.privilege_type
  )
  INTO actual_table_privileges
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
  JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
  WHERE namespace.nspname = 'public'
    AND relation.relname IN ('profiles', 'properties', 'service_orders')
    AND grantee.rolname = 'authenticated';

  IF actual_table_privileges IS DISTINCT FROM ARRAY[
    'public.profiles.DELETE', 'public.profiles.INSERT',
    'public.profiles.MAINTAIN', 'public.profiles.REFERENCES',
    'public.profiles.SELECT', 'public.profiles.TRIGGER',
    'public.profiles.TRUNCATE', 'public.profiles.UPDATE',
    'public.properties.DELETE', 'public.properties.INSERT',
    'public.properties.MAINTAIN', 'public.properties.REFERENCES',
    'public.properties.SELECT', 'public.properties.TRIGGER',
    'public.properties.TRUNCATE', 'public.properties.UPDATE',
    'public.service_orders.DELETE', 'public.service_orders.INSERT',
    'public.service_orders.MAINTAIN', 'public.service_orders.REFERENCES',
    'public.service_orders.SELECT', 'public.service_orders.TRIGGER',
    'public.service_orders.TRUNCATE', 'public.service_orders.UPDATE'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  IF NOT pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.properties', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.service_orders', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.profiles', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.properties', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.service_orders', 'SELECT') THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;

  SELECT pg_catalog.array_agg(
    namespace.nspname || '.' || relation.relname || '.' || attribute.attname
    ORDER BY namespace.nspname, relation.relname, attribute.attnum
  )
  INTO actual_column_select_grants
  FROM pg_catalog.pg_attribute AS attribute
  JOIN pg_catalog.pg_class AS relation ON relation.oid = attribute.attrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
  JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
  WHERE namespace.nspname = 'public'
    AND relation.relname IN ('profiles', 'properties', 'service_orders')
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped
    AND grantee.rolname = 'authenticated'
    AND acl.privilege_type = 'SELECT';

  IF actual_column_select_grants IS NOT NULL THEN
    RAISE EXCEPTION 'Column confidentiality cutover precondition failed';
  END IF;
END
$preconditions$;

REVOKE SELECT, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.profiles FROM authenticated;
REVOKE SELECT, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.properties FROM authenticated;
REVOKE SELECT, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.service_orders FROM authenticated;

GRANT SELECT (
  id, full_name, role, created_at
) ON TABLE public.profiles TO authenticated;

GRANT SELECT (
  id, name, client_type, agency_id, owner_id, zone, phone, email, address,
  zip_code, sqm_interior, sqm_exterior, sqm_total, min_guests, max_guests,
  double_beds, single_beds, sofa_beds, bathrooms, bidets, cribs, notes,
  created_at, bedrooms, armchair_beds
) ON TABLE public.properties TO authenticated;

GRANT SELECT (
  id, property_id, cleaning_staff_id, consegna_staff_id, cleaning_date,
  checkout_at, checkin_at, status, real_guests, double_beds, single_beds,
  sofa_beds, bathrooms, bidets, cribs, completed_at, created_at, started_at,
  completion_notes, worked_minutes, bedrooms, armchair_beds, order_number,
  is_urgent, cleaning_notes, pricing_mode, cleaning_cycle
) ON TABLE public.service_orders TO authenticated;

DO $postconditions$
DECLARE
  selectable_columns text[];
  actual_table_privileges text[];
BEGIN
  IF pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'SELECT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.properties', 'SELECT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.service_orders', 'SELECT') THEN
    RAISE EXCEPTION 'Column confidentiality cutover postcondition failed';
  END IF;

  SELECT pg_catalog.array_agg(
    namespace.nspname || '.' || relation.relname || '.' || acl.privilege_type
    ORDER BY namespace.nspname, relation.relname, acl.privilege_type
  )
  INTO actual_table_privileges
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
  JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
  WHERE namespace.nspname = 'public'
    AND relation.relname IN ('profiles', 'properties', 'service_orders')
    AND grantee.rolname = 'authenticated';

  IF actual_table_privileges IS DISTINCT FROM ARRAY[
    'public.profiles.DELETE', 'public.profiles.INSERT', 'public.profiles.UPDATE',
    'public.properties.DELETE', 'public.properties.INSERT',
    'public.properties.UPDATE', 'public.service_orders.DELETE',
    'public.service_orders.INSERT', 'public.service_orders.UPDATE'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover postcondition failed';
  END IF;

  SELECT pg_catalog.array_agg(columns.column_name::text ORDER BY columns.ordinal_position)
  INTO selectable_columns
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public'
    AND columns.table_name = 'profiles'
    AND pg_catalog.has_column_privilege(
      'authenticated', 'public.profiles', columns.column_name, 'SELECT'
    );

  IF selectable_columns IS DISTINCT FROM ARRAY[
    'id', 'full_name', 'role', 'created_at'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover postcondition failed';
  END IF;

  SELECT pg_catalog.array_agg(columns.column_name::text ORDER BY columns.ordinal_position)
  INTO selectable_columns
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public'
    AND columns.table_name = 'properties'
    AND pg_catalog.has_column_privilege(
      'authenticated', 'public.properties', columns.column_name, 'SELECT'
    );

  IF selectable_columns IS DISTINCT FROM ARRAY[
    'id', 'name', 'client_type', 'agency_id', 'owner_id', 'zone', 'phone',
    'email', 'address', 'zip_code', 'sqm_interior', 'sqm_exterior', 'sqm_total',
    'min_guests', 'max_guests', 'double_beds', 'single_beds', 'sofa_beds',
    'bathrooms', 'bidets', 'cribs', 'notes', 'created_at', 'bedrooms',
    'armchair_beds'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover postcondition failed';
  END IF;

  SELECT pg_catalog.array_agg(columns.column_name::text ORDER BY columns.ordinal_position)
  INTO selectable_columns
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public'
    AND columns.table_name = 'service_orders'
    AND pg_catalog.has_column_privilege(
      'authenticated', 'public.service_orders', columns.column_name, 'SELECT'
    );

  IF selectable_columns IS DISTINCT FROM ARRAY[
    'id', 'property_id', 'cleaning_staff_id', 'consegna_staff_id',
    'cleaning_date', 'checkout_at', 'checkin_at', 'status', 'real_guests',
    'double_beds', 'single_beds', 'sofa_beds', 'bathrooms', 'bidets', 'cribs',
    'completed_at', 'created_at', 'started_at', 'completion_notes',
    'worked_minutes', 'bedrooms', 'armchair_beds', 'order_number', 'is_urgent',
    'cleaning_notes', 'pricing_mode', 'cleaning_cycle'
  ]::text[] THEN
    RAISE EXCEPTION 'Column confidentiality cutover postcondition failed';
  END IF;

  IF NOT pg_catalog.has_table_privilege('service_role', 'public.profiles', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.properties', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.service_orders', 'SELECT') THEN
    RAISE EXCEPTION 'Column confidentiality cutover postcondition failed';
  END IF;
END
$postconditions$;

COMMIT;
```

## 6. Impacto, locks e compatibilidade

- Objetos afetados: ACLs de `public.profiles`, `public.properties` e
  `public.service_orders` para `authenticated`.
- Não há DML, backfill, varredura de dados, alteração de schema, policy, RLS,
  função, trigger, view ou Storage.
- `GRANT`/`REVOKE` alteram ACLs e invalidam metadados da relação; os locks são
  curtos e limitados por `lock_timeout = 5s` e `statement_timeout = 60s`.
- Duração esperada sem contenção: abaixo de um segundo; reservar janela de cinco
  minutos para prechecks, execução e abortagem.
- A aplicação publicada desde a Sprint 03 é compatível antes e depois do
  cutover. Versões anteriores à Sprint 03 não são compatíveis.
- Até `admin` perde leitura direta das colunas restritas; isso é deliberado e
  prova que autorização por papel permanece na operação server-only.

## 7. Invariantes antes/depois

Registrar apenas contagens e digests, sem valores ou PII:

- `count(*)`, `count(DISTINCT id)` e digest de cada uma das três tabelas;
- digest das policies das três tabelas;
- digest de grants para todos os grantees exceto `SELECT`, `TRUNCATE`,
  `REFERENCES`, `TRIGGER` e `MAINTAIN` de `authenticated`, intencionalmente
  alterados;
- lista exata de colunas selecionáveis por `authenticated` e manutenção de
  `SELECT` integral para `service_role`;
- ausência de `profiles_public` e `properties_public`.

Todos os digests de dados e policies devem permanecer idênticos. As únicas
diferenças permitidas são a ACL de leitura de `authenticated` nas três tabelas
e a remoção dos quatro privilégios administrativos excessivos aprovados.

## 8. Plano de testes locais

1. Reconstruir todas as migrations em stack descartável, sem `--linked`.
2. Aplicar a Sprint 04 e conferir seus fingerprints.
3. Criar fixtures sintéticas dos cinco papéis e snapshots de dados/policies.
4. Aplicar o SQL exato da Sprint 05 e comparar invariantes.
5. Provar por pgTAP:
   - ausência de grant table-level;
   - listas exatas de colunas seguras;
   - bloqueio de cada coluna restrita e de `select('*')`;
   - acesso direto seguro e RLS para `admin`, `secretaria`, `limpeza`,
     `consegna` e `cliente`;
   - acesso integral somente por `service_role`;
   - joins relacionais nas colunas seguras;
   - guard de UPDATE da Sprint 04 ainda efetivo.
6. Executar smoke autenticado de telas, dashboard, extratos e CSVs pelos
   adapters. PDFs usam a mesma fonte de reporting e terão seus formatadores e
   contratos reexecutados no Vitest.
7. Executar lint, typecheck, Vitest, build, SQLs anteriores, lint local do
   Supabase e inspeção de diff/segredos.

## 9. Implantação remota executada

1. SQL, matriz e aplicação Sprint 03+ revisados.
2. Histórico, schema, grants e invariantes remotos comparados de forma
   read-only; preconditions exatas e dry-run aprovados.
3. Backup/PITR e restauração ensaiada em ambiente isolado confirmados pelo
   responsável antes da autorização mutável.
4. Migration aplicada uma única vez às 03:55:10 UTC, sem seed, roles, Vault ou
   `--linked`.
5. Invariantes, ACLs, matriz direta dos cinco papéis e smoke transacional com
   `ROLLBACK` reexecutados.
6. Fontes server-only preservadas; telas, dashboard, relatórios, CSV e PDF
   permaneceram verdes nas suítes locais finais.
7. API, Postgres e Sentry observados até 04:25:13 UTC, completando 30 minutos
   sem 5xx, erro inesperado ou issue nova.
8. Dry-run pós-cutover retornou `upToDate: true` e nenhuma migration pendente.

**Go:** drift ausente, backup/restauração confirmados, aplicação compatível,
invariantes idênticos, matriz e smoke completos verdes.

**No-go:** qualquer coluna/policy/grant inesperado, falha de backup, restauração
não ensaiada, timeout, mudança de digest de dados ou quebra de uso legítimo.

## 10. Rollback não destrutivo e correção progressiva

- Nenhum rollback foi necessário após a aplicação remota.
- Depois do cutover, manter ou reimplantar somente uma versão Sprint 03+
  compatível; nunca voltar a uma versão que leia colunas restritas diretamente.
- Em incidente, conter o fluxo afetado, preservar ACLs, dados e evidências, e
  corrigir o adapter/aplicação.
- Se uma coluna segura legítima tiver sido omitida, aplicar nova migration
  progressiva com `GRANT SELECT (<coluna mínima>)`; não restaurar `SELECT` de
  tabela e não reabrir todas as colunas.
- Se a exposição decorrer de uma coluna indevidamente segura, aplicar nova
  migration progressiva que revogue o grant daquela coluna depois que o adapter
  compatível estiver publicado.
- Não usar `DROP`, reset, exclusão, restauração sobre produção ou edição manual
  sem histórico de migration.

## 11. Riscos residuais

- Grants de coluna são comuns aos cinco papéis; diferenças por papel continuam
  dependendo de RLS para linhas e do adapter para dados restritos.
- `service_role` mantém grande poder e exige revisão contínua do seam, imports e
  segredos.
- Colunas operacionais que permanecem diretas ainda dependem dos DTOs para
  diferenças de apresentação por papel; não são classificadas como
  confidenciais nesta decisão.
- Os riscos residuais não bloqueiam o encerramento: continuam documentados e
  protegidos por RLS, adapters server-only e testes arquiteturais.

## 12. Evidências locais e remotas

Em 2026-08-19:

- a migration `20260819030134_restrict_sensitive_column_grants.sql` foi criada
  pelo comando oficial `supabase migration new restrict_sensitive_column_grants`;
- o SQL da migration corresponde ao bloco aprovado na seção 5;
- a cadeia foi reconstruída desde o baseline anterior às Sprints 04/05; ambas
  as migrations foram aplicadas em sequência e os fingerprints de
  `profiles`, `properties`, `service_orders`, policies e grants não relacionados
  permaneceram idênticos;
- 171 testes pgTAP passaram, incluindo 68 asserções novas de catálogo, colunas,
  wildcards, joins, PII e cinco papéis; os oito alvos antigos deixaram de ser
  TODO;
- invariantes operacionais/fotos, bootstrap de fotos, lint dos schemas e Advisor
  de segurança local passaram sem issue;
- a Data API local real bloqueou todas as colunas restritas para `admin`,
  `secretaria`, `limpeza`, `consegna` e `cliente`, enquanto colunas seguras,
  joins relacionais e fontes privilegiadas passaram;
- o mesmo smoke confirmou que as escritas legítimas de remuneração por
  `admin`, pricing de imóvel por `admin` e extras financeiros de O.S. por
  `admin`/`secretaria` continuam permitidas; os grants de escrita permanecem
  inalterados;
- o smoke autenticado confirmou telas, dashboard, extratos e CSVs; os testes de
  PDF que usam as mesmas fontes passaram dentro dos 155 Vitest;
- `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passaram;
- o preflight remoto read-only autorizado confirmou projeto saudável em
  PostgreSQL 17, histórico terminando na Sprint 04, schema/ordem de colunas/RLS
  exatos, views legadas ausentes, ausência de ACLs explícitas por coluna,
  `service_role` com leitura integral e invariantes de contagem/unicidade sem
  anomalia; nenhum valor de linha foi retornado;
- o catálogo revelou `TRUNCATE`, `REFERENCES`, `TRIGGER` e `MAINTAIN`
  table-level desnecessários para `authenticated`; a migration local passou a
  revogá-los e os novos postconditions exigem somente `INSERT`, `UPDATE` e
  `DELETE` table-level, além do `SELECT` seguro por coluna;
- `npx supabase db push --dry-run --skip-vault --project-ref <projeto>` passou e
  listou somente `20260819030134_restrict_sensitive_column_grants.sql`, sem
  seed ou roles; não houve `--linked`;
- backup/PITR, restauração ensaiada e aplicação foram separadamente autorizados;
  a migration foi aplicada no projeto de produção e registrada com a versão
  exata `20260819030134`;
- hashes de dados e policies, contagens, unicidade e chaves nulas permaneceram
  idênticos antes/depois; zero fixtures sintéticas permaneceram após o
  `ROLLBACK`;
- as 68 asserções do teste de confidencialidade passaram remotamente para
  `admin`, `secretaria`, `limpeza`, `consegna` e `cliente`;
- o Advisor não apresentou finding crítico/alto novo; permaneceu somente o INFO
  conhecido de `auth_login_attempts` aceito pela ADR 008;
- a observação de 30 minutos terminou sem 5xx, erro Postgres inesperado ou
  issue nova no Sentry; o dry-run final retornou banco remoto atualizado;
- nenhuma row persistente, policy, RLS, Auth, Vault ou Storage foi alterada;
  não houve `--linked`, commit, push nem início da Sprint 06.
