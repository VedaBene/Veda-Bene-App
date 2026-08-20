# Roadmap ativo de endurecimento arquitetural

**Status do programa:** Sprints 00–07 concluídas localmente; Sprint 08 planejada e não iniciada

**Baseline da auditoria:** 2026-08-15

**Última atualização:** 2026-08-20

**Nota técnica de referência:** 6,8/10

**Meta após os riscos críticos:** pelo menos 8,2/10, sem reescrita do sistema

## 1. Finalidade e autoridade deste documento

Este é o roteiro ativo para executar, de forma incremental, as melhorias
identificadas na auditoria técnica de arquitetura, engenharia, segurança,
testes e manutenibilidade do Veda Bene. Ele complementa o histórico concluído
em `docs/evolution/strategic-roadmap.md`; não reabre nem altera retroativamente
as etapas 0–8 daquele programa.

Este documento deve ser a fonte de verdade para continuidade entre sessões e
agentes. Antes de trabalhar em qualquer sprint deste roteiro, o agente deve:

1. ler `AGENTS.md`, `CLAUDE.md`, `docs/production-data-safety.md` e este arquivo;
2. ler os ADRs e documentos indicados na sprint;
3. conferir `git status --short` e preservar alterações locais do usuário;
4. confirmar que todas as dependências da sprint estão `completed`;
5. executar somente o escopo da sprint solicitada;
6. ler a documentação local relevante do Next.js 16 em
   `node_modules/next/dist/docs/` antes de alterar código Next.js;
7. consultar a documentação atual do Supabase antes de alterar Auth, RLS,
   grants, views, funções, triggers ou migrations;
8. atualizar o status e as evidências deste documento ao encerrar a sprint;
9. nunca fazer `git commit` ou `git push` sem pedido expresso do usuário.

Uma nova sprint não deve ser iniciada automaticamente ao terminar a anterior.
Cada sprint exige uma solicitação ou autorização de execução própria.

## 2. O que este plano preserva

- O monólito modular em Next.js 16 com Server Components e Server Actions.
- Supabase Auth, Postgres e RLS como infraestrutura atual.
- O DAL, os serviços de reporting, os DTOs e os adapters server-only já
  existentes.
- As regras funcionais, a interface e os fluxos operacionais atuais.
- `Europe/Rome` como fuso canônico do negócio.
- A integridade integral dos dados existentes em produção.

Não fazem parte do programa: migração para microserviços, troca de framework,
reescrita geral, mudança estética ampla, substituição do Supabase ou limpeza
cosmética de arquivos apenas por tamanho.

## 3. Baseline de evidências da auditoria

As prioridades abaixo não são recomendações genéricas. Elas derivam destas
evidências concretas:

| Área | Evidência observada | Risco |
|---|---|---|
| Confidencialidade de colunas | O próprio `docs/decisions/002-cls-via-filtro-select.md` registra que a proteção de colunas está somente em `select()`/DTOs. A inspeção read-only do catálogo em 2026-08-15 confirmou grants de `SELECT` do role Postgres `authenticated` sobre colunas financeiras e de remuneração em `profiles`, `properties` e `service_orders`. | Crítico: uma chamada autenticada direta à Data API pode contornar a filtragem da aplicação. |
| Integridade de O.S. | A inspeção read-only confirmou `UPDATE` amplo para `authenticated`; a policy `service_orders_limpeza_update` restringe linhas, mas não colunas. | Crítico: um usuário de limpeza pode tentar alterar diretamente campos fora do fluxo permitido. |
| Datas financeiras | `lib/server/reporting/financial.ts` usa `.lte('completed_at', endDate)` e constrói limites com UTC; `components/statements/PayableStatement.tsx` e `app/(app)/statements/payable/page.tsx` também usam `toISOString().slice(0, 10)`. | Alto: exclusão de parte do último dia, divergência CET/CEST e números inconsistentes em dashboard/extratos. |
| Atomicidade | `app/(app)/service-orders/actions.ts` grava O.S. e vínculos de equipe em chamadas separadas; `app/(app)/properties/actions.ts` resolve/cria agência ou proprietário antes da propriedade; `app/(app)/employees/actions.ts` convida no Auth e depois atualiza o perfil. | Alto: estados parciais quando a segunda operação falha. |
| Concorrência de login | `lib/server/auth/login-lockout.ts` lê `failed_count`, soma em memória e faz `upsert`. | Alto: atualizações concorrentes podem perder incrementos e enfraquecer o bloqueio. |
| Segredos no build | `.dockerignore` ignora apenas `.env*.local`, enquanto o `Dockerfile` executa `COPY . .`; existe um arquivo local de backup de ambiente ignorado pelo Git, mas não coberto por esse padrão do Docker. | Alto: arquivos locais sensíveis podem entrar no contexto/cache de build. Nenhum valor secreto foi lido ou registrado nesta auditoria. |
| Dependências | `npm audit --omit=dev` encontrou, no baseline de 2026-08-15, 13 vulnerabilidades de produção: 6 altas, 6 moderadas e 1 baixa. `package.json` fixava Next.js 16.2.12 e `@sentry/nextjs` 10.50.0. | Alto: exposição a falhas já conhecidas; atualização precisa ser isolada e testada. |
| Testes reais de autorização | `.github/workflows/ci.yml` executa lint, typecheck, Vitest e build, mas não executa os SQLs de `supabase/tests/`; não há E2E autenticado. `test/fake-supabase.ts` não modela grants, RLS real, `TIMESTAMPTZ` ou concorrência. | Alto: a suíte verde não prova as fronteiras de banco mais críticas. |
| Validação | `app/(app)/service-orders/actions.ts` aceita a conversão falhar em `optIsoDateStr`; não há invariante explícita `checkin_at >= checkout_at`. Os emails em `app/(app)/properties/actions.ts` usam string opcional, sem validação de email. | Médio: dados inválidos e intervalos negativos podem atravessar a action. |
| Tipagem e limites | Clientes Supabase não usam um `Database` gerado; há casts `as unknown as` em DAL/reporting/actions, e `lib/types/database.ts` é manual. Dez arquivos de `app/` ainda chamam `.from()` diretamente. | Médio: drift silencioso e baixa localidade para regras de acesso. |
| Erros | Actions de propriedades, O.S. e funcionários retornam ou concatenam `error.message` do Supabase. | Médio: contrato inconsistente e possível exposição de detalhes internos. |
| Configuração Supabase | O Advisor read-only apontou proteção de senhas vazadas desativada e múltiplas policies permissivas. Todas as oito tabelas públicas verificadas tinham RLS habilitado; `auth_login_attempts` não tinha grants para clientes públicos, o que é intencional. | Médio/alto: há hardening pendente, mas não se deve consolidar policies sem testes por papel. |
| Documentação | `README.md`, `CLAUDE.md` e o histórico de evolução divergem em alguns contadores/links; alguns documentos antigos possuem referências absolutas. | Baixo/médio: onboarding e decisões futuras podem partir de contexto incorreto. |

No baseline, `npm run lint`, `npm run typecheck`, `npm test` e
`npm run build` passaram; o Vitest executou 29 arquivos e 141 testes. Isso é uma
base positiva, mas não neutraliza os riscos de autorização e concorrência acima.

## 4. Regras de segurança e banco de dados

### 4.1 Classificação de impacto

- **DB-0 — nenhum:** não altera schema, dados, RLS, grants, funções, triggers,
  buckets ou configuração remota.
- **DB-L — somente descartável:** usa apenas Supabase local/efêmero; é proibido
  usar `--linked` ou credenciais de produção.
- **DB-C — configuração externa:** altera Auth/projeto, mas não schema nem
  registros. Ainda exige aprovação explícita por poder mudar comportamento.
- **DB-P — mudança Postgres planejada:** cria migration, função, trigger, grant,
  policy ou outra estrutura. Pode ser desenvolvida e ensaiada localmente, mas
  qualquer aplicação em ambiente remoto exige autorização explícita e
  específica do usuário.

### 4.2 Dossiê obrigatório para qualquer sprint DB-P

Antes de escrever a migration, a sprint deve registrar neste documento ou em
um documento vinculado:

