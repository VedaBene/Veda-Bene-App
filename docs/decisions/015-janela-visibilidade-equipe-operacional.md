# ADR 015 — Janela de visibilidade das Ordens de Serviço da equipe operacional

**Status**: Aceita
**Data**: 2026-08-07

## Contexto

Funcionários de `limpeza` (Pulizia na interface) e `consegna` precisam preparar
somente o trabalho próximo. Exibir ordens muito futuras aumenta o volume de
informações e permite que uma programação ainda sujeita a redistribuição seja
tratada como definitiva.

A restrição não pode existir apenas na interface, pois o aplicativo usa a Data
API do Supabase e uma ordem também pode ser consultada diretamente por seu ID.
Os demais perfis não devem sofrer mudança de comportamento.

## Decisão

- `limpeza` e `consegna` podem ler somente Ordens de Serviço atribuídas ao
  próprio usuário cujo `cleaning_date` seja menor ou igual a amanhã em
  `Europe/Rome`.
- O limite é somente superior: ordens atrasadas e o histórico continuam
  disponíveis. Ordens sem `cleaning_date` não ficam visíveis para esses perfis.
- A regra canônica é aplicada por RLS no banco, por meio do helper privado
  `private.operational_staff_service_order_ids()`. O DAL repete o limite para
  deixar a intenção explícita, reduzir dados transferidos e produzir uma
  interface previsível.
- Vínculos de Pulizia, nomes de colegas e imóveis acessíveis à equipe operacional
  seguem o mesmo conjunto de ordens visíveis, evitando exposição indireta de
  atribuições futuras.
- `consegna` permanece somente leitura. A política de atualização continua
  exclusiva de `limpeza` e dos perfis administrativos que já a possuíam.
- `admin`, `secretaria` e `cliente` mantêm as regras atuais.

## Consequências

- Uma ordem de depois de amanhã passa a aparecer automaticamente quando entra na
  janela, de acordo com a data de Roma.
- Uma ordem atrasada não desaparece e pode continuar o fluxo operacional.
- Se uma ordem visível for reagendada para depois de amanhã ou se for
  redistribuída, ela deixa de ser acessível ao funcionário anterior.
- A página aberta durante a virada do dia atualiza os dados quando volta a ficar
  visível ou recebe foco.
- A alteração exige testes de RLS por perfil, atribuição, data e acesso direto,
  além de ensaio específico nas transições de horário de verão de Roma.

## Alternativas consideradas

- **Aplicar somente um filtro visual**: descartado porque seria contornável por
  URL ou acesso direto à API.
- **Mostrar estritamente hoje e amanhã, ocultando o passado**: descartado porque
  poderia esconder ordens atrasadas ainda abertas ou em andamento.
- **Criar uma nova agenda separada**: não resolve o acesso direto aos dados e
  duplicaria regras. A listagem atual com autorização central é mais simples.
- **Usar UTC ou `CURRENT_DATE` sem fuso explícito**: descartado porque mudaria a
  janela no horário errado em parte do dia e nas transições sazonais.
