'use client'

import Link from 'next/link'
import { UrgencyBadge } from './UrgencyBadge'
import type { Profile, Property, Role, ServiceOrder } from '@/lib/types/database'

type OSWithRelations = ServiceOrder & {
  property: Pick<Property, 'id' | 'name'> | null
  cleaning_staff: Pick<Profile, 'id' | 'full_name'> | null
  consegna_staff: Pick<Profile, 'id' | 'full_name'> | null
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  done: 'Finalizada',
}

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

function OSTable({
  orders,
  role,
  emptyText,
}: {
  orders: OSWithRelations[]
  role: Role
  emptyText: string
}) {
  const isCliente = role === 'cliente'

  if (orders.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-center text-gray-400">{emptyText}</p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-3 font-medium text-gray-600">Imóvel</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Checkout</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Checkin</th>
            {!isCliente && (
              <>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Limpeza</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Consegna</th>
              </>
            )}
            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {orders.map((os) => (
            <tr
              key={os.id}
              className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">
                    {os.property?.name ?? '—'}
                  </span>
                  <UrgencyBadge isUrgent={os.is_urgent} />
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600">{formatDate(os.cleaning_date)}</td>
              <td className="px-4 py-3 text-gray-600">{formatDateTime(os.checkout_at)}</td>
              <td className="px-4 py-3 text-gray-600">{formatDateTime(os.checkin_at)}</td>
              {!isCliente && (
                <>
                  <td className="px-4 py-3 text-gray-600">
                    {os.cleaning_staff?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {os.consegna_staff?.full_name ?? '—'}
                  </td>
                </>
              )}
              <td className="px-4 py-3">
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLOR[os.status] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {STATUS_LABEL[os.status] ?? os.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/service-orders/${os.id}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ServiceOrderList({
  active,
  done,
  role,
}: {
  active: OSWithRelations[]
  done: OSWithRelations[]
  role: Role
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Em Aberto</h2>
        </div>
        <OSTable orders={active} role={role} emptyText="Nenhuma OS em aberto." />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Finalizadas</h2>
        </div>
        <OSTable orders={done} role={role} emptyText="Nenhuma OS finalizada." />
      </div>
    </div>
  )
}
