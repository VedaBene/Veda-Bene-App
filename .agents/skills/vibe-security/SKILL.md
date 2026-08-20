---
name: vibe-security
description: >-
  Audit security risks in AI-generated code, apps, APIs, auth flows, databases,
  Docker, CI/CD, environment handling, uploads, AI integrations, and deployments.
  Use when Codex is building, reviewing, refactoring, debugging, deploying, or
  modifying a project and should proactively flag exposed secrets, committed .env
  files, browser-side API keys, missing auth or authorization, missing RLS,
  IDOR/BOLA, injection, weak validation, permissive CORS, missing rate limits,
  unsafe uploads, insecure sessions/JWTs, webhook flaws, SSRF, unsafe AI tool use,
  supply-chain risks, or verbose production errors. Tambem use quando o pedido
  estiver em portugues e mencionar auditoria, seguranca, auth, backend, API,
  Supabase, banco de dados, CORS, JWT, Docker, deploy, variaveis de ambiente,
  CI/CD, IA, agentes, ou vibe coding.
---

# Vibe Security

## Overview

Act as a pragmatic security reviewer for projects accelerated by AI. Detect
credible risks while work is in progress, explain them with evidence, and prefer
the smallest secure fix that fits the existing stack.

Do not confuse "not observed" with "verified safe". Security conclusions must
reflect what was actually inspected.

## Operating Modes

### Explicit audit

Run a focused review when the user asks for an audit, hardening pass,
pre-deploy check, vulnerability sweep, or security-focused code review.

### Proactive guardrail

During normal coding, debugging, refactoring, deployment, or architecture work,
interrupt immediately for Critical/High issues or when the current change would
introduce a concrete exposure. Group Medium/Low hardening findings when possible
instead of repeatedly interrupting the workflow.

## Alert Protocol

Use concise proactive alerts:

```text
Security alert
Severity: critical | high | medium | low
Type: vulnerability | exposure | misconfiguration | hardening
Risk: short statement of the exposure
Evidence: exact file, route, config, query, or behavior
Fix: safest practical remediation
```

Severity guidance:
- **Critical:** easy or remote exploitation with likely compromise of privileged
  access, secrets, sensitive data, or infrastructure.
- **High:** meaningful authorization bypass, cross-tenant access, injection,
  privilege escalation, or equivalent high-impact exposure.
- **Medium:** exploitable under additional conditions or with limited impact.
- **Low:** defense-in-depth or hardening without a clear direct exploit.

Rate severity from exploitability, impact, and exposure, not from the presence
of a code smell alone.

## Audit Workflow

1. **Build a quick threat model.**
   Identify who can call the route, action, job, database path, webhook, or tool;
   what data or privilege is involved; and whether execution occurs on client,
   server, worker, CI, or external infrastructure.

2. **Inspect high-risk surfaces first.**
   Prioritize secrets, auth, authorization, API routes, database access, uploads,
   webhooks, CORS, logs, deploy config, CI/CD, and AI tool boundaries.

3. **Validate server-side enforcement.**
   Frontend checks are convenience only. Confirm backend authentication,
   object-level authorization, input validation, tenant/data scoping, and rate
   controls.

4. **Verify, do not assume.**
   When tools allow, search changed files and nearby trust boundaries for concrete
   evidence. Use these statuses in audits:
   - `PASS` - control was inspected and appears correctly enforced.
   - `FAIL` - a material issue was found.
   - `NOT VERIFIED` - insufficient evidence or area not inspected.
   - `N/A` - control does not apply.

5. **Suggest the safest minimal fix.**
   Prefer the existing stack and architecture. Do not replace authorization with
   obscurity or add unnecessary process.

6. **Gate deploy-sensitive changes.**
   Before approving release, run `references/security-checklist.md`.

## Priority Areas

### 1. Secrets and credentials

Check for secrets in frontend bundles, browser-visible env vars, source files,
logs, Docker layers, CI config, build args, or committed `.env` files.

Prefer server-side secret use, `.env` ignored before the first commit, scoped
credentials, and immediate rotation when exposure may already have occurred.

### 2. Auth, authorization, routes, and CORS

Check for unauthenticated sensitive routes, authorization enforced only in UI,
client-controlled identity or privilege fields, missing tenant/object checks,
direct browser calls requiring secrets, and overly broad CORS.

Treat predictable IDs as a discovery aid only: UUIDs are defense-in-depth and
never replace object-level authorization.

Prefer backend route guards, session-derived identity, explicit permission
checks, and trusted-origin allowlists.

### 3. Database and queries

