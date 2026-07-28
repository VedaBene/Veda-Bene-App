import 'server-only'

import { captureQueryError } from '@/lib/server/logger'
import { CONSEGNA_FEE } from '@/lib/server/pricing'
import type { SupabaseServerClient } from '@/lib/server/data-access/viewer'
import type { ReceivableStatementFilters } from '@/lib/server/validation/contracts'
import type {
  ReceivableOrderRow,
  ReceivableReport,
  ReceivableSection,
} from '@/lib/types/reporting'
import type { PricingMode } from '@/lib/types/database'

const PAGE_SIZE = 1000
const PRICING_MODES: PricingMode[] = ['standard', 'ripasso', 'out_long_stay']

type ReceivableOrderRecord = {
  id: string
  order_number: number
  cleaning_date: string | null
  pricing_mode: PricingMode | null
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
  property:properties(
    id, name, client_type, base_price,
    agency:agencies(id, name),
    owner:owners(id, name)
  )
`

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function assertMoney(
  value: number | null,
  field: string,
  orderNumber: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Valor financeiro inválido em ${field} na O.S. #${orderNumber}`)
  }
  return value
}

function clientName(property: NonNullable<ReceivableOrderRecord['property']>): string {
  return property.client_type === 'rental'
    ? (property.agency?.name ?? '—')
    : (property.owner?.name ?? '—')
}

function matchesFilters(
  property: NonNullable<ReceivableOrderRecord['property']>,
  filters: ReceivableStatementFilters,
): boolean {
  if (filters.clientType && filters.clientType !== 'all' && property.client_type !== filters.clientType) {
    return false
  }

  if (!filters.clientId) return true
  return property.agency?.id === filters.clientId || property.owner?.id === filters.clientId
}

function isPricingMode(value: PricingMode | null): value is PricingMode {
  return value != null && PRICING_MODES.includes(value)
}

async function fetchAllReceivableOrders(
  supabase: SupabaseServerClient,
  filters: ReceivableStatementFilters,
): Promise<ReceivableOrderRecord[]> {
  const orders: ReceivableOrderRecord[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('service_orders')
      .select(RECEIVABLE_SELECT)
      .eq('status', 'done')
      .gte('cleaning_date', filters.startDate)
      .lte('cleaning_date', filters.endDate)
      .order('cleaning_date', { ascending: true })
      .order('order_number', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      captureQueryError('receivable', 'service_orders', error)
      throw new Error('Não foi possível carregar o relatório a receber.', { cause: error })
    }

    const page = (data ?? []) as unknown as ReceivableOrderRecord[]
    orders.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return orders
}

function toRow(
  order: ReceivableOrderRecord,
  filters: ReceivableStatementFilters,
): ReceivableOrderRow | null {
  const property = order.property
  if (!property || !matchesFilters(property, filters)) return null

  if (!order.cleaning_date) {
    throw new Error(`Data de limpeza ausente na O.S. #${order.order_number}`)
  }
  if (!isPricingMode(order.pricing_mode)) {
    throw new Error(`Modalidade de preço inválida na O.S. #${order.order_number}`)
  }

  const totalPrice = assertMoney(order.total_price, 'total_price', order.order_number)
  const extraAmount = order.extra_services_price == null
    ? 0
    : assertMoney(order.extra_services_price, 'extra_services_price', order.order_number)
  const consegnaFee = order.consegna_fee == null
    ? CONSEGNA_FEE
    : assertMoney(order.consegna_fee, 'consegna_fee', order.order_number)
  const consideredAmount = roundMoney(totalPrice - extraAmount - consegnaFee)

  if (consideredAmount < 0) {
    throw new Error(`Composição financeira inválida na O.S. #${order.order_number}`)
  }

  const currentBasePrice = property.base_price == null
    ? null
    : roundMoney(assertMoney(property.base_price, 'properties.base_price', order.order_number))
  const extraDescription = order.extra_services_description?.trim() || null

  return {
    section: order.pricing_mode,
    orderId: order.id,
    orderNumber: order.order_number,
    cleaningDate: order.cleaning_date,
    propertyName: property.name,
    clientName: clientName(property),
    occupancy: {
      guests: order.real_guests,
      doubleBeds: order.double_beds,
      singleBeds: order.single_beds,
      sofaBeds: order.sofa_beds,
      bathrooms: order.bathrooms,
      bidets: order.bidets,
      cribs: order.cribs,
    },
    currentBasePrice,
    consideredAmount,
    extraDescription,
    extraAmount: roundMoney(extraAmount),
    consegnaFee: roundMoney(consegnaFee),
    totalPrice: roundMoney(totalPrice),
  }
}

const propertyCollator = new Intl.Collator('it-IT', {
  sensitivity: 'base',
  numeric: true,
})

function sortRows(rows: ReceivableOrderRow[]): ReceivableOrderRow[] {
  return rows.sort((left, right) => {
    const propertyComparison = propertyCollator.compare(left.propertyName, right.propertyName)
    if (propertyComparison !== 0) return propertyComparison

    const dateComparison = left.cleaningDate.localeCompare(right.cleaningDate)
    if (dateComparison !== 0) return dateComparison

    const orderComparison = left.orderNumber - right.orderNumber
    if (orderComparison !== 0) return orderComparison
    return left.orderId.localeCompare(right.orderId)
  })
}

function buildSection(
  mode: PricingMode,
  allRows: ReceivableOrderRow[],
): ReceivableSection {
  const rows = sortRows(allRows.filter(row => row.section === mode))

  return {
    mode,
    rows,
    orderCount: rows.length,
    consideredTotal: roundMoney(rows.reduce((sum, row) => sum + row.consideredAmount, 0)),
    extraTotal: roundMoney(rows.reduce((sum, row) => sum + row.extraAmount, 0)),
    consegnaTotal: roundMoney(rows.reduce((sum, row) => sum + row.consegnaFee, 0)),
    sectionTotal: roundMoney(rows.reduce((sum, row) => sum + row.totalPrice, 0)),
  }
}

export async function getReceivableReport(
  supabase: SupabaseServerClient,
  filters: ReceivableStatementFilters,
): Promise<ReceivableReport> {
  const orders = await fetchAllReceivableOrders(supabase, filters)
  const rows = orders.flatMap(order => {
    const row = toRow(order, filters)
    return row ? [row] : []
  })

  const standard = buildSection('standard', rows)
  const ripasso = buildSection('ripasso', rows)
  const outLongStay = buildSection('out_long_stay', rows)

  return {
    period: {
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
    standard,
    ripasso,
    outLongStay,
    grandTotal: roundMoney(
      standard.sectionTotal + ripasso.sectionTotal + outLongStay.sectionTotal,
    ),
  }
}
