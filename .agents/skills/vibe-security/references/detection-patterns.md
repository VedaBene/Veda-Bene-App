# Detection Patterns & Code Smells

Quick grep patterns, code smells, and search cues for identifying security risks.

## 1. Secrets & Credentials
- **Pattern:** `NEXT_PUBLIC_.*(SECRET|KEY|PASSWORD|TOKEN|SERVICE_ROLE)`
- **Pattern:** `service_role`, `sb_secret_`, `SUPABASE_SERVICE_ROLE_KEY` in `app/`, `components/`, or client files (`use client`).
- **Fix:** Move secret calls to Server Actions, Route Handlers (`app/api/`), or dedicated server DAL modules.

## 2. Insecure Client-Side Authorization
- **Smell:** Rendering check only (`if (!isAdmin) return null;`) without verifying user role in server mutation/action.
- **Fix:** Call auth DAL/helper inside server action (`await requireAdmin()`).

## 3. SQL Injection & Dynamic Queries
- **Smell:** Template strings inside `execute_sql` or raw Postgres queries: `SELECT * FROM users WHERE id = '${id}'`.
- **Fix:** Use parameterized queries: `SELECT * FROM users WHERE id = $1` or Supabase SDK builder `.eq('id', id)`.

## 4. Unsafe Redirects (Open Redirects)
- **Smell:** `redirect(searchParams.get('returnUrl'))` or `window.location.href = url` without checking URL origin.
- **Fix:** Validate that redirect URLs start with `/` and not `//`, or check against an allowed hostnames list.

## 5. Dangerous Ingestion / SSRF
- **Smell:** `fetch(req.body.url)` without validating private IP blocks (127.0.0.1, 169.254.169.254, 10.0.0.0/8).
- **Fix:** Restrict protocols to `https:`, disallow internal/private CIDR ranges.

## 6. Docker & Container Permissions
- **Smell:** Missing `USER` directive in `Dockerfile` (running default `root`).
- **Fix:** Add dedicated system group and user (e.g. `USER nextjs` or `USER node`).
