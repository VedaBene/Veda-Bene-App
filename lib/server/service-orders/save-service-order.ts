import 'server-only'

import { getAuthorizedClient } from '@/lib/server/authz'
import { loadAuthorizedPropertyPricingContext } from '@/lib/server/data-access/sensitive-data'
import { calculateTotalPrice, loadOrderPricingContext } from '@/lib/server/pricing'
import type { PricingMode } from '@/lib/types/database'

export type SaveServiceOrderInput = {
  id?: string
  property_id: string
  cleaning_staff_ids: string[]
  consegna_staff_id?: string | null
  cleaning_date?: string | null
  checkout_at?: string | null
  checkin_at?: string | null
  real_guests?: number | null
  double_beds?: number
  single_beds?: number
  sofa_beds?: number
  armchair_beds?: number
  bedrooms?: number
  bathrooms?: number
  bidets?: number
  cribs?: number
  cleaning_notes?: string | null
  extra_services_description?: string | null
  extra_services_price?: number | null
  pricing_mode?: PricingMode
}

export type SaveServiceOrderResult =
  | { success: true; orderId: string }
  | { success: false; error: string }

export async function saveServiceOrder(
  input: SaveServiceOrderInput,
): Promise<SaveServiceOrderResult> {
  const { supabase } = await getAuthorizedClient(['admin', 'secretaria'])

  const pricingMode = input.pricing_mode ?? 'standard'
  let total_price: number | null = null

  if (input.id) {
    const ctx = await loadOrderPricingContext(input.id, input.property_id)
    if (ctx?.property) {
      total_price = calculateTotalPrice(
        pricingMode,
        ctx.property.base_price,
        ctx.property.extra_per_person,
        input.real_guests ?? null,
        ctx.property.min_guests,
        input.extra_services_price ?? null,
        ctx.workedMinutes,
      )
    }
  } else {
    const property = await loadAuthorizedPropertyPricingContext(input.property_id)
    if (property) {
      total_price = calculateTotalPrice(
        pricingMode,
        property.base_price,
        property.extra_per_person,
        input.real_guests ?? null,
        property.min_guests,
        input.extra_services_price ?? null,
        null,
      )
    }
  }

  const { data, error } = await supabase.rpc('save_service_order_atomic', {
    p_order_id: input.id ?? null,
    p_property_id: input.property_id,
    p_cleaning_staff_ids: input.cleaning_staff_ids ?? [],
    p_consegna_staff_id: input.consegna_staff_id ?? null,
    p_cleaning_date: input.cleaning_date ?? null,
    p_checkout_at: input.checkout_at ?? null,
    p_checkin_at: input.checkin_at ?? null,
    p_real_guests: input.real_guests ?? null,
    p_double_beds: input.double_beds ?? 0,
    p_single_beds: input.single_beds ?? 0,
    p_sofa_beds: input.sofa_beds ?? 0,
    p_armchair_beds: input.armchair_beds ?? 0,
    p_bedrooms: input.bedrooms ?? 0,
    p_bathrooms: input.bathrooms ?? 0,
    p_bidets: input.bidets ?? 0,
    p_cribs: input.cribs ?? 0,
    p_cleaning_notes: input.cleaning_notes ?? null,
    p_extra_services_description: input.extra_services_description ?? null,
    p_extra_services_price: input.extra_services_price ?? 0,
    p_pricing_mode: pricingMode,
    p_total_price: total_price,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  if (!data) {
    return { success: false, error: 'Errore durante il salvataggio della O.L.' }
  }

  return { success: true, orderId: data as string }
}
