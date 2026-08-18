# Matriz canônica de dados sensíveis

**Status:** aprovada para a Sprint 03
**Data:** 2026-08-17
**Escopo:** comportamento atual da aplicação antes do cutover de grants da Sprint 05

Esta matriz define os acessos que a aplicação precisa preservar quando os
grants de leitura forem restringidos. Ela não concede acesso novo, não altera
RLS/grants e formaliza a decisão de compatibilidade da Sprint 03. Toda leitura
privilegiada abaixo pertence a `lib/server/data-access/sensitive-data.ts`, que
autentica, obtém o papel por `profiles.role`, autoriza e valida entradas antes
de criar o client que ignora RLS.

| Tabela | Campo sensível | Papéis autorizados no caso de uso | Caso de uso | Operação/camada responsável | DTO mínimo | Consumidores |
|---|---|---|---|---|---|---|
| `profiles` | `hourly_rate`, `monthly_salary`, `overtime_rate` | `admin` | Administrar cadastro e remuneração | `loadEmployeeListForAdministration`, `loadEmployeeDetailForAdministration` | `EmployeeListItem`, `EmployeeFormData` | `/employees`, `/employees/[id]`, `EmployeeList`, `EmployeeForm` |
| `profiles` | `hourly_rate`, `monthly_salary` | `admin` | Produzir A Pagar e custo de equipe no dashboard | `loadPayableFinancialSource`, `loadDashboardFinancialSource` | `StaffCompensationSource` convertido em `PayableRow`, `PayableDetailRow` e `DashboardData` | actions de extratos, CSV/PDF A Pagar, dashboard |
| `properties` | `base_price` | `admin` | Listar/editar imóveis com preço | `loadPropertyListForAdministration`, `loadPropertyDetailForAdministration` | `PropertyListItem`, `PropertyFormData` | páginas e formulários de imóveis |
| `properties` | `base_price`, `extra_per_person` | `admin`, `secretaria` somente para cálculo server-side | Calcular/recalcular preço de O.S. sem enviar valores à secretaria | `loadAuthorizedPropertyPricingContext`, `loadAuthorizedOrderPricingContext` | `OrderPricingContext`; resultado persistido, sem DTO financeiro para o client | actions de criar/editar/finalizar/reabrir O.S.; `lib/server/pricing.ts` |
| `properties` | `base_price` | `admin` | Explicar e produzir A Receber | `loadReceivableFinancialSource` | `ReceivableOrderSource` convertido em `ReceivableReport` | tela, CSV e PDF A Receber |
| `properties` | `avg_cleaning_hours` | `admin` | Cadastro de imóvel | `loadPropertyDetailForAdministration` | `PropertyFormData` | formulário de imóvel |
| `properties` | `avg_cleaning_hours` | `admin`, `secretaria`, `limpeza`, `consegna` nas opções operacionais atualmente visíveis; `admin`, `secretaria`, `limpeza`, `consegna`, `cliente` quando a O.S. visível já chega à lista | Exibir estimativa operacional já existente | `loadAuthorizedServiceOrderPropertyOptions`, `loadAverageHoursForVisibleServiceOrders`; para papéis não administrativos, IDs são intersectados com linhas visíveis via RLS antes do bypass | `ServiceOrderPropertyOption` ou `ServiceOrderListItem.property` | formulário/lista/PDF ativo de O.S. |
| `properties` | `avg_cleaning_hours` | `admin` | Calcular A Pagar, horas e custo do dashboard | `loadPayableFinancialSource`, `loadDashboardFinancialSource` | fontes financeiras convertidas em DTOs de reporting/dashboard | A Pagar, dashboard, CSV/PDF |
| `service_orders` | `extra_services_description`, `extra_services_price` | `admin`, `secretaria` | Ver/editar extras no fluxo operacional | `loadAuthorizedServiceOrderOperationalFinancialFields` para leitura; Server Actions existentes para escrita | campos opcionais de `ServiceOrderFormData` | detalhe/formulário de O.S. |
| `service_orders` | `pricing_mode`, `extra_services_price`, `total_price` | `admin`, `secretaria`, `limpeza` apenas no recálculo autorizado da O.S. visível | Recalcular e persistir `total_price` server-side | `loadAuthorizedOrderPricingContext`, `persistAuthorizedServiceOrderTotalPrice` | `OrderPricingContext`; nenhum valor-base é retornado ao navegador; persistência privilegiada limitada a `total_price` após autorização e prova de visibilidade via RLS | `recalculateOrderPricing` e actions de O.S. |
| `service_orders` | `total_price`, `extra_services_price`, `consegna_fee` | `admin` | A Receber e dashboard financeiro | `loadReceivableFinancialSource`, `loadDashboardFinancialSource` | `ReceivableReport`, `DashboardData` | dashboard, extrato A Receber, CSV/PDF |

## Invariantes de autorização

- O papel nunca é aceito como argumento da operação privilegiada.
- A sessão e `profiles.role` são relidos pelo adapter antes da criação do client
  privilegiado.
- UUIDs, lotes e filtros de relatório são validados novamente no adapter.
- Para `limpeza`, `consegna` e `cliente`, um ID de imóvel não basta: o adapter
  primeiro confirma uma O.S./propriedade visível pelo client sujeito a RLS.
- Nenhuma operação aceita tabela, coluna, string de `select` ou escopo livre.
- Os DTOs existentes continuam sendo a fronteira enviada ao navegador.
- Escritas atuais de propriedades, remuneração e O.S. continuam nas Server
  Actions autenticadas e sujeitas ao RLS/grants atuais; a Sprint 03 não altera
  grants nem transforma o adapter em um proxy genérico de mutação.

## Decisão de compatibilidade para `avg_cleaning_hours`

A ADR 002 descreve `properties.avg_cleaning_hours` como “apenas admin”, mas o
código e a UI anteriores à Sprint 03 já o expõem em contextos operacionais:
opções de O.S. para secretaria/equipe e `ServiceOrderListItem.property` para os
cinco papéis quando a linha da O.S. é visível. Remover esse dado agora alteraria
o comportamento visível, o que é proibido nesta sprint.

Para o contrato preparado pela Sprint 03, o campo fica classificado como
**sensível contextual**: administração do imóvel e uso financeiro continuam
exclusivos de `admin`; como estimativa operacional, o valor só pode acompanhar
uma opção ou O.S. que o papel já pode ver, com o escopo confirmado primeiro por
RLS. `cliente` não recebe o catálogo de opções, apenas a estimativa ligada à sua
própria O.S. visível. Essa decisão preserva o contrato anterior sem ampliar
papéis, linhas ou consumidores. A ADR 002 permanece histórica; o novo ADR da
Sprint 05 deverá registrar explicitamente essa classificação ao definir o
cutover de grants.

## Fora do escopo desta matriz

- Dados básicos já protegidos por RLS e sem classificação financeira.
- Fotos e objetos de Storage, que possuem adapter e contrato próprios.
- Lockout de login, cujo uso privado de privilégio pertence à Sprint 07.
- Qualquer mudança de schema, RLS, policy, grant, função, trigger, Auth ou
  Storage.
