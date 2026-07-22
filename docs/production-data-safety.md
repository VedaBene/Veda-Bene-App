# Segurança e integridade dos dados de produção

## Regra absoluta

A preservação integral dos dados existentes no ambiente de produção tem
prioridade sobre funcionalidade, prazo, conveniência operacional e simplificação
técnica. Se a segurança de uma alteração não puder ser demonstrada antes da
execução, a alteração não deve ser aplicada.

Backups reduzem o impacto de um incidente, mas não autorizam uma migração
destrutiva. O objetivo principal continua sendo não precisar restaurar.

## Escopo da regra

Esta política se aplica exclusivamente ao processo técnico de desenvolvimento,
manutenção, correção, refatoração, implantação e migração do banco de dados. Ela
não redefine funcionalidades CRUD nem proíbe ações de usuários ou
administradores previstas nas regras de negócio.

Se a aplicação permite cancelar uma O.S., excluir um registro ou executar outra
operação autorizada, esse comportamento permanece válido. Essas ações continuam
sujeitas aos controles normais de autenticação, autorização, confirmação e
auditoria do produto, mas não são consideradas migrações destrutivas por esta
política.

## Operações técnicas proibidas em produção

Sem o processo excepcional descrito abaixo, é proibido:

- executar `DROP TABLE`, `DROP SCHEMA`, `DROP DATABASE` ou `TRUNCATE`;
- apagar registros ou objetos do Storage como forma de migração ou rollback;
- recriar, resetar ou restaurar por cima do banco de produção;
- executar `supabase db reset --linked` contra produção;
- remover colunas ou alterar tipos de forma incompatível com dados existentes;
- substituir silenciosamente estruturas, constraints, policies, grants ou
  configuração de buckets quando o estado encontrado divergir do esperado;
- incluir seed de desenvolvimento em uma implantação de produção;
- executar SQL mutável ou aplicar migração sem autorização explícita e
  específica para aquela execução.

Alterações de dados eventualmente necessárias devem ser tratadas como migrações
de dados: idempotentes, limitadas, auditáveis, testadas sobre uma cópia isolada e
com validações antes e depois. Exclusão de dados não é aceita como rotina de
implantação.

## Padrão obrigatório de evolução

1. **Expandir**: adicionar tabelas, colunas, índices ou regras sem remover nem
   reinterpretar estruturas usadas pela versão atual.
2. **Validar**: testar a cadeia completa de migrações em banco descartável e em
   ambiente que represente o schema real de produção.
3. **Implantar desativado**: manter a nova funcionalidade protegida por flag
   quando isso reduzir acoplamento entre schema e aplicação.
4. **Aplicar schema primeiro**: a migração deve ser compatível com a aplicação
   anterior e executada em transação curta, com limites de espera por lock.
5. **Publicar aplicação compatível**: executar testes autenticados e a matriz de
   autorização antes de habilitar a funcionalidade.
6. **Habilitar gradualmente**: ativar somente após invariantes e observabilidade
   confirmarem o estado esperado.
7. **Contrair apenas por processo separado**: remoções de legado não fazem parte
   da entrega que o substitui e continuam sujeitas à proibição de destruição em
   produção, salvo exceção formal.

Migrações devem falhar de forma atômica quando encontrarem schema inesperado.
Não devem mascarar divergências com `IF EXISTS`, `IF NOT EXISTS` ou upsert quando
isso puder aceitar ou sobrescrever uma estrutura incompatível.

## Análise obrigatória antes de alterar o banco

Cada mudança deve registrar:

- motivo, escopo e objetos afetados;
- comandos exatos da migração e confirmação de que não alteram registros
  existentes, salvo migração de dados explicitamente aprovada;
- versão mínima e máxima da aplicação compatíveis com o schema novo;
- locks esperados, duração estimada e limites de `lock_timeout` e
  `statement_timeout`;
- pré-condições do schema e ausência de drift;
- invariantes de dados a medir antes e depois, incluindo no mínimo contagem de
  linhas e unicidade das chaves das tabelas críticas afetadas;
- testes unitários, integração, RLS/roles, Storage e ponta a ponta aplicáveis;
- plano de implantação, observação, go/no-go e responsáveis;
- rollback não destrutivo e estratégia de correção progressiva.

## Barreiras obrigatórias para produção

Uma migração só pode avançar quando todos os itens abaixo estiverem comprovados:

1. revisão humana do SQL e do `supabase db push --dry-run`;
2. comparação entre histórico de migrações e schema real de produção;
3. execução limpa desde o baseline em banco descartável;
4. ensaio sobre cópia isolada recente e representativa de produção, com dados
   pessoais removidos ou acesso estritamente controlado;
5. backup recente confirmado e restauração ensaiada em ambiente isolado;
6. status de backups diários e/ou PITR verificado no plano atual do Supabase;
7. medições pré-migração salvas para as invariantes definidas;
8. janela de manutenção, monitoramento e responsável disponíveis;
9. aplicação anterior confirmada como compatível com o schema expandido;
10. autorização explícita do responsável pelo projeto para aplicar a migração;
11. medições pós-migração idênticas para todos os dados que não deveriam mudar;
12. teste funcional e de autorização com a funcionalidade ainda desativada.

Qualquer divergência, backup não confirmado, restauração não ensaiada ou resultado
inconclusivo bloqueia a implantação.

## Rollback padrão: não destrutivo

O rollback de uma funcionalidade deve, nesta ordem:

1. desativar a feature flag ou bloquear o novo caminho de escrita;
2. reimplantar a última versão compatível da aplicação;
3. preservar tabelas, colunas, registros, buckets e objetos já criados;
4. conter acesso se houver suspeita de exposição, sem excluir evidências ou dados;
5. corrigir o problema com uma nova migração progressiva;
6. revalidar e reativar somente após nova aprovação.

Scripts chamados de rollback não podem remover dados ou schema em produção. Uma
reversão destrutiva que pareça segura porque a tabela está vazia também é
proibida: o estado pode mudar entre a verificação e a execução, e a remoção reduz
a compatibilidade entre versões.

## Exceção extrema

Uma operação destrutiva só pode ser considerada quando não existir alternativa
técnica preservadora e todos os requisitos seguintes estiverem atendidos:

- justificativa escrita com alternativas rejeitadas e raio de impacto;
- aprovação prévia e expressa do responsável pelo projeto;
- inventário exato dos dados e objetos afetados;
- backup independente, recente e verificado;
- restauração completa ensaiada em ambiente isolado e tempo de recuperação
  conhecido;
- plano de manutenção, comunicação, validação e abortagem;
- dupla revisão dos comandos e execução acompanhada;
- auditoria pós-operação comprovando integridade.

Sem qualquer um desses itens, a operação permanece proibida.

## Aplicação à funcionalidade de fotos

A migration de fotos deve apenas adicionar `service_orders.cleaning_cycle`, a
tabela `service_order_photos`, índices, RLS e o bucket privado. Ela não altera nem
remove Ordens de Serviço existentes. A versão anterior da aplicação ignora esses
objetos e continua compatível.

O rollback é feito com `CLEANING_PHOTOS_ENABLED=false` e reimplantação de uma
versão compatível. A tabela, a coluna, o bucket e todas as imagens permanecem
preservados. O script em `supabase/rollback/` é apenas uma contenção emergencial
de acesso e não apaga nenhuma estrutura ou registro.