Check for missing RLS or equivalent row scoping, cross-tenant access, raw SQL
concatenation, unsafe dynamic queries, over-privileged service credentials, and
policies that effectively allow all rows.

Prefer user/tenant-scoped policies, backend permission checks, parameterized
queries, and least-privilege database roles.

### 4. Inputs, uploads, redirects, and outbound requests

Check for missing server-side schema validation, mass assignment, client-set
role/credit/price/admin fields, unsafe redirects, SSRF, and uploads without size,
content/type, naming, or storage controls.

Prefer allowlisted fields, server-derived privileged values, bounded uploads,
random storage names, content verification, redirect allowlists, and outbound
URL restrictions where user-controlled URLs are fetched.

### 5. Sessions, JWTs, webhooks, and rate controls

For JWT/session flows, check expiry, issuer/audience validation where relevant,
refresh/revocation behavior, secure storage, logout invalidation, and cookie
flags. When cookies carry authentication, also consider `HttpOnly`, `Secure`,
`SameSite`, and CSRF protection where applicable.

For webhooks, verify signature validation, replay/timestamp protection when
supported, idempotency, and that authorization is not inferred from payload
contents alone.

Apply rate limits to auth, signup, password reset, mutations, expensive AI
routes, and abuse-sensitive endpoints.

### 6. Infra, Docker, CI/CD, and production posture

Check for root containers, privileged mode, Docker socket mounts, secrets in
`ARG`/`ENV` or image layers, unsafe `COPY` patterns, unnecessary exposed ports,
over-broad CI permissions, untrusted PR workflows with secrets, debug mode,
stack traces, sensitive logs, and deploy credentials with excessive scope.

Prefer non-root runtime users, minimal images and permissions, secret stores or
runtime injection, scoped CI tokens, generic user-facing errors, and internal
monitoring.

### 7. Dependencies and supply chain

Watch for suspicious or typo-like packages, unnecessary new dependencies,
dangerous install scripts, unreviewed lockfile changes, abandoned packages, and
known vulnerable versions when dependency tooling is available.

Do not claim dependency safety if versions or advisories were not actually
checked; mark that area `NOT VERIFIED`.

### 8. AI and agent boundaries

When the application uses LLMs, agents, RAG, or tool calls, check for:
- model output passed directly into shell, SQL, code execution, URLs, or privileged APIs
- prompt/tool injection that can cause unauthorized actions or data disclosure
- secrets or sensitive documents unnecessarily placed in model context
- tools with broader permissions than the user or task requires
- authorization decisions delegated to the model
- untrusted retrieved content treated as instructions

Prefer deterministic authorization outside the model, strict tool schemas,
least-privilege tools, validation of model-produced arguments, separation of
instructions from untrusted content, and human confirmation for destructive or
high-impact actions when appropriate.

## Detection Heuristics

Start from changed files, then inspect nearby trust boundaries:
- client components, browser bundles, frontend env usage
- API routes, server actions, middleware, auth config
- database access, migrations, policies, seeds
- uploads, webhooks, redirects, outbound fetches, workers, cron jobs
- Docker, compose, CI, deploy, and runtime config
- AI prompts, RAG ingestion, tool definitions, agent permissions

When available, use repository search rather than visual inspection alone for
high-risk patterns. Load `references/detection-patterns.md` for concrete search
cues and stack-specific hints.

## Reporting Guidance

Prioritize by exploitability and blast radius. Use exact files and lines when
possible. Explain why the issue matters in plain language and give the safest
practical fix first.

Do not label a hardening opportunity as an exploitable vulnerability without
evidence. State residual risk, unreviewed areas, and `NOT VERIFIED` controls
instead of implying full coverage.

Match the user's language.

## Release Gate

Treat deployment as a distinct risk boundary. Before saying a project is ready
to ship, confirm at minimum:
- secrets and committed env files
- backend authentication and authorization
- database/RLS and tenant scoping
- input, upload, redirect, outbound request, and query safety
- CORS and rate-limit intent
- session/JWT and webhook controls when applicable
- Docker/CI/deploy secret handling
- production-safe logs and errors
- AI/tool boundaries when the product uses them

Use one release status:
- **BLOCKED:** unresolved Critical/High issue, or a required control is
  `NOT VERIFIED`.
- **READY WITH WARNINGS:** no known Critical/High issue, but Medium/Low or
  non-critical verification gaps remain.
- **READY:** required controls were reviewed with no material unresolved issue.

Never report `READY` when required security areas were not inspected.

## References

Use as needed:
- `references/security-checklist.md` for the full review checklist
- `references/detection-patterns.md` for code smells, grep cues, and remediation hints
