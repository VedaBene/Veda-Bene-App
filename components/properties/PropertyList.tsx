'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import type { Role } from '@/lib/types/database'
import type { PropertyListItem } from '@/lib/types/view-models'
import { Search, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Pagination } from '@/components/ui/Pagination'

const CLIENT_TYPE_LABEL: Record<string, string> = {
  rental: 'Rental',
  particular: 'Particular',
}

export function PropertyList({
  properties,
  role,
  currentPage,
  totalPages,
  q,
}: {
  properties: PropertyListItem[]
  role: Role
  currentPage: number
  totalPages: number
  q: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState(q)

  useEffect(() => {
    setSearch(q)
  }, [q])

  const pushSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams()
      if (value) params.set('q', value)
      params.set('page', '1')
      router.replace(`${pathname}?${params.toString()}`)
    },
    [router, pathname],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== q) pushSearch(search)
    }, 300)
    return () => clearTimeout(t)
  }, [search, q, pushSearch])

  const showPrice = role === 'admin' || role === 'secretaria'
  const showType = role === 'admin' || role === 'secretaria'

  const searchParams = q ? { q } : {}

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

      {/* Mobile View (Cards) */}
      <div className="md:hidden">
        {properties.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Building2 size={20} className="text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                {q ? 'Nenhum imóvel encontrado.' : 'Nenhum imóvel cadastrado.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col px-3 py-3 gap-3">
            {properties.map((p) => (
              <Link
                key={p.id}
                href={`/properties/${p.id}`}
                className="block bg-card rounded-xl border border-border p-4 shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-primary/90 text-[15px] leading-tight">
                    {p.name}
                  </h3>
                  {showType && (
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      p.client_type === 'rental'
                        ? 'bg-accent-light text-accent'
                        : 'bg-purple-50 text-purple-700'
                    }`}>
                      {CLIENT_TYPE_LABEL[p.client_type ?? ''] ?? p.client_type}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 mt-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-foreground">{p.zone}</span>
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {p.address ?? 'Sem endereço cadastrado'}
                  </div>
                </div>

                {showPrice && p.base_price != null && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Preço Base</span>
                    <span className="font-medium text-foreground text-sm">
                      € {p.base_price.toFixed(2)}
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Desktop View (Table) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
              {showType && (
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</th>
              )}
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Zona</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Endereço</th>
              {showPrice && (
                <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preço Base</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {properties.length === 0 ? (
              <tr>
                <td
                  colSpan={3 + (showType ? 1 : 0) + (showPrice ? 1 : 0)}
                  className="px-5 py-12 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Building2 size={20} className="text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                      {q ? 'Nenhum imóvel encontrado.' : 'Nenhum imóvel cadastrado.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              properties.map((p) => (
                <tr
                  key={p.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/properties/${p.id}`}
                      className="font-medium text-primary hover:text-accent transition-colors block h-full w-full"
                    >
                      {p.name}
                    </Link>
                  </td>
                  {showType && (
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        p.client_type === 'rental'
                          ? 'bg-accent-light text-accent'
                          : 'bg-purple-50 text-purple-700'
                      }`}>
                        {CLIENT_TYPE_LABEL[p.client_type ?? ''] ?? p.client_type}
                      </span>
                    </td>
                  )}
                  <td className="px-5 py-3.5 text-foreground/70">{p.zone}</td>
                  <td className="px-5 py-3.5 text-muted-foreground max-w-xs truncate">{p.address ?? '—'}</td>
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

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        basePath="/properties"
        searchParams={searchParams}
      />
    </Card>
  )
}
