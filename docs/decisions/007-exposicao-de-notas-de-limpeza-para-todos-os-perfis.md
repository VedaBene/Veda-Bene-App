# ADR 007 — Exposição de Notas de Limpeza para Todos os Perfis

**Status**: Aceita
**Data**: 2026-05-22

## Contexto

Originalmente, as notas de limpeza (`cleaning_notes` na tabela `service_orders`) eram restritas às roles administrativas (`admin` e `secretaria`). No entanto, essas anotações contêm instruções operacionais fundamentais (ex: pontos de atenção sobre móveis frágeis, indicações especiais do cliente) necessárias para a correta execução do serviço de limpeza. Por isso, tais observações são de interesse direto de todos os perfis do fluxo:
- **`limpeza` e `consegna`**: precisam ler as anotações para guiar suas tarefas diárias.
- **`cliente`**: precisa ler as anotações para validar as orientações fornecidas ao imóvel.
- **`admin` e `secretaria`**: continuam como os gestores e criadores destas ordens de serviço.

## Decisão
 
 1. **Camada de Dados (Supabase RLS & DTOs)**:
    - A Row Level Security (RLS) da tabela `service_orders` já restringe o acesso de leitura a linhas inteiras.
    - O método [getServiceOrderDetailSelect](file:///c:/ANTIGRAVITY/Veda%20Bene%20definitivo/lib/server/data-access/service-orders.ts#L50) e o mapeamento [toServiceOrderFormData](file:///c:/ANTIGRAVITY/Veda%20Bene%20definitivo/lib/server/view-models.ts#L130) expõem `cleaning_notes` no formulário.
    - Para que as observações apareçam no modal de início de limpeza a partir do dashboard e também no PDF consolidado, a propriedade `cleaning_notes` foi adicionada ao tipo `ServiceOrderListItem` em [view-models.ts](file:///c:/ANTIGRAVITY/Veda%20Bene%20definitivo/lib/types/view-models.ts#L78), mapeada na função `toServiceOrderListItem` e selecionada na constante global `SERVICE_ORDER_LIST_SELECT`.

 2. **Exibição Condicional no Frontend**:
    - No formulário [ServiceOrderForm.tsx](file:///c:/ANTIGRAVITY/Veda%20Bene%20definitivo/components/service-orders/ServiceOrderForm.tsx#L273), a seção **4. Note sulla Pulizia** (`CleaningNotesSection`) é renderizada para qualquer papel logado se preenchida ou se o usuário for administrador/secretária.
    - No modal de confirmação de início da atividade [StartCleaningModal](file:///c:/ANTIGRAVITY/Veda%20Bene%20definitivo/components/service-orders/ServiceOrderTimeControls.tsx#L98), as notas de limpeza (`cleaningNotes`) são exibidas com estilo de destaque de alerta suave (`bg-amber-500/10`) e scroll interno (`max-h-32`), garantindo que o funcionário possa lê-las imediatamente antes de começar o trabalho.

 3. **Exportação de PDF em Modo Paisagem e Inversão de Colunas**:
    - O PDF gerado via [ServiceOrderActiveExport.tsx](file:///c:/ANTIGRAVITY/Veda%20Bene%20definitivo/components/service-orders/ServiceOrderActiveExport.tsx) agora define `@page { size: landscape; }` nos estilos de impressão para forçar a renderização horizontal do documento, ganhando espaço horizontal.
    - As colunas de **Check-in** e **Check-out** e seus valores foram invertidos para melhorar o fluxo de leitura sequencial (Check-in listado antes de Check-out).
    - Foi adicionada a coluna **Note Pulizia** para exibir as observações de limpeza no documento. Para acomodar textos longos, a coluna possui limitação de largura de 250px e quebra automática de palavra (`word-break: break-word;`).

## Consequências
 
### Positivas:
- **Prevenção de Erros de Execução**: Ao carregar as notas diretamente no modal que confirma o início da atividade, mitiga-se o risco de o profissional pular orientações críticas do imóvel.
- **Leitura Otimizada no PDF**: O PDF em modo paisagem aproveita toda a largura da página horizontal para expor as novas colunas e observações.
- **Ordem Lógica no PDF**: O fluxo temporal de check-in listado antes de check-out atende melhor à cronologia de leitura.
- **Transparência Geral**: Administradores, secretárias, profissionais de limpeza, consegna e clientes têm acesso ao mesmo conjunto de informações de instrução unificado.
 
### Negativas / Riscos Mitigados:
- **Espaço e Quebras de Layout no PDF**: Textos longos de observação poderiam distorcer o PDF. Isso foi mitigado com regras de CSS restritivas sobre a célula de notas (`.notes-cell` com largura controlada de 250px e quebra forçada de linha).
