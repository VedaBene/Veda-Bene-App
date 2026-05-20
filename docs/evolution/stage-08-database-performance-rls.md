# Stage 8 - Database Performance And RLS Review

Status: completed
Depends on: stage-07
Last updated: 2026-05-20

## Objective

Stage 8 reviews Supabase/Postgres performance and RLS behavior after app-layer
boundaries are cleaner and better tested.

## Current Problem

RLS helpers, report queries, date/status filters, and joins may become expensive
as service-order history grows.

## Why This Matters

Operational systems need predictable list, dashboard, and export performance.
Poor RLS or missing indexes can make queries degrade sharply with data volume.

## Planned Solution

Review:

- query patterns introduced or clarified by the DAL/reporting services;
- indexes for status/date/staff/property filters;
- RLS helper patterns and grants;
- Supabase advisor findings;
- whether any reporting paths need SQL functions, views, or materialized views.

Only create migrations when evidence supports them.

## How The Solution Resolves The Problem

Performance work becomes evidence-based instead of speculative. The app-layer
refactors reveal the real query shapes to optimize.

## Expected Benefits

- Better production performance.
- Lower database cost.
- More predictable dashboard/export behavior.
- Cleaner RLS security posture.

## Scope

Allowed:

- Run local or remote Supabase advisory checks if available.
- Inspect migration history and current query shapes.
- Add indexes or RLS hardening migrations when justified.
- Document decisions in ADRs if architectural behavior changes.

Out of scope:

- Premature materialized views without query evidence.
- Broad schema redesign unless explicitly approved.
- Replacing Supabase.

## Files Likely Affected

- `supabase/migrations/**`
- `docs/decisions/**`
- `lib/server/data-access/**`
- `lib/server/reporting/**`
- `docs/evolution/stage-08-database-performance-rls.md`
- `docs/evolution/execution-log.md`

## Acceptance Criteria

- Query and RLS review findings are documented.
- Any migration is justified by concrete query/policy evidence.
- Supabase security best practices are preserved.
- Verification commands pass where applicable.

## Required Verification

Run applicable checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

If migrations are added, also verify them with the available Supabase CLI or
document why Supabase verification could not run.

## Completion Record

Completed on 2026-05-20.

## Review Findings

- Verified Stage 7 was marked `completed` in the evolution index, roadmap, and
  execution log before changing files.
- Read `AGENTS.md`, `CLAUDE.md`, `docs/decisions/README.md`, ADR 001, ADR 002,
  ADR 003, ADR 005, ADR 006, and the relevant Next.js 16 local docs before
  editing.
- Inspected current migrations, RLS policies, privileged functions, dashboard
  queries, statement/reporting queries, export routes, service-order list/detail
  queries, service-order mutations, and existing Stage 7 tests.
- Supabase Advisor was available through `npx supabase db advisors --linked`.
  It reported:
  - `auth_rls_initplan` warnings on selected `profiles`, `properties`, and
    `service_orders` policies.
  - `multiple_permissive_policies` warnings on `profiles`, `properties`, and
    `service_orders`.
  - `unused_index` info for `properties_client_type_idx` and
    `service_orders_property_id_idx`.
  - Auth configuration warnings for leaked password protection and absolute Auth
    DB connection allocation.
- Remote read-only inspection confirmed RLS is enabled on `profiles`,
  `agencies`, `owners`, `properties`, and `service_orders`.
- Remote function inspection confirmed privileged RLS helpers live in `private`
  with pinned empty `search_path`; public privileged dashboard/trigger functions
  remain non-executable by `anon` and `authenticated`.
- Remote policy inspection found `properties_limpeza_consegna_select` and
  `service_orders_cliente_select` scoped to `PUBLIC` because their migration did
  not include `TO authenticated`; their expressions still required role/JWT, but
  the scope was unnecessarily broad.
- Remote index inspection confirmed no index on `service_orders.completed_at`
  and no owner/agency email indexes for the ADR 003/005 cliente helper path.
- Remote `EXPLAIN` on representative statements/dashboard and active-list
  queries showed sequential scans on the current small dataset, which is
  acceptable now but supports the missing-index risk as history grows.

## Implemented Changes

- Added `supabase/migrations/20260520105915_stage_08_database_performance_rls.sql`.
- Added partial indexes for high-volume service-order paths:
  - `service_orders_done_completed_at_idx`
  - `service_orders_done_cleaning_date_idx`
  - `service_orders_active_cleaning_date_idx`
- Added partial email indexes used by cliente RLS helper resolution:
  - `owners_email_idx`
  - `agencies_email_idx`
- Rewrote the policies flagged by Supabase Advisor to wrap stable auth/role
  functions in `SELECT`, avoiding per-row re-evaluation:
  - `profiles_self_select`
  - `profiles_staff_peer_select`
  - `properties_cliente_select`
  - `properties_limpeza_consegna_select`
  - `service_orders_limpeza_select`
  - `service_orders_consegna_select`
  - `service_orders_cliente_select`
  - `service_orders_limpeza_update`
- Scoped the two final `PUBLIC` SELECT policies back to `TO authenticated`
  without changing their role predicates.

## Not Changed

- Did not combine permissive policies. The Advisor warning is valid, but merging
  policies would be a larger RLS rewrite with higher regression risk.
- Did not remove indexes marked unused. The current production dataset is small,
  and those indexes still support existing FK/filter paths.
- Did not add materialized views, SQL reporting functions, or dashboard RPCs.
  This preserves ADR 006 and avoids premature reporting architecture changes.
- Did not change financial formulas, DTO/view-model contracts, UI flows, export
  shapes, or service-order business rules.
- Did not create a new ADR because the changes preserve existing architectural
  decisions and only harden/optimize their implementation.

## Verification

- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm test` passed: 6 files, 27 tests.
- `npm run build` passed.
- `npx supabase db advisors --linked --type all --level info --fail-on none`
  ran before and after applying the migration. After the remote push, the
  `auth_rls_initplan` warnings addressed by this stage no longer appeared.
- `npx supabase db query --linked` was used for read-only inspection of indexes,
  policies, RLS state, privileged functions, function grants, row estimates, and
  representative `EXPLAIN` plans.
- `npx supabase migration list --linked` completed after setting
  `SUPABASE_DB_PASSWORD`.
- `npx supabase db lint --linked --level warning --fail-on none` completed with
  no schema errors found.
- `npx supabase db push --linked` completed and reported the remote database was
  up to date.

## Residual Risks

- Supabase Advisor will still report `multiple_permissive_policies` until a
  deliberate RLS consolidation stage is approved.
- Auth leaked password protection and Auth DB connection allocation are project
  configuration findings, not repository migrations; they remain for Supabase
  dashboard/config follow-up.
- Supabase Advisor reports the new indexes as unused immediately after creation;
  this is expected until production queries accumulate usage stats.
- `ILIKE '%q%'` property search remains sequential-scan prone at larger scale.
  A future `pg_trgm` index should be considered only if property search volume
  or latency justifies adding the extension/index.
