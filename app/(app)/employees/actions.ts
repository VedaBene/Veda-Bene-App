'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import type { Role } from '@/lib/types/database'

const optStr = z.preprocess(v => (v === '' ? undefined : v), z.string().optional())
const optNum = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().min(0).optional(),
)

const employeeSchema = z.object({
  full_name: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('Email inválido'),
  phone: optStr,
  birth_date: optStr,
  nationality: optStr,
  address: optStr,
  role: z.enum(['admin', 'secretaria', 'limpeza', 'consegna']),
  // remuneração — opcionais, só admin envia
  hourly_rate: optNum,
  has_fixed_salary: z.preprocess(v => v === 'true' || v === true, z.boolean()).optional(),
  monthly_salary: optNum,
  overtime_rate: optNum,
})

async function getAuthorizedClient(requiredRole: Role = 'secretaria') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const allowed: Role[] =
    requiredRole === 'admin' ? ['admin'] : ['admin', 'secretaria']

  if (!profile || !allowed.includes(profile.role as Role)) {
    throw new Error('Sem permissão')
  }

  return { supabase, role: profile.role as Role }
}

export async function createEmployee(formData: FormData) {
  const { role } = await getAuthorizedClient('secretaria')

  const raw = Object.fromEntries(formData)
  const parsed = employeeSchema.safeParse(raw)
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message }

  const { data } = parsed

  const adminClient = createAdminClient()

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') ?? 'http'
  const origin = `${proto}://${host}`

  // Convida o funcionário por email — o Supabase cria o usuário e envia
  // um link para ele definir a própria senha no primeiro acesso.
  // redirectTo aponta para /auth/callback com type=invite para que o callback
  // saiba redirecionar para a página de definição de senha.
  const { data: authUser, error: authError } = await adminClient.auth.admin.inviteUserByEmail(
    data.email,
    {
      data: { full_name: data.full_name },
      redirectTo: `${origin}/auth/callback?type=invite`,
    },
  )

  if (authError) return { success: false as const, error: authError.message }

  // O trigger `handle_new_user` já cria o perfil; aqui atualizamos com os dados completos
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({
      full_name: data.full_name,
      phone: data.phone ?? null,
      birth_date: data.birth_date ?? null,
      nationality: data.nationality ?? null,
      address: data.address ?? null,
      role: data.role,
      ...(role === 'admin' && {
        hourly_rate: data.hourly_rate ?? null,
        monthly_salary: data.has_fixed_salary ? (data.monthly_salary ?? null) : null,
        overtime_rate: data.has_fixed_salary ? (data.overtime_rate ?? null) : null,
      }),
    })
    .eq('id', authUser.user.id)

  if (profileError) return { success: false as const, error: profileError.message }

  revalidatePath('/employees')
  redirect(`/employees/${authUser.user.id}`)
}

export async function updateEmployee(id: string, formData: FormData) {
  const { role } = await getAuthorizedClient('secretaria')

  const raw = Object.fromEntries(formData)
  const parsed = employeeSchema.safeParse(raw)
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message }

  const { data } = parsed
  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: data.full_name,
      phone: data.phone ?? null,
      birth_date: data.birth_date ?? null,
      nationality: data.nationality ?? null,
      address: data.address ?? null,
      role: data.role,
      ...(role === 'admin' && {
        hourly_rate: data.hourly_rate ?? null,
        monthly_salary: data.has_fixed_salary ? (data.monthly_salary ?? null) : null,
        overtime_rate: data.has_fixed_salary ? (data.overtime_rate ?? null) : null,
      }),
    })
    .eq('id', id)

  if (error) return { success: false as const, error: error.message }

  revalidatePath('/employees')
  revalidatePath(`/employees/${id}`)
  return { success: true as const }
}

export async function deleteEmployee(id: string) {
  await getAuthorizedClient('admin')

  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.deleteUser(id)
  if (error) return { success: false as const, error: error.message }

  revalidatePath('/employees')
  redirect('/employees')
}
