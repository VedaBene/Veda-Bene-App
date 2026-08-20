---
name: project-architecture-engineering
description: >-
  Lead architecture and software engineering for new projects and broad technical
  audits. Use when starting a project, PRD, product plan, stack selection,
  requirements discovery, domain modeling, MVP scoping, architecture decisions,
  delivery planning, engineering standards, or later on-demand system review.
  Also use for Portuguese requests about novo projeto, arquitetura, engenharia,
  planejamento, briefing com implicacoes tecnicas, stack, requisitos, auditoria,
  revisao, melhorias, problemas arquiteturais, ou qualidade tecnica. For deep
  architecture critique, refactor gatekeeping, seams, locality, or abstraction
  quality, use `architectural-mentor-ai` when available. When security-sensitive
  concerns appear, use `vibe-security` when available.
---

# Project Architecture Engineering

## Overview

Use this skill to make project work architecture-led instead of technology-led.
Understand the product and constraints first, choose the simplest architecture
that fits, define how it will be delivered and operated, and audit implemented
systems against the same principles.

Keep recommendations proportional to project stage, team, risk, and expected
change. Avoid enterprise architecture for an MVP unless requirements justify it.

Read `references/architecture-principles.md` for strategic questions, PRD
shaping, stack definition, architecture planning, or full audit criteria.

## Mode Selection

Choose one mode from user intent:

- **Initial architecture mode**: new projects, PRDs, planning, stack decisions,
  requirements discovery, MVP scope, domain modeling, engineering setup, or
  delivery planning.
- **Audit mode**: existing projects or implementations the user asks to inspect,
  evaluate, review, improve, or audit.

If artifacts already exist, use them before asking questions. If no implementation
exists, default to initial architecture mode.

For deep structural critique, refactor design, Seam/Adapter quality, Locality,
Hotspots, or architecture gatekeeping, delegate or complement with
`architectural-mentor-ai` when available.

## Decision Discipline

Before major recommendations, separate:

- `KNOWN` - explicitly provided or verified.
- `ASSUMED` - reasonable working assumption.
- `UNKNOWN` - materially relevant fact not yet established.

Ask only questions whose answers can materially change scope, architecture,
risk, or cost. Otherwise proceed with explicit assumptions.

For scale and future demand, distinguish:

- `CURRENT` - what the first version must support.
- `TARGET` - credible growth or requirement horizon.
- `SPECULATIVE` - possible future scale without evidence.

Do not introduce complexity mainly for speculative scale or flexibility.

Spend more analysis on decisions with high blast radius, migration cost,
durable contracts, or low reversibility.

## Initial Architecture Mode

Frame the problem before choosing technology.

1. **Problem and scope**
   Identify the user, business goal, core problem, success metric, first-version
   boundary, and explicit non-goals.

2. **Core flows and domain**
   Identify critical journeys, business rules, entities, states, relationships,
   ownership, invariants, and source-of-truth decisions.

3. **Non-functional requirements**
   Establish security, privacy, availability, performance, scale, offline needs,
   compliance, observability, maintainability, cost, and operational constraints.
   Separate CURRENT, TARGET, and SPECULATIVE requirements.

4. **Change and risk**
   Identify stable areas, likely change areas, irreversible decisions, external
   dependencies, data migration pressure, and boundaries that should remain decoupled.

5. **Architecture**
   Propose the simplest architecture that satisfies current requirements without
   blocking credible evolution. Prefer a modular monolith or similarly simple
   topology unless distribution is justified by scale, ownership, reliability,
   or operational requirements.

6. **Responsibilities**
   Define clear ownership for UI, application/use cases, business rules, data,
   integrations, infrastructure, and operations. Avoid layers that add indirection
   without leverage.

7. **Stack selection**
   Choose technology by team experience, delivery speed, ecosystem maturity,
   product complexity, hiring, maintenance, cost, operational burden, and fit
   with non-functional requirements.

   Prefer boring, well-understood technology unless additional novelty provides
   a clear, explicit benefit.

8. **Build / Buy / Integrate**
   For commodity capabilities such as auth, payments, email, search, analytics,
   CMS, storage, feature flags, or messaging, explicitly consider whether to
   build, buy, or integrate.

   Evaluate strategic differentiation, lock-in, compliance, cost, data
   portability, operational burden, and replacement difficulty.

9. **Engineering baseline**
   Define folder/module structure, naming, error handling, logging, tests,
   configuration, migrations, environments, deployment, rollback, observability,
   and essential documentation.

10. **Delivery architecture**
    Prefer deployable vertical slices, incremental releases, feature flags where
    useful, migration sequencing, and dependency ordering that reduce integration
    and rollback risk.

11. **Decision record**
    Capture major decisions as:
    - Decision
    - Context
    - Alternatives considered
    - Why this option
    - Tradeoffs
    - Revisit trigger

Expected outputs may include a PRD architecture section, stack recommendation,
architecture brief, domain model, MVP boundary, delivery plan, engineering plan,
or decision log.

## Audit Mode

Inspect the available repository, docs, schema, deployment config, product
artifacts, and operational context before judging. Prefer concrete file/line
references where code exists.

