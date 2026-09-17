# Referência da etapa 1 — filtro de ordens de serviço por funcionário

Levantamento somente de leitura feito em 16/09/2026, aproximadamente 23:44 UTC
(17/09/2026, 01:44 em `Europe/Rome`), no projeto Supabase usado pela aplicação.
Esta é uma fotografia dos dados, não uma expectativa de que as ordens continuem
com os mesmos estados ou datas. Nenhum dado de produção ou código da aplicação
foi alterado nesta etapa.

## Como comparar

- Fonte das atribuições: `service_order_cleaning_staff.profile_id` e
  `service_order_cleaning_staff.service_order_id`.
- Consulta atual: busca todos os IDs vinculados ao funcionário e os envia em
  `service_orders.id.in(...)`. As consultas de abertas, concluídas paginadas e
  concluídas para PDF são independentes.
- Consulta candidata: filtra por
  `assignment_filter:service_order_cleaning_staff!inner(profile_id)`, mantendo
  separada a relação `cleaning_staff` usada para exibir toda a equipe.
- As consultas de API abaixo usaram a credencial de servidor em ambiente local,
  apenas para leitura. Esse contexto não reproduz a sessão e a RLS de um usuário
  autenticado na interface; a homologação posterior deve incluir a interface.
- Os recortes foram: abertas/em andamento com `cleaning_date=2026-09-18` e
  concluídas com `cleaning_date=2026-09-16`, página 1 de 20.

## Volumes no momento do levantamento

| Funcionário | ID do perfil | Vínculos de limpeza | Abertas/em andamento, todas as datas | Concluídas, todas as datas | Vínculos em que também é `cleaning_staff_id` |
|---|---|---:|---:|---:|---:|
| Joe | `2b5d039a-76f1-4b8a-9730-5b7222c3cb8c` | 382 | 52 | 330 | 11 |
| Andy | `74484453-b554-4184-9b47-7af3d82443d8` | 151 | 43 | 108 | 12 |
| Joe 02 | `9c1b4dc2-884a-47e3-9035-c28a36d501e5` | 141 | 2 | 139 | 2 |

Joe é o perfil com mais vínculos de limpeza neste levantamento; o próximo tem
151. A coluna legada `cleaning_staff_id` não representa todos os responsáveis:
371 dos 382 vínculos de Joe não têm Joe nessa coluna. Qualquer substituição por
um filtro apenas nessa coluna descartaria atribuições válidas.

## Resultado dos recortes

| Funcionário | Recorte | Consulta atual exata | Consulta relacional | Conferência |
|---|---|---|---|---|
| Joe | Abertas/em andamento, 18/09 | Falha `UND_ERR_HEADERS_OVERFLOW`, resposta da biblioteca com status 0 | 9 ordens, HTTP 200 | A lista sem filtro devolveu 24 ordens, incluindo as mesmas 9 com Joe na equipe exibida |
| Joe | Concluídas paginadas, 16/09 | Falha `UND_ERR_HEADERS_OVERFLOW`, status 0 | 5 ordens, contagem 5, HTTP 200 | Joe aparece na equipe das 5 |
| Andy | Abertas/em andamento, 18/09 | 7 ordens, HTTP 200 | As mesmas 7, HTTP 200 | IDs iguais e Andy na equipe das 7 |
| Andy | Concluídas paginadas, 16/09 | 3 ordens, contagem 3, HTTP 200 | As mesmas 3, contagem 3, HTTP 200 | IDs iguais e Andy na equipe das 3 |
| Joe 02 | Abertas/em andamento, 18/09 | 0 ordens, HTTP 200 | 0 ordens, HTTP 200 | Caso sem correspondência |
| Joe 02 | Concluídas paginadas, 16/09 | 3 ordens, contagem 3, HTTP 200 | As mesmas 3, contagem 3, HTTP 200 | IDs iguais e Joe 02 na equipe das 3 |

Na consulta atual exata de Joe, a URL das abertas tinha 15.590 caracteres e a
da página de concluídas 15.588. Remover a ordenação encurtou a URL das abertas
para 15.555 caracteres e essa variante retornou as 9 ordens. A consulta
relacional equivalente usou cerca de 800 caracteres. Portanto, o limite é
sensível até a pequenas diferenças na consulta. A consulta separada de
concluídas para PDF em 16/09 tinha 15.570 caracteres e retornou 5 ordens mesmo
quando a página de concluídas falhou.

## IDs de referência

Os números de ordem facilitam a conferência visual; os UUIDs permitem comparação
exata entre consultas. Não incluem nomes de clientes ou imóveis.

