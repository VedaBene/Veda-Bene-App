# Plano sequencial — confiabilidade do envio de fotos

**Criado em:** 2026-10-06  
**Baseline de código:** `3394e53ae50fd67848ba9f398c0187e908bcbb0d`  
**Branch no diagnóstico:** `codex/joe-service-order-filter`  
**Impacto de banco previsto:** `DB-0` — nenhuma migration, alteração de dados,
RLS, grants, bucket ou configuração remota  
**Estado do programa:** `planned`  
**Próxima etapa:** `1`

## 1. Finalidade

Corrigir falhas seletivas de processamento e envio de fotos de limpeza em
dispositivos móveis, reduzir o consumo de memória, tornar uploads instáveis
recuperáveis, melhorar o diagnóstico no Sentry e remover ruído causado por
validações esperadas. O fluxo privado, as regras de autorização, o limite de
oito fotos, a publicação em duas fases (`pending` → `ready`) e a preservação dos
dados existentes devem permanecer intactos.

Este documento é a fonte de continuidade entre janelas de contexto. Para
continuar o trabalho, basta anexá-lo ou referenciá-lo e pedir **“Execute a Etapa
N”**. Cada conversa deve executar somente a etapa solicitada e parar ao final.

## 2. Diagnóstico consolidado

| Evidência observada em produção | Conclusão |
|---|---|
| Sentry `JAVASCRIPT-NEXTJS-17`, 15 eventos entre 03 e 06/10/2026, `decode_failed`, JPEG de 2–8 MB, principalmente Android/navegadores móveis | Existe falha real e seletiva no decode cliente. O código depende de uma única chamada a `createImageBitmap(file, { imageOrientation: 'from-image' })`, sem fallback. |
| A funcionária analisada autenticou e concluiu O.S. normalmente, mas nunca criou metadado de foto; os eventos do mesmo período não contêm identidade Sentry | Correlação forte com o relato, mas não é possível atribuir matematicamente os eventos à usuária. Não há evidência de falha de Auth/RLS. |
| Sentry `JAVASCRIPT-NEXTJS-11`, objeto ausente na finalização; no caso inspecionado uma variante atrasou e a repetição funcionou | Há um segundo problema, independente do decode: rede móvel instável e uploads paralelos podem deixar uma variante ausente. A limpeza preservou a integridade. |
| Sentry `JAVASCRIPT-NEXTJS-X`, `photo_limit_reached` | É validação de negócio esperada, não defeito operacional. |
| Mais de 3.100 fotos em 14 dias, praticamente todas `ready`, e uploads de outros usuários funcionando durante os eventos | Não houve indisponibilidade global do Supabase Storage. O problema é seletivo. |

Referências operacionais:

