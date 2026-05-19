import 'server-only'

import { toPropertyFormData, toPropertyListItem } from '@/lib/server/view-models'
import type { PropertyFormData, PropertyListItem } from '@/lib/types/view-models'
import type { SupabaseServerClient, Viewer } from './viewer'

export type PropertyListFilters = {
  page: number
  pageSize: number
  q?: string
}

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

function getPropertyListSelect(viewer: Viewer): string {
  if (viewer.role === 'admin') return 'id, name, zone, address, client_type, base_price'
  if (viewer.role === 'secretaria') return 'id, name, zone, address, client_type'
  return 'id, name, zone, address'
}

function getPropertyDetailSelect(viewer: Viewer): string {
  return [
    'id',
    'name',
    'zone',
    'address',
    'zip_code',
    'sqm_interior',
    'sqm_exterior',
    'sqm_total',
    'min_guests',
    'max_guests',
    'double_beds',
    'single_beds',
    'sofa_beds',
    'armchair_beds',
    'bathrooms',
    'bidets',
    'cribs',
    'bedrooms',
    'notes',
    ...(viewer.role === 'admin' || viewer.role === 'secretaria'
      ? ['client_type', 'agency_id', 'owner_id', 'phone']
      : []),
    ...(viewer.role === 'admin' ? ['base_price', 'extra_per_person', 'avg_cleaning_hours'] : []),
  ].join(', ')
}

export async function getPropertyList(
  supabase: SupabaseServerClient,
  viewer: Viewer,
  filters: PropertyListFilters,
): Promise<PropertyListResult> {
  const page = Math.max(1, filters.page)
  const from = (page - 1) * filters.pageSize
  const to = from + filters.pageSize - 1

  let query = supabase
    .from('properties')
    .select(getPropertyListSelect(viewer), { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.q) {
    query = query.ilike('name', `%${filters.q}%`)
  }

  const { data, count } = await query

  return {
    items: ((data ?? []) as unknown as PropertyFormData[]).map(property =>
      toPropertyListItem(property, viewer.role),
    ),
    totalPages: Math.ceil((count ?? 0) / filters.pageSize),
  }
}

export async function getPropertyDetail(
  supabase: SupabaseServerClient,
  viewer: Viewer,
  id: string,
): Promise<PropertyFormData | null> {
  const { data } = await supabase
    .from('properties')
    .select(getPropertyDetailSelect(viewer))
    .eq('id', id)
    .single()

  if (!data) return null

  return toPropertyFormData(data as unknown as PropertyFormData, viewer.role)
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
