import 'server-only'

import { toServiceOrderFormData, toServiceOrderListItem } from '@/lib/server/view-models'
import type { ServiceOrderListFilters } from '@/lib/server/validation/contracts'
import type {
  ServiceOrderFormData,
  ServiceOrderListItem,
  ServiceOrderPropertyOption,
  StaffOption,
} from '@/lib/types/view-models'
import {
  getOperationalServiceOrderVisibility,
  isOperationalStaffRole,
  type OperationalServiceOrderVisibility,
} from '@/lib/service-order-visibility'
import type { SupabaseServerClient, Viewer } from './viewer'
import {
  loadAuthorizedServiceOrderPropertyOptions,
  loadAuthorizedServiceOrderOperationalFinancialFields,
  loadAverageHoursForVisibleServiceOrders,
} from './sensitive-data'
import { romeDateRangeToUtcInterval } from '@/lib/utils/date-rome'

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
  property:properties(id, name),
  cleaning_staff:profiles!service_order_cleaning_staff(id, full_name),
  consegna_staff:profiles!consegna_staff_id(id, full_name)`

const SERVICE_ORDER_DETAIL_SELECT = `
  id,
  property_id,
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
  completion_notes,
  worked_minutes,
  pricing_mode,
  cleaning_notes
`

function requireQueryRows<T>(data: T[] | null, error: unknown, context: string): T[] {
  if (error || data === null) {
    throw new Error(`Falha ao carregar ${context}`, { cause: error })
  }
  return data
}

async function getMatchingPropertyIds(
  supabase: SupabaseServerClient,
  q?: string,
): Promise<string[] | null> {
  if (!q) return null

  const { data, error } = await supabase
    .from('properties')
    .select('id')
    .ilike('name', `%${q}%`)

  return requireQueryRows(data, error, 'os imóveis correspondentes').map(
    (property: { id: string }) => property.id,
  )
}

export async function getServiceOrderList(
  supabase: SupabaseServerClient,
  viewer: Viewer,
  filters: ServiceOrderListFilters,
  operationalVisibility: OperationalServiceOrderVisibility = getOperationalServiceOrderVisibility(),
): Promise<ServiceOrderListResult> {
  const todayStr = operationalVisibility.today
  const isOperationalStaff = isOperationalStaffRole(viewer.role)
  const isFilterActive = !!(
    filters.propertyId || filters.cleaningStaffId || filters.consegnaStaffId ||
    filters.startDate || filters.endDate || filters.checkinDate || filters.q
  )

  let checkinUtcInterval: { startUtc: string; nextDayUtc: string } | null = null
  if (filters.checkinDate) {
    checkinUtcInterval = romeDateRangeToUtcInterval(filters.checkinDate, filters.checkinDate)
  }

  const matchingPropertyIds = filters.q
    ? await getMatchingPropertyIds(supabase, filters.q)
    : null
  const noMatchesId = '00000000-0000-0000-0000-000000000000'
  // The filter adds an embed; the selected order fields remain the base list shape.
  const listSelect = filters.cleaningStaffId
    ? `${SERVICE_ORDER_LIST_SELECT}, assignment_filter:service_order_cleaning_staff!inner(profile_id)` as typeof SERVICE_ORDER_LIST_SELECT
    : SERVICE_ORDER_LIST_SELECT

  const orderColumn = checkinUtcInterval ? 'checkin_at' : 'cleaning_date'
  const orderAscending = !!checkinUtcInterval

  let activeQuery = supabase
    .from('service_orders')
    .select(listSelect)
    .in('status', ['open', 'in_progress'])
    .order(orderColumn, { ascending: orderAscending, nullsFirst: false })

  let doneQuery = supabase
    .from('service_orders')
    .select(listSelect, { count: 'exact' })
    .eq('status', 'done')
    .order(orderColumn, { ascending: orderAscending, nullsFirst: false })

  let doneExportQuery = supabase
    .from('service_orders')
    .select(listSelect)
    .eq('status', 'done')
    .order(orderColumn, { ascending: orderAscending, nullsFirst: false })

  for (const queryName of ['active', 'done', 'doneExport'] as const) {
    let query = queryName === 'active' ? activeQuery : queryName === 'done' ? doneQuery : doneExportQuery
    if (isOperationalStaff) query = query.lte('cleaning_date', operationalVisibility.maxVisibleDate)
    if (filters.propertyId) query = query.eq('property_id', filters.propertyId)
    if (filters.consegnaStaffId) query = query.eq('consegna_staff_id', filters.consegnaStaffId)
    if (filters.cleaningStaffId) query = query.eq('assignment_filter.profile_id', filters.cleaningStaffId)
    if (filters.q) {
      query = query.in('property_id', matchingPropertyIds?.length ? matchingPropertyIds : [noMatchesId])
    }
    if (checkinUtcInterval) {
      query = query
        .gte('checkin_at', checkinUtcInterval.startUtc)
        .lt('checkin_at', checkinUtcInterval.nextDayUtc)
    } else {
      if (filters.startDate) query = query.gte('cleaning_date', filters.startDate)
      if (filters.endDate) query = query.lte('cleaning_date', filters.endDate)
    }

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

  const [activeResult, doneResult, doneExportResult] = await Promise.all([
    activeQuery,
    doneQuery,
    doneExportQuery,
  ])
  const activeOrders = requireQueryRows(activeResult.data, activeResult.error, 'as ordens abertas')
  const doneOrders = requireQueryRows(doneResult.data, doneResult.error, 'as ordens concluídas')
  const doneExportOrders = requireQueryRows(doneExportResult.data, doneExportResult.error, 'as ordens para o PDF')
  if (doneResult.count === null) {
    throw new Error('Falha ao contar as ordens concluídas')
  }
  const doneCount = doneResult.count

  const allOrders = [...activeOrders, ...doneOrders, ...doneExportOrders]
  const propertyIds = allOrders.flatMap(order => {
    const property = (order as { property?: { id?: string } | null }).property
    return property?.id ? [property.id] : []
  })
  const averageHoursByProperty = await loadAverageHoursForVisibleServiceOrders(propertyIds)
  const withAuthorizedHours = <T extends { property?: unknown }>(orders: T[]): T[] => orders.map(order => {
    const property = order.property as { id?: string } | null | undefined
    if (!property?.id) return order
    return {
      ...order,
      property: {
        ...property,
        avg_cleaning_hours: averageHoursByProperty.get(property.id) ?? null,
      },
    }
  })

  const doneTotalPages = isFilterActive
    ? Math.ceil(doneCount / filters.donePageSize)
    : 1

  return {
    active: (withAuthorizedHours(activeOrders) as ServiceOrderListItem[]).map(order =>
      toServiceOrderListItem(order, viewer.role),
    ),
    done: (withAuthorizedHours(doneOrders) as ServiceOrderListItem[]).map(order =>
      toServiceOrderListItem(order, viewer.role),
    ),
    doneForExport: (withAuthorizedHours(doneExportOrders) as ServiceOrderListItem[]).map(order =>
      toServiceOrderListItem(order, viewer.role),
    ),
    doneTotalPages,
    doneTotalCount: doneCount,
  }
}

export async function getServiceOrderDetail(
  supabase: SupabaseServerClient,
  viewer: Viewer,
  id: string,
  operationalVisibility: OperationalServiceOrderVisibility = getOperationalServiceOrderVisibility(),
): Promise<ServiceOrderFormData | null> {
  const isAdminOrSecretaria = viewer.role === 'admin' || viewer.role === 'secretaria'
  let orderQuery = supabase
    .from('service_orders')
    .select(SERVICE_ORDER_DETAIL_SELECT)
    .eq('id', id)

  if (isOperationalStaffRole(viewer.role)) {
    orderQuery = orderQuery.lte('cleaning_date', operationalVisibility.maxVisibleDate)
  }

  const { data } = await orderQuery.single()

  if (!data) return null

  const { data: staffRelations } = await supabase
    .from('service_order_cleaning_staff')
    .select('profile_id')
    .eq('service_order_id', id)

  const cleaning_staff_ids = (staffRelations ?? []).map((r: { profile_id: string }) => r.profile_id)

  const operationalFinancialFields = isAdminOrSecretaria
    ? await loadAuthorizedServiceOrderOperationalFinancialFields(id)
    : null

  return toServiceOrderFormData(
    {
      ...(data as ServiceOrderFormData),
      ...(operationalFinancialFields ?? {}),
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
  const [{ role, rows: properties }, { data: staff, error: staffError }] = await Promise.all([
    loadAuthorizedServiceOrderPropertyOptions(),
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['limpeza', 'consegna'])
      .order('full_name'),
  ])

  if (role !== viewer.role) throw new Error('Contexto de autorização inconsistente')

  return {
    properties,
    staff: requireQueryRows(staff, staffError, 'os funcionários') as StaffOption[],
  }
}
