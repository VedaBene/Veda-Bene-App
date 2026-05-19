import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getPayableStatementRows } from '@/lib/server/reporting/financial'
import { formatPayableCSV } from '@/lib/utils/export-csv'
import {
  payableExportSearchParamsSchema,
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

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const parsedFilters = payableExportSearchParamsSchema.safeParse(
    searchParamsToRecord(request.nextUrl.searchParams),
  )

  if (!parsedFilters.success) {
    return NextResponse.json({ error: validationMessage(parsedFilters.error) }, { status: 400 })
  }

  const { startDate, endDate, employeeId } = parsedFilters.data
  const data = await getPayableStatementRows(supabase, { startDate, endDate, employeeId })
  const csv = formatPayableCSV(data)
  const filename = `extrato-a-pagar_${startDate}_${endDate}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
