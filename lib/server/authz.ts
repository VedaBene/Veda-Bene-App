import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import type { Role } from '@/lib/types/database'

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type AuthorizedClient = {
  supabase: SupabaseServerClient
  role: Role
}

export async function getAuthorizedClient(
  roles: Role[] = ['admin', 'secretaria'],
): Promise<AuthorizedClient> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !roles.includes(profile.role as Role)) {
    throw new Error('Sem permissão')
  }

  return { supabase, role: profile.role as Role }
}
