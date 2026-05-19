# Stage 6 - Reporting And Export Consolidation

Status: completed
Depends on: stage-05
Last updated: 2026-05-19

## Objective

Stage 6 resolves duplicated reporting logic by consolidating statement,
dashboard, CSV, and PDF data production.

## Current Problem

Payable, receivable, dashboard, CSV, and PDF paths repeat related calculations:
hours, salaries, totals by property/client, and date filtering.

## Why This Matters

Financial outputs must be consistent. Duplicate calculations can cause the UI,
CSV, PDF, and dashboard to disagree.

## Planned Solution

Create canonical server-only reporting services that produce rows for:

- payable summary;
- payable detail;
- receivable summary;
- receivable detail;
- dashboard metrics.

CSV and PDF utilities should format canonical rows instead of re-querying or
recomputing business logic independently.

## How The Solution Resolves The Problem

All financial views consume a shared source of truth for calculations and
filters.

## Expected Benefits

- Consistent reports.
- Less duplicate aggregation code.
- Easier financial audit.
- Cleaner future database optimization.

## Scope

Allowed:

- Move reporting calculations into server-only services.
- Update statement actions and export routes to use canonical services.
- Preserve current screen and file formats.

Out of scope:

- Visual redesign of reports.
- Introducing materialized views unless Stage 8 has already approved it.
- Changing business formulas.

## Files Likely Affected

- `app/(app)/statements/actions.ts`
- `app/(app)/dashboard/actions.ts`
- `lib/utils/export-csv.ts`
- `lib/utils/export-pdf.ts`
- `lib/server/data-access/**`
- possibly `lib/server/reporting/**`
- `docs/evolution/stage-06-reporting-exports.md`
- `docs/evolution/execution-log.md`

## Acceptance Criteria

- CSV exports and statement screens use the same canonical data producers.
- Dashboard calculations reuse shared reporting logic where appropriate.
- Duplicate payable/receivable aggregation logic is reduced.
- Verification commands pass.

## Required Verification

Run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Manual comparison of UI and CSV/PDF totals is recommended.

## Completion Record

Completed on 2026-05-19.

Summary:

- Added a server-only canonical reporting service in
  `lib/server/reporting/financial.ts`.
- Moved payable summary, payable detail, receivable summary, receivable detail,
  dashboard revenue/hours/staff-cost aggregation, and reporting option lists
  behind that service.
- Kept statement Server Actions as thin validation/authorization wrappers.
- Kept CSV Route Handlers as thin request/auth/validation wrappers that format
  canonical rows.
- Converted CSV utilities to pure formatters and kept PDF utilities consuming
  canonical detail row types.
- Preserved existing visible labels, statement UI structure, export filenames,
  filter names, role gates, and use of `resolveOrderHours` for payroll/dashboard
  hour calculations.

Files changed:

- `app/(app)/statements/actions.ts`
- `app/api/export/payable/route.ts`
- `app/api/export/receivable/route.ts`
- `components/statements/PayableStatement.tsx`
- `components/statements/ReceivableStatement.tsx`
- `lib/server/data-access/dashboard.ts`
- `lib/server/reporting/financial.ts`
- `lib/types/reporting.ts`
- `lib/utils/export-csv.ts`
- `lib/utils/export-pdf.ts`
- `docs/evolution/README.md`
- `docs/evolution/strategic-roadmap.md`
- `docs/evolution/stage-06-reporting-exports.md`
- `docs/evolution/execution-log.md`

Verification:

- Verified Stage 5 was marked completed in the evolution index, roadmap, and
  execution log before editing.
- Read `AGENTS.md`, `CLAUDE.md`, `docs/decisions/README.md`, ADR 001, ADR 002,
  ADR 004, the roadmap, execution log, and this stage file before editing.
- Read Next.js 16 local docs for data security, Route Handlers, Server Actions,
  and data fetching before editing.
- Inspected current statement actions, CSV/PDF export modules, dashboard data
  access, statement components, pricing/hour helpers, DAL modules, and relevant
  types before editing.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed after moving type imports out of the `"use server"`
  statements action module and into `lib/types/reporting.ts`.
- Manual HTTP verification against the existing dev server on port 3000 first
  confirmed unauthenticated behavior: `/statements/payable` and
  `/statements/receivable` redirected to `/login`; unauthenticated CSV export
  routes returned 401.
- A later authenticated in-app browser pass confirmed `/statements/payable`,
  `/statements/receivable`, their primary filter buttons, and `/dashboard`
  loaded without app console errors. CSV file inspection and PDF print-window
  inspection remained limited by Codex in-app browser download/popup support.

Decisions:

- Kept `lib/server/data-access/dashboard.ts` as a compatibility wrapper and
  placed the shared financial calculations in `lib/server/reporting/financial.ts`
  to match the Stage 6 reporting boundary.
- Did not recalculate service-order prices in reporting; receivable reporting
  continues to use persisted `service_orders.total_price`, while creation/update
  pricing remains owned by `calculateTotalPrice`.
- Preserved the existing payroll and dashboard formulas, including fixed salary
  handling in payable reports and the existing dashboard fixed-salary daily
  allocation.
- Did not create a new ADR because this stage introduced an internal server-only
  reporting seam without changing roles, authorization, RLS/CLS, database
  policy, or business formulas.

Residual risks:

- Authenticated UI verification covered statement loading, filters, and
  dashboard loading. CSV download file contents and PDF popup/print output still
  need a real browser pass because the Codex in-app browser does not support
  inspecting attachment downloads or the print popup used by the current PDF
  helper.
- Reporting still depends on application-layer CLS discipline per ADR 002; the
  new service improves locality but does not add a database column-security
  boundary.
- Critical regression tests for the canonical reporting producers remain Stage 7
  work.
