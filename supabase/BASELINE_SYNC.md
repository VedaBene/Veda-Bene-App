# Supabase Baseline Sync

This repository was aligned to the remote migration history observed through the
Supabase MCP on 2026-04-22.

## What was synchronized

- Existing local migrations were renamed to timestamped filenames that match the
  remote history order.
- Missing remote entries were reconstructed locally:
  - `20260410005606_fix_staff_properties_access.sql`
  - `20260410022000_fix_role_permissions_v2.sql`
  - `20260410233431_seed_mock_data.sql`
  - `20260410234816_fix_rls_infinite_recursion.sql`

## Important caveat

`20260410233431_seed_mock_data.sql` is a no-op placeholder. The original seed
statements were not recoverable from this repository and were intentionally not
recreated from live project data.

## Pending local migration

The repository contains a local migration that is not yet present in the remote
history:

- `20260419170913_add_pricing_mode.sql`
