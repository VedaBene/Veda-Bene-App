'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAuthorizedClient } from '@/lib/server/authz'
import { calculateTotalPrice, loadOrderPricingContext, recalculateOrderPricing } from '@/lib/server/pricing'
import { withLogging } from '@/lib/server/logger'
import {
  nonNegativeMoneySchema,
  optionalDateOnlySchema,
  optionalNotesSchema,
  optionalUuidSchema,
  osStatusSchema,
  pricingModeSchema,
  uuidSchema,
  validationMessage,
} from '@/lib/server/validation/contracts'
import type { OSStatus, PricingMode } from '@/lib/types/database'

const optStr = z.preprocess(v => (v === '' ? undefined : v), z.string().optional())
const optNum = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().min(0).optional(),
)
const intDef = (def = 0) =>
  z.preprocess(v => (v === '' || v == null ? def : Number(v)), z.number().int().min(0).default(def))

const serviceOrderSchema = z.object({
  property_id: z.string().min(1, 'Immobile obbligatorio').pipe(uuidSchema),
  cleaning_staff_id: optionalUuidSchema,
  consegna_staff_id: optionalUuidSchema,
  cleaning_date: optionalDateOnlySchema,
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
  pricing_mode: pricingModeSchema.default('standard'),
})

const extraServicesActionSchema = z.object({
  id: uuidSchema,
  description: optionalNotesSchema,
  price: nonNegativeMoneySchema,
  pricingMode: pricingModeSchema.default('standard'),
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
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: validationMessage(parsedId.error) }

  const { supabase } = await getAuthorizedClient()

  const parsed = serviceOrderSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message }

  const { data } = parsed

  const ctx = await loadOrderPricingContext(supabase, parsedId.data, data.property_id)
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
    .eq('id', parsedId.data)

  if (error) return { success: false as const, error: error.message }

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${parsedId.data}`)
  return { success: true as const }
}

async function updateServiceOrderStatusImpl(id: string, status: OSStatus) {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: validationMessage(parsedId.error) }

  const parsedStatus = osStatusSchema.safeParse(status)
  if (!parsedStatus.success) return { success: false as const, error: validationMessage(parsedStatus.error) }

  const { supabase } = await getAuthorizedClient()

  const { error } = await supabase
    .from('service_orders')
    .update({
      status: parsedStatus.data,
      completed_at: parsedStatus.data === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', parsedId.data)

  if (error) return { success: false as const, error: error.message }

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${parsedId.data}`)
  return { success: true as const }
}

async function startCleaningImpl(id: string) {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: validationMessage(parsedId.error) }

  const { supabase } = await getAuthorizedClient(['admin', 'secretaria', 'limpeza'])

  const { error } = await supabase
    .from('service_orders')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .eq('id', parsedId.data)

  if (error) return { success: false as const, error: error.message }

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${parsedId.data}`)
  return { success: true as const }
}

async function finishCleaningImpl(id: string, notes: string) {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: validationMessage(parsedId.error) }

  const parsedNotes = optionalNotesSchema.safeParse(notes)
  if (!parsedNotes.success) return { success: false as const, error: validationMessage(parsedNotes.error) }

  const { supabase } = await getAuthorizedClient(['admin', 'secretaria', 'limpeza'])

  const { error } = await supabase
    .from('service_orders')
    .update({
      status: 'done',
      completed_at: new Date().toISOString(),
      completion_notes: parsedNotes.data.trim() || null,
    })
    .eq('id', parsedId.data)

  if (error) return { success: false as const, error: error.message }

  await recalculateOrderPricing(supabase, parsedId.data)

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${parsedId.data}`)
  revalidatePath('/statements/receivable')
  return { success: true as const }
}

async function updateExtraServicesImpl(
  id: string,
  description: string,
  price: number,
  pricingMode: PricingMode = 'standard',
) {
  const parsed = extraServicesActionSchema.safeParse({ id, description, price, pricingMode })
  if (!parsed.success) return { success: false as const, error: validationMessage(parsed.error) }

  const { supabase } = await getAuthorizedClient()

  const ctx = await loadOrderPricingContext(supabase, parsed.data.id)
  if (!ctx) return { success: false as const, error: 'O.L. non trovato' }

  const total_price = ctx.property
    ? calculateTotalPrice(
        parsed.data.pricingMode,
        ctx.property.base_price,
        ctx.property.extra_per_person,
        ctx.realGuests,
        ctx.property.min_guests,
        parsed.data.price,
        ctx.workedMinutes,
      )
    : null

  const { error } = await supabase
    .from('service_orders')
    .update({
      extra_services_description: parsed.data.description.trim() || null,
      extra_services_price: parsed.data.price,
      pricing_mode: parsed.data.pricingMode,
      total_price,
    })
    .eq('id', parsed.data.id)

  if (error) return { success: false as const, error: error.message }

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${parsed.data.id}`)
  revalidatePath('/statements/receivable')
  return { success: true as const }
}

async function deleteServiceOrderImpl(id: string) {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: validationMessage(parsedId.error) }

  const { supabase } = await getAuthorizedClient()

  const { error } = await supabase.from('service_orders').delete().eq('id', parsedId.data)
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

async function getLastCleaningForPropertyImpl(propertyId: string) {
  const parsed = uuidSchema.safeParse(propertyId)
  if (!parsed.success) return null

  const { supabase } = await getAuthorizedClient(['admin', 'secretaria'])

  const { data } = await supabase
    .from('service_orders')
    .select(`
      order_number,
      cleaning_date,
      completed_at,
      cleaning_staff:profiles!cleaning_staff_id(full_name)
    `)
    .eq('property_id', parsed.data)
    .eq('status', 'done')
    .order('cleaning_date', { ascending: false, nullsFirst: false })
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const cleaningStaff = data.cleaning_staff as { full_name: string } | null

  return {
    orderNumber: data.order_number,
    date: data.cleaning_date || data.completed_at?.split('T')[0] || '',
    staffName: cleaningStaff?.full_name || 'Non assegnato'
  }
}

export async function getLastCleaningForProperty(propertyId: string) {
  return withLogging('getLastCleaningForProperty', () => getLastCleaningForPropertyImpl(propertyId))
}

