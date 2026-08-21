import 'server-only'

import { z } from 'zod'
import { getAuthorizedClient } from '@/lib/server/authz'
import { getAssignableEmployeeRoles } from '@/lib/employee-permissions'
import type { Role } from '@/lib/types/database'
import {
  employeeRoleSchema,
  optionalDateOnlySchema,
  validationMessage,
} from '@/lib/server/validation/contracts'
import {
  defaultEmployeeAdminAdapter,
  type EmployeeAdminAdapter,
  type EmployeeProfileUpdateData,
} from '@/utils/supabase/admin'

const optStr = z.preprocess(
  v => (typeof v === 'string' ? (v.trim() === '' ? undefined : v.trim()) : v == null ? undefined : v),
  z.string().optional(),
)

const optNum = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().min(0, 'O valor não pode ser negativo').optional(),
)

export const inviteEmployeeSchema = z.object({
  full_name: z.preprocess(
    v => (typeof v === 'string' ? v.trim() : v),
    z.string().min(1, 'Nome obrigatório'),
  ),
  email: z.preprocess(
    v => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.string().email('Email inválido'),
  ),
  phone: optStr,
  birth_date: optionalDateOnlySchema,
  nationality: optStr,
  address: optStr,
  role: employeeRoleSchema,
  // remuneração — opcionais, só admin envia
  hourly_rate: optNum,
  has_fixed_salary: z.preprocess(v => v === 'true' || v === true, z.boolean()).optional(),
  monthly_salary: optNum,
  overtime_rate: optNum,
  redirectTo: z.string().url('URL de redirecionamento inválida'),
})

export type InviteEmployeeInput = z.infer<typeof inviteEmployeeSchema>

export type InviteEmployeeOutcome =
  | {
      status: 'created'
      employeeId: string
      message?: string
    }
  | {
      status: 'reconciled'
      employeeId: string
      message?: string
    }
  | {
      status: 'already_exists'
      employeeId?: string
      error: string
    }
  | {
      status: 'failed'
      step: 'auth' | 'profile' | 'authorization' | 'validation'
      error: string
      reconciliationRequired?: boolean
      employeeId?: string
    }

export type InviteEmployeeResult = InviteEmployeeOutcome

export interface InviteEmployeeOptions {
  adapter?: EmployeeAdminAdapter
}