- motivo, objetos afetados e comandos SQL propostos;
- pré-condições e consulta de detecção de drift;
- compatibilidade entre a aplicação anterior, a preparada e a nova;
- locks esperados, `lock_timeout`, `statement_timeout` e duração estimada;
- invariantes antes/depois, incluindo contagem de linhas e chaves;
- testes por role, Data API, integração e fluxo funcional;
- ordem exata de implantação, janela de observação e critério go/no-go;
- rollback não destrutivo e correção progressiva;
- confirmação de backup e restauração ensaiada quando a implantação remota for
  autorizada.

Nenhuma sprint deste plano autoriza por si só uma migration em produção. Não se
deve executar `supabase db push --linked`, SQL mutável remoto, alteração de RLS,
grants, Auth ou Storage sem autorização específica para aquela execução.

### 4.3 Decisão arquitetural para os riscos críticos

Uma solução apenas na aplicação não consegue impedir um usuário autenticado de
consultar ou atualizar diretamente a Data API com os grants atuais. Portanto:

1. primeiro serão criados testes reais e seams server-only compatíveis com o
   comportamento atual;
2. depois serão adicionadas proteções mínimas no Postgres, em migrations
   separadas e sem alterar registros;
3. a versão imediatamente anterior da aplicação em cada cutover já deverá ser
   compatível com a proteção nova;
4. qualquer decisão que substitua a ADR 002 deverá gerar um novo ADR, sem editar
   o histórico aceito.

O padrão preferencial é aprofundar interfaces já existentes, não criar wrappers
por tabela. Um adapter privilegiado deve expor operações de negócio pequenas,
validar autorização antes de usar service role e nunca exportar o client bruto.

## 5. Gate global entre sprints

Uma sprint só pode mudar de `planned` para `in_progress` quando:

- todas as dependências estão `completed`;
- o diff local foi inspecionado e não há sobreposição não resolvida com trabalho
  do usuário;
- os riscos, arquivos e critérios da sprint continuam válidos no código atual;
- a baseline anterior está verde ou qualquer falha preexistente está registrada;
- para DB-C/DB-P, a autorização necessária foi confirmada;
- para DB-P, o dossiê da seção 4.2 está completo.

Uma sprint só pode mudar para `completed` quando:

- todos os critérios de aceitação foram comprovados;
- lint, typecheck, testes e build aplicáveis passaram;
- testes negativos provaram o bloqueio esperado, não apenas o caminho feliz;
- documentação/ADR foram atualizados quando a decisão mudou;
- a linha correspondente no registro de progresso contém evidências verificáveis;
- riscos residuais e follow-ups foram registrados, sem implementar a sprint
  seguinte oportunisticamente.

Estados permitidos: `planned`, `in_progress`, `completed`, `blocked` e
`deferred`.

## 6. Visão sequencial

| Sprint | Prioridade | Resultado principal | Banco | Depende de | Status |
|---|---:|---|---|---|---|
| 00 | P0 | Baseline e protocolo persistentes | DB-0 | — | completed |
| 01 | P0 | CI prova RLS/grants reais em banco descartável | DB-L | 00 | completed |
| 02 | P0 | Build, segredos, dependências e Auth endurecidos | DB-0 / DB-C | 01 | completed |
| 03 | P0 | Seams server-only preparados para o cutover | DB-0 | 02 | completed |
| 04 | P0 | Alterações diretas indevidas de O.S. bloqueadas | DB-P | 03 | completed |
| 05 | P0 | Colunas sensíveis protegidas contra Data API direta | DB-P | 04 | completed |
| 06 | P1 | Períodos financeiros corretos em `Europe/Rome` | DB-0 | 05 | completed |
| 07 | P1 | Bloqueio de login resistente à concorrência | DB-P | 06 | completed |
| 08 | P1 | Escrita de O.S. e vínculos atômica | DB-P | 07 | planned |
| 09 | P1 | Escrita de propriedade/relações atômica | DB-P | 08 | planned |
| 10 | P1 | Convite de funcionário idempotente e recuperável | DB-0 por padrão | 09 | planned |
| 11 | P2 | Tipos, validação, erros e data access mais locais | DB-0 | 10 | planned |
| 12 | P2 | Regressão E2E, documentação e reauditoria final | DB-L / read-only | 11 | planned |

## 7. Sprints detalhadas

### Sprint 00 — Baseline e protocolo persistentes

**Status:** completed — concluída somente como planejamento/documentação; nenhuma
melhoria de produção foi implementada.

**Objetivo:** transformar a auditoria em um roteiro versionado, sequencial e
retomável por novos agentes.

**Implementado nesta etapa de planejamento**
- Definição dos gates de entrada/saída e do registro de progresso.
- Inclusão do roadmap nos índices de documentação do projeto.

**Arquivos alterados:** este documento, `docs/evolution/README.md` e `README.md`.

**Impactos e implicações:** somente documentação; nenhum código, dependência,
schema, dado, configuração remota ou comportamento foi alterado.

**Resultado esperado:** qualquer agente consegue localizar a próxima sprint,
entender por que ela existe e saber quais controles impedem execução insegura.

**Critérios de conclusão**

- [x] Auditoria e nota de referência registradas.
- [x] Sprints ordenadas por dependência e criticidade.
- [x] Sprints DB-P sinalizadas e submetidas ao dossiê obrigatório.
- [x] Mecanismo de status, validação e evidências definido.
- [x] Nenhuma implementação iniciada.

### Sprint 01 — Testes reais de autorização em banco descartável

**Status:** completed — execução iniciada em 2026-08-16 e concluída em
2026-08-17, exclusivamente em ambiente local/descartável, sem vínculo,
credenciais ou acesso remoto.

**Objetivo:** fazer a CI provar as fronteiras de RLS, grants e Data API antes de
qualquer cutover de segurança.

**O que implementar**

- Executar os SQLs atuais de `supabase/tests/` em uma instância local/efêmera.
- Adicionar testes de caracterização da matriz papel × tabela × operação ×
  coluna, incluindo tentativas diretas que hoje demonstram as brechas.
- Separar expectativas atuais de testes que descrevem o estado seguro alvo,
  para não mascarar um risco como “comportamento aceito”.
- Integrar o job à CI sem credenciais ou vínculo com produção.
- Registrar comandos locais reproduzíveis e diagnóstico claro quando Docker ou
  Supabase CLI não estiver disponível.

**Arquivos/componentes prováveis**

- `.github/workflows/ci.yml`
- `package.json` e `package-lock.json`, somente se um script auxiliar for
  necessário
- `supabase/config.toml`
- `supabase/tests/*.sql`
- novo teste de matriz de autorização em `supabase/tests/`
- este roadmap, para registrar o resultado

**Impactos e implicações:** aumenta o tempo da CI e exige runtime local do
Supabase, mas não toca produção. Os testes devem usar somente dados sintéticos.

**Resultado esperado:** falhas de RLS/grants deixam de depender de inspeção
manual e passam a bloquear regressões futuras.

**Implementado**

- Supabase CLI `2.114.0` fixada como dependência de desenvolvimento e exposta
  pelo comando reproduzível `npm run test:supabase`.
- Runner cross-platform que copia `supabase/` para diretório temporário, troca o
  `project_id`, remove variáveis remotas, aceita somente `--local`/loopback,
  reconstrói todas as migrations e remove somente a stack isolada ao final.
- Matriz pgTAP com 49 testes do estado atual para os cinco papéis, cobrindo
  `profiles`, `properties`, `service_orders`, SELECT, UPDATE, colunas sensíveis,
  janela operacional e chamadas diretas privilegiadas.
- Oito garantias do estado seguro desejado registradas separadamente como
  `[TARGET][OPEN GAP]`/TODO, sem transformar as brechas atuais em contrato
  seguro nem antecipar as correções das Sprints 04 e 05.
- Execução automática dos três SQLs preexistentes: invariantes operacionais,
  bootstrap histórico de fotos e invariantes de formato. O bootstrap roda em
  um segundo banco temporário, apropriado ao seu contrato original.
- Job `database-authorization` na CI, sem secrets e sem projeto remoto.
- Documentação dos pré-requisitos, comando local, isolamento e matriz observada.

**Arquivos alterados nesta sprint**

- `.github/workflows/ci.yml`
- `package.json` e `package-lock.json`
- `scripts/test-supabase-local.mjs`
- `supabase/tests/README.md`
- `supabase/tests/database/authorization_matrix_current.test.sql`
- `supabase/tests/database/authorization_matrix_target.test.sql`
- este roadmap

**Comandos e resultados objetivos**

