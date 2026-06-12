import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getEmployee, updateEmployee, getEmployeeDocuments, createEmployeeDocument, deleteEmployeeDocument, getLeaveBalances } from '../../api/hr'
import { PlusIcon, TrashIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`

const TYPE_COLORS = { staff: 'bg-indigo-100 text-indigo-700', casual: 'bg-purple-100 text-purple-700' }

const DOC_TYPES = ['contract', 'id_copy', 'certificate', 'nssf_card', 'nhif_card', 'kra_cert', 'medical', 'other']

export default function EmployeeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState('profile')
  const [editing, setEditing] = useState(false)
  const [docForm, setDocForm] = useState({ doc_type: 'contract', title: '', file_ref: '', notes: '' })
  const [showDocForm, setShowDocForm] = useState(false)

  const { data: emp, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => getEmployee(id),
    select: r => r.data,
  })

  const { data: docs } = useQuery({
    queryKey: ['employee-docs', id],
    queryFn: () => getEmployeeDocuments({ employee: id }),
    select: r => r.data,
    enabled: tab === 'documents',
  })

  const { data: leaveBalances } = useQuery({
    queryKey: ['leave-balances', id],
    queryFn: () => getLeaveBalances({ employee: id, year: new Date().getFullYear() }),
    select: r => r.data,
    enabled: tab === 'leave',
  })

  const updateMut = useMutation({
    mutationFn: (data) => updateEmployee(id, data),
    onSuccess: () => { toast.success('Updated.'); qc.invalidateQueries(['employee', id]); setEditing(false) },
  })

  const docCreateMut = useMutation({
    mutationFn: (data) => createEmployeeDocument({ ...data, employee: id }),
    onSuccess: () => { toast.success('Document added.'); qc.invalidateQueries(['employee-docs', id]); setShowDocForm(false) },
  })

  const docDeleteMut = useMutation({
    mutationFn: deleteEmployeeDocument,
    onSuccess: () => { toast.success('Deleted.'); qc.invalidateQueries(['employee-docs', id]) },
  })

  if (isLoading) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
  if (!emp) return null

  const gross = Number(emp.basic_salary || 0) + Number(emp.house_allowance || 0) +
    Number(emp.transport_allowance || 0) + Number(emp.medical_allowance || 0) + Number(emp.other_allowances || 0)

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/hr/employees')} className="text-gray-400 hover:text-brand-slate mt-1">
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-12 w-12 rounded-full bg-brand-slate text-white flex items-center justify-center text-lg font-bold">
              {emp.full_name?.[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-brand-slate text-lg">{emp.full_name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[emp.employment_type]}`}>
                  {emp.employment_type}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${emp.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {emp.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-gray-500">{emp.employee_number} · {emp.position_title || 'No position'} · {emp.department_name || 'No department'}</p>
            </div>
            <button onClick={() => setEditing(e => !e)}
              className="ml-auto px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-lg hover:bg-gray-50">
              {editing ? 'Cancel Edit' : 'Edit'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {['profile', 'compensation', 'documents', 'leave'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors
              ${tab === t ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-brand-slate'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <InfoCard title="Personal Information">
            <Row label="Full Name" value={emp.full_name} />
            <Row label="Gender" value={emp.gender} />
            <Row label="Date of Birth" value={emp.date_of_birth || '—'} />
            <Row label="Marital Status" value={emp.marital_status} />
            <Row label="National ID" value={emp.national_id || '—'} />
            <Row label="KRA PIN" value={emp.kra_pin || '—'} />
            <Row label="NSSF No." value={emp.nssf_number || '—'} />
            <Row label="NHIF / SHIF No." value={emp.nhif_number || '—'} />
          </InfoCard>
          <InfoCard title="Contact">
            <Row label="Phone" value={emp.phone} />
            <Row label="Alt. Phone" value={emp.alt_phone || '—'} />
            <Row label="Email" value={emp.email || '—'} />
            <Row label="Emergency Contact" value={emp.emergency_contact_name || '—'} />
            <Row label="Emergency Phone" value={emp.emergency_contact_phone || '—'} />
            <Row label="Relationship" value={emp.emergency_contact_relation || '—'} />
          </InfoCard>
          <InfoCard title="Employment">
            <Row label="Employee No." value={emp.employee_number} />
            <Row label="Type" value={emp.employment_type} />
            <Row label="Date Hired" value={emp.date_hired} />
            <Row label="Contract End" value={emp.contract_end_date || 'Open-ended'} />
            <Row label="Department" value={emp.department_name || '—'} />
            <Row label="Position" value={emp.position_title || '—'} />
            <Row label="Branch" value={emp.branch_name || '—'} />
          </InfoCard>
          <InfoCard title="Bank Details">
            <Row label="Bank" value={emp.bank_name || '—'} />
            <Row label="Account No." value={emp.bank_account || '—'} />
            <Row label="Bank Branch" value={emp.bank_branch || '—'} />
          </InfoCard>
        </div>
      )}

      {/* Compensation tab */}
      {tab === 'compensation' && (
        <div className="space-y-4">
          {emp.employment_type === 'staff' ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-brand-slate text-sm mb-4">Monthly Salary Breakdown</h3>
              <div className="space-y-2 max-w-sm">
                {[
                  ['Basic Salary', emp.basic_salary],
                  ['House Allowance', emp.house_allowance],
                  ['Transport Allowance', emp.transport_allowance],
                  ['Medical Allowance', emp.medical_allowance],
                  ['Other Allowances', emp.other_allowances],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium">{fmt(val)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200">
                  <span className="text-brand-slate">Gross Salary</span>
                  <span className="text-brand-slate">{fmt(gross)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-brand-slate text-sm mb-2">Casual Rate</h3>
              <p className="text-2xl font-bold text-brand-slate">{fmt(emp.daily_rate)} <span className="text-sm font-normal text-gray-500">/ day</span></p>
            </div>
          )}
        </div>
      )}

      {/* Documents tab */}
      {tab === 'documents' && (
        <div className="space-y-4">
          <button onClick={() => setShowDocForm(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark">
            <PlusIcon className="h-4 w-4" /> Add Document
          </button>
          {showDocForm && (
            <form onSubmit={e => { e.preventDefault(); docCreateMut.mutate(docForm) }}
              className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type *</label>
                  <select required value={docForm.doc_type} onChange={e => setDocForm(f => ({ ...f, doc_type: e.target.value }))}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Title *</label>
                  <input required value={docForm.title} onChange={e => setDocForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">File Reference / URL</label>
                  <input value={docForm.file_ref} onChange={e => setDocForm(f => ({ ...f, file_ref: e.target.value }))}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Notes</label>
                  <input value={docForm.notes} onChange={e => setDocForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button type="submit" className="px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg">Save</button>
                <button type="button" onClick={() => setShowDocForm(false)} className="px-3 py-1.5 border border-gray-300 text-xs rounded-lg">Cancel</button>
              </div>
            </form>
          )}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {!docs || docs.length === 0
              ? <p className="text-sm text-gray-400 p-6 text-center">No documents uploaded.</p>
              : <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>{['Type', 'Title', 'File Ref', 'Uploaded', ''].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {docs.map(d => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-xs uppercase text-gray-500">{d.doc_type.replace('_', ' ')}</td>
                        <td className="px-4 py-2.5 font-medium">{d.title}</td>
                        <td className="px-4 py-2.5 text-xs text-brand-red">
                          {d.file_ref ? <a href={d.file_ref} target="_blank" rel="noreferrer" className="hover:underline">{d.file_ref.slice(0, 40)}</a> : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">{d.uploaded_at?.slice(0, 10)}</td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => docDeleteMut.mutate(d.id)} className="text-gray-300 hover:text-red-500">
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        </div>
      )}

      {/* Leave tab */}
      {tab === 'leave' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-brand-slate text-sm">Leave Balances — {new Date().getFullYear()}</h3>
            </div>
            {!leaveBalances || leaveBalances.length === 0
              ? <p className="text-sm text-gray-400 p-6 text-center">No leave balances configured.</p>
              : <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>{['Leave Type', 'Entitled', 'Carried Fwd', 'Taken', 'Balance'].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leaveBalances.map(b => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium">{b.leave_type_name}</td>
                        <td className="px-4 py-2.5 text-gray-600">{b.entitled_days} days</td>
                        <td className="px-4 py-2.5 text-gray-600">{b.carried_forward} days</td>
                        <td className="px-4 py-2.5 text-red-600">{b.taken_days} days</td>
                        <td className="px-4 py-2.5 font-bold text-green-600">{b.balance} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
          <Link to="/hr/leave" className="text-xs text-brand-red hover:underline">View all leave applications →</Link>
        </div>
      )}
    </div>
  )
}

const InfoCard = ({ title, children }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5">
    <h3 className="font-semibold text-brand-slate text-sm mb-3">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
)

const Row = ({ label, value }) => (
  <div className="flex justify-between text-sm gap-4">
    <span className="text-gray-500 shrink-0">{label}</span>
    <span className="text-gray-800 font-medium text-right">{value}</span>
  </div>
)
