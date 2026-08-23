# Sprint 12B — Reauditoria final, documentação e gate de encerramento

**Data da auditoria:** 2026-08-23 (`America/Sao_Paulo`; adendo de evidência
Coolify recebido em 2026-08-23)

**Baseline herdada da Sprint 12A:**
`4a027edd067f4c205384793d092dd00f9591ec33` (`4a027ed`)

**Baseline de comparação:** auditoria de 2026-08-15, nota 6,8/10

**Status da Sprint 12B:** `completed`

**Gate final:** `READY WITH WARNINGS`

## 1. Escopo, método e pré-condições

Esta sprint consolidou as evidências da Sprint 12A, repetiu somente controles
inconclusivos, alterados ou necessários para riscos críticos e reavaliou
arquitetura, autorização, autenticação, fluxos críticos, reporting, timezone,
erros, validação, tipos, data access, testes, CI, build, segredos, Docker,
dependências, Supabase, Sentry e deploy.

Antes da execução, foram lidos integralmente `AGENTS.md`, `CLAUDE.md`, a política
de dados de produção, o índice e o roadmap de evolução, o relatório da Sprint
12A, o índice de decisões e os ADRs 001–018. Também foram consultados os guias
locais relevantes do Next.js 16.3.1 em `node_modules/next/dist/docs/`, incluindo
data security, authentication, Server Actions, Route Handlers, error handling,
Proxy, Playwright e production checklist.

### Gate de entrada

| Pré-condição | Resultado | Evidência |
|---|---|---|
| Sprint 11 concluída | PASS | Roadmap registra a Sprint 11 como `completed`. |
| Sprint 12A concluída | PASS | Roadmap e relatório registram a Sprint 12A como `completed`. |
| Relatório 12A verificável | PASS | `docs/evolution/sprint-12a-validation-report.md` existe, está versionado e contém matriz, comandos e resultados objetivos. |
| Nenhuma alteração local do usuário passível de sobrescrita | PASS | `git status --short` estava limpo antes da primeira alteração documental da 12B. |
| Baseline 12A conhecida | PASS | `HEAD`, `master` e `origin/master` apontavam para `4a027ed`; baseline inicial 12A registrada como `e34a241`. |

O roadmap foi marcado como `in_progress` somente depois desse gate. A execução
permaneceu DB-L/read-only: nenhuma migration, SQL mutável remoto, `--linked`,
smoke de produção, alteração de Auth/RLS/grants/Storage/schema/dados, commit ou
push foi realizado.

### Adendo de evidência do deploy (2026-08-23)

O responsável pelo ambiente informou que a produção canônica é o Coolify, não a
Vercel. A evidência fornecida na interface do Coolify mostra um deployment
`Success` do commit `4a027ed` (o SHA auditado da 12A), seguido dos logs do mesmo
serviço:

```text
Next.js 16.3.1
Local:   http://localhost:3000
Network: http://0.0.0.0:3000
Ready in 0ms
Running next.config took 3ms
```

Isso confirma, como evidência fornecida pelo responsável e observada na UI, que
o artefato auditado foi iniciado no Coolify. O indicador `Running (unknown)` não
é tratado como healthcheck: a captura também mostra que o healthcheck automático
está desabilitado. Nenhum botão de `Enable Healthcheck`, `Save`, `Restart` ou
`Redeploy` foi acionado. A falha antiga da Vercel foi reclassificada como uma
integração não canônica; sua causa detalhada permanece desconhecida, mas não é
mais evidência de indisponibilidade da produção declarada.

## 2. Convenções

- `PASS`: controle atendido por evidência verificável.
- `FAIL`: controle executado e não atendido.
- `NOT VERIFIED`: evidência necessária não pôde ser obtida dentro das
  autorizações disponíveis.
- `N/A`: controle não aplicável ou expressamente fora do escopo autorizado.
- `OBSERVED`: observado diretamente em código, execução ou consulta read-only.
- `INFERRED`: conclusão derivada de evidências relacionadas, sem observação
  direta completa.

Um nível de prioridade informado por Sentry ou Supabase não foi copiado
automaticamente para a severidade técnica deste relatório; impacto,
explorabilidade, frequência e controles compensatórios foram avaliados.

## 3. Evidências herdadas da Sprint 12A

Todos os resultados do relatório da Sprint 12A foram reclassificados abaixo.
Resultados no mesmo SHA foram herdados quando não houve mudança na área e a
execução remota posterior do CI forneceu confirmação adicional.

