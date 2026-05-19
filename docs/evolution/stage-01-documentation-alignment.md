# Stage 1 - Documentation Alignment

Status: completed
Depends on: stage-00
Last updated: 2026-05-19

## Objective

Stage 1 resolves inconsistent project documentation by aligning the main project
docs with the accepted ADRs and current implementation.

## Current Problem

Before this stage, `README.md` stated that Column Level Security was
implemented through `properties_public` and `profiles_public` views. Current
architecture documents stated that those views were removed and CLS is
implemented through role-aware `select()` filters and DTO shaping in the
application.

## Why This Matters

CLS protects sensitive financial and personal columns such as property pricing
and employee compensation. If documentation points to a non-existent database
boundary, future work may accidentally expose sensitive fields.

## Planned Solution

Update the main documentation so it consistently states:

- RLS protects rows in Supabase/Postgres.
- CLS currently lives in Server Components, Server Actions, DAL/DTO shaping, and
  explicit `select()` strings.
- Views `properties_public` and `profiles_public` are not the active mechanism.
- Any new access to `profiles`, `properties`, or `service_orders` must be
  reviewed for field-level visibility.

## How The Solution Resolves The Problem

It removes the false assumption that the database is already enforcing column
visibility by view. Future agents and developers will see the correct risk and
implementation model before coding.

## Expected Benefits

- Safer onboarding.
- Reduced chance of sensitive-field leakage.
- Clearer bridge into Stage 2 DAL work.
- Better alignment between README, CLAUDE.md, and ADR 002.

## Scope

Allowed:

- Update `README.md`.
- Update `CLAUDE.md` only if it needs clarification.
- Add a short checklist to docs for field-sensitive data access.
- Link to existing ADRs.

Out of scope:

- Implement DAL.
- Refactor queries.
- Change Supabase migrations.
- Add tests.

## Files Likely Affected

- `README.md`
- `CLAUDE.md`
- `docs/evolution/README.md`
- `docs/evolution/strategic-roadmap.md`
- `docs/evolution/stage-01-documentation-alignment.md`
- `docs/evolution/execution-log.md`

## Acceptance Criteria

- No docs claim active CLS via `properties_public` or `profiles_public` views.
- README points to ADR 002 for the current CLS decision.
- Docs explicitly state that new data access must select minimal columns.
- Stage file and execution log are updated after completion.

## Required Verification

Documentation-only stage:

- Verify changed files render as Markdown.
- Verify links to ADRs are correct.
- Full build is optional unless code changes.

## Completion Record

Completed on 2026-05-19.

Decisions:

- `README.md` is now aligned with ADR 002 and no longer presents
  `properties_public` or `profiles_public` as the active CLS mechanism.
- `CLAUDE.md` already pointed to ADR 002 and required no change.
- The added field-sensitive access checklist is documentation-only and does not
  implement the Stage 2 DAL.

Files changed:

- `README.md`
- `docs/evolution/README.md`
- `docs/evolution/strategic-roadmap.md`
- `docs/evolution/stage-01-documentation-alignment.md`
- `docs/evolution/execution-log.md`

Verification:

- Confirmed Stage 0 is marked `completed` in `docs/evolution/execution-log.md`.
- Confirmed Stage 1 was `pending` in `docs/evolution/strategic-roadmap.md`
  before execution.
- Verified `README.md` links to `docs/decisions/002-cls-via-filtro-select.md`.
- Verified documentation no longer claims active CLS via
  `properties_public` or `profiles_public` views outside historical context.
- Full build not run because this was a documentation-only stage with no code
  changes.
