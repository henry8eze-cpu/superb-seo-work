import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  buildHref,
}: {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  buildHref: (page: number) => string
}) {
  if (totalItems === 0) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-border">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-dark-gray">{start}-{end}</span> of{' '}
        <span className="font-medium text-dark-gray">{totalItems}</span>
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Link
            href={buildHref(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-border transition-colors ${
              page <= 1
                ? 'pointer-events-none opacity-40'
                : 'hover:bg-cream text-dark-gray'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </Link>

          <span className="text-sm text-muted-foreground px-2">
            Page {page} of {totalPages}
          </span>

          <Link
            href={buildHref(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-border transition-colors ${
              page >= totalPages
                ? 'pointer-events-none opacity-40'
                : 'hover:bg-cream text-dark-gray'
            }`}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
