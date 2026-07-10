import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon, SunIcon, CloudIcon } from '@heroicons/react/24/outline'
import api from '../../api/axios'

const WEATHER_OPTS = [
  { value: 'clear',      label: 'Clear',         color: 'text-yellow-600 bg-yellow-50' },
  { value: 'overcast',   label: 'Overcast',      color: 'text-gray-600 bg-gray-100' },
  { value: 'light_rain', label: 'Light Rain',    color: 'text-blue-600 bg-blue-50' },
  { value: 'heavy_rain', label: 'Heavy Rain',    color: 'text-red-600 bg-red-50' },
]

const wLabel = v => WEATHER_OPTS.find(o => o.value === v)?.label || v
const wColor = v => WEATHER_OPTS.find(o => o.value === v)?.color || 'text-gray-600 bg-gray-100'

const EMPTY = {
  date: '', weather_am: 'clear', weather_pm: 'clear',
  is_weather_day_lost: false, labour_count: 0,
  work_summary: '', plant_summary: '', delays: '',
}

export default function SiteDiaryPage() {
  const { projectId } = useParams()
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // null | 'add' | entry object
  const [form, setForm] = useState(EMPTY)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['site-diary', projectId],
    queryFn: () => api.get(`/projects/${projectId}/site-diary/`).then(r => r.data?.results ?? r.data ?? []),
    enabled: !!projectId,
  })

  const saveMut = useMutation({
    mutationFn: data =>
      modal?.id
        ? api.patch(`/projects/${projectId}/site-diary/${modal.id}/`, data)
        : api.post(`/projects/${projectId}/site-diary/`, data),
    onSuccess: () => {
      qc.invalidateQueries(['site-diary', projectId])
      setModal(null)
      toast.success(modal?.id ? 'Diary entry updated' : 'Diary entry saved')
    },
    onError: e => toast.error(e.response?.data?.detail || e.response?.data?.date?.[0] || 'Failed to save'),
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/projects/${projectId}/site-diary/${id}/`),
    onSuccess: () => { qc.invalidateQueries(['site-diary', projectId]); toast.success('Entry deleted') },
    onError: () => toast.error('Failed to delete'),
  })

  const openAdd = () => { setForm({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setModal('add') }
  const openEdit = entry => { setForm({ ...entry }); setModal(entry) }

  const weatherDaysLost = entries.filter(e => e.is_weather_day_lost).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-slate">Site Diary</h2>
          <p className="text-xs text-gray-500 mt-0.5">Daily weather, crew & work log — {entries.length} entries · {weatherDaysLost} weather-day(s) lost</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:bg-red-700">
          <PlusIcon className="h-4 w-4" /> Add Entry
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Date', 'Weather AM', 'Weather PM', 'Labour', 'Weather Day Lost', 'Work Summary', 'Delays', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              : entries.length === 0
                ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No diary entries yet. Click "Add Entry" to begin.</td></tr>
                : entries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-brand-slate">{e.date}</td>
                    <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${wColor(e.weather_am)}`}>{wLabel(e.weather_am)}</span></td>
                    <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${wColor(e.weather_pm)}`}>{wLabel(e.weather_pm)}</span></td>
                    <td className="px-4 py-2.5 text-center font-semibold">{e.labour_count}</td>
                    <td className="px-4 py-2.5 text-center">
                      {e.is_weather_day_lost
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Yes</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5 max-w-xs truncate text-gray-700">{e.work_summary}</td>
                    <td className="px-4 py-2.5 max-w-xs truncate text-gray-500">{e.delays || '—'}</td>
                    <td className="px-4 py-2.5 flex gap-2">
                      <button onClick={() => openEdit(e)} className="text-brand-red hover:underline">Edit</button>
                      <button onClick={() => { if (window.confirm('Delete this entry?')) deleteMut.mutate(e.id) }}
                        className="text-gray-400 hover:text-red-600">Del</button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-brand-slate">{modal?.id ? 'Edit' : 'New'} Site Diary Entry</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                  <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Labour Count</label>
                  <input type="number" min="0" value={form.labour_count} onChange={e => setForm(f => ({ ...f, labour_count: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Weather AM</label>
                  <select value={form.weather_am} onChange={e => setForm(f => ({ ...f, weather_am: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {WEATHER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Weather PM</label>
                  <select value={form.weather_pm} onChange={e => setForm(f => ({ ...f, weather_pm: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {WEATHER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_weather_day_lost}
                  onChange={e => setForm(f => ({ ...f, is_weather_day_lost: e.target.checked }))} />
                <span className="font-medium text-gray-700">Weather day lost</span>
                <span className="text-xs text-gray-400">(counts toward EOT/weather-day claims)</span>
              </label>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Work Summary *</label>
                <textarea required rows={3} value={form.work_summary} onChange={e => setForm(f => ({ ...f, work_summary: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Describe work carried out today…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Plant / Equipment Summary</label>
                <textarea rows={2} value={form.plant_summary} onChange={e => setForm(f => ({ ...f, plant_summary: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Equipment on site, idle time, breakdowns…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Delays & Causes</label>
                <textarea rows={2} value={form.delays} onChange={e => setForm(f => ({ ...f, delays: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Any delays and their causes…" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saveMut.isPending}
                  className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                  {saveMut.isPending ? 'Saving…' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
