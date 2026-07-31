# Compatibilidade de fotos móveis e atualização de segurança do Next.js

**Data**: 2026-07-30

**Estado**: implantado em produção

**Commits**: [`27eb69e`](https://github.com/VedaBene/Veda-Bene-App/commit/27eb69e) (fotos) e [`7dc902e`](https://github.com/VedaBene/Veda-Bene-App/commit/7dc902e) (Next.js)

## Resumo

Esta manutenção corrigiu falhas no envio de fotos de limpeza em navegadores que
não codificam WebP de forma confiável, especialmente Safari/WebViews no iPhone,
e atualizou o Next.js de `16.2.10` para `16.2.12` para incorporar correções de
segurança no Proxy e nas Server Actions.

A decisão arquitetural do fluxo de fotos está no [ADR 014](../decisions/014-fallback-jpeg-e-validacao-integral-de-fotos.md). O comportamento operacional
completo está em [Fotos de limpeza das Ordens de Serviço](../service-order-photos.md).

## Problema e causa raiz

O cliente exigia `canvas.toBlob(..., 'image/webp')` para toda foto. Alguns
navegadores conseguem exibir WebP, mas não garantem sua codificação via canvas;
nesses casos a API pode devolver `null` ou um Blob com outro MIME. Como o banco,
os caminhos e o bucket aceitavam somente WebP, a operação era interrompida antes
da confirmação do início ou da conclusão da limpeza.

A mensagem visível era `Il browser non supporta la conversione WebP.`, útil para
pesquisar ocorrências antigas no Sentry e no histórico do projeto.

Além disso, a finalização server-side reconhecia o cabeçalho WebP, mas não
comprovava que o arquivo inteiro era decodificável. Isso deixava a validação de
conteúdo menos forte do que o contrato indicava.

## Implementação realizada

### Cliente e compatibilidade entre dispositivos

- [`lib/client/image-processing.ts`](../../lib/client/image-processing.ts): probe real do encoder WebP; fallback para
  JPEG; verificação do MIME efetivamente devolvido; limite de 50 megapixels;
  geração sequencial das variantes para reduzir picos de memória.
- [`components/service-orders/useCleaningPhotoWorkflow.ts`](../../components/service-orders/useCleaningPhotoWorkflow.ts): reserva e upload com
  MIME explícito; telemetria Sentry por fase/código sem enviar nome, bytes ou
  conteúdo da foto.
- Em navegadores com encoder WebP funcional, inclusive Androids compatíveis, o
  fluxo continua usando WebP. Em iPhone/iOS ou WebViews onde o probe falha, o
  fluxo usa JPEG automaticamente.

### Contrato, Storage e validação server-side

- [`lib/types/service-order-photos.ts`](../../lib/types/service-order-photos.ts) e
  [`lib/server/validation/service-order-photos.ts`](../../lib/server/validation/service-order-photos.ts): contrato limitado a
  `image/webp` e `image/jpeg`.
- [`lib/server/storage/service-order-photo-storage.ts`](../../lib/server/storage/service-order-photo-storage.ts): caminhos imutáveis com
  extensão coerente e decodificação integral por Sharp, conferindo formato,
  MIME, tamanho, dimensões, quantidade de páginas e limite de pixels.
- [`lib/server/service-order-photos.ts`](../../lib/server/service-order-photos.ts): finalização autoritativa das duas
  variantes somente após toda a validação.
- [`lib/server/data-access/service-order-photos.ts`](../../lib/server/data-access/service-order-photos.ts): leitura do MIME persistido.
- `sharp` foi declarado como dependência direta na versão segura `0.35.3` para o
  validador da aplicação.

### Evolução aditiva do banco

A migration
[`supabase/migrations/20260730231155_allow_jpeg_cleaning_photos.sql`](../../supabase/migrations/20260730231155_allow_jpeg_cleaning_photos.sql):

- adiciona `service_order_photos.content_type TEXT NOT NULL DEFAULT 'image/webp'`;
- limita o campo a WebP/JPEG por constraint;
- amplia `allowed_mime_types` do bucket privado para WebP/JPEG;
- não executa `DELETE`, `DROP`, `TRUNCATE` nem altera Ordens de Serviço;
- aborta atomicamente se encontrar schema ou bucket divergente do esperado.

As asserções pós-migração estão em
[`supabase/tests/service_order_photo_formats_invariants.sql`](../../supabase/tests/service_order_photo_formats_invariants.sql).

## Preservação dos dados verificada

Antes e depois da migration aplicada via Supabase MCP, foram comparados
contagens e hashes dos dados existentes:

| Invariante | Resultado pós-migração |
|---|---:|
| Ordens de Serviço | 748; contagem e hash inalterados |
| Registros de fotos | 730; campos anteriores e hash inalterados |
| Registros legados classificados como WebP | 730 |
| Objetos no bucket | 1.460; contagem e hash inalterados |
| Bytes armazenados | 77.883.064; inalterados |
| MIME inválido ou nulo | 0 |

O bucket permaneceu privado, com limite de 2 MB por objeto. Nenhuma foto, objeto
ou parte do histórico das Ordens de Serviço foi excluída ou reescrita.

## Atualização do Next.js

`package.json` e `package-lock.json` foram atualizados de Next.js e
`eslint-config-next` `16.2.10` para `16.2.12`. React e as demais dependências não
foram atualizados intencionalmente nessa manutenção.

A atualização patch removeu os avisos específicos identificados para bypass do
Proxy, SSRF e negação de serviço em Server Actions. O `npm audit` ainda apontava
riscos altos em dependências internas do próprio Next.js (`sharp 0.34.5` e
`postcss`). Não foram adicionados `overrides` não suportados. O validador de
fotos da aplicação resolve diretamente para Sharp `0.35.3`; futuras atualizações
do Next devem repetir a auditoria e remover o risco residual quando houver uma
versão oficial compatível.

## Validação e implantação

Antes de cada publicação foram executados com sucesso:

- `npm test`: 22 arquivos e 98 testes;
- `npm run lint`;
- `npm run typecheck`;
- `npm run build` com Next.js `16.2.12`.

Os commits foram enviados diretamente ao `master`. Os workflows
[`30590162273`](https://github.com/VedaBene/Veda-Bene-App/actions/runs/30590162273)
e [`30591515399`](https://github.com/VedaBene/Veda-Bene-App/actions/runs/30591515399),
o Supabase Preview e os dois deploys da Vercel concluíram com sucesso. A migration foi
registrada no Supabase como `20260730231155_allow_jpeg_cleaning_photos` antes do
deploy da aplicação compatível.

## Impacto esperado e limitações

- O erro de conversão WebP observado em iPhones deve deixar de bloquear o fluxo,
  pois JPEG é usado automaticamente quando necessário.
- Androids e navegadores com suporte completo continuam no caminho WebP.
- Falhas por pressão de memória ficam menos prováveis, mas um dispositivo ainda
  pode falhar se não conseguir decodificar ou criar o canvas.
- HEIC/HEIF continua não suportado e recebe mensagem explícita.
- Fontes acima de 50 megapixels são recusadas deliberadamente.
- Arquivos corrompidos, truncados, animados ou com MIME divergente não chegam ao
  estado `ready`.

## Rollback e manutenção futura

- Contenção imediata das fotos: definir `CLEANING_PHOTOS_ENABLED=false` e
  republicar. Não remover coluna, constraint, registros ou objetos.
- Reversão da aplicação: reimplantar um commit compatível; a migration aditiva
  permanece no banco e continua compatível com o cliente WebP anterior.
- Reversão do Next.js: restaurar as versões anteriores em `package.json` e
  `package-lock.json`, validar e republicar. Não há mudança de banco associada.
- Ao alterar este fluxo, manter cliente, schema, bucket, extensão do caminho e
  validador server-side no mesmo contrato de MIME.
- Repetir testes em Safari/iPhone e Chrome/Android, auditoria de dependências e
  verificação dos limites de upload antes de novas publicações.
