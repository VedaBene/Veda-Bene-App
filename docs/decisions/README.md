# Architecture Decision Records (ADRs)

Esta pasta contém o registro das decisões arquiteturais críticas do Veda Bene.
Cada ADR é **imutável**: quando uma decisão muda, criamos um novo ADR que
explicitamente *supersede* o anterior, em vez de editar o documento original.
Isso preserva o histórico de **por que** o sistema chegou no estado atual.

## Quando criar um ADR

- Decisão arquitetural relevante (RLS, autenticação, modelo de dados, infra)
- Mudança em uma decisão antiga já registrada (criar novo ADR marcando o anterior como superseded)

## Quando NÃO criar um ADR

- Bugs e correções pontuais
- Mudanças rotineiras de feature/UI
- Refactor que não muda comportamento

## Índice

| # | Decisão | Status |
|---|---|---|
| [001](001-rls-via-app-role-no-jwt.md) | RLS via `app_role` no JWT | Aceita |
| [002](002-cls-via-filtro-select.md) | CLS via filtro de `select()` (após remoção das views) | Aceita |
| [003](003-cliente-b2c-via-email-match.md) | Identificação de cliente B2C via match de email | Aceita |
| [004](004-proxy-ts-em-vez-de-middleware-ts.md) | `proxy.ts` em vez de `middleware.ts` | Aceita |

## Formato

Cada ADR segue um template enxuto:

```markdown
# ADR NNN — Título da decisão

**Status**: Aceita | Superseded por ADR XXX
**Data**: YYYY-MM-DD

## Contexto
O que motivou a decisão.

## Decisão
O que foi decidido.

## Consequências
O que essa decisão implica (positivas e negativas).

## Alternativas consideradas
Outras opções avaliadas e por que foram descartadas.
```
