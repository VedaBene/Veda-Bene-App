import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { PropertyForm } from '@/components/properties/PropertyForm'
import type { Agency, Owner, Role } from '@/lib/types/database'

export default async function NewPropertyPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role

  if (!['admin', 'secretaria'].includes(role)) redirect('/properties')

  const [{ data: agencies }, { data: owners }] = await Promise.all([
    supabase.from('agencies').select('*').order('name'),
    supabase.from('owners').select('*').order('name'),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Imóvel</h1>
      <PropertyForm
        agencies={(agencies ?? []) as Agency[]}
        owners={(owners ?? []) as Owner[]}
        role={role}
      />
    </div>
  )
}
