-- ============================================================
-- 02_indexes.sql
-- Indexes nas colunas usadas em políticas RLS para performance
-- ============================================================

CREATE INDEX ON public.profiles(role);
CREATE INDEX ON public.service_orders(cleaning_staff_id);
CREATE INDEX ON public.service_orders(consegna_staff_id);
CREATE INDEX ON public.service_orders(property_id);
CREATE INDEX ON public.service_orders(status);
CREATE INDEX ON public.service_orders(cleaning_date);
CREATE INDEX ON public.properties(agency_id);
CREATE INDEX ON public.properties(owner_id);
CREATE INDEX ON public.properties(client_type);
