import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getDisciplinaryRecords, createDisciplinaryRecord } from '../../api/hr'
import { PlusIcon } from '@heroicons/react/24/outline'
import api from '../../api/client'

const TYPE_COLORS = {
  warning:     'bg-yellow-100 text-yellow-700',
  suspension:  'bg-orange-100 text-orange-700',
  termination: 'bg-red-100 text-red-700',
  counselling: 'bg-blue-100 text-blue-700',
  other:       'bg-gray-100 text-gray-600',
}

const RECORD_TYPES = ['warning', 'suspension', 'termination', 'counselling', 'other']
const EMPTY = { employee: '', record_type: 'warning', incident_date: '', description: '', action_taken: '', acknowledged: false, notes: '' }

export default function DisciplinaryPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [form, setForm] = useState(EMPTY)

  const { data: records, isLoading } = useQuery({
    queryKey: ['disciplinary', typeFilter],
    queryFn: () => getDisciplinaryRecords(typeFilter ? { record_type: typeFilter } : undefined),
    select: r => r.data?.results ?? r.data,
  })

  const { data: employees } = useQuery({
    queryKey: ['employees-simple'],
    queryFn: () => api.get('/hr/employees/', { params: { is_active: true } }),
    select: r => r.data?.results ?? r.data,
  })

  const createMut = useMutation({
    mutationFn: createDisciplinaryRecord,
    onSuccess: () => {
      toast.success('Record added.')
      qc.invalidateQueries(['disciplinary'])
      setShowForm(false)
      setForm(EMPTY)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed.'),
  })

  const cls = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'
  const f = (k) => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap items-center">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
          <option value="">All Types</option>
          {RECORD_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
        <button onClick={() => setShowForm(s => !s)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark">
          <PlusIcon className="h-4 w-4" /> Add Record
        </button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate(form) }}
          className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">New Disciplinary Record</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Employee *</label>
              <select required {...f('employee')} className={cls}>
                <option value="">Select employee…</option>
                {employees?.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_number})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type *</label>
              <select required {...f('record_type')} className={cls}>
                {RECORD_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Incident Date *</label>
              <input required type="date" {...f('incident_date')} className={cls} />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Description *</label>
              <textarea required {...f('description')} rows={2}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Action Taken *</label>
              <textarea required {...f('action_taken')} rows={2}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <input {...f('notes')} className={cls} />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" id="ack" checked={form.acknowledged}
                onChange={e => setForm(p => ({ ...p, acknowledged: e.target.checked }))} />
              <label htmlFor="ack" className="text-xs text-gray-600">Employee Acknowledged</label>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" disabled={createMut.isPending}
              className="px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg disabled:opacity-60">
              Save
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-1.5 border border-gray-300 text-xs rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Disciplinary Records</h3>
        </div>
        {isLoading
          ? <p className="text-sm text-gray-400 p-8 text-center">Loading…</p>
          : !records || records.length === 0
            ? <p className="text-sm text-gray-400 p-8 text-center">No disciplinary records.</p>
            : <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Employee', 'Type', 'Incident Date', 'Description', 'Action Taken', 'Acknowledged'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-brand-slate text-xs">{r.employee_number}</p>
                          <p className="text-xs text-gray-500">{r.employee_name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TYPE_COLORS[r.record_type]}`}>
                            {r.record_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{r.incident_date}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{r.description}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{r.action_taken}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${r.acknowledged ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {r.acknowledged ? 'Yes' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        }
      </div>
    </div>
  )
}
