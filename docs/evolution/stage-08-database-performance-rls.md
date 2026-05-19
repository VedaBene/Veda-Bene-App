# Stage 8 - Database Performance And RLS Review

Status: pending
Depends on: stage-07
Last updated: 2026-05-19

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

Not completed yet.

