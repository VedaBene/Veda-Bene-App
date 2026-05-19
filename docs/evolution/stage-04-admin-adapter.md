# Stage 4 - Narrow Admin Adapter

Status: pending
Depends on: stage-03
Last updated: 2026-05-19

## Objective

Stage 4 resolves the broad service-role client surface by replacing it with a
narrow server-only admin adapter.

## Current Problem

`utils/supabase/admin.ts` exports a raw Supabase service-role client. Current
usage is limited to employee invite/delete flows, but the interface permits
arbitrary privileged database or auth operations.

## Why This Matters

The service role bypasses RLS. A broad client export creates a large blast
radius if imported incorrectly in future code.

## Planned Solution

Create a server-only adapter with explicit business operations:

```ts
inviteEmployeeByEmail(input)
deleteEmployeeAuthUser(userId)
```

Keep the raw admin client private inside the module. Add `import 'server-only'`.

## How The Solution Resolves The Problem

Callers can no longer use service-role power directly. They can only invoke
reviewable privileged operations.

## Expected Benefits

- Smaller privileged surface.
- Better RLS discipline.
- Clearer audit trail.
- Safer future employee-management changes.

## Scope

Allowed:

- Refactor `utils/supabase/admin.ts` or replace it with an admin adapter module.
- Update employee actions to call narrow functions.
- Preserve existing invite and delete behavior.

Out of scope:

- Changing employee domain behavior.
- Adding new admin capabilities.
- Database migration.

## Files Likely Affected

- `utils/supabase/admin.ts`
- `app/(app)/employees/actions.ts`
- possibly `lib/server/admin/**`
- `docs/evolution/stage-04-admin-adapter.md`
- `docs/evolution/execution-log.md`

## Acceptance Criteria

- No exported raw service-role client remains.
- Admin adapter is server-only.
- Employee invite and delete still work through narrow functions.
- Verification commands pass.

## Required Verification

Run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Completion Record

Not completed yet.

