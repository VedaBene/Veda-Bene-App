import { getCurrentViewer, type SupabaseServerClient } from '@/lib/server/data-access/viewer'
import type { Role } from '@/lib/types/database'

export type { SupabaseServerClient }

export type AuthorizedClient = {
  supabase: SupabaseServerClient
  role: Role
}

export async function getAuthorizedClient(
  roles: Role[] = ['admin', 'secretaria'],
): Promise<AuthorizedClient> {
  const { supabase, viewer } = await getCurrentViewer()

  if (!roles.includes(viewer.role)) {
    throw new Error('Sem permissão')
  }

  return { supabase, role: viewer.role }
}
