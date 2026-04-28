'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAuthorizedClient } from '@/lib/server/authz'
import { calculateTotalPrice, loadOrderPricingContext, recalculateOrderPricing } from '@/lib/server/pricing'
import { withLogging } from '@/lib/server/logger'
import type { OSStatus, PricingMode } from '@/lib/types/database'

const optStr = z.preprocess(v => (v === '' ? undefined : v), z.string().optional())
const optNum = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().min(0).optional(),
)
const intDef = (def = 0) =>
  z.preprocess(v => (v === '' || v == null ? def : Number(v)), z.number().int().min(0).default(def))

const serviceOrderSchema = z.object({
  property_id: z.string().min(1, 'Imóvel obrigatório'),
  cleaning_staff_id: optStr,
  consegna_staff_id: optStr,
  cleaning_date: optStr,
  checkout_at: optStr,
  checkin_at: optStr,
  real_guests: optNum,
  double_beds: intDef(0),
  single_beds: intDef(0),
  sofa_beds: intDef(0),
  armchair_beds: intDef(0),
  bathrooms: intDef(0),
  bidets: intDef(0),
  cribs: intDef(0),
  cleaning_notes: optStr,
  extra_services_description: optStr,
  extra_services_price: optNum,
  pricing_mode: z.enum(['standard', 'ripasso', 'out_long_stay']).default('standard'),
})

async function createServiceOrderImpl(formData: FormData) {
  const { supabase } = await getAuthorizedClient()

  const parsed = serviceOrderSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message }

  const { data } = parsed

  const { data: property } = await supabase
    .from('properties')
    .select('base_price, extra_per_person, min_guests')
    .eq('id', data.property_id)
    .single()

  const total_price = property
    ? calculateTotalPrice(
        data.pricing_mode,
        property.base_price,
        property.extra_per_person,
        data.real_guests ?? null,
        property.min_guests,
        data.extra_services_price ?? null,
        null,
      )
    : null

  const { error } = await supabase
    .from('service_orders')
    .insert({
      property_id: data.property_id,
      cleaning_staff_id: data.cleaning_staff_id ?? null,
      consegna_staff_id: data.consegna_staff_id ?? null,
      cleaning_date: data.cleaning_date ?? null,
      checkout_at: data.checkout_at ?? null,
      checkin_at: data.checkin_at ?? null,
      status: 'open',
      real_guests: data.real_guests ?? null,
      double_beds: data.double_beds,
      single_beds: data.single_beds,
      sofa_beds: data.sofa_beds,
      armchair_beds: data.armchair_beds,
      bathrooms: data.bathrooms,
      bidets: data.bidets,
      cribs: data.cribs,
      cleaning_notes: data.cleaning_notes ?? null,
      extra_services_description: data.extra_services_description ?? null,
      extra_services_price: data.extra_services_price ?? 0,
      pricing_mode: data.pricing_mode,
      total_price,
    })

  if (error) return { success: false as const, error: error.message }

  revalidatePath('/service-orders')
  redirect('/service-orders')
}

async function updateServiceOrderImpl(id: string, formData: FormData) {
  const { supabase } = await getAuthorizedClient()

  const parsed = serviceOrderSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message }

  const { data } = parsed

  const ctx = await loadOrderPricingContext(supabase, id, data.property_id)
  const total_price = ctx?.property
    ? calculateTotalPrice(
        data.pricing_mode,
        ctx.property.base_price,
        ctx.property.extra_per_person,
        data.real_guests ?? null,
        ctx.property.min_guests,
        data.extra_services_price ?? null,
        ctx.workedMinutes,
      )
    : null

  const { error } = await supabase
    .from('service_orders')
    .update({
      property_id: data.property_id,
      cleaning_staff_id: data.cleaning_staff_id ?? null,
      consegna_staff_id: data.consegna_staff_id ?? null,
      cleaning_date: data.cleaning_date ?? null,
      checkout_at: data.checkout_at ?? null,
      checkin_at: data.checkin_at ?? null,
      real_guests: data.real_guests ?? null,
      double_beds: data.double_beds,
      single_beds: data.single_beds,
      sofa_beds: data.sofa_beds,
      armchair_beds: data.armchair_beds,
      bathrooms: data.bathrooms,
      bidets: data.bidets,
      cribs: data.cribs,
      cleaning_notes: data.cleaning_notes ?? null,
      extra_services_description: data.extra_services_description ?? null,
      extra_services_price: data.extra_services_price ?? 0,
      pricing_mode: data.pricing_mode,
      total_price,
    })
    .eq('id', id)

  if (error) return { success: false as const, error: error.message }

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${id}`)
  return { success: true as const }
}

async function updateServiceOrderStatusImpl(id: string, status: OSStatus) {
  const { supabase } = await getAuthorizedClient()

  const { error } = await supabase
    .from('service_orders')
    .update({
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) return { success: false as const, error: error.message }

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${id}`)
  return { success: true as const }
}

