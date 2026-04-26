import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  basePath: string
  searchParams?: Record<string, string | undefined>
}

function buildUrl(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number,
): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v)
  }
  qs.set('page', String(page))
  return `${basePath}?${qs.toString()}`
}

export function Pagination({ currentPage, totalPages, basePath, searchParams = {} }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('...')
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (currentPage < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  const base = 'inline-flex items-center justify-center h-8 min-w-[32px] px-2 rounded-md text-sm font-medium transition-colors'
  const active = 'bg-accent text-accent-foreground pointer-events-none'
  const normal = 'text-foreground hover:bg-muted border border-border/60'
  const disabled = 'text-muted-foreground/40 pointer-events-none border border-border/30'

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      {currentPage > 1 ? (
        <Link
          href={buildUrl(basePath, searchParams, currentPage - 1)}
          className={`${base} ${normal}`}
        >
          <ChevronLeft size={16} />
        </Link>
      ) : (
        <span className={`${base} ${disabled}`}>
          <ChevronLeft size={16} />
        </span>
      )}

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className={`${base} text-muted-foreground pointer-events-none`}>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildUrl(basePath, searchParams, p)}
            className={`${base} ${p === currentPage ? active : normal}`}
          >
            {p}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link
          href={buildUrl(basePath, searchParams, currentPage + 1)}
          className={`${base} ${normal}`}
        >
          <ChevronRight size={16} />
        </Link>
      ) : (
        <span className={`${base} ${disabled}`}>
          <ChevronRight size={16} />
        </span>
      )}
    </div>
  )
}
