# Sprint 04 — Dossiê DB-P do guard de integridade de O.S.

**Status:** concluída localmente e validada em produção após autorização específica

**Data do diagnóstico:** 2026-08-18

**Classificação:** DB-P — migration Postgres validada localmente e implantada em
produção com invariantes preservados

## 1. Veredito arquitetural

A policy vigente de `UPDATE` em `public.service_orders` limita as linhas que
`limpeza` alcança, mas o grant de tabela permite tentar modificar qualquer
coluna. A proteção mínima com boa localidade é um trigger `BEFORE UPDATE` por
linha, sem consultas adicionais, que permita somente as duas transições
operacionais já implementadas e rejeite qualquer outra mutação feita por
`limpeza`. `admin` e `secretaria` preservam o contrato atual; `consegna` e
`cliente` continuam sem policy de atualização.

O guard não deve calcular preço, consultar vínculos, duplicar a janela de
visibilidade nem incorporar regras de fotos. Essas responsabilidades continuam,
respectivamente, na camada de pricing, nas policies RLS e no serviço de fotos.
O único ajuste de aplicação indispensável é persistir o recálculo de
`total_price` por uma operação server-only estreita, já que a atualização direta
feita hoje com a sessão de `limpeza` passará corretamente a ser rejeitada.

## 2. Gate e fontes

### 2.1 Dependências verificadas

- Sprints 00, 01, 02 e 03: `completed` no roadmap e no registro de progresso.
- Sprint 01: runner local/descartável, 57 testes pgTAP e SQLs de invariantes
  presentes e reexecutados com sucesso antes desta implementação.
- Sprint 03: `docs/sensitive-data-matrix.md`, adapter server-only estreito,
  testes arquiteturais e smoke autenticado dos cinco papéis presentes.
- Riscos residuais anteriores que não bloqueiam esta sprint:
  confidencialidade de `SELECT` permanece para a Sprint 05; intervalos
  financeiros permanecem para a Sprint 06; atomicidade O.S./equipe permanece
  para a Sprint 08.
- Alterações locais preexistentes: `AGENTS.md` marcado como modificado apenas por
  normalização de final de linha e `output/` não rastreado. Ambos devem ser
  preservados e estão fora do escopo.

