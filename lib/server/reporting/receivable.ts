import 'server-only'

import { captureQueryError } from '@/lib/server/logger'
import { CONSEGNA_FEE } from '@/lib/server/pricing'
import {
  loadReceivableFinancialSource,
  type ReceivableOrderSource,
} from '@/lib/server/data-access/sensitive-data'
import type { ReceivableStatementFilters } from '@/lib/server/validation/contracts'
import type {
  ReceivableOrderRow,
  ReceivableReport,
  ReceivableSection,
} from '@/lib/types/reporting'
import type { PricingMode } from '@/lib/types/database'

const PRICING_MODES: PricingMode[] = ['standard', 'ripasso', 'out_long_stay']

type ReceivableOrderRecord = ReceivableOrderSource

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeMoney(value: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  return roundMoney(value)
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

  const totalPrice = normalizeMoney(order.total_price)
  const extraAmount = order.extra_services_price == null
    ? 0
    : normalizeMoney(order.extra_services_price)
  const consegnaFee = order.consegna_fee == null
    ? CONSEGNA_FEE
    : normalizeMoney(order.consegna_fee)

  const currentBasePrice = property.base_price == null
    ? null
    : normalizeMoney(property.base_price)
  const extraDescription = order.extra_services_description?.trim() || null

  const baseRow = {
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
    extraDescription,
  }

  if (order.total_price == null) {
    return {
      ...baseRow,
      financialStatus: 'pending',
      pendingReason: order.pricing_mode !== 'out_long_stay' && property.base_price == null
        ? 'missing_property_base_price'
        : 'missing_total_price',
      consideredAmount: null,
      extraAmount,
      consegnaFee,
      totalPrice: null,
    }
  }

  if (totalPrice == null || extraAmount == null || consegnaFee == null) {
    return {
      ...baseRow,
      financialStatus: 'pending',
      pendingReason: 'invalid_financial_data',
      consideredAmount: null,
      extraAmount,
      consegnaFee,
      totalPrice,
    }
  }

  const consideredAmount = roundMoney(totalPrice - extraAmount - consegnaFee)
  if (consideredAmount < 0) {
    return {
      ...baseRow,
      financialStatus: 'pending',
      pendingReason: 'invalid_financial_data',
      consideredAmount: null,
      extraAmount,
      consegnaFee,
      totalPrice,
    }
  }

  return {
    ...baseRow,
    financialStatus: 'complete',
    pendingReason: null,
    consideredAmount,
    extraAmount,
    consegnaFee,
    totalPrice,
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
  const completeRows = rows.filter(
    (row): row is Extract<ReceivableOrderRow, { financialStatus: 'complete' }> => (
      row.financialStatus === 'complete'
    ),
  )

  return {
    mode,
    rows,
    orderCount: rows.length,
    completeOrderCount: completeRows.length,
    pendingCount: rows.length - completeRows.length,
    consideredTotal: roundMoney(completeRows.reduce((sum, row) => sum + row.consideredAmount, 0)),
    extraTotal: roundMoney(completeRows.reduce((sum, row) => sum + row.extraAmount, 0)),
    consegnaTotal: roundMoney(completeRows.reduce((sum, row) => sum + row.consegnaFee, 0)),
    sectionTotal: roundMoney(completeRows.reduce((sum, row) => sum + row.totalPrice, 0)),
  }
}

export async function getReceivableReport(
  filters: ReceivableStatementFilters,
): Promise<ReceivableReport> {
  let orders: ReceivableOrderRecord[]
  try {
    orders = await loadReceivableFinancialSource(filters)
  } catch (error) {
    captureQueryError('receivable', 'service_orders', error)
    throw error
  }
  const rows = orders.flatMap(order => {
    const row = toRow(order, filters)
    return row ? [row] : []
  })

  const standard = buildSection('standard', rows)
  const ripasso = buildSection('ripasso', rows)
  const outLongStay = buildSection('out_long_stay', rows)
  const orderCount = standard.orderCount + ripasso.orderCount + outLongStay.orderCount
  const completeOrderCount = (
    standard.completeOrderCount + ripasso.completeOrderCount + outLongStay.completeOrderCount
  )

  return {
    period: {
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
    standard,
    ripasso,
    outLongStay,
    orderCount,
    completeOrderCount,
    pendingCount: orderCount - completeOrderCount,
    grandTotal: roundMoney(
      standard.sectionTotal + ripasso.sectionTotal + outLongStay.sectionTotal,
    ),
  }
}
