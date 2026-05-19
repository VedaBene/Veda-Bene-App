import 'server-only'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import type { Role } from '@/lib/types/database'

export type Viewer = {
  userId: string
  role: Role
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export async function getCurrentViewer(): Promise<{
  supabase: SupabaseServerClient
  viewer: Viewer
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return {
    supabase,
    viewer: {
      userId: user.id,
      role: (profile?.role ?? 'cliente') as Role,
    },
  }
}
