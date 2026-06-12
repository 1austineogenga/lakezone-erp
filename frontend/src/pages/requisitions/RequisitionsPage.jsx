import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getRequisitions } from '../../api/requisitions'
import { PlusIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline'

const STATUS_COLORS = {
  draft:       'bg-gray-100 text-gray-600',
  submitted:   'bg-blue-100 text-blue-700',
  dept_review: 'bg-yellow-100 text-yellow-700',
  finance:     'bg-orange-100 text-orange-700',
  md_review:   'bg-purple-100 text-purple-700',
  approved:    'bg-green-100 text-green-700',
  rejected:    'bg-red-100 text-red-700',
  fulfilled:   'bg-teal-100 text-teal-700',
}

const PRIORITY_COLORS = {
  low:    'text-gray-400',
  medium: 'text-blue-500',
  high:   'text-orange-500',
  urgent: 'text-red-600 font-semibold',
}

export default function RequisitionsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['requisitions', statusFilter],
    queryFn:  () => getRequisitions(statusFilter ? { status: statusFilter } : {}),
    select:   r => r.data,
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-red bg-opacity-10 rounded-lg">
            <ClipboardDocumentListIcon className="h-6 w-6 text-brand-red" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-brand-slate">Staff Requisitions</h1>
            <p className="text-sm text-gray-500">Manage departmental purchase and service requests</p>
          </div>
        </div>
        <Link
          to="/requisitions/new"
          className="flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          New Requisition
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {['', 'submitted', 'dept_review', 'finance', 'md_review', 'approved', 'rejected', 'fulfilled'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border
              ${statusFilter === s
                ? 'bg-brand-slate text-white border-brand-slate'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-slate'}`}
          >
            {s === '' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading requisitions…</div>
        ) : !data?.length ? (
          <div className="p-12 text-center">
            <ClipboardDocumentListIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No requisitions found.</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Reference', 'Title', 'Type', 'Priority', 'Status', 'Amount (KES)', 'Date Required', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map(req => (
                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-brand-slate font-medium">{req.reference_number}</td>
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{req.title}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{req.req_type.replace('_', ' ')}</td>
                  <td className={`px-4 py-3 capitalize text-xs ${PRIORITY_COLORS[req.priority]}`}>{req.priority}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}>
                      {req.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{Number(req.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500">{req.date_required}</td>
                  <td className="px-4 py-3">
                    <Link to={`/requisitions/${req.id}`} className="text-brand-red hover:underline text-xs font-medium">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
