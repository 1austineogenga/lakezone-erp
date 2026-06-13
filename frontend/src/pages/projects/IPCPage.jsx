import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon } from '@heroicons/react/24/outline'
import { getIPCs, createIPC, updateIPC } from '../../api/projects'

const STATUS_COLORS = {
  draft:      'bg-gray-100 text-gray-600',
  submitted:  'bg-blue-100 text-blue-700',
  certified:  'bg-green-100 text-green-700',
  paid:       'bg-emerald-100 text-emerald-700',
  disputed:   'bg-red-100 text-red-700',
}

const STATUS_FLOW = {
  draft:     'submitted',
  submitted: 'certified',
  certified: 'paid',
}

const EMPTY_FORM = {
  ipc_number: '', period_from: '', period_to: '',
  chainage_from: '', chainage_to: '',
  amount_claimed: '', notes: '',
}

const fmt = v => `KES ${Number(v || 0).toLocaleString()}`

export default function IPCPage() {
  const { projectId } = useParams()
  const qc = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: ipcs = [], isLoading } = useQuery({
    queryKey: ['project-ipcs', projectId],
    queryFn: () => getIPCs(projectId),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: !!projectId,
  })

  const createMut = useMutation({
    mutationFn: data => createIPC(projectId, data),
    onSuccess: () => {
      toast.success('IPC created.')
      qc.invalidateQueries({ queryKey: ['project-ipcs', projectId] })
      setShowModal(false)
      setForm(EMPTY_FORM)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to create IPC.'),
  })

  const updateMut = useMutation({
    mutationFn: ({ ipcId, data }) => updateIPC(projectId, ipcId, data),
    onSuccess: () => {
      toast.success('IPC updated.')
      qc.invalidateQueries({ queryKey: ['project-ipcs', projectId] })
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to update IPC.'),
  })

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const totalClaimed  = ipcs.reduce((s, i) => s + Number(i.amount_claimed || 0), 0)
  const totalCertified = ipcs.reduce((s, i) => s + Number(i.amount_certified || 0), 0)
  const totalPaid     = ipcs.reduce((s, i) => s + Number(i.amount_paid || 0), 0)

  const advanceStatus = (ipc) => {
    const next = STATUS_FLOW[ipc.status]
    if (!next) return
    updateMut.mutate({ ipcId: ipc.id, data: { status: next } })
  }

  if (isLoading) return <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Interim Payment Certificates</h2>
          <p className="text-xs text-gray-400 mt-0.5">{ipcs.length} IPCs</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> New IPC
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Total Claimed',   val: fmt(totalClaimed),   bg: 'bg-blue-50',    border: 'border-l-blue-500',    text: 'text-blue-700' },
          { label: 'Total Certified', val: fmt(totalCertified), bg: 'bg-green-50',   border: 'border-l-green-500',   text: 'text-green-700' },
          { label: 'Total Paid',      val: fmt(totalPaid),      bg: 'bg-emerald-50', border: 'border-l-emerald-500', text: 'text-emerald-700' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-gray-200 border-l-4 ${s.border} rounded-xl p-4`}>
            <p className={`text-xl font-bold ${s.text}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* IPC Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {ipcs.length === 0 ? (
          <p className="text-sm text-gray-400 p-8 text-center">No IPCs yet. Create the first one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['IPC #', 'Period', 'Chainage', 'Claimed', 'Certified', 'Paid', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ipcs.map(ipc => {
                  const nextStatus = STATUS_FLOW[ipc.status]
                  return (
                    <tr key={ipc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-brand-slate">{ipc.ipc_number}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{ipc.period_from} → {ipc.period_to}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{ipc.chainage_from} – {ipc.chainage_to}</td>
                      <td className="px-4 py-3 font-medium">{fmt(ipc.amount_claimed)}</td>
                      <td className="px-4 py-3">{fmt(ipc.amount_certified)}</td>
                      <td className="px-4 py-3">{fmt(ipc.amount_paid)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ipc.status] || 'bg-gray-100 text-gray-600'}`}>
                          {ipc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {nextStatus && (
                          <button
                            onClick={() => advanceStatus(ipc)}
                            disabled={updateMut.isPending}
                            className="px-2.5 py-1 bg-brand-red text-white text-xs rounded-lg hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                          >
                            → {nextStatus}
                          </button>
                        )}
                        {ipc.status === 'submitted' && (
                          <button
                            onClick={() => updateMut.mutate({ ipcId: ipc.id, data: { status: 'disputed' } })}
                            disabled={updateMut.isPending}
                            className="ml-1.5 px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 text-xs rounded-lg hover:bg-red-100 disabled:opacity-50"
                          >
                            Dispute
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New IPC Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-brand-slate">New IPC</h3>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }}
                className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); createMut.mutate(form) }} className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'IPC Number *', key: 'ipc_number', placeholder: 'e.g. IPC-001' },
                  { label: 'Amount Claimed (KES)', key: 'amount_claimed', type: 'number' },
                  { label: 'Period From', key: 'period_from', type: 'date' },
                  { label: 'Period To', key: 'period_to', type: 'date' },
                  { label: 'Chainage From', key: 'chainage_from', placeholder: '0+000' },
                  { label: 'Chainage To', key: 'chainage_to', placeholder: '1+500' },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input type={type || 'text'} value={form[key]} onChange={e => field(key, e.target.value)}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea rows={3} value={form.notes} onChange={e => field('notes', e.target.value)}
                  placeholder="Any notes about this IPC…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={createMut.isPending || !form.ipc_number}
                  className="px-5 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                  {createMut.isPending ? 'Creating…' : 'Create IPC'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }}
                  className="px-5 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
