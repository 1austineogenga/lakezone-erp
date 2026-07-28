import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getInvoices } from '../../api/finance'
import { getProjects } from '../../api/projects'
import { PlusIcon } from '@heroicons/react/24/outline'
import Pagination from '../../components/Pagination'
import FilterBar from '../../components/FilterBar'

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700',
  certified: 'bg-indigo-100 text-indigo-700', partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-700',
  disputed: 'bg-orange-100 text-orange-700', cancelled: 'bg-gray-100 text-gray-400',
}

const EMPTY = { search: '', date_from: '', date_to: '', project: '' }

export default function InvoicesPage() {
  const [status, setStatus] = useState('')
  const [filters, setFilters] = useState(EMPTY)
  const [page, setPage] = useState(1)

  function setFilter(key, val) { setFilters(f => ({ ...f, [key]: val })); setPage(1) }
  function clearFilters() { setFilters(EMPTY); setPage(1) }
  function handleStatus(val) { setStatus(val); setPage(1) }

  const { data: raw, isLoading } = useQuery({
    queryKey: ['invoices', status, filters, page],
    queryFn:  () => getInvoices({
      ...(status            ? { status }                       : {}),
      ...(filters.search    ? { search:    filters.search }    : {}),
      ...(filters.date_from ? { date_from: filters.date_from } : {}),
      ...(filters.date_to   ? { date_to:   filters.date_to }   : {}),
      ...(filters.project   ? { project:   filters.project }   : {}),
      page,
    }),
  })

  const { data: projectsRaw } = useQuery({
    queryKey: ['projects-list'],
    queryFn:  () => getProjects({ page_size: 200 }),
    select:   r => r.data?.results ?? r.data ?? [],
  })
  const projects = projectsRaw ?? []

  const data  = raw?.data?.results ?? raw?.data ?? []
  const count = raw?.data?.count   ?? 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-brand-slate">Client Invoices / Progress Claims</h2>
        <Link to="/finance/invoices/new"
          className="flex items-center gap-1.5 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <PlusIcon className="h-4 w-4" /> New Invoice
        </Link>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        {['', 'draft', 'sent', 'certified', 'partial', 'paid', 'overdue', 'disputed'].map(s => (
          <button key={s} onClick={() => handleStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
              ${status === s ? 'bg-brand-slate text-white border-brand-slate' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <FilterBar
        filters={filters}
        onChange={setFilter}
        onClear={clearFilters}
        extras={[{
          key: 'project', label: 'All Projects', type: 'select',
          options: projects.map(p => ({ value: p.id, label: p.name })),
        }]}
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading
          ? <div className="p-8 text-center text-gray-600 text-sm">Loading…</div>
          : !data?.length
            ? <div className="p-12 text-center text-gray-600 text-sm">No invoices found.</div>
            : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Invoice #', 'Type', 'Client', 'Project', 'Status', 'Total', 'Balance Due', 'Due Date', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.map(inv => (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-brand-slate font-medium">{inv.invoice_number}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs capitalize">{inv.invoice_type.replace('_', ' ')}</td>
                          <td className="px-4 py-3 font-medium truncate max-w-[120px]">{inv.client_name}</td>
                          <td className="px-4 py-3 text-gray-600 truncate max-w-[100px]">{inv.project_name || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">KES {Number(inv.total_amount).toLocaleString()}</td>
                          <td className={`px-4 py-3 font-medium ${Number(inv.balance_due) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            KES {Number(inv.balance_due).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{inv.due_date}</td>
                          <td className="px-4 py-3">
                            <Link to={`/finance/invoices/${inv.id}`} className="text-brand-red hover:underline text-xs font-medium">View</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} count={count} onChange={setPage} />
              </>
            )
        }
      </div>
    </div>
  )
}
