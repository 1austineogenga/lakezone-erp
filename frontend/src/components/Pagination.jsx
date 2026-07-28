import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

export default function Pagination({ page, count, pageSize = 25, onChange }) {
  const totalPages = Math.ceil((count || 0) / pageSize)
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, count)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
      <p className="text-xs text-gray-500">
        Showing <span className="font-medium">{from}–{to}</span> of <span className="font-medium">{count}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
          .reduce((acc, p, idx, arr) => {
            if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…')
            acc.push(p)
            return acc
          }, [])
          .map((p, i) =>
            p === '…'
              ? <span key={`ellipsis-${i}`} className="px-2 text-xs text-gray-400">…</span>
              : <button key={p} onClick={() => onChange(p)}
                  className={`min-w-[32px] h-8 px-2 rounded text-xs font-medium border transition-colors
                    ${p === page
                      ? 'bg-brand-slate text-white border-brand-slate'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}>
                  {p}
                </button>
          )
        }
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
