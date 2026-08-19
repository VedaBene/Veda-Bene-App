# ADR 018 — Confidencialidade de colunas via grants e adapters server-only

**Status**: Aceita e implantada; validação remota concluída em 2026-08-19
**Data**: 2026-08-19
**Supersede**: ADR 002

## Contexto

A ADR 002 adotou filtros explícitos de `select()` e DTOs para impedir que a
aplicação enviasse campos sensíveis a papéis indevidos. Essa defesa preservou o
contrato de UI, mas não impedia que um usuário autenticado chamasse a Data API
diretamente. O role PostgreSQL compartilhado `authenticated` ainda possuía
`SELECT` de tabela em `profiles`, `properties` e `service_orders`, inclusive
sobre remuneração, preços, valores financeiros e PII de perfis.

O preflight remoto read-only de 2026-08-19 confirmou também grants table-level
de `TRUNCATE`, `REFERENCES`, `TRIGGER` e `MAINTAIN` para `authenticated`. Eles
não pertencem a nenhum caso de uso da aplicação e aumentam o poder do role sem
benefício funcional.

RLS continua necessária para delimitar linhas, porém não escolhe colunas. Como
todos os papéis de negócio chegam ao Postgres como `authenticated`, grants de
coluna também não diferenciam `admin` de outros papéis. A Sprint 03 preparou um
adapter server-only que autentica, relê o papel confiável, autoriza a operação e
somente então usa `service_role` para os casos legítimos.

## Decisão

- Revogar os grants table-level de `SELECT`, `TRUNCATE`, `REFERENCES`, `TRIGGER`
  e `MAINTAIN` de `authenticated` nas três tabelas; os quatro últimos são
  privilégios administrativos sem uso legítimo pela aplicação.
- Conceder `SELECT` por coluna somente ao contrato seguro comum, mantendo RLS
  como barreira de linhas.
- Preservar `INSERT`, `UPDATE` e `DELETE` table-level porque os fluxos atuais os
  utilizam sob RLS, validação server-side e o guard da Sprint 04.
- Restringir em `profiles`: `email`, `phone`, `birth_date`, `nationality`,
  `address`, `hourly_rate`, `monthly_salary` e `overtime_rate`.
- Restringir em `properties`: `base_price`, `extra_per_person` e
  `avg_cleaning_hours`.
- Restringir em `service_orders`: `total_price`,
  `extra_services_description`, `extra_services_price` e `consegna_fee`.
- Até `admin` recebe essas colunas somente por operações autorizadas de
  `lib/server/data-access/sensitive-data.ts`; não há exceção de Data API direta.
- Preservar `pricing_mode`, notas operacionais e as demais colunas necessárias
  a listagens, joins, tracking e formulários no grant seguro comum.
- Manter `service_role` integral somente no servidor, sem exportar client bruto,
  tabela/coluna arbitrária ou proxy genérico.
- Não criar views. Uma futura view só poderá ser aceita por nova revisão, com
  `security_invoker = true`, grants mínimos e testes explícitos de RLS.
- A migration deve falhar diante de drift, não alterar dados, não usar `DROP` e
  provar por postconditions que nenhum grant de tabela neutraliza os grants por
  coluna.

## Consequências

**Positivas**:

- chamadas autenticadas diretas deixam de ler as colunas classificadas;
- PII de perfis pares deixa de vazar pela combinação de RLS com grant amplo;
- o adapter vira um seam profundo: callers pedem operações de negócio e não
  conhecem `service_role`, tabelas ou strings de `select` privilegiadas;
- filtros explícitos e DTOs continuam como defesa adicional e minimização de
  dados, não como única barreira.

**Negativas**:

- `admin` não pode mais consultar colunas restritas diretamente pela Data API;
- qualquer novo uso legítimo de coluna restrita exige ampliar uma operação
  server-only estreita e seus testes;
- `select('*')` passa a falhar nas três tabelas para `authenticated`, o que é
  intencional e torna queries implícitas incompatíveis;
- a segurança depende de manter o segredo de `service_role` fora do browser e
  de revisar continuamente os adapters privilegiados.

## Alternativas consideradas

- **Manter somente `select()`/DTOs**: rejeitada por continuar contornável pela
  Data API direta.
- **Views por papel**: rejeitadas por duplicarem a superfície, exigirem
  sincronização com o schema e repetirem os problemas históricos da ADR 002.
- **Grant direto para admin**: inviável porque os cinco papéis compartilham
  `authenticated`; conceder à role abriria a coluna para todos.
- **Mover todas as leituras para `service_role`**: rejeitada por ampliar demais
  o bypass de RLS. Somente colunas restritas e casos de negócio aprovados passam
  pelo adapter.
- **Desabilitar a Data API**: incompatível com os acessos RLS legítimos que o
  aplicativo ainda utiliza.

## Evidências e implantação

A matriz completa, SQL exato, preconditions, invariantes, testes, plano de
implantação e rollback não destrutivo estão em
[`sprint-05-column-confidentiality-cutover-db-p.md`](../evolution/sprint-05-column-confidentiality-cutover-db-p.md).

A aplicação foi separadamente autorizada após confirmação de backup/PITR e
restauração ensaiada. A migration `20260819030134` foi aplicada e validada no
ambiente remoto com hashes pré/pós idênticos, cinco papéis, `ROLLBACK`, Advisor,
dry-run final e 30 minutos de observação sem regressão.
