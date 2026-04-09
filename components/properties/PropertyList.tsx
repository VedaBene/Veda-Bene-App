'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Agency, Owner, Property, Role } from '@/lib/types/database'

type PropertyWithRelations = Property & {
  agency: Agency | null
  owner: Owner | null
}

const CLIENT_TYPE_LABEL: Record<string, string> = {
  rental: 'Rental',
  particular: 'Particular',
}

export function PropertyList({
  properties,
  role,
}: {
  properties: PropertyWithRelations[]
  role: Role
}) {
  const [search, setSearch] = useState('')

  const showPrice = role === 'admin' || role === 'secretaria'

  const filtered = properties.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-100">
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Zona</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Endereço</th>
              {showPrice && (
                <th className="text-right px-4 py-3 font-medium text-gray-600">Preço Base</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={showPrice ? 5 : 4}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  {search ? 'Nenhum imóvel encontrado.' : 'Nenhum imóvel cadastrado.'}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/properties/${p.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {CLIENT_TYPE_LABEL[p.client_type] ?? p.client_type}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.zone}</td>
                  <td className="px-4 py-3 text-gray-500">{p.address ?? '—'}</td>
                  {showPrice && (
                    <td className="px-4 py-3 text-right text-gray-700">
                      {p.base_price != null ? `€ ${p.base_price.toFixed(2)}` : '—'}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
