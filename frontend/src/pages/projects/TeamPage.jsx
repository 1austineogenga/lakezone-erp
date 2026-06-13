import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { UsersIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { getPersonnel, addPersonnel } from '../../api/projects'

const ROLES = [
  { value: 'site_engineer',    label: 'Site Engineer' },
  { value: 'general_foreman',  label: 'General Foreman' },
  { value: 'surveyor',         label: 'Surveyor' },
  { value: 'foreman',          label: 'Foreman' },
  { value: 'hse_lead',         label: 'HSE Lead' },
  { value: 'clerk',            label: 'Clerk' },
  { value: 'operator',         label: 'Operator' },
  { value: 'casual',           label: 'Casual' },
  { value: 'other',            label: 'Other' },
]

const ROLE_COLORS = {
  site_engineer:   'bg-blue-100 text-blue-700',
  general_foreman: 'bg-purple-100 text-purple-700',
  surveyor:        'bg-teal-100 text-teal-700',
  foreman:         'bg-indigo-100 text-indigo-700',
  hse_lead:        'bg-orange-100 text-orange-700',
  clerk:           'bg-gray-100 text-gray-600',
  operator:        'bg-yellow-100 text-yellow-700',
  casual:          'bg-green-100 text-green-700',
  other:           'bg-gray-100 text-gray-500',
}

const EMPTY = { employee_name: '', role: 'site_engineer', start_date: '', end_date: '', monthly_rate: '', include_in_budget: true, notes: '' }

export default function TeamPage() {
  const { projectId } = useParams()
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const { data: personnel = [] } = useQuery({
    queryKey: ['project-personnel', projectId],
    queryFn: () => getPersonnel(projectId),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const addMut = useMutation({
    mutationFn: data => addPersonnel(projectId, data),
    onSuccess: () => {
      toast.success('Team member added.')
      qc.invalidateQueries({ queryKey: ['project-personnel', projectId] })
      setModal(false)
      setForm(EMPTY)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to add team member.'),
  })

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const activeCount = personnel.filter(p => !p.end_date).length
  const totalMonthly = personnel.filter(p => p.include_in_budget).reduce((s, p) => s + Number(p.monthly_rate || 0), 0)
  const roleLabel = r => ROLES.find(x => x.value === r)?.label || r

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Project Team</h2>
          <p className="text-xs text-gray-400 mt-0.5">Personnel assigned to this project</p>
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> Add Member
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Personnel', val: personnel.length, color: 'text-brand-slate', bg: 'bg-slate-50', border: 'border-l-4 border-l-slate-400' },
          { label: 'Currently Active', val: activeCount, color: 'text-green-600', bg: 'bg-green-50', border: 'border-l-4 border-l-green-500' },
          { label: 'Monthly HR Cost', val: `KES ${totalMonthly.toLocaleString()}`, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-l-4 border-l-blue-500' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} border border-gray-200 rounded-xl p-4`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Team Members ({personnel.length})</h3>
        </div>
        {personnel.length === 0 ? (
          <div className="p-10 text-center">
            <UsersIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No team members assigned yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Name', 'Role', 'Start Date', 'End Date', 'Monthly Rate', 'In Budget', 'Notes'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {personnel.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-semibold text-brand-slate">{p.employee_name}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[p.role] || 'bg-gray-100 text-gray-500'}`}>
                        {roleLabel(p.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.start_date || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.end_date || 'Ongoing'}</td>
                    <td className="px-4 py-3 text-xs font-medium">KES {Number(p.monthly_rate || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.include_in_budget ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.include_in_budget ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{p.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-brand-slate">Add Team Member</h3>
              <button onClick={() => setModal(false)}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input value={form.employee_name} onChange={e => field('employee_name', e.target.value)}
                  placeholder="e.g. John Kamau"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select value={form.role} onChange={e => field('role', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => field('start_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date (optional)</label>
                  <input type="date" value={form.end_date} onChange={e => field('end_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monthly Rate (KES)</label>
                <input type="number" value={form.monthly_rate} onChange={e => field('monthly_rate', e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input value={form.notes} onChange={e => field('notes', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.include_in_budget} onChange={e => field('include_in_budget', e.target.checked)}
                  className="rounded border-gray-300 accent-brand-red" />
                Include in budget calculations
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => addMut.mutate(form)} disabled={!form.employee_name || addMut.isPending}
                className="flex-1 px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                {addMut.isPending ? 'Adding…' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