- `npm run test:supabase`: PASS; duas suítes, 57 testes pgTAP no total
  (49 caracterizações atuais aprovadas e oito falhas-alvo TODO explicitamente
  registradas); os três SQLs preexistentes executados; bootstrap/migrations de
  fotos aprovados em banco secundário; stack temporária removida.
- `npm run lint`: PASS.
- `npm run typecheck`: PASS; tipos de rotas gerados e `tsc --noEmit` verde.
- `npm test`: PASS; 29 arquivos e 141 testes.
- `npm run build`: PASS; Next.js 16.2.12 compilou e gerou 20 páginas.
- Revisão final: `git diff --check` sem erro, busca por padrões sensíveis sem
  valores secretos e nenhum container `veda-bene-sprint-01` remanescente.

**Riscos residuais e decisões**

- O estado atual continua permitindo ao role Postgres `authenticated` ler
  colunas sensíveis e permite a `limpeza` alterar `total_price` dentro de sua
  linha autorizada. Os testes demonstram essas brechas como `[KNOWN UNSAFE]`;
  as correções pertencem exclusivamente às Sprints 04 e 05.
- Os oito testes-alvo permanecem TODO por decisão explícita: falham visivelmente
  no relatório pgTAP, mas não tornam a CI vermelha antes do cutover planejado.
  Não foram invertidos, removidos nem enfraquecidos para ocultar o risco.
- O job exige Docker e baixa imagens na primeira execução, aumentando o tempo da
  CI. A mesma rotina foi comprovada localmente; nenhuma execução remota de CI foi
  disparada porque commit e push não foram autorizados.
- A CLI `db query --file` não aceita o bootstrap multi-comando nesta versão; o
  runner usa `psql` dentro do próprio container descartável, sem DSN externa.
- Nenhuma migration, policy, grant, Auth, Storage, configuração ou dado de
  produção foi criado, alterado ou consultado.

**Critérios de conclusão**

- [x] A CI sobe banco descartável desde o baseline de migrations.
- [x] Os três SQLs existentes são executados automaticamente.
- [x] A matriz cobre `admin`, `secretaria`, `limpeza`, `consegna` e `cliente`.
- [x] Há testes negativos para leitura de campos sensíveis e update indevido.
- [x] Nenhum comando usa `--linked` nem variável de produção.
- [x] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passam.

### Sprint 02 — Contenção de segredos, supply chain e configuração Auth

**Status:** completed — execução iniciada e concluída em 2026-08-17 após
validação do gate da Sprint 01 e da baseline local.

**Objetivo:** remover riscos de entrega independentes da arquitetura de domínio
antes das mudanças de autorização.

**O que implementar**

- Alterar `.dockerignore` para excluir `.env*`, preservando apenas exemplos sem
  segredos quando existirem; validar o contexto real do build.
- Remover backups locais de ambiente do contexto de build sem copiar, exibir ou
  versionar seus conteúdos.
- Adicionar varredura de segredos na CI e revisar o histórico apenas por padrões,
  sem imprimir valores encontrados.
- Atualizar dependências vulneráveis em lotes pequenos: primeiro patch seguro do
  Next.js/eslint-config, depois Sentry e demais pacotes; ler os guias locais do
  Next.js 16 e testar cada lote.
- Reexecutar `npm audit --omit=dev` e registrar vulnerabilidades residuais com
  decisão explícita, sem upgrades major automáticos.
- Em subpasso DB-C separado e com aprovação, habilitar a proteção de senhas
  vazadas do Supabase Auth e testar login, reset e mensagens genéricas.

**Arquivos/componentes prováveis**

- `.dockerignore`, `.gitignore`
- `.github/workflows/ci.yml`
- `package.json`, `package-lock.json`
- `next.config.ts`, arquivos `sentry.*.config.ts` apenas se exigido por versão
- configuração do Supabase Auth, fora do repositório, em subpasso aprovado

**Impactos e implicações:** atualizações podem revelar deprecações de framework;
a configuração de senhas vazadas muda comportamento de autenticação e não deve
ser ativada junto de um deploy não relacionado.

**Resultado esperado:** nenhum arquivo de ambiente entra no build, a CI detecta
novas exposições e as vulnerabilidades tratáveis sem mudança major são reduzidas.

**Implementado**

- `.dockerignore` passou a excluir todo `.env*`, reintroduzindo somente
  `.env.example`, e também bloqueia artefatos comuns de backup/editor. Um build
  negativo comprovou que `.env.local` e o backup local preexistente não entram
  no contexto; seus conteúdos não foram lidos, copiados nem exibidos.
- Gitleaks `8.30.1`, fixado por versão e digest de imagem, foi adicionado à CI
  com histórico completo, filesystem read-only e `--redact=100`, sem relatório,
  comentário ou artefato. A única ocorrência histórica corresponde ao incidente
  revogado de 2026-08-07 e foi isolada por fingerprint em `.gitleaksignore`;
  qualquer nova ocorrência continua bloqueante.
- Next.js e `eslint-config-next` foram atualizados juntos de `16.2.12` para
  `16.3.1`; `@sentry/nextjs`, de `10.50.0` para `10.70.0`; transitivos Babel,
  `brace-expansion`, `js-yaml` e Vite receberam somente correções compatíveis.
  React permaneceu em `19.2.4` e Node mínimo em `>=22.0.0`.
- `npm audit --omit=dev` passou de 13 findings (6 altos, 6 moderados, 1 baixo)
  para zero. A auditoria completa, incluindo desenvolvimento, também terminou
  com zero finding.
- Todos os lotes passaram por lint, typecheck, testes, build,
  57 pgTAP mais invariantes SQL, secret scan e build Docker sem cache. A imagem
  final não contém `.env*` nem backups; `/login`, `/forgot-password` e
  `/update-password` responderam HTTP 200 no smoke local.

**Subpasso DB-C — concluído após autorização específica**

- A autorização específica foi concedida em 2026-08-17. Foi habilitada
  exclusivamente **Prevent use of leaked passwords / Leaked Password
  Protection** nas configurações do Supabase Auth; as demais opções do diálogo
  não foram alteradas.
- O painel confirmou a opção salva e o Advisor de segurança deixou de reportar
  `auth_leaked_password_protection`. Permaneceu somente o aviso informativo já
  conhecido de RLS sem policy em `auth_login_attempts`, coerente com o ADR 008.
- A proteção consulta HaveIBeenPwned e rejeita senhas comprometidas ao
  defini-las ou atualizá-las. Convites e o envio do link de recuperação não
  foram alterados.
- `/update-password` deixou de repassar mensagens cruas do provedor: senha
  fraca/comprometida, sessão expirada e falha desconhecida agora recebem textos
  controlados. Quatro testes unitários cobrem esses casos. O login mantém sua
  resposta genérica já coberta pelos testes da rota; convite e recuperação
  convergem para a mesma tela de definição de senha. A validação não criou
  usuários, não enviou convites/recuperações reais e não usou credenciais reais.
- Validação final: `npm run lint`, `npm run typecheck`, 30 arquivos/145 Vitest,
  `npm run build`, 57 pgTAP e invariantes SQL passaram; `npm audit` completo e
  `--omit=dev` retornaram zero vulnerabilidades; Gitleaks examinou 97 commits sem
  novo vazamento; build Docker `--no-cache` passou e a imagem final não contém
  `.env*` nem backups.
- Nenhum schema, migration, dado, RLS, grant, função, trigger ou Storage de
  produção foi alterado. Não houve commit, push nem início da Sprint 03.
- Rollback: desabilitar a mesma opção de Auth e revalidar os fluxos; não há
  reversão de dados porque a configuração não reescreve senhas nem registros.

**Critérios de conclusão**

- [x] O contexto de build exclui qualquer `.env*` real e inclui no máximo
  placeholders seguros.
- [x] A varredura de segredos passa sem registrar valores sensíveis.
- [x] Se houver indício de exposição histórica, a sprint é interrompida e há
  plano de revogação/rotação antes de prosseguir.
- [x] Cada lote de dependência passa por lint, typecheck, testes, build e smoke.
- [x] Findings residuais do `npm audit` têm justificativa e responsável.
- [x] A mudança Auth, se autorizada, é validada separadamente e pode ser
  revertida por configuração, sem alterar dados.

### Sprint 03 — Seams server-only para dados sensíveis

**Status:** completed — implementação e gates concluídos em 2026-08-17. O
pgTAP foi reexecutado em stack descartável e o smoke autenticado passou para os
cinco papéis. Nenhuma conexão remota ou alteração de banco foi realizada.

