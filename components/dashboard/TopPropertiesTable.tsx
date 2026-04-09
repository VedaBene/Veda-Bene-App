import type { TopProperty } from '@/app/(app)/dashboard/actions'

type Props = {
  topMonth: TopProperty[]
  topYear: TopProperty[]
}

export function TopPropertiesTable({ topMonth, topYear }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <RankingTable title="Top 5 — Este mês" rows={topMonth} />
      <RankingTable title="Top 5 — Este ano" rows={topYear} />
    </div>
  )
}

function RankingTable({ title, rows }: { title: string; rows: TopProperty[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-4 py-2 font-medium text-gray-500 w-8">#</th>
            <th className="text-left px-4 py-2 font-medium text-gray-500">Imóvel</th>
            <th className="text-right px-4 py-2 font-medium text-gray-500">OSs</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                Sem dados no período.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row.property_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                <td className="px-4 py-3 text-gray-800">{row.property_name}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-700">{row.os_count}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