### 2.2 Baseline pré-mudança

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm test`: PASS, 32 arquivos e 152 testes.
- `npm run build`: PASS, Next.js 16.3.1 e 20 rotas.
- `npm run test:supabase`: PASS, 57 pgTAP, invariantes operacionais, formatos
  de foto e bootstrap histórico; oito gaps-alvo continuam TODO, sendo sete da
  Sprint 05 e um desta Sprint 04.
- Nenhuma conexão com projeto Supabase remoto foi usada.

### 2.3 Documentação atual consultada

- Supabase: RLS/UPDATE, `auth.jwt()`, `app_metadata`, funções, privilégios,
  schemas expostos, Data API e changelog de breaking changes.
- PostgreSQL: funções e funções de trigger, `BEFORE UPDATE`, `OLD`/`NEW`,
  `SECURITY INVOKER`/`SECURITY DEFINER`, privilégios, `search_path`, RLS e locks.
- Next.js 16 local: Server Actions, Data Security e `use server`.

Conclusões aplicáveis:

- `UPDATE` requer uma policy de `SELECT`; `USING` controla a linha antiga e
  `WITH CHECK`, a linha nova. Nenhum deles limita colunas.
- `raw_user_meta_data`/`user_metadata` não é fonte de autorização. O
  `app_role` deste projeto é injetado pelo hook do banco em JWT assinado e lido
  por `public.get_my_role()` conforme ADR 001.
- `SECURITY INVOKER` é suficiente porque o guard não consulta tabelas e não
  precisa elevar privilégios.
- Funções novas recebem `EXECUTE` de `PUBLIC` por padrão; o privilégio será
  revogado na mesma transação.
- `private` não é schema exposto pela Data API local. A função ficará nele, com
  `SET search_path = ''`.
- `CREATE TRIGGER` adquire `SHARE ROW EXCLUSIVE` na tabela e conflita com
  escritas concorrentes; leituras simples continuam possíveis.
- Colunas generated stored são calculadas depois dos triggers `BEFORE`; o guard
  não acessará `NEW.is_urgent` nem `NEW.worked_minutes`.

## 3. Estado atual efetivo

### 3.1 Policies de `service_orders`

O catálogo local reconstruído desde o baseline contém:

| Policy | Operação | Papel Postgres | Regra funcional |
|---|---|---|---|
| `service_orders_admin_secretaria_select` | SELECT | `authenticated` | `app_role` admin ou secretaria |
| `service_orders_admin_secretaria_insert` | INSERT | `authenticated` | `app_role` admin ou secretaria |
| `service_orders_admin_secretaria_update` | UPDATE | `authenticated` | `app_role` admin ou secretaria em `USING` e `WITH CHECK` |
| `service_orders_admin_secretaria_delete` | DELETE | `authenticated` | `app_role` admin ou secretaria |
| `service_orders_limpeza_select` | SELECT | `authenticated` | O.S. atribuída dentro da janela operacional |
| `service_orders_limpeza_update` | UPDATE | `authenticated` | O.S. atribuída com `cleaning_date <= hoje` em Roma |
| `service_orders_consegna_select` | SELECT | `authenticated` | O.S. atribuída dentro da janela operacional |
| `service_orders_cliente_select` | SELECT | `authenticated` | O.S. de imóvel do cliente |

Não existe policy de UPDATE para `consegna` ou `cliente`.

### 3.2 Grants aplicáveis

`anon`, `authenticated` e `service_role` possuem grant de tabela para
`UPDATE` e privilégios equivalentes em todas as 31 colunas catalogadas de
`service_orders`. RLS impede `anon`, `consegna` e `cliente` de alcançar linhas,
mas não restringe colunas quando uma policy de UPDATE permite a linha.

Esta sprint não altera grants de `SELECT` ou a confidencialidade de colunas.
Isso pertence exclusivamente à Sprint 05.

### 3.3 Triggers e funções atuais

- Não há trigger de usuário em `public.service_orders`.
- `public.get_my_role()` é `STABLE`, `SECURITY INVOKER` e lê primeiro o claim
  top-level `app_role`, com fallback para o claim Postgres `role`.
- `private.operational_staff_service_order_ids()` concentra atribuição e janela
  até hoje em `Europe/Rome` para RLS.
- `private.staff_property_ids(uuid)` deriva imóveis do mesmo escopo.
- As colunas `is_urgent` e `worked_minutes` são generated stored.

### 3.4 Papéis que conseguem tentar UPDATE

Todos os usuários autenticados chegam ao Postgres como `authenticated`. A
policy permite linhas para `admin`, `secretaria` e `limpeza`; `consegna` e
`cliente` recebem zero linhas. Um JWT ausente ou com `app_role` inválido também
não satisfaz policies atuais, mas o guard manterá fail-closed caso policies
futuras mudem. `service_role` e `postgres` são papéis técnicos privilegiados e
não representam perfis de negócio.

## 4. Fluxos atuais e colunas modificadas

| Fluxo | Papéis legítimos | Operação atual | Colunas/tabelas modificadas |
|---|---|---|---|
| Criar O.S. | admin, secretaria | INSERT | campos administrativos da O.S.; vínculos em `service_order_cleaning_staff` |
| Editar O.S. | admin, secretaria | UPDATE | propriedade, consegna, datas, ocupação, notas, extras, pricing e `total_price`; vínculos em tabela própria |
| Iniciar limpeza | admin, secretaria, limpeza atribuída | UPDATE condicional | `status`, `started_at` |
| Concluir limpeza | admin, secretaria, limpeza atribuída | UPDATE condicional | `status`, `completed_at`, `completion_notes`; `worked_minutes` é generated |
| Recalcular preço após concluir/reabrir | admin, secretaria, limpeza no finish | segundo UPDATE | `total_price` |
| Reabrir | admin, secretaria | UPDATE condicional | `status`, `started_at`, `completed_at`, `completion_notes`, `cleaning_cycle`; depois `total_price` |
| Extras/pricing | admin, secretaria | UPDATE | `extra_services_description`, `extra_services_price`, `pricing_mode`, `total_price` |
| Atribuir limpeza | admin, secretaria | DELETE/INSERT | somente `service_order_cleaning_staff` |
| Atribuir consegna | admin, secretaria | UPDATE | `consegna_staff_id` |
| Fotos | admin, secretaria, limpeza autorizada | INSERT/UPDATE/DELETE server-only | `service_order_photos` e Storage; não altera a O.S. |
| Cancelar/excluir O.S. | admin, secretaria | DELETE | não é UPDATE; não existe status `cancelled` no schema |

## 5. Matriz de mutação

`—` significa que a ação não é permitida para o papel. A RLS continua sendo a
fonte de verdade para quais linhas podem ser alcançadas.

| Papel | Ação | Estado anterior | Estado seguinte | Colunas permitidas na O.S. |
|---|---|---|---|---|
| admin | criação | inexistente | `open` | todas as colunas do formulário; generated/defaults pelo banco |
| admin | edição administrativa | qualquer | igual | todas as colunas atualmente usadas pelo formulário |
| admin | início | `open` ou `in_progress` sem início | `in_progress` | `status`, `started_at` |
| admin | conclusão | `in_progress` iniciado | `done` | `status`, `completed_at`, `completion_notes`; preço recalculado depois |
| admin | reabertura | `done` | `open` | `status`, `started_at`, `completed_at`, `completion_notes`, `cleaning_cycle`, depois `total_price` |
| admin | extras/pricing | qualquer visível | igual | descrição/preço de extras, `pricing_mode`, `total_price` |
| admin | propriedade/datas/equipe | qualquer | igual | `property_id`, `cleaning_date`, `checkout_at`, `checkin_at`, `consegna_staff_id`; equipe de limpeza em tabela própria |
| admin | cancelamento | qualquer | excluída | DELETE, sem coluna de update |
| secretaria | criação/edição | inexistente/qualquer | `open`/igual | mesmo contrato atual de O.S. do admin; sem ampliar administração de imóvel |
| secretaria | início/conclusão/reabertura | mesmos estados do admin | mesmos estados do admin | mesmas colunas operacionais do admin |
| secretaria | extras/pricing/propriedade/datas/equipe | qualquer visível | igual | mesmas colunas atuais do formulário e tabela de vínculos |
| secretaria | cancelamento | qualquer | excluída | DELETE, sem coluna de update |
| limpeza | início normal | `open`, `started_at IS NULL`, `completed_at IS NULL` | `in_progress` | exclusivamente `status`, `started_at` |
| limpeza | recuperação de tracking legado | `in_progress`, `started_at IS NULL`, `completed_at IS NULL` | `in_progress` | exclusivamente `started_at` |
| limpeza | conclusão | `in_progress`, iniciado, não concluído | `done` | exclusivamente `status`, `completed_at`, `completion_notes` |
| limpeza | recálculo após conclusão | `done` | `done` | nenhuma coluna via sessão operacional; operação server-only persiste somente `total_price` |
| limpeza | fotos | `open`/`in_progress` conforme fase | igual | nenhuma coluna da O.S.; metadados em `service_order_photos` |
| limpeza | pricing, extras, propriedade, datas, equipe, ciclo, financeiro | qualquer | — | nenhuma |
| consegna | qualquer UPDATE | qualquer | — | nenhuma; somente leitura |
| cliente | qualquer UPDATE | qualquer | — | nenhuma; somente leitura |

Regras complementares do guard para `limpeza`:

- o horário novo de início/conclusão deve ficar entre cinco minutos antes e um
  minuto depois do `statement_timestamp()` do banco;
- `completed_at` não pode anteceder `started_at`;
- qualquer combinação diferente das duas transições é rejeitada;
- UPDATE sem mudança em nenhuma coluna gravável não é rejeitado pelo guard,
  continuando sujeito à RLS;
- generated columns não são lidas no `BEFORE UPDATE`.

## 6. Threat model

| Tentativa direta | Controle esperado |
|---|---|
| `limpeza` altera `total_price`, `consegna_fee` ou valores financeiros | trigger rejeita com SQLSTATE `42501` |
| `limpeza` altera `pricing_mode` ou extras | trigger rejeita |
| troca `property_id`, `cleaning_staff_id`, `consegna_staff_id` ou vínculo N-N | trigger protege colunas da O.S.; RLS da tabela de vínculos continua separada |
| altera `cleaning_date`, check-in/check-out ou datas administrativas | trigger rejeita |
| forja `started_at`/`completed_at` histórico ou futuro | janela curta em torno do relógio do banco rejeita |
| tenta gravar `worked_minutes` | coluna generated rejeita pelo próprio Postgres; trigger não a lê |
| salta estados ou reabre como `limpeza` | máquina mínima do trigger rejeita |
| altera `cleaning_cycle` | trigger rejeita; somente reabertura administrativa muda o ciclo |
| atualiza O.S. não atribuída, futura ou sem data | RLS bloqueia antes do trigger |
| `consegna` ou `cliente` tenta UPDATE | ausência de policy retorna zero linhas; trigger também é fail-closed para esses claims |
| papel ausente/desconhecido tenta UPDATE | policies atuais bloqueiam; trigger rejeita caso a linha venha a ser alcançada |
| cliente envia papel no payload | ignorado; papel vem exclusivamente do JWT assinado/banco |
| chama função de trigger diretamente | função fica em `private`, retorna `trigger` e não possui EXECUTE para papéis da API |

Risco aceito: um `limpeza` atribuído pode chamar diretamente a Data API para
executar uma transição operacional válida com horário atual. Isso equivale à
ação de negócio que o papel já pode executar; o objetivo não é obrigar o canal
Server Action, e sim impedir mutações fora do contrato.

## 7. SQL proposto antes da implementação

Objetos novos:

- `private.guard_service_order_update()`;
- trigger `guard_service_order_updates` em `public.service_orders`.

Não serão criados RPC, tabela, coluna, policy ou grant de leitura. A função é
`SECURITY INVOKER`, `VOLATILE` por padrão, `SET search_path = ''`, não consulta
tabelas e não eleva privilégio.

```sql
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
DECLARE
  actual_columns text[];
  actual_update_policies text[];
