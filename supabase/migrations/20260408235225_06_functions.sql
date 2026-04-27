CREATE OR REPLACE FUNCTION public.get_top_properties(
  start_date   DATE,
  end_date     DATE,
  limit_count  INT DEFAULT 5
)
RETURNS TABLE (
  property_id    UUID,
  property_name  TEXT,
  os_count       BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id          AS property_id,
    p.name        AS property_name,
    COUNT(so.id)  AS os_count
  FROM public.service_orders so
  JOIN public.properties p ON p.id = so.property_id
  WHERE so.status = 'done'
    AND so.cleaning_date >= start_date
    AND so.cleaning_date <= end_date
  GROUP BY p.id, p.name
  ORDER BY os_count DESC
  LIMIT limit_count;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_stats(
  target_month DATE
)
RETURNS TABLE (
  total_revenue       NUMERIC,
  total_hours_worked  NUMERIC,
  total_properties    BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(SUM(so.total_price), 0)       AS total_revenue,
    COALESCE(SUM(p.avg_cleaning_hours), 0) AS total_hours_worked,
    COUNT(DISTINCT so.property_id)         AS total_properties
  FROM public.service_orders so
  JOIN public.properties p ON p.id = so.property_id
  WHERE so.status = 'done'
    AND DATE_TRUNC('month', so.cleaning_date) = DATE_TRUNC('month', target_month);
$$;

GRANT EXECUTE ON FUNCTION public.get_top_properties TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_stats TO authenticated;;
