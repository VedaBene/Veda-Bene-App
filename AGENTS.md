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
- O relógio de cabeçalho (`DateTimeDisplay.tsx`) deve ser inicializado apenas no cliente (dentro de `useEffect`) para prevenir hydration mismatches do Next.js e formatado com a timezone italiana (`Europe/Rome`).
<!-- END:timezone-rules -->
