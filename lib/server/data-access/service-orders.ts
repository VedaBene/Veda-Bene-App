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
  doneForExport: ServiceOrderListItem[]
  doneTotalPages: number
  doneTotalCount: number
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
  completed_at,
  worked_minutes,
  pricing_mode,
  cleaning_notes,
  property:properties(id, name, avg_cleaning_hours),
  cleaning_staff:profiles!service_order_cleaning_staff(id, full_name),
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
    'consegna_fee',
    'cleaning_notes',
    ...(isAdminOrSecretaria
      ? ['extra_services_description', 'extra_services_price']
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
  const todayStr = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Rome' }).format(new Date())
  const isFilterActive = !!(
    filters.propertyId || filters.cleaningStaffId || filters.consegnaStaffId ||
    filters.startDate || filters.endDate || filters.q
  )

  let cleaningOrderIds: string[] | null = null
  if (filters.cleaningStaffId) {
    const { data } = await supabase
      .from('service_order_cleaning_staff')
      .select('service_order_id')
      .eq('profile_id', filters.cleaningStaffId)
    cleaningOrderIds = (data ?? []).map((row: { service_order_id: string }) => row.service_order_id)
  }

  const matchingPropertyIds = filters.q
    ? await getMatchingPropertyIds(supabase, filters.q)
    : null
  const noMatchesId = '00000000-0000-0000-0000-000000000000'

  let activeQuery = supabase
    .from('service_orders')
    .select(SERVICE_ORDER_LIST_SELECT)
    .in('status', ['open', 'in_progress'])
    .order('cleaning_date', { ascending: false, nullsFirst: false })

  let doneQuery = supabase
    .from('service_orders')
    .select(SERVICE_ORDER_LIST_SELECT, { count: 'exact' })
    .eq('status', 'done')
    .order('cleaning_date', { ascending: false, nullsFirst: false })

  let doneExportQuery = supabase
    .from('service_orders')
    .select(SERVICE_ORDER_LIST_SELECT)
    .eq('status', 'done')
    .order('cleaning_date', { ascending: false, nullsFirst: false })

  for (const queryName of ['active', 'done', 'doneExport'] as const) {
    let query = queryName === 'active' ? activeQuery : queryName === 'done' ? doneQuery : doneExportQuery
    if (filters.propertyId) query = query.eq('property_id', filters.propertyId)
    if (filters.consegnaStaffId) query = query.eq('consegna_staff_id', filters.consegnaStaffId)
    if (filters.cleaningStaffId) {
      query = query.in('id', cleaningOrderIds?.length ? cleaningOrderIds : [noMatchesId])
    }
    if (filters.q) {
      query = query.in('property_id', matchingPropertyIds?.length ? matchingPropertyIds : [noMatchesId])
    }
    if (filters.startDate) query = query.gte('cleaning_date', filters.startDate)
    if (filters.endDate) query = query.lte('cleaning_date', filters.endDate)

    if (queryName === 'active') activeQuery = query
    else if (queryName === 'done') doneQuery = query
    else doneExportQuery = query
  }

  if (isFilterActive) {
    const donePage = Math.max(1, filters.donePage)
    const doneFrom = (donePage - 1) * filters.donePageSize
    const doneTo = doneFrom + filters.donePageSize - 1

    doneQuery = doneQuery.range(doneFrom, doneTo)
  } else {
    // Modo diário por padrão: apenas concluídas hoje
    doneQuery = doneQuery.eq('cleaning_date', todayStr)
    doneExportQuery = doneExportQuery.eq('cleaning_date', todayStr)
  }

  const [{ data: activeOrders }, { data: doneOrders, count: doneCount }, { data: doneExportOrders }] = await Promise.all([
    activeQuery,
    doneQuery,
    doneExportQuery,
  ])

  const doneTotalPages = isFilterActive
    ? Math.ceil((doneCount ?? 0) / filters.donePageSize)
    : 1

  return {
    active: ((activeOrders ?? []) as unknown as ServiceOrderListItem[]).map(order =>
      toServiceOrderListItem(order, viewer.role),
    ),
    done: ((doneOrders ?? []) as unknown as ServiceOrderListItem[]).map(order =>
      toServiceOrderListItem(order, viewer.role),
    ),
    doneForExport: ((doneExportOrders ?? []) as unknown as ServiceOrderListItem[]).map(order =>
      toServiceOrderListItem(order, viewer.role),
    ),
    doneTotalPages,
    doneTotalCount: doneCount ?? 0,
  }
}

export async function getServiceOrderDetail(
  supabase: SupabaseServerClient,
  viewer: Viewer,
  id: string,
): Promise<ServiceOrderFormData | null> {
  const [{ data }, { data: staffRelations }] = await Promise.all([
    supabase
      .from('service_orders')
      .select(getServiceOrderDetailSelect(viewer))
      .eq('id', id)
      .single(),
    supabase
      .from('service_order_cleaning_staff')
      .select('profile_id')
      .eq('service_order_id', id)
  ])

  if (!data) return null

  const cleaning_staff_ids = (staffRelations ?? []).map((r: { profile_id: string }) => r.profile_id)

  return toServiceOrderFormData(
    {
      ...(data as unknown as ServiceOrderFormData),
      cleaning_staff_ids,
    },
    viewer.role,
    viewer.userId,
  )
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
      .select('id, full_name, role')
      .in('role', ['limpeza', 'consegna'])
      .order('full_name'),
  ])

  return {
    properties: (properties ?? []) as unknown as ServiceOrderPropertyOption[],
    staff: (staff ?? []) as StaffOption[],
  }
}
