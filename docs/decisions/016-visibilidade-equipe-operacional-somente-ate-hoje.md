# ADR 016 — Visibilidade da equipe operacional somente até hoje

**Status**: Aceita; supersede o ADR 015
**Data**: 2026-08-12

## Contexto

O ADR 015 permitiu que funcionários de `limpeza` (Pulizia na interface) e
`consegna` visualizassem Ordens de Serviço atribuídas até o dia seguinte. A
operação passou a exigir uma janela ainda mais restrita, para que programações
do dia seguinte, ainda sujeitas a alterações e redistribuições, não sejam
tratadas como definitivas.

A mudança continua sendo uma regra de autorização, não apenas uma preferência
visual. Portanto, precisa valer igualmente para a Data API, acesso direto por
ID, vínculos de equipe, nomes de colegas, imóveis, filtros e exportações.

## Decisão

- `limpeza` e `consegna` podem ler somente Ordens de Serviço atribuídas ao
  próprio usuário cujo `cleaning_date` seja menor ou igual ao dia atual em
  `Europe/Rome`.
- O limite permanece apenas superior: ordens atrasadas e o histórico continuam
  disponíveis. Ordens sem `cleaning_date` e ordens de amanhã em diante ficam
  invisíveis para esses perfis.
- A regra canônica permanece no helper privado
  `private.operational_staff_service_order_ids()` e é espelhada no DAL para
  reduzir dados transferidos e manter a interface previsível.
- Vínculos, colegas e imóveis acessíveis à equipe operacional continuam
  derivados do mesmo conjunto autorizado de ordens.
- `consegna` permanece somente leitura; `admin`, `secretaria` e `cliente`
  mantêm suas regras atuais.

## Consequências

- Uma ordem de amanhã passa a aparecer somente quando o calendário de Roma
  chegar ao dia previsto.
- Uma ordem atrasada, inclusive aberta ou em andamento, não desaparece e pode
  continuar o fluxo operacional.
- Uma página que volta ao foco após a virada do dia solicita dados atualizados.
- Filtros de período podem restringir o histórico, mas nunca ampliar o teto
  autorizado além de hoje.
- A mudança exige uma nova migração progressiva e testes específicos de ontem,
  hoje, amanhã, data nula, atribuição e acesso direto por papel.

## Alternativas consideradas

- **Mostrar estritamente apenas `cleaning_date = hoje`**: descartado porque
  esconderia ordens atrasadas ainda abertas ou em andamento.
- **Alterar somente a interface**: descartado porque seria contornável por URL
  ou acesso direto à Data API.
- **Manter hoje e amanhã**: descartado por não atender à nova decisão
  operacional de ocultar antecipadamente a programação do dia seguinte.
- **Usar o relógio local do dispositivo ou UTC**: descartado porque a operação é
  regida pelo calendário de Roma e precisa respeitar as transições sazonais.
