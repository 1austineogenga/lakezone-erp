import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon } from '@heroicons/react/24/outline'
import api from '../../api/axios'

const EMPTY = { name: '', start_station_m: '', end_station_m: '' }

export default function ChainagePage() {
  const { projectId } = useParams()
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)

  const { data: segments = [], isLoading } = useQuery({
    queryKey: ['chainage', projectId],
    queryFn: () => api.get(`/projects/${projectId}/chainage/`).then(r => r.data?.results ?? r.data ?? []),
    enabled: !!projectId,
  })

  const saveMut = useMutation({
    mutationFn: data =>
      modal?.id
        ? api.patch(`/projects/${projectId}/chainage/${modal.id}/`, data)
        : api.post(`/projects/${projectId}/chainage/`, data),
    onSuccess: () => { qc.invalidateQueries(['chainage', projectId]); setModal(null); toast.success('Segment saved') },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to save'),
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/projects/${projectId}/chainage/${id}/`),
    onSuccess: () => { qc.invalidateQueries(['chainage', projectId]); toast.success('Segment deleted') },
  })

  const toKm = m => {
    const km = Math.floor(m / 1000)
    const r = Math.round(m % 1000)
    return `${km}+${String(r).padStart(3, '0')}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-slate">Chainage Segments</h2>
          <p className="text-xs text-gray-500 mt-0.5">Define road sections to localize progress, QA tests and NCRs</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setModal('add') }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:bg-red-700">
          <PlusIcon className="h-4 w-4" /> Add Segment
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Section Name', 'Start (m)', 'End (m)', 'Start Chainage', 'End Chainage', 'Length (m)', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              : segments.length === 0
                ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No segments defined yet.</td></tr>
                : segments.map(s => {
                    const len = parseFloat(s.end_station_m) - parseFloat(s.start_station_m)
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-brand-slate">{s.name}</td>
                        <td className="px-4 py-2.5 text-right">{parseFloat(s.start_station_m).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right">{parseFloat(s.end_station_m).toLocaleString()}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-600">{toKm(parseFloat(s.start_station_m))}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-600">{toKm(parseFloat(s.end_station_m))}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-700">{len.toLocaleString()}</td>
                        <td className="px-4 py-2.5 flex gap-2">
                          <button onClick={() => { setForm({ ...s }); setModal(s) }} className="text-brand-red hover:underline">Edit</button>
                          <button onClick={() => { if (window.confirm('Delete segment?')) deleteMut.mutate(s.id) }}
                            className="text-gray-400 hover:text-red-600">Del</button>
                        </td>
                      </tr>
                    )
                  })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-brand-slate">{modal?.id ? 'Edit' : 'New'} Segment</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Section Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Section 1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Station (m) *</label>
                  <input type="number" step="0.01" min="0" required value={form.start_station_m}
                    onChange={e => setForm(f => ({ ...f, start_station_m: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Station (m) *</label>
                  <input type="number" step="0.01" min="0" required value={form.end_station_m}
                    onChange={e => setForm(f => ({ ...f, end_station_m: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="2500.00" />
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
