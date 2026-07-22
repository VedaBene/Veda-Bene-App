<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:veda-bene-evolution-rules -->
# Strategic evolution history

`docs/evolution/` records the completed staged technical evolution of this
project. Do not read the full folder for routine feature, UI, copy, or small bug
tasks.

Read `docs/evolution/README.md` only when the user asks about that evolution
history or when work touches the evolved architecture areas: DAL/data access,
authorization/validation, service orders, reporting/exports/dashboard,
Supabase/Postgres/RLS, privileged helpers/RPCs, or the documented stage records.
<!-- END:veda-bene-evolution-rules -->

<!-- BEGIN:timezone-rules -->
# Timezone de Referência do Sistema

Qualquer rotina, helper, utilitário ou componente do frontend que manipule, compare ou formate datas e horas deve utilizar obrigatoriamente o timezone da Itália: `Europe/Rome`.
- Não force fuso UTC para exibições e relatórios (como em formatadores de strings de data/hora do PDF e da tela).
- Converta timestamps TIMESTAMPTZ de forma explícita especificando `{ timeZone: 'Europe/Rome' }`.
- O relógio de cabeçalho (`DateTimeDisplay.tsx`) deve usar `useSyncExternalStore`: o snapshot de servidor retorna `null` para preservar o placeholder na hidratação e o snapshot do cliente atualiza a cada segundo. Não use uma flag `mounted` atualizada sincronicamente em `useEffect`, pois isso viola a regra `react-hooks/set-state-in-effect`.
- Filtros e sincronização de estado (`ServiceOrderList.tsx`): Não utilize `useEffect` para espelhar props de URL (`initialQ`, etc.) no estado local. Faça a sincronização durante a fase de renderização comparando a prop anterior com a atual para evitar loops de navegação reentrante e estouro de pilha (`RangeError` / `JAVASCRIPT-NEXTJS-F`).
- Proteção contra Tradução Automática e Autofill (Google Translate / Navegador): Em componentes de formulários, tabelas e listas (`Input.tsx`, `LoginPage`, `ServiceOrderListTable.tsx`), envolva textos dinâmicos em tags `<span>` para evitar exceções DOM (`NotFoundError` / `JAVASCRIPT-NEXTJS-G` / `JAVASCRIPT-NEXTJS-5`) quando o navegador modifica nós da árvore do React.
- Limite de Chave para Hooks Condicionais (Key Boundaries): Em listas e tabelas (`ServiceOrderListTable.tsx`), elementos renderizados condicionalmente que possuem hooks internos (como `LiveTimer.tsx`) devem possuir delimitadores `key` explícitos para evitar colisões de contagem de hooks na reconciliação do React 19 (`JAVASCRIPT-NEXTJS-C`).
<!-- END:timezone-rules -->

<!-- BEGIN:git-rules -->
# Regra de Controle de Versão (Git)

- **Nunca faça `git commit` ou `git push` automaticamente.**
- Realize as modificações, implementações e testes necessários no código localmente.
- Execute comandos de `git commit` ou `git push` **apenas quando o usuário solicitar expressamente**.
<!-- END:git-rules -->

<!-- BEGIN:production-data-safety-rules -->
# Regra Absoluta de Integridade dos Dados de Produção

- Durante desenvolvimento, manutenção, correções, refatorações e migrações, a preservação integral dos dados existentes em produção tem prioridade sobre qualquer entrega ou prazo.
- É proibido usar scripts, migrações ou comandos de manutenção destrutivos em produção, incluindo `DROP TABLE`, `DROP SCHEMA`, `DROP DATABASE`, `TRUNCATE`, exclusão de dados, recriação/reset do banco e `supabase db reset --linked`.
- Toda evolução do banco deve usar migrações incrementais, aditivas, compatíveis com a versão anterior da aplicação e preservadoras dos dados existentes.
- Antes de qualquer alteração de banco, é obrigatório documentar análise de impacto, pré-condições, invariantes verificáveis, testes, estratégia de implantação e rollback não destrutivo.
- O rollback padrão de banco é desativar a funcionalidade, reimplantar uma versão compatível e aplicar uma correção progressiva. Não remover tabelas, colunas, buckets ou registros para reverter uma entrega.
- Esta regra não altera funcionalidades CRUD nem ações de usuários/administradores previstas nas regras de negócio. Exclusões autorizadas pela aplicação permanecem válidas e devem conservar seus controles de autenticação, autorização e auditoria existentes.
- Uma operação destrutiva só pode ser considerada como exceção extrema, com justificativa técnica escrita, aprovação prévia e expressa do responsável pelo projeto, backup confirmado, restauração ensaiada em ambiente isolado e validação pós-operação. Sem todos esses requisitos, a operação permanece proibida.
- Nunca aplique migração, comando SQL mutável ou alteração de Storage no Supabase de produção sem autorização explícita e específica do usuário para essa execução.
- Consulte `docs/production-data-safety.md` antes de alterar schema, dados, RLS, funções, triggers, grants, buckets ou políticas de Storage.
<!-- END:production-data-safety-rules -->