BEGIN
  IF pg_catalog.to_regclass('public.service_orders') IS NULL THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;

  IF pg_catalog.to_regnamespace('private') IS NULL THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;

  SELECT pg_catalog.array_agg(columns.column_name::text ORDER BY columns.ordinal_position)
  INTO actual_columns
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public'
    AND columns.table_name = 'service_orders';

  IF actual_columns IS DISTINCT FROM ARRAY[
    'id', 'property_id', 'cleaning_staff_id', 'consegna_staff_id',
    'cleaning_date', 'checkout_at', 'checkin_at', 'status', 'real_guests',
    'double_beds', 'single_beds', 'sofa_beds', 'bathrooms', 'bidets',
    'cribs', 'total_price', 'completed_at', 'created_at', 'started_at',
    'completion_notes', 'worked_minutes', 'bedrooms', 'armchair_beds',
    'order_number', 'is_urgent', 'cleaning_notes',
    'extra_services_description', 'extra_services_price', 'pricing_mode',
    'consegna_fee', 'cleaning_cycle'
  ]::text[] THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'service_orders'
      AND relation.relkind = 'r'
      AND relation.relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'get_my_role'
      AND pg_catalog.pg_get_function_identity_arguments(procedure.oid) = ''
      AND NOT procedure.prosecdef
      AND procedure.provolatile = 's'
      AND pg_catalog.pg_get_functiondef(procedure.oid) LIKE '%request.jwt.claims%'
      AND pg_catalog.pg_get_functiondef(procedure.oid) LIKE '%app_role%'
  ) THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;

  SELECT pg_catalog.array_agg(policies.policyname::text ORDER BY policies.policyname)
  INTO actual_update_policies
  FROM pg_catalog.pg_policies AS policies
  WHERE policies.schemaname = 'public'
    AND policies.tablename = 'service_orders'
    AND policies.cmd = 'UPDATE';

  IF actual_update_policies IS DISTINCT FROM ARRAY[
    'service_orders_admin_secretaria_update',
    'service_orders_limpeza_update'
  ]::text[] OR NOT pg_catalog.has_table_privilege(
    'authenticated', 'public.service_orders', 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies AS policies
    WHERE policies.schemaname = 'public'
      AND policies.tablename = 'service_orders'
      AND policies.policyname = 'service_orders_admin_secretaria_update'
      AND policies.permissive = 'PERMISSIVE'
      AND policies.roles = ARRAY['authenticated']::name[]
      AND policies.qual LIKE '%get_my_role%'
      AND policies.qual LIKE '%admin%'
      AND policies.qual LIKE '%secretaria%'
      AND policies.with_check LIKE '%get_my_role%'
      AND policies.with_check LIKE '%admin%'
      AND policies.with_check LIKE '%secretaria%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies AS policies
    WHERE policies.schemaname = 'public'
      AND policies.tablename = 'service_orders'
      AND policies.policyname = 'service_orders_limpeza_update'
      AND policies.permissive = 'PERMISSIVE'
      AND policies.roles = ARRAY['authenticated']::name[]
      AND policies.qual LIKE '%get_my_role%'
      AND policies.qual LIKE '%operational_staff_service_order_ids%'
      AND policies.with_check LIKE '%Europe/Rome%'
      AND policies.with_check LIKE '%service_order_cleaning_staff%'
  ) THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;

  IF pg_catalog.to_regprocedure('private.guard_service_order_update()') IS NOT NULL
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.pg_trigger AS trigger
       WHERE trigger.tgrelid = 'public.service_orders'::pg_catalog.regclass
         AND NOT trigger.tgisinternal
     ) THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS columns
    WHERE columns.table_schema = 'public'
      AND columns.table_name = 'service_orders'
      AND columns.column_name = 'is_urgent'
      AND columns.is_generated = 'ALWAYS'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS columns
    WHERE columns.table_schema = 'public'
      AND columns.table_name = 'service_orders'
      AND columns.column_name = 'worked_minutes'
      AND columns.is_generated = 'ALWAYS'
  ) THEN
    RAISE EXCEPTION 'Service-order update guard precondition failed';
  END IF;
