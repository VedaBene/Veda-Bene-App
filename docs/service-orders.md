# Ordens de Serviço — Regras de listagem e exportação

Este documento registra os comportamentos operacionais da listagem de Ordens de
Serviço que não justificam um ADR, mas precisam permanecer consistentes entre a
tela e os PDFs.

## Listagem e filtros

- A tela separa ordens `open`, `in_progress` e `done` nas seções **Aperti**,
  **In corso** e **Completati**.
- A busca textual localiza ordens pelo nome do imóvel. O antigo seletor de
  imóvel foi removido da interface por ser redundante com essa busca.
- Existem filtros independentes por responsável de **Pulizia** e de
  **Consegna**, além do período por `cleaning_date`.
- Os filtros são validados no servidor e aplicados igualmente às ordens ativas,
  às concluídas e aos dados enviados aos respectivos PDFs.
- O filtro de Pulizia considera a relação de múltiplos responsáveis em
  `service_order_cleaning_staff`; o filtro de Consegna usa
  `service_orders.consegna_staff_id`.
- Sem filtros, **Completati** exibe apenas as ordens concluídas na data corrente
  de Roma. Com filtros, a seção é paginada, mas o PDF de concluídas recebe o
  conjunto filtrado para exportação, não apenas a página visível.
- O perfil `cliente` não recebe a lista de funcionários usada nos filtros e
  continua sem visualizar nomes de responsáveis, conforme o contrato de
  visibilidade do sistema.

## Prioridade operacional das ordens ativas

A mesma regra deve ser usada nas seções **Aperti** e **In corso** e no PDF de
ordens ativas. O comparador canônico está em
`components/service-orders/ordering.ts`.

Ordem dos critérios:

1. `cleaning_date` crescente: ordens vencidas e do dia aparecem antes das datas
   futuras.
2. Dentro da mesma data, menor janela de limpeza, calculada por
   `checkin_at - checkout_at`.
3. Dentro de uma data, ordens sem uma janela calculável aparecem depois das que
   possuem check-in e check-out válidos.
4. `order_number` crescente como desempate final.
5. Ordens sem `cleaning_date` aparecem por último.

Consequentemente, uma ordem futura nunca ultrapassa uma ordem de data anterior
apenas por possuir uma janela de limpeza menor.

## Informações exibidas

- `cleaning_notes` é exibido na listagem e no PDF. Sua visibilidade para os
  perfis autorizados a ler a ordem segue o [ADR 007](decisions/007-exposicao-de-notas-de-limpeza-para-todos-os-perfis.md).
- Para ordens concluídas, a tela e o PDF apresentam, em sequência:
  - horário exato de conclusão, vindo de `completed_at`;
  - tempo efetivo de limpeza, vindo de `worked_minutes`.
- Esses valores são apenas formatados para exibição. A conclusão e o cálculo do
  tempo continuam pertencendo ao fluxo de finalização da ordem.

## Rastreamento do tempo de limpeza

- `admin`, `secretaria` e o funcionário de `limpeza` associado à OS usam os
  mesmos pop-ups de início e finalização na listagem e no detalhe da ordem.
- Iniciar registra `started_at` e move a OS para `in_progress`; finalizar
  registra `completed_at` e as notas de conclusão. `worked_minutes` é calculado
  automaticamente pelo banco a partir desses dois horários.
- Uma OS `in_progress` sem `started_at`, criada pelo fluxo legado de mudança
  direta de status, oferece novamente a ação de início para recuperar o
  rastreamento antes de permitir a conclusão.
- As transições são condicionais no servidor para que operações simultâneas não
  sobrescrevam os horários já registrados.
- Administrador e secretária podem reabrir uma OS. A reabertura limpa
  `started_at`, `completed_at` e as notas de conclusão para iniciar um novo ciclo
  de rastreamento.

## PDFs por status

- A exportação de ordens ativas contém somente `open` e `in_progress`.
- A exportação de concluídas contém somente `done`.
- Cada botão exporta os dados já submetidos aos filtros correntes.
- O PDF de ordens ativas usa a prioridade operacional descrita acima; o de
  concluídas preserva a ordem retornada pela consulta de concluídas.
- Para manter o documento compacto, os campos de ocupação usam:
  - `OSPITI` → `PX`
  - `LETTI MATRIMONIALI` → `M`
  - `LETTI SINGOLI` → `S`
  - `DIVANI LETTO` → `DC`
  - `BAGNI` → `WC`
  - `BIDET` → `BID`

## Pontos de manutenção

- Consulta, filtros e DTOs: `lib/server/data-access/service-orders.ts` e
  `lib/server/validation/contracts.ts`.
- Orquestração da listagem: `components/service-orders/ServiceOrderList.tsx`.
- Tabela e cartões: `components/service-orders/ServiceOrderListTable.tsx`.
- Impressão/PDF: `components/service-orders/ServiceOrderActiveExport.tsx`.
- Ordenação compartilhada: `components/service-orders/ordering.ts` e seu teste
  `components/service-orders/ordering.test.ts`.
