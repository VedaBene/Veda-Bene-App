'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAuthorizedClient } from '@/lib/server/authz'
import { calculateTotalPrice, loadOrderPricingContext, recalculateOrderPricing } from '@/lib/server/pricing'
import { saveServiceOrder } from '@/lib/server/service-orders/save-service-order'
import { captureQueryError, withLogging } from '@/lib/server/logger'
import { handleDatabaseError } from '@/lib/server/errors'
import { validateCleaningTrackingTransition } from '@/lib/service-order-tracking'
import { isCleaningPhotosEnabled } from '@/lib/server/features'
import { validateReadyPhotosForTransition } from '@/lib/server/service-order-photos'
import {
  deletePhotoObjects,
  listPhotoRecordsForOrder,
} from '@/lib/server/storage/service-order-photo-storage'
import {
  addServiceOrderTemporalIssues,
  nonNegativeMoneySchema,
  optRomeIsoDateTimeSchema,
  optionalDateOnlySchema,
  optionalNotesSchema,
  optionalUuidSchema,
  pricingModeSchema,
  uuidSchema,
  validationMessage,
} from '@/lib/server/validation/contracts'
import type { OSStatus, PricingMode } from '@/lib/types/database'

const optNum = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().min(0, 'Il valore non può essere negativo').optional(),
)
const intDef = (def = 0) =>
  z.preprocess(v => (v === '' || v == null ? def : Number(v)), z.number().int().min(0).default(def))

const serviceOrderSchema = z
  .object({
    property_id: z.string().min(1, 'Immobile obbligatorio').pipe(uuidSchema),
    cleaning_staff_ids: z.array(uuidSchema).max(3, 'Massimo 3 responsabili').default([]),
    consegna_staff_id: optionalUuidSchema,
    cleaning_date: optionalDateOnlySchema,
    checkout_at: optRomeIsoDateTimeSchema,
    checkin_at: optRomeIsoDateTimeSchema,
    real_guests: optNum,
    double_beds: intDef(0),
    single_beds: intDef(0),
    sofa_beds: intDef(0),
    armchair_beds: intDef(0),
    bathrooms: intDef(0),
    bidets: intDef(0),
    cribs: intDef(0),
    cleaning_notes: optionalNotesSchema.optional(),
    extra_services_description: optionalNotesSchema.optional(),
    extra_services_price: optNum,
    pricing_mode: pricingModeSchema.default('standard'),
  })
  .superRefine((data, ctx) => {
    addServiceOrderTemporalIssues(data.checkout_at, data.checkin_at, ctx)
  })

const extraServicesActionSchema = z.object({
  id: uuidSchema,
  description: optionalNotesSchema,
  price: nonNegativeMoneySchema,
  pricingMode: pricingModeSchema.default('standard'),
})

async function createServiceOrderImpl(formData: FormData) {
  const rawData = Object.fromEntries(formData)
  const cleaning_staff_ids = formData.getAll('cleaning_staff_ids').map(v => v.toString()).filter(Boolean)

  const parsed = serviceOrderSchema.safeParse({
    ...rawData,
    cleaning_staff_ids,
  })
  if (!parsed.success) return { success: false as const, error: validationMessage(parsed.error) }

  const result = await saveServiceOrder(parsed.data)
  if (!result.success) return { success: false as const, error: result.error }

  revalidatePath('/service-orders')
  redirect('/service-orders')
}

async function updateServiceOrderImpl(id: string, formData: FormData) {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: validationMessage(parsedId.error) }

  const rawData = Object.fromEntries(formData)
  const cleaning_staff_ids = formData.getAll('cleaning_staff_ids').map(v => v.toString()).filter(Boolean)

  const parsed = serviceOrderSchema.safeParse({
    ...rawData,
    cleaning_staff_ids,
  })
  if (!parsed.success) return { success: false as const, error: validationMessage(parsed.error) }

  const result = await saveServiceOrder({
    ...parsed.data,
    id: parsedId.data,
  })
  if (!result.success) return { success: false as const, error: result.error }

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${parsedId.data}`)
  return { success: true as const }
}

async function reopenServiceOrderImpl(id: string) {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: validationMessage(parsedId.error) }

  const { supabase } = await getAuthorizedClient()

  const { data: order, error: loadError } = await supabase
    .from('service_orders')
    .select('status, cleaning_cycle')
    .eq('id', parsedId.data)
    .maybeSingle()

  if (loadError) return { success: false as const, error: handleDatabaseError('service-orders', 'reopen:load', loadError) }
  if (!order) return { success: false as const, error: 'O.L. non trovato o non autorizzato.' }
  if (order.status !== 'done') return { success: false as const, error: 'Solo una pulizia completata può essere riaperta.' }

  const { data: reopenedOrder, error } = await supabase
    .from('service_orders')
    .update({
      status: 'open',
      started_at: null,
      completed_at: null,
      completion_notes: null,
      cleaning_cycle: order.cleaning_cycle + 1,
    })
    .eq('id', parsedId.data)
    .eq('status', 'done')
    .eq('cleaning_cycle', order.cleaning_cycle)
    .select('id')
    .maybeSingle()

  if (error) return { success: false as const, error: handleDatabaseError('service-orders', 'reopen:update', error) }
  if (!reopenedOrder) return { success: false as const, error: 'La O.L. è già stata riaperta da un altro operatore.' }

  await recalculateOrderPricing(parsedId.data)

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${parsedId.data}`)
  revalidatePath('/statements/receivable')
  revalidatePath('/statements/payable')
  revalidatePath('/dashboard')
  return { success: true as const }
}

