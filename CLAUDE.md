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

Outras convenções importantes:
- **`is_urgent`** na tabela `service_orders`: coluna `GENERATED ALWAYS AS STORED` — não pode ser inserida manualmente. É `true` quando `(checkin_at - checkout_at) < 4h`.
- **Supabase clients**: `utils/supabase/{client,server,middleware}.ts` + `utils/supabase/admin.ts` (service role, apenas para Server Actions administrativas). O `middleware.ts` aqui é convenção do `@supabase/ssr`, não do Next.js — o arquivo de proxy do Next.js está na raiz como `proxy.ts` (ver ADR 004).
- **Preço da OS**: calculado no Server Action ao criar/atualizar (busca `base_price` + `extra_per_person` do imóvel), nunca pelo cliente. `secretaria` pode escolher `pricing_mode`, mas não recebe `base_price` nem valores calculados no navegador.

## Documentos de referência
- `~/Downloads/prd-veda-bene.md` — PRD completo (schema SQL, RLS, padrões de código)
- `~/Downloads/Spec_1.md` — Plano tático de implementação arquivo a arquivo (derivado do PRD)

## Estado atual
Etapas 0–9 concluídas. Componentes UI compartilhados em `components/ui/`.