**Objetivo:** preparar a aplicação para funcionar após a restrição de grants,
sem mudar ainda o banco nem o comportamento visível.

**O que implementar**

- Aprovar uma matriz canônica de campos sensíveis por papel e caso de uso.
- Criar operações server-only profundas e estreitas para os poucos fluxos que
  legitimamente precisam de remuneração, preços ou valores financeiros.
- Reutilizar o padrão de `utils/supabase/admin.ts`, mantendo o client
  privilegiado privado e validando autenticação/autorização antes de qualquer
  bypass de RLS.
- Migrar somente os chamadores sensíveis para essas operações; preservar DTOs e
  contratos atuais.
- Proibir novos `select('*')` ou acesso direto sensível por regra de lint/teste
  de arquitetura quando viável.
- Criar testes por papel e por operação, incluindo tentativa de importar ou
  obter o client bruto.

**Arquivos/componentes prováveis**

- `utils/supabase/admin.ts` ou novo adapter dedicado em `lib/server/`
- `lib/server/authz.ts`
- `lib/server/data-access/properties.ts`
- `lib/server/data-access/service-orders.ts`
- `lib/server/reporting/financial.ts`
- páginas/actions de funcionários, propriedades, O.S. e extratos que ainda
  acessam dados sensíveis diretamente
- testes próximos aos adapters/DAL

**Impactos e implicações:** o service role aumenta o raio de impacto se a
interface for ampla. Cada operação deve aceitar entradas validadas, retornar o
DTO mínimo e nunca devolver o client Supabase ao chamador.

**Resultado esperado:** a aplicação preparada funciona com os grants atuais e
continuará funcionando quando os grants sensíveis forem removidos na Sprint 05.

**Implementação e evidências de 2026-08-17**

- A matriz canônica foi versionada em `docs/sensitive-data-matrix.md`, cobrindo
  campos, papéis, casos de uso, operações, DTOs e consumidores. A divergência
  preexistente sobre `properties.avg_cleaning_hours` foi resolvida como acesso
  sensível contextual: administração/finanças são de `admin`, enquanto a
  estimativa operacional só acompanha linhas/opções já autorizadas por RLS.
- O adapter `lib/server/data-access/sensitive-data.ts` mantém o client
  privilegiado privado, autentica e autoriza pelo perfil confiável antes de
  criá-lo, valida IDs/filtros e expõe somente operações de negócio estreitas:
  administração de imóveis e funcionários, opções e horas operacionais de O.S.,
  campos financeiros autorizados de O.S., contextos de pricing, fontes de A
  Pagar/A Receber e fonte financeira do dashboard.
- Chamadores sensíveis de imóveis, funcionários, O.S., pricing, dashboard,
  extratos e exports CSV/PDF foram migrados. Fórmulas, DTOs de saída e escopo
  visível por papel foram preservados; clientes não receberam campos novos.
- Arquivos alterados: `CLAUDE.md`, `docs/sensitive-data-matrix.md`, este roadmap,
  `lib/server/data-access/{sensitive-data,properties,service-orders,dashboard}.ts`,
  `lib/server/{pricing,reporting/financial,reporting/receivable}.ts`, páginas de
  funcionários, actions de dashboard/O.S./extratos, rotas de exportação A
  Pagar/A Receber e `utils/supabase/admin.ts`; seus testes próximos, o teste
  arquitetural e o fake Supabase foram atualizados em conjunto. O gate local
  repetível foi adicionado em `scripts/test-sensitive-data-smoke-local.mjs` e
  `package.json`; `next.config.ts` apenas impede que esse gate altere
  `AGENTS.md` durante o `next dev` efêmero.
- `utils/supabase/admin.ts` passou a autenticar e exigir `admin` antes da criação
  do client privilegiado. Nenhum client bruto ou proxy genérico foi exportado.
- `test/architecture-sensitive-data.test.ts` verifica via AST/grafo de imports
  que selects sensíveis não escapem do adapter, que `select('*')` não seja usado
  nas tabelas classificadas, que módulos privilegiados não alcancem o bundle
  client e que não haja export de client bruto. Os testes do adapter cobrem
  autorização antes do privilégio, DTO mínimo e interseção com linhas visíveis
  por RLS.
- Validação da aplicação: `npm run lint`, `npm run typecheck`, 32 arquivos/152
  testes Vitest e `npm run build` (20 rotas) passaram. A auditoria do diff não
  encontrou alteração em `supabase/**`, segredo novo ou marcador privilegiado
  no bundle client.
- `npm run test:supabase` passou com 57 pgTAP, invariantes e smoke de migrations
  de fotos; os oito `TODO` continuam sendo gaps conhecidos das Sprints 04/05.
  `npm run test:smoke:sensitive-data` criou uma stack e cinco usuários locais
  descartáveis, autenticou `admin`, `secretaria`, `limpeza`, `consegna` e
  `cliente`, validou telas, guards, campos permitidos/negados, dashboard,
  extratos e CSVs, e removeu integralmente o ambiente ao terminar.
- O smoke revelou uma incompatibilidade com UUIDs históricos do baseline que
  não carregam bits de versão RFC. O adapter agora valida a representação UUID
  canônica aceita pelo Postgres sem rejeitar registros existentes; o teste do
  adapter cobre essa regressão.
- Não houve alteração de schema, migration, dados, RLS, grants, Auth, Storage ou
  produção. Não houve commit, push nem início da Sprint 04.

**Critérios de conclusão**

- [x] Matriz de dados sensíveis implementada, versionada e com decisão contextual
  explícita para `avg_cleaning_hours`.
- [x] Nenhum componente client recebe campo adicional.
- [x] Nenhum raw service-role client é exportado.
- [x] Não há acesso direto a coluna sensível fora dos adapters aprovados.
- [x] Comparação funcional autenticada por papel confirma o mesmo comportamento de tela,
  CSV, PDF e dashboard.
- [x] A Sprint 01 continua verde em reexecução SQL sobre o diff atual.

### Sprint 04 — Guard de integridade para updates de O.S.

**Status:** completed — implementação local, implantação e validação remota
concluídas em 2026-08-18 após autorização específica, backup/restauração
confirmados e janela operacional sem O.S. em curso. A Sprint 05 não foi
iniciada.

**Dossiê DB-P:**
[`sprint-04-service-order-update-guard-db-p.md`](sprint-04-service-order-update-guard-db-p.md)

**Objetivo:** impedir no banco que perfis operacionais alterem colunas fora das
transições autorizadas, mesmo por chamada direta à Data API.

**O que implementar**

- Produzir dossiê DB-P e matriz de colunas mutáveis por papel/ação.
- Adicionar um guard mínimo e localizado, preferencialmente trigger
  `BEFORE UPDATE`, que compare `OLD`/`NEW` e rejeite mudanças protegidas para
  `limpeza`/`consegna`, preservando fluxos atuais de admin/secretaria.
- Manter funções auxiliares privilegiadas fora de schema exposto, com
  `search_path` vazio e grants mínimos.
- Cobrir transições de status, tracking, fotos/ciclo, extras, preços,
  atribuições e timestamps com testes positivos e negativos.
- Ensaiar a migration desde o baseline e sobre cópia isolada, sem alterar
  registros existentes.

**Arquivos/componentes prováveis**

- `supabase/migrations/<timestamp>_guard_service_order_updates.sql`
- `supabase/tests/*service_order*authorization*.sql`
- `app/(app)/service-orders/actions.ts`, somente se a compatibilidade exigir
- novo ADR se o guard estabelecer contrato arquitetural durável

**Impactos e implicações:** DB-P obrigatório. O trigger passa a participar de
toda atualização de O.S.; lógica ampla ou queries adicionais dentro dele são
proibidas sem evidência de necessidade/performance.

**Resultado esperado:** chamadas diretas não conseguem modificar campos
financeiros, atribuições ou outros campos protegidos; ações legítimas continuam
iguais.

**Critérios de conclusão**

- [x] Dossiê DB-P completo.
- [x] Aplicação remota separadamente autorizada, executada e validada.
- [x] A migration não altera nem remove registros.
- [x] Row count, chaves e valores existentes são idênticos antes/depois.
- [x] Tentativas negativas falham no banco para cada papel operacional.
- [x] Admin/secretaria e transições legítimas passam nos testes existentes.
- [x] Locks, timeouts, plano de implantação e rollback não destrutivo foram
  ensaiados.

