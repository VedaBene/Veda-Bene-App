# ADR 017 — Guard de integridade para updates de Ordens de Serviço

**Status**: Proposta; implementação local pronta e implantação remota pendente
**Data**: 2026-08-18

## Contexto

As policies de RLS de `public.service_orders` delimitam quais linhas cada papel
alcança, mas o grant de tabela necessário à Data API permite que o role
Postgres compartilhado `authenticated` tente modificar qualquer coluna da linha
alcançada. Em especial, um usuário de `limpeza` poderia contornar as Server
Actions e enviar diretamente alterações financeiras, administrativas, de
propriedade, atribuição ou timestamps.

O papel da aplicação continua vindo de `app_role` no JWT conforme o ADR 001. O
ADR 002 permanece vigente para confidencialidade de leitura e não é alterado
por esta decisão.

## Decisão

- Um trigger `BEFORE UPDATE` em `public.service_orders` executará a função
  `private.guard_service_order_update()` para validar a diferença entre `OLD` e
  `NEW` antes da escrita.
- A função será `SECURITY INVOKER`, terá `SET search_path = ''`, qualificará
  objetos e não consultará outras tabelas.
- `admin` e `secretaria` preservarão as mutações atualmente permitidas pelas
  policies. `postgres` e `service_role` preservarão os fluxos técnicos
  autorizados no servidor.
- `limpeza` poderá apenas fazer um no-op real, iniciar uma O.S. atribuída de
  `open` para `in_progress`, ou concluí-la de `in_progress` para `done`, com os
  timestamps operacionais próximos ao relógio do banco e, na conclusão, notas
  opcionais. As policies continuam responsáveis por exigir a atribuição e a
  janela de visibilidade.
- `consegna`, `cliente`, papel ausente e papel inválido não ganham capacidade de
  update. A função falha de forma fechada com mensagem genérica e sem valores da
  linha.
- `PUBLIC`, `anon`, `authenticated` e `service_role` não recebem execução direta
  da função de trigger. A invocação ocorre somente pelo trigger.
- Pricing autorizado após tracking passa por uma operação server-side mínima,
  que comprova visibilidade com o cliente sujeito a RLS antes de persistir
  exclusivamente `total_price` com o cliente privilegiado.

## Consequências

- Chamadas diretas à Data API deixam de poder usar a policy de `limpeza` para
  alterar colunas fora do fluxo operacional.
- O guard permanece pequeno e local, sem duplicar atribuição, janela temporal,
  fotos, múltiplos funcionários ou fórmulas financeiras.
- A aplicação precisa manter o recálculo de preço em uma fronteira server-side
  explicitamente autorizada; a fórmula existente não muda.
- A criação do trigger adquire lock `SHARE ROW EXCLUSIVE` por uma operação curta.
  A migration usa `lock_timeout` de 5 segundos e `statement_timeout` de 60
  segundos, abortando atomicamente diante de drift ou contenção.
- A Sprint 05 continuará responsável por confidencialidade e grants de leitura.

## Alternativas consideradas

- **Grants de UPDATE por coluna**: insuficiente porque todos os papéis da
  aplicação compartilham o role Postgres `authenticated`.
- **Somente validação nas Server Actions**: contornável por chamadas diretas à
  Data API.
- **Reescrever as policies com toda a matriz de colunas**: tornaria as
  expressões de RLS um hotspot difícil de auditar e ainda misturaria alcance de
  linha com integridade de mutação.
- **Função `SECURITY DEFINER`**: descartada porque o guard não precisa elevar
  privilégios nem consultar tabelas auxiliares.
- **RPC transacional abrangente**: adiada para a Sprint 08; ampliaria o escopo e
  substituiria fluxos que não precisam mudar nesta sprint.

## Evidências

O diagnóstico, a matriz completa, o threat model, os invariantes e o plano
operacional estão em
[`docs/evolution/sprint-04-service-order-update-guard-db-p.md`](../evolution/sprint-04-service-order-update-guard-db-p.md).
