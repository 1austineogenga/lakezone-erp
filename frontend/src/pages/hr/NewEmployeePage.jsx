import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { createEmployee } from '../../api/hr'
import api from '../../api/client'

// Medical insurance monthly deductions by family category (Co-Pay 0)
const INSURANCE_RATES = {
  'M':   2629,
  'M+1': 3126,
  'M+2': 3624,
  'M+3': 4122,
  'M+4': 4619,
}

const DOC_TYPES = [
  { value: 'cv',           label: 'CV / Resume' },
  { value: 'id_copy',      label: 'National ID Copy' },
  { value: 'nhif_card',    label: 'SHA/SHIF Card' },
  { value: 'academics',    label: 'Academic Certificates' },
  { value: 'good_conduct', label: 'Certificate of Good Conduct' },
  { value: 'nssf_card',    label: 'NSSF Card' },
  { value: 'kra_cert',     label: 'KRA Certificate' },
  { value: 'contract',     label: 'Employment Contract' },
  { value: 'other',        label: 'Other' },
]

const EMPTY = {
  // Employment Details
  employment_type: 'staff',
  employee_number: '',
  department: '', position: '', branch: '',
  reports_to: '',
  date_hired: '', contract_end_date: '',

  // Personal Information
  first_name: '', middle_name: '', last_name: '',
  account_name: '',
  gender: 'male', date_of_birth: '',
  marital_status: 'single',
  phone: '', alt_phone: '',
  email: '',
  national_id: '', kra_pin: '', nssf_number: '', nhif_number: '',

  // Next of Kin
  next_of_kin_name: '', next_of_kin_relation: '', next_of_kin_phone: '',
  next_of_kin_alt_phone: '', next_of_kin_id: '',

  // Emergency Contacts
  emergency_contact_name: '', emergency_contact_relation: '', emergency_contact_phone: '',
  emergency_contact2_name: '', emergency_contact2_relation: '', emergency_contact2_phone: '',

  // Medical
  blood_group: '', allergies: '', chronic_conditions: '',
  disability: 'none', disability_details: '',
  medical_declaration: '',
  medical_insurance: false, medical_insurance_category: '',

  // Compensation
  basic_salary: '', house_allowance: '0', transport_allowance: '0',
  medical_allowance: '0', other_allowances: '0',

  // Bank
  bank_name: '', account_name: '', bank_account: '', bank_branch: '',

  // Notes
  notes: '',
}

const cls = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'

const Section = ({ title, children }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5">
    <h3 className="font-semibold text-brand-slate text-sm mb-4 pb-2 border-b border-gray-100">{title}</h3>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{children}</div>
  </div>
)

const Field = ({ label, required, span, children }) => (
  <div className={span ? `col-span-${span}` : ''}>
    <label className="block text-xs text-gray-600 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    {children}
  </div>
)

