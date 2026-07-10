import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon } from '@heroicons/react/24/outline'
import api from '../../api/axios'

const RESULT_COLORS = {
  pass:    'bg-green-100 text-green-700',
  fail:    'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
}

const COMMON_TESTS = ['Compaction', 'CBR', 'Asphalt Mix Design', 'Aggregate Gradation', 'Atterberg Limits', 'Moisture Content', 'Other']

const EMPTY = {
  test_type: '', test_date: '', station_m: '', result_value: '',
  result: 'pending', lab_reference: '', tested_by: '', remarks: '',
  chainage_segment: '',
}

export default function QAPage() {
  const { projectId } = useParams()
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [filter, setFilter] = useState('')

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ['qa-tests', projectId],
    queryFn: () => api.get(`/projects/${projectId}/qa-tests/`).then(r => r.data?.results ?? r.data ?? []),
    enabled: !!projectId,
  })

  const { data: segments = [] } = useQuery({
    queryKey: ['chainage', projectId],
    queryFn: () => api.get(`/projects/${projectId}/chainage/`).then(r => r.data?.results ?? r.data ?? []),
    enabled: !!projectId,
  })

  const saveMut = useMutation({
    mutationFn: data => {
      const payload = { ...data, chainage_segment: data.chainage_segment || null, station_m: data.station_m || null }
      return modal?.id
        ? api.patch(`/projects/${projectId}/qa-tests/${modal.id}/`, payload)
        : api.post(`/projects/${projectId}/qa-tests/`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries(['qa-tests', projectId])
      setModal(null)
      toast.success('QA record saved')
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to save'),
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/projects/${projectId}/qa-tests/${id}/`),
    onSuccess: () => { qc.invalidateQueries(['qa-tests', projectId]); toast.success('Record deleted') },
  })

  const openAdd = () => { setForm({ ...EMPTY, test_date: new Date().toISOString().slice(0, 10) }); setModal('add') }
  const openEdit = t => { setForm({ ...t, chainage_segment: t.chainage_segment || '', station_m: t.station_m || '' }); setModal(t) }

  const filtered = filter ? tests.filter(t => t.result === filter) : tests
  const passCount = tests.filter(t => t.result === 'pass').length
  const failCount = tests.filter(t => t.result === 'fail').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-slate">QA / Material Testing</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {tests.length} tests · <span className="text-green-600 font-medium">{passCount} pass</span> · <span className="text-red-600 font-medium">{failCount} fail</span>
          </p>
        </div>
        <div className="flex gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600">
            <option value="">All Results</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
            <option value="pending">Pending</option>
          </select>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:bg-red-700">
            <PlusIcon className="h-4 w-4" /> Add Test
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Date', 'Test Type', 'Station (m)', 'Segment', 'Result Value', 'Result', 'Lab Ref', 'Tested By', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              : filtered.length === 0
                ? <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No test records found.</td></tr>
                : filtered.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-brand-slate">{t.test_date}</td>
                    <td className="px-4 py-2.5">{t.test_type}</td>
                    <td className="px-4 py-2.5 text-right">{t.station_m ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{t.segment_name || '—'}</td>
                    <td className="px-4 py-2.5">{t.result_value || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_COLORS[t.result]}`}>
                        {t.result.charAt(0).toUpperCase() + t.result.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{t.lab_reference || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{t.tested_by || '—'}</td>
                    <td className="px-4 py-2.5 flex gap-2">
                      <button onClick={() => openEdit(t)} className="text-brand-red hover:underline">Edit</button>
                      <button onClick={() => { if (window.confirm('Delete this record?')) deleteMut.mutate(t.id) }}
                        className="text-gray-400 hover:text-red-600">Del</button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-brand-slate">{modal?.id ? 'Edit' : 'New'} QA Test Record</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Test Type *</label>
                  <input list="test-types" required value={form.test_type}
                    onChange={e => setForm(f => ({ ...f, test_type: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Compaction" />
                  <datalist id="test-types">{COMMON_TESTS.map(t => <option key={t} value={t} />)}</datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Test Date *</label>
                  <input type="date" required value={form.test_date}
                    onChange={e => setForm(f => ({ ...f, test_date: e.target.value }))}
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
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Station (m)</label>
                  <input type="number" step="0.01" value={form.station_m}
                    onChange={e => setForm(f => ({ ...f, station_m: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 1250.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Result Value</label>
                  <input value={form.result_value} onChange={e => setForm(f => ({ ...f, result_value: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 95% MDD" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Result *</label>
                  <select required value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="pending">Pending</option>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Lab Reference</label>
                  <input value={form.lab_reference} onChange={e => setForm(f => ({ ...f, lab_reference: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tested By</label>
                  <input value={form.tested_by} onChange={e => setForm(f => ({ ...f, tested_by: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                <textarea rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
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
