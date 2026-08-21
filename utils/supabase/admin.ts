import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { uuidSchema } from '@/lib/server/validation/contracts'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import type { Database } from '@/lib/types/database'

const inviteEmployeeByEmailSchema = z.object({
  email: z.string().email('Email inválido'),
  fullName: z.string().min(1, 'Nome obrigatório'),
  redirectTo: z.string().url('URL de redirecionamento inválida'),
})

export type InviteEmployeeByEmailInput = z.infer<typeof inviteEmployeeByEmailSchema>

export type EmployeeProfile = {
  id: string
  email: string
  full_name: string
  phone?: string | null
  birth_date?: string | null
  nationality?: string | null
  address?: string | null
  role: string
  hourly_rate?: number | null
  monthly_salary?: number | null
  overtime_rate?: number | null
  created_at?: string
}

export type EmployeeProfileUpdateData = {
  full_name: string
  phone?: string | null
  birth_date?: string | null
  nationality?: string | null
  address?: string | null
  role: string
  hourly_rate?: number | null
  monthly_salary?: number | null
  overtime_rate?: number | null
}

export type InviteEmployeeAuthResult =
  | { success: true; user: { id: string; email?: string } }
  | {
      success: false
      error: {
        code?: string
        message: string
        status?: number
        isAlreadyRegistered?: boolean
      }
    }

export interface EmployeeAdminAdapter {
  inviteAuthUser(params: {
    email: string
    fullName: string
    redirectTo: string
  }): Promise<InviteEmployeeAuthResult>

  getAuthUserByEmail(email: string): Promise<{
    user?: { id: string; email?: string } | null
    error?: { message: string }
  }>

  getProfileByEmail(email: string): Promise<{
    profile?: EmployeeProfile | null
    error?: { message: string }
  }>

  updateProfile(
    id: string,
    data: EmployeeProfileUpdateData,
  ): Promise<{ error?: { message: string } }>

  createProfileIfMissing(
    id: string,
    email: string,
    fullName: string,
  ): Promise<{ error?: { message: string } }>

  deleteEmployeeAuthUser(userId: string): Promise<{ error?: { message: string } }>
}

function createServiceRoleClient() {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !secret) {
    throw new Error('Configuração administrativa indisponível')
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret,
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  )
}

async function requireAdministrativeViewer() {
  const { viewer } = await getCurrentViewer()
  if (viewer.role !== 'admin') throw new Error('Sem permissão')
}

const PROFILES_COLUMNS =
  'id, full_name, email, phone, role, birth_date, nationality, address, hourly_rate, monthly_salary, overtime_rate, created_at'

export const defaultEmployeeAdminAdapter: EmployeeAdminAdapter = {
  async inviteAuthUser({ email, fullName, redirectTo }) {
    await requireAdministrativeViewer()
    const client = createServiceRoleClient()

    const { data, error } = await client.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo,
    })

    if (error) {
      const msg = error.message?.toLowerCase() ?? ''
      const isAlreadyRegistered =
        error.status === 422 ||
        msg.includes('already registered') ||
        msg.includes('already been registered') ||
        msg.includes('email_exists') ||
        (error as { code?: string }).code === 'email_exists'

      return {
        success: false,
        error: {
          code: (error as { code?: string }).code,
          message: error.message,
          status: error.status,
          isAlreadyRegistered,
        },
      }
    }

    if (!data?.user) {
      return {
        success: false,
        error: {
          message: 'Falha ao obter usuário criado após convite.',
        },
      }
    }

    return {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    }
  },

  async getAuthUserByEmail(email: string) {
    await requireAdministrativeViewer()
    const client = createServiceRoleClient()

    const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 50 })
    if (error) {
      return { error: { message: error.message } }
    }

    const normalized = email.trim().toLowerCase()
    const user = data.users.find(u => u.email?.trim().toLowerCase() === normalized)

    return {
      user: user ? { id: user.id, email: user.email } : null,
    }
  },

  async getProfileByEmail(email: string) {
    await requireAdministrativeViewer()
    const client = createServiceRoleClient()

    const { data, error } = await client
      .from('profiles')
      .select(PROFILES_COLUMNS)
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (error) {
      return { error: { message: error.message } }
    }

    return { profile: (data as EmployeeProfile | null) ?? null }
  },

  async updateProfile(id: string, updateData: EmployeeProfileUpdateData) {
    await requireAdministrativeViewer()
    const client = createServiceRoleClient()

    const { error } = await client
      .from('profiles')
      .update(updateData)
      .eq('id', id)

    if (error) {
      return { error: { message: error.message } }
    }

    return {}
  },

  async createProfileIfMissing(id: string, email: string, fullName: string) {
    await requireAdministrativeViewer()
    const client = createServiceRoleClient()

    const { error } = await client.from('profiles').insert({
      id,
      email: email.trim().toLowerCase(),
      full_name: fullName,
      role: 'cliente',
    })

    if (error) {
      return { error: { message: error.message } }
    }

    return {}
  },

  async deleteEmployeeAuthUser(userId: string) {
    const parsedUserId = uuidSchema.parse(userId)
    await requireAdministrativeViewer()
    const client = createServiceRoleClient()

    const { error } = await client.auth.admin.deleteUser(parsedUserId)
    if (error) {
      return { error: { message: error.message } }
    }

    return {}
  },
}

/**
 * Função compatível legada para convite direto, redirecionando para o adapter.
 */
export async function inviteEmployeeByEmail(input: InviteEmployeeByEmailInput) {
  const data = inviteEmployeeByEmailSchema.parse(input)
  const result = await defaultEmployeeAdminAdapter.inviteAuthUser({
    email: data.email,
    fullName: data.fullName,
    redirectTo: data.redirectTo,
  })

  if (!result.success) {
    return { data: null, error: new Error(result.error.message) }
  }

  return { data: { user: result.user }, error: null }
}

/**
 * Função para exclusão autorizada de funcionário do Auth.
 */
export async function deleteEmployeeAuthUser(userId: string) {
  const result = await defaultEmployeeAdminAdapter.deleteEmployeeAuthUser(userId)
  if (result.error) {
    return { error: new Error(result.error.message) }
  }
  return { error: null }
}
