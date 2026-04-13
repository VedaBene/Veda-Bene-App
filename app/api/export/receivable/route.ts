import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { exportReceivableCSV } from '@/lib/utils/export-csv'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'secretaria'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const start = searchParams.get('start') ?? ''
  const end = searchParams.get('end') ?? ''
  const clientType = searchParams.get('client_type') as 'rental' | 'particular' | null
  const clientId = searchParams.get('client_id') ?? undefined

  if (!start || !end) {
    return NextResponse.json({ error: 'Parâmetros start e end obrigatórios' }, { status: 400 })
  }

  const csv = await exportReceivableCSV(start, end, clientType ?? undefined, clientId)
  const filename = `extrato-a-receber_${start}_${end}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
