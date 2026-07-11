import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import api from '../../api/client'

const MS_STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700',
  due:     'bg-orange-100 text-orange-700',
  paid:    'bg-green-100 text-green-700',
}

const SUB_EMPTY = {
  name: '', scope_of_work: '', contract_value: '',
  contact_person: '', contact_phone: '', start_date: '', end_date: '',
}
const MS_EMPTY = { description: '', amount: '', due_date: '', status: 'pending' }

function MilestoneRow({ sub }) {
  const qc = useQueryClient()
  const { projectId } = useParams()
  const [msModal, setMsModal] = useState(null)
  const [msForm, setMsForm] = useState(MS_EMPTY)

  const saveMsMut = useMutation({
    mutationFn: data => {
      const payload = { ...data, subcontractor: sub.id, due_date: data.due_date || null }
      return msModal?.id
        ? api.patch(`/projects/${projectId}/subcontractors/${sub.id}/milestones/${msModal.id}/`, payload)
        : api.post(`/projects/${projectId}/subcontractors/${sub.id}/milestones/`, payload)
    },
    onSuccess: () => { qc.invalidateQueries(['subcontractors', projectId]); setMsModal(null); toast.success('Milestone saved') },
    onError: e => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const deleteMsMut = useMutation({
    mutationFn: id => api.delete(`/projects/${projectId}/subcontractors/${sub.id}/milestones/${id}/`),
    onSuccess: () => { qc.invalidateQueries(['subcontractors', projectId]); toast.success('Milestone deleted') },
  })

  const paidTotal = (sub.milestones || []).filter(m => m.status === 'paid').reduce((s, m) => s + parseFloat(m.amount), 0)

  return (
    <div className="mt-2 ml-4 border-l-2 border-gray-100 pl-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500">Milestones — KES {paidTotal.toLocaleString()} paid of KES {parseFloat(sub.contract_value).toLocaleString()}</span>
        <button onClick={() => { setMsForm(MS_EMPTY); setMsModal('add') }}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-red hover:bg-red-50 rounded">
          <PlusIcon className="h-3.5 w-3.5" /> Add Milestone
        </button>
      </div>
      {(sub.milestones || []).length === 0
        ? <p className="text-xs text-gray-400 py-2">No milestones yet.</p>
        : <div className="space-y-1">
            {sub.milestones.map(m => (
              <div key={m.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                <span className="flex-1 text-xs text-gray-700">{m.description}</span>
                <span className="text-xs font-semibold text-brand-slate">KES {parseFloat(m.amount).toLocaleString()}</span>
                <span className="text-xs text-gray-400">{m.due_date || '—'}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MS_STATUS_COLORS[m.status]}`}>
                  {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                </span>
                <button onClick={() => { setMsForm({ ...m, due_date: m.due_date || '' }); setMsModal(m) }}
                  className="text-xs text-brand-red hover:underline">Edit</button>
                <button onClick={() => { if (window.confirm('Delete?')) deleteMsMut.mutate(m.id) }}
                  className="text-xs text-gray-400 hover:text-red-600">Del</button>
              </div>
            ))}
          </div>
      }

      {msModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-brand-slate text-sm">{msModal?.id ? 'Edit' : 'Add'} Milestone</h3>
              <button onClick={() => setMsModal(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMsMut.mutate(msForm) }} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                <input required value={msForm.description} onChange={e => setMsForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount (KES) *</label>
                  <input type="number" min="0" required value={msForm.amount}
                    onChange={e => setMsForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                  <input type="date" value={msForm.due_date} onChange={e => setMsForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select value={msForm.status} onChange={e => setMsForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="pending">Pending</option>
                  <option value="due">Due</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setMsModal(null)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saveMsMut.isPending}
                  className="px-3 py-1.5 bg-brand-red text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-60">
                  {saveMsMut.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SubcontractorsPage() {
  const { projectId } = useParams()
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(SUB_EMPTY)
  const [expanded, setExpanded] = useState({})

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ['subcontractors', projectId],
    queryFn: () => api.get(`/projects/${projectId}/subcontractors/`).then(r => r.data?.results ?? r.data ?? []),
    enabled: !!projectId,
  })

  const saveMut = useMutation({
    mutationFn: data => {
      const payload = { ...data, start_date: data.start_date || null, end_date: data.end_date || null }
      return modal?.id
        ? api.patch(`/projects/${projectId}/subcontractors/${modal.id}/`, payload)
        : api.post(`/projects/${projectId}/subcontractors/`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries(['subcontractors', projectId])
      setModal(null)
      toast.success('Subcontractor saved')
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to save'),
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/projects/${projectId}/subcontractors/${id}/`),
    onSuccess: () => { qc.invalidateQueries(['subcontractors', projectId]); toast.success('Subcontractor removed') },
  })

  const openAdd = () => { setForm(SUB_EMPTY); setModal('add') }
  const openEdit = s => { setForm({ ...s, start_date: s.start_date || '', end_date: s.end_date || '' }); setModal(s) }
  const totalValue = subs.reduce((t, s) => t + parseFloat(s.contract_value || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-slate">Subcontractors</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {subs.length} subcontractor(s) · Total value KES {totalValue.toLocaleString()}
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:bg-red-700">
          <PlusIcon className="h-4 w-4" /> Add Subcontractor
        </button>
      </div>

      {isLoading
        ? <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
        : subs.length === 0
          ? <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
              No subcontractors yet.
            </div>
          : <div className="space-y-3">
              {subs.map(s => (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start gap-3">
                    <button onClick={() => setExpanded(e => ({ ...e, [s.id]: !e[s.id] }))}
                      className="mt-0.5 text-gray-400 hover:text-brand-slate">
                      {expanded[s.id]
                        ? <ChevronDownIcon className="h-4 w-4" />
                        : <ChevronRightIcon className="h-4 w-4" />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-brand-slate">{s.name}</h3>
                        <div className="flex gap-2">
                          <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            KES {parseFloat(s.contract_value).toLocaleString()}
                          </span>
                          <button onClick={() => openEdit(s)} className="text-xs text-brand-red hover:underline">Edit</button>
                          <button onClick={() => { if (window.confirm(`Delete ${s.name}?`)) deleteMut.mutate(s.id) }}
                            className="text-xs text-gray-400 hover:text-red-600">Del</button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{s.scope_of_work}</p>
                      <div className="flex gap-4 mt-1.5 text-xs text-gray-400">
                        {s.contact_person && <span>Contact: <span className="text-gray-600">{s.contact_person}</span></span>}
                        {s.contact_phone  && <span>Tel: <span className="text-gray-600">{s.contact_phone}</span></span>}
                        {s.start_date     && <span>{s.start_date} → {s.end_date || 'ongoing'}</span>}
                        <span className="text-gray-400">{(s.milestones || []).length} milestone(s)</span>
                      </div>
                    </div>
                  </div>
                  {expanded[s.id] && <MilestoneRow sub={s} />}
                </div>
              ))}
            </div>
      }

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-brand-slate">{modal?.id ? 'Edit' : 'New'} Subcontractor</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Company Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Scope of Work *</label>
                <textarea required rows={2} value={form.scope_of_work}
                  onChange={e => setForm(f => ({ ...f, scope_of_work: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contract Value (KES) *</label>
                  <input type="number" min="0" required value={form.contract_value}
                    onChange={e => setForm(f => ({ ...f, contract_value: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contact Person</label>
                  <input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contact Phone</label>
                  <input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModal(null)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saveMut.isPending}
                  className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                  {saveMut.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
