import type { PricingMode } from '@/lib/types/database'
import type { SupabaseServerClient } from '@/lib/server/authz'

const RIPASSO_RATE = 0.6
const OUT_LONG_STAY_HOURLY_RATE = 25

type PricingCtx = {
  basePrice: number | null
  extraPerPerson: number | null
  realGuests: number | null
  minGuests: number | null
  extras: number
  workedMinutes: number | null
}

const PRICING_STRATEGIES: Record<PricingMode, (ctx: PricingCtx) => number | null> = {
  standard: ({ basePrice, extraPerPerson, realGuests, minGuests, extras }) => {
    if (basePrice == null) return null
    const extra = extraPerPerson ?? 0
    const guests = realGuests ?? 0
    const min = minGuests ?? 0
    return basePrice + extra * Math.max(0, guests - min) + extras
  },
  ripasso: ({ basePrice, extras }) => {
    if (basePrice == null) return null
    return basePrice * RIPASSO_RATE + extras
  },
  out_long_stay: ({ workedMinutes, extras }) => {
    if (workedMinutes == null) return null
    return (workedMinutes / 60) * OUT_LONG_STAY_HOURLY_RATE + extras
  },
}

export function calculateTotalPrice(
  pricingMode: PricingMode,
  basePrice: number | null,
  extraPerPerson: number | null,
  realGuests: number | null,
  minGuests: number | null,
  extraServicesPrice: number | null = null,
  workedMinutes: number | null = null,
): number | null {
  const extras = extraServicesPrice ?? 0
  return PRICING_STRATEGIES[pricingMode]({
    basePrice,
    extraPerPerson,
    realGuests,
    minGuests,
    extras,
    workedMinutes,
  })
}

// Recalcula `total_price` da OS quando worked_minutes acabou de ficar disponível
// (caso `out_long_stay`). Para os demais modos é no-op — eles já tiveram o preço
// calculado em create/update e não dependem de worked_minutes.
export async function recalculateOrderPricing(
  supabase: SupabaseServerClient,
  orderId: string,
): Promise<number | null> {
  const { data: order } = await supabase
    .from('service_orders')
    .select('pricing_mode, worked_minutes, extra_services_price')
    .eq('id', orderId)
    .single()

  if (order?.pricing_mode !== 'out_long_stay') return null

  const total_price = calculateTotalPrice(
    'out_long_stay',
    null,
    null,
    null,
    null,
    order.extra_services_price ?? null,
    order.worked_minutes ?? null,
  )

  await supabase.from('service_orders').update({ total_price }).eq('id', orderId)
  return total_price
}
