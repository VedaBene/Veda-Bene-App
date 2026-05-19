# Stage 5 - Service Orders Refactor

Status: pending
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

Not completed yet.