### Sprint 05 — Cutover da confidencialidade de colunas

**Status:** completed — implementação local, aplicação e validação remota
concluídas em 2026-08-19; Sprint 06 não iniciada.

**Dossiê DB-P:**
[`sprint-05-column-confidentiality-cutover-db-p.md`](sprint-05-column-confidentiality-cutover-db-p.md)

**Objetivo:** retirar da ADR 002 a responsabilidade de ser a única defesa e
impedir leitura direta de colunas sensíveis pela Data API.

**O que implementar**

- Criar um novo ADR que supersede a ADR 002, preservando seu histórico.
- Produzir dossiê DB-P com a matriz final de `profiles`, `properties` e
  `service_orders`.
- Com a aplicação da Sprint 03 já publicada e validada, remover grants
  table-level excessivos e conceder ao role `authenticated` apenas as colunas
  seguras necessárias à Data API.
- Usar os adapters server-only para casos autorizados que precisam das colunas
  retiradas.
- Evitar views por padrão. Se uma view for indispensável, usar
  `security_invoker = true`, grants mínimos e teste explícito de RLS; nunca
  introduzir view `security definer` exposta por conveniência.
- Validar queries relacionais do PostgREST sem reabrir `SELECT *`.

**Arquivos/componentes prováveis**

- `docs/decisions/018-*.md` e `docs/decisions/README.md`
- `supabase/migrations/<timestamp>_restrict_sensitive_column_grants.sql`
- `supabase/tests/*column_privileges*.sql`
- adapters/DAL preparados na Sprint 03
- documentação de acesso a dados em `README.md` e `CLAUDE.md`

**Impactos e implicações:** DB-P obrigatório. O role `authenticated` é comum a
todos os papéis de negócio; por isso, até admin perde acesso direto às colunas
restritas e as recebe somente por operações server-side autorizadas. A versão
de aplicação preparada na Sprint 03 é o ponto de rollback compatível.

**Resultado esperado:** mesmo um usuário autenticado com chamada manual não lê
remuneração, preço ou campos financeiros fora do contrato; a aplicação mantém
as telas e relatórios autorizados.

**Matriz final de grants**

| Tabela | Colunas restritas a `authenticated` | Colunas diretas seguras |
|---|---|---|
| `profiles` | `email`, `phone`, `birth_date`, `nationality`, `address`, `hourly_rate`, `monthly_salary`, `overtime_rate` | `id`, `full_name`, `role`, `created_at` |
| `properties` | `base_price`, `extra_per_person`, `avg_cleaning_hours` | todas as demais 25 colunas atuais |
| `service_orders` | `total_price`, `extra_services_description`, `extra_services_price`, `consegna_fee` | todas as demais 27 colunas atuais, incluindo `pricing_mode` e notas operacionais |

A matriz final ampliou `profiles` após encontrar exposição direta de PII pela
combinação de `profiles_secretaria_select`/`profiles_staff_peer_select` com o
grant de tabela. O adapter administrativo da Sprint 03 já atendia o único uso
legítimo atual, então a restrição preserva o comportamento da aplicação.

**Implementação e evidências locais/remotas de 2026-08-19**

- ADR 018 criado e ADR 002 preservada como histórico supersedido; nenhuma view
  foi criada.
- Migration `20260819030134_restrict_sensitive_column_grants.sql` criada pelo
  comando oficial `supabase migration new`, sem `DROP`, `IF EXISTS`, DML ou
  alteração de RLS/schema/Storage. Preconditions verificam drift e
  postconditions exigem as listas exatas de colunas.
- O runner reconstruiu o baseline anterior, aplicou as migrations das Sprints
  04/05 em sequência e confirmou fingerprints idênticos de dados, policies e
  grants não relacionados.
- `npm run test:supabase`: 171 pgTAP PASS (49 matriz corrente, 8 alvos, 68 de
  confidencialidade e 46 do guard), invariantes/fotos PASS, lint de schemas e
  Advisor de segurança local sem issues.
- `npm run test:smoke:sensitive-data`: histórico local das migrations presente;
  Data API direta retornou o bloqueio esperado para todas as colunas restritas
  em `admin`, `secretaria`, `limpeza`, `consegna` e `cliente`; colunas/joins
  seguros e fontes `service_role` passaram. Telas, guards, dashboard, extratos e
  CSVs passaram para os cinco papéis. Escritas legítimas de remuneração,
  pricing de imóvel e extras financeiros de O.S. também passaram para os
  papéis autorizados; a migration não altera grants de escrita.
- Preflight remoto read-only separadamente autorizado: projeto saudável;
  histórico termina em `20260818031745`; schema, ordem das colunas, RLS,
  policies, ausência das views legadas e invariantes agregadas conferem com o
  baseline; nenhuma linha ou PII foi retornada. O Advisor manteve apenas o INFO
  conhecido de `auth_login_attempts` e warnings/INFO de performance fora do
  escopo desta sprint.
- O preflight encontrou `TRUNCATE`, `REFERENCES`, `TRIGGER` e `MAINTAIN`
  table-level desnecessários para `authenticated`. A migration e os testes
  locais foram endurecidos para revogá-los, preservando exatamente
  `INSERT`/`UPDATE`/`DELETE` e o `SELECT` seguro por coluna.
- `db push --dry-run --skip-vault --project-ref <projeto>` PASS: somente a
  migration `20260819030134` seria aplicada; nenhum seed ou role seria enviado.
- `npm run lint`, `npm run typecheck`, 32 arquivos/155 Vitest e `npm run build`
  (20 rotas) passaram. A suíte inclui os formatadores/contratos de PDF de O.S.,
  A Pagar e A Receber, que consomem as mesmas fontes server-only validadas no
  smoke.
- Backup/PITR, restauração ensaiada e aplicação foram separadamente
  confirmados/autorizados. A migration `20260819030134` foi aplicada sem seed,
  roles, Vault ou `--linked` e passou a constar no histórico remoto.
- Hashes de dados/policies, contagens, unicidade e chaves nulas ficaram
  idênticos antes/depois. O smoke remoto transacional passou as 68 asserções
  para os cinco papéis e deixou zero fixtures após `ROLLBACK`.
- ACLs pós-cutover correspondem exatamente à matriz: sem `SELECT` table-level,
  somente colunas seguras, `INSERT`/`UPDATE`/`DELETE` preservados e
  `service_role` integral para os adapters.
- Advisor sem finding crítico/alto novo; 30 minutos de API/Postgres e consulta
  final ao Sentry terminaram sem 5xx, erro inesperado ou issue nova. O dry-run
  final retornou `upToDate: true`.
- Nenhuma row persistente, policy, RLS, Auth, Vault ou Storage foi alterada;
  não houve commit, push ou início da Sprint 06.

### Sprint 06 — Intervalos financeiros em `Europe/Rome`

**Status:** completed — implementação local e validação concluídas em 2026-08-19.
Nenhuma alteração de banco de dados, schema, migration ou acesso remoto (DB-0).
A Sprint 07 não foi iniciada.

**Objetivo:** corrigir períodos de extratos e dashboard sem alterar dados
persistidos nem fórmulas financeiras.

**O que implementar**

- Criar uma função canônica que converta datas civis de Roma em intervalo UTC
  semiaberto: `[inícioUtc, próximoDiaUtc)`.
- Substituir `.lte('completed_at', endDate)` por limite exclusivo do dia
  seguinte e remover defaults baseados no calendário UTC.
- Usar o helper em payable e agregações do dashboard onde o campo é `TIMESTAMPTZ`.
- Preservar datas `DATE` como datas civis (em `receivable`, `topMonth` e `topYear`),
  sem conversões desnecessárias.
- Adicionar testes em CET, CEST, virada de mês/ano, ano bissexto e dias de
  transição de DST.

**Implementado nesta sprint**

- Criado o helper canônico `romeDateRangeToUtcInterval(startDate, endDate)` em
  `lib/utils/date-rome.ts`, gerando o par `{ startUtc, nextDayUtc }` com
  conversão exata de hora civil de Roma para instantes UTC semiabertos
  `[startUtc, nextDayUtc)`.
- Adicionados helpers canônicos de períodos e agrupamento de calendário de Roma:
  `getRomeYearStartDateOnly`, `getRomeNMonthsAgoStartDateOnly`,
  `getRomeMonthKey` e `getRomeMonthPeriods`.