async function startCleaningImpl(id: string, photoIds: string[] = []) {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: validationMessage(parsedId.error) }

  const { supabase, userId } = await getAuthorizedClient(['admin', 'secretaria', 'limpeza'])

  const { data: order, error: loadError } = await supabase
    .from('service_orders')
    .select('status, started_at, completed_at, cleaning_cycle')
    .eq('id', parsedId.data)
    .maybeSingle()

  if (loadError) return { success: false as const, error: handleDatabaseError('service-orders', 'start:load', loadError) }
  if (!order) return { success: false as const, error: 'O.L. non trovato o non autorizzato.' }

  const transitionError = validateCleaningTrackingTransition('start', {
    ...order,
    status: order.status as OSStatus,
  })
  if (transitionError) return { success: false as const, error: transitionError }

  if (photoIds.length > 0 && !isCleaningPhotosEnabled()) {
    return { success: false as const, error: 'La funzione foto non è attiva.' }
  }
  try {
    await validateReadyPhotosForTransition({
      serviceOrderId: parsedId.data,
      cycleNo: order.cleaning_cycle,
      phase: 'before',
      photoIds,
      uploadedBy: userId,
    })
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Foto non valide.' }
  }

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
    .eq('cleaning_cycle', order.cleaning_cycle)
    .select('id')
    .maybeSingle()

  if (error) return { success: false as const, error: handleDatabaseError('service-orders', 'start:update', error) }
  if (!updatedOrder) return { success: false as const, error: 'La pulizia è già stata avviata da un altro operatore.' }

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${parsedId.data}`)
  return { success: true as const }
}

async function finishCleaningImpl(id: string, notes: string, photoIds: string[] = []) {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: validationMessage(parsedId.error) }

  const parsedNotes = optionalNotesSchema.safeParse(notes)
  if (!parsedNotes.success) return { success: false as const, error: validationMessage(parsedNotes.error) }

  const { supabase, userId } = await getAuthorizedClient(['admin', 'secretaria', 'limpeza'])

  const { data: order, error: loadError } = await supabase
    .from('service_orders')
    .select('status, started_at, completed_at, cleaning_cycle')
    .eq('id', parsedId.data)
    .maybeSingle()

  if (loadError) return { success: false as const, error: handleDatabaseError('service-orders', 'finish:load', loadError) }
  if (!order) return { success: false as const, error: 'O.L. non trovato o non autorizzato.' }

  const transitionError = validateCleaningTrackingTransition('finish', {
    ...order,
    status: order.status as OSStatus,
  })
  if (transitionError) return { success: false as const, error: transitionError }

  if (photoIds.length > 0 && !isCleaningPhotosEnabled()) {
    return { success: false as const, error: 'La funzione foto non è attiva.' }
  }
  try {
    await validateReadyPhotosForTransition({
      serviceOrderId: parsedId.data,
      cycleNo: order.cleaning_cycle,
      phase: 'after',
      photoIds,
      uploadedBy: userId,
    })
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Foto non valide.' }
  }

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
    .eq('cleaning_cycle', order.cleaning_cycle)
    .select('id')
    .maybeSingle()

  if (error) return { success: false as const, error: handleDatabaseError('service-orders', 'finish:update', error) }
  if (!updatedOrder) return { success: false as const, error: 'La pulizia è già stata completata da un altro operatore.' }

  await recalculateOrderPricing(parsedId.data)

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

  const ctx = await loadOrderPricingContext(parsed.data.id)
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

  if (error) return { success: false as const, error: handleDatabaseError('service-orders', 'extra-services:update', error) }

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${parsed.data.id}`)
  revalidatePath('/statements/receivable')
  return { success: true as const }
}

async function deleteServiceOrderImpl(id: string) {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: validationMessage(parsedId.error) }

  const { supabase } = await getAuthorizedClient()

  let photoRecords
  try {
    photoRecords = await listPhotoRecordsForOrder(parsedId.data)
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Errore durante la verifica delle foto.' }
  }

  const { error } = await supabase.from('service_orders').delete().eq('id', parsedId.data)
  if (error) return { success: false as const, error: handleDatabaseError('service-orders', 'delete', error) }

  try {
    await deletePhotoObjects(photoRecords)
  } catch (cleanupError) {
    captureQueryError('service-orders', 'delete-photo-objects', cleanupError)
  }

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

export async function startCleaning(id: string, photoIds: string[] = []) {
  return withLogging('startCleaning', () => startCleaningImpl(id, photoIds))
}

export async function finishCleaning(id: string, notes: string, photoIds: string[] = []) {
  return withLogging('finishCleaning', () => finishCleaningImpl(id, notes, photoIds))
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
      cleaning_staff:profiles!service_order_cleaning_staff(full_name)
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

  const staffNames = (staffArr as Array<{ full_name: string }>).map(s => s.full_name).join(', ')

  return {
    orderNumber: data.order_number ?? 0,
    date: data.cleaning_date || data.completed_at?.split('T')[0] || '',
    staffName: staffNames || 'Non assegnato'
  }
}

export async function getLastCleaningForProperty(propertyId: string) {
  return withLogging('getLastCleaningForProperty', () => getLastCleaningForPropertyImpl(propertyId))
}
