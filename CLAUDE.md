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
- **RLS**: roles injetadas no JWT via `custom_access_token_hook` como `app_role`. A função `get_my_role()` lê o JWT como JSONB — retorna com aspas duplas embutidas (ex: `'"admin"'`), então policies usam `= '"admin"'`, não `= 'admin'`.
- **Column Level Security**: implementado via views (`properties_public`, `profiles_public`) em vez de REVOKE/GRANT, pois o Supabase usa um único role DB `authenticated` para todos os usuários autenticados.
- **`is_urgent`** na tabela `service_orders`: coluna `GENERATED ALWAYS AS STORED` — não pode ser inserida manualmente. É `true` quando `(checkin_at - checkout_at) < 4h`.
- **Supabase clients**: `utils/supabase/{client,server,middleware}.ts` + `utils/supabase/admin.ts` (service role, apenas para Server Actions administrativas).
- **Preço da OS**: calculado no Server Action ao criar (busca `base_price` + `extra_per_person` do imóvel), nunca pelo cliente.

## Documentos de referência
- `~/Downloads/prd-veda-bene.md` — PRD completo (schema SQL, RLS, padrões de código)
- `~/Downloads/Spec_1.md` — Plano tático de implementação arquivo a arquivo (derivado do PRD)

## Estado atual
Etapas 0–8 concluídas. Etapa 9 (componentes UI compartilhados) pendente.
