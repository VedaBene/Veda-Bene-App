# Etapa 4 — verificação do filtro de ordens por funcionário

Verificação feita em 16/09/2026 sobre o código local das etapas 2 e 3. As
consultas ao Supabase de produção foram **somente de leitura**. Os números abaixo
são uma fotografia dos dados; ordens podem mudar de estado ou atribuição.
Nenhum dado, esquema ou política do banco foi alterado, e o código não foi
implantado.

## Comparação das consultas

A consulta relacional foi comparada, por ID de OS, com a lista sem filtro no
mesmo recorte, selecionando localmente as OS cuja equipe contém o funcionário.
Todos os recortes abaixo tiveram IDs iguais e nenhuma OS duplicada.

| Funcionário | Abertas/em andamento em 18/09 | Concluídas em 16/09 |
|---|---:|---:|
| Joe | 9 | 5 |
| Andy | 7 | 3 |
| Joe 02 | 0 | 3 |

Combinações adicionais para Joe, sempre com os mesmos IDs da lista sem filtro
após aplicar os critérios equivalentes:

| Combinação | OS encontradas |
|---|---:|
| Data de limpeza 18/09 + busca por imóvel | 1 |
| Data de limpeza 18/09 + funcionário de entrega | 9 |
| Check-in em 18/09 no horário de Roma | 6 |

A consulta de todas as concluídas de Joe retornou 330 OS no momento da
verificação. As páginas 1 e 2 retornaram 20 OS cada, sem sobreposição entre
elas; ambas informaram contagem total de 330, igual à lista de exportação. A OS
compartilhada nº 691 manteve os mesmos dois membros da equipe na consulta com
e sem filtro por Andy.

Essas chamadas usaram a credencial de servidor para leitura. Portanto, validam
o formato e o resultado das consultas, mas não reproduzem a sessão de um usuário
autenticado nem suas políticas de acesso na interface.

## Caminho do PDF

O teste de integração passa o resultado filtrado da camada de dados ao gerador
de HTML do PDF. Ele confirma que a OS compartilhada traz os dois nomes, exclui
uma OS atribuída apenas a Andy do PDF de Joe e usa todas as concluídas para o
PDF mesmo quando a tabela exibe uma única página.

Um documento **sintético**, sem dados de clientes ou imóveis reais, foi impresso
com Chromium e inspecionado visualmente: 9 OS em uma página A4 horizontal, equipe
"Andy, Joe" presente, totais e colunas legíveis. O texto extraído do PDF
continha as nove OS. Os arquivos temporários foram removidos após a inspeção.

## Verificações do projeto

- `npm test`: 36 arquivos e 226 testes aprovados.
- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.
- `git diff --check`: aprovado.

## Limite desta etapa e homologação

Não havia aba ou sessão autenticada local disponível para verificar o clique no
filtro e na impressão dentro da aplicação com o código novo. Na homologação,
abrir a aplicação local ou de teste como administrador/secretaria, filtrar Joe
em 18/09 e 16/09, conferir as OS exibidas e abrir os PDFs de abertas e
concluídas. Repetir com Andy e Joe 02 e conferir a OS compartilhada. Só depois
decidir pela publicação do código.