END
$preconditions$;

CREATE FUNCTION private.guard_service_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  app_role text := public.get_my_role();
  database_now timestamptz := pg_catalog.statement_timestamp();
BEGIN
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF app_role IN ('"admin"', '"secretaria"') THEN
    RETURN NEW;
  END IF;

  IF app_role IS DISTINCT FROM '"limpeza"' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Aggiornamento O.L. non autorizzato.';
  END IF;

  IF ROW(
    NEW.id, NEW.property_id, NEW.cleaning_staff_id, NEW.consegna_staff_id,
    NEW.cleaning_date, NEW.checkout_at, NEW.checkin_at, NEW.status,
    NEW.real_guests, NEW.double_beds, NEW.single_beds, NEW.sofa_beds,
    NEW.bathrooms, NEW.bidets, NEW.cribs, NEW.total_price, NEW.completed_at,
    NEW.created_at, NEW.started_at, NEW.completion_notes, NEW.bedrooms,
    NEW.armchair_beds, NEW.order_number, NEW.cleaning_notes,
    NEW.extra_services_description, NEW.extra_services_price,
    NEW.pricing_mode, NEW.consegna_fee, NEW.cleaning_cycle
  ) IS NOT DISTINCT FROM ROW(
    OLD.id, OLD.property_id, OLD.cleaning_staff_id, OLD.consegna_staff_id,
    OLD.cleaning_date, OLD.checkout_at, OLD.checkin_at, OLD.status,
    OLD.real_guests, OLD.double_beds, OLD.single_beds, OLD.sofa_beds,
    OLD.bathrooms, OLD.bidets, OLD.cribs, OLD.total_price, OLD.completed_at,
    OLD.created_at, OLD.started_at, OLD.completion_notes, OLD.bedrooms,
    OLD.armchair_beds, OLD.order_number, OLD.cleaning_notes,
    OLD.extra_services_description, OLD.extra_services_price,
    OLD.pricing_mode, OLD.consegna_fee, OLD.cleaning_cycle
  ) THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('open', 'in_progress')
     AND NEW.status = 'in_progress'
     AND OLD.started_at IS NULL
     AND NEW.started_at IS NOT NULL
     AND NEW.started_at BETWEEN database_now - pg_catalog.make_interval(mins => 5)
                            AND database_now + pg_catalog.make_interval(mins => 1)
     AND ROW(
       NEW.id, NEW.property_id, NEW.cleaning_staff_id, NEW.consegna_staff_id,
       NEW.cleaning_date, NEW.checkout_at, NEW.checkin_at, NEW.real_guests,
       NEW.double_beds, NEW.single_beds, NEW.sofa_beds, NEW.bathrooms,
       NEW.bidets, NEW.cribs, NEW.total_price, NEW.completed_at, NEW.created_at,
       NEW.completion_notes, NEW.bedrooms, NEW.armchair_beds, NEW.order_number,
       NEW.cleaning_notes, NEW.extra_services_description,
       NEW.extra_services_price, NEW.pricing_mode, NEW.consegna_fee,
       NEW.cleaning_cycle
     ) IS NOT DISTINCT FROM ROW(
       OLD.id, OLD.property_id, OLD.cleaning_staff_id, OLD.consegna_staff_id,
       OLD.cleaning_date, OLD.checkout_at, OLD.checkin_at, OLD.real_guests,
       OLD.double_beds, OLD.single_beds, OLD.sofa_beds, OLD.bathrooms,
       OLD.bidets, OLD.cribs, OLD.total_price, OLD.completed_at, OLD.created_at,
       OLD.completion_notes, OLD.bedrooms, OLD.armchair_beds, OLD.order_number,
       OLD.cleaning_notes, OLD.extra_services_description,
       OLD.extra_services_price, OLD.pricing_mode, OLD.consegna_fee,
       OLD.cleaning_cycle
     ) THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'in_progress'
     AND NEW.status = 'done'
     AND OLD.started_at IS NOT NULL
     AND OLD.completed_at IS NULL
     AND NEW.completed_at IS NOT NULL
     AND NEW.completed_at >= OLD.started_at
     AND NEW.completed_at BETWEEN database_now - pg_catalog.make_interval(mins => 5)
                              AND database_now + pg_catalog.make_interval(mins => 1)
     AND ROW(
       NEW.id, NEW.property_id, NEW.cleaning_staff_id, NEW.consegna_staff_id,
       NEW.cleaning_date, NEW.checkout_at, NEW.checkin_at, NEW.real_guests,
       NEW.double_beds, NEW.single_beds, NEW.sofa_beds, NEW.bathrooms,
       NEW.bidets, NEW.cribs, NEW.total_price, NEW.created_at, NEW.started_at,
       NEW.bedrooms, NEW.armchair_beds, NEW.order_number, NEW.cleaning_notes,
       NEW.extra_services_description, NEW.extra_services_price,
       NEW.pricing_mode, NEW.consegna_fee, NEW.cleaning_cycle
     ) IS NOT DISTINCT FROM ROW(
       OLD.id, OLD.property_id, OLD.cleaning_staff_id, OLD.consegna_staff_id,
       OLD.cleaning_date, OLD.checkout_at, OLD.checkin_at, OLD.real_guests,
       OLD.double_beds, OLD.single_beds, OLD.sofa_beds, OLD.bathrooms,
       OLD.bidets, OLD.cribs, OLD.total_price, OLD.created_at, OLD.started_at,
       OLD.bedrooms, OLD.armchair_beds, OLD.order_number, OLD.cleaning_notes,
       OLD.extra_services_description, OLD.extra_services_price,
       OLD.pricing_mode, OLD.consegna_fee, OLD.cleaning_cycle
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = '42501',
    MESSAGE = 'Aggiornamento O.L. non autorizzato.';
END;
$function$;

REVOKE ALL ON FUNCTION private.guard_service_order_update()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER guard_service_order_updates
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_service_order_update();

COMMENT ON FUNCTION private.guard_service_order_update() IS
  'Guards service-order column mutations for operational application roles.';

COMMENT ON TRIGGER guard_service_order_updates ON public.service_orders IS
  'Allows Pulizia only the current start/finish tracking transitions.';

COMMIT;
```

O arquivo final da migration deve ser comparado literalmente com este bloco. Se
testes exigirem correção, o dossiê deve ser atualizado antes de considerar o
SQL pronto.

## 8. Segurança operacional

### 8.1 Pré-condições e drift

A migration aborta atomicamente se:

- a tabela, RLS, helper de papel, lista/ordem das 31 colunas ou generated
  columns divergirem;
- as duas policies de UPDATE esperadas não forem exatamente as únicas;
- `authenticated` não tiver o grant de UPDATE que caracteriza o risco atual;
- já existir a função proposta ou qualquer trigger de usuário na tabela.

Não são usados `IF EXISTS`, `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP` ou
upsert para mascarar drift.

### 8.2 Locks, timeouts e duração

- `CREATE FUNCTION`, `REVOKE` e comentários: locks curtos de catálogo.
- `CREATE TRIGGER`: `SHARE ROW EXCLUSIVE` em `public.service_orders`, bloqueia
  escritas concorrentes e é autoexclusivo; `SELECT` simples continua.
- Não há `ALTER TABLE`, varredura de linhas ou backfill.
- `lock_timeout = 5s`; contenção maior aborta para reagendamento.
- `statement_timeout = 60s`; não aumentar automaticamente.
- Duração estimada sem contenção: abaixo de um segundo; janela reservada de
  cinco minutos para checagens e abortagem.

### 8.3 Compatibilidade

- Aplicação anterior à adaptação desta sprint: incompatível somente com o
  segundo UPDATE de `total_price` executado por `limpeza` após conclusão.
- Aplicação preparada nesta sprint: compatível tanto com o schema anterior
  quanto com o schema contendo o guard.
- Ordem remota obrigatória, se futuramente autorizada: publicar primeiro a
  aplicação compatível; validar; só depois aplicar a migration.
- Fórmulas, DTOs, fotos, tracking, RLS e visibilidade operacional não mudam.

### 8.4 Invariantes antes/depois

Registrar somente contagens e digests, sem imprimir PII ou valores financeiros:

```sql
SELECT
  count(*) AS row_count,
  count(DISTINCT id) AS distinct_ids,
  count(DISTINCT order_number) FILTER (WHERE order_number IS NOT NULL) AS distinct_order_numbers,
  pg_catalog.md5(pg_catalog.coalesce(
    pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(orders)::text), '' ORDER BY id),
    ''
  )) AS row_digest
