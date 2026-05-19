# Stage 6 - Reporting And Export Consolidation

Status: pending
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

Not completed yet.

