// Horas operacionais de uma OS: usa worked_minutes/60 quando registrado;
// caso contrário cai para o avg_cleaning_hours do imóvel.
export function resolveOrderHours(
  order: { worked_minutes: number | null },
  property: { avg_cleaning_hours: number | null } | null | undefined,
): number {
  if (order.worked_minutes != null) return order.worked_minutes / 60
  return property?.avg_cleaning_hours ?? 0
}

// Horas consideradas para remuneração: sempre usa o tempo médio do imóvel.
export function resolveOrderPayableHours(
  property: { avg_cleaning_hours: number | null } | null | undefined,
): number {
  return property?.avg_cleaning_hours ?? 0
}