- `lib/server/data-access/sensitive-data.ts`:
  - `loadPayableFinancialSource`: atualizado para aplicar
    `.gte('completed_at', startUtc).lt('completed_at', nextDayUtc)`.
  - `loadDashboardFinancialSource`: atualizado para aplicar consultas com
    intervalos UTC semiabertos em `completed_at` (`properties`, `hours`,
    `revenue`, `recentOrders`), preservando comparações diretas de datas civis
    em `cleaning_date` (`topMonth` e `topYear`).
- `lib/server/reporting/financial.ts`:
  - `getDashboardReportingData`: substituídos os defaults UTC ingênuos
    `toISOString().slice(0, 10)` por `getRomeDateOnly`, `getRomeMonthStartDateOnly`,
    `getRomeYearStartDateOnly` e `getRomeNMonthsAgoStartDateOnly`.
  - Agrupamento mensal de receita e custo da equipe corrigido para usar
    `getRomeMonthKey(order.completed_at)` em vez de `slice(0, 7)` UTC,
    garantindo que ordens finalizadas nas primeiras horas da madrugada em Roma
    sejam atribuídas ao mês civil italiano correto.
- `app/(app)/statements/payable/page.tsx` e `components/statements/PayableStatement.tsx`:
  - Eliminados defaults baseados em `toISOString().slice(0, 10)`.
  - Página server-side inicializa com `getRomeMonthStartDateOnly(now)` e
    `getRomeDateOnly(now)` e repassa `initialStartDate` / `initialEndDate` ao client component.
- `test/fake-supabase.ts`:
  - Adicionado suporte aos operadores `.lt()` e `.gt()` no `FakeQuery` e
    `QueryFilter` para testes unitários com limites semiabertos.
- `lib/utils/date-rome.test.ts`, `lib/server/data-access/sensitive-data.test.ts` e
  `lib/server/reporting/financial.test.ts`:
  - Testes abrangentes cobrindo mesmo dia, limite de meia-noite (00:00:00),
    inclusão integral do último dia (23:59:59), virada de mês/ano, ano bissexto,
    CET (UTC+1), CEST (UTC+2), dias de transição DST (23h na primavera / 25h no outono)
    e relógio fixo próximo à meia-noite.

**Arquivos alterados nesta sprint**

- `lib/utils/date-rome.ts`
- `lib/utils/date-rome.test.ts`
- `lib/server/data-access/sensitive-data.ts`
- `lib/server/data-access/sensitive-data.test.ts`
- `lib/server/reporting/financial.ts`
- `lib/server/reporting/financial.test.ts`
- `app/(app)/statements/payable/page.tsx`
- `components/statements/PayableStatement.tsx`
- `test/fake-supabase.ts`
- este roadmap

**Comandos e resultados objetivos**

- `npm run lint`: PASS (eslint sem warnings ou erros).
- `npm run typecheck`: PASS (geração de tipos de rotas e `tsc --noEmit` verde).
- `npm test`: PASS (32 arquivos de teste / 175 asserções aprovadas).
- `npm run build`: PASS (compilação otimizada Next.js 16 / Turbopack com 20 páginas geradas).

**Riscos residuais e decisões**

- Como o bug histórico de `.lte('completed_at', endDate)` excluía ordens
  concluídas após 00:00 UTC do último dia do período, os totais financeiros
  de períodos que contenham ordens finalizadas no último dia passarão a incluir
  corretamente essas ordens. Trata-se de uma correção auditável do intervalo,
  sem qualquer modificação em fórmulas financeiras ou dados gravados.
- Nenhuma migration foi criada e nenhuma alteração foi realizada em produção (DB-0).

**Critérios de conclusão**

- [x] Nenhum default financeiro usa `toISOString().slice(0, 10)`.
- [x] Queries de `TIMESTAMPTZ` usam `[startUtc, nextDayUtc)`.
- [x] Casos CET/CEST e fim de dia passam com relógio fixo.
- [x] Totais da tela, CSV e PDF são idênticos para o mesmo filtro.
- [x] Não há migration nem alteração de dados.

### Sprint 07 — Contador de falhas de login atômico

**Status:** completed — implementação local, ensaios em banco descartável, validações
completas e aplicação remota no Supabase de produção (`iwrbeiqqsvzhiuhkqnqg`) concluídos
com sucesso em 2026-08-20 após autorização expressa do usuário. A Sprint 08 não foi iniciada.

**Dossiê DB-P:**
[`sprint-07-atomic-login-lockout-db-p.md`](sprint-07-atomic-login-lockout-db-p.md)

**Objetivo:** eliminar lost update no bloqueio de login sem expor email/IP ou
ampliar a superfície pública.

**O que implementar**

- Produzir dossiê DB-P para uma operação atômica de incremento e cálculo de
  `locked_until`.
- Preferir uma única operação Postgres/RPC chamada somente pelo adapter
  server-side; revogar `EXECUTE` de `PUBLIC`, `anon` e `authenticated`.
- Evitar `SECURITY DEFINER` quando o `service_role` chamador já tem os
  privilégios necessários; usar `SECURITY INVOKER` com `SET search_path = ''` e
  validação estrita de entradas.
- Manter respostas genéricas e HMACs; não registrar credenciais, email ou IP em
  claro.
- Testar rajadas concorrentes, expiração, sucesso que limpa tentativas e falha
  segura sem `LOGIN_LOCKOUT_SECRET`.

**Implementado nesta sprint**

- Criado o dossiê DB-P em `docs/evolution/sprint-07-atomic-login-lockout-db-p.md`
  com análise de concorrência, threat model, locks, timeouts, invariantes e rollback
  não destrutivo.
- Criada a migration `20260820035000_atomic_login_lockout.sql` com:
  - Preconditions verificando integridade de `public.auth_login_attempts`, RLS ativo,
    ausência de privilégios públicos e ausência da função prévia.
  - Função atômica `public.record_failed_login(p_email_key text, p_ip_key text)` com
    `SECURITY INVOKER`, `SET search_path = ''`, `#variable_conflict use_column`,
    validação regex estrita de HMAC (`^[0-9a-f]{64}$`), e inserção/atualização atômica
    via `INSERT ... ON CONFLICT ON CONSTRAINT auth_login_attempts_pkey DO UPDATE`.
  - Serialização em nível de linha no Postgres: calcula `failed_count`, aciona bloqueio
    de 24 horas na 4ª tentativa (`locked_until = now() + 24h`), preserva bloqueio ativo,
    e reseta automaticamente para 1 quando o bloqueio expira (`locked_until <= now()`).
  - `REVOKE ALL` de `PUBLIC`, `anon` e `authenticated`; `GRANT EXECUTE` exclusivamente
    para `service_role`.
- Atualizado `lib/server/auth/login-lockout.ts` para invocar a função atômica via
  client `service_role`, preservando helpers puros, HMACs e limpeza no sucesso.
- Criada suíte pgTAP com 21 testes em `supabase/tests/database/login_lockout_atomic.test.sql`
  cobrindo contagem incremental, ativação de bloqueio, respeito à 5ª tentativa,
  expiração, isolamento de usuários, limpeza no sucesso, validação de inputs e testes
  negativos de grants (`42501`) para `anon` e `authenticated`.
- Adicionados testes unitários e de robustez em `lib/server/auth/login-lockout.test.ts` e
  `app/api/auth/login/route.test.ts` para ausência de `LOGIN_LOCKOUT_SECRET`,
  derivação de identidade e mensagens genéricas.
- Atualizado `scripts/test-supabase-local.mjs` para incluir o smoke e checagem de
  invariantes da Sprint 07 na reconstrução descartável.

**Arquivos alterados nesta sprint**

- `docs/evolution/sprint-07-atomic-login-lockout-db-p.md`
- `supabase/migrations/20260820035000_atomic_login_lockout.sql`
- `lib/server/auth/login-lockout.ts`
- `lib/server/auth/login-lockout.test.ts`
- `app/api/auth/login/route.test.ts`
- `supabase/tests/database/login_lockout_atomic.test.sql`
- `scripts/test-supabase-local.mjs`
- este roadmap

**Comandos e resultados objetivos**

- `npm run test:supabase`: PASS (5 arquivos, 192 testes pgTAP aprovados, invariantes
  operacionais e de fotos aprovados, lint de schemas e security advisor sem findings).
- `npm run test:smoke:sensitive-data`: PASS (5 papéis autenticados, barreiras Data API
  confirmadas, adapters server-only aprovados).
