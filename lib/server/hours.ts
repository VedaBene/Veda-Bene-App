// Regra única para resolver "horas trabalhadas" de uma OS:
// usa worked_minutes/60 quando registrado; caso contrário cai para o
// avg_cleaning_hours do imóvel; se nenhum dos dois existir, retorna 0.
export function resolveOrderHours(
  order: { worked_minutes: number | null },
  property: { avg_cleaning_hours: number | null } | null | undefined,
): number {
  if (order.worked_minutes != null) return order.worked_minutes / 60
  return property?.avg_cleaning_hours ?? 0
}
