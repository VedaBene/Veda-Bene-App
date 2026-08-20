# Sprint 07 — Dossiê DB-P do contador de falhas de login atômico

**Status:** concluída localmente e aplicada em produção após autorização específica

**Data do diagnóstico e implantação:** 2026-08-20

**Classificação:** DB-P — migration Postgres com operação atômica, validada localmente e implantada com preservação integral de dados e invariantes

---

## 1. Veredito arquitetural

O fluxo anterior de bloqueio de login (`lib/server/auth/login-lockout.ts`) executava uma sequência de três etapas na camada de aplicação:
1. `store.get(emailKey, ipKey)` — leitura do registro em `public.auth_login_attempts`;
2. `getFailedLoginUpdate(...)` — cálculo e incremento do contador `failed_count` na memória JavaScript;
3. `store.upsert(update)` — gravação do novo estado via `upsert`.

Sob rajadas de requisições concorrentes para o mesmo par de chaves (ex.: ataques de força bruta paralelos ou múltiplos disparos simultâneos), essa sequência sofria de **lost updates** (*race conditions*): múltiplas threads liam o mesmo valor inicial `0` e gravavam `1`, fazendo com que 4 ou mais falhas concorrentes resultassem em um contador inferior a 4, não acionando o bloqueio temporário de 24 horas previsto na **ADR 008**.

A solução adotada substitui a mutação em memória por uma **operação atômica no PostgreSQL** encapsulada na função `public.record_failed_login(p_email_key text, p_ip_key text)`:
- Executada via comando atômico `INSERT ... ON CONFLICT (email_key, ip_key) DO UPDATE SET ... RETURNING ...` com bloqueio em nível de linha (`ROW EXCLUSIVE` / `FOR UPDATE`);
- Preserva a regra de 4 falhas consecutivas e bloqueio por 24 horas;
- Preserva a expiração automática: após 24 horas (`locked_until <= statement_timestamp()`), uma nova falha reseta o contador para 1 e limpa o `locked_until`;
- Preserva a regra de que o sucesso de login limpa as tentativas existentes com `clearFailedLogin` (`DELETE`);
- Mantém HMAC-SHA256 para `email` e `IP` (nenhum PII cru armazenado);
- Configurada como `SECURITY INVOKER` com `SET search_path = ''` e validação estrita de regex (`^[0-9a-f]{64}$`);
- Revoga permissão de execução de `PUBLIC`, `anon` e `authenticated`, concedendo `EXECUTE` exclusivamente ao role interno `service_role`;
- A tabela `public.auth_login_attempts` continua com RLS ativado e sem nenhuma policy para clientes públicos.

---

## 2. Gate e fontes

### 2.1 Dependências verificadas
- **Sprints 00 a 06**: Concluídas e com evidências verificadas no roadmap (`docs/evolution/architecture-hardening-roadmap.md`).
- **Baseline de testes**:
  - `npm run lint`: PASS (0 warnings, 0 errors);
  - `npm run typecheck`: PASS;
  - `npm test`: PASS (32 arquivos, 175 testes Vitest);
  - `npm run build`: PASS (Turbopack, 20 rotas Next.js 16);
  - `npm run test:supabase`: PASS (171 testes pgTAP, invariantes e migrações isoladas);
  - `npm run test:smoke:sensitive-data`: PASS (5 papéis autenticados).
- Nenhuma alteração remota ou conexão com banco de produção foi realizada.

### 2.2 Documentação consultada
- **ADR 008** (`docs/decisions/008-controles-seguranca-autenticacao.md`): Controles de segurança de autenticação, limite de 4 tentativas e bloqueio por 24 horas.
- **ADR 005** (`docs/decisions/005-rls-helpers-em-schema-privado.md`) e **ADR 006** (`docs/decisions/006-rpcs-privilegiadas-sem-execucao-direta.md`): Isolamento de privilégios e revogação de grants públicos em RPCs.
- **Supabase Postgres Best Practices**: Concurrency, locking, search_path seguro, security invoker e gerenciamento de privilégios mínimos.

---

## 3. Threat Model e Controles

