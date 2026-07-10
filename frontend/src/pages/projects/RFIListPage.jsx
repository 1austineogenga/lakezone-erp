import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon } from '@heroicons/react/24/outline'
import api from '../../api/axios'

const STATUS_COLORS = {
  open:     'bg-amber-100 text-amber-700',
  answered: 'bg-blue-100 text-blue-700',
  closed:   'bg-green-100 text-green-700',
}

const EMPTY = {
  raised_date: '', query: '', drawing_reference: '',
  response: '', responded_date: '', status: 'open',
}

export default function RFIListPage() {
  const { projectId } = useParams()
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [filterStatus, setFilterStatus] = useState('')

  const { data: rfis = [], isLoading } = useQuery({
    queryKey: ['rfis', projectId],
    queryFn: () => api.get(`/projects/${projectId}/rfis/`).then(r => r.data?.results ?? r.data ?? []),
    enabled: !!projectId,
  })

  const saveMut = useMutation({
    mutationFn: data => {
      const payload = { ...data, responded_date: data.responded_date || null }
      return modal?.id
        ? api.patch(`/projects/${projectId}/rfis/${modal.id}/`, payload)
        : api.post(`/projects/${projectId}/rfis/`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries(['rfis', projectId])
      setModal(null)
      toast.success('RFI saved')
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to save'),
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/projects/${projectId}/rfis/${id}/`),
    onSuccess: () => { qc.invalidateQueries(['rfis', projectId]); toast.success('RFI deleted') },
  })

  const openAdd = () => { setForm({ ...EMPTY, raised_date: new Date().toISOString().slice(0, 10) }); setModal('add') }
  const openEdit = r => { setForm({ ...r, responded_date: r.responded_date || '' }); setModal(r) }

  const filtered = filterStatus ? rfis.filter(r => r.status === filterStatus) : rfis
  const openCount = rfis.filter(r => r.status === 'open').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-slate">Request for Information (RFI)</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {rfis.length} total · <span className="text-amber-600 font-medium">{openCount} open</span>
          </p>
        </div>
        <div className="flex gap-2">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600">
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="answered">Answered</option>
            <option value="closed">Closed</option>
          </select>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:bg-red-700">
            <PlusIcon className="h-4 w-4" /> New RFI
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Ref #', 'Raised', 'Query', 'Drawing Ref', 'Response', 'Responded', 'Status', 'Raised By', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              : filtered.length === 0
                ? <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No RFIs found.</td></tr>
                : filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono font-semibold text-brand-red">{r.reference_no}</td>
                    <td className="px-4 py-2.5 text-brand-slate font-medium">{r.raised_date}</td>
                    <td className="px-4 py-2.5 max-w-xs truncate text-gray-700">{r.query}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.drawing_reference || '—'}</td>
                    <td className="px-4 py-2.5 max-w-xs truncate text-gray-500">{r.response || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.responded_date || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{r.raised_by_name || '—'}</td>
                    <td className="px-4 py-2.5 flex gap-2">
                      <button onClick={() => openEdit(r)} className="text-brand-red hover:underline">Edit</button>
                      <button onClick={() => { if (window.confirm('Delete this RFI?')) deleteMut.mutate(r.id) }}
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
              <h3 className="font-semibold text-brand-slate">{modal?.id ? 'Edit' : 'New'} RFI</h3>
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Drawing Reference</label>
                  <input value={form.drawing_reference}
                    onChange={e => setForm(f => ({ ...f, drawing_reference: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Drawing / Rev. No." />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Query *</label>
                <textarea required rows={3} value={form.query}
                  onChange={e => setForm(f => ({ ...f, query: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Describe the information requested…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Response</label>
                <textarea rows={3} value={form.response}
                  onChange={e => setForm(f => ({ ...f, response: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Consultant / Engineer response…" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Responded Date</label>
                  <input type="date" value={form.responded_date}
                    onChange={e => setForm(f => ({ ...f, responded_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="open">Open</option>
                    <option value="answered">Answered</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModal(null)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saveMut.isPending}
                  className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                  {saveMut.isPending ? 'Saving…' : 'Save RFI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
