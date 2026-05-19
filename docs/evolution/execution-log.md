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
