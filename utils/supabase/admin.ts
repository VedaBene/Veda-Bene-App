import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { uuidSchema } from '@/lib/server/validation/contracts'

const inviteEmployeeByEmailSchema = z.object({
  email: z.string().email('Email inválido'),
  fullName: z.string().min(1, 'Nome obrigatório'),
  redirectTo: z.string().url('URL de redirecionamento inválida'),
})

type InviteEmployeeByEmailInput = z.infer<typeof inviteEmployeeByEmailSchema>

function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function inviteEmployeeByEmail(input: InviteEmployeeByEmailInput) {
  const data = inviteEmployeeByEmailSchema.parse(input)
  const adminClient = createServiceRoleClient()

  return adminClient.auth.admin.inviteUserByEmail(data.email, {
    data: { full_name: data.fullName },
    redirectTo: data.redirectTo,
  })
}

export async function deleteEmployeeAuthUser(userId: string) {
  const parsedUserId = uuidSchema.parse(userId)
  const adminClient = createServiceRoleClient()

  return adminClient.auth.admin.deleteUser(parsedUserId)
}
