import 'server-only'

import { toServiceOrderFormData, toServiceOrderListItem } from '@/lib/server/view-models'
import type { ServiceOrderListFilters } from '@/lib/server/validation/contracts'
import type {
  ServiceOrderFormData,
  ServiceOrderListItem,
  ServiceOrderPropertyOption,
  StaffOption,
} from '@/lib/types/view-models'
import type { SupabaseServerClient, Viewer } from './viewer'

export type ServiceOrderListResult = {
  active: ServiceOrderListItem[]
  done: ServiceOrderListItem[]
  doneTotalPages: number
}

export type ServiceOrderFormOptions = {
  properties: ServiceOrderPropertyOption[]
  staff: StaffOption[]
}

const SERVICE_ORDER_LIST_SELECT = `
  id,
  cleaning_staff_id,
  consegna_staff_id,
  cleaning_date,
  checkout_at,
  checkin_at,
  status,
  real_guests,
  double_beds,
  single_beds,
  sofa_beds,
  armchair_beds,
  bathrooms,
  bidets,
  cribs,
  order_number,
  is_urgent,
  started_at,
  worked_minutes,
  pricing_mode,
  property:properties(id, name, avg_cleaning_hours),
  cleaning_staff:profiles!cleaning_staff_id(id, full_name),
  consegna_staff:profiles!consegna_staff_id(id, full_name)
`

function getServiceOrderDetailSelect(viewer: Viewer): string {
  const isAdminOrSecretaria = viewer.role === 'admin' || viewer.role === 'secretaria'

  return [
    'id',
    'property_id',
    'cleaning_staff_id',
    'consegna_staff_id',
    'cleaning_date',
    'checkout_at',
    'checkin_at',
    'status',
    'real_guests',
    'double_beds',
    'single_beds',
    'sofa_beds',
    'armchair_beds',
    'bathrooms',
    'bidets',
    'cribs',
    'order_number',
    'is_urgent',
    'started_at',
    'completed_at',
    'completion_notes',
    'worked_minutes',
    'pricing_mode',
    ...(isAdminOrSecretaria
      ? ['cleaning_notes', 'extra_services_description', 'extra_services_price']
      : []),
  ].join(', ')
}

function getServiceOrderPropertyOptionSelect(viewer: Viewer): string {
  const common =
    'id, name, min_guests, max_guests, double_beds, single_beds, sofa_beds, armchair_beds, bathrooms, bidets, cribs'

  if (viewer.role === 'cliente') return common

  const withHours = `id, name, avg_cleaning_hours, min_guests, max_guests, double_beds, single_beds, sofa_beds, armchair_beds, bathrooms, bidets, cribs`
  if (viewer.role === 'admin') return `${withHours}, base_price`
  return withHours
}

async function getMatchingPropertyIds(
  supabase: SupabaseServerClient,
  q?: string,
): Promise<string[] | null> {
  if (!q) return null

  const { data } = await supabase
    .from('properties')
    .select('id')
    .ilike('name', `%${q}%`)

  return (data ?? []).map((property: { id: string }) => property.id)
}

export async function getServiceOrderList(
  supabase: SupabaseServerClient,
  viewer: Viewer,
  filters: ServiceOrderListFilters,
): Promise<ServiceOrderListResult> {
  const donePage = Math.max(1, filters.donePage)
  const doneFrom = (donePage - 1) * filters.donePageSize
  const doneTo = doneFrom + filters.donePageSize - 1

  const activeQuery = supabase
    .from('service_orders')
    .select(SERVICE_ORDER_LIST_SELECT)
    .in('status', ['open', 'in_progress'])
    .order('cleaning_date', { ascending: false })

  const propertyIds = await getMatchingPropertyIds(supabase, filters.q)

  let doneQuery = supabase
    .from('service_orders')
    .select(SERVICE_ORDER_LIST_SELECT, { count: 'exact' })
    .eq('status', 'done')
    .order('cleaning_date', { ascending: false })
    .range(doneFrom, doneTo)

  if (propertyIds !== null) {
    doneQuery = doneQuery.in(
      'property_id',
      propertyIds.length > 0 ? propertyIds : ['00000000-0000-0000-0000-000000000000'],
    )
  }

  if (filters.date) {
    doneQuery = doneQuery.eq('cleaning_date', filters.date)
  }

  const [{ data: activeOrders }, { data: doneOrders, count: doneCount }] = await Promise.all([
    activeQuery,
    doneQuery,
  ])

  return {
    active: ((activeOrders ?? []) as unknown as ServiceOrderListItem[]).map(order =>
      toServiceOrderListItem(order, viewer.role),
    ),
    done: ((doneOrders ?? []) as unknown as ServiceOrderListItem[]).map(order =>
      toServiceOrderListItem(order, viewer.role),
    ),
    doneTotalPages: Math.ceil((doneCount ?? 0) / filters.donePageSize),
  }
}

export async function getServiceOrderDetail(
  supabase: SupabaseServerClient,
  viewer: Viewer,
  id: string,
): Promise<ServiceOrderFormData | null> {
  const { data } = await supabase
    .from('service_orders')
    .select(getServiceOrderDetailSelect(viewer))
    .eq('id', id)
    .single()

  if (!data) return null

  return toServiceOrderFormData(data as unknown as ServiceOrderFormData, viewer.role, viewer.userId)
}

export async function getServiceOrderFormOptions(
  supabase: SupabaseServerClient,
  viewer: Viewer,
): Promise<ServiceOrderFormOptions> {
  const [{ data: properties }, { data: staff }] = await Promise.all([
    supabase
      .from('properties')
      .select(getServiceOrderPropertyOptionSelect(viewer))
      .order('name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['limpeza', 'consegna'])
      .order('full_name'),
  ])

  return {
    properties: (properties ?? []) as unknown as ServiceOrderPropertyOption[],
    staff: (staff ?? []) as StaffOption[],
  }
}
