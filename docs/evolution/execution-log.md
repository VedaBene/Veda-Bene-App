# Evolution Execution Log

This file records completed and blocked evolution work. Every stage execution
must append an entry here.

## 2026-05-19 - Stage 0 Completed

Stage: 0 - Evolution Protocol

Status: completed

Summary:

- Created repository-native evolution protocol in `docs/evolution/`.
- Added stage index, roadmap, execution log, and per-stage specs.
- Updated `AGENTS.md` to point future sessions to the evolution protocol.

Files changed:

- `AGENTS.md`
- `docs/evolution/README.md`
- `docs/evolution/strategic-roadmap.md`
- `docs/evolution/execution-log.md`
- `docs/evolution/stage-00-evolution-protocol.md`
- `docs/evolution/stage-01-documentation-alignment.md`
- `docs/evolution/stage-02-data-access-layer.md`
- `docs/evolution/stage-03-validation-authorization.md`
- `docs/evolution/stage-04-admin-adapter.md`
- `docs/evolution/stage-05-service-orders-refactor.md`
- `docs/evolution/stage-06-reporting-exports.md`
- `docs/evolution/stage-07-critical-tests.md`
- `docs/evolution/stage-08-database-performance-rls.md`

Verification:

- Documentation files created and linked from `AGENTS.md`.
- No production code changed.

Decisions:

- Stage work must be executed one stage at a time.
- Each future stage must update its own stage file and this log.
- Full `npm run build` is not mandatory for documentation-only stages.

Residual risks:

- Stage status in `README.md` and each stage file must be kept synchronized by
  future agents.

## 2026-05-19 - Stage 1 Completed

Stage: 1 - Documentation Alignment

Status: completed

Summary:

- Aligned `README.md` with ADR 002 for the current CLS model.
- Replaced the outdated claim that CLS is implemented via
  `properties_public` and `profiles_public` views.
- Added a field-sensitive data access checklist for `profiles`, `properties`,
  and `service_orders`.
- Confirmed `CLAUDE.md` already referenced ADR 002 and did not need changes.

Files changed:

- `README.md`
- `docs/evolution/README.md`
- `docs/evolution/strategic-roadmap.md`
- `docs/evolution/stage-01-documentation-alignment.md`
- `docs/evolution/execution-log.md`

Verification:

- Read `AGENTS.md`, `CLAUDE.md`, `docs/decisions/README.md`,
  `docs/decisions/002-cls-via-filtro-select.md`,
  `docs/evolution/strategic-roadmap.md`, this execution log, and the Stage 1
  file before editing.
- Verified Stage 0 dependency was completed before executing Stage 1.
- Verified `README.md` links to `docs/decisions/002-cls-via-filtro-select.md`.
- Verified changed Markdown files are present and readable.
- Full build not run because this stage changed documentation only.

Decisions:

- Did not edit code, queries, migrations, tests, or future-stage DAL structure.
- Kept historical mentions of removed views in ADR/evolution context because
  they document why the Stage 1 correction exists.

Residual risks:

- CLS remains an application-layer responsibility until a future stage
  centralizes data access or introduces a stronger database boundary.

## 2026-05-19 - Stage 2 Completed

Stage: 2 - Server-Only Data Access Layer

Status: completed

Summary:

- Introduced `lib/server/data-access/` as a server-only DAL for viewer lookup,
  properties, service orders, and dashboard aggregation.
- Moved high-risk read paths out of properties and service-order pages into DAL
  functions with role-aware select strings and existing DTO shaping.
- Moved dashboard data aggregation behind a server-only data-access function and
  kept `app/(app)/dashboard/actions.ts` as a thin Server Action wrapper.
- Added shared dashboard DTO types in `lib/types/dashboard.ts` to avoid exporting
  type-only symbols from a `"use server"` action module.
- Reused centralized viewer lookup in `lib/server/authz.ts`.

Files changed:

- `app/(app)/dashboard/actions.ts`
- `app/(app)/properties/[id]/page.tsx`
- `app/(app)/properties/new/page.tsx`
- `app/(app)/properties/page.tsx`
- `app/(app)/service-orders/[id]/page.tsx`
- `app/(app)/service-orders/new/page.tsx`
- `app/(app)/service-orders/page.tsx`
- `components/dashboard/RevenueChart.tsx`
- `components/dashboard/StaffCostChart.tsx`
- `components/dashboard/TopPropertiesTable.tsx`
- `lib/server/authz.ts`
- `lib/server/data-access/dashboard.ts`
- `lib/server/data-access/properties.ts`
- `lib/server/data-access/service-orders.ts`
- `lib/server/data-access/viewer.ts`
- `lib/types/dashboard.ts`
- `docs/evolution/README.md`
- `docs/evolution/strategic-roadmap.md`
- `docs/evolution/stage-02-data-access-layer.md`
- `docs/evolution/execution-log.md`

Verification:

- Verified Stage 1 was marked completed in `docs/evolution/README.md`,
  `docs/evolution/strategic-roadmap.md`, and this execution log before editing.