- `npm run lint`: PASS (ESLint sem warnings ou erros).
- `npm run typecheck`: PASS (Next.js 16 typegen e `tsc --noEmit` verdes).
- `npm test`: PASS (32 arquivos / 179 testes Vitest aprovados).
- `npm run build`: PASS (Compilação Next.js 16 / Turbopack com 20 rotas geradas).
- **Aplicação remota em produção**: Migration `20260820035000_atomic_login_lockout`
  aplicada no projeto Supabase `iwrbeiqqsvzhiuhkqnqg`; smoke test transacional validou
  comportamento atômico, bloqueio de 24h, grants restritos (`anon` e `authenticated`
  bloqueados, `service_role` permitido) e integridade dos dados existentes.

**Riscos residuais e decisões**

- Como a função `record_failed_login` é `SECURITY INVOKER` e foi concedida apenas ao
  role `service_role`, o endpoint PostgREST permanece inacessível para qualquer chamada
  com chaves `anon` ou tokens de usuário (`authenticated`), respondendo `42501` / `403`.
- Apenas a rota server-side `/api/auth/login` (via `lib/server/auth/login-lockout.ts`)
  executa a operação.

**Critérios de conclusão**

- [x] Teste concorrente/atômico no Postgres elimina o risco de lost update e prova a operação nova.
- [x] Apenas o adapter server-side consegue executar a operação (`service_role`).
- [x] Tabela continua sem grants/policies para clients públicos (`anon`, `authenticated`).
- [x] Mensagens externas permanecem genéricas (`Email ou senha incorretos.`).
- [x] Invariantes e rollback não destrutivo foram ensaiados em banco descartável.

### Sprint 08 — Escrita atômica de O.S. e equipe

**Objetivo:** tornar criação/edição de O.S. e sincronização de vínculos uma única
unidade de consistência.

**O que implementar**

- Definir uma interface de caso de uso profunda para salvar O.S., escondendo a
  sequência de persistência dos Server Actions.
- Mover o conjunto exclusivamente Postgres para transação curta, preferindo uma
  RPC `security invoker` que valide papel, propriedade, equipe e invariantes no
  servidor.
- Garantir que chamada direta da RPC não contorne autorização; `EXECUTE` deve
  ser mínimo e toda entrada validada.
- Ordenar locks de forma determinística e evitar chamadas Auth/HTTP dentro da
  transação.
- Manter actions como orquestradores finos de validação, logging, revalidation e
  redirect.
- Testar falha em cada ponto para provar ausência de O.S. ou vínculos parciais.

**Arquivos/componentes prováveis**

- `app/(app)/service-orders/actions.ts`
- novo módulo de caso de uso em `lib/server/service-orders/`
- `supabase/migrations/<timestamp>_atomic_service_order_write.sql`
- `supabase/tests/` e testes de integração do caso de uso

**Impactos e implicações:** DB-P obrigatório. O caminho é central, então o
cutover deve preservar payload, preço, tracking, fotos e múltiplos funcionários.

**Resultado esperado:** O.S. e vínculos são gravados juntos ou nenhum deles é
gravado.

**Critérios de conclusão**

- [ ] Mesmos fluxos e mensagens funcionais antes/depois.
- [ ] Testes de fault injection não deixam estado parcial.
- [ ] Chamada direta sem papel correto é rejeitada no servidor/banco.
- [ ] Transação não contém rede externa e mantém locks curtos.
- [ ] Guard da Sprint 04 e grants da Sprint 05 continuam efetivos.

### Sprint 09 — Escrita atômica de propriedade e relações

**Objetivo:** evitar agência/proprietário órfão ou propriedade incompleta quando
um passo de criação/edição falha.

**O que implementar**

- Definir caso de uso único para resolver/criar agência ou proprietário e
  gravar a propriedade.
- Executar as operações Postgres em transação curta, com tratamento explícito
  de concorrência por email normalizado e sem `select-then-insert` inseguro.
- Preservar os tipos B2B/B2C, relacionamentos atuais e RLS.
- Validar email e invariantes de propriedade antes de abrir a transação.
- Testar criação concorrente e falha em cada etapa.

**Arquivos/componentes prováveis**

- `app/(app)/properties/actions.ts`
- novo módulo em `lib/server/properties/`
- `lib/server/validation/contracts.ts`
- `supabase/migrations/<timestamp>_atomic_property_write.sql`
- testes SQL e de integração

**Impactos e implicações:** DB-P obrigatório se a atomicidade for implementada
por RPC/constraint. Não se deve adicionar unicidade ou reinterpretar duplicatas
sem primeiro medir o estado real e aprovar impacto.

**Resultado esperado:** propriedade e relação correspondente existem juntas,
sem órfãos criados por falha intermediária.

**Critérios de conclusão**

- [ ] Duplicatas atuais foram medidas sem correção destrutiva automática.
- [ ] Falhas simuladas não deixam novos órfãos.
- [ ] Concorrência não cria relações duplicadas.
- [ ] Fluxos B2B e B2C preservam comportamento e permissões.
- [ ] Migration e rollback atendem integralmente à política de produção.

### Sprint 10 — Saga idempotente de convite de funcionário

**Objetivo:** tratar Supabase Auth + perfil como workflow distribuído recuperável,
sem fingir que os dois sistemas participam da mesma transação.

**O que implementar**

- Criar um caso de uso server-only com estados e resultados explícitos para
  convite, atualização do perfil, retry e compensação segura.
- Definir chave de idempotência e comportamento quando o usuário já foi
  convidado, o perfil já existe ou um retry ocorre após timeout.
- Encapsular todas as operações administrativas em adapter estreito.
- Usar compensação somente quando for segura e autorizada; não apagar
  silenciosamente um usuário preexistente.
- Emitir logs estruturados/Sentry sem PII ou tokens e documentar procedimento de
  reconciliação manual.

**Arquivos/componentes prováveis**

- `app/(app)/employees/actions.ts`
- `utils/supabase/admin.ts`
- novo módulo em `lib/server/employees/`
- `lib/server/logger.ts`
- testes de idempotência e fault injection

**Impactos e implicações:** DB-0 por padrão. Se surgir necessidade comprovada de
persistir estado de saga, reclassificar para DB-P, criar dossiê e não expandir a
sprint sem aprovação.

**Resultado esperado:** retry não duplica convites nem deixa o sistema em estado
desconhecido; falhas informam ação de recuperação segura.

**Critérios de conclusão**

- [ ] Cenários “novo”, “já convidado”, “perfil existente”, timeout e retry são
  determinísticos.
- [ ] Nenhum client privilegiado bruto é exportado.
- [ ] Compensação nunca remove usuário preexistente.
- [ ] Logs não contêm email completo, token ou payload sensível.
- [ ] Fluxo atual de criação/edição/exclusão autorizada continua funcional.

### Sprint 11 — Tipos, validação, erros e limites de data access

**Objetivo:** reduzir drift e tornar mudanças futuras mais locais depois que as
fronteiras críticas estiverem protegidas.

**O que implementar**

- Gerar tipos `Database` a partir do schema verificado e parametrizar os clients
  Supabase; manter a geração reproduzível e read-only.
- Remover casts `as unknown as` de produção por módulo, sem uma conversão massiva
  em um único diff.
- Corrigir `optIsoDateStr`, validar emails e impor
  `checkin_at >= checkout_at`, além de limites de tamanho já aceitos pelo domínio.
- Criar mapeamento de erros de domínio/infraestrutura e deixar detalhes no
  logger/Sentry; respostas ao usuário permanecem estáveis e genéricas quando
  apropriado.
- Mover os acessos `.from()` restantes em `app/` somente quando a extração criar
  uma interface profunda; aplicar o Deletion Test para evitar wrappers rasos.
- Corrigir drift documental e referências absolutas sem reescrever ADRs
  históricos.

**Arquivos/componentes prováveis**

- `lib/types/database.ts`
- `utils/supabase/client.ts`, `server.ts`, `middleware.ts` e adapters
- `lib/server/validation/contracts.ts`
- `app/(app)/**/actions.ts`, páginas de funcionários/extratos e export routes
- `lib/server/logger.ts` e novo mapper de erros, se justificado
- `README.md`, `CLAUDE.md`, `docs/decisions/README.md`, documentos com links
  absolutos

**Impactos e implicações:** DB-0; geração de tipos consulta schema sem modificá-lo.
O trabalho deve ser dividido por módulo dentro da sprint e não pode virar uma
reestruturação geral de pastas.

