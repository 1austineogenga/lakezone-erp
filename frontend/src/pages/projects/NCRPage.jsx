import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon } from '@heroicons/react/24/outline'
import api from '../../api/axios'

const STATUS_COLORS = {
  open:        'bg-red-100 text-red-700',
  in_progress: 'bg-amber-100 text-amber-700',
  closed:      'bg-green-100 text-green-700',
}

const EMPTY = {
  raised_date: '', description: '', root_cause: '',
  corrective_action: '', status: 'open', closed_date: '',
  chainage_segment: '',
}

export default function NCRPage() {
  const { projectId } = useParams()
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [filterStatus, setFilterStatus] = useState('')

  const { data: ncrs = [], isLoading } = useQuery({
    queryKey: ['ncr', projectId],
    queryFn: () => api.get(`/projects/${projectId}/ncr/`).then(r => r.data?.results ?? r.data ?? []),
    enabled: !!projectId,
  })

  const { data: segments = [] } = useQuery({
    queryKey: ['chainage', projectId],
    queryFn: () => api.get(`/projects/${projectId}/chainage/`).then(r => r.data?.results ?? r.data ?? []),
    enabled: !!projectId,
  })

  const saveMut = useMutation({
    mutationFn: data => {
      const payload = { ...data, chainage_segment: data.chainage_segment || null, closed_date: data.closed_date || null }
      return modal?.id
        ? api.patch(`/projects/${projectId}/ncr/${modal.id}/`, payload)
        : api.post(`/projects/${projectId}/ncr/`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries(['ncr', projectId])
      setModal(null)
      toast.success('NCR saved')
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to save'),
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/projects/${projectId}/ncr/${id}/`),
    onSuccess: () => { qc.invalidateQueries(['ncr', projectId]); toast.success('NCR deleted') },
  })

  const openAdd = () => { setForm({ ...EMPTY, raised_date: new Date().toISOString().slice(0, 10) }); setModal('add') }
  const openEdit = n => { setForm({ ...n, chainage_segment: n.chainage_segment || '', closed_date: n.closed_date || '' }); setModal(n) }

  const filtered = filterStatus ? ncrs.filter(n => n.status === filterStatus) : ncrs
  const openCount   = ncrs.filter(n => n.status === 'open').length
  const closedCount = ncrs.filter(n => n.status === 'closed').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-slate">Non-Conformance Register (NCR)</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {ncrs.length} total · <span className="text-red-600 font-medium">{openCount} open</span> · <span className="text-green-600 font-medium">{closedCount} closed</span>
          </p>
        </div>
        <div className="flex gap-2">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600">
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:bg-red-700">
            <PlusIcon className="h-4 w-4" /> Raise NCR
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['NCR #', 'Date', 'Description', 'Segment', 'Root Cause', 'Corrective Action', 'Status', 'Closed', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              : filtered.length === 0
                ? <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No non-conformances found.</td></tr>
                : filtered.map(n => (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono font-semibold text-brand-red">{n.ncr_number}</td>
                    <td className="px-4 py-2.5 text-brand-slate font-medium">{n.raised_date}</td>
                    <td className="px-4 py-2.5 max-w-xs truncate text-gray-700">{n.description}</td>
                    <td className="px-4 py-2.5 text-gray-500">{n.segment_name || '—'}</td>
                    <td className="px-4 py-2.5 max-w-xs truncate text-gray-500">{n.root_cause || '—'}</td>
                    <td className="px-4 py-2.5 max-w-xs truncate text-gray-500">{n.corrective_action || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[n.status]}`}>
                        {n.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{n.closed_date || '—'}</td>
                    <td className="px-4 py-2.5 flex gap-2">
                      <button onClick={() => openEdit(n)} className="text-brand-red hover:underline">Edit</button>
                      <button onClick={() => { if (window.confirm('Delete this NCR?')) deleteMut.mutate(n.id) }}
                        className="text-gray-400 hover:text-red-600">Del</button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-brand-slate">{modal?.id ? 'Edit' : 'New'} Non-Conformance</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Raised Date *</label>
                  <input type="date" required value={form.raised_date}
                    onChange={e => setForm(f => ({ ...f, raised_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Chainage Segment</label>
                  <select value={form.chainage_segment} onChange={e => setForm(f => ({ ...f, chainage_segment: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">— None —</option>
                    {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                <textarea required rows={2} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Describe the non-conformance…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Root Cause</label>
                <textarea rows={2} value={form.root_cause}
                  onChange={e => setForm(f => ({ ...f, root_cause: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Corrective Action</label>
                <textarea rows={2} value={form.corrective_action}
                  onChange={e => setForm(f => ({ ...f, corrective_action: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Closed Date</label>
                  <input type="date" value={form.closed_date}
                    onChange={e => setForm(f => ({ ...f, closed_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModal(null)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saveMut.isPending}
                  className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                  {saveMut.isPending ? 'Saving…' : 'Save NCR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