- Read `AGENTS.md`, `CLAUDE.md`, `docs/decisions/README.md`,
  `docs/decisions/001-rls-via-app-role-no-jwt.md`,
  `docs/decisions/002-cls-via-filtro-select.md`,
  `docs/decisions/003-cliente-b2c-via-email-match.md`,
  `docs/decisions/004-proxy-ts-em-vez-de-middleware-ts.md`,
  `docs/evolution/strategic-roadmap.md`, this execution log, and the Stage 2
  file before editing.
- Read Next.js 16 local docs:
  `node_modules/next/dist/docs/01-app/02-guides/data-security.md`,
  `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`,
  `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`,
  and `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`.
- Checked current Supabase JavaScript select documentation before implementing
  the DAL query moves.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Decisions:

- Kept the DAL read-oriented for this stage. Statement/reporting/export
  consolidation remains Stage 6 work.
- Preserved existing RLS behavior and did not introduce database migrations.
- Preserved existing DTO shaping functions in `lib/server/view-models.ts`
  instead of creating a parallel mapper layer.
- Did not implement Stage 3 validation/authorization contracts; existing
  page/action redirects and role checks were preserved.
- Moved dashboard types out of the Server Action module because Next.js 16
  Turbopack treats `"use server"` exports as action candidates during build.

Residual risks:

- Direct Supabase reads remain in statements/export/reporting code until
  Stage 6.
- Mutation Server Actions still contain raw Supabase writes and a few supporting
  reads for pricing and ownership checks; future stages should keep those behind
  narrower server-only seams.
- CLS remains application-layer protection; this stage improves locality but
  does not add a database column-security boundary.

## 2026-05-19 - Stage 3 Completed

Stage: 3 - Validation And Authorization Contracts

Status: completed

Summary:

- Added `lib/server/validation/contracts.ts` as a server-only validation
  contract module.
- Centralized schemas for UUIDs, date-only values, bounded date ranges,
  pagination, search filters, client type, roles, OS status, pricing mode,
  employee role, optional IDs, notes, and non-negative money values.
- Applied parsed search-param contracts to property and service-order list
  pages before calling the Stage 2 DAL.
- Applied UUID param contracts to property, service-order, and employee detail
  pages.
- Applied action argument contracts to service-order status/time/extras/delete
  flows, property update/delete flows, and employee update/delete flows.
- Applied payable/receivable reporting filters to Server Actions and CSV Route
  Handlers, including date-range bounds and optional ID validation.
- Reused the Stage 2 viewer lookup for centralized role parsing.

Files changed:

- `app/(app)/employees/[id]/page.tsx`
- `app/(app)/employees/actions.ts`
- `app/(app)/properties/[id]/page.tsx`
- `app/(app)/properties/actions.ts`
- `app/(app)/properties/page.tsx`
- `app/(app)/service-orders/[id]/page.tsx`
- `app/(app)/service-orders/actions.ts`
- `app/(app)/service-orders/page.tsx`
- `app/(app)/statements/actions.ts`
- `app/api/export/payable/route.ts`
- `app/api/export/receivable/route.ts`
- `lib/server/data-access/properties.ts`
- `lib/server/data-access/service-orders.ts`
- `lib/server/data-access/viewer.ts`
- `lib/server/validation/contracts.ts`
- `docs/evolution/README.md`
- `docs/evolution/strategic-roadmap.md`
- `docs/evolution/stage-03-validation-authorization.md`
- `docs/evolution/execution-log.md`

Verification:

- Verified Stage 1 and Stage 2 were marked completed in
  `docs/evolution/README.md`, `docs/evolution/strategic-roadmap.md`, and this
  execution log before editing.
- Read `AGENTS.md`, `CLAUDE.md`, `docs/decisions/README.md`,
  `docs/decisions/001-rls-via-app-role-no-jwt.md`,
  `docs/decisions/002-cls-via-filtro-select.md`,
  `docs/decisions/003-cliente-b2c-via-email-match.md`,
  `docs/decisions/004-proxy-ts-em-vez-de-middleware-ts.md`,
  `docs/evolution/strategic-roadmap.md`, this execution log, and the Stage 3
  file before editing.
- Read Next.js 16 local docs:
  `node_modules/next/dist/docs/01-app/02-guides/data-security.md`,
  `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`,
  `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`,
  `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`,
  and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Decisions:

- Invalid list-page filters fall back to safe defaults to preserve UI behavior,
  while invalid action/export/reporting inputs return controlled errors.
- Reporting/export date ranges are capped at 366 days to bound expensive
  requests without changing report ownership.
- Did not create a new ADR because this stage implements the accepted roadmap
  contracts and does not alter an existing architectural decision.

Residual risks:

- Statement/reporting/export query consolidation remains Stage 6 work.
- Employee data access still has direct Supabase reads in employee pages because
  creating an employee DAL was outside this stage's documented scope.
- Date-range bounds may need a product decision if users require larger
  historical exports.
