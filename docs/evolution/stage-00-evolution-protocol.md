# Stage 0 - Evolution Protocol

Status: completed
Depends on: none
Last updated: 2026-05-19

## Objective

Stage 0 resolves the cross-session continuity problem by creating a repository
source of truth for the staged technical evolution plan.

## Current Problem

The strategic plan existed only in conversation. A future session could not
reconstruct the plan, prior decisions, stage status, or execution protocol from
the repository alone.

## Why This Matters

The user intends to execute each stage in a separate session. Without a
repository-native protocol, each new agent would depend on missing chat memory
and could repeat work, skip dependencies, or expand scope accidentally.

## Applied Solution

Created `docs/evolution/` with:

- onboarding protocol;
- staged roadmap;
- execution log;
- one file per evolution stage;
- status and dependency markers.

Updated `AGENTS.md` so future sessions discover the protocol before staged
architecture work.

## How This Solves The Problem

Any new session can read repository files to determine:

- what the full plan is;
- which stage was requested;
- which stages are complete;
- what decisions and constraints apply;
- what to update after execution.

## Benefits

- Cross-session continuity.
- Explicit scope control.
- Traceable architectural evolution.
- Better use of each new context window.

## Acceptance Criteria

- `docs/evolution/README.md` exists and defines the workflow.
- `docs/evolution/strategic-roadmap.md` exists and lists every stage.
- `docs/evolution/execution-log.md` exists and records stage 0 completion.
- Each stage has a dedicated `stage-XX-*.md` file.
- `AGENTS.md` points agents to `docs/evolution/README.md`.

## Execution Notes

Completed in this session.

