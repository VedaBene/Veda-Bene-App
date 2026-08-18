import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { uuidSchema } from '@/lib/server/validation/contracts'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'

const inviteEmployeeByEmailSchema = z.object({
  email: z.string().email('Email inválido'),
  fullName: z.string().min(1, 'Nome obrigatório'),
  redirectTo: z.string().url('URL de redirecionamento inválida'),
})

type InviteEmployeeByEmailInput = z.infer<typeof inviteEmployeeByEmailSchema>

function createServiceRoleClient() {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !secret) {
    throw new Error('Configuração administrativa indisponível')
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret,
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  )
}

async function requireAdministrativeViewer() {
  const { viewer } = await getCurrentViewer()
  if (viewer.role !== 'admin') throw new Error('Sem permissão')
}

export async function inviteEmployeeByEmail(input: InviteEmployeeByEmailInput) {
  const data = inviteEmployeeByEmailSchema.parse(input)
  await requireAdministrativeViewer()
  const adminClient = createServiceRoleClient()

  return adminClient.auth.admin.inviteUserByEmail(data.email, {
    data: { full_name: data.fullName },
    redirectTo: data.redirectTo,
  })
}

export async function deleteEmployeeAuthUser(userId: string) {
  const parsedUserId = uuidSchema.parse(userId)
  await requireAdministrativeViewer()
  const adminClient = createServiceRoleClient()

  return adminClient.auth.admin.deleteUser(parsedUserId)
}
