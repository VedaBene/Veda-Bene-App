# ADR 013 — Padronização de Fuso Horário (Europe/Rome) em Inputs e Timestamps de OS

**Status**: Aceita
**Data**: 2026-07-27

## Contexto

Os campos `<input type="datetime-local">` no formulário de Ordem de Serviço capturam valores no formato de "hora de parede" sem offset de fuso horário (ex: `"2026-07-27T11:00"`). Anteriormente, a Server Action enviava essa string ingênua diretamente ao Supabase/PostgreSQL para colunas do tipo `TIMESTAMPTZ`.

Como a string não possuía indicação de fuso, o PostgreSQL assumia a timezone padrão da sessão (`UTC`), gravando fisicamente `11:00 UTC`. Ao exibir os dados na tabela e nos relatórios através de `formatDateTime` (que aplica a conversão para `Europe/Rome`), o sistema adicionava +2 horas em Julho (Horário de Verão / CEST), exibindo `13:00` na tabela.

Além disso, a hidratação do formulário utilizava `.slice(0, 16)` sobre a string ISO da API (`"2026-07-27T11:00:00+00:00"`), cortando o sufixo `+00:00` e devolvendo `"2026-07-27T11:00"`, o que mascarava a divergência na tela de edição.

## Decisão

1. Criar o utilitário puramente funcional `lib/timezone.ts` com as funções:
   - `toRomeIsoString(value)`: Converte valores de hora de parede (`YYYY-MM-DDTHH:mm`) para uma string ISO 8601 UTC exata no fuso `Europe/Rome`.
   - `toRomeLocalInputValue(value)`: Converte timestamps ISO UTC do banco de dados para a hora de parede correspondente em `Europe/Rome` formatada como `YYYY-MM-DDTHH:mm`.
2. Atualizar o componente `ServiceOrderForm.tsx` para utilizar `toRomeLocalInputValue` no estado inicial dos inputs e `toRomeIsoString` na montagem do `FormData`.
3. Sanitizar `checkout_at` e `checkin_at` nas Server Actions (`actions.ts`) usando `toRomeIsoString`.
4. Proibir categoricamente o uso de manipulações ingênuas como `.slice(0, 16)` para datas e horas no frontend.

## Consequências

- **Positivas**:
  - Elimina desvios sazonais (+2h em CEST / +1h em CET).
  - Garante a simetria no cálculo da coluna calculada `is_urgent` (`(checkin_at - checkout_at) <= 3h`).
  - Garante que dados exibidos na tabela, formulário e relatórios PDF permaneçam 100% alinhados com o fuso da operação em Roma.
  - Mantém total conformidade com as regras de integridade de dados de produção do `AGENTS.md` (sem alterações no banco de dados).
- **Negativas**:
  - Exige a utilização obrigatória dos utilitários de `lib/timezone.ts` sempre que novos campos de data/hora de parede forem adicionados ao sistema.

## Alternativas consideradas

- **Alterar o tipo de coluna no PostgreSQL para `TIMESTAMP WITHOUT TIME ZONE`**: Descartado por violar a regra de integridade de dados de produção (`AGENTS.md`) e quebrar colunas calculadas e ordenação relativa por UTC.
- **Ajustar apenas a exibição na tabela ignorando o fuso**: Descartado por ser uma correção superficial (gambiarra) que manteria o dado corrompido no banco.
