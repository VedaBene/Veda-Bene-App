# Veda Bene Evolution Protocol

This folder is the official cross-session context for the staged technical
evolution of Veda Bene. Any new agent session that is asked to execute an
evolution stage must start here.

## Required Reading Order

1. `AGENTS.md` for repository-level agent rules.
2. `CLAUDE.md` for current project architecture context.
3. `docs/decisions/README.md` and the ADRs relevant to the requested stage.
4. `docs/evolution/strategic-roadmap.md` for the complete staged plan.
5. `docs/evolution/execution-log.md` for the historical execution state.
6. The specific `docs/evolution/stage-XX-*.md` file requested by the user.
7. The relevant Next.js 16 guide in `node_modules/next/dist/docs/` before code changes.

## Execution Contract

When the user asks to execute a stage, the agent must:

1. Confirm the requested stage exists.
2. Check the stage status and dependencies.
3. Verify dependency stages are marked `completed`, unless the user explicitly
   authorizes working out of order.
4. Read the stage scope, out-of-scope list, acceptance criteria, and verification
   requirements.
5. Inspect the current code before changing files.
6. Execute only the requested stage.
7. Avoid implementing future stages opportunistically.
8. Record any discovered future work in the stage notes or execution log.
9. Run the required verification commands, or document why a command could not run.
10. Update the stage file and `execution-log.md` before final response.

## Status Values

- `pending`: planned but not started.
- `in_progress`: actively being executed in the current or recent session.
- `completed`: implemented, verified, and documented.
- `blocked`: cannot proceed without a missing decision, access, dependency, or user input.

## Scope Control

Each stage is intentionally bounded. If a change appears useful but belongs to a
future stage, do not implement it during the current stage. Record it as a
follow-up.

## Minimum Verification

Default verification for implementation stages:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

If a stage only updates documentation, verify by checking file presence and links;
running the full build is optional unless code changed.

## Stage Index

| Stage | File | Status |
|---|---|---|
| 0 | `stage-00-evolution-protocol.md` | completed |
| 1 | `stage-01-documentation-alignment.md` | completed |
| 2 | `stage-02-data-access-layer.md` | completed |
| 3 | `stage-03-validation-authorization.md` | completed |
| 4 | `stage-04-admin-adapter.md` | completed |
| 5 | `stage-05-service-orders-refactor.md` | completed |
| 6 | `stage-06-reporting-exports.md` | pending |
| 7 | `stage-07-critical-tests.md` | pending |
| 8 | `stage-08-database-performance-rls.md` | pending |
