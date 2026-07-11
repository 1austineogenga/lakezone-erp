import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline'
import api from '../../api/client'

const SEVERITY_COLORS = {
  near_miss: 'bg-blue-100 text-blue-700',
  minor:     'bg-amber-100 text-amber-700',
  major:     'bg-orange-100 text-orange-700',
  fatality:  'bg-red-200 text-red-800',
}
const STATUS_COLORS = {
  open:          'bg-red-100 text-red-700',
  investigating: 'bg-amber-100 text-amber-700',
  closed:        'bg-green-100 text-green-700',
}

const SEVERITIES = [
  { value: 'near_miss', label: 'Near Miss' },
  { value: 'minor',     label: 'Minor' },
  { value: 'major',     label: 'Major' },
  { value: 'fatality',  label: 'Fatality' },
]

const EMPTY = {
  date: '', severity: 'near_miss', description: '',
  corrective_action: '', status: 'open',
  signed_off_date: '',
}

export default function SafetyPage() {
  const { projectId } = useParams()
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [filterSev, setFilterSev] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents', projectId],
    queryFn: () => api.get(`/projects/${projectId}/incidents/`).then(r => r.data?.results ?? r.data ?? []),
    enabled: !!projectId,
  })

  const saveMut = useMutation({
    mutationFn: data => {
      const payload = { ...data, signed_off_date: data.signed_off_date || null }
      return modal?.id
        ? api.patch(`/projects/${projectId}/incidents/${modal.id}/`, payload)
        : api.post(`/projects/${projectId}/incidents/`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries(['incidents', projectId])
      setModal(null)
      toast.success('Incident saved')
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to save'),
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/projects/${projectId}/incidents/${id}/`),
    onSuccess: () => { qc.invalidateQueries(['incidents', projectId]); toast.success('Incident deleted') },
  })

  const openAdd = () => { setForm({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setModal('add') }
  const openEdit = i => { setForm({ ...i, signed_off_date: i.signed_off_date || '' }); setModal(i) }

  const filtered = incidents
    .filter(i => !filterSev || i.severity === filterSev)
    .filter(i => !filterStatus || i.status === filterStatus)

  const counts = { near_miss: 0, minor: 0, major: 0, fatality: 0 }
  incidents.forEach(i => { if (counts[i.severity] !== undefined) counts[i.severity]++ })

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {SEVERITIES.map(s => (
          <div key={s.value} className={`p-3 rounded-xl border ${SEVERITY_COLORS[s.value]} border-opacity-40`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{counts[s.value]}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-slate">Safety & Incident Register</h2>
          <p className="text-xs text-gray-500 mt-0.5">{incidents.length} incident(s) recorded</p>
        </div>
        <div className="flex gap-2">
          <select value={filterSev} onChange={e => setFilterSev(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600">
            <option value="">All Severities</option>
            {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600">
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="closed">Closed</option>
          </select>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:bg-red-700">
            <PlusIcon className="h-4 w-4" /> Report Incident
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Date', 'Severity', 'Description', 'Corrective Action', 'Status', 'Signed Off', 'Reported By', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              : filtered.length === 0
                ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No incidents found.</td></tr>
                : filtered.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-brand-slate">{i.date}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[i.severity]}`}>
                        {SEVERITIES.find(s => s.value === i.severity)?.label || i.severity}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 max-w-xs truncate text-gray-700">{i.description}</td>
                    <td className="px-4 py-2.5 max-w-xs truncate text-gray-500">{i.corrective_action || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[i.status]}`}>
                        {i.status.charAt(0).toUpperCase() + i.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{i.signed_off_date || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{i.reported_by_name || '—'}</td>
                    <td className="px-4 py-2.5 flex gap-2">
                      <button onClick={() => openEdit(i)} className="text-brand-red hover:underline">Edit</button>
                      <button onClick={() => { if (window.confirm('Delete this incident?')) deleteMut.mutate(i.id) }}
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
              <h3 className="font-semibold text-brand-slate">{modal?.id ? 'Edit' : 'Report'} Incident</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                  <input type="date" required value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Severity *</label>
                  <select required value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                <textarea required rows={3} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Describe what happened…" />
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
                    <option value="investigating">Investigating</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sign-off Date</label>
                  <input type="date" value={form.signed_off_date}
                    onChange={e => setForm(f => ({ ...f, signed_off_date: e.target.value }))}
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
