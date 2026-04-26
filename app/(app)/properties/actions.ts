'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'

const ZONES = [
  'Saint Peter', 'Piazza Navona', 'Trastevere Area', 'Colosseum',
  'Spanish Steps', 'Trevi Fountain', "Campo de'Fiori", 'Parioli',
  'Termini Station', 'Other areas',
] as const

const optStr = z.preprocess(v => (v === '' ? undefined : v), z.string().optional())
const optNum = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().min(0).optional()
)
const intDef = (def = 0) =>
  z.preprocess(v => (v === '' || v == null ? def : Number(v)), z.number().int().min(0).default(def))

const propertySchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  client_type: z.enum(['rental', 'particular']),
  zone: z.enum(ZONES),
  phone: optStr,
  email: optStr,
  address: optStr,
  zip_code: optStr,
  // rental
  agency_id: optStr,
  new_agency_name: optStr,
  new_agency_email: optStr,
  // particular
  owner_id: optStr,
  new_owner_name: optStr,
  new_owner_email: optStr,
  // metragem
  sqm_interior: optNum,
  sqm_exterior: optNum,
  sqm_total: optNum,
  // capacidade
  min_guests: optNum,
  max_guests: optNum,
  double_beds: intDef(0),
  single_beds: intDef(0),
  sofa_beds: intDef(0),
  armchair_beds: intDef(0),
  bathrooms: intDef(0),
  bidets: intDef(0),
  cribs: intDef(0),
  bedrooms: intDef(0),
  // precificação
  base_price: optNum,
  extra_per_person: optNum,
  avg_cleaning_hours: optNum,
  // notas
  notes: optStr,
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

async function resolveRelations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: z.infer<typeof propertySchema>,
) {
  let agency_id = data.agency_id ?? null
  let owner_id = data.owner_id ?? null

  if (data.client_type === 'rental' && data.new_agency_name) {
    const { data: a, error } = await supabase
      .from('agencies')
      .insert({
        name: data.new_agency_name,
        email: data.new_agency_email ?? null,
      })
      .select('id')
      .single()
    if (error) throw new Error('Erro ao criar agência: ' + error.message)
    agency_id = a.id
  }

  if (data.client_type === 'particular' && data.new_owner_name) {
    const { data: o, error } = await supabase
      .from('owners')
      .insert({
        name: data.new_owner_name,
        email: data.new_owner_email ?? null,
      })
      .select('id')
      .single()
    if (error) throw new Error('Erro ao criar proprietário: ' + error.message)
    owner_id = o.id
  }

  return { agency_id, owner_id }
}

function buildRecord(
  data: z.infer<typeof propertySchema>,
  agency_id: string | null,
  owner_id: string | null,
) {
  return {
    name: data.name,
    client_type: data.client_type,
    agency_id: data.client_type === 'rental' ? agency_id : null,
    owner_id: data.client_type === 'particular' ? owner_id : null,
    zone: data.zone,
    phone: data.phone ?? null,
    email: data.email ?? null,
    address: data.address ?? null,
    zip_code: data.zip_code ?? null,
    sqm_interior: data.sqm_interior ?? null,
    sqm_exterior: data.sqm_exterior ?? null,
    sqm_total: data.sqm_total ?? null,
    min_guests: data.min_guests ?? null,
    max_guests: data.max_guests ?? null,
    double_beds: data.double_beds,
    single_beds: data.single_beds,
    sofa_beds: data.sofa_beds,
    armchair_beds: data.armchair_beds,
    bathrooms: data.bathrooms,
    bidets: data.bidets,
    cribs: data.cribs,
    bedrooms: data.bedrooms,
    base_price: data.base_price ?? null,
    extra_per_person: data.extra_per_person ?? null,
    avg_cleaning_hours: data.avg_cleaning_hours ?? null,
    notes: data.notes ?? null,
  }
}

export async function createProperty(formData: FormData) {
  const { supabase } = await getAuthorizedClient()

  const parsed = propertySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message }

  const { agency_id, owner_id } = await resolveRelations(supabase, parsed.data)

  const { data: property, error } = await supabase
    .from('properties')
    .insert(buildRecord(parsed.data, agency_id, owner_id))
    .select('id')
    .single()

  if (error) return { success: false as const, error: error.message }

  revalidatePath('/properties')
  redirect('/properties')
}

export async function updateProperty(id: string, formData: FormData) {
  const { supabase } = await getAuthorizedClient()

  const parsed = propertySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message }

  const { agency_id, owner_id } = await resolveRelations(supabase, parsed.data)

  const { error } = await supabase
    .from('properties')
    .update(buildRecord(parsed.data, agency_id, owner_id))
    .eq('id', id)

  if (error) return { success: false as const, error: error.message }

  revalidatePath('/properties')
  revalidatePath(`/properties/${id}`)
  return { success: true as const }
}

export async function deleteProperty(id: string) {
  const { supabase, role } = await getAuthorizedClient()

  if (role !== 'admin') return { success: false as const, error: 'Apenas admin pode excluir' }

  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) return { success: false as const, error: error.message }

  revalidatePath('/properties')
  redirect('/properties')
}
