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
- Sem filtros, **Completati** exibe a totalidade das ordens concluídas na data corrente de Roma (Modo Diário), sem limite de paginação física no banco de dados. O indicador de contagem exibe a quantidade total de ordens concluídas encontradas (`doneTotalCount`), mantendo a perfeita simetria com as linhas exibidas e os relatórios. Com filtros ativos, a listagem da tela é paginada em lotes de 20 itens, mas o PDF de concluídas recebe a totalidade dos registros filtrados (`doneForExport`), sem paginação.
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

- A exportação de concluídas contém somente `done`.
- O PDF de concluídas sem filtros ativos (Modo Diário) exibe a data corrente de Roma formatada como "DD/MM/YYYY (Oggi)" em seu cabeçalho.
- A exportação de ordens em aberto ("Aperti") contém apenas ordens com status `open`.
- A exportação de ordens em andamento ("In corso") contém apenas ordens com status `in_progress`.
- Cada botão exporta os dados já submetidos aos filtros correntes.
- Os PDFs de ordens ativas ("Aperti" e "In corso") usam a prioridade operacional descrita acima; o de concluídas preserva a ordem retornada pela consulta de concluídas.
- Os botões de exportação de PDF de todas as seções são desabilitados visualmente e funcionalmente (via flag `isSyncing`) caso o estado de filtros local do cliente esteja desalinhado com o servidor (durante o debounce de digitação ou o tempo de carregamento da transição assíncrona com `useTransition`), blindando o sistema contra geração de relatórios com dados inconsistentes.
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
- Orquestração da listagem: `components/service-orders/ServiceOrderList.tsx` (a sincronização entre props de URL e estado local é feita durante a fase de renderização, sem `useEffect`, evitando loops de navegação reentrante).
- Tabela e cartões: `components/service-orders/ServiceOrderListTable.tsx` (textos dinâmicos são envelopados em `<span>` para proteção contra desalinhamentos DOM do tradutor automático do navegador).
- Impressão/PDF: `components/service-orders/ServiceOrderActiveExport.tsx`.
- Ordenação compartilhada: `components/service-orders/ordering.ts` e seu teste
  `components/service-orders/ordering.test.ts`.
- Formatação de data/hora de Roma: `lib/utils/date-rome.ts`. O relógio do
  cabeçalho fica em `components/ui/DateTimeDisplay.tsx`.

## Fuso Horário de Referência (Timezone)

Todo o sistema utiliza o fuso horário oficial da Itália, `Europe/Rome`, como referência para manipulação, armazenamento e exibição de dados temporais.
- A exibição e formatação de datas e horas na tela e nos relatórios PDF (inclusive de extratos a pagar/receber) utilizam `Europe/Rome` na conversão de timestamps TIMESTAMPTZ, garantindo que o fuso horário do usuário (ex: no Brasil) não desloque as datas das limpezas.
- O cálculo do Modo Diário no servidor (todayStr) utiliza o fuso `Europe/Rome`.
- O relógio em tempo real exibido no cabeçalho do painel (`DateTimeDisplay.tsx`) também é sincronizado com o fuso da Itália (`Europe/Rome`). Ele usa `useSyncExternalStore`: o snapshot do servidor retorna `null`, mantendo o mesmo placeholder durante SSR e hidratação; no cliente, um snapshot por segundo passa a alimentar a formatação. Não use uma flag `mounted` atualizada sincronicamente em `useEffect`, pois esse padrão viola o lint e introduz uma renderização em cascata evitável.