| Funcionário | Recorte | Nº da OS | ID da OS |
|---|---|---:|---|
| Joe | Aberta 18/09 | 1990 | `81b82304-6c30-433c-80e4-88a00b380549` |
| Joe | Aberta 18/09 | 1974 | `bb266f21-928e-4c5c-ab2c-1a33f8068c13` |
| Joe | Aberta 18/09 | 1955 | `d67d2f45-2257-4f49-a849-43c046c207d6` |
| Joe | Aberta 18/09 | 1976 | `d5c0ebca-49fa-4fe0-982d-be20555ae356` |
| Joe | Aberta 18/09 | 1983 | `d679dbe4-8a52-435a-80b9-a59b9b40e678` |
| Joe | Aberta 18/09 | 1986 | `9d895910-02cf-440f-9954-e1195ed7cd69` |
| Joe | Aberta 18/09 | 1991 | `82569cad-cabc-4e59-99ea-90555db4e1f5` |
| Joe | Aberta 18/09 | 1992 | `424c5711-d8d0-466e-9e9b-e91cb057a51e` |
| Joe | Aberta 18/09 | 1994 | `73853615-1168-419d-acbf-a24463dc12dc` |
| Joe | Concluída 16/09 | 1901 | `c5b4f804-2db8-4ddd-9488-844c92cf1e2e` |
| Joe | Concluída 16/09 | 1903 | `b037ce9d-1b0b-4d91-8dcc-a3a6b2bdd53d` |
| Joe | Concluída 16/09 | 1923 | `289f1363-41b7-476f-87f0-2e5989915037` |
| Joe | Concluída 16/09 | 1920 | `90f4be34-04e1-42dd-b65c-04d6cefb3fbe` |
| Joe | Concluída 16/09 | 1733 | `4c454608-54c3-40e0-875e-c4274fb68892` |
| Andy | Aberta 18/09 | 1993 | `3e0d37e7-9dd0-4443-9eb3-a0c43195cdfd` |
| Andy | Aberta 18/09 | 1978 | `b589d195-4e2d-4f35-ae40-532703e17f36` |
| Andy | Aberta 18/09 | 1980 | `c810b0ba-cf47-414b-9480-53a975021098` |
| Andy | Aberta 18/09 | 1981 | `de157633-777a-4341-953b-1792dc4bd765` |
| Andy | Aberta 18/09 | 1984 | `f9b866ae-91d4-41ad-900e-d2e021fc7886` |
| Andy | Aberta 18/09 | 1985 | `2ce23f41-e54c-4de4-ae38-82ad669d191d` |
| Andy | Aberta 18/09 | 1987 | `18ad5714-d163-4776-b507-7109b77b157f` |
| Andy | Concluída 16/09 | 1924 | `2b2ad582-1f29-4031-95c7-641e1655ff3d` |
| Andy | Concluída 16/09 | 1882 | `eb434688-beb8-4b9c-a491-f7592bc6fd91` |
| Andy | Concluída 16/09 | 1897 | `e2145c97-8c8a-4282-83f4-281db6d9dec5` |
| Joe 02 | Concluída 16/09 | 1926 | `abe6fb0c-0ac1-4194-acb9-724c3054efd6` |
| Joe 02 | Concluída 16/09 | 1922 | `12ca2874-24f1-428c-bcd2-08f77194308c` |
| Joe 02 | Concluída 16/09 | 2080 | `3c2e46c8-2502-4b1e-8d1b-c53038d0736f` |

## Equipe múltipla e PDF

A OS 691 (`ff0f5649-cc21-4743-9038-7ad5e983fa0b`, concluída em 26/07/2026)
tem Andy e Andy 02. Tanto a consulta sem filtro quanto a candidata filtrada por
Andy devolveram os dois nomes em `cleaning_staff`. Isso é um controle para a
próxima etapa: filtrar um membro não pode reduzir a equipe exibida ao membro
filtrado.

O PDF de abertas recebe as mesmas ordens da lista de abertas; quando essa
consulta falha e o erro é tratado como lista vazia, o PDF também recebe uma
lista vazia. O PDF de concluídas usa outra consulta: em 16/09 ela retornou 5
ordens para Joe apesar de a página de concluídas falhar. Assim, a falha pode
afetar lista e exportação de maneiras diferentes conforme o recorte.

## Critério para seguir

Não houve divergência de IDs entre os dois métodos nos controles em que o filtro
atual respondeu, nem entre atribuição e equipe exibida nos recortes verificados.
Antes de implementar ou homologar as próximas etapas, conferir novamente esses
recortes, pois status, datas e atribuições podem mudar em produção. A mudança
de código deve preservar a relação de equipe completa e tornar erros de consulta
visíveis, sem trocar o filtro pelo campo legado `cleaning_staff_id`.
