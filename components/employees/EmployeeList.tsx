'use client'

import Link from 'next/link'
import type { Profile, Role } from '@/lib/types/database'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  secretaria: 'Secretaria',
  limpeza: 'Limpeza',
  consegna: 'Consegna',
  cliente: 'Cliente',
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Telefone</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nascimento</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nacionalidade</th>
              {showSalary && (
                <>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">€/hora</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Salário Fixo</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Hora Extra</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td
                  colSpan={showSalary ? 9 : 6}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  Nenhum funcionário cadastrado.
                </td>
              </tr>
            ) : (
              employees.map(emp => (
                <tr
                  key={emp.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/employees/${emp.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {emp.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{emp.email}</td>
                  <td className="px-4 py-3 text-gray-500">{emp.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {ROLE_LABEL[emp.role] ?? emp.role}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(emp.birth_date)}</td>
                  <td className="px-4 py-3 text-gray-500">{emp.nationality ?? '—'}</td>
                  {showSalary && (
                    <>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {emp.hourly_rate != null ? `€ ${emp.hourly_rate.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {emp.monthly_salary != null ? `€ ${emp.monthly_salary.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
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
    </div>
  )
}
