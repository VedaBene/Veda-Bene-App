# Security Checklist (Pre-Deploy & Hardening)

Use this checklist during explicit security audits or before approving any release.

## 1. Secrets & Environment Variables
- [ ] No secrets in frontend bundles or `NEXT_PUBLIC_` variables.
- [ ] `.env*` files with real keys are in `.gitignore` and not committed.
- [ ] No `service_role` keys, private keys, or DB passwords in client components.
- [ ] Build arguments or Docker stages do not leak secrets into image metadata/layers.

## 2. Authentication & Authorization (BOLA / IDOR)
- [ ] Server actions and API routes verify authentication using session tokens.
- [ ] Object-level authorization is enforced on every mutation and query (users cannot edit/view resources of others by changing IDs).
- [ ] Role-based access control (Admin/Manager/Technician) checked on backend/DAL, not just UI visibility.
- [ ] CORS policies restrict origins to trusted domains.

## 3. Database & Supabase / Postgres
- [ ] Row Level Security (RLS) enabled and verified on all public/exposed tables.
- [ ] No raw string concatenation in SQL queries (parameterized queries or ORM/DAL helpers used).
- [ ] Foreign keys and cascades are safe and non-destructive.
- [ ] Database role permissions follow the principle of least privilege.

## 4. Inputs, Uploads & Outbound Calls
- [ ] Schemas validated server-side (e.g. Zod) before database operations.
- [ ] Uploaded files checked for file size, MIME type, and safe extensions.
- [ ] Uploaded files saved with randomly generated UUIDs, avoiding path traversal.
- [ ] Open redirects and SSRF vectors prevented by allowlisting target URLs.

## 5. Sessions, JWTs & Webhooks
- [ ] Auth cookies use `HttpOnly`, `Secure`, and `SameSite=Lax/Strict`.
- [ ] Webhook endpoints verify cryptographic signatures (e.g. Stripe, Coolify, Supabase webhooks).
- [ ] Replay attacks mitigated with timestamps/idempotency keys.
- [ ] Rate limits configured on auth, password reset, and expensive API endpoints.

## 6. Docker & Infrastructure
- [ ] Containers run as non-root user where possible.
- [ ] No unnecessary ports exposed.
- [ ] Health checks configured properly.
- [ ] Production logs do not print passwords, tokens, full PII, or verbose error stack traces.

## 7. AI & Agent Boundaries
- [ ] LLM output is not executed directly in shell/eval or raw SQL.
- [ ] Tool call parameters validated against strict schemas before execution.
- [ ] Sensitive customer data or secret tokens excluded from prompt context where unnecessary.
