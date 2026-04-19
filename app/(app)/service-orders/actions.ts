'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import type { OSStatus, PricingMode } from '@/lib/types/database'

const RIPASSO_RATE = 0.6
const OUT_LONG_STAY_HOURLY_RATE = 25

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
  bathrooms: intDef(0),
  bidets: intDef(0),
  cribs: intDef(0),
  cleaning_notes: optStr,
  extra_services_description: optStr,
  extra_services_price: optNum,
  pricing_mode: z.enum(['standard', 'ripasso', 'out_long_stay']).default('standard'),
})

async function getAuthorizedClient() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'secretaria'].includes(profile.role)) {
    throw new Error('Sem permissão')
  }

  return { supabase, role: profile.role as 'admin' | 'secretaria' }
}

function calculateTotalPrice(
  pricingMode: PricingMode,
  basePrice: number | null,
  extraPerPerson: number | null,
  realGuests: number | null,
  minGuests: number | null,
  extraServicesPrice: number | null = null,
  workedMinutes: number | null = null,
): number | null {
  const extras = extraServicesPrice ?? 0

  if (pricingMode === 'ripasso') {
    if (basePrice == null) return null
    return basePrice * RIPASSO_RATE + extras
  }

  if (pricingMode === 'out_long_stay') {
    if (workedMinutes == null) return null
    return (workedMinutes / 60) * OUT_LONG_STAY_HOURLY_RATE + extras
  }

  if (basePrice == null) return null
  const extra = extraPerPerson ?? 0
  const guests = realGuests ?? 0
  const min = minGuests ?? 0
  return basePrice + extra * Math.max(0, guests - min) + extras
}

export async function createServiceOrder(formData: FormData) {
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

  const { data: os, error } = await supabase
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

  revalidatePath('/service-orders')
  redirect(`/service-orders/${os.id}`)
}

export async function updateServiceOrder(id: string, formData: FormData) {
  const { supabase } = await getAuthorizedClient()

  const parsed = serviceOrderSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message }

  const { data } = parsed

  const [{ data: property }, { data: current }] = await Promise.all([
    supabase
      .from('properties')
      .select('base_price, extra_per_person, min_guests')
      .eq('id', data.property_id)
      .single(),
    supabase.from('service_orders').select('worked_minutes').eq('id', id).single(),
  ])

  const total_price = property
    ? calculateTotalPrice(
        data.pricing_mode,
        property.base_price,
        property.extra_per_person,
        data.real_guests ?? null,
        property.min_guests,
        data.extra_services_price ?? null,
        current?.worked_minutes ?? null,
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

export async function updateServiceOrderStatus(id: string, status: OSStatus) {
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

export async function startCleaning(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'secretaria', 'limpeza', 'consegna'].includes(profile.role)) {
    return { success: false as const, error: 'Sem permissão' }
  }

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

export async function finishCleaning(id: string, notes: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'secretaria', 'limpeza', 'consegna'].includes(profile.role)) {
    return { success: false as const, error: 'Sem permissão' }
  }

  const { error } = await supabase
    .from('service_orders')
    .update({
      status: 'done',
      completed_at: new Date().toISOString(),
      completion_notes: notes.trim() || null,
    })
    .eq('id', id)

  if (error) return { success: false as const, error: error.message }

  // Out Long Stay: recalcula total_price agora que worked_minutes está disponível.
  const { data: finished } = await supabase
    .from('service_orders')
    .select('pricing_mode, worked_minutes, extra_services_price')
    .eq('id', id)
    .single()

  if (finished?.pricing_mode === 'out_long_stay') {
    const total_price = calculateTotalPrice(
      'out_long_stay',
      null,
      null,
      null,
      null,
      finished.extra_services_price ?? null,
      finished.worked_minutes ?? null,
    )
    await supabase.from('service_orders').update({ total_price }).eq('id', id)
  }

  revalidatePath('/service-orders')
  revalidatePath(`/service-orders/${id}`)
  revalidatePath('/statements/receivable')
  return { success: true as const }
}

export async function updateExtraServices(
  id: string,
  description: string,
  price: number,
  pricingMode: PricingMode = 'standard',
) {
  const { supabase } = await getAuthorizedClient()

  // Fetch the current order + property to recalculate total_price
  const { data: order } = await supabase
    .from('service_orders')
    .select('property_id, real_guests, worked_minutes')
    .eq('id', id)
    .single()

  if (!order) return { success: false as const, error: 'OS não encontrada' }

  const { data: property } = await supabase
    .from('properties')
    .select('base_price, extra_per_person, min_guests')
    .eq('id', order.property_id)
    .single()

  const total_price = property
    ? calculateTotalPrice(
        pricingMode,
        property.base_price,
        property.extra_per_person,
        order.real_guests,
        property.min_guests,
        price,
        order.worked_minutes ?? null,
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

export async function deleteServiceOrder(id: string) {
  const { supabase } = await getAuthorizedClient()

  const { error } = await supabase.from('service_orders').delete().eq('id', id)
  if (error) return { success: false as const, error: error.message }

  revalidatePath('/service-orders')
  redirect('/service-orders')
}
