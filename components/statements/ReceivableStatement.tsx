'use client'

import { useState, useTransition } from 'react'
import { fetchReceivableData, type ReceivableRow } from '@/app/(app)/statements/actions'
import { exportReceivablePDF } from '@/lib/utils/export-pdf'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

const inputCls =
  'px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

type ClientTypeFilter = 'all' | 'rental' | 'particular'

const CLIENT_TYPE_OPTIONS: { value: ClientTypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'rental', label: 'B2B (Agências)' },
  { value: 'particular', label: 'B2C (Particulares)' },
]

export function ReceivableStatement({ initial }: { initial: ReceivableRow[] }) {
  const [startDate, setStartDate] = useState(firstOfMonth())
  const [endDate, setEndDate] = useState(today())
  const [clientType, setClientType] = useState<ClientTypeFilter>('all')
  const [data, setData] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleFilter() {
    setError(null)
    startTransition(async () => {
      try {
        const rows = await fetchReceivableData(
          startDate,
          endDate,
          clientType === 'all' ? undefined : clientType,
        )
        setData(rows)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao buscar dados')
      }
    })
  }

  function handleCSV() {
    const params = new URLSearchParams({ start: startDate, end: endDate })
    if (clientType !== 'all') params.set('client_type', clientType)
    window.open(`/api/export/receivable?${params}`, '_blank')
  }

  function handlePDF() {
    exportReceivablePDF(data, startDate, endDate)
  }

  const total = data.reduce((sum, r) => sum + r.total_value, 0)

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">De</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Até</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Cliente</label>
          <select
            value={clientType}
            onChange={e => setClientType(e.target.value as ClientTypeFilter)}
            className={inputCls}
          >
            {CLIENT_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleFilter}
          disabled={isPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Buscando…' : 'Filtrar'}
        </button>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={handleCSV}
            className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={handlePDF}
            className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Exportar PDF
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Imóvel</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total OS</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total (€)</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Nenhum dado encontrado para o período.
                </td>
              </tr>
            ) : (
              data.map(r => (
                <tr key={r.property_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.client_name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${r.client_type === 'rental' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                      {r.client_type === 'rental' ? 'B2B' : 'B2C'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.property_name}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.os_count}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">
                    € {r.total_value.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {data.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td colSpan={4} className="px-4 py-3 font-semibold text-gray-700">
                  Total Geral
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  € {total.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
