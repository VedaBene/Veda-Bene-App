'use client'

import { useState, useTransition } from 'react'
import { createEmployee, updateEmployee } from '@/app/(app)/employees/actions'
import { Section } from '@/components/ui/Section'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { User, Wallet, CheckCircle, AlertCircle } from 'lucide-react'
import { canManageEmployees, getAssignableEmployeeRoles } from '@/lib/employee-permissions'
import type { Role } from '@/lib/types/database'
import type { EmployeeFormData } from '@/lib/types/view-models'

const inputCls =
  'w-full px-3 py-2.5 border border-input-border rounded-lg text-sm text-foreground bg-white transition-all duration-200 focus:ring-2 focus:ring-input-focus/20 focus:border-input-focus disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed outline-none placeholder:text-muted-foreground/50'

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  secretaria: 'Secretaria',
  limpeza: 'Limpeza',
  consegna: 'Consegna',
  cliente: 'Cliente',
}

export function EmployeeForm({
  employee,
  viewerRole,
  deleteAction,
  readOnly = false,
}: {
  employee?: EmployeeFormData
  viewerRole: Role
  deleteAction?: () => Promise<{ success: false; error: string } | void>
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
  const canManage = canManageEmployees(viewerRole)
  const assignableRoles = getAssignableEmployeeRoles(viewerRole)
  const canEdit = canManage && !readOnly

  const [fullName, setFullName] = useState(employee?.full_name ?? '')
  const [email, setEmail] = useState(employee?.email ?? '')
  const [phone, setPhone] = useState(employee?.phone ?? '')
  const [birthDate, setBirthDate] = useState(employee?.birth_date ?? '')
  const [nationality, setNationality] = useState(employee?.nationality ?? '')
  const [address, setAddress] = useState(employee?.address ?? '')
  const [role, setRole] = useState<string>(employee?.role ?? assignableRoles[0] ?? '')
  const roleOptions = canManage ? assignableRoles : employee?.role ? [employee.role] : []

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
    if (result && !result.success) {
      setError(result.error)
      setIsDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
      <Section title="1. Dados Pessoais" icon={<User size={18} />} isOpen={open.pessoal} onToggle={() => toggle('pessoal')}>
        <Field label="Nome Completo" required full>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required={canEdit} disabled={!canEdit} className={inputCls} placeholder="Nome completo" />
        </Field>

        <Field label="Email" required>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required={canEdit} disabled={!canEdit || !!employee} className={inputCls} placeholder="email@exemplo.com" />
          {!!employee && (
            <p className="mt-1 text-xs text-muted-foreground">Email não pode ser alterado após criação.</p>
          )}
        </Field>

        <Field label="Telefone">
          <input type="text" value={phone} onChange={e => setPhone(e.target.value)} disabled={!canEdit} className={inputCls} placeholder="+39 000 0000000" />
        </Field>

        <Field label="Data de Nascimento">
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>

        <Field label="Nacionalidade">
          <input type="text" value={nationality} onChange={e => setNationality(e.target.value)} disabled={!canEdit} className={inputCls} placeholder="Ex: Italiana, Brasileira..." />
        </Field>

        <Field label="Tipo de Funcionário" required>
          <select value={role} onChange={e => setRole(e.target.value)} required={canEdit} disabled={!canEdit} className={inputCls}>
            {roleOptions.map(option => (
              <option key={option} value={option}>
                {ROLE_LABELS[option]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Endereço" full>
          <input type="text" value={address} onChange={e => setAddress(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
      </Section>

      {isAdmin && (
        <Section title="2. Remuneração" icon={<Wallet size={18} />} isOpen={open.remuneracao} onToggle={() => toggle('remuneracao')}>
          <Field label="Valor por Hora (€)">
            <input type="number" step="0.01" min="0" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} disabled={!canEdit} className={inputCls} />
          </Field>

          <Field label="Salário Fixo">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={hasFixedSalary}
                onChange={e => setHasFixedSalary(e.target.checked)}
                disabled={!canEdit}
                className="w-4 h-4 rounded border-input-border text-accent focus:ring-accent/20"
              />
              <span className="text-sm text-foreground">Possui salário mensal fixo</span>
            </label>
          </Field>

          {hasFixedSalary && (
            <>
              <Field label="Salário Mensal (€)">
                <input type="number" step="0.01" min="0" value={monthlySalary} onChange={e => setMonthlySalary(e.target.value)} disabled={!canEdit} className={inputCls} />
              </Field>

              <Field label="Hora Extra (€)">
                <input type="number" step="0.01" min="0" value={overtimeRate} onChange={e => setOvertimeRate(e.target.value)} disabled={!canEdit} className={inputCls} />
              </Field>
            </>
          )}
        </Section>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger-bg px-4 py-3 rounded-xl">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-sm text-success bg-success-bg px-4 py-3 rounded-xl">
          <CheckCircle size={16} className="shrink-0" />
          Funcionário salvo com sucesso.
        </div>
      )}

      {canEdit && (
        <div className="flex items-center justify-between pt-2">
          <Button type="submit" isLoading={isPending} variant="accent">
            {isPending ? 'Salvando…' : employee ? 'Salvar Alterações' : 'Criar Funcionário'}
          </Button>

          {deleteAction && (
            <Button type="button" onClick={handleDelete} isLoading={isDeleting} variant="danger" size="sm">
              {isDeleting ? 'Excluindo…' : 'Excluir Funcionário'}
            </Button>
          )}
        </div>
      )}
    </form>
  )
}