function maskEmailForLog(email: string): string {
  const parts = email.split('@')
  if (parts.length !== 2) return '[invalid-email]'
  const name = parts[0]
  const domain = parts[1]
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0] ?? '*'}***`
  return `${maskedName}@${domain}`
}

export async function inviteEmployee(
  input: unknown,
  options?: InviteEmployeeOptions,
): Promise<InviteEmployeeResult> {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()
  const adapter = options?.adapter ?? defaultEmployeeAdminAdapter

  const parsed = inviteEmployeeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      status: 'failed',
      step: 'validation',
      error: validationMessage(parsed.error),
    }
  }

  const data = parsed.data
  const maskedEmail = maskEmailForLog(data.email)

  // 1. Autorização administrativa no servidor
  let authorizedRole: Role
  try {
    const authCtx = await getAuthorizedClient(['admin'])
    authorizedRole = authCtx.role
  } catch (authError) {
    console.warn(`[invite-employee] auth failed request_id=${requestId} duration_ms=${Date.now() - startedAt}`)
    return {
      status: 'failed',
      step: 'authorization',
      error: authError instanceof Error ? authError.message : 'Sem permissão',
    }
  }

  const assignableRoles = getAssignableEmployeeRoles(authorizedRole)
  if (!assignableRoles.includes(data.role)) {
    return {
      status: 'failed',
      step: 'authorization',
      error: 'Sem permissão para atribuir o cargo informado.',
    }
  }

  const profileUpdateData: EmployeeProfileUpdateData = {
    full_name: data.full_name,
    phone: data.phone ?? null,
    birth_date: data.birth_date ?? null,
    nationality: data.nationality ?? null,
    address: data.address ?? null,
    role: data.role,
    hourly_rate: data.hourly_rate ?? null,
    monthly_salary: data.has_fixed_salary ? (data.monthly_salary ?? null) : null,
    overtime_rate: data.has_fixed_salary ? (data.overtime_rate ?? null) : null,
  }

  // 2. Passo Auth: Tentar convite
  const authResult = await adapter.inviteAuthUser({
    email: data.email,
    fullName: data.full_name,
    redirectTo: data.redirectTo,
  })

  // Cenário 1: Novo usuário criado com sucesso no Auth
  if (authResult.success) {
    const employeeId = authResult.user.id
    console.log(
      `[invite-employee] auth user created request_id=${requestId} user_id=${employeeId} email=${maskedEmail}`,
    )

    // Atualizar perfil criado pelo trigger
    const updateResult = await adapter.updateProfile(employeeId, profileUpdateData)
    if (updateResult.error) {
      console.error(
        `[invite-employee] profile update failed for new user request_id=${requestId} user_id=${employeeId} error=${updateResult.error.message}`,
      )
      // Política de compensação: NÃO excluir usuário Auth preexistente / recém-criado.
      // Retornar status failed com reconciliação pendente no retry.
      return {
        status: 'failed',
        step: 'profile',
        employeeId,
        reconciliationRequired: true,
        error:
          'O convite foi enviado por email, mas ocorreu uma falha ao registrar as informações do perfil. Tente reenviar para concluir o cadastro.',
      }
    }

    console.log(
      `[invite-employee] completed successfully request_id=${requestId} user_id=${employeeId} status=created duration_ms=${Date.now() - startedAt}`,
    )
    return {
      status: 'created',
      employeeId,
    }
  }

  // Cenário 2 & 3: Usuário já existe no Auth
  if (authResult.error.isAlreadyRegistered) {
    console.log(
      `[invite-employee] user already exists in auth request_id=${requestId} email=${maskedEmail}, checking profile state`,
    )

    const profileLookup = await adapter.getProfileByEmail(data.email)
    let profile = profileLookup.profile

    // Se perfil não existe no Postgres mas existe no Auth, buscar ID e criar
    if (!profile) {
      const authLookup = await adapter.getAuthUserByEmail(data.email)
      if (authLookup.user?.id) {
        const createProfileRes = await adapter.createProfileIfMissing(
          authLookup.user.id,
          data.email,
          data.full_name,
        )
        if (!createProfileRes.error) {
          profile = {
            id: authLookup.user.id,
            email: data.email,
            full_name: data.full_name,
            role: 'cliente',
          }
        }
      }
    }

    if (profile) {
      // Subcenário 3A: Perfil já configurado com dados idênticos (retry após sucesso anterior)
      const isAlreadyMatching =
        profile.role === data.role &&
        profile.full_name === data.full_name &&
        (profile.phone ?? null) === (data.phone ?? null) &&
        (profile.hourly_rate ?? null) === (data.hourly_rate ?? null)

      if (isAlreadyMatching) {
        console.log(
          `[invite-employee] profile already configured with matching data request_id=${requestId} user_id=${profile.id} status=reconciled duration_ms=${Date.now() - startedAt}`,
        )
        return {
          status: 'reconciled',
          employeeId: profile.id,
          message: 'Funcionário já cadastrado com os dados informados.',
        }
      }

      // Subcenário 3B: Perfil incompleto / pendente (ex: role === 'cliente' default do trigger após falha anterior)
      if (profile.role === 'cliente') {
        console.log(
          `[invite-employee] reconciling pending profile request_id=${requestId} user_id=${profile.id}`,
        )
        const updateResult = await adapter.updateProfile(profile.id, profileUpdateData)
        if (updateResult.error) {
          console.error(
            `[invite-employee] profile reconciliation failed request_id=${requestId} user_id=${profile.id} error=${updateResult.error.message}`,
          )
          return {
            status: 'failed',
            step: 'profile',
            employeeId: profile.id,
            reconciliationRequired: true,
            error:
              'O usuário já foi convidado, mas ocorreu uma falha ao atualizar os dados do perfil. Tente reenviar para concluir.',
          }
        }

        console.log(
          `[invite-employee] reconciliation completed request_id=${requestId} user_id=${profile.id} status=reconciled duration_ms=${Date.now() - startedAt}`,
        )
        return {
          status: 'reconciled',
          employeeId: profile.id,
        }
      }

      // Subcenário 3C: Perfil já ativo com outro cargo/dados divergentes
      console.warn(
        `[invite-employee] conflict: active employee already exists request_id=${requestId} user_id=${profile.id} existing_role=${profile.role}`,
      )
      return {
        status: 'already_exists',
        employeeId: profile.id,
        error: 'Um usuário com este email já está cadastrado no sistema.',
      }
    }

    return {
      status: 'failed',
      step: 'auth',
      error: 'Usuário já existe no sistema de autenticação, mas não foi possível recuperar o perfil correspondente.',
    }
  }

  // Cenário 4: Outro erro de Auth (timeout, falha de rede, erro no provedor)
  console.error(
    `[invite-employee] auth invite failed request_id=${requestId} error=${authResult.error.message} status=${authResult.error.status}`,
  )
  return {
    status: 'failed',
    step: 'auth',
    error: authResult.error.message || 'Falha na comunicação com o serviço de autenticação. Tente novamente.',
  }
}
