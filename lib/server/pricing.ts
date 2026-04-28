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

export type OrderPricingContext = {
  propertyId: string
  realGuests: number | null
  workedMinutes: number | null
  property: {
    base_price: number | null
    extra_per_person: number | null
    min_guests: number | null
  } | null
}

// Carrega num único select aninhado tudo que `calculateTotalPrice` precisa
// para uma OS já existente (update / updateExtraServices). Retorna null se
// a OS não existir.
//
// `overridePropertyId` cobre o caso em que o form de update troca o imóvel
// vinculado: nesse caso o pricing deve refletir o imóvel novo (do form),
// não o ainda persistido na OS. Quando o id passado bate com o atual,
// reaproveita o join e evita a query extra.
export async function loadOrderPricingContext(
  supabase: SupabaseServerClient,
  orderId: string,
  overridePropertyId?: string,
): Promise<OrderPricingContext | null> {
  const { data } = await supabase
    .from('service_orders')
    .select('property_id, real_guests, worked_minutes, property:properties(base_price, extra_per_person, min_guests)')
    .eq('id', orderId)
    .single()

  if (!data) return null

  type PricingFields = { base_price: number | null; extra_per_person: number | null; min_guests: number | null }
  let property = data.property as unknown as PricingFields | null

  if (overridePropertyId && overridePropertyId !== data.property_id) {
    const { data: overrideProp } = await supabase
      .from('properties')
      .select('base_price, extra_per_person, min_guests')
      .eq('id', overridePropertyId)
      .single()
    property = overrideProp ?? null
  }

  return {
    propertyId: overridePropertyId ?? data.property_id,
    realGuests: data.real_guests ?? null,
    workedMinutes: data.worked_minutes ?? null,
    property,
  }
}
