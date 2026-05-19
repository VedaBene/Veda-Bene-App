# Stage 3 - Validation And Authorization Contracts

Status: pending
Depends on: stage-02
Last updated: 2026-05-19

## Objective

Stage 3 resolves inconsistent server input validation by introducing reusable
validation and authorization contracts for server entrypoints.

## Current Problem

Several mutations use Zod, but read filters and export routes still consume raw
strings from `searchParams` or Client Components. Date ranges, UUIDs,
pagination, client filters, employee filters, and enums are not validated in one
consistent place.

## Why This Matters

Server Actions and Route Handlers are externally reachable. Client-side
controls are convenience, not security. Unvalidated inputs can cause bad query
behavior, expensive exports, or confusing authorization paths.

## Planned Solution

Create shared server-side schemas for:

- date ranges;
- UUIDs;
- pagination;
- service-order filters;
- property filters;
- statement filters;
- client type;
- employee ID;
- status and pricing mode.

Use these schemas in Route Handlers, Server Actions, and DAL boundaries.

## How The Solution Resolves The Problem

All server entrypoints parse and normalize inputs before data access. DAL
functions receive typed filters instead of raw request strings.

## Expected Benefits

- Safer exports and reports.
- Consistent error behavior.
- Easier tests.
- Less defensive parsing inside business functions.

## Scope

Allowed:

- Add server validation modules.
- Update route handlers and actions to use schemas.
- Add small helper types for parsed filters.
- Tighten date range and pagination limits.

Out of scope:

- UI redesign.
- Large DAL redesign beyond necessary integration.
- Adding a full test suite; that belongs to Stage 7.

## Files Likely Affected

- `lib/server/validation/**`
- `app/api/export/**/route.ts`
- `app/(app)/**/actions.ts`
- `lib/server/data-access/**`
- `docs/evolution/stage-03-validation-authorization.md`
- `docs/evolution/execution-log.md`

## Acceptance Criteria

- Export routes validate `start`, `end`, and optional IDs.
- Server Actions do not pass raw client filters directly to Supabase.
- Invalid filters return controlled errors or empty safe results.
- Stage file and execution log are updated.

## Required Verification

Run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Completion Record

Not completed yet.