- [Decode cliente — JAVASCRIPT-NEXTJS-17](https://veda-bene.sentry.io/issues/151100805/)
- [Objeto ausente — JAVASCRIPT-NEXTJS-11](https://veda-bene.sentry.io/issues/145251575/)
- [Limite esperado — JAVASCRIPT-NEXTJS-X](https://veda-bene.sentry.io/issues/140747119/)
- `docs/service-order-photos.md`
- `docs/decisions/012-fotos-privadas-por-ciclo-da-ordem-de-servico.md`
- `docs/decisions/014-fallback-jpeg-e-validacao-integral-de-fotos.md`
- `docs/production-data-safety.md`

## 3. Contrato de execução para qualquer nova janela

1. Ler `AGENTS.md`, este documento e somente as referências indicadas na etapa.
2. Conferir `git status --short` e preservar alterações alheias. No baseline
   deste plano já existiam mudanças do usuário em `.agents/`; elas não pertencem
   a este trabalho.
3. Confirmar na tabela da seção 4 que todas as dependências estão `completed`.
   Não é necessário reler os relatórios das etapas anteriores.
4. Alterar o status da etapa para `in_progress`; executar apenas seu escopo.
5. Antes de editar código Next.js/React, ler os guias locais relevantes em
   `node_modules/next/dist/docs/`, no mínimo os de Server/Client Components,
   imagens e tratamento de erros quando aplicáveis.
6. Não criar dependência nova sem necessidade demonstrável. Não mudar o
   contrato de Storage, autorização ou banco incidentalmente.
7. Executar os testes específicos da etapa e, quando exigido, o gate global.
8. Só marcar `completed` se todos os critérios objetivos passarem. Caso
   contrário, usar `blocked` e registrar o único bloqueio essencial.
9. Atualizar somente: tabela de status, resumo de continuidade e uma linha no
   registro compacto da seção 5. Não inserir relatório extenso no documento.
10. Parar. Não iniciar a etapa seguinte sem novo pedido do usuário.
11. Nunca executar migration/SQL mutável/alteração de Storage remota neste
    plano. Nunca fazer commit, push ou deploy sem solicitação expressa.

Estados permitidos: `planned`, `in_progress`, `completed`, `blocked`.

## 4. Controle compacto de status

| Etapa | Resultado | Depende de | Status |
|---:|---|---:|---|
| 1 | Decoder móvel com fallback seguro | — | `completed` |
| 2 | Menor pressão de memória e previews comprimidos | 1 | `completed` |
| 3 | Upload resiliente e recuperação automática limitada | 1–2 | `completed` |
| 4 | Observabilidade correlacionável e sem PII | 1–3 | `completed` |
| 5 | Validações esperadas fora do Sentry | 4 | `completed` |
| 6 | Regressão automatizada e matriz móvel | 1–5 | `planned` |
| 7 | Auditoria independente final | 1–6 | `planned` |

**Resumo de continuidade:** concluídas `1–5`; próxima `6` (não iniciada);
bloqueio `nenhum`; última atualização `2026-10-07`.

## 5. Registro compacto de conclusão

Adicionar exatamente uma linha por etapa, com no máximo 400 caracteres:

```text
Etapa N | AAAA-MM-DD | arquivos-chave | testes/resultados | risco residual ou “nenhum”
```

Registros:

- Etapa 1 | 2026-10-06 | lib/client/image-processing{,.test}.ts | 31 testes e typecheck OK; Chrome local: 24 casos EXIF/48 variantes OK | orientação em Android/Safari reais NOT VERIFIED; rollback: reverter somente o diff da etapa
- Etapa 2 | 2026-10-06 | cleaning-photo-queue, useCleaningPhotoWorkflow, uploader/modais e testes | 60 testes, lint/typecheck OK; Chrome/React: concorrência 1 entre filas, 4 URLs revogadas, upload sem reprocessar | memória em celulares reais NOT VERIFIED; rollback: reverter somente o diff da etapa 2
- Etapa 3 | 2026-10-06 | cleaning-photo-upload, workflow, photo-actions, service-order-photos/storage e testes | 132 testes, lint/typecheck OK; regressão concorrente falha antes/passa após correção | limpeza sem confirmação bloqueia reenvio e pode exigir assistência; rede móvel real NOT VERIFIED; rollback: só o diff da etapa 3
- Etapa 4 | 2026-10-06 | Sentry configs, observability, sessão, decoder/upload e testes | 382 testes, lint/typecheck/build OK; evento SDK em memória correlaciona UUID/SHA/retry; bundle sem segredos locais | deploy exige SHA no build; produção NOT VERIFIED; rollback: só o diff da etapa 4
- Etapa 5 | 2026-10-07 | cleaning-photo-errors, photo-actions, service-order-photos, photo-telemetry e testes | 86 testes focados, lint/typecheck OK; limite mantém feedback/fila e zero capturas; falhas técnicas/desconhecidas capturadas | eficácia em produção NOT VERIFIED; rollback: só o diff da etapa 5

## 6. Etapas de implementação

### Etapa 1 — Decoder móvel com fallback seguro

**Objetivo:** uma incompatibilidade isolada de `createImageBitmap` não deve
impedir o processamento de uma foto JPEG/PNG/WebP válida.

**Implementar**

- Em `lib/client/image-processing.ts`, encapsular o decode atrás de uma
  interface pequena que exponha fonte desenhável, dimensões e descarte.
- Tentar, em ordem: `createImageBitmap` com orientação; `createImageBitmap` sem
  opções; elemento `HTMLImageElement` com `decode()` e URL local temporária.
- Garantir correção de orientação conforme o comportamento real de cada caminho;
  não aplicar rotação duplicada.
- Revogar URLs e liberar `ImageBitmap` em `finally`, inclusive após falhas.
- Manter validação de tipo/tamanho, limite de 50 MP, remoção de EXIF/GPS pela
  regravação e contrato WebP/JPEG existentes.
- Registrar apenas códigos/tentativas de decoder; nunca nome, conteúdo, email
  ou bytes da imagem.

**Testar**

- Decoder primário funciona.
- Primeiro decoder falha e o segundo funciona.
- Ambos `createImageBitmap` falham e `HTMLImageElement.decode()` funciona.
- Todos falham e retornam `decode_failed` uma única vez.
- Recursos são liberados em sucesso e erro; limite de pixels continua válido.
- Rodar `npm test -- lib/client/image-processing.test.ts` e `npm run typecheck`.

**Concluída quando:** os cinco cenários acima têm testes determinísticos, uma
foto válida chega à codificação após fallback e nenhuma regra atual de formato,
privacidade ou tamanho é relaxada.

**Risco/rollback:** risco principal é orientação diferente entre decoders.
Reverter somente o diff desta etapa restaura o decoder anterior; se já
implantado, `CLEANING_PHOTOS_ENABLED=false` contém o fluxo sem apagar dados.

### Etapa 2 — Pressão de memória e previews comprimidos

**Objetivo:** evitar múltiplos originais de alta resolução decodificados ou
renderizados ao mesmo tempo em celulares com pouca memória.

**Implementar**

- Processar as seleções sequencialmente, com concorrência máxima igual a 1.
- Guardar na fila as variantes já processadas; não repetir o processamento no
  momento do upload.
- Usar a miniatura comprimida como preview, nunca a URL do arquivo original de
  alta resolução.
- Liberar imediatamente URL/fonte original após gerar as variantes e revogar a
  URL da miniatura ao remover, descartar, fechar ou desmontar.
- Preservar ordem de seleção, remoção individual, limite de oito e mensagens por
  item. A interface não deve congelar nem permitir envio enquanto um item ainda
  está sendo preparado.
- Preferir helper puro/testável a adicionar nova biblioteca de estado ou imagem.

**Arquivos prováveis:** `useCleaningPhotoWorkflow.ts`,
`CleaningPhotoUploader.tsx`, `image-processing.ts` e testes próximos.

**Testar:** seleção múltipla mantém ordem; no máximo um processamento fica
ativo; preview usa thumbnail; URLs são revogadas; erro em uma foto não vaza
recursos nem corrompe as demais; upload não reprocessa. Rodar testes focados,
`npm run lint` e `npm run typecheck`.

**Concluída quando:** a fila não retém `File`/preview original depois do
processamento, a concorrência é comprovadamente 1 e todos os ciclos de vida de
URL têm teste.

**Risco/rollback:** risco de regressão na fila/remoção. Reverter somente esta
etapa mantém o fallback da Etapa 1; a flag de fotos continua sendo a contenção
operacional.

### Etapa 3 — Upload resiliente em rede móvel

**Objetivo:** recuperar automaticamente uma falha transitória sem criar foto
duplicada, objeto órfão ou loop de tentativas.

**Implementar**

- Enviar `display` e `thumbnail` sequencialmente para reduzir competição de
  banda/memória; remover o `Promise.allSettled` paralelo atual.
- Definir tentativas limitadas, backoff curto e classificação entre falha
  transitória e falha definitiva. Não iniciar nova requisição enquanto a
  anterior ainda puder estar ativa.
- Tratar a finalização como verificação autoritativa para respostas ambíguas.
- Se a finalização comprovar variante ausente, cancelar/limpar a reserva atual,
  criar novos caminhos imutáveis e repetir o ciclo completo **uma única vez**.
- Nunca usar `upsert`, sobrescrever caminho existente ou marcar `ready` sem as
  duas validações server-side.
- Em falha final, manter mensagem acionável e garantir ausência de reserva
  pendente criada pela tentativa atual.
- Revisão autorizada pelo usuário: permitir resposta tipada de finalização e
  limpeza automática somente de reservas `pending`, preservando a remoção
  explícita existente e os controles de autorização.
- Se a solução exigir outra mudança de protocolo, schema, bucket ou autorização, parar e
  marcar `blocked`; isso está fora do DB-0 e exige plano/autorização próprios.

**Testar:** caminho feliz; resposta ambígua com objetos presentes; uma variante
ausente seguida de retry bem-sucedido; duas falhas encerram sem loop; falha de
autorização/validação não é repetida; cancelamento não remove foto `ready`;
nenhum ID duplicado. Rodar testes focados, lint e typecheck.

**Concluída quando:** o retry total ocorre no máximo uma vez, usa nova reserva,
preserva os dois objetos imutáveis e todos os estados finais são `ready` válido
ou falha limpa e explícita.

**Risco/rollback:** maior risco é duplicação ou limpeza indevida. Os testes
negativos são obrigatórios. Reverter a orquestração cliente não requer rollback
de banco; preservar todos os objetos/metadados existentes.

### Etapa 4 — Observabilidade correlacionável e privada

**Objetivo:** permitir distinguir usuário afetado, release e tentativa
recuperada sem registrar PII.

**Implementar**

- Associar ao Sentry somente o UUID Supabase pseudônimo (`user.id`) e, se útil,
  o papel; nunca email, nome, foto, caminho assinado ou token. Limpar o usuário
  Sentry no logout/expiração.
- Garantir `release` cliente e servidor usando o SHA imutável fornecido pelo
  ambiente de build/deploy, sem inventar valor em runtime.
- Acrescentar tags de decoder usado, número da tentativa, etapa, resultado do
  retry e `recovered=true/false`, mantendo cardinalidade limitada.
- Eventos recuperados devem ser breadcrumb ou mensagem informativa, não issue de
  erro. Falhas finais inesperadas continuam como exceção.
- Revisar `beforeSend` para evitar PII/tokens sem ocultar erros técnicos reais.

**Arquivos prováveis:** configurações Sentry, bootstrap/logout de sessão,
`useCleaningPhotoWorkflow.ts` e helper de telemetria com testes.

**Testar:** usuário definido/limpo; evento não contém email/nome/token/URL
assinada; release aparece no evento de teste; retry recuperado não abre exceção;
falha definitiva mantém tags estáveis. Rodar testes focados, lint, typecheck e
build.

**Concluída quando:** um evento sintético permite correlacionar UUID pseudônimo,
release e tentativa sem PII, e o build não expõe segredo nem credencial privada.

**Risco/rollback:** identidade Sentry pode permanecer entre sessões se não for
limpa. O teste de logout é obrigatório. Reverter a instrumentação não altera o
fluxo funcional nem dados.

### Etapa 5 — Validações esperadas fora do Sentry

**Objetivo:** `photo_limit_reached` e outras respostas de domínio previstas
continuam claras ao usuário, mas não poluem o monitoramento.

**Implementar**

- Centralizar a classificação de falhas esperadas do fluxo de fotos.
- Não chamar `captureException` para `photo_limit_reached`; apresentar a mesma
  mensagem italiana e manter o estado da fila consistente.
- Não silenciar autorização, falha de Storage, decode, validação de conteúdo ou
  exceção desconhecida.
- Evitar filtros globais por texto no Sentry; decidir por código tipado.

**Testar:** limite retorna feedback e zero capturas; falha inesperada gera uma
captura; códigos desconhecidos não são descartados. Incluir os testes de
`photo-actions.test.ts` e do helper cliente. Rodar testes focados, lint e
typecheck.

**Concluída quando:** o limite de oito permanece aplicado no cliente e servidor,
mas não cria issue; nenhuma falha técnica relevante é suprimida.

**Risco/rollback:** classificação ampla demais pode ocultar defeitos. Reverter o
helper restaura somente a telemetria anterior; não há alteração de dados.

### Etapa 6 — Regressão completa e matriz móvel

**Objetivo:** provar o fluxo integrado após as Etapas 1–5, incluindo falhas
controladas e dispositivos representativos.

**Executar/implementar apenas testes faltantes**

- Consolidar testes automatizados de decoder, fila, ciclo de upload/retry,
  telemetria e limite; evitar duplicação entre arquivos.
- Rodar o gate global: `npm test`, `npm run lint`, `npm run typecheck` e
  `npm run build` em Node 22.
- Em Supabase exclusivamente local/descartável, rodar `npm run test:supabase` e
  um E2E com dados sintéticos para antes/depois, galeria, remoção e negações por
  papel. Nunca usar `--linked` nem dados reais.
- Testar manualmente câmera e galeria em Chrome Android e Safari iPhone; incluir
  seleção múltipla, foto de 2–8 MB, oito fotos, reconexão/retry e antes/depois.
- Se um dispositivo obrigatório não estiver disponível, marcar `blocked` ou
  registrar explicitamente `NOT VERIFIED`; não declarar cobertura inexistente.
- Não corrigir silenciosamente defeito de uma etapa anterior: reabrir a etapa
  responsável, corrigir e repetir o gate.

**Concluída quando:** gate global verde; Supabase local e E2E verdes; matriz
móvel aprovada ou lacuna explicitamente aceita pelo usuário; nenhum dado ou
ambiente remoto alterado.

**Risco/rollback:** etapa predominantemente de testes. Qualquer ajuste de código
deve ser atribuído à etapa de origem e obedecer ao rollback correspondente.

### Etapa 7 — Auditoria independente final

**Objetivo:** revisar o resultado como um todo sem confiar nos relatos de
conclusão das etapas anteriores.

**Independência obrigatória:** executar em nova janela de contexto. O revisor
deve usar este plano, o código/diff atual e evidências reproduzíveis; não precisa
ler relatórios narrativos anteriores. Preferencialmente não deve ser o mesmo
agente que implementou a última etapa.

**Auditar**

- Comparar o diff do programa com o baseline registrado, separando alterações
  alheias e verificando simplicidade, responsabilidades e ausência de dívida
  acidental.
- Reexecutar o gate global e os testes focados críticos; conferir que testes
  realmente falham se o fallback/retry/classificação for removido.
- Revisar lifecycle de blobs/URLs, limite de concorrência, orientação, retry
  único, idempotência, limpeza, transição `pending` → `ready` e mensagens.
- Fazer revisão de segurança de upload: autenticação/autorização server-side,
  RLS, MIME/tamanho/conteúdo, caminhos imprevisíveis, bucket privado, ausência
  de `upsert`, segredos e PII no Sentry. Mudanças remotas são proibidas; use
  inspeção local e consultas read-only autorizadas.
- Confirmar que não surgiu migration, alteração de bucket/schema ou contrato
  incompatível. Se surgiu, resultado é `BLOCK` até plano separado.
- Conferir documentação operacional; criar novo ADR somente se uma decisão
  arquitetural durável tiver mudado. Correção interna compatível usa este
  registro de manutenção.
- Após deploy solicitado separadamente, consultar Sentry/Storage de forma
  read-only para verificar redução de `decode_failed`, ausência de novos erros e
  presença de release/UUID pseudônimo. Sem deploy, registrar essa eficácia como
  `NOT VERIFIED`, sem bloquear a aprovação **pré-deploy** do código.

**Saída obrigatória:** veredito `READY`, `READY WITH WARNINGS` ou `BLOCKED`, com
achados objetivos, evidências, riscos residuais e distinção entre validação local
e produção.

**Concluída quando:** nenhuma etapa está apenas `in_progress`; o gate local é
reproduzível; não há achado crítico/alto aberto; controles de upload e privacidade
passam; o status de produção é declarado honestamente. Achado material reabre a
etapa responsável e mantém a Etapa 7 `blocked`.

## 7. Gate global e limites do programa

**Invariantes obrigatórias**

- Fotos continuam opcionais e separadas por O.S., ciclo e fase antes/depois.
- Somente fotos com as duas variantes validadas tornam-se `ready`.
- Bucket continua privado; leitura usa URL assinada; autorização permanece
  server-side/RLS.
- Não há perda, sobrescrita ou exclusão técnica de fotos/Ordens existentes.
- Telemetria não contém PII, arquivo, imagem, token ou URL assinada.
- `Europe/Rome` permanece o fuso do negócio quando datas forem exibidas.

**Fora do escopo**

- Migration ou mudança de schema/RLS/grants/bucket.
- Conversão HEIC/HEIF, processamento server-side de originais ou modo offline.
- Redesign amplo da interface.
- Commit, push, deploy ou mutação de produção sem pedido expresso.

**Rollback global não destrutivo**

1. Definir `CLEANING_PHOTOS_ENABLED=false` e republicar, se houver incidente.
2. Reimplantar a última versão compatível da aplicação.
3. Preservar tabela, registros, bucket e objetos; não executar exclusões ou
   rollback destrutivo.
4. Corrigir progressivamente, reexecutar a etapa responsável e a auditoria.
