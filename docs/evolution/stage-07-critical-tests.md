# Stage 7 - Critical Regression Tests

Status: pending
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

Not completed yet.