| Resultado da Sprint 12A | Classificação 12B | Base da classificação final |
|---|---|---|
| E2E crítico, 4/4 | PASS | Evidência 12A herdada e job remoto `Critical E2E (Disposable Supabase)` verde no mesmo SHA. |
| Persistência E2E | PASS | Evidência 12A herdada; o E2E remoto completo também passou. |
| Smoke autenticado de cinco papéis | PASS | Evidência local/descartável 12A herdada; não houve mudança de código após `4a027ed`. |
| SQL/Supabase, 7 arquivos e 253 pgTAP | PASS | Evidência 12A herdada e job remoto `Supabase Authorization Matrix` verde. |
| Grants/RLS local | PASS | Matrizes locais 12A e job remoto descartável verdes. |
| Supabase schema lint local | PASS | Evidência 12A herdada; nenhuma migration local mudou desde a baseline. |
| Supabase Advisor local | PASS | Evidência 12A herdada. |
| Lint | PASS | Evidência 12A e job remoto no mesmo SHA. |
| Typecheck | PASS | Evidência 12A e job remoto no mesmo SHA. |
| Unitários, 36 arquivos/218 testes | PASS | Evidência 12A e job remoto no mesmo SHA. |
| Build Next.js 16.3.1 | PASS | Evidência 12A e dois builds remotos verdes no mesmo SHA. |
| Dependências de produção | PASS | Repetido: `npm audit --omit=dev --json`, zero vulnerabilidades. |
| Segredos no histórico | PASS | Gitleaks 12A e job remoto `Secret Scan` verde no mesmo SHA. |
| Arquivo legado associado ao incidente | PASS | Evidência 12A herdada; nenhum valor foi aberto ou reproduzido. |
| `git diff --check` | PASS | Repetido ao final da 12B, sem erro de whitespace. |
| Workflow GitHub Actions | PASS | Item 12A antes `NOT VERIFIED`; run `32611998642`, conclusão `success`, quatro jobs verdes no SHA `4a027ed`. |
| Advisor/grants/RLS remotos | FAIL | Item 12A antes `NOT VERIFIED`; controles centrais passaram, mas foram observados grants excedentes na tabela de junção e drift de uma migration de índice. |
| Sentry e reauditoria final | PASS | Item 12A antes `N/A`; consulta read-only e reauditoria executadas nesta sprint, com findings residuais abaixo. |

## 4. Verificações repetidas ou concluídas

