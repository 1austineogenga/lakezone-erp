import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { UsersIcon, PlusIcon, XMarkIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import { getPersonnel, addPersonnel, updatePersonnel } from '../../api/projects'
import api from '../../api/client'
import usePermissions from '../../hooks/usePermissions'

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
  const { canWrite } = usePermissions()
  const canEdit = canWrite('projects')
  const [modal, setModal] = useState(false)
  const [reassignModal, setReassignModal] = useState(null) // personnel record
  const [form, setForm] = useState(EMPTY)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [reassignTarget, setReassignTarget] = useState('')
  const [reassignEndDate, setReassignEndDate] = useState(new Date().toISOString().split('T')[0])

  const { data: personnel = [] } = useQuery({
    queryKey: ['project-personnel', projectId],
    queryFn: () => getPersonnel(projectId),
    select: r => r.data?.results ?? r.data ?? [],
  })

  // HR employees for the picker
  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees-simple', employeeSearch],
    queryFn: () => api.get('/hr/employees/', { params: { simple: true, q: employeeSearch || undefined, is_active: true } }),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: modal,
  })

  // All projects for reassignment target
  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => api.get('/projects/'),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: !!reassignModal,
  })

  const addMut = useMutation({
    mutationFn: data => addPersonnel(projectId, data),
    onSuccess: () => {
      toast.success('Team member added.')
      qc.invalidateQueries({ queryKey: ['project-personnel', projectId] })
      setModal(false)
      setForm(EMPTY)
      setSelectedEmployee(null)
      setEmployeeSearch('')
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to add team member.'),
  })

  // Reassign = end current assignment + create new on target project
  const reassignMut = useMutation({
    mutationFn: async ({ record, targetProjectId, endDate }) => {
      // End current assignment
      await updatePersonnel(projectId, record.id, { end_date: endDate })
      if (targetProjectId !== 'head_office') {
        // Add to new project
        await addPersonnel(targetProjectId, {
          employee_name: record.employee_name,
          role: record.role,
          start_date: endDate,
          monthly_rate: record.monthly_rate,
          include_in_budget: record.include_in_budget,
          notes: `Reassigned from project ${record.project_code || projectId}`,
        })
      }
    },
    onSuccess: () => {
      toast.success('Team member reassigned successfully.')
      qc.invalidateQueries({ queryKey: ['project-personnel'] })
      qc.invalidateQueries({ queryKey: ['project-personnel', projectId] })
      setReassignModal(null)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Reassignment failed.'),
  })

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleAdd = () => {
    const name = selectedEmployee
      ? selectedEmployee.full_name
      : form.employee_name
    if (!name) { toast.error('Select or enter an employee name.'); return }
    addMut.mutate({ ...form, employee_name: name })
  }

  const activeCount = personnel.filter(p => !p.end_date).length
  const totalMonthly = personnel.filter(p => p.include_in_budget).reduce((s, p) => s + Number(p.monthly_rate || 0), 0)
  const roleLabel = r => ROLES.find(x => x.value === r)?.label || r

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Project Team</h2>
          <p className="text-xs text-gray-600 mt-0.5">Personnel assigned to this project</p>
        </div>
        {canEdit && (
          <button onClick={() => setModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
            <PlusIcon className="h-3.5 w-3.5" /> Add Member
          </button>
        )}
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
            <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Team Members ({personnel.length})</h3>
        </div>
        {personnel.length === 0 ? (
          <div className="p-10 text-center">
            <UsersIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No team members assigned yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Name', 'Role', 'Start Date', 'End Date', 'Monthly Rate', 'In Budget', 'Notes', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {personnel.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-semibold text-brand-slate">{p.employee_name}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[p.role] || 'bg-gray-100 text-gray-600'}`}>
                        {roleLabel(p.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{p.start_date || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{p.end_date || <span className="text-green-600 font-medium">Ongoing</span>}</td>
                    <td className="px-4 py-3 text-xs font-medium">KES {Number(p.monthly_rate || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.include_in_budget ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {p.include_in_budget ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{p.notes || '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {!p.end_date && (
                        <button onClick={() => { setReassignModal(p); setReassignTarget(''); }}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <ArrowsRightLeftIcon className="h-3 w-3" /> Reassign
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-brand-slate">Add Team Member</h3>
              <button onClick={() => setModal(false)}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              {/* Employee search from HR */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Search Employee (HR)</label>
                <input value={employeeSearch} onChange={e => { setEmployeeSearch(e.target.value); setSelectedEmployee(null) }}
                  placeholder="Type name or employee number..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                {employees.length > 0 && !selectedEmployee && (
                  <div className="mt-1 border border-gray-200 rounded-lg max-h-36 overflow-y-auto bg-white shadow-sm">
                    {employees.map(e => (
                      <button key={e.id} onClick={() => { setSelectedEmployee(e); setEmployeeSearch(e.full_name) }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0">
                        <span className="font-medium">{e.full_name}</span>
                        <span className="text-gray-600 ml-2">{e.employee_number} · {e.employment_type} · {e.department_name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedEmployee && (
                  <div className="mt-1 flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                    <span className="font-medium">{selectedEmployee.full_name}</span>
                    <span className="text-gray-600">{selectedEmployee.employee_number}</span>
                    <button onClick={() => { setSelectedEmployee(null); setEmployeeSearch('') }} className="ml-auto text-gray-400 hover:text-red-500">×</button>
                  </div>
                )}
                <p className="text-[10px] text-gray-600 mt-0.5">Or enter manually below if not in HR system</p>
              </div>
              {!selectedEmployee && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Manual Name</label>
                  <input value={form.employee_name} onChange={e => field('employee_name', e.target.value)}
                    placeholder="e.g. John Kamau"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role on Project</label>
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
              <button onClick={handleAdd} disabled={(!selectedEmployee && !form.employee_name) || addMut.isPending}
                className="flex-1 px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                {addMut.isPending ? 'Adding…' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {reassignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setReassignModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-brand-slate">Reassign — {reassignModal.employee_name}</h3>
              <button onClick={() => setReassignModal(null)}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Effective Date (last day on this project)</label>
                <input type="date" value={reassignEndDate} onChange={e => setReassignEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reassign To</label>
                <select value={reassignTarget} onChange={e => setReassignTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                  <option value="">Select destination...</option>
                  <option value="head_office">🏢 Head Office (no project)</option>
                  {allProjects.filter(p => p.id !== projectId).map(p => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-gray-600">
                This will end their assignment on this project and add them to the selected destination.
              </p>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setReassignModal(null)}
                className="flex-1 px-4 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => reassignMut.mutate({ record: reassignModal, targetProjectId: reassignTarget, endDate: reassignEndDate })}
                disabled={!reassignTarget || !reassignEndDate || reassignMut.isPending}
                className="flex-1 px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                {reassignMut.isPending ? 'Reassigning…' : 'Confirm Reassignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
