import 'server-only'

import type { PricingMode } from '@/lib/types/database'
import {
  loadAuthorizedOrderPricingContext,
  persistAuthorizedServiceOrderTotalPrice,
  type OrderPricingContext,
} from '@/lib/server/data-access/sensitive-data'

const RIPASSO_RATE = 0.6
const OUT_LONG_STAY_HOURLY_RATE = 25
export const CONSEGNA_FEE = 10

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
  const cleaningPrice = PRICING_STRATEGIES[pricingMode]({
    basePrice,
    extraPerPerson,
    realGuests,
    minGuests,
    extras,
    workedMinutes,
  })
  return cleaningPrice == null ? null : cleaningPrice + CONSEGNA_FEE
}

// Recalcula `total_price` da OS quando dados do imóvel ou minutos trabalhados ficam disponíveis.
export async function recalculateOrderPricing(
  orderId: string,
): Promise<number | null> {
  const ctx = await loadOrderPricingContext(orderId)
  if (!ctx) return null

  const total_price = ctx.property
    ? calculateTotalPrice(
        ctx.pricingMode,
        ctx.property.base_price,
        ctx.property.extra_per_person,
        ctx.realGuests,
        ctx.property.min_guests,
        ctx.extraServicesPrice,
        ctx.workedMinutes,
      )
    : null

  await persistAuthorizedServiceOrderTotalPrice(orderId, total_price)
  return total_price
}

export type { OrderPricingContext }

// Carrega num único select aninhado tudo que `calculateTotalPrice` precisa
// para uma OS já existente (update / updateExtraServices). Retorna null se
// a OS não existir.
//
// `overridePropertyId` cobre o caso em que o form de update troca o imóvel
// vinculado: nesse caso o pricing deve refletir o imóvel novo (do form),
// não o ainda persistido na OS. Quando o id passado bate com o atual,
// reaproveita o join e evita a query extra.
export async function loadOrderPricingContext(
  orderId: string,
  overridePropertyId?: string,
): Promise<OrderPricingContext | null> {
  return loadAuthorizedOrderPricingContext(orderId, overridePropertyId)
}
