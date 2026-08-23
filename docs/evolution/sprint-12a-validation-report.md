# Sprint 12A — Relatório de validação E2E, segurança e regressão

**Data:** 2026-08-22
**Baseline inicial:** `e34a241` (`master`)
**Status:** `completed` no escopo local, descartável e explicitamente isolado
**Sprint 12B:** não iniciada

## Convenções de classificação

- `PASS`: verificação executada e critério comprovado por evidência concreta.
- `FAIL`: verificação executada e critério não atendido naquela execução.
- `NOT VERIFIED`: não foi possível verificar dentro das autorizações e do ambiente desta sprint.
- `N/A`: não aplicável ao escopo da Sprint 12A.
- `OBSERVED`: fato diretamente observado em código, comando ou saída.
- `INFERRED`: conclusão derivada das evidências, sem observação direta completa.

## Escopo executado

- Inspeção prévia da infraestrutura: Vitest, runners locais do Supabase, pgTAP e
  CI já existiam; não havia ferramenta nem suíte E2E de navegador.
- Adoção mínima do Playwright, conforme a documentação local do Next.js 16.3.1,
  com Chromium, um worker, execução serial e `baseURL` obrigatoriamente loopback.
- E2Es críticos para acesso por papel, negativas de rota e objeto, criação e
  edição de ordens de serviço, lockout de login e fronteiras de data de Roma em
  dashboard, CSV e visualizações de impressão/PDF a pagar e a receber.
- Extensão do runner de smoke existente, mantendo Supabase local copiado para
  diretório temporário, projeto isolado, migrations locais e dados exclusivamente
  sintéticos.
- Reexecução de lint, typecheck, Vitest, pgTAP/Supabase, E2E, build, Advisor
  local, inspeções locais de grants/RLS, varredura de segredos e auditoria npm.
- Nenhuma atividade da Sprint 12B, inclusive Sentry e reauditoria final, foi
  executada.

## Infraestrutura e decisões

**OBSERVED:** a baseline possuía 36 arquivos/218 testes Vitest e um runner
Supabase descartável com 7 arquivos/253 testes pgTAP, mas nenhuma dependência,
configuração ou spec de E2E de navegador.

**OBSERVED:** Playwright foi escolhido por ser a integração E2E documentada
localmente pelo Next.js e por permitir reaproveitar o runner seguro existente.
Adicionar um segundo orquestrador ou uma nova camada de seed foi evitado.

**OBSERVED:** o runner remove variáveis de alvo remoto, rejeita `--linked`, exige
origem loopback, não imprime a saída sensível do status local e apaga somente a
pilha temporária cujo caminho e identificador foram criados pela própria execução.

## Arquivos alterados

- `.github/workflows/ci.yml`: job E2E crítico com Supabase descartável.
- `.gitignore`: artefatos do Playwright.
- `.gitleaksignore`: fingerprints exatos de falsos positivos sintéticos pgTAP;
  preservado o fingerprint já documentado da credencial legada revogada.
- `package.json` e `package-lock.json`: Playwright e script `test:e2e`.
- `playwright.config.ts`: configuração local/CI restrita a loopback.
- `e2e/sprint-12a-critical.spec.ts`: quatro E2Es críticos.
- `scripts/test-sensitive-data-smoke-local.mjs`: fixtures sintéticas, limites de
  data `Europe/Rome`, execução do browser e verificação posterior no banco local.
- `vitest.config.mts`: exclusão explícita de `e2e/**` da suíte unitária.
- `docs/evolution/architecture-hardening-roadmap.md`: progresso da Sprint 12A.
- `docs/evolution/sprint-12a-validation-report.md`: este relatório.

## Resultados e evidências

| Verificação | Resultado | Classificação e evidência |
|---|---:|---|
| E2E crítico | PASS | 4/4 Playwright em 32,4 s: papéis/negativas; criação/edição; datas/dashboard/CSV/PDF; lockout. |
| Persistência E2E | PASS | Runner confirmou no Postgres local a O.S. criada, a nota editada e exatamente uma identidade sintética bloqueada. |
| Smoke autenticado | PASS | `admin`, `secretaria`, `limpeza`, `consegna` e `cliente`; barreira direta da Data API e HTTP. |
| SQL/Supabase | PASS | 7 arquivos e 253 testes pgTAP; invariantes de fotos e visibilidade operacional também passaram. |
| Grants/RLS local | PASS | `authorization_matrix_current`, `authorization_matrix_target` e `column_confidentiality_grants` passaram na pilha descartável. |
| Supabase schema lint | PASS | schemas `public` e `private`: “No schema errors found”. |
| Supabase Advisor local | PASS | `db advisors --local`: “No issues found”. |
| Lint | PASS | `npm run lint`, exit code 0, sem findings. |
| Typecheck | PASS | `next typegen && tsc --noEmit`; tipos de rota gerados e TypeScript sem erro. |
| Unitários | PASS | 36 arquivos e 218 testes Vitest. |
| Build | PASS | Next.js 16.3.1/Turbopack compilou, tipou e gerou 20 rotas. |
| Dependências de produção | PASS | `npm audit --omit=dev`: 0 vulnerabilidades. |
| Segredos no histórico | PASS final | Gitleaks 8.30.1 fixado por digest: 112 commits, aproximadamente 2,46 MB, nenhum leak não permitido. |
| Segredo no arquivo legado atual | PASS | Varredura direcionada e redigida do arquivo previamente associado ao incidente: nenhum leak no estado atual. |
| `git diff --check` | PASS | Nenhum erro de whitespace; apenas avisos locais de conversão LF/CRLF. |
| Workflow GitHub Actions | NOT VERIFIED | Não executado, pois exigiria push; push é proibido nesta sprint. O job foi apenas validado localmente por seus comandos constituintes. |
| Advisor/grants/RLS remotos | NOT VERIFIED | Proibidos sem credenciais e autorização específicas; os equivalentes locais passaram. |
| Sentry e reauditoria final | N/A | Pertencem exclusivamente à Sprint 12B e não foram executados. |

