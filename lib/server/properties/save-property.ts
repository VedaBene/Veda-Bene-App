import 'server-only'

import { z } from 'zod'
import { getAuthorizedClient } from '@/lib/server/authz'
import { clientTypeSchema, optionalUuidSchema, validationMessage } from '@/lib/server/validation/contracts'

export const ZONES = [
  'Saint Peter', 'Piazza Navona', 'Trastevere Area', 'Colosseum',
  'Spanish Steps', 'Trevi Fountain', "Campo de'Fiori", 'Parioli',
  'Termini Station', 'Other areas',
] as const

const optTrimmedStr = z.preprocess(
  v => (typeof v === 'string' ? (v.trim() === '' ? undefined : v.trim()) : v == null ? undefined : v),
  z.string().optional()
)

const optEmailStr = z.preprocess(
  v => (typeof v === 'string' ? (v.trim() === '' ? undefined : v.trim().toLowerCase()) : v == null ? undefined : v),
  z.string().email('Formato email non valido').optional()
)

const optNum = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().min(0, 'Il valore non può essere negativo').optional()
)

const intDef = (def = 0) =>
  z.preprocess(
    v => (v === '' || v == null ? def : Number(v)),
    z.number().int('Deve essere un numero intero').min(0, 'Non può essere negativo').default(def)
  )

export const savePropertySchema = z.object({
  id: optionalUuidSchema,
  name: z.preprocess(
    v => (typeof v === 'string' ? v.trim() : v),
    z.string().min(1, 'Nome obbligatorio')
  ),
  client_type: clientTypeSchema,
  zone: z.enum(ZONES, { message: 'Zona non valida' }),
  phone: optTrimmedStr,
  email: optEmailStr,
  address: optTrimmedStr,
  zip_code: optTrimmedStr,
  // rental
  agency_id: optionalUuidSchema,
  new_agency_name: optTrimmedStr,
  new_agency_email: optEmailStr,
  existing_agency_email: optEmailStr,
  // particular
  owner_id: optionalUuidSchema,
  new_owner_name: optTrimmedStr,
  new_owner_email: optEmailStr,
  existing_owner_email: optEmailStr,
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
  notes: optTrimmedStr,
})

export type SavePropertyInput = z.infer<typeof savePropertySchema>

export type SavePropertyResult =
  | { success: true; propertyId: string }
  | { success: false; error: string }

export async function saveProperty(
  input: unknown,
): Promise<SavePropertyResult> {
  const parsed = savePropertySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: validationMessage(parsed.error) }
  }

  const data = parsed.data
  const { supabase } = await getAuthorizedClient(['admin'])

  const { data: resultId, error } = await supabase.rpc('save_property_atomic', {
    p_property_id: data.id ?? null,
    p_name: data.name,
    p_client_type: data.client_type,
    p_zone: data.zone,
    p_phone: data.phone ?? null,
    p_email: data.email ?? null,
    p_address: data.address ?? null,
    p_zip_code: data.zip_code ?? null,
    // rental
    p_agency_id: data.client_type === 'rental' ? (data.agency_id ?? null) : null,
    p_new_agency_name: data.client_type === 'rental' ? (data.new_agency_name ?? null) : null,
    p_new_agency_email: data.client_type === 'rental' ? (data.new_agency_email ?? null) : null,
    p_existing_agency_email: data.client_type === 'rental' ? (data.existing_agency_email ?? null) : null,
    // particular
    p_owner_id: data.client_type === 'particular' ? (data.owner_id ?? null) : null,
    p_new_owner_name: data.client_type === 'particular' ? (data.new_owner_name ?? null) : null,
    p_new_owner_email: data.client_type === 'particular' ? (data.new_owner_email ?? null) : null,
    p_existing_owner_email: data.client_type === 'particular' ? (data.existing_owner_email ?? null) : null,
    // sqm
    p_sqm_interior: data.sqm_interior ?? null,
    p_sqm_exterior: data.sqm_exterior ?? null,
    p_sqm_total: data.sqm_total ?? null,
    // capacity
    p_min_guests: data.min_guests ?? null,
    p_max_guests: data.max_guests ?? null,
    p_double_beds: data.double_beds ?? 0,
    p_single_beds: data.single_beds ?? 0,
    p_sofa_beds: data.sofa_beds ?? 0,
    p_armchair_beds: data.armchair_beds ?? 0,
    p_bedrooms: data.bedrooms ?? 0,
    p_bathrooms: data.bathrooms ?? 0,
    p_bidets: data.bidets ?? 0,
    p_cribs: data.cribs ?? 0,
    // pricing
    p_base_price: data.base_price ?? null,
    p_extra_per_person: data.extra_per_person ?? null,
    p_avg_cleaning_hours: data.avg_cleaning_hours ?? null,
    // notes
    p_notes: data.notes ?? null,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  if (!resultId) {
    return { success: false, error: "Errore durante il salvataggio dell'immobile." }
  }

  return { success: true, propertyId: resultId as string }
}
