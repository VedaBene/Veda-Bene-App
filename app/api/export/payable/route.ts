import { NextRequest, NextResponse } from 'next/server'
import { getApiViewer } from '@/lib/server/data-access/viewer'
import { getPayableDetailRows } from '@/lib/server/reporting/financial'
import { formatPayableCSV } from '@/lib/utils/export-csv'
import {
  payableExportSearchParamsSchema,
  searchParamsToRecord,
  validationMessage,
} from '@/lib/server/validation/contracts'

export async function GET(request: NextRequest) {
  const { viewer } = await getApiViewer()
  if (!viewer) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (viewer.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const parsedFilters = payableExportSearchParamsSchema.safeParse(
    searchParamsToRecord(request.nextUrl.searchParams),
  )

  if (!parsedFilters.success) {
    return NextResponse.json({ error: validationMessage(parsedFilters.error) }, { status: 400 })
  }

  const { startDate, endDate, employeeId } = parsedFilters.data
  const data = await getPayableDetailRows({ startDate, endDate, employeeId })
  const csv = formatPayableCSV(data)
  const filename = `estratto-da-pagare_${startDate}_${endDate}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
