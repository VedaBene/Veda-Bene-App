import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getReceivableReport } from '@/lib/server/reporting/receivable'
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

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const parsedFilters = receivableExportSearchParamsSchema.safeParse(
    searchParamsToRecord(request.nextUrl.searchParams),
  )

  if (!parsedFilters.success) {
    return NextResponse.json({ error: validationMessage(parsedFilters.error) }, { status: 400 })
  }

  const { startDate, endDate, clientType, clientId } = parsedFilters.data
  try {
    const report = await getReceivableReport({ startDate, endDate, clientType, clientId })
    if (report.pendingCount > 0) {
      return NextResponse.json(
        {
          error: `Exportação bloqueada: existem ${report.pendingCount} O.S. com dados financeiros pendentes neste filtro.`,
          pendingCount: report.pendingCount,
        },
        {
          status: 422,
          headers: { 'Cache-Control': 'private, no-store' },
        },
      )
    }

    const csv = formatReceivableCSV(report)
    const filename = `extrato-a-receber_${startDate}_${endDate}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível gerar o relatório.' },
      { status: 500 },
    )
  }
}
