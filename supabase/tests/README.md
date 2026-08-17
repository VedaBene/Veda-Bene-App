# Testes locais de autorização do Supabase

Esta pasta contém testes executados somente em uma instância Supabase local e
descartável. O runner cria uma cópia temporária de `supabase/`, atribui um
`project_id` exclusivo, reconstrói o banco desde todas as migrations e remove
apenas essa instância ao terminar. Ele nunca usa `--linked`, remove variáveis de
acesso remoto do subprocesso e aceita URLs de banco somente em loopback.

## Pré-requisitos

- Node.js 22 ou superior;
- dependências instaladas com `npm ci` ou `npm install`;
- Docker Desktop (ou runtime compatível) em execução.

## Execução

```bash
npm run test:supabase
```

O comando executa, nesta ordem:

1. `supabase start` em projeto temporário e exclusivo;
2. `supabase db reset --local --no-seed` desde o baseline de migrations;
3. `supabase test db --local` para a matriz pgTAP em `tests/database/`;
4. os invariantes existentes de visibilidade operacional e formatos de foto;
5. o bootstrap histórico de fotos, suas duas migrations e o respectivo
   invariante em um segundo banco temporário;
6. `supabase stop --no-backup` somente para o `project_id` temporário.

Todos os dados dos testes usam UUIDs reservados e endereços
`example.invalid`; nenhum dado ou segredo de produção é necessário.

## Estado atual e estado-alvo

- `authorization_matrix_current.test.sql` comprova o comportamento efetivo de
  RLS, grants, updates e chamadas diretas para `admin`, `secretaria`, `limpeza`,
  `consegna` e `cliente`. Brechas conhecidas aparecem como `[KNOWN UNSAFE]`.
- `authorization_matrix_target.test.sql` mantém as garantias desejadas como
  `[TARGET][OPEN GAP]` e TODOs explícitos do pgTAP. Assim a vulnerabilidade não
  vira contrato aceito; os TODOs devem ser removidos somente quando as Sprints
  04 e 05 implementarem e comprovarem o bloqueio real.

### Matriz caracterizada

| Papel | `profiles` | `properties` | `service_orders` | Update de O.S. | Brecha sensível observada |
|---|---|---|---|---|---|
| `admin` | todas as linhas | todas as linhas | todas as linhas | permitido | acesso administrativo esperado |
| `secretaria` | todas as linhas | todas as linhas | todas as linhas | permitido | lê diretamente remuneração, preços e `total_price` |
| `limpeza` | próprio perfil/colegas autorizados | imóveis de O.S. atribuídas até hoje | O.S. atribuídas até hoje | permitido no escopo, sem limite de colunas | lê preços/remuneração e altera `total_price` diretamente |
| `consegna` | próprio perfil/colegas autorizados | imóveis de O.S. atribuídas até hoje | O.S. atribuídas até hoje | bloqueado | lê diretamente preços, remuneração e `total_price` |
| `cliente` | próprio perfil | próprios imóveis | O.S. dos próprios imóveis | bloqueado | lê diretamente preços, remuneração e `total_price` |

Chamadas diretas da RPC privilegiada `get_top_properties` são testadas e
bloqueadas para os cinco papéis. A tentativa de `limpeza` ampliar o helper
privado com o UUID de outro usuário também retorna conjunto vazio.

Este comando é DB-L. Não o adapte para `--linked`, não forneça variáveis de
produção e não use a suíte contra um banco remoto.
