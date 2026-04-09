'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Agency, Owner, Property, Role } from '@/lib/types/database'
import { Search, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

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
    <Card>
      <div className="p-4 border-b border-border/50">
        <Input
          type="text"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={16} />}
          className="max-w-sm"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Zona</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Endereço</th>
              {showPrice && (
                <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preço Base</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={showPrice ? 5 : 4}
                  className="px-5 py-12 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Building2 size={20} className="text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                      {search ? 'Nenhum imóvel encontrado.' : 'Nenhum imóvel cadastrado.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/properties/${p.id}`}
                      className="font-medium text-primary hover:text-accent transition-colors"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.client_type === 'rental'
                        ? 'bg-accent-light text-accent'
                        : 'bg-purple-50 text-purple-700'
                    }`}>
                      {CLIENT_TYPE_LABEL[p.client_type] ?? p.client_type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-foreground/70">{p.zone}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{p.address ?? '—'}</td>
                  {showPrice && (
                    <td className="px-5 py-3.5 text-right font-medium text-foreground">
                      {p.base_price != null ? `€ ${p.base_price.toFixed(2)}` : '—'}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
