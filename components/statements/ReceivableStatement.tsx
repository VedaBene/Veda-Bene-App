'use client'

import { useState, useTransition } from 'react'
import { fetchReceivableReport } from '@/app/(app)/statements/actions'
import { exportReceivablePDF } from '@/lib/utils/export-pdf'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AlertTriangle, Download, FileText, Filter, Receipt } from 'lucide-react'
import type { PricingMode } from '@/lib/types/database'
import type {
  ClientOption,
  ReceivableOrderRow,
  ReceivableReport,
  ReceivableSection,
} from '@/lib/types/reporting'

const moneyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function money(value: number | null): string {
  return value == null ? '—' : moneyFormatter.format(value)
}

function dateOnly(value: string): string {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : '—'
}

const inputCls =
  'px-3 py-2.5 border border-input-border rounded-lg text-sm text-foreground bg-white transition-all duration-200 focus:ring-2 focus:ring-input-focus/20 focus:border-input-focus outline-none'

type ClientTypeFilter = 'all' | 'rental' | 'particular'

const CLIENT_TYPE_OPTIONS: { value: ClientTypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'rental', label: 'Agência' },
  { value: 'particular', label: 'Particular' },
]

const SECTION_STYLE: Record<PricingMode, { title: string; badge: string; header: string }> = {
  standard: {
    title: '1. Standard',
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
    header: 'border-l-teal-500',
  },
  ripasso: {
    title: '2. Ripasso',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    header: 'border-l-blue-500',
  },
  out_long_stay: {
    title: '3. Out Long Stay',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    header: 'border-l-violet-500',
  },
}

const PENDING_REASON_LABEL = {
  missing_property_base_price: 'Preço base do imóvel ausente',
  missing_total_price: 'Total da O.S. não calculado',
  invalid_financial_data: 'Dados financeiros inválidos',
} as const

function exportBlockedMessage(pendingCount: number): string {
  return `Exportação bloqueada: existem ${pendingCount} O.S. com dados financeiros pendentes neste filtro.`
}

function Occupancy({ row }: { row: ReceivableOrderRow }) {
  const fields = [
    ['PX', row.occupancy.guests ?? '—'],
    ['M', row.occupancy.doubleBeds],
    ['S', row.occupancy.singleBeds],
    ['DL', row.occupancy.sofaBeds],
    ['WC', row.occupancy.bathrooms],
    ['BI', row.occupancy.bidets],
    ['CUL', row.occupancy.cribs],
  ]

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {fields.map(([label, value]) => (
        <div key={label} className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
          <span className="block text-[10px] font-semibold text-muted-foreground">{label}</span>
          <span className="block text-xs font-semibold text-foreground">{value}</span>
        </div>
      ))}
    </div>
  )
}

function SectionSummary({ section }: { section: ReceivableSection }) {
  const items = [
    ['Incluídas no total', String(section.completeOrderCount)],
    ['Pendentes', String(section.pendingCount)],
    ['Valor considerado', money(section.consideredTotal)],
    ['Serviços extras', money(section.extraTotal)],
    ['Consegna', money(section.consegnaTotal)],
    [section.pendingCount > 0 ? 'Subtotal parcial' : 'Subtotal da seção', money(section.sectionTotal)],
  ]

  return (
    <div className="grid grid-cols-2 gap-2 border-t border-border bg-muted/20 p-4 sm:grid-cols-3 xl:grid-cols-6">
      {items.map(([label, value], index) => (
        <div
          key={label}
          className={`rounded-lg border px-3 py-2.5 ${index === items.length - 1 ? 'border-accent/30 bg-accent/5' : 'border-border bg-card'}`}
        >
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className={`mt-1 block font-bold ${index === items.length - 1 ? 'text-accent' : 'text-foreground'}`}>{value}</span>
        </div>
      ))}
    </div>
  )
}

