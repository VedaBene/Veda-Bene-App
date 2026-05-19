import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getReceivableStatementRows } from '@/lib/server/reporting/financial'
import { formatReceivableCSV } from '@/lib/utils/export-csv'
import {
  receivableExportSearchParamsSchema,
  searchParamsToRecord,
  validationMessage,
} from '@/lib/server/validation/contracts'

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

  const parsedFilters = receivableExportSearchParamsSchema.safeParse(
    searchParamsToRecord(request.nextUrl.searchParams),
  )

  if (!parsedFilters.success) {
    return NextResponse.json({ error: validationMessage(parsedFilters.error) }, { status: 400 })
  }

  const { startDate, endDate, clientType, clientId } = parsedFilters.data
  const data = await getReceivableStatementRows(supabase, { startDate, endDate, clientType, clientId })
  const csv = formatReceivableCSV(data)
  const filename = `extrato-a-receber_${startDate}_${endDate}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