**Resultado esperado:** o compilador detecta drift de schema, entradas inválidas
são rejeitadas cedo e mensagens internas não atravessam a fronteira de UI.

**Critérios de conclusão**

- [ ] Geração de tipos é reproduzível e não contém dados/segredos.
- [ ] Clients principais usam `Database`.
- [ ] Não restam casts inseguros nos módulos tocados; nenhum novo cast foi
  introduzido para silenciar erro real.
- [ ] Datas, intervalos, emails e comprimentos críticos têm testes negativos.
- [ ] Erros do Supabase não são retornados crus nos entrypoints tocados.
- [ ] Toda extração nova passa no Deletion Test e melhora localidade.

### Sprint 12 — E2E crítico, documentação e reauditoria

**Objetivo:** provar o sistema como um todo, fechar o programa e produzir uma
nova baseline confiável.

**O que implementar**

- Adicionar poucos E2Es autenticados e de alto valor: acesso por papel, criação
  e edição de O.S., relatórios no limite de datas, login lockout e negativas de
  autorização.
- Validar CSV/PDF e dashboard contra os mesmos dados sintéticos.
- Reexecutar CI, testes SQL, Advisor Supabase, varredura de segredos,
  `npm audit --omit=dev` e inspeção read-only de grants/RLS.
- Consultar Sentry de forma read-only para regressões relacionadas aos fluxos
  alterados, sem usar ausência de evento como única prova.
- Atualizar README, CLAUDE, ADRs, este roadmap e o registro final de riscos.
- Recalcular a nota técnica com os mesmos critérios da auditoria inicial.

**Arquivos/componentes prováveis**

- configuração e specs E2E a definir conforme ferramenta aprovada
- `.github/workflows/ci.yml`
- fixtures sintéticas locais
- documentação e este roadmap

**Impactos e implicações:** DB-L/read-only. Nenhuma escrita remota é autorizada
por esta sprint; smoke em produção, se desejado, exige plano e autorização
separados.

**Resultado esperado:** as melhorias críticas são demonstradas por testes
executáveis, a documentação corresponde ao sistema e os riscos residuais têm
dono/prioridade explícitos.

**Critérios de conclusão**

- [ ] E2Es críticos passam de forma determinística em ambiente isolado.
- [ ] Matriz de papel/coluna/operação está verde.
- [ ] Lint, typecheck, Vitest, SQL, E2E e build passam.
- [ ] Não há finding crítico/alto novo em Advisor, audit ou Sentry relacionado
  às mudanças.
- [ ] Documentação e ADRs refletem a arquitetura final.
- [ ] Nota final e riscos residuais estão registrados.

## 8. Registro de progresso e evidências

Atualize uma linha somente depois de executar as validações da sprint. Use
links de PR/CI quando existirem ou registre comandos e resultados objetivos.
Nunca cole tokens, DSNs, emails, IPs, dados pessoais ou conteúdo de `.env`.

| Sprint | Status | Início | Conclusão | Executor | Evidências | Riscos residuais / decisão |
|---|---|---|---|---|---|---|
| 00 | completed | 2026-08-15 | 2026-08-15 | Codex | Auditoria de 2026-08-15; roadmap e índices documentais criados; somente Markdown alterado | Próxima etapa: Sprint 01; nenhuma implementação iniciada |
| 01 | completed | 2026-08-16 | 2026-08-17 | Codex | `npm run test:supabase`: 57 pgTAP, três SQLs existentes e smoke de fotos PASS; lint/typecheck/29 arquivos e 141 Vitest/build PASS; diff e segredos revisados | Grants sensíveis e update amplo de `limpeza` comprovados como `[KNOWN UNSAFE]`; oito alvos TODO aguardam exclusivamente Sprints 04/05; CI remota não disparada sem commit/push |
| 02 | completed | 2026-08-17 | 2026-08-17 | Codex | `.env*`/backups excluídos e imagem comprovada limpa; Gitleaks: 97 commits sem novo vazamento; Next 16.3.1 e Sentry 10.70.0; `npm audit` completo e produção: zero; lint/typecheck/30 arquivos e 145 Vitest/build/57 pgTAP PASS; Leaked Password Protection autorizada, habilitada e confirmada pelo Advisor | Ocorrência histórica continua revogada e isolada por fingerprint; `auth_login_attempts` mantém aviso informativo intencional conforme ADR 008; rollback Auth é desligar a mesma opção; nenhuma mudança de dados/schema/RLS/Storage, commit ou push; Sprint 03 não iniciada |
| 03 | completed | 2026-08-17 | 2026-08-17 | Codex | Matriz e adapter server-only versionados; lint/typecheck/32 arquivos e 152 Vitest/build com 20 rotas PASS; 57 pgTAP/invariantes/fotos PASS; smoke autenticado local de cinco papéis, telas, guards, dashboard, extratos e CSVs PASS; testes arquiteturais e auditoria do diff PASS | `avg_cleaning_hours` classificado como sensível contextual sem ampliar acesso; grants excessivos continuam conhecidos até a Sprint 05 e limites temporais continuam na Sprint 06; `output/` preexistente preservado; nenhuma mudança de banco/produção, commit ou push |
| 04 | completed | 2026-08-18 | 2026-08-18 | Codex | Local: dossiê DB-P e ADR 017; 103 pgTAP (46 do guard), invariantes/fotos, lint Supabase, lint/typecheck/155 Vitest/build PASS. Produção: PR #2 e CI verde; Coolify implantou `51512d2`; integração Supabase aplicou `20260818031745`; smoke transacional com `ROLLBACK` passou para cinco papéis e fluxo técnico; fingerprints pré/pós idênticos; 30 min de logs/advisors sem erro inesperado, 5xx ou timeout | Sete TODOs de SELECT permanecem exclusivamente para a Sprint 05; aviso informativo preexistente de `auth_login_attempts` segue aceito pela ADR 008; rollback é correção progressiva não destrutiva |
| 05 | completed | 2026-08-19 | 2026-08-19 | Codex | Local: ADR 018, matriz/dossiê DB-P, migration `20260819030134`, 171 pgTAP/invariantes/fotos/lint/Advisor, smoke de cinco papéis, lint/typecheck/155 Vitest/build PASS. Produção: backup/restauração confirmados; migration aplicada; hashes pré/pós idênticos; 68 asserções remotas com `ROLLBACK`; ACLs exatas; dry-run final atualizado; 30 min de API/Postgres e Sentry sem erro novo | PII de perfis protegida e grants administrativos excessivos removidos; `service_role` permanece restrito aos adapters; rollback progressivo não foi necessário; nenhuma row/policy/RLS/Auth/Vault/Storage persistente alterada, commit ou push; Sprint 06 não iniciada |
| 06 | planned | — | — | — | — | — |
| 07 | planned | — | — | — | — | — |
| 08 | planned | — | — | — | — | — |
| 09 | planned | — | — | — | — | — |
| 10 | planned | — | — | — | — | — |
| 11 | planned | — | — | — | — | — |
| 12 | planned | — | — | — | — | — |

## 9. Checklist de retomada em uma nova janela

1. Localizar a primeira sprint `planned` cujas dependências estejam
   `completed`.
2. Ler a seção completa da sprint, os ADRs citados e os arquivos atuais.
3. Conferir se o baseline mudou desde 2026-08-15; se mudou, atualizar evidência
   antes de executar.
4. Validar o gate global e a classificação de banco.
5. Se houver DB-P, produzir o dossiê antes da migration e obter autorização
   específica antes de qualquer execução remota.
6. Marcar `in_progress`, executar apenas aquela sprint e manter commits/pushes
   sob solicitação expressa.
7. Rodar os critérios, registrar evidências e só então marcar `completed`.
8. Parar. Não iniciar a próxima sprint no mesmo contexto sem pedido explícito.

## 10. Critério de sucesso do programa

O programa estará concluído quando:

- acesso direto autenticado não puder ler ou alterar campos fora do contrato;
- workflows críticos não deixarem estado parcial sob falha/concorrência;
- períodos financeiros obedecerem ao calendário de Roma;
- CI provar RLS/grants, regras de domínio e E2E críticos;
- segredos e dependências tiverem gates de entrega adequados;
- tipos, validações, erros e documentação reduzirem o risco de regressão;
- todos os dados de produção tiverem sido preservados, sem rollback destrutivo;
- a reauditoria final registrar nota, evidências e riscos residuais.
