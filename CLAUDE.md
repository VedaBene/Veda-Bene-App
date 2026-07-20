@AGENTS.md

# Veda Bene — Contexto do Projeto

**Veda Bene** é uma empresa de limpeza de imóveis em Roma (Itália), especializada em short-term rentals (Airbnb). Este sistema é um **CRM/ERP operacional** que centraliza imóveis, ordens de serviço (OS), funcionários e finanças.

## Dois tipos de clientes
- **B2B (Rental)**: agência imobiliária com múltiplos imóveis → `agency → properties → service_orders`
- **B2C (Particular)**: proprietário individual → `owner → property → service_orders`

## Cinco perfis de acesso (roles)
| Role | Permissões |
|------|-----------|
| `admin` | Acesso total, incluindo remuneração e extratos a pagar |
| `secretaria` | Imóveis + OS + extratos a receber (sem ver preços de imóveis nem remuneração) |
| `limpeza` | Apenas suas próprias OSs + dados básicos do imóvel (sem preços) |
| `consegna` | Idêntico ao de limpeza |
| `cliente` | Seus imóveis + OSs abertas/finalizadas (sem nomes de responsáveis) |

## Decisões arquiteturais críticas

As decisões com maior peso e nuance estão registradas em [`docs/decisions/`](docs/decisions/):

- [ADR 001](docs/decisions/001-rls-via-app-role-no-jwt.md) — RLS via `app_role` no JWT (por que policies comparam `= '"admin"'` e não `= 'admin'`)
- [ADR 002](docs/decisions/002-cls-via-filtro-select.md) — CLS via filtro de `select()` na aplicação (as views `properties_public`/`profiles_public` foram removidas)
- [ADR 003](docs/decisions/003-cliente-b2c-via-email-match.md) — Identificação de cliente B2C via match de email (função `client_property_ids` SECURITY DEFINER)
- [ADR 004](docs/decisions/004-proxy-ts-em-vez-de-middleware-ts.md) — `proxy.ts` em vez de `middleware.ts` (convenção do Next.js 16)
- [ADR 005](docs/decisions/005-rls-helpers-em-schema-privado.md) — Helpers privilegiados de RLS ficam em schema privado, não em `public`
- [ADR 006](docs/decisions/006-rpcs-privilegiadas-sem-execucao-direta.md) — RPCs `SECURITY DEFINER` em `public` não ficam executáveis diretamente por `anon`/`authenticated`
- [ADR 007](docs/decisions/007-exposicao-de-notas-de-limpeza-para-todos-os-perfis.md) — Notas de limpeza são visíveis para todos os perfis que já podem ler a OS
- [ADR 008](docs/decisions/008-controles-seguranca-autenticacao.md) — Timeout de sessão por inatividade e bloqueio temporário após falhas de login

Outras convenções importantes:
- **`is_urgent`** na tabela `service_orders`: coluna `GENERATED ALWAYS AS STORED` — não pode ser inserida manualmente. É `true` quando `(checkin_at - checkout_at) <= 3h` (3 horas ou menos).
- **Ordenação de OSs em Aberto**: Na listagem do aplicativo (seção "Aperti") e nos PDFs consolidados de ordens ativas, as ordens de serviço são ordenadas primeiro por `cleaning_date` crescente. Dentro da mesma data, a prioridade é o menor intervalo disponível de limpeza (`checkin_at - checkout_at`). Ordens sem data aparecem por último; dentro de uma data, ordens sem horários de check-in/check-out definidos aparecem após as que possuem uma janela calculável. O desempate final usa `order_number` crescente.
- **Supabase clients**: `utils/supabase/{client,server,middleware}.ts` para uso comum. `utils/supabase/admin.ts` é um adapter admin server-only; não exporta o client service-role bruto e expõe apenas operações administrativas explícitas. O `middleware.ts` aqui é convenção do `@supabase/ssr`, não do Next.js — o arquivo de proxy do Next.js está na raiz como `proxy.ts` (ver ADR 004).
- **Segurança de autenticação**: login por senha passa por `POST /api/auth/login` para aplicar bloqueio server-side após falhas; sessões autenticadas expiram após 45 minutos de inatividade. Ver ADR 008 antes de alterar login, sessão, cookies de atividade ou `public.auth_login_attempts`.
- **Funções privilegiadas**: helpers de RLS com `SECURITY DEFINER` devem ficar em schema privado; RPCs privilegiadas em `public` não devem conceder `EXECUTE` direto a `anon`/`authenticated` sem ADR/revisão explícita.
- **Preço da OS**: calculado no Server Action ao criar/atualizar (busca `base_price` + `extra_per_person` do imóvel), nunca pelo cliente. `secretaria` pode escolher `pricing_mode`, mas não recebe `base_price` nem valores calculados no navegador.
  - Fórmula centralizada em `calculateTotalPrice` (`lib/server/pricing.ts`). Para OS **já existente**, carregue o contexto com `loadOrderPricingContext(supabase, orderId, overridePropertyId?)` antes de chamar — não replique os fetches inline.
- **Horas de uma OS**: para métricas operacionais, dashboards de produtividade e histórico, use `resolveOrderHours(order, property)` em `lib/server/hours.ts` — retorna `worked_minutes/60` quando registrado, ou `avg_cleaning_hours` do imóvel como fallback. Para remuneração/extrato a pagar, use `resolveOrderPayableHours(property)`, que considera sempre o `avg_cleaning_hours` do imóvel.
- **Timezone de Referência**: Todo o tratamento de datas e horas de exibição na tela e nos PDFs gerados (inclusive nos relatórios operacionais e extratos Payable/Receivable) utiliza obrigatoriamente o timezone da Itália: `Europe/Rome`. Timestamps `TIMESTAMPTZ` do banco devem ser convertidos e formatados especificando `timeZone: 'Europe/Rome'`. Para formatação de UI, prefira `formatInRomeTimezone` em `lib/utils/date-rome.ts`.
  - O relógio do cabeçalho (`DateTimeDisplay.tsx`) é uma fonte externa de tempo: usa `useSyncExternalStore`, retorna `null` no snapshot de servidor e só formata a data após a hidratação. Não substitua esse padrão por uma flag `mounted` atualizada sincronicamente em `useEffect`, pois ele gera erro de lint e uma renderização em cascata evitável.
- **Sincronização de Filtros de URL**: Em `ServiceOrderList.tsx`, as props recebidas do servidor (`initialQ`, `initialStartDate`, etc.) são sincronizadas com o estado local durante a fase de renderização (*render-phase prop sync*), evitando espelhamento via `useEffect`. Isso previne loops de navegação reentrante via `router.replace` e erros de estouro de pilha (`JAVASCRIPT-NEXTJS-F`).

## Documentos de referência
- [`docs/service-orders.md`](docs/service-orders.md) — regras atuais da listagem, filtros, prioridade operacional e PDFs de Ordens de Serviço
- `~/Downloads/prd-veda-bene.md` — PRD completo (schema SQL, RLS, padrões de código)
- `~/Downloads/Spec_1.md` — Plano tático de implementação arquivo a arquivo (derivado do PRD)

## Estado atual
Etapas 0–8 concluídas. O histórico da evolução técnica concluída está em
[`docs/evolution/`](docs/evolution/) e deve ser consultado quando mudanças
tocarem DAL/data access, autorização/validação, service orders,
reporting/exports/dashboard, Supabase/Postgres/RLS ou helpers/RPCs
privilegiados. Componentes UI compartilhados em `components/ui/`.
