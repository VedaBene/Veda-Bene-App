'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAuthorizedClient } from '@/lib/server/authz'
import { calculateTotalPrice, loadOrderPricingContext, recalculateOrderPricing } from '@/lib/server/pricing'
import { withLogging } from '@/lib/server/logger'
import { validateCleaningTrackingTransition } from '@/lib/service-order-tracking'
import {
  nonNegativeMoneySchema,
  optionalDateOnlySchema,
  optionalNotesSchema,
  optionalUuidSchema,
  pricingModeSchema,
  uuidSchema,
  validationMessage,
} from '@/lib/server/validation/contracts'
import type { PricingMode } from '@/lib/types/database'

const optStr = z.preprocess(v => (v === '' ? undefined : v), z.string().optional())
const optNum = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().min(0).optional(),
)
const intDef = (def = 0) =>
  z.preprocess(v => (v === '' || v == null ? def : Number(v)), z.number().int().min(0).default(def))

const serviceOrderSchema = z.object({
  property_id: z.string().min(1, 'Immobile obbligatorio').pipe(uuidSchema),
  cleaning_staff_ids: z.array(uuidSchema).max(3, 'Massimo 3 responsabili').default([]),
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

  const rawData = Object.fromEntries(formData)
  const cleaning_staff_ids = formData.getAll('cleaning_staff_ids').map(v => v.toString()).filter(Boolean)

  const parsed = serviceOrderSchema.safeParse({
    ...rawData,
    cleaning_staff_ids,
  })
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

  const { data: createdOrder, error } = await supabase
    .from('service_orders')
    .insert({
      property_id: data.property_id,
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
    .select('id')
    .single()

  if (error) return { success: false as const, error: error.message }

  if (data.cleaning_staff_ids.length > 0 && createdOrder) {
    const relations = data.cleaning_staff_ids.map(profileId => ({
      service_order_id: createdOrder.id,
      profile_id: profileId,
    }))
    const { error: relError } = await supabase
      .from('service_order_cleaning_staff')
      .insert(relations)
    
    if (relError) return { success: false as const, error: relError.message }
  }

  revalidatePath('/service-orders')
  redirect('/service-orders')
}

async function updateServiceOrderImpl(id: string, formData: FormData) {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: validationMessage(parsedId.error) }

  const { supabase } = await getAuthorizedClient()

  const rawData = Object.fromEntries(formData)
  const cleaning_staff_ids = formData.getAll('cleaning_staff_ids').map(v => v.toString()).filter(Boolean)

  const parsed = serviceOrderSchema.safeParse({
    ...rawData,
    cleaning_staff_ids,
  })
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

  const { error: delError } = await supabase
    .from('service_order_cleaning_staff')
    .delete()
    .eq('service_order_id', parsedId.data)

  if (delError) return { success: false as const, error: delError.message }

  if (data.cleaning_staff_ids.length > 0) {
    const relations = data.cleaning_staff_ids.map(profileId => ({
      service_order_id: parsedId.data,
      profile_id: profileId,
    }))
    const { error: relError } = await supabase
      .from('service_order_cleaning_staff')
      .insert(relations)
    
    if (relError) return { success: false as const, error: relError.message }
  }

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${parsedId.data}`)
  return { success: true as const }
}

async function reopenServiceOrderImpl(id: string) {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: validationMessage(parsedId.error) }

  const { supabase } = await getAuthorizedClient()

  const { error } = await supabase
    .from('service_orders')
    .update({
      status: 'open',
      started_at: null,
      completed_at: null,
      completion_notes: null,
    })
    .eq('id', parsedId.data)

  if (error) return { success: false as const, error: error.message }

  await recalculateOrderPricing(supabase, parsedId.data)

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${parsedId.data}`)
  revalidatePath('/statements/receivable')
  revalidatePath('/statements/payable')
  revalidatePath('/dashboard')
  return { success: true as const }
}

async function startCleaningImpl(id: string) {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: validationMessage(parsedId.error) }

  const { supabase } = await getAuthorizedClient(['admin', 'secretaria', 'limpeza'])

  const { data: order, error: loadError } = await supabase
    .from('service_orders')
    .select('status, started_at, completed_at')
    .eq('id', parsedId.data)
    .maybeSingle()

  if (loadError) return { success: false as const, error: loadError.message }
  if (!order) return { success: false as const, error: 'O.L. non trovato o non autorizzato.' }

  const transitionError = validateCleaningTrackingTransition('start', order)
  if (transitionError) return { success: false as const, error: transitionError }

  const { data: updatedOrder, error } = await supabase
    .from('service_orders')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .eq('id', parsedId.data)
    .in('status', ['open', 'in_progress'])
    .is('started_at', null)
    .is('completed_at', null)
    .select('id')
    .maybeSingle()

  if (error) return { success: false as const, error: error.message }
  if (!updatedOrder) return { success: false as const, error: 'La pulizia è già stata avviata da un altro operatore.' }

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

  const { data: order, error: loadError } = await supabase
    .from('service_orders')
    .select('status, started_at, completed_at')
    .eq('id', parsedId.data)
    .maybeSingle()

  if (loadError) return { success: false as const, error: loadError.message }
  if (!order) return { success: false as const, error: 'O.L. non trovato o non autorizzato.' }

  const transitionError = validateCleaningTrackingTransition('finish', order)
  if (transitionError) return { success: false as const, error: transitionError }

  const { data: updatedOrder, error } = await supabase
    .from('service_orders')
    .update({
      status: 'done',
      completed_at: new Date().toISOString(),
      completion_notes: parsedNotes.data.trim() || null,
    })
    .eq('id', parsedId.data)
    .eq('status', 'in_progress')
    .not('started_at', 'is', null)
    .is('completed_at', null)
    .select('id')
    .maybeSingle()

  if (error) return { success: false as const, error: error.message }
  if (!updatedOrder) return { success: false as const, error: 'La pulizia è già stata completata da un altro operatore.' }

  await recalculateOrderPricing(supabase, parsedId.data)

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${parsedId.data}`)
  revalidatePath('/statements/receivable')
  revalidatePath('/statements/payable')
  revalidatePath('/dashboard')
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

export async function reopenServiceOrder(id: string) {
  return withLogging('reopenServiceOrder', () => reopenServiceOrderImpl(id))
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
      cleaning_staff:profiles(full_name)
    `)
    .eq('property_id', parsed.data)
    .eq('status', 'done')
    .order('cleaning_date', { ascending: false, nullsFirst: false })
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const staffArr = Array.isArray(data.cleaning_staff)
    ? data.cleaning_staff
    : data.cleaning_staff
      ? [data.cleaning_staff]
      : []

  const staffNames = (staffArr as unknown as { full_name: string }[]).map(s => s.full_name).join(', ')

  return {
    orderNumber: data.order_number,
    date: data.cleaning_date || data.completed_at?.split('T')[0] || '',
    staffName: staffNames || 'Non assegnato'
  }
}

export async function getLastCleaningForProperty(propertyId: string) {
  return withLogging('getLastCleaningForProperty', () => getLastCleaningForPropertyImpl(propertyId))
}