FROM public.service_orders AS orders;

SELECT
  count(*) AS row_count,
  count(DISTINCT (service_order_id, profile_id)) AS distinct_relations,
  pg_catalog.md5(pg_catalog.coalesce(
    pg_catalog.string_agg(
      pg_catalog.md5(pg_catalog.to_jsonb(assignments)::text),
      '' ORDER BY service_order_id, profile_id
    ),
    ''
  )) AS row_digest
FROM public.service_order_cleaning_staff AS assignments;

SELECT
  count(*) AS row_count,
  count(DISTINCT id) AS distinct_ids,
  pg_catalog.md5(pg_catalog.coalesce(
    pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(photos)::text), '' ORDER BY id),
    ''
  )) AS row_digest
FROM public.service_order_photos AS photos;

SELECT count(*) AS storage_object_count
FROM storage.objects
WHERE bucket_id = 'service-order-photos';

SELECT pg_catalog.md5(pg_catalog.coalesce(pg_catalog.string_agg(
  grantee || ':' || privilege_type || ':' || is_grantable,
  ',' ORDER BY grantee, privilege_type
), '')) AS service_orders_select_grants_digest
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'service_orders'
  AND privilege_type = 'SELECT';
```

Todos os resultados devem ser idênticos antes/depois. A migration não contém
DML sobre tabelas de negócio ou Storage.

### 8.5 Implantação remota futura — não autorizada nesta execução

1. Revisão humana do SQL e confirmação de que o dossiê continua atual.
2. Validar histórico remoto e `supabase db push --dry-run` somente após
   autorização específica para a etapa remota.
3. Confirmar backup recente, PITR quando aplicável e restauração ensaiada em
   ambiente isolado.
4. Executar cadeia completa em banco descartável e cópia isolada representativa.
5. Salvar invariantes prévias sem conteúdo sensível.
6. Publicar a aplicação compatível e executar smoke dos cinco papéis.
7. Em janela de baixa escrita, aplicar a migration com responsável e abortar se
   houver espera por lock acima de cinco segundos.
8. Repetir invariantes e testes diretos de autorização.
9. Observar por pelo menos 30 minutos erros `42501`, conclusões, recálculos de
   preço, tracking e fotos.

**Go:** drift ausente, backup/restauração confirmados, aplicação compatível
verde, invariantes iguais e matriz completa aprovada.

**No-go:** qualquer divergência de policy/coluna/trigger/grant, falha de backup,
restauração não ensaiada, lock timeout, alteração de digest/contagem ou falha em
fluxo legítimo.

### 8.6 Rollback não destrutivo e correção progressiva

- Antes da migration, a aplicação preparada pode ser revertida normalmente
  porque também é compatível com o schema antigo.
- Depois da migration, manter a aplicação compatível; não reimplantar uma versão
  que volte a gravar preço com a sessão de `limpeza`.
- Em incidente, conter temporariamente as ações operacionais afetadas na
  aplicação, preservar função, trigger, dados e evidências, e aplicar nova
  migration progressiva com `CREATE OR REPLACE FUNCTION` para corrigir o
  contrato.
- Não desabilitar/remover trigger em produção como rollback rotineiro; não usar
  `DROP`, reset, exclusão ou restauração sobre dados existentes.
- Se for indispensável retornar temporariamente ao comportamento anterior, a
  ampliação deve ser uma migration corretiva revisada/autorizada, com prazo de
  remoção e nova execução de toda a matriz. A vulnerabilidade não deve ser
  reaberta silenciosamente.

## 9. Critérios locais de conclusão

- Migration criada pelo comando oficial `supabase migration new` descoberto por
  `--help` e idêntica ao SQL aprovado.
- Testes positivos e negativos dos cinco papéis verdes em banco descartável.
- Tentativas diretas equivalentes à Data API cobertas por `SET ROLE
  authenticated` e claims assinados sintéticos.
- Aplicação persiste recálculo por operação server-only estreita e não exporta
  client privilegiado.
- Contagens, chaves, digests, relações, fotos, Storage e grants de SELECT
  idênticos antes/depois.
- Lint, typecheck, Vitest, build, SQLs anteriores, novos SQLs, lint/advisors
  locais e inspeção de segredos/diff aprovados.
- Roadmap registra `completed` somente após autorização específica, implantação,
  smoke transacional revertido, invariantes remotos e observação pós-deploy.

## 10. Evidências da implementação local

Em 2026-08-18, depois de concluídas e registradas as seções 1–9 deste dossiê:

- a migration `20260818031745_guard_service_order_updates.sql` foi criada pelo
  comando oficial `supabase migration new guard_service_order_updates`;
- a cadeia anterior foi reconstruída em stack temporária sem a migration, as
  fixtures foram fingerprintadas, o SQL exato foi aplicado e os fingerprints
  posteriores permaneceram idênticos para O.S., IDs, `order_number`, valores,
  equipe, fotos, objetos de Storage e grants de `SELECT`;
- 103 testes pgTAP passaram: 49 da matriz vigente, oito da matriz-alvo e 46
  específicos da Sprint 04. Os sete TODOs restantes são somente os grants de
  leitura reservados à Sprint 05;
- os invariantes existentes de visibilidade operacional e fotos, além do smoke
  isolado das migrations de foto, passaram;
- `supabase db lint --local --schema public,private` não encontrou erros;
- `npm run lint`, `npm run typecheck`, 155 testes Vitest e `npm run build`
  passaram;
- nenhuma migration, query mutável, alteração de Storage ou comando de deploy
  foi executado contra projeto remoto.

## 11. Evidências da implantação e validação remota

Em 2026-08-18, depois de autorização explícita do responsável e confirmação de
backup/restauração ensaiados:

- o PR #2 foi aprovado por CI e integrado em `master` no commit `51512d2`;
- o Coolify implantou esse commit com sucesso entre 04:50:33 e 04:52:29 UTC;
- a integração GitHub do Supabase aplicou automaticamente a migration
  `20260818031745_guard_service_order_updates`; ela não foi reaplicada
  manualmente;
- função, trigger, policies, grant de `UPDATE` e histórico de migrations foram
  conferidos depois da aplicação, sem drift;
- um smoke remoto em transação única validou `admin`, `secretaria`, `limpeza`,
  `consegna`, `cliente`, papel inválido/ausente e o fluxo técnico
  `service_role`; início/conclusão legítimos passaram, enquanto preço e O.S.
  não atribuída foram bloqueados; a transação terminou em `ROLLBACK`;
- O.S. (1.203 registros), relações de equipe (1.206), fotos (2.639), objetos de
  Storage (5.278) e grants de `SELECT` mantiveram exatamente as mesmas
  contagens e fingerprints antes e depois da migration e do smoke;
- a janela de observação de 30 minutos não registrou erro inesperado do
  Postgres, resposta 4xx/5xx da API, `lock_timeout` ou `statement_timeout`;
- o Advisor de segurança não introduziu finding novo. O aviso informativo
  preexistente de `auth_login_attempts` continua documentado pela ADR 008.

Nenhuma restauração, exclusão, `DROP`, alteração de registros, mudança de
Storage ou restrição de grants de `SELECT` foi executada. A Sprint 05 permanece
planejada e não iniciada. O rollback continua sendo a correção progressiva não
destrutiva definida na seção 8.6.
