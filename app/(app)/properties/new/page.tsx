import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { PropertyForm } from '@/components/properties/PropertyForm'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Role } from '@/lib/types/database'

export default async function NewPropertyPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role

  if (role !== 'admin') redirect('/properties')

  const [{ data: agencies }, { data: owners }] = await Promise.all([
    supabase.from('agencies').select('id, name').order('name'),
    supabase.from('owners').select('id, name').order('name'),
  ])

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Novo Imóvel" />
      <PropertyForm
        agencies={agencies ?? []}
        owners={owners ?? []}
        role={role}
      />
    </div>
  )
}
