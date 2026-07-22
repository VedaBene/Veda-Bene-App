# Supabase Baseline Sync

This repository was reconciled against the remote migration history observed via
the Supabase CLI on 2026-04-27.

## What was synchronized

- The remote migration files missing from this checkout were fetched locally:
  - `20260423003950_harden_supabase_security_surface.sql`
  - `20260426100434_fix_properties_cliente_select_use_helper.sql`
  - `20260426111348_staff_peer_visibility_consegna_readonly.sql`
- Earlier local copies with mismatched timestamps were removed:
  - `20260422120000_harden_supabase_security_surface.sql`
  - `20260426120000_fix_properties_cliente_select_use_helper.sql`
  - `20260426130000_staff_peer_visibility_consegna_readonly.sql`
- Historical migrations that had been reconstructed locally were replaced with
  the canonical SQL fetched from remote history, including
  `20260410233431_seed_mock_data.sql`.

## Migration history repair

The production schema already contained the `pricing_mode` column on
`public.service_orders`, but the migration history table did not list
`20260419170913_add_pricing_mode.sql`.

This version was marked as `applied` in the remote migration history during the
2026-04-27 reconciliation.

## Security hardening migrations

The following security hardening migrations were applied after reconciliation:

- `20260427100000_move_rls_helpers_to_private_schema.sql`
- `20260427110000_revoke_remaining_public_security_definers.sql`

After these migrations, the local and remote migration histories are aligned
through `20260427110000`.

## Reconciliation on 2026-07-21

The SQL recorded in the remote migration history was compared with the local
files for the two later migrations below. Their contents matched; only the local
timestamps differed. The files were renamed locally to the canonical versions
already recorded in production:

- `20260702010536_multi_staff_cleaning.sql`
- `20260712033748_add_consegna_fee_to_service_orders.sql`

No SQL was executed and no production migration history was edited during this
reconciliation.