## Comandos executados

- `npm install --save-dev @playwright/test`
- `npx playwright install chromium`
- `npm run test:e2e` (iterações de estabilização e execução final verde)
- `npm run test:supabase`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- Gitleaks 8.30.1 por digest, com mount read-only, `--redact=100` e
  `.gitleaks.toml`, em modos histórico e diagnóstico direcionado
- `git status --short`, `git diff --stat`, `git diff --check` e inspeções
  read-only de arquivos/documentação

Não foram executados `supabase --linked`, comandos SQL mutáveis remotos,
migrations remotas, alterações remotas de RLS/grants/Auth/Storage/schema,
`git commit`, `git push`, deploy ou consulta ao Sentry.

## Falhas observadas e resolução

1. **OBSERVED — Vitest coletou inicialmente a spec E2E:** corrigido com exclusão
   explícita de `e2e/**`; a suíte final passou com 36 arquivos/218 testes.
2. **OBSERVED — primeiras tentativas E2E falharam por orquestração síncrona,
   origem de desenvolvimento, seletores responsivos/sem nome acessível e UUIDs
   sintéticos fora do formato aceito pelo Zod:** o runner passou a executar o
   Playwright de forma assíncrona, usar `localhost`, selecionar controles por
   semântica disponível e usar UUIDs v4 sintéticos. Não houve mudança de regra de
   negócio. A execução final passou 4/4.
3. **OBSERVED — Gitleaks encontrou dez falsos positivos `generic-api-key` em
   identificadores determinísticos do teste pgTAP de lockout:** cada ocorrência
   foi revisada e suprimida somente por fingerprint histórico exato. O arquivo ou
   a regra não foram liberados de forma ampla. A varredura final passou.
4. **OBSERVED — durante a edição da lista de fingerprints, o fingerprint já
   existente do JWT legado revogado foi temporariamente substituído:** a revisão
   do diff detectou e restaurou a entrada documentada. O valor não foi aberto nem
   impresso; a varredura direcionada do arquivo atual passou.

Não restou `FAIL` na matriz final local.

## Achados de segurança

- **OBSERVED:** autorização negativa foi comprovada tanto na navegação quanto em
  export e acesso por objeto; respostas não autorizadas foram redirect, `403` ou
  `404`, conforme o contrato existente.
- **OBSERVED:** quatro falhas de login produziram lockout persistido; uma senha
  correta durante o lockout continuou retornando `401` com mensagem genérica.
- **OBSERVED:** a varredura final não encontrou segredo não permitido. A entrada
  histórica de JWT já documentada permanece classificada como credencial legada
  revogada e não deve ser reativada.
- **INFERRED:** a cobertura implementada reduz os maiores riscos de regressão da
  evolução, mas não representa cobertura exaustiva de UI, navegador ou matriz de
  permissões; pgTAP e testes unitários continuam sendo as provas de maior largura.
- **NOT VERIFIED:** estado remoto atual de revogação/rotação, políticas, grants,
  Advisor e execução do CI não foram consultados nesta sprint.

## Riscos residuais

- O E2E usa somente Chromium desktop, um worker e uma pilha Supabase local; não
  comprova diferenças de outros navegadores ou do ambiente remoto.
- O clique em PDF valida a visualização de impressão aberta pelo produto e seu
  conteúdo, não realiza comparação visual pixel a pixel nem valida um arquivo
  binário baixado.
- O job novo do GitHub Actions não foi executado remotamente sem push.
- Os fingerprints pgTAP precisam permanecer exatos; qualquer novo finding deve
  continuar falhando e ser investigado, nunca suprimido por caminho amplo.
- A equivalência entre migrations locais e o estado remoto não foi assumida nem
  verificada.

## Itens NOT VERIFIED

1. Execução do workflow no GitHub Actions.
2. Advisor do projeto Supabase remoto.
3. Grants, RLS, Auth, Storage e schema do ambiente remoto.
4. Confirmação externa atual do estado da credencial legada já documentada como
   revogada.

## Recomendações para a Sprint 12B

- Revisar este relatório e classificar formalmente os itens `NOT VERIFIED` antes
  do veredito final do programa.
- Após autorização de transição e pelo fluxo normal de versionamento, observar a
  primeira execução remota do novo job E2E; não contornar o gate em caso de falha.
- Confirmar por mecanismo autorizado que a credencial legada documentada segue
  revogada, sem acessar nem registrar seu valor e sem jamais reativá-la.
- Executar a consulta read-only ao Sentry e a reauditoria final somente dentro do
  escopo explícito da Sprint 12B.
- Repetir apenas verificações que falharem ou cuja evidência tenha se tornado
  obsoleta; preservar os dados e as restrições de produção.

## Veredito da Sprint 12A

Todos os critérios de conclusão locais e isolados foram comprovados. A Sprint
12A está `completed`. Os itens remotos permanecem `NOT VERIFIED` porque sua
execução exigiria push ou credenciais/autorização fora do escopo; nenhuma
evidência remota foi inferida. A Sprint 12B continua planejada e não iniciada.