export default function NewEmployeePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [photo, setPhoto] = useState(null)          // File object
  const [photoPreview, setPhotoPreview] = useState(null)
  const [documents, setDocuments] = useState([])    // [{doc_type, file, notes}]
  const photoRef = useRef()

  const f = (k) => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/auth/departments/'),
    select: r => r.data?.results ?? r.data,
  })
  const { data: positions } = useQuery({
    queryKey: ['positions', form.department],
    queryFn: () => api.get('/hr/positions/', { params: form.department ? { department: form.department } : undefined }),
    select: r => r.data?.results ?? r.data,
  })
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/auth/branches/'),
    select: r => r.data?.results ?? r.data,
  })
  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get('/auth/users/', { params: { page_size: 200 } }),
    select: r => r.data?.results ?? r.data,
  })
  const { data: projectLocations } = useQuery({
    queryKey: ['project-locations'],
    queryFn: () => api.get('/projects/', { params: { page_size: 100 } }),
    select: r => {
      const projects = r.data?.results ?? r.data ?? []
      return [...new Set(projects.map(p => p.location).filter(Boolean))]
    },
  })

  const createMut = useMutation({
    mutationFn: createEmployee,
    onSuccess: async (res) => {
      const empId = res.data.id

      // Upload documents if any — endpoint: /hr/employee-documents/
      if (documents.length > 0) {
        const uploads = documents
          .filter(d => d.file && d.doc_type)
          .map(async (doc) => {
            try {
              const fd = new FormData()
              fd.append('employee', empId)
              fd.append('doc_type', doc.doc_type)
              fd.append('title', DOC_TYPES.find(t => t.value === doc.doc_type)?.label || doc.doc_type)
              fd.append('file_ref', doc.file.name)
              if (doc.notes) fd.append('notes', doc.notes)
              // Note: actual file binary upload requires backend file field support;
              // the current EmployeeDocument model uses file_ref (CharField).
              // We POST metadata only; wire file storage separately when ready.
              await api.post('/hr/employee-documents/', {
                employee: empId,
                doc_type: doc.doc_type,
                title: DOC_TYPES.find(t => t.value === doc.doc_type)?.label || doc.doc_type,
                file_ref: doc.file.name,
                notes: doc.notes || '',
              })
            } catch (_) {
              // Silently skip failed document uploads; employee was already created
            }
          })
        await Promise.all(uploads)
      }

      toast.success('Employee added.')
      navigate(`/hr/employees/${empId}`)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to create employee.'),
  })

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Photo must be JPG or PNG.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Photo must be under 2 MB.')
      return
    }
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const addDocument = () => setDocuments(d => [...d, { doc_type: '', file: null, notes: '' }])
  const removeDocument = (i) => setDocuments(d => d.filter((_, idx) => idx !== i))
  const updateDoc = (i, key, value) => setDocuments(d => d.map((doc, idx) => idx === i ? { ...doc, [key]: value } : doc))

  const handleDocFile = (i, file) => {
    if (!file) return
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png']
    if (!allowed.includes(file.type)) { toast.error('Unsupported file type.'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('File must be under 5 MB.'); return }
    updateDoc(i, 'file', file)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form }
    // Always staff for this form
    payload.employment_type = 'staff'
    // Parse numeric fields
    ;['basic_salary', 'house_allowance', 'transport_allowance', 'medical_allowance', 'other_allowances'].forEach(k => {
      payload[k] = parseFloat(payload[k] || 0)
    })
    // Auto-set medical_insurance_deduction from category
    if (payload.medical_insurance && payload.medical_insurance_category) {
      payload.medical_insurance_deduction = INSURANCE_RATES[payload.medical_insurance_category] || 0
    } else {
      payload.medical_insurance_deduction = 0
    }
    // Remove empty optional FK/date fields
    ;['department', 'position', 'branch', 'contract_end_date', 'date_of_birth', 'reports_to'].forEach(k => {
      if (!payload[k]) delete payload[k]
    })
    // Remove empty optional string fields that might cause issues
    if (!payload.blood_group) delete payload.blood_group
    createMut.mutate(payload)
  }

  const insuranceDeduction = form.medical_insurance && form.medical_insurance_category
    ? INSURANCE_RATES[form.medical_insurance_category]
    : null

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-brand-slate text-base">New Permanent Employee</h2>
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

      {/* 1. Employment Details */}
      <Section title="1. Employment Details">
        <Field label="Employee Number">
          <input {...f('employee_number')} placeholder="e.g. LZ001" className={cls} />
        </Field>
        <Field label="Department" required>
          <select required {...f('department')} className={cls}>
            <option value="">Select department…</option>
            {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Position / Job Title" required>
          <select required {...f('position')} className={cls}>
            <option value="">Select position…</option>
            {positions?.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </Field>
        <Field label="Branch" required>
          <select required {...f('branch')} className={cls}>
            <option value="">Select branch…</option>
            {branches?.map(b => <option key={b.id} value={b.id}>{b.name}{b.location ? ` (${b.location})` : ''}</option>)}
            {projectLocations?.length > 0 && (
              <optgroup label="Project Sites">
                {projectLocations.map(loc => (
                  <option key={`site-${loc}`} value={`site:${loc}`}>Site — {loc}</option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>
        <Field label="Reports To">
          <select {...f('reports_to')} className={cls}>
            <option value="">Select user…</option>
            {users?.map(u => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name}{u.role ? ` (${u.role.replace(/_/g, ' ')})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date Hired" required>
          <input required type="date" {...f('date_hired')} className={cls} />
        </Field>
        <Field label="Contract End Date">
          <input type="date" {...f('contract_end_date')} className={cls} />
        </Field>
      </Section>

      {/* 2. Personal Information */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-brand-slate text-sm mb-1 pb-2 border-b border-gray-100">2. Personal Information</h3>
        <p className="text-xs text-red-500 mb-4">All fields marked * are required</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="First Name" required>
            <input required {...f('first_name')} className={cls} />
          </Field>
          <Field label="Middle Name">
            <input {...f('middle_name')} className={cls} />
          </Field>
          <Field label="Last Name" required>
            <input required {...f('last_name')} className={cls} />
          </Field>
          <Field label="Gender" required>
            <select required {...f('gender')} className={cls}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Date of Birth" required>
            <input required type="date" {...f('date_of_birth')} className={cls} />
          </Field>
          <Field label="Marital Status" required>
            <select required {...f('marital_status')} className={cls}>
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
          <Field label="Work Email">
            <input type="email" {...f('email')} className={cls} />
          </Field>
          <Field label="National ID" required>
            <input required {...f('national_id')} className={cls} />
          </Field>
          <Field label="KRA PIN" required>
            <input required {...f('kra_pin')} className={cls} />
          </Field>
          <Field label="NSSF Number">
            <input {...f('nssf_number')} className={cls} />
          </Field>
          <Field label="SHA/SHIF Number">
            <input {...f('nhif_number')} className={cls} />
          </Field>
        </div>
      </div>

      {/* 3. Next of Kin */}
      <Section title="3. Next of Kin">
        <Field label="Full Name" required>
          <input required {...f('next_of_kin_name')} className={cls} />
        </Field>
        <Field label="Relationship" required>
          <input required {...f('next_of_kin_relation')} placeholder="e.g. Spouse, Parent, Sibling" className={cls} />
        </Field>
        <Field label="Phone" required>
          <input required {...f('next_of_kin_phone')} placeholder="+254…" className={cls} />
        </Field>
        <Field label="Alt. Phone">
          <input {...f('next_of_kin_alt_phone')} className={cls} />
        </Field>
        <Field label="ID Number">
          <input {...f('next_of_kin_id')} className={cls} />
        </Field>
      </Section>

      {/* 4. Emergency Contacts */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-brand-slate text-sm mb-4 pb-2 border-b border-gray-100">4. Emergency Contacts</h3>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Emergency Contact 1</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Full Name" required>
                <input required {...f('emergency_contact_name')} className={cls} />
              </Field>
              <Field label="Relationship" required>
                <input required {...f('emergency_contact_relation')} placeholder="e.g. Spouse, Parent" className={cls} />
              </Field>
              <Field label="Phone" required>
                <input required {...f('emergency_contact_phone')} placeholder="+254…" className={cls} />
              </Field>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Emergency Contact 2 (optional)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Full Name">
                <input {...f('emergency_contact2_name')} className={cls} />
              </Field>
              <Field label="Relationship">
                <input {...f('emergency_contact2_relation')} placeholder="e.g. Sibling, Friend" className={cls} />
              </Field>
              <Field label="Phone">
                <input {...f('emergency_contact2_phone')} placeholder="+254…" className={cls} />
              </Field>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Medical Information */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-brand-slate text-sm mb-4 pb-2 border-b border-gray-100">5. Medical Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Blood Group">
            <select {...f('blood_group')} className={cls}>
              <option value="">Select…</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </Field>
          <Field label="Allergies" span={2}>
            <input {...f('allergies')} placeholder="e.g. Penicillin, Peanuts" className={cls} />
          </Field>
          <Field label="Chronic Conditions" span={2}>
            <input {...f('chronic_conditions')} placeholder="e.g. Diabetes, Hypertension" className={cls} />
          </Field>
          <Field label="Disability">
            <select {...f('disability')} className={cls}>
              <option value="none">None</option>
              <option value="visual">Visual</option>
              <option value="hearing">Hearing</option>
              <option value="physical">Physical</option>
              <option value="other">Other</option>
            </select>
          </Field>
          {form.disability !== 'none' && (
            <Field label="Disability Details" span={2}>
              <input {...f('disability_details')} placeholder="Please describe…" className={cls} />
            </Field>
          )}
          <div className="col-span-2 md:col-span-3">
            <label className="block text-xs text-gray-600 mb-1">Medical Declaration</label>
            <textarea {...f('medical_declaration')} rows={3}
              placeholder="Any other medical information the employee wishes to declare (e.g. medications, previous surgeries, special needs)…"
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
          </div>
        </div>

        {/* Medical Insurance */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-600 mb-3">Medical Insurance Enrollment</p>
          <div className="flex items-center gap-4 mb-3">
            <label className="text-xs text-gray-600">Enroll in Medical Insurance?</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" name="med_ins" checked={form.medical_insurance === true}
                  onChange={() => setForm(p => ({ ...p, medical_insurance: true }))} />
                Yes
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" name="med_ins" checked={form.medical_insurance === false}
                  onChange={() => setForm(p => ({ ...p, medical_insurance: false, medical_insurance_category: '' }))} />
                No
              </label>
            </div>
          </div>
          {form.medical_insurance && (
            <div className="space-y-3">
              <div className="max-w-xs">
                <label className="block text-xs text-gray-600 mb-1">Family Category<span className="text-red-500 ml-0.5">*</span></label>
                <select required {...f('medical_insurance_category')} className={cls}>
                  <option value="">Select category…</option>
                  <option value="M">M (Member only)</option>
                  <option value="M+1">M+1</option>
                  <option value="M+2">M+2</option>
                  <option value="M+3">M+3</option>
                  <option value="M+4">M+4</option>
                </select>
              </div>
              {insuranceDeduction && (
                <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>
                    KES {insuranceDeduction.toLocaleString()} will be deducted monthly for 6 months
                    (Total: KES {(insuranceDeduction * 6).toLocaleString()})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 6. Compensation */}
      <Section title="6. Compensation">
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
      </Section>

      {/* 7. Bank Details */}
      <Section title="7. Bank Details">
        <Field label="Bank Name">
          <input {...f('bank_name')} className={cls} />
        </Field>
        <Field label="Account Name">
          <input {...f('account_name')} placeholder="Name as it appears on account" className={cls} />
        </Field>
        <Field label="Account Number">
          <input {...f('bank_account')} className={cls} />
        </Field>
        <Field label="Bank Branch">
          <input {...f('bank_branch')} className={cls} />
        </Field>
      </Section>

      {/* 8. Passport Photo */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-brand-slate text-sm mb-4 pb-2 border-b border-gray-100">8. Passport Photo</h3>
        <div className="flex items-start gap-4">
          {photoPreview ? (
            <img src={photoPreview} alt="Passport photo preview"
              className="w-24 h-24 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
          ) : (
            <div className="w-24 h-24 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300 flex-shrink-0">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          <div>
            <button type="button" onClick={() => photoRef.current?.click()}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              {photo ? 'Change Photo' : 'Upload Photo'}
            </button>
            <p className="mt-1 text-xs text-gray-600">JPG or PNG, max 2 MB</p>
            <input ref={photoRef} type="file" accept="image/jpeg,image/png"
              onChange={handlePhotoChange} className="hidden" />
          </div>
        </div>
      </div>

      {/* 9. Document Attachments */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-brand-slate text-sm mb-4 pb-2 border-b border-gray-100">9. Document Attachments</h3>
        <div className="space-y-3">
          {documents.map((doc, i) => (
            <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Document Type</label>
                <select value={doc.doc_type} onChange={e => updateDoc(i, 'doc_type', e.target.value)} className={cls}>
                  <option value="">Select type…</option>
                  {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">File</label>
                <input type="file"
                  accept=".pdf,.doc,.docx,image/jpeg,image/png"
                  onChange={e => handleDocFile(i, e.target.files[0])}
                  className="w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-2 file:border-0 file:text-xs file:bg-gray-200 file:rounded cursor-pointer" />
                {doc.file && <p className="text-xs text-green-600 mt-1 truncate">{doc.file.name}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Notes</label>
                <input value={doc.notes} onChange={e => updateDoc(i, 'notes', e.target.value)}
                  placeholder="Optional note…" className={cls} />
              </div>
              <div className="flex items-end">
                <button type="button" onClick={() => removeDocument(i)}
                  className="px-2 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addDocument}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-red border border-brand-red rounded-lg hover:bg-red-50">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Document
          </button>
        </div>
      </div>

      {/* 10. Notes */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-brand-slate text-sm mb-3 pb-2 border-b border-gray-100">10. Notes</h3>
        <textarea {...f('notes')} rows={3}
          placeholder="Any additional notes…"
          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red" />
      </div>

      {/* Bottom action bar */}
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
