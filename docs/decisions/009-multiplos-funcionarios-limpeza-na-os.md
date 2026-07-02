# ADR 009 — Associação de Múltiplos Funcionários de Limpeza na Ordem de Serviço

**Status**: Aceita
**Data**: 2026-07-02

## Contexto

Atualmente, uma Ordem de Serviço (OS / Ordine di Lavoro) permite a vinculação de apenas um funcionário responsável pela limpeza do imóvel (`service_orders.cleaning_staff_id`). 

Entretanto, na operação diária, existem casos em que a limpeza é realizada por dois funcionários (com suporte planejado para até três ou mais). Isso exige uma mudança arquitetural para suportar o relacionamento de muitos-para-muitos (N-N) entre OS e funcionários de limpeza.

Essa alteração afeta diretamente:
1. O banco de dados e suas restrições de integridade.
2. A política de Row Level Security (RLS) que hoje garante que o prestador de serviço de limpeza só veja suas próprias OSs.
3. A regra de remuneração financeira ("A Pagar"), que atualmente soma as horas médias de limpeza dos imóveis concluídos por cada funcionário. Com múltiplos prestadores, o tempo médio do imóvel para aquela OS deve ser dividido igualmente entre todos os funcionários associados.

## Decisão

Recomendamos a transição para um relacionamento Many-to-Many utilizando uma tabela associativa intermediária:

1. **Criação da tabela associativa**:
   - Tabela: `public.service_order_cleaning_staff`
   - Colunas:
     - `service_order_id UUID REFERENCES public.service_orders(id) ON DELETE CASCADE`
     - `profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE`
     - `PRIMARY KEY (service_order_id, profile_id)`
   - Índices para performance:
     - Chave primária composta `(service_order_id, profile_id)` (otimiza busca por OS).
     - Índice composto `(profile_id, service_order_id)` (otimiza busca por funcionário, essencial para RLS).

2. **Estratégia de Depreciação e Transição de Dados**:
   - Criar uma migration que:
     - Crie a nova tabela e índices.
     - Migre os registros de `service_orders.cleaning_staff_id` existentes (não nulos) para a nova tabela associativa.
     - Marque a coluna `service_orders.cleaning_staff_id` como `DEPRECATED` em comentários do banco de dados, permitindo sua posterior remoção física quando todas as camadas do sistema estiverem integradas e testadas.

3. **Modificação das Policies de RLS (Row Level Security)**:
   - Substituir a verificação direta `cleaning_staff_id = auth.uid()` pelas seguintes validações:
     - **Service Orders (Select/Update)**: verificar se existe um registro na nova tabela associativa para o usuário atual.
       ```sql
       EXISTS (
         SELECT 1 FROM public.service_order_cleaning_staff socs
         WHERE socs.service_order_id = service_orders.id
           AND socs.profile_id = auth.uid()
       )
       ```
     - **Helper Privilegiado `private.staff_property_ids(uid)`**: atualizar para incluir os imóveis cujas OSs o usuário atual participou na limpeza através da tabela associativa.
     - **Profiles (Staff Peer Select)**: atualizar para que prestadores de limpeza/consegna continuem visualizando perfis de seus parceiros na mesma OS.

4. **Divisão Proporcional de Horas e Cálculo de Pagamento**:
   - Ajustar o pipeline financeiro em `lib/server/reporting/financial.ts` (especialmente `getPayableDetailRows`) para obter a contagem de funcionários de limpeza por OS e dividir o `avg_cleaning_hours` do imóvel por essa quantidade.
   - Atualizar a geração de relatórios (PDF e CSV) e o dashboard para usar esses dados proporcionais.

5. **Interface do Usuário (Web / Celular)**:
   - Substituir o único select de "Responsabile Pulizia" por um componente dinâmico que permita adicionar até 3 funcionários à OS, atendendo aos requisitos de usabilidade.

## Consequências

**Positivas**:
- **Escalabilidade**: O modelo N-N permite estender o número de funcionários associados para 3 ou mais sem alterar a estrutura do banco novamente.
- **Precisão Financeira**: Garante a divisão matemática justa e correta do tempo trabalhado, evitando faturamento duplicado ou subcompensação.
- **Normalização**: Elimina o acoplamento direto da tabela `service_orders` com um único funcionário de limpeza, alinhando o banco de dados com a realidade física das operações.

**Negativas**:
- **Complexidade de Consulta**: As consultas de OS precisarão de joins extras com a tabela intermediária ou subqueries.
- **Complexidade do Formulário**: Exige lógica frontend para manipulação de listas dinâmicas no estado do componente.
- **Performance RLS**: A utilização de subqueries com `EXISTS` em vez de igualdade direta pode ter um leve impacto de desempenho em consultas massivas. Esse risco é mitigado pela correta indexação composta.

### Ambiguidade de Relacionamento no PostgREST (Supabase)
> [!IMPORTANT]
> Devido à coexistência de múltiplos caminhos de relacionamento entre `service_orders` e `profiles` (através de `consegna_staff_id`, do campo legado `cleaning_staff_id` e da nova tabela associativa `service_order_cleaning_staff`), o mecanismo PostgREST do Supabase é incapaz de inferir implicitamente a junção para o campo de limpeza.
> 
> Qualquer requisição direta via SDK que solicite os dados do profile de limpeza **deve** referenciar explicitamente a relação intermediária usando a sintaxe de bang:
> ```typescript
> // Exemplo correto no SDK JS:
> supabase.from('service_orders').select(`
>   ...,
>   cleaning_staff:profiles!service_order_cleaning_staff(id, full_name)
> `)
> ```
> O não uso do sufixo `!service_order_cleaning_staff` resultará no erro **`PGRST201: Could not embed because more than one relationship was found`**, e a consulta retornará dados vazios.

## Alternativas consideradas

- **Alternativa A: Colunas denormalizadas (`cleaning_staff_id_1`, `cleaning_staff_id_2`, etc.)**:
  - *Vantagem*: Consultas simples sem joins.
  - *Desvantagem*: Estrutura rígida (se surgir a necessidade de 4 funcionários, o banco precisa mudar de novo), lógica de RLS extremamente verbosa (ter que verificar todas as colunas) e consultas complexas para agrupamentos financeiros. **Descartado.**
- **Alternativa B: Tratar as OSs com múltiplos funcionários como OSs separadas (duplicadas)**:
  - *Vantagem*: Sem mudanças no banco ou lógica de pagamento.
  - *Desvantagem*: Inconsistência de dados (duplicaria o imóvel, check-in, check-out, etc.), poluição visual do dashboard e desorganização da operação para a secretaria. **Descartado.**
