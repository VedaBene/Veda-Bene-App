# Filtro de funcionário nas Ordens de Serviço

**Data**: 2026-09-16

**Estado**: implementado e homologado localmente; ainda não publicado

**ADR**: não criado. A mudança aplica e reforça o modelo de múltiplos
funcionários já documentado no [ADR 009](../decisions/009-multiplos-funcionarios-limpeza-na-os.md),
sem alterar schema, RLS ou uma decisão arquitetural independente.

## Resumo

O filtro de **Pulizia** por funcionário deixou de transportar uma lista de IDs
de ordens para a URL da consulta. Ele passou a filtrar diretamente pela tabela
associativa `service_order_cleaning_staff`, mantendo separada a relação que
carrega a equipe completa exibida em cada Ordem de Serviço.

A mudança corrige o caso de Joe, cujo volume de vínculos fazia a requisição
ultrapassar o limite de cabeçalhos (`UND_ERR_HEADERS_OVERFLOW`). O erro anterior
era convertido em uma lista vazia, fazendo a tela e alguns PDFs parecerem não
ter nenhuma OS.

## Comportamento anterior

O DAL buscava primeiro todos os `service_order_id` vinculados ao funcionário e
depois aplicava `service_orders.id.in(...)` em consultas independentes para:

- ordens abertas ou em andamento;
- ordens concluídas paginadas;
- ordens concluídas destinadas ao PDF.

Para Joe, a URL de algumas consultas passava de 15 mil caracteres. Quando a
requisição falhava, os dados nulos eram tratados como uma coleção vazia. Isso
ocultava a falha técnica e impedia a visualização ou a exportação esperada.

## Implementação atual

Quando `cleaningStaffId` está presente, as três consultas usam a relação
PostgREST:

```text
assignment_filter:service_order_cleaning_staff!inner(profile_id)
```

O predicado é aplicado em `assignment_filter.profile_id`. A relação
`cleaning_staff:profiles!service_order_cleaning_staff(id, full_name)` continua
separada para preservar todos os membros da equipe, mesmo quando apenas um
deles é usado como critério do filtro.

As consultas agora verificam explicitamente seus erros. Uma falha não é mais
apresentada como “nenhuma OS”; ela propaga para a tela de erro com a opção de
tentar novamente. A paginação comum também passou a aceitar o nome do parâmetro
de página: a tela de Ordens de Serviço usa `donePage`, enquanto outras telas
continuam usando `page`.

## Invariantes preservados

- `cleaningStaffId` continua sendo o endereço do filtro na URL.
- A fonte das atribuições continua sendo
  `service_order_cleaning_staff`, e não a coluna legada
  `service_orders.cleaning_staff_id`.
- A filtragem é aplicada às listas ativas, às concluídas e aos PDFs.
- A equipe completa permanece visível em uma OS com múltiplos funcionários.
- O PDF de concluídas recebe todos os registros filtrados, mesmo quando a tela
  exibe uma página de 20 itens.
- Não houve alteração de banco, dados, políticas RLS, autenticação ou Storage.

## Validação

Os relatórios detalhados registram as evidências das etapas:

- [Referência e diagnóstico inicial](../service-orders-joe-filter-baseline-2026-09-16.md)
- [Verificação técnica da etapa 4](../service-orders-joe-filter-stage-4-verification-2026-09-16.md)
- [Homologação autenticada da etapa 5](../service-orders-joe-filter-stage-5-homologation-2026-09-16.md)

Na homologação local, Joe retornou 9 OS abertas em 18/09, 5 concluídas em
16/09 e 330 concluídas sem recorte de data. Os PDFs correspondentes foram
gerados. Andy, Joe 02, filtros combinados, a OS compartilhada nº 691 e a
paginação das concluídas também foram conferidos.

As verificações automatizadas passaram:

- `npm test`: 36 arquivos e 226 testes;
- `npm run lint`;
- `npm run typecheck`;
- `npm run build`;
- `git diff --check`.

## Implantação e rollback

O código ainda não foi publicado. A próxima etapa é publicar pelo fluxo
canônico do projeto, observar o CI e validar o comportamento em produção.

Como não há migração nem mudança persistente no banco, o rollback é de
aplicação: reimplantar a versão anterior e investigar a divergência. Nenhum
registro precisa ser revertido.

## Arquivos relacionados

- Consulta e erros: `lib/server/data-access/service-orders.ts`.
- Testes do DAL: `lib/server/data-access/service-orders.test.ts` e
  `test/fake-supabase.ts`.
- Estado dos filtros e paginação: `components/service-orders/ServiceOrderList.tsx`
  e `components/ui/Pagination.tsx`.
- Contrato operacional atual: [`docs/service-orders.md`](../service-orders.md).
- Modelo de múltiplas atribuições: [ADR 009](../decisions/009-multiplos-funcionarios-limpeza-na-os.md).
