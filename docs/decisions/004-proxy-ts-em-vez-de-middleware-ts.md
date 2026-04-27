# ADR 004 — `proxy.ts` em vez de `middleware.ts`

**Status**: Aceita
**Data**: 2026-04-08

## Contexto

Next.js 16 deprecou a convenção de arquivo `middleware.ts` e renomeou para
`proxy.ts`. A maior parte dos tutoriais e exemplos de Supabase + Next.js
ainda usa `middleware.ts`, então qualquer pessoa nova no projeto vai estranhar
a presença de `proxy.ts` na raiz e provavelmente tentar "corrigir" para
`middleware.ts`.

## Decisão

Usamos a convenção atual do Next.js 16 — `proxy.ts` na raiz, exportando uma
função `proxy` em vez de `middleware`. O arquivo continua tendo o mesmo papel:
interceptar requisições antes de chegar nas rotas, atualizar a sessão Supabase
e proteger rotas autenticadas.

## Por que o Next.js fez essa renomeação

Conforme [a documentação oficial](https://nextjs.org/docs/messages/middleware-to-proxy):

1. **Confusão semântica** — "middleware" remete ao Express.js, onde tem
   significado e ergonomia diferentes. Levava desenvolvedores a usar a feature
   de forma errada.
2. **Clareza de propósito** — "proxy" deixa explícito que o arquivo opera numa
   camada de rede *antes* da aplicação, no Edge Runtime, mais próximo do
   cliente, separado da região do servidor.
3. **Direção estratégica** — o Next.js quer **desincentivar** o uso da feature
   e oferecer APIs melhores para casos comuns. A renomeação é um sinal de
   "use como último recurso".

## Importante: não confundir com `utils/supabase/middleware.ts`

Existem **dois arquivos diferentes** no projeto, com nomes parecidos:

- `proxy.ts` (raiz) — convenção do Next.js 16 (era `middleware.ts` no Next 15)
- `utils/supabase/middleware.ts` — helper do Supabase para gerenciar sessão
  em Server-Side. **Esse nome é da convenção do `@supabase/ssr`**, não muda

O arquivo `proxy.ts` na raiz importa funções de `utils/supabase/middleware.ts`.

## Consequências

**Positivas**:
- Acompanhamos a convenção atual do Next.js — sem warnings de deprecação
- Codemod oficial (`npx @next/codemod@canary middleware-to-proxy`) garantiu
  migração consistente

**Negativas**:
- Tutoriais externos não batem com o nome de arquivo
- Exemplos de copy/paste do Supabase precisam ser adaptados
- Confusão potencial com o `utils/supabase/middleware.ts` (que mantém o nome
  antigo por convenção do pacote)

## Alternativas consideradas

- **Manter `middleware.ts`**: descartada — está deprecated, gera warning, e
  vai eventualmente ser removida em uma versão futura do Next.js.

## Referências

- [Next.js docs — Renaming Middleware to Proxy](https://nextjs.org/docs/messages/middleware-to-proxy)
- [`proxy.ts`](../../proxy.ts) — implementação atual
- [`utils/supabase/middleware.ts`](../../utils/supabase/middleware.ts) — helper
  do Supabase (nome diferente, papel diferente)
