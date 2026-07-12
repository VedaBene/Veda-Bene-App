# Veda Bene

CRM/ERP operacional para uma empresa de limpeza de imóveis em Roma (Itália), especializada em short-term rentals (Airbnb). Centraliza imóveis, ordens de serviço (OS), funcionários e finanças.

## O que é

**Dois tipos de cliente:**
- **B2B (Rental)** — agência imobiliária com múltiplos imóveis: `agency → properties → service_orders`
- **B2C (Particular)** — proprietário individual: `owner → property → service_orders`

**Cinco perfis de acesso:**

| Role | Permissões |
|------|-----------|
| `admin` | Acesso total, incluindo remuneração e extratos a pagar |
| `secretaria` | Imóveis + OS + extratos a receber (sem ver preços de imóveis nem remuneração) |
| `limpeza` | Apenas suas próprias OSs + dados básicos do imóvel (sem preços) |
| `consegna` | Idêntico ao de limpeza |
| `cliente` | Seus imóveis + OSs abertas/finalizadas (sem nomes de responsáveis) |

## Stack

- **Next.js 16** (App Router) + **React 19** — Server Components por padrão, Server Actions para mutações
- **Supabase** — Postgres + Auth + RLS + SSR (`@supabase/ssr`)
- **Tailwind v4** — estilização
- **Sentry** — observabilidade (opcional em dev — sem DSN o SDK fica desabilitado)
- **Zod** — validação de input em Server Actions

## Como rodar localmente

### Pré-requisitos

- Node 20+
- npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase` ou `scoop install supabase`)
- Acesso a um projeto Supabase (remoto via Dashboard, ou local via `supabase start`)

### Setup

1. Clone e instale dependências:
   ```bash
   git clone <repo-url>
   cd "Veda Bene definitivo"
   npm install
   ```

2. Crie o `.env.local` a partir do template e preencha:
   ```bash
   cp .env.example .env.local
   ```

   | Variável | Onde obter |
   |----------|------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard → Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API (manter secreta — usada apenas pelo adapter admin server-only) |
   | `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` em dev |
   | `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry → Project Settings → Client Keys (opcional; vazio desabilita o SDK) |

3. Conecte o CLI ao projeto Supabase e aplique as migrations:
   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push
   ```

4. Seed de dados: **não há seed automático**. A migration `20260410233431_seed_mock_data.sql` é um placeholder no-op (ver [supabase/BASELINE_SYNC.md](supabase/BASELINE_SYNC.md)). Para popular o ambiente:
   - Crie usuários via Supabase Dashboard → Authentication → Users
   - Atribua a role no claim `app_role` (lido pelo `custom_access_token_hook` — ver seção de arquitetura abaixo)

### Rodar

```bash
npm run dev      # http://localhost:3000
npm run build    # build de produção
npm start        # serve o build
npm run lint     # ESLint
```

## Arquitetura — pontos críticos

- **RLS**: roles injetadas no JWT via `custom_access_token_hook` como `app_role`. A função `get_my_role()` lê o JWT como JSONB — retorna com aspas duplas embutidas (ex: `'"admin"'`), então policies usam `= '"admin"'`, **não** `= 'admin'`.
- **Column Level Security**: RLS protege linhas no Supabase/Postgres, mas a proteção de colunas sensíveis hoje fica na aplicação. Server Components, Server Actions, filtros explícitos de `select()` e DTOs devem selecionar apenas os campos permitidos por role. As views `properties_public` e `profiles_public` foram removidas e **não** são o mecanismo ativo. Ver [ADR 002](docs/decisions/002-cls-via-filtro-select.md).
- **`is_urgent`** em `service_orders`: coluna `GENERATED ALWAYS AS STORED` — não pode ser inserida manualmente. É `true` quando `(checkin_at - checkout_at) <= 3h`.
- **Supabase clients**: `utils/supabase/{client,server,middleware}.ts` para uso comum. `utils/supabase/admin.ts` é um adapter admin server-only; não exporta o client service-role bruto e expõe apenas operações administrativas explícitas.
- **Preço da OS**: calculado no Server Action ao criar (busca `base_price` + `extra_per_person` do imóvel) e inclui a taxa fixa de Consegna de €10, nunca pelo cliente. Essa taxa é receita da empresa e não remunera funcionários.
- **Horas da OS**: métricas operacionais usam o tempo real registrado (`worked_minutes`) via `resolveOrderHours`; remuneração/extrato a pagar usa sempre o tempo médio do imóvel (`avg_cleaning_hours`) via `resolveOrderPayableHours`.
- **Timezone de Referência**: Todo o tratamento de datas e horas de exibição na tela (incluindo o relógio do cabeçalho `DateTimeDisplay.tsx` cuja formatação ocorre após a montagem no cliente) e nos PDFs gerados (inclusive nos relatórios operacionais e extratos Payable/Receivable) utiliza obrigatoriamente o timezone da Itália: `Europe/Rome`. Timestamps `TIMESTAMPTZ` do banco devem ser formatados especificando `timeZone: 'Europe/Rome'`.

### Checklist para acesso a dados sensíveis

Ao criar ou alterar qualquer acesso a `profiles`, `properties` ou `service_orders`:

- Liste colunas explicitamente no `select()`; não use `select('*')`.
- Selecione o conjunto mínimo de campos necessário para a tela, ação ou export.
- Revise visibilidade por role antes de expor preço de imóvel, remuneração, dados financeiros ou dados pessoais.
- Aplique DTO/view-model server-side antes de retornar dados para Client Components.
- Consulte [ADR 002](docs/decisions/002-cls-via-filtro-select.md) quando o acesso envolver campos sensíveis.

## Estrutura de pastas

| Caminho | Conteúdo |
|---------|----------|
| `app/` | Rotas (App Router), Server Components por padrão |
| `app/(app)/` | Área autenticada |
| `lib/server/` | Helpers de Server Actions (auth, pricing) |
| `utils/supabase/` | Clients comuns (`client`, `server`, `middleware`) e adapter admin server-only |
| `components/` | UI compartilhada |
| `supabase/migrations/` | Schema versionado |

## Observações sobre o Next.js usado aqui

Este projeto roda no Next.js 16, que tem **breaking changes** em relação a versões anteriores. Antes de escrever código (ou pedir para uma IA escrever), confira `node_modules/next/dist/docs/` ou os deprecation notices do build — APIs, convenções e estrutura podem divergir do que você lembra.

## Documentação do projeto

- [Ordens de Serviço — regras de listagem e exportação](docs/service-orders.md) — filtros, prioridade operacional, informações exibidas e PDFs por status.
- [Architecture Decision Records](docs/decisions/README.md) — decisões arquiteturais duráveis e seus motivos.
- [Histórico da evolução técnica](docs/evolution/README.md) — etapas concluídas da evolução arquitetural.

### Documentos internos não versionados

- `~/Downloads/prd-veda-bene.md` — PRD completo (schema SQL, RLS, padrões de código)
- `~/Downloads/Spec_1.md` — plano tático de implementação arquivo a arquivo

## Estado atual

Etapas 0–9 concluídas. Componentes UI compartilhados disponíveis em [components/ui/](components/ui/).
