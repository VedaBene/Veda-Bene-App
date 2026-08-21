-- Migration: 20260821100000_add_service_orders_checkin_idx.sql
-- Description: Adiciona índice parcial em checkin_at para otimizar buscas por data de check-in no perfil do cliente e no DAL.

BEGIN;

CREATE INDEX IF NOT EXISTS service_orders_checkin_at_idx
  ON public.service_orders (checkin_at)
  WHERE checkin_at IS NOT NULL;

COMMIT;