| Ameaça / Vetor | Comportamento Anterior | Controle Endurecido (Sprint 07) |
|---|---|---|
| Força bruta concorrente (4+ tentativas simultâneas) | *Lost update*: threads liam contador 0 e gravavam 1. Bloqueio não acionado. | `INSERT ... ON CONFLICT DO UPDATE` serializa no Postgres; 4 tentativas viram exatamente contador 4 e ativam `locked_until`. |
| 5ª tentativa durante bloqueio ativo | Checava `isLoginAttemptBlocked`, mas sob concorrência podia ignorar. | Consulta e função atômica preservam o bloqueio ativo `locked_until > now()`. |
| Bloqueio expirado após 24h | Cálculo na aplicação. | Função atômica detecta `locked_until <= now()`, reseta `failed_count = 1` e desbloqueia. |
| Invocação direta da RPC por atacante anônimo ou usuário logado | N/A (função não existia). | `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated;` retorna SQLSTATE `42501` / HTTP 403. |
| Leitura/escrita direta em `auth_login_attempts` via Data API | Bloqueada por RLS e grants. | Preservada: `REVOKE ALL` para `anon` e `authenticated`. |
| Exposição de credenciais ou PII em banco/logs | Gravava apenas HMACs. | Preservado: aplicação envia apenas HMAC-SHA256 gerado com `LOGIN_LOCKOUT_SECRET`. |
| Injeção ou payload malformado nos parâmetros | N/A. | Validação regex estrita `^[0-9a-f]{64}$` no corpo da função. |

---

## 4. SQL da Migration

```sql
-- Create atomic login lockout failure recording function.
--
-- Replaces application read-modify-upsert with an atomic PostgreSQL statement
-- using row-level locking on conflict to eliminate lost updates during concurrent
-- failed login bursts.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
BEGIN
  IF pg_catalog.to_regclass('public.auth_login_attempts') IS NULL THEN
    RAISE EXCEPTION 'Atomic login lockout precondition failed: table public.auth_login_attempts does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'auth_login_attempts'
      AND relation.relkind = 'r'
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Atomic login lockout precondition failed: table public.auth_login_attempts must have RLS enabled';
  END IF;

  IF pg_catalog.has_table_privilege('anon', 'public.auth_login_attempts', 'SELECT')
     OR pg_catalog.has_table_privilege('anon', 'public.auth_login_attempts', 'INSERT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.auth_login_attempts', 'SELECT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.auth_login_attempts', 'INSERT') THEN
    RAISE EXCEPTION 'Atomic login lockout precondition failed: public roles must not have table privileges on auth_login_attempts';
  END IF;

  IF pg_catalog.to_regprocedure('public.record_failed_login(text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Atomic login lockout precondition failed: function public.record_failed_login already exists';
  END IF;
END
$preconditions$;

CREATE FUNCTION public.record_failed_login(
  p_email_key text,
  p_ip_key text
)
RETURNS TABLE (
  email_key text,
  ip_key text,
  failed_count integer,
  locked_until timestamptz,
  last_failed_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
#variable_conflict use_column
BEGIN
  IF p_email_key IS NULL OR p_email_key !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Invalid email_key format';
  END IF;

  IF p_ip_key IS NULL OR p_ip_key !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Invalid ip_key format';
  END IF;

  RETURN QUERY
  INSERT INTO public.auth_login_attempts AS a (
    email_key,
    ip_key,
    failed_count,
    locked_until,
    last_failed_at,
    created_at,
    updated_at
  )
  VALUES (
    p_email_key,
    p_ip_key,
    1,
    NULL,
    pg_catalog.statement_timestamp(),
    pg_catalog.statement_timestamp(),
    pg_catalog.statement_timestamp()
  )
  ON CONFLICT ON CONSTRAINT auth_login_attempts_pkey DO UPDATE
  SET
    failed_count = CASE
      WHEN a.locked_until IS NOT NULL AND a.locked_until <= pg_catalog.statement_timestamp() THEN 1
      ELSE a.failed_count + 1
    END,
    locked_until = CASE
      WHEN a.locked_until IS NOT NULL AND a.locked_until <= pg_catalog.statement_timestamp() THEN NULL
      WHEN a.locked_until IS NOT NULL AND a.locked_until > pg_catalog.statement_timestamp() THEN a.locked_until
      WHEN (a.failed_count + 1) >= 4 THEN pg_catalog.statement_timestamp() + interval '24 hours'
      ELSE NULL
    END,
    last_failed_at = pg_catalog.statement_timestamp(),
    updated_at = pg_catalog.statement_timestamp()
  RETURNING
    a.email_key,
    a.ip_key,
    a.failed_count,
    a.locked_until,
    a.last_failed_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_failed_login(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_failed_login(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.record_failed_login(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_failed_login(text, text) TO service_role;

COMMENT ON FUNCTION public.record_failed_login(text, text) IS
  'Atomically records a failed login attempt and calculates lockout expiration without lost updates.';

COMMIT;
```