| Verificação | Resultado | Classificação da evidência | Evidência objetiva |
|---|---|---|---|
| Teste arquitetural de dados sensíveis | PASS | OBSERVED | `npm test -- test/architecture-sensitive-data.test.ts`: 1 arquivo, 3 testes. |
| Auditoria de dependências de produção | PASS | OBSERVED | 0 vulnerabilidades; 204 dependências de produção auditadas. |
| GitHub Actions no SHA final 12A | PASS | OBSERVED | Run [32611998642](https://github.com/VedaBene/Veda-Bene-App/actions/runs/32611998642): E2E, lint/typecheck/test/build, secret scan e matriz Supabase concluídos com sucesso. |
| RLS remoto | PASS | OBSERVED | Consulta de catálogo: nenhuma tabela pública sem RLS entre as tabelas de aplicação. |
| Confidencialidade por grants de coluna | PASS | OBSERVED | `authenticated` não possui `SELECT` nas colunas financeiras/restritas de `profiles`, `properties` e `service_orders`; listas permitidas coincidem com ADR 018. |
| Grants da tabela de junção | FAIL | OBSERVED | `authenticated` ainda possui `REFERENCES`, `TRIGGER` e `TRUNCATE`, além dos grants CRUD, em `service_order_cleaning_staff`. |
| Funções privilegiadas/RPCs | PASS | OBSERVED | Helpers públicos `SECURITY DEFINER` não têm execução por `anon`/`authenticated`; adapters privados possuem grants estreitos; RPCs de escrita permanecem `SECURITY INVOKER` e sem acesso anônimo. |
| Auth/lockout remoto | PASS | OBSERVED | `auth_login_attempts` não concede acesso ao cliente e `record_failed_login` permanece restrita ao papel privilegiado; o comportamento funcional foi comprovado no E2E descartável. |
| Storage privado de fotos | PASS | OBSERVED | Bucket privado, limite 2 MiB, MIME JPEG/WebP e zero policies diretas em `storage.objects`, conforme ADRs 012/014. |
| Advisor de segurança remoto | PASS | OBSERVED | Apenas INFO `rls_enabled_no_policy` para `auth_login_attempts`, configuração intencional sem acesso cliente conforme ADR 008. [Remediação de referência](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). |
| Advisor de performance remoto | PASS | OBSERVED | Consulta concluída; quatro índices sem uso, múltiplas policies permissivas e estratégia absoluta de conexões do Auth foram registrados como riscos baixos, sem finding de segurança crítico/alto. |
| Paridade de migrations remota | FAIL | OBSERVED | A migration local `20260821100000_add_service_orders_checkin_idx.sql` não consta do ledger remoto e `public.service_orders_checkin_at_idx` não existe. |
| Revogação da credencial legada | PASS | INFERRED | Consulta atual mostra a chave legada `anon` desabilitada e a publishable key moderna ativa; documentação do incidente registra rotação conjunta do par legado. O valor da credencial nunca foi consultado. |
| Sentry `production`, 14 dias | PASS | OBSERVED | Consulta concluída; não há evento posterior à baseline `4a027ed`, mas permanece não resolvido `JAVASCRIPT-NEXTJS-Z`, 2 eventos em `GET /service-orders`, último em 2026-08-20. [Issue](https://veda-bene.sentry.io/issues/141441997/). Ausência de evento novo não foi usada como prova isolada. |
| Docker e configuração de runtime | PASS | OBSERVED | Build multi-stage Node 22, `npm ci`, saída `standalone`, runner `nextjs` não privilegiado, `.env*` fora do contexto e sourcemaps removidos após upload; `.env.example` contém somente placeholders. |
| Deployment Coolify associado ao SHA | PASS | OBSERVED / INFERRED | Captura da UI mostra deployment `Success` do commit `4a027ed`; logs do mesmo serviço mostram Next.js 16.3.1 pronto em `0.0.0.0:3000`. A declaração do responsável identifica Coolify como produção canônica. |
| Integração Vercel associada ao SHA | N/A | OBSERVED / NOT VERIFIED | O deployment GitHub `6043445511`, criado por `vercel[bot]`, recebeu `failure`; causa detalhada não foi obtida. Como Vercel não é a produção canônica declarada, o evento não bloqueia a liberação. |
| Healthcheck automático do Coolify | NOT VERIFIED | OBSERVED | A UI mostra `Running (unknown)` e o botão `Enable Healthcheck`; portanto não há verificação automática de prontidão disponível nesta auditoria. Nenhuma alteração foi feita. Limitação não bloqueadora. |
| Smoke em produção | N/A | NOT VERIFIED | Não executado porque não houve autorização específica; nenhuma requisição foi feita ao alvo de produção. |

Não foram repetidos lint, typecheck, suíte Vitest inteira, build, pgTAP completo,
smoke local nem E2E local porque o código permaneceu no mesmo SHA validado e o
CI remoto posterior executou os mesmos controles. Essa seleção evita substituir
evidência válida por repetição sem mudança.

## 5. Reauditoria técnica por domínio

| Domínio obrigatório | Resultado | Síntese |
|---|---|---|
| Arquitetura e limites entre módulos | PASS | Módulos privilegiados são `server-only`, adapters permanecem estreitos, seleções sensíveis ficam no DAL e o teste arquitetural passou. |
| Autorização, RLS, grants e acesso direto | FAIL | RLS, grants sensíveis e RPCs centrais passaram; grants DDL excedentes na tabela de junção violam least privilege. |
| Autenticação e lockout | PASS | Login same-origin, Zod, mensagem genérica, HMAC e lockout persistido/atômico permanecem cobertos; acesso cliente à tabela/RPC foi negado. |
| Integridade dos fluxos críticos | PASS | E2E remoto no Supabase descartável, persistência e transições críticas passaram. |
| Relatórios, dashboard, CSV e PDF | PASS | Produtores canônicos e autorização server-side passaram; a limitação de PDF sem comparação binária pixel a pixel está registrada separadamente. |
| Timezone `Europe/Rome` | PASS | Helpers centralizados, relatórios e componentes críticos especificam Roma; casos CET/CEST permanecem cobertos. |
| Tratamento de erros | FAIL | Contratos centrais são genéricos, mas o convite de funcionário ainda devolve mensagem bruta desconhecida do provedor Auth. |
| Validação de entradas | PASS | Zod cobre login, filtros, IDs, datas, formulários e fotos; rotas de CSV validam auth, papel e query string. |
| Tipos e data access | PASS | Tipos gerados e view models permanecem locais; não há `select('*')` em produção nem casts inseguros fora de testes. |
| Testes, CI, build e documentação | PASS | Quatro jobs remotos verdes no SHA auditado; relatório e roadmap atualizados. |
| Segredos, Docker, dependências e deploy | PASS | Secret scan, audit e Docker passaram; o Coolify iniciou o SHA auditado. A integração Vercel falha, mas foi classificada como não canônica. O healthcheck automático permanece desabilitado como limitação operacional. |

## 6. Achados e riscos residuais

### Críticos

Nenhum risco crítico foi observado.

### Altos

Nenhum risco alto residual foi observado. O H-01 da versão inicial foi
reclassificado: a falha do deployment Vercel não representa o ambiente canônico
declarado, enquanto o deployment Coolify do mesmo SHA e seus logs de inicialização
fornecem a evidência operacional que faltava. A causa interna da integração Vercel
continua desconhecida e deve ser tratada somente se essa integração voltar a ser
necessária.

### Médios

| ID e classificação | Evidência | Impacto | Causa | Prioridade | Recomendação | Responsável/próximo passo sugerido |
|---|---|---|---|---|---|---|
| M-01 — OBSERVED | Migration local do índice de `checkin_at` ausente no ledger e no catálogo remoto. | Filtros por check-in podem degradar com crescimento da tabela; não altera correção ou confidencialidade atual. | Drift de implantação depois da baseline 12A. | P1 | Planejar aplicação incremental autorizada, com análise de impacto/lock, verificação e rollback não destrutivo. Não aplicar dentro da 12B. | DBA/owner Supabase. |
| M-02 — OBSERVED | `authenticated` possui `REFERENCES`, `TRIGGER` e `TRUNCATE` em `service_order_cleaning_staff`. | Amplia desnecessariamente o blast radius de uma conexão SQL autenticada; a Data API normal não expõe essas operações e RLS continua protegendo CRUD. | Grants amplos históricos não foram reduzidos para o contrato mínimo. | P1 | Propor migration incremental de revogação, testar matriz pgTAP e aplicar somente com autorização específica. | Segurança/DBA. |
| M-03 — OBSERVED | `lib/server/employees/invite-employee.ts` registra e retorna `authResult.error.message` no fallback desconhecido. | Pode expor detalhe interno do provedor ao cliente e acoplar UX ao texto externo. | Fallback não mapeado para o contrato genérico de erro. | P1 | Em mudança futura, preservar detalhe sanitizado apenas em observabilidade e retornar mensagem genérica/código estável. | Owner do domínio Employees/Auth. |
| M-04 — OBSERVED / INFERRED | Sentry `JAVASCRIPT-NEXTJS-Z`: dois abortos de stream em `GET /service-orders`, system-only, último em 2026-08-20. | Resposta de lista pode ser interrompida de forma intermitente para navegadores móveis afetados. | INFERRED como cancelamento/runtime de streaming; causa não confirmada. | P1 | Monitorar recorrência por release/browser e investigar request/runtime se reaparecer; não tratar prioridade do Sentry como severidade automática. | Owner App/observabilidade. |

### Baixos

| ID e classificação | Evidência | Impacto | Causa | Prioridade | Recomendação | Responsável/próximo passo sugerido |
|---|---|---|---|---|---|---|
| L-01 — OBSERVED | Advisor: policies permissivas múltiplas, quatro índices sem uso e conexões Auth absolutas. | Custo adicional de policies e possível dificuldade de escalar Auth; índices “sem uso” podem refletir janela curta. | Otimizações ainda não consolidadas. | P2 | Medir antes de alterar; consolidar policies apenas se a matriz de autorização continuar equivalente. | DBA/performance. |
| L-02 — INFERRED | E2E usa Chromium desktop; PDF valida HTML/print view, sem diff visual ou binário. | Regressões específicas de browser/layout podem escapar. | Escopo determinístico da suíte 12A. | P2 | Adicionar cobertura seletiva multi-browser e snapshot/inspeção PDF quando o risco justificar. | QA/frontend. |
| L-03 — OBSERVED / INFERRED | CSV a pagar autentica e autoriza, mas não declara `Cache-Control: private, no-store` nem `X-Content-Type-Options: nosniff`, presentes no CSV a receber. | Defesa em profundidade inconsistente para relatório financeiro baixado; o Route Handler não é cacheado pelo framework por padrão. | Hardening desigual entre rotas irmãs. | P2 | Alinhar headers em mudança futura e cobrir com teste de rota. | Owner Reporting/API. |
| L-04 — OBSERVED | Erros esperados de limite de fotos e transição inválida permanecem como issues não resolvidas no Sentry. | Ruído reduz a relação sinal/ruído da observabilidade. | Erros de negócio capturados como issues operacionais. | P2 | Classificar/filtrar por código de domínio sem ocultar falhas inesperadas. | Owner App/observabilidade. |
| L-05 — OBSERVED / NOT VERIFIED | Coolify exibe `Running (unknown)` porque o healthcheck está desabilitado; os logs de inicialização estão prontos, mas não houve requisição de produção. | Não há sinal automático de prontidão/reinício para detectar indisponibilidade após a inicialização. | Healthcheck não configurado; endpoint/porta adequados não foram validados para uma alteração de plataforma. | P2 | Em mudança operacional autorizada, configurar healthcheck compatível com a porta 3000 e uma rota de prontidão; validar antes de salvar. | Responsável de operações/deploy. |

## 7. Itens NOT VERIFIED e limitações

1. A causa detalhada do deployment Vercel falho não foi obtida. A produção
   canônica foi identificada pelo responsável como Coolify, e o deployment
   Coolify do SHA auditado foi observado como bem-sucedido e pronto; a falha
   Vercel deixou de ser um controle obrigatório do gate.
2. A causa raiz de `JAVASCRIPT-NEXTJS-Z`; a evidência disponível permite medir
   frequência e contexto técnico, não atribuir causa definitiva.
3. O estado da credencial legada `service_role` não foi consultado diretamente.
   A conclusão de revogação é `INFERRED` pela chave legada desabilitada, pelo
   comportamento documentado do par JWT legado e pelo registro do incidente.
4. O healthcheck automático do Coolify está desabilitado e não foi habilitado
   nesta sprint; a ausência de smoke/HTTP em produção permanece deliberada por
   falta de autorização específica.
5. Compatibilidade multi-browser e equivalência visual/binária de PDF não foram
   verificadas; são limitações não bloqueadoras já herdadas da 12A.

O smoke de produção é `N/A` nesta execução, não uma prova negativa: foi
deliberadamente omitido por ausência de autorização específica. A ausência de
eventos posteriores no Sentry também não constitui, isoladamente, prova de
segurança ou estabilidade.

## 8. Mudanças documentais realizadas

- Criado este relatório final com evidências, classificação e owners.
- Atualizado `docs/evolution/architecture-hardening-roadmap.md` com o gate de
  entrada, progresso, status `completed`, nota e decisão `READY WITH WARNINGS`.
- `README.md`, `CLAUDE.md` e ADRs não foram alterados: não foi comprovada
  divergência normativa ou arquitetural que devesse reescrever documentação
  histórica. Os findings novos são riscos operacionais/hardening e ficam
  registrados aqui.

Nenhum código de produção, teste, migration ou configuração de runtime foi
modificado, em conformidade com a proibição de implementar correções na 12B.

## 9. Nota técnica final comparável

| Critério comparável | Peso | Nota 12B | Evidência dominante |
|---|---:|---:|---|
| Arquitetura e limites | 20% | 8,6 | DAL, adapters estreitos, módulos server-only e teste arquitetural. |
| Segurança, autorização e dados | 25% | 8,2 | RLS/grants sensíveis/Storage verdes; grants excedentes na junção. |
| Integridade, reporting e timezone | 20% | 9,0 | E2E crítico, pgTAP, dashboard/CSV/PDF e CET/CEST. |
| Validação, erros, tipos e data access | 15% | 8,2 | Zod e typecheck fortes; fallback Auth bruto residual. |
| Testes, CI e supply chain | 10% | 9,2 | CI integral verde, audit zero e Gitleaks verde. |
| Operação, deploy, observabilidade e documentação | 10% | 8,0 | Coolify iniciou o SHA auditado e os logs mostram prontidão; Sentry consultado; healthcheck automático e smoke de produção não foram executados. |

**Nota técnica final: 8,5/10**, evolução de **+1,7 ponto** sobre a baseline de
6,8/10 de 2026-08-15 e acima da meta estrutural de 8,2/10. A nota mede a
qualidade técnica do baseline; não substitui o gate binário de liberação.

## 10. Gate e recomendação de continuidade

### Decisão: `READY WITH WARNINGS`

Não há risco crítico/alto conhecido e o controle obrigatório de deployment foi
confirmado pelo Coolify no SHA auditado. Permanecem riscos médios/baixos e
limitações não bloqueadoras: drift de migration, grants DDL excedentes, fallback
de erro Auth, issue de abortos no Sentry, Advisor de performance, healthcheck
desabilitado, cobertura visual/multi-browser e smoke de produção não autorizado.
A Sprint 12B fica `completed` e o programa é encerrado com advertências.

A continuidade recomendada é manter M-01 a M-04 e L-01 a L-05 no backlog com os
owners indicados e configurar healthcheck somente em mudança operacional
autorizada. Não há Sprint 13 proposta; nenhuma correção foi implementada nesta
auditoria.
