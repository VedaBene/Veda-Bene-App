# Remediação de chave Supabase legada exposta

**Data:** 2026-08-07  
**Estado:** remediado; chaves legadas desabilitadas  
**Escopo:** Supabase, Coolify, script de manutenção e histórico Git

## Resumo

Uma chave Supabase legada com privilégio `service_role` foi encontrada escrita
diretamente em `scripts/recalculate-pending-prices.mjs`. A credencial permitia
acesso administrativo ao projeto e bypass de Row Level Security enquanto as
chaves JWT legadas permanecessem habilitadas.

O valor da credencial não é reproduzido neste documento.

## Origem e finalidade

O arquivo foi criado no commit `a4b8df7` como um script pontual de reconciliação
de preços. Ele busca ordens de serviço com `total_price` nulo, calcula o valor
conforme a modalidade e persiste o resultado para os registros existentes.

O acesso privilegiado era funcionalmente útil porque uma manutenção abrangente
não deveria depender das permissões de um usuário comum. O erro foi incorporar
a credencial real ao código para tornar o script imediatamente executável. Não
existia necessidade técnica de armazená-la no repositório; o script poderia e
deveria ter lido o segredo de uma variável de ambiente server-side.

## Impacto

Uma chave `service_role` ignora as políticas RLS e possui amplo acesso aos dados.
Como o arquivo foi versionado e enviado ao repositório remoto, a credencial deve
ser considerada exposta mesmo que o repositório não seja público e mesmo depois
de removida do estado atual dos arquivos.

## Contenção e remediação

Foram realizadas as seguintes ações:

1. criação e adoção das novas chaves Supabase `sb_publishable_...` e
   `sb_secret_...`;
2. atualização das variáveis de ambiente no Coolify e novo deploy;
3. testes de autenticação e dos fluxos principais do aplicativo;
4. desativação das chaves JWT legadas `anon` e `service_role` no Supabase;
5. remoção da credencial literal do script de reconciliação;
6. alteração do script para exigir URL e chave secret por variáveis de ambiente;
7. documentação de regras obrigatórias de gestão de segredos em `AGENTS.md`.

Nenhum comando mutável, migration ou script de atualização de dados foi
executado como parte da limpeza da credencial.

## Validação

- O aplicativo continuou funcionando com as novas chaves após a desativação do
  legado.
- O arquivo atual não contém o JWT antigo nem outro JWT hardcoded.
- `node --check scripts/recalculate-pending-prices.mjs` foi aprovado.
- `npm run lint -- scripts/recalculate-pending-prices.mjs` foi aprovado.
- Arquivos `.env*` continuam ignorados pelo Git; somente `.env.example`, com
  placeholders, permanece versionado.

## Risco residual

A credencial revogada permanece nos commits históricos que descendem de
`a4b8df7`. Isso não restitui acesso enquanto as chaves legadas estiverem
desabilitadas. Contudo:

- as chaves legadas comprometidas não devem ser reativadas;
- uma eventual limpeza do histórico exige reescrita coordenada e `force push`;
- reescrever o histórico não substitui revogação, pois clones, caches e cópias
  externas podem continuar contendo o valor antigo.

## Prevenção de recorrência

- Segredos administrativos ficam somente em variáveis de ambiente server-side
  ou gerenciadores de segredos.
- Scripts de manutenção devem falhar quando as variáveis obrigatórias estiverem
  ausentes e nunca imprimir credenciais.
- Agentes não devem solicitar ou reproduzir valores secretos em chats.
- Diffs staged devem ser revisados à procura de segredos antes de commit e push.
- Recomenda-se adicionar secret scanning automatizado ao CI como barreira
  complementar às regras documentais.