async function startCleaningImpl(id: string) {
  const { supabase } = await getAuthorizedClient(['admin', 'secretaria', 'limpeza'])

  const { error } = await supabase
    .from('service_orders')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { success: false as const, error: error.message }

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${id}`)
  return { success: true as const }
}

async function finishCleaningImpl(id: string, notes: string) {
  const { supabase } = await getAuthorizedClient(['admin', 'secretaria', 'limpeza'])

  const { error } = await supabase
    .from('service_orders')
    .update({
      status: 'done',
      completed_at: new Date().toISOString(),
      completion_notes: notes.trim() || null,
    })
    .eq('id', id)

  if (error) return { success: false as const, error: error.message }

  await recalculateOrderPricing(supabase, id)

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${id}`)
  revalidatePath('/statements/receivable')
  return { success: true as const }
}

async function updateExtraServicesImpl(
  id: string,
  description: string,
  price: number,
  pricingMode: PricingMode = 'standard',
) {
  const { supabase } = await getAuthorizedClient()

  const ctx = await loadOrderPricingContext(supabase, id)
  if (!ctx) return { success: false as const, error: 'OS não encontrada' }

  const total_price = ctx.property
    ? calculateTotalPrice(
        pricingMode,
        ctx.property.base_price,
        ctx.property.extra_per_person,
        ctx.realGuests,
        ctx.property.min_guests,
        price,
        ctx.workedMinutes,
      )
    : null

  const { error } = await supabase
    .from('service_orders')
    .update({
      extra_services_description: description.trim() || null,
      extra_services_price: price,
      pricing_mode: pricingMode,
      total_price,
    })
    .eq('id', id)

  if (error) return { success: false as const, error: error.message }

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${id}`)
  revalidatePath('/statements/receivable')
  return { success: true as const }
}

async function deleteServiceOrderImpl(id: string) {
  const { supabase } = await getAuthorizedClient()

  const { error } = await supabase.from('service_orders').delete().eq('id', id)
  if (error) return { success: false as const, error: error.message }

  revalidatePath('/service-orders')
  redirect('/service-orders')
}

export async function createServiceOrder(formData: FormData) {
  return withLogging('createServiceOrder', () => createServiceOrderImpl(formData))
}

export async function updateServiceOrder(id: string, formData: FormData) {
  return withLogging('updateServiceOrder', () => updateServiceOrderImpl(id, formData))
}

export async function updateServiceOrderStatus(id: string, status: OSStatus) {
  return withLogging('updateServiceOrderStatus', () => updateServiceOrderStatusImpl(id, status))
}

export async function startCleaning(id: string) {
  return withLogging('startCleaning', () => startCleaningImpl(id))
}

export async function finishCleaning(id: string, notes: string) {
  return withLogging('finishCleaning', () => finishCleaningImpl(id, notes))
}

export async function updateExtraServices(
  id: string,
  description: string,
  price: number,
  pricingMode: PricingMode = 'standard',
) {
  return withLogging('updateExtraServices', () =>
    updateExtraServicesImpl(id, description, price, pricingMode),
  )
}

export async function deleteServiceOrder(id: string) {
  return withLogging('deleteServiceOrder', () => deleteServiceOrderImpl(id))
}