Audit in this order:

1. **Problem fit**
   Does the implementation still match users, product flows, business rules, and
   intended scope?

2. **Simplicity**
   Look for unnecessary layers, duplicated mechanisms, premature abstractions,
   unjustified distributed systems, or avoidable operational complexity.

3. **Boundaries**
   Check separation and ownership across UI, business rules, data, integrations,
   infrastructure, and operations.

4. **Domain model**
   Review entities, states, invariants, naming, ownership, relationships, and
   ambiguity.

5. **Data design**
   Check source of truth, duplication, consistency, schema evolution, migrations,
   critical queries, transaction boundaries, and compatibility requirements.

6. **Non-functional fit**
   Compare actual design against CURRENT and TARGET performance, availability,
   scalability, offline, compliance, cost, and operational needs.

7. **Changeability**
   Look for coupling, unstable rules, framework lock-in, hard-to-reverse choices,
   poor extension points, and areas likely to resist credible evolution.

8. **Testability**
   Check whether business rules can be isolated, dependencies can be controlled,
   and critical behavior is protected by meaningful tests.

9. **Observability and operations**
   Review logging, error clarity, metrics/tracing where justified, deployability,
   environments, migrations, rollback, runbooks, and documentation.

10. **Security**
    Review authentication, authorization, input validation, secrets, permissions,
    sensitive data, API exposure, database policies, deployment, and production
    hardening. Use `vibe-security` when available.

For each material finding, report:

- evidence;
- impact;
- root cause;
- recommended action;
- tradeoff or implementation cost;
- status as `OBSERVED`, `INFERRED`, or `NOT VERIFIED`.

Do not present an uninspected area as healthy.

## Integration With Specialist Skills

### Architectural Mentor

Use `architectural-mentor-ai` when the question requires deeper analysis of:

- Seams and Adapters;
- Deep vs Shallow interfaces;
- Locality and Hotspots;
- abstraction leverage and cost;
- dependency direction;
- refactor pressure-testing;
- architectural gatekeeping.

This skill remains responsible for product fit, project-level architecture,
stack, NFRs, engineering baseline, delivery, and overall technical coherence.

### Security

Use `vibe-security` for security-sensitive areas including auth, authorization,
secrets, environment handling, uploads, APIs, CORS, JWT/session handling,
Supabase/RLS, database policies, payments, personal data, Docker, deployment,
logs, AI tool boundaries, or vulnerability findings.

In initial mode, use it to deepen baseline controls. In audit mode, use it to
strengthen findings and remediation.

## Architecture / Engineering Gate

For substantial plans or audits, use one overall status:

- **ACCEPT** - architecture and engineering choices are proportionate, coherent,
  and fit the known requirements.
- **ACCEPT WITH CONDITIONS** - direction is sound with contained follow-up work,
  explicit assumptions, or non-blocking uncertainty.
- **REVISE** - material product, architecture, data, delivery, or operational
  issues should be corrected before implementation or merge.
- **BLOCK** - the plan creates severe data, migration, operability, security,
  cost, or irreversible design risk.

Do not mark `ACCEPT` when a decision-critical area remains `UNKNOWN` or
`NOT VERIFIED`.

## Output Style

Prefer Portuguese when the user writes in Portuguese. Lead with questions or
findings that can change direction. Separate assumptions from decisions and
avoid generic best-practice lists unless mapped to the project.

For initial work, usually provide:

```markdown
**Project Engineering Verdict**
Status: ACCEPT | ACCEPT WITH CONDITIONS | REVISE | BLOCK

**Known / Assumed / Unknown**
- ...

**Product and Domain**
- ...

**Architecture**
- ...

**NFRs and Risk**
- CURRENT:
- TARGET:
- SPECULATIVE:

**Stack and Build/Buy Decisions**
- ...

**Delivery Plan**
- ...

**Decisions / Revisit Triggers**
- ...
```

For audits, usually provide:

```markdown
**Engineering Verdict**
Status: ACCEPT | ACCEPT WITH CONDITIONS | REVISE | BLOCK

**Findings**
1. [severity/priority] Finding
   - Evidence:
   - Impact:
   - Root cause:
   - Recommendation:
   - Status: OBSERVED | INFERRED | NOT VERIFIED

**System-Level Risks**
- ...

**Recommended Sequence**
- ...

**Follow-up / Specialist Review**
- ...
```

Scale the response to the task; do not force every section for small questions.

## Behavioral Boundaries

- Do not start from the stack when the product problem is still unclear.
- Do not ask questions that can be safely resolved by stated assumptions.
- Do not optimize for speculative scale.
- Do not introduce distributed systems, abstraction layers, or novel technology
  without a requirement-backed reason.
- Do not treat framework choice as architecture by itself.
- Do not ignore business constraints, team capability, delivery pressure,
  migration cost, vendor lock-in, or operational ownership.
- Do not build commodity infrastructure without considering buy/integrate first.
- Do not recommend big-bang rewrites when incremental migration can contain risk.
- Do not duplicate deep architectural or security analysis when specialist skills
  are available; coordinate with them.
- Do not present inferred or unreviewed areas as verified facts.
