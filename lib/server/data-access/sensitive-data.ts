import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import {
  payableStatementFiltersSchema,
  dateOnlySchema,
  optionalSearchSchema,
  pageSizeSchema,
  receivableStatementFiltersSchema,
} from '@/lib/server/validation/contracts'
import type { Role } from '@/lib/types/database'
import type {
  EmployeeFormData,
  EmployeeListItem,
  PropertyFormData,
  PropertyListItem,
  ServiceOrderPropertyOption,
} from '@/lib/types/view-models'
import type {
  PayableStatementFilters,
  PropertyListFilters,
  ReceivableStatementFilters,
} from '@/lib/server/validation/contracts'

const ALL_ROLES: Role[] = ['admin', 'secretaria', 'limpeza', 'consegna', 'cliente']
const MAX_ID_BATCH = 1000
// PostgreSQL's uuid type accepts historical values without RFC version bits.
// Database results are canonicalized with hyphens, so validate that stable
// representation without rejecting rows that already exist in the baseline.
const postgresUuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'ID inválido',
)

function createPrivilegedClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret) throw new Error('Configuração privilegiada indisponível')

  return createSupabaseClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

async function authorizeBeforePrivilege(roles: Role[]) {
  const { supabase, viewer } = await getCurrentViewer()
  if (!roles.includes(viewer.role)) throw new Error('Sem permissão')

  return {
    scopedClient: supabase,
    privilegedClient: createPrivilegedClient(),
    viewer,
  }
}

const idBatchSchema = z.array(postgresUuidSchema).max(MAX_ID_BATCH)
const nullableOrderTotalSchema = z.number().finite().min(0).nullable()
const propertyListFiltersSchema = z.object({
  page: z.number().int().min(1).max(1000),
  pageSize: pageSizeSchema,
  q: optionalSearchSchema,
})

const ADMIN_PROPERTY_LIST_SELECT = 'id, name, zone, address, client_type, base_price'
const ADMIN_PROPERTY_DETAIL_SELECT = [
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
  'client_type',
  'agency_id',
  'owner_id',
  'phone',
  'base_price',
  'extra_per_person',
  'avg_cleaning_hours',
].join(', ')

