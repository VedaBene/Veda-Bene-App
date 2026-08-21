import 'server-only'

import { toPropertyFormData, toPropertyListItem } from '@/lib/server/view-models'
import type { PropertyListFilters } from '@/lib/server/validation/contracts'
import type { PropertyFormData, PropertyListItem } from '@/lib/types/view-models'
import type { SupabaseServerClient, Viewer } from './viewer'
import {
  loadPropertyDetailForAdministration,
  loadPropertyListForAdministration,
} from './sensitive-data'

export type PropertyListResult = {
  items: PropertyListItem[]
  totalPages: number
}

export type ClientDirectoryOption = {
  id: string
  name: string
  email: string | null
}

export type PropertyFormOptions = {
  agencies: ClientDirectoryOption[]
  owners: ClientDirectoryOption[]
}

const PROPERTY_LIST_ADMIN_SELECT = 'id, name, zone, address, client_type'
const PROPERTY_LIST_STAFF_SELECT = 'id, name, zone, address'

const PROPERTY_DETAIL_STAFF_SELECT = `
  id,
  name,
  zone,
  address,
  zip_code,
  sqm_interior,
  sqm_exterior,
  sqm_total,
  min_guests,
  max_guests,
  double_beds,
  single_beds,
  sofa_beds,
  armchair_beds,
  bathrooms,
  bidets,
  cribs,
  bedrooms,
  notes,
  client_type,
  agency_id,
  owner_id,
  phone
`

export async function getPropertyList(
  supabase: SupabaseServerClient,
  viewer: Viewer,
  filters: PropertyListFilters,
): Promise<PropertyListResult> {
  if (viewer.role === 'admin') {
    const { rows, count } = await loadPropertyListForAdministration(filters)
    return {
      items: rows.map(property => toPropertyListItem(property, viewer.role)),
      totalPages: Math.ceil(count / filters.pageSize),
    }
  }

  const page = Math.max(1, filters.page)
  const from = (page - 1) * filters.pageSize
  const to = from + filters.pageSize - 1

  let query = (
    viewer.role === 'secretaria'
      ? supabase.from('properties').select('id, name, zone, address, client_type', { count: 'exact' })
      : supabase.from('properties').select('id, name, zone, address', { count: 'exact' })
  )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.q) {
    query = query.ilike('name', `%${filters.q}%`)
  }

  const { data, count } = await query

  return {
    items: ((data ?? []) as Array<Pick<PropertyFormData, 'id' | 'name' | 'zone' | 'address' | 'client_type'>>).map(
      property => toPropertyListItem(property, viewer.role),
    ),
    totalPages: Math.ceil((count ?? 0) / filters.pageSize),
  }
}

export async function getPropertyDetail(
  supabase: SupabaseServerClient,
  viewer: Viewer,
  id: string,
): Promise<PropertyFormData | null> {
  if (viewer.role === 'admin') {
    const property = await loadPropertyDetailForAdministration(id)
    return property ? toPropertyFormData(property, viewer.role) : null
  }

  const { data } = await supabase
    .from('properties')
    .select(PROPERTY_DETAIL_STAFF_SELECT)
    .eq('id', id)
    .single()

  if (!data) return null

  return toPropertyFormData(data as PropertyFormData, viewer.role)
}

export async function getPropertyFormOptions(
  supabase: SupabaseServerClient,
  viewer: Viewer,
): Promise<PropertyFormOptions> {
  if (viewer.role !== 'admin' && viewer.role !== 'secretaria') {
    return { agencies: [], owners: [] }
  }

  const [{ data: agencies }, { data: owners }] = await Promise.all([
    supabase.from('agencies').select('id, name, email').order('name'),
    supabase.from('owners').select('id, name, email').order('name'),
  ])

  return {
    agencies: agencies ?? [],
    owners: owners ?? [],
  }
}