function MobileOrderCard({ row }: { row: ReceivableOrderRow }) {
  const isPending = row.financialStatus === 'pending'

  return (
    <article className={`space-y-3 border-b border-border/60 p-4 last:border-b-0 ${isPending ? 'bg-amber-50/60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate font-semibold text-foreground">{row.propertyName}</span>
          <span className="block text-xs text-muted-foreground">{row.clientName}</span>
          {isPending && (
            <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              {PENDING_REASON_LABEL[row.pendingReason]}
            </span>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-xs font-semibold text-foreground">O.S. #{row.orderNumber}</span>
          <span className="block text-xs text-muted-foreground">{dateOnly(row.cleaningDate)}</span>
        </div>
      </div>

      <Occupancy row={row} />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Preço base atual</dt>
          <dd className="font-semibold text-foreground">{money(row.currentBasePrice)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Valor considerado</dt>
          <dd className="font-semibold text-foreground">{money(row.consideredAmount)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Descrição do serviço extra</dt>
          <dd className="whitespace-pre-wrap break-words font-medium text-foreground">{row.extraDescription ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Valor do serviço extra</dt>
          <dd className="font-semibold text-foreground">{money(row.extraAmount)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Consegna</dt>
          <dd className="font-semibold text-foreground">{money(row.consegnaFee)}</dd>
        </div>
      </dl>

      <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${isPending ? 'bg-amber-100 text-amber-900' : 'bg-primary text-primary-foreground'}`}>
        <span className="text-xs font-semibold uppercase tracking-wider">Total O.S.</span>
        <span className="font-bold">{isPending ? 'Pendente' : money(row.totalPrice)}</span>
      </div>
    </article>
  )
}

