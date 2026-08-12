# Implantação — visibilidade das O.S. da equipe operacional

## Escopo e impacto

A regra vigente limita `limpeza` e `consegna` às ordens atribuídas com
`cleaning_date <= hoje`, calculado em `Europe/Rome`. Histórico e ordens
atrasadas permanecem disponíveis; datas nulas e datas de amanhã em diante são
ocultadas. `admin`, `secretaria` e `cliente` permanecem inalterados, e
`consegna` continua somente leitura.

As migrações incrementais são a base
`20260807193218_operational_staff_service_order_visibility.sql` e a restrição
vigente `20260812203455_restrict_operational_staff_visibility_to_today.sql`.
Em conjunto, elas:

- criam e atualizam `private.operational_staff_service_order_ids()`;
- redefine as policies de leitura de `service_orders` para Pulizia e Consegna;
- alinha a policy de atualização de Pulizia à mesma janela;
- restringe a leitura da tabela de vínculos `service_order_cleaning_staff`;
- alinha a visibilidade de colegas e imóveis ao mesmo escopo;
- não insere, atualiza nem exclui dados.

A aplicação anterior é compatível com a nova migração: ela receberá menos linhas
para os dois perfis operacionais, por força do RLS. A aplicação nova também é
compatível com o schema anterior, mas o go-live só deve ocorrer com a proteção
RLS aplicada, para não depender apenas do filtro do DAL.

## Pré-condições e locks

As migrações abortam de forma atômica se os objetos e contratos de autorização
esperados não estiverem presentes. A migração vigente exige explicitamente a
versão anterior do helper e da policy de atualização, e também aborta se existir
uma policy de atualização para Consegna.

São esperados locks curtos de catálogo nas funções e nas quatro tabelas cujas
policies são alteradas: `service_orders`, `service_order_cleaning_staff`,
`profiles` e `properties`. A transação usa `lock_timeout = 5s` e
`statement_timeout = 60s`; qualquer contenção acima desse limite deve abortar a
implantação para reagendamento, não justificar aumento automático do timeout.

## Invariantes de dados

Antes e depois do ensaio e da implantação, registrar e comparar:

```sql
SELECT 'service_orders' AS object, count(*) AS rows,
       count(DISTINCT id) AS distinct_keys FROM public.service_orders
UNION ALL
SELECT 'service_order_cleaning_staff', count(*),
       count(DISTINCT (service_order_id, profile_id))
FROM public.service_order_cleaning_staff
UNION ALL
SELECT 'profiles', count(*), count(DISTINCT id) FROM public.profiles
UNION ALL
SELECT 'properties', count(*), count(DISTINCT id) FROM public.properties;
```

Todas as contagens e chaves distintas devem permanecer idênticas, pois a
migração não modifica linhas. Também executar
`supabase/tests/operational_staff_visibility_invariants.sql` após a migração.

## Matriz mínima de autorização

Em banco descartável ou cópia isolada, testar pela Data API autenticada:

| Perfil e vínculo | Ontem | Hoje | Amanhã | Depois de amanhã | Data nula |
|---|---:|---:|---:|---:|---:|
| Pulizia atribuída | permite | permite | bloqueia | bloqueia | bloqueia |
| Pulizia não atribuída | bloqueia | bloqueia | bloqueia | bloqueia | bloqueia |
| Consegna atribuída | permite leitura | permite leitura | bloqueia | bloqueia | bloqueia |
| Consegna não atribuída | bloqueia | bloqueia | bloqueia | bloqueia | bloqueia |

Para cada caso, validar lista, consulta direta por ID, vínculos de equipe,
detalhe/fotos e ações. Pulizia deve poder iniciar/finalizar apenas dentro do seu
escopo; Consegna deve falhar em qualquer tentativa de atualização. Repetir a
regressão com `admin`, `secretaria` e `cliente`, além da virada do dia e das duas
transições anuais de horário de verão de Roma.

## Implantação e critérios de decisão

1. Revisar humanamente a migração e o diff do schema.
2. Executar toda a cadeia de migrações desde o baseline em banco descartável.
3. Ensaiar em cópia recente e isolada, registrar as invariantes e executar a
   matriz de autorização.
4. Confirmar backup recente, restauração ensaiada, responsável e janela de
   observação.
5. Executar `supabase db push --dry-run` e comparar o histórico remoto.
6. Solicitar autorização explícita e específica antes de qualquer execução no
   Supabase de produção.
7. Aplicar schema primeiro, repetir invariantes e smoke tests, depois publicar a
   aplicação.
8. Observar erros de autorização e suporte operacional dos dois perfis. Qualquer
   divergência de dados, policy ou papel bloqueia o avanço.

## Rollback não destrutivo

Não remover o helper, policies, tabelas ou dados. Em caso de falha:

1. conter o acesso e reimplantar uma versão da aplicação compatível;
2. preservar o schema e todas as evidências;
3. aplicar uma nova migração progressiva que restaure temporariamente as
   expressões anteriores das policies afetadas;
4. revalidar a matriz completa antes de uma nova tentativa.

Esse rollback requer a mesma revisão e autorização específica de produção. Não
usar reset, `DROP`, exclusão de registros ou reversão destrutiva.
