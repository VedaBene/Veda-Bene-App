# Stage 7 - Critical Regression Tests

Status: completed
Depends on: stage-06
Last updated: 2026-05-19

## Objective

Stage 7 adds focused automated tests for the business and access rules most
likely to regress.

## Current Problem

CI runs lint and typecheck only. There are no tests for pricing, hours, DTO
visibility by role, validation schemas, statements, or DAL behavior.

## Why This Matters

TypeScript cannot prove financial correctness or access-control behavior.
Refactors in earlier stages need executable contracts.

## Planned Solution

Introduce a lightweight test setup and focused tests for:

- `calculateTotalPrice`;
- `resolveOrderHours`;
- DTO shaping by role;
- validation schemas;
- reporting calculations;
- DAL access behavior with mocks or a controlled test seam.

## How The Solution Resolves The Problem

Critical business rules become executable expectations in CI.

## Expected Benefits

- Safer refactors.
- Faster regression detection.
- More meaningful CI.
- Documented behavior through tests.

## Scope

Allowed:

- Add a test runner/config if absent.
- Add focused unit tests.
- Add integration-style tests only if setup cost is justified.
- Update CI to run tests.

Out of scope:

- Full end-to-end suite for every role unless explicitly requested.
- Large test infrastructure that slows development disproportionately.

## Files Likely Affected

- `package.json`
- test config files
- `lib/**/*.test.ts`
- `.github/workflows/ci.yml`
- `docs/evolution/stage-07-critical-tests.md`
- `docs/evolution/execution-log.md`

## Acceptance Criteria

- Test command exists.
- CI runs the test command.
- Critical pure functions and validation contracts have tests.
- Verification commands pass.

## Required Verification

Run:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

## Completion Record

Completed on 2026-05-19.

Implemented:

- Added Vitest as the lightweight unit test runner with `npm test`.
- Added a Node-only Vitest configuration with a test-only alias for
  `server-only`.
- Added focused tests for:
  - `calculateTotalPrice`;
  - `resolveOrderHours`;
  - validation contracts and export search-param transforms;
  - DTO/view-model role visibility rules aligned with ADR 002;
  - DAL role-aware select strings for property and service-order option reads;
  - canonical payable and receivable reporting producers using a deterministic
    fake Supabase client.
- Updated CI to run `npm test` after lint and typecheck.

Files changed:

- `.github/workflows/ci.yml`
- `package.json`
- `package-lock.json`
- `vitest.config.mts`
- `test/server-only.ts`
- `test/fake-supabase.ts`
- `lib/server/pricing.test.ts`
- `lib/server/hours.test.ts`
- `lib/server/validation/contracts.test.ts`
- `lib/server/view-models.test.ts`
- `lib/server/data-access/role-selects.test.ts`
- `lib/server/reporting/financial.test.ts`
- `docs/evolution/README.md`
- `docs/evolution/strategic-roadmap.md`
- `docs/evolution/stage-07-critical-tests.md`
- `docs/evolution/execution-log.md`

Verification:

- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm test` passed: 6 test files, 27 tests.
- `npm run build` passed.

Decisions:

- Chose Vitest in Node mode because the stage targets pure server functions,
  validation contracts, DTO shaping, DAL query construction, and reporting
  producers rather than component rendering.
- Did not introduce jsdom, React Testing Library, Playwright, or an E2E suite
  because unit tests cover the documented critical risks with lower setup cost.
- Used simple fake Supabase query chains for reporting and DAL tests to avoid
  production data and keep tests deterministic.
- Did not create a new ADR because the stage only adds executable coverage for
  existing architectural contracts and does not change those contracts.

Residual risks:

- Tests do not exercise authenticated browser flows or real Supabase RLS/CLS
  behavior; they protect application-layer contracts and deterministic
  reporting formulas.
- Stage 8 remains responsible for database performance, RLS, policies, and
  migrations.
