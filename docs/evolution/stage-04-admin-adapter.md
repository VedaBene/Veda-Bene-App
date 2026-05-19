# Stage 4 - Narrow Admin Adapter

Status: completed
Depends on: stage-03
Last updated: 2026-05-19

## Objective

Stage 4 resolves the broad service-role client surface by replacing it with a
narrow server-only admin adapter.

## Original Problem

`utils/supabase/admin.ts` exported a raw Supabase service-role client. Usage was
limited to employee invite/delete flows, but the interface permitted
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

Completed on 2026-05-19.

Implemented:

- Replaced the exported raw Supabase service-role client in
  `utils/supabase/admin.ts` with a server-only narrow adapter.
- Kept the service-role client private inside `createServiceRoleClient()`.
- Exported only the explicit privileged operations required by employee flows:
  `inviteEmployeeByEmail(input)` and `deleteEmployeeAuthUser(userId)`.
- Updated `app/(app)/employees/actions.ts` to use the narrow adapter for
  employee invitation and auth-user deletion.
- Reused Stage 3 validation contracts for employee auth-user UUID validation.

Verification:

- Confirmed Stage 3 was marked `completed` in the roadmap and execution log
  before editing.
- Read `AGENTS.md`, `CLAUDE.md`, `docs/decisions/README.md`, ADR 001, ADR 002,
  ADR 004, ADR 005, ADR 006, `docs/evolution/README.md`,
  `docs/evolution/strategic-roadmap.md`, this execution log, and this stage file
  before editing.
- Read Next.js 16 local docs:
  `node_modules/next/dist/docs/01-app/02-guides/data-security.md`,
  `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`,
  and
  `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`.
- Searched for `createAdminClient`, `auth.admin`, `SUPABASE_SERVICE_ROLE_KEY`,
  and `utils/supabase/admin` usage after implementation.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Decisions:

- Kept the adapter in `utils/supabase/admin.ts` to minimize churn and preserve
  existing import locality.
- Did not add a generic admin adapter or expose arbitrary admin/database
  operations.
- Did not create a new ADR because this implements the accepted Stage 4 roadmap
  direction without changing an architectural contract.

Residual risks:

- `SUPABASE_SERVICE_ROLE_KEY` still exists as a required server secret, but its
  usage is now confined to the server-only admin adapter.
- Employee profile updates still rely on normal authenticated Supabase access
  and existing RLS behavior, preserving the prior flow.