---

## 5. Segurança Operacional

### 5.1 Pré-condições e detecção de drift
- A migration valida a integridade da tabela `public.auth_login_attempts`, o RLS ativo, a ausência de privilégios públicos e a não existência anterior da função.
- Sem uso de `IF EXISTS` ou `IF NOT EXISTS` permissivos.

### 5.2 Locks e timeouts
- `CREATE FUNCTION` e `GRANT`/`REVOKE` realizam apenas locks de catálogo efêmeros (milissegundos).
- `lock_timeout = 5s`, `statement_timeout = 60s`.
- Não há bloqueio exclusivo prolongado em tabelas de produção.

### 5.3 Invariantes verificáveis
- Registros preexistentes em `public.auth_login_attempts` permanecem intactos.
- Nenhuma outra tabela do sistema (`profiles`, `properties`, `service_orders`, etc.) é afetada.
- Grants de tabela em `public.auth_login_attempts` continuam vazios para `anon` e `authenticated`.

### 5.4 Rollback não destrutivo
- Caso seja necessário reverter na aplicação, `lib/server/auth/login-lockout.ts` pode voltar a executar a consulta e mutação via service role.
- A função no banco de dados não remove colunas ou dados, podendo coexistir de forma inofensiva ou ter sua definição mantida sem ser invocada.
- Em caso de necessidade de correção progressiva, aplica-se uma migration com `CREATE OR REPLACE FUNCTION` ajustando o comportamento, sem operações destrutivas.

---

## 6. Resultados e Validação Local

- Suíte pgTAP dedicada (`supabase/tests/database/login_lockout_atomic.test.sql`):
  - 1ª a 4ª tentativa atômica;
  - Bloqueio ativo de 24h na 4ª falha;
  - 5ª tentativa com bloqueio ativo respeitado;
  - Expiração e reset automático para 1 após 24h;
  - Isolamento entre identidades distintas (`email_key` / `ip_key`);
  - Limpeza completa no login com sucesso;
  - Rejeição `42501` para chamadas diretas de `anon` e `authenticated`;
  - Rejeição `42501` para operações diretas de tabela por `anon` e `authenticated`;
  - Rejeição `22023` para parâmetros com formato inválido.
- Testes de concorrência e unitários Vitest:
  - Disparo de múltiplas promessas concorrentes sem lost updates;
  - Falha segura e tratada na ausência de `LOGIN_LOCKOUT_SECRET`;
  - Mensagens de erro de login sempre opacas e genéricas para o usuário final.

---

## 7. Evidências da Implantação Remota

Após autorização expressa do usuário em 2026-08-20:
1. **Pre-flight no Supabase remoto (`iwrbeiqqsvzhiuhkqnqg`)**:
   - `attempt_count`: 61, `profile_count`: 49, `property_count`: 179, `order_count`: 1304.
   - `rls_enabled`: true, `function_exists`: false.
2. **Aplicação da migration**:
   - Migration `20260820035000_atomic_login_lockout` aplicada com sucesso.
3. **Verificação de integridade pós-deploy**:
   - `is_security_invoker`: true.
   - `anon_can_execute`: false.
   - `authenticated_can_execute`: false.
   - `service_role_can_execute`: true.
   - `attempt_count`: 61, `profile_count`: 49, `property_count`: 179, `order_count`: 1304 (dados 100% preservados).
4. **Smoke test transacional no Supabase remoto**:
   - Sequência de 4 falhas com fixture sintética atingiu o bloqueio de 24h conforme ADR 008 e foi limpa com sucesso.
5. **Supabase Security Advisor**:
   - Zero findings/erros de segurança.

