# Stage 2 - Server-Only Data Access Layer

Status: completed
Depends on: stage-01
Last updated: 2026-05-19

## Objective

Stage 2 resolves scattered Supabase access by introducing a server-only Data
Access Layer that owns role-aware queries, field selection, and DTO shaping.

## Current Problem

Supabase queries are currently spread across pages, Server Actions, Route
Handlers, and utilities. Callers know table names, select strings, joins, role
logic, and sensitive-column behavior.

## Why This Matters

Because CLS is implemented in application code, every scattered `select()` is a
security-relevant decision point. This lowers locality and makes future changes
harder to audit.

## Planned Solution

Create `lib/server/data-access/` with `import 'server-only'` modules. The DAL
should expose business-oriented functions instead of raw Supabase details.

Candidate modules:

- `lib/server/data-access/viewer.ts`
- `lib/server/data-access/properties.ts`
- `lib/server/data-access/service-orders.ts`
- `lib/server/data-access/statements.ts`
- `lib/server/data-access/dashboard.ts`

Candidate interfaces:

```ts
type Viewer = {
  userId: string
  role: Role
}

getCurrentViewer(requiredRoles?: Role[]): Promise<Viewer>
getPropertyList(viewer: Viewer, filters: PropertyListFilters): Promise<PropertyListItem[]>
getPropertyDetail(viewer: Viewer, id: string): Promise<PropertyFormData | null>
getServiceOrderList(viewer: Viewer, filters: ServiceOrderListFilters): Promise<ServiceOrderListResult>
getServiceOrderDetail(viewer: Viewer, id: string): Promise<ServiceOrderFormData | null>
```

## How The Solution Resolves The Problem

Pages and Server Actions stop deciding field visibility directly. They call
deep server-only functions that return safe DTOs for the viewer role.

## Expected Benefits

- Better locality for access rules.
- Reduced risk of sensitive-field exposure.
- Smaller pages/actions.
- Clearer test targets.
- Easier future migration away from Supabase details if needed.

## Scope

Allowed:

- Introduce DAL modules.
- Move read queries from high-risk pages/actions into DAL.
- Preserve current UI behavior.
- Keep existing RLS behavior.
- Use current DTO types where practical.

Out of scope:

- Major UI component refactor.
- Reporting consolidation beyond what is necessary for initial DAL seams.
- Replacing Supabase.
- Database migrations unless a bug is found and user approves.

## Files Likely Affected

- `lib/server/data-access/**`
- `lib/server/authz.ts`
- `app/(app)/properties/page.tsx`
- `app/(app)/properties/[id]/page.tsx`
- `app/(app)/service-orders/page.tsx`
- `app/(app)/service-orders/[id]/page.tsx`
- `app/(app)/statements/actions.ts`
- `app/(app)/dashboard/actions.ts`
- `docs/evolution/stage-02-data-access-layer.md`
- `docs/evolution/execution-log.md`

## Acceptance Criteria

- New DAL modules are marked server-only.
- At least the most security-sensitive read paths use DAL functions.
- Pages no longer duplicate role-aware select logic for migrated paths.
- Existing behavior is preserved.
- Future direct Supabase reads are documented as follow-up if not migrated.

## Required Verification

Run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Completion Record

Completed on 2026-05-19.

Implemented:

- Added `lib/server/data-access/` with server-only modules for viewer lookup,
  properties, service orders, and dashboard data.
- Centralized role-aware property selects for list/detail/form options.
- Centralized role-aware service-order selects for list/detail/form options.
- Moved dashboard query aggregation behind a server-only data-access function
  while keeping the Server Action as the route-facing entrypoint.
- Kept existing DTO shaping through `lib/server/view-models.ts`.
- Reused the centralized viewer lookup from `lib/server/authz.ts`.

Migrated paths:

- `app/(app)/properties/page.tsx`
- `app/(app)/properties/[id]/page.tsx`
- `app/(app)/properties/new/page.tsx`
- `app/(app)/service-orders/page.tsx`
- `app/(app)/service-orders/[id]/page.tsx`
- `app/(app)/service-orders/new/page.tsx`
- `app/(app)/dashboard/actions.ts`

Explicitly not migrated in this stage:

- Statement/reporting actions and export utilities remain as follow-up for
  Stage 6 because they combine reporting semantics, CSV/export behavior, and
  financial aggregation.
- Mutation Server Actions remain in place except for shared viewer lookup,
  because Stage 2 is focused on read-query locality and DTO shaping.
- Input validation/authorization contracts, admin adapter hardening, database
  review/RLS changes, and critical regression tests remain assigned to their
  later stages.

Verification:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

Residual risks:

- Some direct Supabase reads remain in statement/reporting/export code until
  Stage 6.
- Mutation actions still contain direct Supabase access for writes and pricing
  support reads; future stages should avoid expanding their raw query surface.
