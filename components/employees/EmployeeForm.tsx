'use client'

import { useState, useTransition } from 'react'
import { createEmployee, updateEmployee, deleteEmployee } from '@/app/(app)/employees/actions'
import type { Profile, Role } from '@/lib/types/database'

function Section({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left font-medium text-gray-700 transition-colors"
      >
        <span>{title}</span>
        <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="px-4 py-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {children}
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string
  required?: boolean
  full?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500'

const EMPLOYEE_ROLES: { value: string; label: string }[] = [
  { value: 'limpeza', label: 'Limpeza' },
  { value: 'consegna', label: 'Consegna' },
  { value: 'secretaria', label: 'Secretaria' },
  { value: 'admin', label: 'Admin' },
]

export function EmployeeForm({
  employee,
  viewerRole,
  deleteAction,
  readOnly = false,
}: {
  employee?: Profile
  viewerRole: Role
  deleteAction?: () => Promise<unknown>
  readOnly?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [open, setOpen] = useState({ pessoal: true, remuneracao: false })
  function toggle(s: keyof typeof open) {
    setOpen(prev => ({ ...prev, [s]: !prev[s] }))
  }

  const isAdmin = viewerRole === 'admin'
  const canEdit = ['admin', 'secretaria'].includes(viewerRole) && !readOnly

  // --- Dados Pessoais ---
  const [fullName, setFullName] = useState(employee?.full_name ?? '')
  const [email, setEmail] = useState(employee?.email ?? '')
  const [phone, setPhone] = useState(employee?.phone ?? '')
  const [birthDate, setBirthDate] = useState(employee?.birth_date ?? '')
  const [nationality, setNationality] = useState(employee?.nationality ?? '')
  const [address, setAddress] = useState(employee?.address ?? '')
  const [role, setRole] = useState<string>(employee?.role ?? 'limpeza')

  // --- Remuneração (admin only) ---
  const [hourlyRate, setHourlyRate] = useState(employee?.hourly_rate?.toString() ?? '')
  const [hasFixedSalary, setHasFixedSalary] = useState(
    employee?.monthly_salary != null,
  )
  const [monthlySalary, setMonthlySalary] = useState(
    employee?.monthly_salary?.toString() ?? '',
  )
  const [overtimeRate, setOvertimeRate] = useState(
    employee?.overtime_rate?.toString() ?? '',
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const fd = new FormData()
    fd.set('full_name', fullName)
    fd.set('email', email)
    fd.set('phone', phone)
    fd.set('birth_date', birthDate)
    fd.set('nationality', nationality)
    fd.set('address', address)
    fd.set('role', role)

    if (isAdmin) {
      fd.set('hourly_rate', hourlyRate)
      fd.set('has_fixed_salary', String(hasFixedSalary))
      if (hasFixedSalary) {
        fd.set('monthly_salary', monthlySalary)
        fd.set('overtime_rate', overtimeRate)
      }
    }

    startTransition(async () => {
      const result = employee
        ? await updateEmployee(employee.id, fd)
        : await createEmployee(fd)

      if (result && !result.success) {
        setError(result.error)
      } else if (result?.success) {
        setSuccess(true)
      }
    })
  }

  async function handleDelete() {
    if (!deleteAction) return
    if (!window.confirm('Tem certeza que deseja excluir este funcionário? Esta ação não pode ser desfeita.')) return
    setIsDeleting(true)
    const result = await deleteAction()
    if (result && typeof result === 'object' && 'success' in result && !(result as { success: boolean }).success) {
      setError((result as { error: string }).error)
      setIsDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
      {/* 1. Dados Pessoais */}
      <Section title="1. Dados Pessoais" isOpen={open.pessoal} onToggle={() => toggle('pessoal')}>
        <Field label="Nome Completo" required full>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            required={canEdit}
            disabled={!canEdit}
            className={inputCls}
            placeholder="Nome completo"
          />
        </Field>

        <Field label="Email" required>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required={canEdit}
            disabled={!canEdit || !!employee}
            className={inputCls}
            placeholder="email@exemplo.com"
          />
          {!!employee && (
            <p className="mt-1 text-xs text-gray-400">Email não pode ser alterado após criação.</p>
          )}
        </Field>

        <Field label="Telefone">
          <input
            type="text"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            disabled={!canEdit}
            className={inputCls}
            placeholder="+39 000 0000000"
          />
        </Field>

        <Field label="Data de Nascimento">
          <input
            type="date"
            value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
            disabled={!canEdit}
            className={inputCls}
          />
        </Field>

        <Field label="Nacionalidade">
          <input
            type="text"
            value={nationality}
            onChange={e => setNationality(e.target.value)}
            disabled={!canEdit}
            className={inputCls}
            placeholder="Ex: Italiana, Brasileira..."
          />
        </Field>

        <Field label="Tipo de Funcionário" required>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            required={canEdit}
            disabled={!canEdit}
            className={inputCls}
          >
            {EMPLOYEE_ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Endereço" full>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            disabled={!canEdit}
            className={inputCls}
          />
        </Field>
      </Section>

      {/* 2. Remuneração (admin only) */}
      {isAdmin && (
        <Section title="2. Remuneração" isOpen={open.remuneracao} onToggle={() => toggle('remuneracao')}>
          <Field label="Valor por Hora (€)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={hourlyRate}
              onChange={e => setHourlyRate(e.target.value)}
              disabled={!canEdit}
              className={inputCls}
            />
          </Field>

          <Field label="Salário Fixo">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasFixedSalary}
                onChange={e => setHasFixedSalary(e.target.checked)}
                disabled={!canEdit}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Possui salário mensal fixo</span>
            </label>
          </Field>

          {hasFixedSalary && (
            <>
              <Field label="Salário Mensal (€)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={monthlySalary}
                  onChange={e => setMonthlySalary(e.target.value)}
                  disabled={!canEdit}
                  className={inputCls}
                />
              </Field>

              <Field label="Hora Extra (€)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={overtimeRate}
                  onChange={e => setOvertimeRate(e.target.value)}
                  disabled={!canEdit}
                  className={inputCls}
                />
              </Field>
            </>
          )}
        </Section>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>
      )}

      {success && (
        <p className="text-sm text-green-600 bg-green-50 px-4 py-3 rounded-lg">
          Funcionário salvo com sucesso.
        </p>
      )}

      {canEdit && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isPending ? 'Salvando…' : employee ? 'Salvar Alterações' : 'Criar Funcionário'}
          </button>

          {deleteAction && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg border border-red-200 transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Excluindo…' : 'Excluir Funcionário'}
            </button>
          )}
        </div>
      )}
    </form>
  )
}
