# Etapa 5 — homologação local do filtro de Joe

Executada em 16/09/2026 no código local, com uma sessão autenticada na aplicação
apontando ao Supabase configurado em `.env.local`. As verificações de OS foram
somente de leitura. Os totais são uma fotografia: estados e atribuições podem
mudar. Nenhuma OS, tabela, política ou dado foi alterado para este teste.

## Resultado na interface

| Funcionário | Data de limpeza | Abertas | Concluídas | Controle |
|---|---|---:|---:|---|
| Joe | 18/09/2026 | 9 | 0 | Nove IDs da referência da etapa 1; sem duplicação |
| Joe | 16/09/2026 | 0 | 5 | Cinco IDs da referência da etapa 1 |
| Andy | 18/09/2026 | 7 | 0 | Sete IDs da referência |
| Andy | 16/09/2026 | 0 | 3 | Três IDs da referência |
| Joe 02 | 18/09/2026 | 0 | 0 | Caso sem correspondência |
| Joe 02 | 16/09/2026 | 0 | 3 | Três IDs da referência |

Joe com data 18/09 e busca por imóvel “Marmorata” retornou uma OS; Joe com
check-in em 18/09 retornou seis. Filtrar Andy em 26/07 preservou ambos os
membros da equipe da OS 691, “Andy, Andy 02”. O endereço do filtro continuou
usando `cleaningStaffId`.

Sem data, Joe teve 52 OS ativas e 330 concluídas no momento do teste. As páginas
1 e 2 de concluídas exibiram 20 OS cada, sem ID em comum, e a contagem permaneceu
330. A homologação revelou uma falha anterior da paginação: o componente comum
criava links `page=2`, mas a tela de OS lê `donePage=2`. O componente agora
aceita o nome do parâmetro; a tela de imóveis mantém `page` e a de OS usa
`donePage`. O clique na página 2 foi repetido com sucesso após a correção.

## PDFs na sessão autenticada

O navegador embutido não expôs a janela criada por `window.open`. A verificação
foi repetida em Chromium de teste com login feito pelo usuário. A sessão foi
transferida somente em memória para um contexto de teste; nenhuma credencial,
cookie, HTML ou PDF com dados reais foi salvo em arquivo. O botão da interface
abriu o documento em cada caso e o Chromium gerou um PDF válido:

| PDF de Joe | OS no documento | Resultado |
|---|---:|---|
| Abertas em 18/09 | 9 | PDF válido |
| Concluídas em 16/09 | 5 | PDF válido |
| Concluídas sem data | 330 | PDF válido, mesmo com a tabela paginada |

O teste da etapa 4 já cobre a preservação da equipe completa no conteúdo do
gerador de PDF. A verificação de navegador acima confirma que o botão real
recebe e imprime as ordens filtradas.

## Verificações e publicação

- `npm test`: 36 arquivos, 226 testes aprovados.
- `npm run lint`, `npm run typecheck`, `npm run build` e `git diff --check`: aprovados.
- O primeiro servidor local ficou sem acesso à rede por restrição da sandbox e
  respondeu 500 ao login; a interface mostrou sua mensagem genérica de
  credenciais. Reiniciado com rede, o login respondeu 200. Isso não indicou
  senha incorreta nem exigiu mudança no produto.
- A publicação e o monitoramento pós-publicação ainda não foram realizados.
  `gh auth status` informou tokens inválidos para as contas locais. A produção
  canônica documentada é o Coolify; é preciso autenticar o acesso de publicação,
  passar pelo CI e observar o deploy antes de declarar a etapa concluída em
  produção. Nenhum commit ou push foi feito nesta homologação.
- Se a versão publicada divergir, reimplantar a versão anterior da aplicação e
  investigar. Não há mudança de banco nem dados a reverter.
