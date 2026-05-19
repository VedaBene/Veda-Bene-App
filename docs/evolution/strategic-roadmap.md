# Strategic Roadmap

This roadmap translates the architectural audit into staged, executable work.
The goal is to evolve the application without relying on conversation memory.

## Current Architectural State

Veda Bene is a Next.js 16 App Router application backed by Supabase Auth,
Postgres, and RLS. Server Components and Server Actions are the primary backend
surface. The project already has important ADRs for RLS, CLS, `proxy.ts`,
private RLS helpers, and privileged RPC exposure.

The highest-order architectural risk is that column-level data protection is
implemented in application code through explicit Supabase `select()` strings and
DTO shaping. This works, but it makes every data-access call a security-relevant
maintenance point. The main evolution direction is therefore to increase
locality, deepen interfaces, and create explicit server-only seams around data
access, privileged admin operations, reporting, and service-order workflows.

## Principles For All Stages

- Prefer deep interfaces over shallow file moves.
- Keep Supabase provider details behind server-only seams where practical.
- Keep RLS as the database row-visibility boundary.
- Treat CLS as a high-risk application responsibility until a stronger database
  boundary is intentionally introduced.
- Do not expose service-role clients outside narrow admin adapters.
- Preserve Next.js 16 conventions; read local docs before coding.
- Do not expand a stage beyond its documented scope without explicit user approval.

## Stage 0 - Evolution Protocol

Status: completed

Purpose: create the repository-native mechanism for cross-session continuity.

Problem: staged architecture work would otherwise depend on prior chat context.

Solution: create `docs/evolution/` with protocol, roadmap, execution log, and
stage-level specs.

Expected benefits:

- New sessions can reconstruct project direction from the repository.
- Stage status and decisions are versioned.
- Agents can execute only the requested stage.

## Stage 1 - Documentation Alignment

Status: completed

Purpose: resolve inconsistent project documentation before changing code.

Problem: before Stage 1, `README.md` said CLS was implemented through views,
while `CLAUDE.md` and ADR 002 stated that views were removed and CLS is
implemented through application `select()` filters and DTOs.

Why it matters: inconsistent docs can cause a future developer or agent to trust
a protection layer that no longer exists.

Solution: update public project docs so they match the accepted ADRs and current
implementation.

Expected benefits:

- Safer onboarding.
- Fewer security misunderstandings.
- Clear source of truth for future stages.

## Stage 2 - Server-Only Data Access Layer

Status: pending

Purpose: centralize Supabase queries, role-aware selects, and DTO shaping.

Problem: pages, actions, route handlers, and utilities call Supabase directly.
Each caller knows table names, select strings, joins, role checks, and field
visibility details.

Why it matters: because CLS lives in the app layer, scattered data access
creates low locality and high leakage risk.

Solution: introduce `lib/server/data-access/` as a server-only DAL with
role-aware functions such as `getServiceOrderList`, `getServiceOrderDetail`,
`getPropertyList`, `getReceivableStatement`, and `getPayableStatement`.

Expected benefits:

- One primary home for data visibility rules.
- Smaller pages and actions.
- Easier security review.
- Better testability.

## Stage 3 - Validation And Authorization Contracts

Status: pending

Purpose: make server entrypoints validate inputs consistently.

Problem: mutations use Zod in several places, but read filters and export routes
still consume raw `searchParams` or client-provided strings.

Why it matters: Server Actions and Route Handlers are externally reachable
surfaces. UI constraints are not authorization or validation.

Solution: create shared server-side schemas for date ranges, UUIDs, pagination,
client filters, employee filters, status values, and pricing modes. Route
Handlers, Server Actions, and DAL functions should use these contracts.

Expected benefits:

- More predictable query behavior.
- Lower abuse risk for exports and reports.
- Consistent error handling.
- Better acceptance-test targets.

## Stage 4 - Narrow Admin Adapter

Status: pending

Purpose: contain service-role privilege behind a deep interface.

Problem: `utils/supabase/admin.ts` exports a raw service-role Supabase client.
The current usage is limited, but the interface is too powerful.

Why it matters: service role bypasses RLS. A broad export increases the blast
radius of accidental imports or future misuse.

Solution: replace raw admin client exports with narrow server-only functions
such as `inviteEmployee` and `deleteEmployeeAuthUser`.

Expected benefits:

- Smaller privileged surface.
- Clear admin seam.
- Easier code review.
- Better enforcement of RLS-by-default.

## Stage 5 - Service Orders Refactor

Status: pending

Purpose: reduce the largest workflow hotspot without shallow decomposition.

Problem: `ServiceOrderForm.tsx` and `ServiceOrderList.tsx` are large and mix UI,
state, modal orchestration, time tracking, status transitions, pricing display,
and PDF generation.

Why it matters: service orders are the operational core. Mixed responsibilities
increase regression risk for the most frequently changed feature area.

Solution: separate workflows into focused modules/components: editing,
time-tracking controls, status controls, extras/pricing controls, list rendering,
and printable export generation.

Expected benefits:

- Better locality for service-order behavior.
- Lower component churn.
- Safer changes to pricing and tracking.
- Smaller and more reviewable files.

## Stage 6 - Reporting And Export Consolidation

Status: pending

Purpose: make dashboard, CSV, PDF, payable, and receivable data consistent.

Problem: reporting logic is repeated across statement actions, CSV utilities,
PDF utilities, and dashboard actions.

Why it matters: financial reports must agree. Divergent calculations erode
operational trust.

Solution: create server-only reporting services that produce canonical rows for
screen rendering and exports. CSV/PDF should format canonical data instead of
recomputing business rules.

Expected benefits:

- Consistent financial outputs.
- Less duplicate aggregation code.
- Easier audit of payment and receivable logic.
- Cleaner path to future SQL/reporting optimization.

## Stage 7 - Critical Regression Tests

Status: pending

Purpose: protect the rules most likely to break during refactors.

Problem: CI currently runs lint and typecheck, but there are no automated tests
for role DTOs, pricing, hours, filters, reports, or access boundaries.

Why it matters: TypeScript does not prove business or security behavior.

Solution: add focused tests for pricing, hours, DTO shaping by role, validation
schemas, and high-risk DAL/reporting functions. Add e2e coverage only where it
provides meaningful role/access confidence.

Expected benefits:

- Safer future refactors.
- Faster regression detection.
- More meaningful CI.
- Clear executable contracts for business behavior.

## Stage 8 - Database Performance And RLS Review

Status: pending

Purpose: prepare the Supabase/Postgres layer for growth after app boundaries are
cleaner.

Problem: RLS helpers, reporting queries, and date/status filters may become
expensive as data grows.

Why it matters: operational systems degrade when dashboards and exports scan
large history tables or evaluate RLS inefficiently.

Solution: review indexes, RLS helper patterns, query plans, and Supabase
advisor findings. Add migrations only after evidence supports them.

Expected benefits:

- Better production performance.
- Lower database cost.
- More predictable RLS behavior.
- Cleaner scale path.
