'use client'

import Link from 'next/link'
import type { Profile, Role } from '@/lib/types/database'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Users } from 'lucide-react'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  secretaria: 'Secretaria',
  limpeza: 'Limpeza',
  consegna: 'Consegna',
  cliente: 'Cliente',
}

const ROLE_VARIANT: Record<string, 'info' | 'success' | 'warning' | 'default'> = {
  admin: 'info',
  secretaria: 'info',
  limpeza: 'success',
  consegna: 'warning',
  cliente: 'default',
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

export function EmployeeList({
  employees,
  role,
}: {
  employees: Profile[]
  role: Role
}) {
  const showSalary = role === 'admin'

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Telefone</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nascimento</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nacionalidade</th>
              {showSalary && (
                <>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">€/hora</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Salário Fixo</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hora Extra</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {employees.length === 0 ? (
              <tr>
                <td
                  colSpan={showSalary ? 9 : 6}
                  className="px-5 py-12 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Users size={20} className="text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">Nenhum funcionário cadastrado.</p>
                  </div>
                </td>
              </tr>
            ) : (
              employees.map(emp => (
                <tr
                  key={emp.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/employees/${emp.id}`}
                      className="font-medium text-primary hover:text-accent transition-colors"
                    >
                      {emp.full_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-foreground/70">{emp.email}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{emp.phone ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant={ROLE_VARIANT[emp.role] ?? 'default'}
                      label={ROLE_LABEL[emp.role] ?? emp.role}
                    />
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{formatDate(emp.birth_date)}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{emp.nationality ?? '—'}</td>
                  {showSalary && (
                    <>
                      <td className="px-5 py-3.5 text-right font-medium text-foreground">
                        {emp.hourly_rate != null ? `€ ${emp.hourly_rate.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-foreground">
                        {emp.monthly_salary != null ? `€ ${emp.monthly_salary.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-foreground">
                        {emp.overtime_rate != null ? `€ ${emp.overtime_rate.toFixed(2)}` : '—'}
                      </td>
                    </>
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
