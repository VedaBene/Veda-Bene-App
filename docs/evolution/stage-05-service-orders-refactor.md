# Stage 5 - Service Orders Refactor

Status: completed
Depends on: stage-04
Last updated: 2026-05-19

## Objective

Stage 5 reduces the main UI/workflow hotspot in Service Orders without creating
shallow abstractions.

## Current Problem

`ServiceOrderForm.tsx` and `ServiceOrderList.tsx` are large and mix rendering,
local state, Server Action orchestration, modals, time tracking, status changes,
pricing controls, and print/PDF generation.

## Why This Matters

Service Orders are the operational center of the system and show high churn.
Large mixed-responsibility files increase regression risk.

## Planned Solution

Extract behavior by workflow, not by arbitrary file size:

- status controls;
- time tracking controls and modals;
- extras/pricing controls;
- list table/cards;
- printable active-order export;
- shared display helpers.

## How The Solution Resolves The Problem

Each workflow gains a primary home. The top-level components become composition
points instead of owning all behavior.

## Expected Benefits

- Smaller components.
- Better locality for service-order workflows.
- Safer changes to pricing/time-tracking UI.
- Easier review of future service-order changes.

## Scope

Allowed:

- Extract components/hooks/helpers from service-order components.
- Preserve existing UI behavior and visual structure.
- Keep Server Action behavior unchanged unless prior stages moved it.

Out of scope:

- Changing business rules.
- Redesigning the whole UI.
- Reporting/export consolidation beyond active-order print extraction.

## Files Likely Affected

- `components/service-orders/ServiceOrderForm.tsx`
- `components/service-orders/ServiceOrderList.tsx`
- `components/service-orders/**`
- `docs/evolution/stage-05-service-orders-refactor.md`
- `docs/evolution/execution-log.md`

## Acceptance Criteria

- Top-level service-order components are materially smaller.
- Extracted modules have clear responsibilities.
- Existing behavior is preserved.
- Verification commands pass.

## Required Verification

Run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Manual browser verification is recommended for service-order list/detail flows.

## Completion Record

Completed on 2026-05-19.

Summary:

- Reduced `ServiceOrderForm.tsx` from 729 lines to 331 lines by keeping it as
  the composition point for form state, action orchestration, and workflow
  sections.
- Reduced `ServiceOrderList.tsx` from 767 lines to 271 lines by keeping it as
  the composition point for filters, grouped list sections, pagination, and
  time-tracking action orchestration.
- Extracted focused service-order UI modules by workflow:
  - `ServiceOrderStatusControls.tsx` for status display and status transition
    controls.
  - `ServiceOrderTimeControls.tsx` for time panels and start/finish modals.
  - `ServiceOrderPricingControls.tsx` for pricing mode and extras controls.
  - `ServiceOrderFormSections.tsx` for the main form sections and shared field
    layout.
  - `ServiceOrderListTable.tsx` for mobile cards and desktop table rendering.
  - `ServiceOrderActiveExport.tsx` for active-order print/PDF generation.
  - `ServiceOrderFilters.tsx` for list filters.
  - `display.tsx` for shared labels, badges, date formatting, and urgency time
    helper.
- Preserved existing Server Actions and business rules. No domain behavior,
  reporting consolidation, migrations, RLS/policy changes, or new features were
  introduced.

Verification:

- `npm run lint` passed.
- `npx tsc --noEmit` passed after being rerun in isolation. An earlier parallel
  run overlapped with `next build` regenerating `.next/types` and produced
  transient missing `.next/types` file errors.
- `npm run build` passed.
- Manual browser verification: started the local dev server on port 3000 and
  opened `/service-orders`. The app loaded and redirected to `/login` because
  the browser session was unauthenticated, so authenticated list/detail workflow
  clicks could not be fully exercised in-browser in this session.

Decisions:

- Kept the form and list components as state/action orchestration points rather
  than moving state into many small hooks, because this stage targeted
  workflow-local UI extraction without changing behavior.
- Kept active-order print generation client-side and scoped to the existing
  active-list PDF button. Broader reporting/export consolidation remains Stage
  6.
- Did not create a new ADR because this refactor does not change a permanent
  architecture contract or domain decision.

Residual risks:

- Authenticated manual coverage was limited by the lack of an active browser
  session, so modal interaction and mutation flows are covered by type/build
  verification and preserved wiring, not by a completed browser click-through.
- The top-level form still owns a large amount of field state by design. A
  future stage may add regression tests before deeper state refactors.
