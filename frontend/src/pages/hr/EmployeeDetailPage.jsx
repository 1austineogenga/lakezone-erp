import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  getEmployee, updateEmployee,
  getEmployeeDocuments, createEmployeeDocument, deleteEmployeeDocument,
  getLeaveBalances,
} from '../../api/hr'
import {
  PlusIcon, TrashIcon, ArrowLeftIcon, PencilIcon, CheckIcon, XMarkIcon,
  PhoneIcon, EnvelopeIcon, IdentificationIcon, BriefcaseIcon,
  BuildingOfficeIcon, BanknotesIcon, ShieldExclamationIcon, DocumentTextIcon,
  CalendarDaysIcon, UserIcon,
} from '@heroicons/react/24/outline'
import api from '../../api/client'
import usePermissions from '../../hooks/usePermissions'

const fmt = n => `KES ${Number(n || 0).toLocaleString()}`
const DOC_TYPES = ['contract', 'id_copy', 'certificate', 'nssf_card', 'nhif_card', 'kra_cert', 'medical', 'other']
const cls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red'

const AVATAR_COLORS = [
  'from-red-600 to-red-800',     'from-slate-600 to-slate-800', 'from-red-700 to-red-900',
  'from-slate-500 to-slate-700', 'from-red-500 to-red-700',     'from-slate-700 to-slate-900',
  'from-rose-600 to-rose-800',   'from-slate-600 to-slate-800', 'from-red-600 to-red-800',
  'from-slate-500 to-slate-700', 'from-rose-700 to-rose-900',   'from-slate-600 to-slate-800',
]
function avatarGradient(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export default function EmployeeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const { user } = usePermissions()
  const canEdit = user?.role === 'system_admin' || user?.role === 'hr_manager'
  const [tab, setTab] = useState('profile')
  const [editing, setEditing] = useState(location.state?.edit === true)
  const [editData, setEditData] = useState({})
  const [docForm, setDocForm] = useState({ doc_type: 'contract', title: '', file_ref: '', notes: '' })
  const [showDocForm, setShowDocForm] = useState(false)

  const { data: emp, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => getEmployee(id),
    select: r => r.data?.results ?? r.data,
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/auth/departments/'),
    select: r => r.data?.results ?? r.data,
  })
  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: () => api.get('/hr/positions/'),
    select: r => r.data?.results ?? r.data,
  })
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/auth/branches/'),
    select: r => r.data?.results ?? r.data,
  })
  const { data: docs } = useQuery({
    queryKey: ['employee-docs', id],
    queryFn: () => getEmployeeDocuments({ employee: id }),
    select: r => r.data?.results ?? r.data,
    enabled: tab === 'documents',
  })
  const { data: leaveBalances } = useQuery({
    queryKey: ['leave-balances', id],
    queryFn: () => getLeaveBalances({ employee: id, year: new Date().getFullYear() }),
    select: r => r.data?.results ?? r.data,
    enabled: tab === 'leave',
  })
  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get('/auth/users/', { params: { page_size: 200 } }),
    select: r => r.data?.results ?? r.data,
    enabled: editing,
  })

  useEffect(() => {
    if (emp && editing) {
      setEditData({
        employee_number: emp.employee_number || '', reports_to: emp.reports_to || '',
        first_name: emp.first_name || '', last_name: emp.last_name || '', middle_name: emp.middle_name || '',
        phone: emp.phone || '', alt_phone: emp.alt_phone || '', email: emp.email || '',
        gender: emp.gender || '', date_of_birth: emp.date_of_birth || '', marital_status: emp.marital_status || '',
        national_id: emp.national_id || '', kra_pin: emp.kra_pin || '',
        nssf_number: emp.nssf_number || '', nhif_number: emp.nhif_number || '',
        department: emp.department || '', position: emp.position || '', branch: emp.branch || '',
        date_hired: emp.date_hired || '', contract_end_date: emp.contract_end_date || '',
        basic_salary: emp.basic_salary || '', house_allowance: emp.house_allowance || '',
        transport_allowance: emp.transport_allowance || '', medical_allowance: emp.medical_allowance || '',
        other_allowances: emp.other_allowances || '', daily_rate: emp.daily_rate || '',
        bank_name: emp.bank_name || '', bank_account: emp.bank_account || '', bank_branch: emp.bank_branch || '',
        emergency_contact_name: emp.emergency_contact_name || '',
        emergency_contact_phone: emp.emergency_contact_phone || '',
        emergency_contact_relation: emp.emergency_contact_relation || '',
        is_active: emp.is_active, notes: emp.notes || '',
      })
    }
  }, [emp, editing])

  const updateMut = useMutation({
    mutationFn: data => updateEmployee(id, data),
    onSuccess: () => { toast.success('Employee updated.'); qc.invalidateQueries(['employee', id]); setEditing(false) },
    onError: e => toast.error(e.response?.data?.detail || 'Update failed.'),
  })
  const docCreateMut = useMutation({
    mutationFn: data => createEmployeeDocument({ ...data, employee: id }),
    onSuccess: () => { toast.success('Document added.'); qc.invalidateQueries(['employee-docs', id]); setShowDocForm(false); setDocForm({ doc_type: 'contract', title: '', file_ref: '', notes: '' }) },
  })
  const docDeleteMut = useMutation({
    mutationFn: deleteEmployeeDocument,
    onSuccess: () => { toast.success('Deleted.'); qc.invalidateQueries(['employee-docs', id]) },
  })

  if (isLoading) return <div className="text-sm text-gray-500 py-16 text-center">Loading…</div>
  if (!emp) return null

  const gross = ['basic_salary','house_allowance','transport_allowance','medical_allowance','other_allowances']
    .reduce((s, k) => s + Number(emp[k] || 0), 0)
  const ef = k => ({ value: editData[k] ?? '', onChange: e => setEditData(p => ({ ...p, [k]: e.target.value })) })
  const handleSave = () => {
    const payload = { ...editData }
    ;['contract_end_date','date_of_birth','department','position','branch','reports_to'].forEach(k => { if (!payload[k]) delete payload[k] })
    updateMut.mutate(payload)
  }

  const initials = (emp.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const grad = avatarGradient(emp.full_name || '')
  const isStaff = emp.employment_type === 'staff'

  const TABS = [
    { key: 'profile',      label: 'Profile' },
    { key: 'compensation', label: 'Compensation' },
    { key: 'documents',    label: 'Documents' },
    { key: 'leave',        label: 'Leave' },
  ]

  return (
    <div className="space-y-0">

      {/* ── Hero Header ── */}
      <div className="bg-brand-slate rounded-2xl overflow-hidden mb-5 relative">
        {/* decorative circles */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white opacity-5" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white opacity-5" />

        <div className="relative z-10 px-6 pt-5 pb-0 flex items-end gap-5 flex-wrap">
          {/* Avatar */}
          <div className={`h-20 w-20 rounded-2xl bg-gradient-to-br ${grad} text-white flex items-center justify-center text-2xl font-bold shadow-lg shrink-0 mb-0 border-2 border-white/20`}>
            {initials}
          </div>

          {/* Name + meta */}
          <div className="flex-1 pb-4 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white text-xl font-bold">{emp.full_name}</h2>
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${isStaff ? 'bg-brand-red/30 text-white' : 'bg-white/20 text-white'}`}>
                {isStaff ? 'Staff' : 'Casual'}
              </span>
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${emp.is_active ? 'bg-green-400/30 text-green-100' : 'bg-red-400/30 text-red-100'}`}>
                {emp.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-white/70 text-sm mt-0.5">
              {emp.employee_number}{emp.position_title ? ` · ${emp.position_title}` : ''}{emp.department_name ? ` · ${emp.department_name}` : ''}
            </p>
          </div>

          {/* Actions */}
          <div className="pb-4 flex gap-2 flex-wrap">
            <button onClick={() => navigate('/hr/employees')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg border border-white/20">
              <ArrowLeftIcon className="h-3.5 w-3.5" /> Back
            </button>
            {editing ? (
              <>
                <button onClick={handleSave} disabled={updateMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-60">
                  <CheckIcon className="h-3.5 w-3.5" /> Save Changes
                </button>
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg border border-white/20">
                  <XMarkIcon className="h-3.5 w-3.5" /> Cancel
                </button>
              </>
            ) : canEdit ? (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-semibold rounded-lg">
                <PencilIcon className="h-3.5 w-3.5" /> Edit Employee
              </button>
            ) : null}
          </div>
        </div>

        {/* Tabs inside header */}
        <div className="relative z-10 flex gap-0 px-6">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors
                ${tab === t.key ? 'border-white text-white' : 'border-transparent text-white/50 hover:text-white/80'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Profile: view ── */}
      {tab === 'profile' && !editing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section icon={UserIcon} title="Personal Information" color="text-brand-slate" bg="bg-slate-50" border="border-slate-100">
            <InfoRow label="Full Name"      value={emp.full_name} />
            <InfoRow label="Gender"         value={emp.gender} />
            <InfoRow label="Date of Birth"  value={emp.date_of_birth} />
            <InfoRow label="Marital Status" value={emp.marital_status} />
            <InfoRow label="National ID"    value={emp.national_id} />
            <InfoRow label="KRA PIN"        value={emp.kra_pin} />
            <InfoRow label="NSSF No."       value={emp.nssf_number} />
            <InfoRow label="SHA/SHIF No."   value={emp.nhif_number} />
          </Section>

          <Section icon={PhoneIcon} title="Contact" color="text-brand-red" bg="bg-red-50" border="border-red-100">
            <InfoRow label="Phone"             value={emp.phone} />
            <InfoRow label="Alt. Phone"        value={emp.alt_phone} />
            <InfoRow label="Email"             value={emp.email} />
            <InfoRow label="Emergency Contact" value={emp.emergency_contact_name} />
            <InfoRow label="Emergency Phone"   value={emp.emergency_contact_phone} />
            <InfoRow label="Relationship"      value={emp.emergency_contact_relation} />
          </Section>

          <Section icon={BriefcaseIcon} title="Employment" color="text-brand-slate" bg="bg-slate-50" border="border-slate-100">
            <InfoRow label="Employee No."  value={emp.employee_number} />
            <InfoRow label="Type"          value={emp.employment_type} />
            <InfoRow label="Date Hired"    value={emp.date_hired} />
            <InfoRow label="Contract End"  value={emp.contract_end_date || 'Open-ended'} />
            <InfoRow label="Department"    value={emp.department_name} />
            <InfoRow label="Position"      value={emp.position_title} />
            <InfoRow label="Branch"        value={emp.branch_name} />
          </Section>

          <Section icon={BanknotesIcon} title="Bank Details" color="text-green-600" bg="bg-green-50" border="border-green-100">
            <InfoRow label="Bank"         value={emp.bank_name} />
            <InfoRow label="Account No."  value={emp.bank_account} />
            <InfoRow label="Bank Branch"  value={emp.bank_branch} />
          </Section>

          {emp.notes && (
            <div className="md:col-span-2">
              <Section icon={DocumentTextIcon} title="Notes" color="text-gray-500" bg="bg-gray-50" border="border-gray-100">
                <p className="text-sm text-gray-600">{emp.notes}</p>
              </Section>
            </div>
          )}
        </div>
      )}

      {/* ── Profile: edit ── */}
      {tab === 'profile' && editing && (
        <div className="space-y-4">
          <EditCard title="Personal Information" icon={UserIcon} color="text-brand-slate">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="First Name *"><input required {...ef('first_name')} className={cls} /></Field>
              <Field label="Last Name *"><input required {...ef('last_name')} className={cls} /></Field>
              <Field label="Middle Name"><input {...ef('middle_name')} className={cls} /></Field>
              <Field label="Gender">
                <select {...ef('gender')} className={cls}>
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Date of Birth"><input type="date" {...ef('date_of_birth')} className={cls} /></Field>
              <Field label="Marital Status">
                <select {...ef('marital_status')} className={cls}>
                  <option value="">—</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </select>
              </Field>
              <Field label="National ID"><input {...ef('national_id')} className={cls} /></Field>
              <Field label="KRA PIN"><input {...ef('kra_pin')} className={cls} /></Field>
              <Field label="NSSF Number"><input {...ef('nssf_number')} className={cls} /></Field>
              <Field label="SHA/SHIF Number"><input {...ef('nhif_number')} className={cls} /></Field>
            </div>
          </EditCard>

          <EditCard title="Contact Details" icon={PhoneIcon} color="text-brand-red">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Phone *"><input required {...ef('phone')} className={cls} /></Field>
              <Field label="Alt. Phone"><input {...ef('alt_phone')} className={cls} /></Field>
              <Field label="Email"><input type="email" {...ef('email')} className={cls} /></Field>
              <Field label="Emergency Contact Name"><input {...ef('emergency_contact_name')} className={cls} /></Field>
              <Field label="Emergency Contact Phone"><input {...ef('emergency_contact_phone')} className={cls} /></Field>
              <Field label="Relationship"><input {...ef('emergency_contact_relation')} className={cls} /></Field>
            </div>
          </EditCard>

          <EditCard title="Employment" icon={BriefcaseIcon} color="text-brand-slate">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Employee Number"><input {...ef('employee_number')} className={cls} /></Field>
              <Field label="Department">
                <select {...ef('department')} className={cls}>
                  <option value="">— None —</option>
                  {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Position">
                <select {...ef('position')} className={cls}>
                  <option value="">— None —</option>
                  {positions?.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </Field>
              <Field label="Branch">
                <select {...ef('branch')} className={cls}>
                  <option value="">— None —</option>
                  {branches?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label="Reports To">
                <select {...ef('reports_to')} className={cls}>
                  <option value="">— None —</option>
                  {users?.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}{u.role ? ` (${u.role.replace(/_/g,' ')})` : ''}</option>)}
                </select>
              </Field>
              <Field label="Date Hired *"><input required type="date" {...ef('date_hired')} className={cls} /></Field>
              <Field label="Contract End Date"><input type="date" {...ef('contract_end_date')} className={cls} /></Field>
              <Field label="Status">
                <select value={editData.is_active ? 'true' : 'false'} onChange={e => setEditData(p => ({ ...p, is_active: e.target.value === 'true' }))} className={cls}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </Field>
            </div>
          </EditCard>

          <EditCard title="Bank Details" icon={BanknotesIcon} color="text-green-600">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Bank Name"><input {...ef('bank_name')} className={cls} /></Field>
              <Field label="Account Number"><input {...ef('bank_account')} className={cls} /></Field>
              <Field label="Bank Branch"><input {...ef('bank_branch')} className={cls} /></Field>
            </div>
          </EditCard>

          <EditCard title="Notes" icon={DocumentTextIcon} color="text-gray-500">
            <textarea {...ef('notes')} rows={3} className={cls} />
          </EditCard>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={updateMut.isPending}
              className="px-6 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-60">
              Save Changes
            </button>
            <button onClick={() => setEditing(false)}
              className="px-6 py-2.5 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Compensation ── */}
      {tab === 'compensation' && (
        <div className="space-y-4">
          {emp.employment_type === 'staff' ? (
            <div className="bg-white border border-green-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-green-50 border-b border-green-100">
                <div className="flex items-center gap-2">
                  <div className="bg-green-100 p-1.5 rounded-lg"><BanknotesIcon className="h-4 w-4 text-green-600" /></div>
                  <h3 className="font-bold text-sm text-green-800 uppercase tracking-wider">Monthly Salary Breakdown</h3>
                </div>
                {canEdit && !editing && (
                  <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-green-700 border border-green-200 bg-white px-2.5 py-1 rounded-lg hover:bg-green-50">
                    <PencilIcon className="h-3 w-3" /> Edit
                  </button>
                )}
              </div>
              <div className="p-5">
                {!editing ? (
                  <div className="max-w-sm space-y-3">
                    {[['Basic Salary','basic_salary'],['House Allowance','house_allowance'],['Transport Allowance','transport_allowance'],['Medical Allowance','medical_allowance'],['Other Allowances','other_allowances']].map(([label,key]) => (
                      <div key={key} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-semibold text-gray-800">{fmt(emp[key])}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center text-sm font-bold pt-2 border-t-2 border-green-200">
                      <span className="text-green-700">Gross Salary</span>
                      <span className="text-green-700 text-lg">{fmt(gross)}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-lg">
                      <Field label="Basic Salary"><input type="number" {...ef('basic_salary')} className={cls} /></Field>
                      <Field label="House Allowance"><input type="number" {...ef('house_allowance')} className={cls} /></Field>
                      <Field label="Transport Allowance"><input type="number" {...ef('transport_allowance')} className={cls} /></Field>
                      <Field label="Medical Allowance"><input type="number" {...ef('medical_allowance')} className={cls} /></Field>
                      <Field label="Other Allowances"><input type="number" {...ef('other_allowances')} className={cls} /></Field>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={handleSave} disabled={updateMut.isPending} className="px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-60">Save</button>
                      <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-200 text-xs rounded-lg">Cancel</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-amber-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-amber-50 border-b border-amber-100">
                <div className="flex items-center gap-2">
                  <div className="bg-amber-100 p-1.5 rounded-lg"><BanknotesIcon className="h-4 w-4 text-amber-600" /></div>
                  <h3 className="font-bold text-sm text-amber-800 uppercase tracking-wider">Casual Rate</h3>
                </div>
                {canEdit && !editing && (
                  <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-amber-700 border border-amber-200 bg-white px-2.5 py-1 rounded-lg hover:bg-amber-50">
                    <PencilIcon className="h-3 w-3" /> Edit
                  </button>
                )}
              </div>
              <div className="p-5">
                {!editing ? (
                  <p className="text-3xl font-bold text-amber-700">{fmt(emp.daily_rate)} <span className="text-sm font-normal text-gray-500">/ day</span></p>
                ) : (
                  <div className="max-w-xs space-y-3">
                    <Field label="Daily Rate (KES)"><input type="number" {...ef('daily_rate')} className={cls} /></Field>
                    <div className="flex gap-2">
                      <button onClick={handleSave} disabled={updateMut.isPending} className="px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-60">Save</button>
                      <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-200 text-xs rounded-lg">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Documents ── */}
      {tab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand-slate">Employee Documents</h3>
            <button onClick={() => setShowDocForm(s => !s)}
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90">
              <PlusIcon className="h-3.5 w-3.5" /> Add Document
            </button>
          </div>
          {showDocForm && (
            <form onSubmit={e => { e.preventDefault(); docCreateMut.mutate(docForm) }}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Type *">
                  <select required value={docForm.doc_type} onChange={e => setDocForm(f => ({ ...f, doc_type: e.target.value }))} className={cls}>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ').toUpperCase()}</option>)}
                  </select>
                </Field>
                <Field label="Title *"><input required value={docForm.title} onChange={e => setDocForm(f => ({ ...f, title: e.target.value }))} className={cls} /></Field>
                <Field label="File Reference / URL"><input value={docForm.file_ref} onChange={e => setDocForm(f => ({ ...f, file_ref: e.target.value }))} className={cls} /></Field>
                <Field label="Notes"><input value={docForm.notes} onChange={e => setDocForm(f => ({ ...f, notes: e.target.value }))} className={cls} /></Field>
              </div>
              <div className="flex gap-2 mt-3">
                <button type="submit" disabled={docCreateMut.isPending} className="px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-lg disabled:opacity-60">Save</button>
                <button type="button" onClick={() => setShowDocForm(false)} className="px-4 py-2 border border-gray-200 text-xs rounded-lg">Cancel</button>
              </div>
            </form>
          )}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {!docs || docs.length === 0 ? (
              <p className="text-sm text-gray-500 p-8 text-center">No documents uploaded.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Type','Title','File Ref','Uploaded',''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {docs.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-brand-slate font-semibold uppercase">{d.doc_type.replace(/_/g,' ')}</span></td>
                      <td className="px-4 py-3 font-medium text-gray-800 text-xs">{d.title}</td>
                      <td className="px-4 py-3 text-xs text-brand-red">{d.file_ref ? <a href={d.file_ref} target="_blank" rel="noreferrer" className="hover:underline">{d.file_ref.slice(0,40)}</a> : '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{d.uploaded_at?.slice(0,10)}</td>
                      <td className="px-4 py-3"><button onClick={() => docDeleteMut.mutate(d.id)} className="text-gray-400 hover:text-red-500"><TrashIcon className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Leave ── */}
      {tab === 'leave' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <div className="bg-brand-red p-1.5 rounded-lg"><CalendarDaysIcon className="h-4 w-4 text-white" /></div>
              <h3 className="font-bold text-sm text-brand-slate uppercase tracking-wider">Leave Balances — {new Date().getFullYear()}</h3>
            </div>
            {!leaveBalances || leaveBalances.length === 0 ? (
              <p className="text-sm text-gray-500 p-8 text-center">No leave balances configured.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Leave Type','Entitled','Carried Fwd','Taken','Balance'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leaveBalances.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-800 text-xs">{b.leave_type_name}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{b.entitled_days} days</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{b.carried_forward} days</td>
                      <td className="px-4 py-3 text-xs"><span className="text-red-600 font-semibold">{b.taken_days} days</span></td>
                      <td className="px-4 py-3 text-xs"><span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">{b.balance} days</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Link to="/hr/leave" className="text-xs text-brand-red hover:underline font-medium">View all leave applications →</Link>
        </div>
      )}
    </div>
  )
}

function Section({ icon: Icon, title, color, bg, border, children }) {
  return (
    <div className={`bg-white border ${border} rounded-2xl shadow-sm overflow-hidden`}>
      <div className={`flex items-center gap-2 px-5 py-3.5 ${bg} border-b ${border}`}>
        <div className={`${bg} p-1.5 rounded-lg border ${border}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <h3 className={`font-bold text-[11px] uppercase tracking-wider ${color}`}>{title}</h3>
      </div>
      <div className="px-5 py-4 space-y-2.5">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-baseline gap-4 text-sm border-b border-gray-50 pb-1.5 last:border-0 last:pb-0">
      <span className="text-gray-400 text-xs shrink-0">{label}</span>
      <span className="text-gray-800 font-medium text-right text-xs">{value || '—'}</span>
    </div>
  )
}

function EditCard({ icon: Icon, title, color, children }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 bg-gray-50 border-b border-gray-100">
        <Icon className={`h-4 w-4 ${color}`} />
        <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 font-medium mb-1">{label}</label>
      {children}
    </div>
  )
}
