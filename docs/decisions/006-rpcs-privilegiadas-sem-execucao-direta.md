# ADR 006 — RPCs privilegiadas sem execução direta

**Status**: Aceita
**Data**: 2026-04-27

## Contexto

O Supabase Advisor marcou funções `SECURITY DEFINER` em `public` que podiam ser
executadas diretamente por `anon` ou `authenticated` via Data API:

- `get_top_properties(start_date, end_date, limit_count)`
- `get_monthly_stats(target_month)`
- `handle_new_user()`

Essas funções rodam com privilégios do dono. Mesmo quando a UI só expõe o uso
para admin, qualquer usuário com permissão `EXECUTE` poderia tentar chamar a
RPC diretamente.

## Decisão

Funções `SECURITY DEFINER` em `public` não devem ser executáveis diretamente por
`PUBLIC`, `anon` ou `authenticated`, salvo justificativa explícita.

Para isso:

- o dashboard deixou de depender da RPC `get_top_properties`
- o ranking de imóveis passou a ser calculado no Server Action com consultas
  normais do Supabase e agregação em TypeScript
- `EXECUTE` foi revogado de `get_top_properties`, `get_monthly_stats` e
  `handle_new_user` para `PUBLIC`, `anon` e `authenticated`
- `handle_new_user()` continua sendo chamada pelo trigger
  `on_auth_user_created`, não pela API pública

## Consequências

**Positivas**:
- remove a superfície de chamada direta dessas funções privilegiadas pela API
- mantém o dashboard funcionando sem RPC privilegiada
- reduz os warnings de `SECURITY DEFINER` no Supabase Advisor

**Negativas**:
- o cálculo de top imóveis saiu do banco e passou para o Server Action
- se uma RPC privilegiada for necessária no futuro, ela precisará de revisão
  explícita de grants e escopo antes de ser exposta

## Alternativas consideradas

- **Manter grants para `authenticated`**: descartado porque qualquer usuário
  logado poderia chamar as RPCs diretamente.
- **Mover todas as três funções para schema privado**: viável, mas maior que o
  necessário agora. `handle_new_user()` é função de trigger e as funções de
  dashboard deixaram de ser usadas pelo app.
- **Manter `get_top_properties` como RPC de dashboard**: descartado para evitar
  dependência do frontend/server action em uma RPC privilegiada.
