'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import type { OSStatus } from '@/lib/types/database'

const optStr = z.preprocess(v => (v === '' ? undefined : v), z.string().optional())
const optNum = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().min(0).optional(),
)
const intDef = (def = 0) =>
  z.preprocess(v => (v === '' || v == null ? def : Number(v)), z.number().int().min(0).default(def))

const serviceOrderSchema = z.object({
  property_id: z.string().uuid('Imóvel obrigatório'),
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
  basePrice: number | null,
  extraPerPerson: number | null,
  realGuests: number | null,
  minGuests: number | null,
): number | null {
  if (basePrice == null) return null
  const extra = extraPerPerson ?? 0
  const guests = realGuests ?? 0
  const min = minGuests ?? 0
  return basePrice + extra * Math.max(0, guests - min)
}

export async function createServiceOrder(formData: FormData) {
  const { supabase } = await getAuthorizedClient()

  const parsed = serviceOrderSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false as const, error: parsed.error.errors[0].message }

  const { data } = parsed

  const { data: property } = await supabase
    .from('properties')
    .select('base_price, extra_per_person, min_guests')
    .eq('id', data.property_id)
    .single()

  const total_price = property
    ? calculateTotalPrice(
        property.base_price,
        property.extra_per_person,
        data.real_guests ?? null,
        property.min_guests,
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
  if (!parsed.success) return { success: false as const, error: parsed.error.errors[0].message }

  const { data } = parsed

  const { data: property } = await supabase
    .from('properties')
    .select('base_price, extra_per_person, min_guests')
    .eq('id', data.property_id)
    .single()

  const total_price = property
    ? calculateTotalPrice(
        property.base_price,
        property.extra_per_person,
        data.real_guests ?? null,
        property.min_guests,
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

export async function deleteServiceOrder(id: string) {
  const { supabase, role } = await getAuthorizedClient()

  if (role !== 'admin') return { success: false as const, error: 'Apenas admin pode excluir' }

  const { error } = await supabase.from('service_orders').delete().eq('id', id)
  if (error) return { success: false as const, error: error.message }

  revalidatePath('/service-orders')
  redirect('/service-orders')
}