function ReceivableSectionBlock({ section }: { section: ReceivableSection }) {
  const style = SECTION_STYLE[section.mode]

  return (
    <Card>
      <div className={`flex flex-wrap items-center justify-between gap-2 border-l-4 px-5 py-4 ${style.header}`}>
        <h2 className="text-base font-bold text-foreground">{style.title}</h2>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${style.badge}`}>
          {section.orderCount} {section.orderCount === 1 ? 'O.S.' : 'O.S.'}
        </span>
      </div>

      <div className="notranslate hidden overflow-x-auto lg:block" translate="no">
        <table className="w-full min-w-[1560px] text-xs">
          <thead>
            <tr className="border-y border-border bg-primary text-primary-foreground">
              <th colSpan={4} className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider">Identificação</th>
              <th colSpan={7} className="border-l border-white/15 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider">Ocupação</th>
              <th colSpan={6} className="border-l border-white/15 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider">Composição de valores</th>
            </tr>
            <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 text-left">Data</th>
              <th className="px-3 py-2.5 text-right">O.S.</th>
              <th className="min-w-40 px-3 py-2.5 text-left">Imóvel</th>
              <th className="min-w-32 px-3 py-2.5 text-left">Cliente</th>
              <th className="px-2 py-2.5 text-center">PX</th>
              <th className="px-2 py-2.5 text-center">M</th>
              <th className="px-2 py-2.5 text-center">S</th>
              <th className="px-2 py-2.5 text-center">DL</th>
              <th className="px-2 py-2.5 text-center">WC</th>
              <th className="px-2 py-2.5 text-center">BI</th>
              <th className="px-2 py-2.5 text-center">CUL</th>
              <th className="min-w-28 px-3 py-2.5 text-right">Preço base atual</th>
              <th className="min-w-28 px-3 py-2.5 text-right">Valor considerado</th>
              <th className="min-w-64 px-3 py-2.5 text-left">Descrição do serviço extra</th>
              <th className="min-w-28 px-3 py-2.5 text-right">Valor do serviço extra</th>
              <th className="min-w-24 px-3 py-2.5 text-right">Consegna</th>
              <th className="min-w-28 px-3 py-2.5 text-right">Total O.S.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {section.rows.length === 0 ? (
              <tr>
                <td colSpan={17} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  <span>Nenhuma O.S. nesta modalidade para o período.</span>
                </td>
              </tr>
            ) : section.rows.map(row => (
              <tr
                key={row.orderId}
                className={`align-top transition-colors hover:bg-muted/25 ${row.financialStatus === 'pending' ? 'bg-amber-50/70' : ''}`}
              >
                <td className="whitespace-nowrap px-3 py-3 text-foreground/70"><span>{dateOnly(row.cleaningDate)}</span></td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-foreground"><span>#{row.orderNumber}</span></td>
                <td className="px-3 py-3 font-medium text-foreground">
                  <span>{row.propertyName}</span>
                  {row.financialStatus === 'pending' && (
                    <span className="mt-1 block text-[10px] font-semibold text-amber-800">
                      {PENDING_REASON_LABEL[row.pendingReason]}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-foreground/70"><span>{row.clientName}</span></td>
                <td className="px-2 py-3 text-center"><span>{row.occupancy.guests ?? '—'}</span></td>
                <td className="px-2 py-3 text-center"><span>{row.occupancy.doubleBeds}</span></td>
                <td className="px-2 py-3 text-center"><span>{row.occupancy.singleBeds}</span></td>
                <td className="px-2 py-3 text-center"><span>{row.occupancy.sofaBeds}</span></td>
                <td className="px-2 py-3 text-center"><span>{row.occupancy.bathrooms}</span></td>
                <td className="px-2 py-3 text-center"><span>{row.occupancy.bidets}</span></td>
                <td className="px-2 py-3 text-center"><span>{row.occupancy.cribs}</span></td>
                <td className="whitespace-nowrap bg-amber-50/60 px-3 py-3 text-right"><span>{money(row.currentBasePrice)}</span></td>
                <td className="whitespace-nowrap bg-amber-50/60 px-3 py-3 text-right font-semibold"><span>{money(row.consideredAmount)}</span></td>
                <td className="whitespace-pre-wrap break-words px-3 py-3 text-foreground/80"><span>{row.extraDescription ?? '—'}</span></td>
                <td className="whitespace-nowrap px-3 py-3 text-right"><span>{money(row.extraAmount)}</span></td>
                <td className="whitespace-nowrap px-3 py-3 text-right"><span>{money(row.consegnaFee)}</span></td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-foreground">
                  <span>{row.financialStatus === 'pending' ? 'Pendente' : money(row.totalPrice)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="notranslate lg:hidden" translate="no">
        {section.rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <Receipt size={19} className="text-muted-foreground/50" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Nenhuma O.S. nesta modalidade para o período.</span>
          </div>
        ) : section.rows.map(row => <MobileOrderCard key={row.orderId} row={row} />)}
      </div>

      <SectionSummary section={section} />
    </Card>
  )
}

export function ReceivableStatement({
  initial,
  initialStartDate,
  initialEndDate,
  agencies,
  owners,
}: {
  initial: ReceivableReport
  initialStartDate: string
  initialEndDate: string
  agencies: ClientOption[]
  owners: ClientOption[]
}) {
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [clientType, setClientType] = useState<ClientTypeFilter>('all')
  const [clientId, setClientId] = useState<string>('all')
  const [report, setReport] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleTypeChange(newType: ClientTypeFilter) {
    setClientType(newType)
    setClientId('all')
  }

  function requestReport(onSuccess?: (nextReport: ReceivableReport) => void) {
    setError(null)
    startTransition(async () => {
      try {
        const nextReport = await fetchReceivableReport(
          startDate,
          endDate,
          clientType === 'all' ? undefined : clientType,
          clientId === 'all' ? undefined : clientId,
        )
        setReport(nextReport)
        onSuccess?.(nextReport)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Erro ao buscar dados')
      }
    })
  }

  function handleCSV() {
    const params = new URLSearchParams({ start: startDate, end: endDate })
    if (clientType !== 'all') params.set('client_type', clientType)
    if (clientId !== 'all') params.set('client_id', clientId)
    window.open(`/api/export/receivable?${params}`, '_blank')
  }

  function handlePDF() {
    requestReport(nextReport => {
      if (nextReport.pendingCount > 0) {
        setError(exportBlockedMessage(nextReport.pendingCount))
        return
      }
      exportReceivablePDF(nextReport)
    })
  }

  const clientOptions = clientType === 'rental' ? agencies : clientType === 'particular' ? owners : []
  const clientLabel = clientType === 'rental' ? 'Agência' : clientType === 'particular' ? 'Proprietário' : null
  const pendingRows = [report.standard, report.ripasso, report.outLongStay]
    .flatMap(section => section.rows)
    .filter(row => row.financialStatus === 'pending')
  const pendingProperties = [...new Set(pendingRows.map(row => row.propertyName))]
  const visiblePendingProperties = pendingProperties.slice(0, 5)
  const hiddenPendingPropertyCount = pendingProperties.length - visiblePendingProperties.length
  const exportDisabled = isPending || report.pendingCount > 0

  return (
    <div className="space-y-5">
      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">De</label>
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Até</label>
            <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo de Cliente</label>
            <select value={clientType} onChange={event => handleTypeChange(event.target.value as ClientTypeFilter)} className={inputCls}>
              {CLIENT_TYPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          {clientLabel && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{clientLabel}</label>
              <select value={clientId} onChange={event => setClientId(event.target.value)} className={inputCls}>
                <option value="all">Todos</option>
                {clientOptions.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
          )}
          <Button type="button" onClick={() => requestReport()} isLoading={isPending} variant="accent" icon={<Filter size={16} />}>
            {isPending ? 'Buscando…' : 'Filtrar'}
          </Button>
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              onClick={handleCSV}
              disabled={exportDisabled}
              title={report.pendingCount > 0 ? exportBlockedMessage(report.pendingCount) : undefined}
              variant="ghost"
              size="sm"
              icon={<Download size={14} />}
            >
              CSV
            </Button>
            <Button
              type="button"
              onClick={handlePDF}
              disabled={exportDisabled}
              title={report.pendingCount > 0 ? exportBlockedMessage(report.pendingCount) : undefined}
              variant="ghost"
              size="sm"
              icon={<FileText size={14} />}
            >
              PDF
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger"><span>{error}</span></div>
      )}

      {report.pendingCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950" role="alert">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={20} />
          <div className="space-y-1 text-sm">
            <span className="block font-semibold">
              {report.pendingCount} {report.pendingCount === 1 ? 'O.S. pendente' : 'O.S. pendentes'} de preço
            </span>
            <span className="block">
              O total abaixo é parcial e considera {report.completeOrderCount} de {report.orderCount} O.S. CSV e PDF ficam bloqueados até a correção.
            </span>
            {visiblePendingProperties.length > 0 && (
              <span className="block text-xs text-amber-800">
                Imóveis envolvidos: {visiblePendingProperties.join(', ')}{hiddenPendingPropertyCount > 0 ? ` e mais ${hiddenPendingPropertyCount}` : ''}.
              </span>
            )}
          </div>
        </div>
      )}

      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Período aplicado</span>
            <span className="mt-1 block font-semibold text-foreground">{dateOnly(report.period.startDate)} a {dateOnly(report.period.endDate)}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="block text-xs text-muted-foreground">Total de O.S.</span>
              <span className="block text-lg font-bold text-foreground">{report.orderCount}</span>
            </div>
            <div className="text-right">
              <span className="block text-xs text-muted-foreground">{report.pendingCount > 0 ? 'Total parcial' : 'Total geral'}</span>
              <span className="block text-xl font-bold text-accent">{money(report.grandTotal)}</span>
            </div>
          </div>
        </div>
      </Card>

      <ReceivableSectionBlock section={report.standard} />
      <ReceivableSectionBlock section={report.ripasso} />
      <ReceivableSectionBlock section={report.outLongStay} />

      <div className="flex items-center justify-between rounded-xl bg-primary px-5 py-4 text-primary-foreground shadow-card">
        <span className="font-semibold">{report.pendingCount > 0 ? 'Total parcial do período' : 'Total geral do período'}</span>
        <span className="text-xl font-bold">{money(report.grandTotal)}</span>
      </div>
    </div>
  )
}