export async function loadPropertyListForAdministration(
  filters: PropertyListFilters,
): Promise<{ rows: PropertyListItem[]; count: number }> {
  const parsed = propertyListFiltersSchema.parse(filters)
  const { privilegedClient } = await authorizeBeforePrivilege(['admin'])
  const page = Math.max(1, parsed.page)
  const from = (page - 1) * parsed.pageSize
  const to = from + parsed.pageSize - 1

  let query = privilegedClient
    .from('properties')
    .select(ADMIN_PROPERTY_LIST_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (parsed.q) query = query.ilike('name', `%${parsed.q}%`)
  const { data, count, error } = await query
  if (error) throw new Error('Não foi possível carregar os imóveis.', { cause: error })

  return { rows: (data ?? []) as unknown as PropertyListItem[], count: count ?? 0 }
}

export async function loadPropertyDetailForAdministration(
  id: string,
): Promise<PropertyFormData | null> {
  const propertyId = postgresUuidSchema.parse(id)
  const { privilegedClient } = await authorizeBeforePrivilege(['admin'])
  const { data, error } = await privilegedClient
    .from('properties')
    .select(ADMIN_PROPERTY_DETAIL_SELECT)
    .eq('id', propertyId)
    .maybeSingle()

  if (error) throw new Error('Não foi possível carregar o imóvel.', { cause: error })
  return data as unknown as PropertyFormData | null
}

const SERVICE_ORDER_PROPERTY_COMMON_SELECT =
  'id, name, min_guests, max_guests, double_beds, single_beds, sofa_beds, armchair_beds, bathrooms, bidets, cribs'

export async function loadAuthorizedServiceOrderPropertyOptions(): Promise<{
  role: Role
  rows: ServiceOrderPropertyOption[]
}> {
  const { scopedClient, privilegedClient, viewer } = await authorizeBeforePrivilege(ALL_ROLES)
  const { data: visibleRows, error: visibleError } = await scopedClient
    .from('properties')
    .select(SERVICE_ORDER_PROPERTY_COMMON_SELECT)
    .order('name')

  if (visibleError) throw new Error('Não foi possível carregar os imóveis visíveis.', { cause: visibleError })
  const visible = visibleRows ?? []
  const ids = idBatchSchema.parse(visible.map(row => row.id))
  if (ids.length === 0 || viewer.role === 'cliente') {
    return { role: viewer.role, rows: visible as unknown as ServiceOrderPropertyOption[] }
  }

  const sensitiveSelect = viewer.role === 'admin'
    ? 'id, avg_cleaning_hours, base_price'
    : 'id, avg_cleaning_hours'
  const { data: sensitiveRows, error: sensitiveError } = await privilegedClient
    .from('properties')
    .select(sensitiveSelect)
    .in('id', ids)

  if (sensitiveError) throw new Error('Não foi possível carregar o contexto operacional.', { cause: sensitiveError })
  const typedSensitiveRows = (sensitiveRows ?? []) as unknown as Array<{
    id: string
    avg_cleaning_hours: number | null
    base_price?: number | null
  }>
  const sensitiveById = new Map(typedSensitiveRows.map(row => [row.id, row]))

  return {
    role: viewer.role,
    rows: visible.map(row => {
      const sensitive = sensitiveById.get(row.id)
      return {
        ...row,
        avg_cleaning_hours: sensitive?.avg_cleaning_hours ?? null,
        ...(viewer.role === 'admin' ? { base_price: sensitive?.base_price ?? null } : {}),
      } as unknown as ServiceOrderPropertyOption
    }),
  }
}

export async function loadAverageHoursForVisibleServiceOrders(
  propertyIds: string[],
): Promise<Map<string, number | null>> {
  const ids = idBatchSchema.parse([...new Set(propertyIds)])
  if (ids.length === 0) return new Map()

  const { scopedClient, privilegedClient, viewer } = await authorizeBeforePrivilege(ALL_ROLES)
  let allowedIds = ids

  if (viewer.role !== 'admin' && viewer.role !== 'secretaria') {
    const { data: visibleOrders, error: visibleError } = await scopedClient
      .from('service_orders')
      .select('property_id')
      .in('property_id', ids)
    if (visibleError) throw new Error('Não foi possível confirmar o escopo das ordens.', { cause: visibleError })
    allowedIds = [...new Set((visibleOrders ?? []).map(row => row.property_id).filter(Boolean))] as string[]
  }

  if (allowedIds.length === 0) return new Map()
  const { data, error } = await privilegedClient
    .from('properties')
    .select('id, avg_cleaning_hours')
    .in('id', allowedIds)
  if (error) throw new Error('Não foi possível carregar as horas autorizadas.', { cause: error })

  return new Map((data ?? []).map(row => [row.id, row.avg_cleaning_hours]))
}

export async function loadAuthorizedServiceOrderOperationalFinancialFields(orderId: string) {
  const id = postgresUuidSchema.parse(orderId)
  const { scopedClient, privilegedClient } = await authorizeBeforePrivilege(['admin', 'secretaria'])
  const { data: visibleOrder, error: visibleOrderError } = await scopedClient
    .from('service_orders')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (visibleOrderError) {
    throw new Error('Não foi possível confirmar a ordem visível.', { cause: visibleOrderError })
  }
  if (!visibleOrder) return null

  const { data, error } = await privilegedClient
    .from('service_orders')
    .select('extra_services_description, extra_services_price')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('Não foi possível carregar os extras autorizados.', { cause: error })
  return data
}

export async function loadEmployeeListForAdministration(): Promise<EmployeeListItem[]> {
  const { privilegedClient } = await authorizeBeforePrivilege(['admin'])
  const { data, error } = await privilegedClient
    .from('profiles')
    .select('id, full_name, email, phone, birth_date, nationality, role, hourly_rate, monthly_salary, overtime_rate')
    .in('role', ['admin', 'secretaria', 'limpeza', 'consegna'])
    .order('full_name')
  if (error) throw new Error('Não foi possível carregar os funcionários.', { cause: error })
  return (data ?? []) as unknown as EmployeeListItem[]
}

export async function loadEmployeeDetailForAdministration(id: string): Promise<EmployeeFormData | null> {
  const employeeId = postgresUuidSchema.parse(id)
  const { privilegedClient } = await authorizeBeforePrivilege(['admin'])
  const { data, error } = await privilegedClient
    .from('profiles')
    .select('id, full_name, email, phone, birth_date, nationality, address, role, hourly_rate, monthly_salary, overtime_rate')
    .eq('id', employeeId)
    .maybeSingle()
  if (error) throw new Error('Não foi possível carregar o funcionário.', { cause: error })
  return data as unknown as EmployeeFormData | null
}

export type OrderPricingContext = {
  propertyId: string
  realGuests: number | null
  workedMinutes: number | null
  pricingMode: 'standard' | 'ripasso' | 'out_long_stay'
  extraServicesPrice: number | null
  property: {
    base_price: number | null
    extra_per_person: number | null
    min_guests: number | null
  } | null
}

export async function loadAuthorizedPropertyPricingContext(propertyId: string) {
  const id = postgresUuidSchema.parse(propertyId)
  const { scopedClient, privilegedClient } = await authorizeBeforePrivilege(['admin', 'secretaria'])
  const { data: visible, error: visibleError } = await scopedClient
    .from('properties')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (visibleError) {
    throw new Error('Não foi possível confirmar o imóvel visível.', { cause: visibleError })
  }
  if (!visible) return null

  const { data, error } = await privilegedClient
    .from('properties')
    .select('base_price, extra_per_person, min_guests')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('Não foi possível carregar o contexto de preço.', { cause: error })
  return data
}

export async function loadAuthorizedOrderPricingContext(
  orderId: string,
  overridePropertyId?: string,
): Promise<OrderPricingContext | null> {
  const id = postgresUuidSchema.parse(orderId)
  const overrideId = overridePropertyId ? postgresUuidSchema.parse(overridePropertyId) : undefined
  const { scopedClient, privilegedClient } = await authorizeBeforePrivilege(['admin', 'secretaria', 'limpeza'])

  const { data: order, error: orderError } = await scopedClient
    .from('service_orders')
    .select('property_id, real_guests, worked_minutes')
    .eq('id', id)
    .maybeSingle()
  if (orderError) throw new Error('Não foi possível confirmar a ordem autorizada.', { cause: orderError })
  if (!order) return null

  const targetPropertyId = overrideId ?? order.property_id
  if (overrideId) {
    const { data: visibleProperty, error: visiblePropertyError } = await scopedClient
      .from('properties')
      .select('id')
      .eq('id', overrideId)
      .maybeSingle()
    if (visiblePropertyError) {
      throw new Error('Não foi possível confirmar o imóvel autorizado.', { cause: visiblePropertyError })
    }
    if (!visibleProperty) return null
  }

  const { data: property, error: propertyError } = await privilegedClient
    .from('properties')
    .select('base_price, extra_per_person, min_guests')
    .eq('id', targetPropertyId)
    .maybeSingle()
  if (propertyError) throw new Error('Não foi possível carregar o contexto de preço.', { cause: propertyError })

  const { data: financialOrder, error: financialOrderError } = await privilegedClient
    .from('service_orders')
    .select('pricing_mode, extra_services_price')
    .eq('id', id)
    .maybeSingle()
  if (financialOrderError) throw new Error('Não foi possível carregar os valores da ordem.', { cause: financialOrderError })
  if (!financialOrder) return null

  return {
    propertyId: targetPropertyId,
    realGuests: order.real_guests ?? null,
    workedMinutes: order.worked_minutes ?? null,
    pricingMode: financialOrder.pricing_mode,
    extraServicesPrice: financialOrder.extra_services_price ?? null,
    property,
  }
}

export async function persistAuthorizedServiceOrderTotalPrice(
  orderId: string,
  totalPrice: number | null,
): Promise<void> {
  const id = postgresUuidSchema.parse(orderId)
  const total_price = nullableOrderTotalSchema.parse(totalPrice)
  const { scopedClient, privilegedClient } = await authorizeBeforePrivilege([
    'admin',
    'secretaria',
    'limpeza',
  ])

  const { data: visibleOrder, error: visibleError } = await scopedClient
    .from('service_orders')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (visibleError) {
    throw new Error('Não foi possível confirmar a ordem autorizada.', { cause: visibleError })
  }
  if (!visibleOrder) throw new Error('O.L. non trovato o non autorizzato.')

  const { error } = await privilegedClient
    .from('service_orders')
    .update({ total_price })
    .eq('id', id)
  if (error) throw new Error('Não foi possível atualizar o preço da ordem.', { cause: error })
}

export type PayableOrderSource = {
  id: string
  order_number: number
  completed_at: string | null
  cleaning_staff: { id: string }[] | null
  property: { name?: string | null; avg_cleaning_hours: number | null } | null
}

export type StaffCompensationSource = {
  id: string
  full_name: string
  hourly_rate: number | null
  monthly_salary: number | null
}

export async function loadPayableFinancialSource(
  filters: PayableStatementFilters,
  includePropertyName: boolean,
): Promise<{ orders: PayableOrderSource[]; profiles: StaffCompensationSource[] }> {
  const parsed = payableStatementFiltersSchema.parse(filters)
  const { privilegedClient } = await authorizeBeforePrivilege(['admin'])
  const propertySelect = includePropertyName
    ? 'property:properties(name, avg_cleaning_hours)'
    : 'property:properties(avg_cleaning_hours)'

  let query = privilegedClient
    .from('service_orders')
    .select(`id, order_number, completed_at, cleaning_staff:profiles!service_order_cleaning_staff(id), ${propertySelect}`)
    .eq('status', 'done')
    .gte('completed_at', parsed.startDate)
    .lte('completed_at', parsed.endDate)
  if (includePropertyName) query = query.order('completed_at', { ascending: true })

  const { data: orders, error: ordersError } = await query
  if (ordersError) throw new Error('Não foi possível carregar o extrato a pagar.', { cause: ordersError })
  const typedOrders = (orders ?? []) as unknown as PayableOrderSource[]
  const staffIds = [...new Set(typedOrders.flatMap(order => (order.cleaning_staff ?? []).map(staff => staff.id)))]
  if (staffIds.length === 0) return { orders: typedOrders, profiles: [] }

  const { data: profiles, error: profilesError } = await privilegedClient
    .from('profiles')
    .select('id, full_name, hourly_rate, monthly_salary')
    .in('id', idBatchSchema.parse(staffIds))
  if (profilesError) throw new Error('Não foi possível carregar a remuneração autorizada.', { cause: profilesError })

  return { orders: typedOrders, profiles: (profiles ?? []) as StaffCompensationSource[] }
}

export type ReceivableOrderSource = {
  id: string
  order_number: number
  cleaning_date: string | null
  pricing_mode: 'standard' | 'ripasso' | 'out_long_stay' | null
  real_guests: number | null
  double_beds: number
  single_beds: number
  sofa_beds: number
  bathrooms: number
  bidets: number
  cribs: number
  extra_services_description: string | null
  extra_services_price: number | null
  consegna_fee: number | null
  total_price: number | null
  property: {
    id: string
    name: string
    client_type: 'rental' | 'particular'
    base_price: number | null
    agency: { id: string; name: string } | null
    owner: { id: string; name: string } | null
  } | null
}

const RECEIVABLE_SELECT = `
  id, order_number, cleaning_date, pricing_mode, real_guests,
  double_beds, single_beds, sofa_beds, bathrooms, bidets, cribs,
  extra_services_description, extra_services_price, consegna_fee, total_price,
  property:properties(id, name, client_type, base_price, agency:agencies(id, name), owner:owners(id, name))
`

export async function loadReceivableFinancialSource(
  filters: ReceivableStatementFilters,
): Promise<ReceivableOrderSource[]> {
  const parsed = receivableStatementFiltersSchema.parse(filters)
  const { privilegedClient } = await authorizeBeforePrivilege(['admin'])
  const rows: ReceivableOrderSource[] = []

  for (let from = 0; ; from += MAX_ID_BATCH) {
    const { data, error } = await privilegedClient
      .from('service_orders')
      .select(RECEIVABLE_SELECT)
      .eq('status', 'done')
      .gte('cleaning_date', parsed.startDate)
      .lte('cleaning_date', parsed.endDate)
      .order('cleaning_date', { ascending: true })
      .order('order_number', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + MAX_ID_BATCH - 1)
    if (error) throw new Error('Não foi possível carregar o relatório a receber.', { cause: error })
    const page = (data ?? []) as unknown as ReceivableOrderSource[]
    rows.push(...page)
    if (page.length < MAX_ID_BATCH) break
  }

  return rows
}

const dashboardPeriodsSchema = z.object({
  monthStart: dateOnlySchema,
  today: dateOnlySchema,
  yearStart: dateOnlySchema,
  threeMonthsAgoStart: dateOnlySchema,
})

export type DashboardFinancialSource = {
  properties: PromiseSettledResult<unknown>
  hours: PromiseSettledResult<unknown>
  revenue: PromiseSettledResult<unknown>
  topMonth: PromiseSettledResult<unknown>
  topYear: PromiseSettledResult<unknown>
  recentOrders: PromiseSettledResult<unknown>
  profiles: PromiseSettledResult<unknown>
}

export async function loadDashboardFinancialSource(
  periods: z.infer<typeof dashboardPeriodsSchema>,
): Promise<DashboardFinancialSource> {
  const parsed = dashboardPeriodsSchema.parse(periods)
  const { privilegedClient } = await authorizeBeforePrivilege(['admin'])
  const [properties, hours, revenue, topMonth, topYear, recentOrders] = await Promise.allSettled([
    privilegedClient.from('service_orders').select('property_id').eq('status', 'done')
      .gte('completed_at', parsed.monthStart).lte('completed_at', parsed.today),
    privilegedClient.from('service_orders').select('worked_minutes, property:properties(avg_cleaning_hours)')
      .eq('status', 'done').gte('completed_at', parsed.monthStart).lte('completed_at', parsed.today),
    privilegedClient.from('service_orders').select('total_price').eq('status', 'done')
      .gte('completed_at', parsed.monthStart).lte('completed_at', parsed.today),
    privilegedClient.from('service_orders').select('property_id, property:properties(id, name)')
      .eq('status', 'done').gte('cleaning_date', parsed.monthStart).lte('cleaning_date', parsed.today),
    privilegedClient.from('service_orders').select('property_id, property:properties(id, name)')
      .eq('status', 'done').gte('cleaning_date', parsed.yearStart).lte('cleaning_date', parsed.today),
    privilegedClient.from('service_orders')
      .select('completed_at, total_price, cleaning_staff:profiles!service_order_cleaning_staff(id), worked_minutes, property:properties(avg_cleaning_hours)')
      .eq('status', 'done').gte('completed_at', parsed.threeMonthsAgoStart).lte('completed_at', parsed.today),
  ])

  const recentValue = recentOrders.status === 'fulfilled'
    ? recentOrders.value as { data?: { cleaning_staff?: { id: string }[] | null }[] | null }
    : null
  const staffIds = [...new Set((recentValue?.data ?? []).flatMap(order =>
    (order.cleaning_staff ?? []).map(staff => staff.id),
  ))]
  const profiles = staffIds.length === 0
    ? { status: 'fulfilled', value: { data: [], error: null } } as PromiseFulfilledResult<unknown>
    : await Promise.resolve(privilegedClient.from('profiles')
      .select('id, full_name, hourly_rate, monthly_salary')
      .in('id', idBatchSchema.parse(staffIds)))
      .then(
        value => ({ status: 'fulfilled', value }) as PromiseFulfilledResult<unknown>,
        reason => ({ status: 'rejected', reason }) as PromiseRejectedResult,
      )

  return { properties, hours, revenue, topMonth, topYear, recentOrders, profiles }
}
