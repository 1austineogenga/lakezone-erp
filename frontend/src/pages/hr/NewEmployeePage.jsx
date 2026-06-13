import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { createEmployee } from '../../api/hr'
import api from '../../api/client'

const EMPTY = {
  employment_type: 'staff', first_name: '', last_name: '', middle_name: '',
  email: '', phone: '', alt_phone: '', gender: 'male', date_of_birth: '',
  marital_status: 'single', national_id: '', kra_pin: '', nssf_number: '', nhif_number: '',
  department: '', position: '', branch: '',
  date_hired: '', contract_end_date: '',
  basic_salary: '', daily_rate: '',
  house_allowance: '0', transport_allowance: '0', medical_allowance: '0', other_allowances: '0',
  bank_name: '', bank_account: '', bank_branch: '',
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
  notes: '',
}

const Section = ({ title, children }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5">
    <h3 className="font-semibold text-brand-slate text-sm mb-4 pb-2 border-b border-gray-100">{title}</h3>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{children}</div>
  </div>
)

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-xs text-gray-500 mb-1">{label}{required && ' *'}</label>
    {children}
  </div>
)

export default function NewEmployeePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const cls = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'
  const f = (k) => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })

  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/auth/departments/'), select: r => r.data?.results ?? r.data })
  const { data: positions }   = useQuery({ queryKey: ['positions', form.department], queryFn: () => api.get('/hr/positions/', { params: form.department ? { department: form.department } : undefined }), select: r => r.data?.results ?? r.data })
  const { data: branches }    = useQuery({ queryKey: ['branches'], queryFn: () => api.get('/auth/branches/'), select: r => r.data?.results ?? r.data })

  const createMut = useMutation({
    mutationFn: createEmployee,
    onSuccess: (res) => { toast.success('Employee added.'); navigate(`/hr/employees/${res.data.id}`) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to create employee.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form }
    ;['basic_salary', 'daily_rate', 'house_allowance', 'transport_allowance', 'medical_allowance', 'other_allowances'].forEach(k => {
      payload[k] = parseFloat(payload[k] || 0)
    })
    ;['department', 'position', 'branch', 'contract_end_date', 'date_of_birth'].forEach(k => {
      if (!payload[k]) delete payload[k]
    })
    createMut.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-brand-slate text-base">New Employee</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate('/hr/employees')}
            className="px-4 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={createMut.isPending}
            className="px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:bg-brand-red-dark disabled:opacity-60">
            {createMut.isPending ? 'Saving…' : 'Save Employee'}
          </button>
        </div>
      </div>

      <Section title="Employment Details">
        <Field label="Employment Type" required>
          <select required {...f('employment_type')} className={cls}>
            <option value="staff">Staff (Permanent)</option>
            <option value="casual">Casual (Daily Worker)</option>
          </select>
        </Field>
        <Field label="Department">
          <select {...f('department')} className={cls}>
            <option value="">Select department…</option>
            {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Position / Job Title">
          <select {...f('position')} className={cls}>
            <option value="">Select position…</option>
            {positions?.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </Field>
        <Field label="Branch">
          <select {...f('branch')} className={cls}>
            <option value="">Select branch…</option>
            {branches?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Date Hired" required>
          <input required type="date" {...f('date_hired')} className={cls} />
        </Field>
        <Field label="Contract End Date">
          <input type="date" {...f('contract_end_date')} className={cls} />
        </Field>
      </Section>

      <Section title="Personal Information">
        <Field label="First Name" required>
          <input required {...f('first_name')} className={cls} />
        </Field>
        <Field label="Last Name" required>
          <input required {...f('last_name')} className={cls} />
        </Field>
        <Field label="Middle Name">
          <input {...f('middle_name')} className={cls} />
        </Field>
        <Field label="Gender">
          <select {...f('gender')} className={cls}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Date of Birth">
          <input type="date" {...f('date_of_birth')} className={cls} />
        </Field>
        <Field label="Marital Status">
          <select {...f('marital_status')} className={cls}>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </select>
        </Field>
        <Field label="Phone" required>
          <input required {...f('phone')} placeholder="+254…" className={cls} />
        </Field>
        <Field label="Alt. Phone">
          <input {...f('alt_phone')} className={cls} />
        </Field>
        <Field label="Email">
          <input type="email" {...f('email')} className={cls} />
        </Field>
        <Field label="National ID">
          <input {...f('national_id')} className={cls} />
        </Field>
        <Field label="KRA PIN">
          <input {...f('kra_pin')} className={cls} />
        </Field>
        <Field label="NSSF Number">
          <input {...f('nssf_number')} className={cls} />
        </Field>
        <Field label="NHIF / SHIF Number">
          <input {...f('nhif_number')} className={cls} />
        </Field>
      </Section>

      <Section title="Compensation">
        {form.employment_type === 'staff' ? (
          <>
            <Field label="Basic Salary (KES/month)" required>
              <input required type="number" min="0" step="0.01" {...f('basic_salary')} className={cls} />
            </Field>
            <Field label="House Allowance (KES)">
              <input type="number" min="0" step="0.01" {...f('house_allowance')} className={cls} />
            </Field>
            <Field label="Transport Allowance (KES)">
              <input type="number" min="0" step="0.01" {...f('transport_allowance')} className={cls} />
            </Field>
            <Field label="Medical Allowance (KES)">
              <input type="number" min="0" step="0.01" {...f('medical_allowance')} className={cls} />
            </Field>
            <Field label="Other Allowances (KES)">
              <input type="number" min="0" step="0.01" {...f('other_allowances')} className={cls} />
            </Field>
          </>
        ) : (
          <Field label="Daily Rate (KES/day)" required>
            <input required type="number" min="0" step="0.01" {...f('daily_rate')} className={cls} />
          </Field>
        )}
      </Section>

      <Section title="Bank Details">
        <Field label="Bank Name">
          <input {...f('bank_name')} className={cls} />
        </Field>
        <Field label="Account Number">
          <input {...f('bank_account')} className={cls} />
        </Field>
        <Field label="Bank Branch">
          <input {...f('bank_branch')} className={cls} />
        </Field>
      </Section>

      <Section title="Emergency Contact">
        <Field label="Contact Name">
          <input {...f('emergency_contact_name')} className={cls} />
        </Field>
        <Field label="Contact Phone">
          <input {...f('emergency_contact_phone')} className={cls} />
        </Field>
        <Field label="Relationship">
          <input {...f('emergency_contact_relation')} placeholder="e.g. Spouse, Parent" className={cls} />
        </Field>
      </Section>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-brand-slate text-sm mb-3">Notes</h3>
        <textarea {...f('notes')} rows={3}
          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => navigate('/hr/employees')}
          className="px-5 py-2 bg-white text-gray-600 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={createMut.isPending}
          className="px-5 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark disabled:opacity-60">
          {createMut.isPending ? 'Saving…' : 'Save Employee'}
        </button>
      </div>
    </form>
  )
}
