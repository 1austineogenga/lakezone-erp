import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import axios from 'axios'
import {
  DocumentIcon, ArrowDownTrayIcon, TrashIcon, PencilIcon,
  PlusIcon, XMarkIcon, ExclamationTriangleIcon,
  FolderOpenIcon, QuestionMarkCircleIcon, ClipboardDocumentListIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import {
  getDocumentDashboard,
  getDrawings, createDrawing, updateDrawing, deleteDrawing,
  getRFIs, createRFI, updateRFI, deleteRFI,
  getSubmittals, createSubmittal, updateSubmittal, deleteSubmittal,
} from '../../api/documents'

const TABS = [
  { id: 'dashboard',  label: 'Dashboard',  Icon: ChartBarIcon },
  { id: 'drawings',   label: 'Drawings',   Icon: FolderOpenIcon },
  { id: 'rfis',       label: 'RFIs',       Icon: QuestionMarkCircleIcon },
  { id: 'submittals', label: 'Submittals', Icon: ClipboardDocumentListIcon },
]

const DISCIPLINES = [
  { value: 'civil', label: 'Civil' },
  { value: 'structural', label: 'Structural' },
  { value: 'architectural', label: 'Architectural' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'survey', label: 'Survey / GIS' },
  { value: 'geotechnical', label: 'Geotechnical' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'other', label: 'Other' },
]

const DRAWING_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'issued_for_review', label: 'Issued for Review' },
  { value: 'issued_for_construction', label: 'Issued for Construction' },
  { value: 'as_built', label: 'As Built' },
  { value: 'superseded', label: 'Superseded' },
  { value: 'void', label: 'Void' },
]

const RFI_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'responded', label: 'Responded' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const SUBMITTAL_TYPES = [
  { value: 'material_sample', label: 'Material Sample' },
  { value: 'shop_drawing', label: 'Shop Drawing' },
  { value: 'product_data', label: 'Product Data' },
  { value: 'method_statement', label: 'Method Statement' },
  { value: 'mix_design', label: 'Mix Design' },
  { value: 'test_report', label: 'Test Report' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' },
]

const SUBMITTAL_STATUSES = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'approved_as_noted', label: 'Approved as Noted' },
  { value: 'revise_resubmit', label: 'Revise & Resubmit' },
  { value: 'rejected', label: 'Rejected' },
]

// ── ProjectSelect ─────────────────────────────────────────────────────────────
function ProjectSelect({ value, onChange }) {
  const { data } = useQuery({
    queryKey: ['projects-all'],
    queryFn: () => axios.get('/api/v1/projects/', { params: { page_size: 200 } }),
    staleTime: 60_000,
  })
  const projects = data?.data?.results ?? data?.data ?? []

  return (
    <select
      value={value}
      onChange={e => {
        const proj = projects.find(p => String(p.id) === e.target.value)
        onChange(proj ? proj.name : '', proj ? proj.id : '')
      }}
      className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
    >
      <option value="">— Select Project —</option>
      {projects.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  )
}

// ── Badge helpers ─────────────────────────────────────────────────────────────
const DRAWING_STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  issued_for_review: 'bg-yellow-100 text-yellow-700',
  issued_for_construction: 'bg-green-100 text-green-700',
  as_built: 'bg-blue-100 text-blue-700',
  superseded: 'bg-orange-100 text-orange-700',
  void: 'bg-red-100 text-red-700',
}

const RFI_STATUS_COLORS = {
  open: 'bg-yellow-100 text-yellow-700',
  responded: 'bg-blue-100 text-blue-700',
  closed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-700',
}

const SUB_STATUS_COLORS = {
  submitted: 'bg-yellow-100 text-yellow-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  approved_as_noted: 'bg-teal-100 text-teal-700',
  revise_resubmit: 'bg-orange-100 text-orange-700',
  rejected: 'bg-red-100 text-red-700',
}

function Badge({ text, colorMap }) {
  const cls = colorMap?.[text] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {text?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  )
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        {label}{required && ' *'}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white'

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['doc-dashboard'],
    queryFn: () => getDocumentDashboard(),
  })
  const d = data?.data ?? {}

  const stats = [
    { label: 'Total Drawings', value: d.total_drawings ?? 0, color: 'text-blue-600' },
    { label: 'IFC Drawings', value: d.ifc_drawings ?? 0, color: 'text-green-600' },
    { label: 'Open RFIs', value: d.open_rfis ?? 0, color: 'text-yellow-600' },
    { label: 'Overdue RFIs', value: d.overdue_rfis ?? 0, color: 'text-red-600' },
    { label: 'Total Submittals', value: d.total_submittals ?? 0, color: 'text-purple-600' },
    { label: 'Pending Review', value: d.pending_submittals ?? 0, color: 'text-orange-600' },
    { label: 'Overdue Submittals', value: d.overdue_submittals ?? 0, color: 'text-red-600' },
    { label: 'Total RFIs', value: d.total_rfis ?? 0, color: 'text-gray-600' },
  ]

  if (isLoading) return <p className="text-center py-12 text-gray-400">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Discipline */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Drawings by Discipline</h3>
          {Object.keys(d.by_discipline ?? {}).length === 0
            ? <p className="text-xs text-gray-400">No drawings yet</p>
            : Object.entries(d.by_discipline ?? {}).map(([disc, count]) => (
              <div key={disc} className="flex items-center gap-2 mb-2">
                <span className="w-32 text-xs text-gray-600 dark:text-gray-400 capitalize">{disc.replace(/_/g, ' ')}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, (count / (d.total_drawings || 1)) * 100)}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-6 text-right">{count}</span>
              </div>
            ))
          }
        </div>

        {/* RFI Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Recent RFIs</h3>
          {(d.recent_rfis ?? []).length === 0
            ? <p className="text-xs text-gray-400">No RFIs yet</p>
            : (d.recent_rfis ?? []).map(r => (
              <div key={r.id} className="flex items-center justify-between py-1.5 border-b dark:border-gray-700 last:border-0">
                <div>
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200">RFI-{r.rfi_number}: {r.subject}</p>
                  <p className="text-xs text-gray-400">{r.project_name}</p>
                </div>
                <Badge text={r.status} colorMap={RFI_STATUS_COLORS} />
              </div>
            ))
          }
        </div>

        {/* Recent Submittals */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border dark:border-gray-700 md:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Recent Submittals</h3>
          {(d.recent_submittals ?? []).length === 0
            ? <p className="text-xs text-gray-400">No submittals yet</p>
            : (d.recent_submittals ?? []).map(s => (
              <div key={s.id} className="flex items-center justify-between py-1.5 border-b dark:border-gray-700 last:border-0">
                <div>
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200">SUB-{s.submittal_number}: {s.title}</p>
                  <p className="text-xs text-gray-400">{s.project_name} · {s.submittal_type?.replace(/_/g, ' ')}</p>
                </div>
                <div className="flex items-center gap-2">
                  {s.is_overdue && <ExclamationTriangleIcon className="h-4 w-4 text-red-500" title="Overdue" />}
                  <Badge text={s.status} colorMap={SUB_STATUS_COLORS} />
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ── Drawing Modal ─────────────────────────────────────────────────────────────
function DrawingModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    project_name: '', project_id: '', drawing_number: '', title: '',
    discipline: 'civil', revision: 'A', status: 'draft', scale: '',
    drawn_by: '', checked_by: '', issue_date: '', notes: '',
    ...(initial || {}),
  })
  const [file, setFile] = useState(null)
  const fileRef = useRef()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) fd.append(k, v) })
    if (file) fd.append('file', file)
    onSave(fd)
  }

  return (
    <Modal title={initial ? 'Edit Drawing' : 'Add Drawing'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Project" required>
          <ProjectSelect value={form.project_id || ''} onChange={(name, id) => setForm(f => ({ ...f, project_name: name, project_id: id }))} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Drawing Number" required>
            <input required className={inputCls} value={form.drawing_number} onChange={e => set('drawing_number', e.target.value)} />
          </Field>
          <Field label="Revision">
            <input className={inputCls} value={form.revision} onChange={e => set('revision', e.target.value)} />
          </Field>
        </div>
        <Field label="Title" required>
          <input required className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Discipline">
            <select className={inputCls} value={form.discipline} onChange={e => set('discipline', e.target.value)}>
              {DISCIPLINES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
              {DRAWING_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Scale">
            <input className={inputCls} placeholder="e.g. 1:100" value={form.scale} onChange={e => set('scale', e.target.value)} />
          </Field>
          <Field label="Issue Date">
            <input type="date" className={inputCls} value={form.issue_date || ''} onChange={e => set('issue_date', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Drawn By">
            <input className={inputCls} value={form.drawn_by} onChange={e => set('drawn_by', e.target.value)} />
          </Field>
          <Field label="Checked By">
            <input className={inputCls} value={form.checked_by} onChange={e => set('checked_by', e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className={inputCls} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
        <Field label="Upload File (PDF / DWG)">
          <input ref={fileRef} type="file" accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg"
            onChange={e => setFile(e.target.files[0])}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          {initial?.file_url && !file && (
            <a href={initial.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1">
              <ArrowDownTrayIcon className="h-3 w-3" /> Current file
            </a>
          )}
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg dark:border-gray-600 dark:text-gray-300">Cancel</button>
          <button type="submit" className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Save Drawing</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Drawings Tab ──────────────────────────────────────────────────────────────
function DrawingsTab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filterDisc, setFilterDisc] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['drawings', filterDisc, filterStatus, search],
    queryFn: () => getDrawings({ discipline: filterDisc || undefined, status: filterStatus || undefined, search: search || undefined, page_size: 100 }),
  })
  const drawings = data?.data?.results ?? data?.data ?? []

  const saveMut = useMutation({
    mutationFn: (fd) => editing ? updateDrawing(editing.id, fd) : createDrawing(fd),
    onSuccess: () => { qc.invalidateQueries(['drawings']); qc.invalidateQueries(['doc-dashboard']); setShowModal(false); setEditing(null); toast.success('Drawing saved') },
    onError: () => toast.error('Failed to save'),
  })

  const delMut = useMutation({
    mutationFn: deleteDrawing,
    onSuccess: () => { qc.invalidateQueries(['drawings']); qc.invalidateQueries(['doc-dashboard']); toast.success('Deleted') },
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input placeholder="Search drawings…" value={search} onChange={e => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-52 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        <select value={filterDisc} onChange={e => setFilterDisc(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
          <option value="">All Disciplines</option>
          {DISCIPLINES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
          <option value="">All Statuses</option>
          {DRAWING_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={() => { setEditing(null); setShowModal(true) }}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
          <PlusIcon className="h-4 w-4" /> Add Drawing
        </button>
      </div>

      {isLoading ? <p className="text-center py-12 text-gray-400">Loading…</p> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                {['No.', 'Rev', 'Title', 'Discipline', 'Status', 'Issue Date', 'Project', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {drawings.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No drawings found</td></tr>
              )}
              {drawings.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-mono font-medium text-gray-800 dark:text-gray-200">{d.drawing_number}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{d.revision}</td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200 max-w-xs truncate">{d.title}</td>
                  <td className="px-4 py-3 capitalize text-gray-500 dark:text-gray-400">{d.discipline?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3"><Badge text={d.status} colorMap={DRAWING_STATUS_COLORS} /></td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{d.issue_date || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[120px] truncate">{d.project_name || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {d.file_url && (
                        <a href={d.file_url} target="_blank" rel="noreferrer"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg" title="Download">
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </a>
                      )}
                      <button onClick={() => { setEditing(d); setShowModal(true) }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg">
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => { if (confirm('Delete this drawing?')) delMut.mutate(d.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <DrawingModal
          initial={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={(fd) => saveMut.mutate(fd)}
        />
      )}
    </div>
  )
}

// ── RFI Modal ─────────────────────────────────────────────────────────────────
function RFIModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    project_name: '', project_id: '', rfi_number: '', subject: '', description: '',
    raised_by: '', directed_to: '', date_raised: new Date().toISOString().slice(0, 10),
    response_due: '', response: '', responded_by: '', date_responded: '', status: 'open',
    ...(initial || {}),
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form }
    if (!payload.response_due) delete payload.response_due
    if (!payload.date_responded) delete payload.date_responded
    onSave(payload)
  }

  return (
    <Modal title={initial ? 'Edit RFI' : 'New RFI'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Project" required>
          <ProjectSelect value={form.project_id || ''} onChange={(name, id) => setForm(f => ({ ...f, project_name: name, project_id: id }))} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="RFI Number" required>
            <input required className={inputCls} placeholder="e.g. 001" value={form.rfi_number} onChange={e => set('rfi_number', e.target.value)} />
          </Field>
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
              {RFI_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Subject" required>
          <input required className={inputCls} value={form.subject} onChange={e => set('subject', e.target.value)} />
        </Field>
        <Field label="Description" required>
          <textarea required className={inputCls} rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Raised By">
            <input className={inputCls} value={form.raised_by} onChange={e => set('raised_by', e.target.value)} />
          </Field>
          <Field label="Directed To">
            <input className={inputCls} value={form.directed_to} onChange={e => set('directed_to', e.target.value)} />
          </Field>
          <Field label="Date Raised">
            <input type="date" className={inputCls} value={form.date_raised} onChange={e => set('date_raised', e.target.value)} />
          </Field>
          <Field label="Response Due">
            <input type="date" className={inputCls} value={form.response_due || ''} onChange={e => set('response_due', e.target.value)} />
          </Field>
        </div>
        {form.status !== 'open' && (
          <>
            <Field label="Response">
              <textarea className={inputCls} rows={3} value={form.response} onChange={e => set('response', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Responded By">
                <input className={inputCls} value={form.responded_by} onChange={e => set('responded_by', e.target.value)} />
              </Field>
              <Field label="Date Responded">
                <input type="date" className={inputCls} value={form.date_responded || ''} onChange={e => set('date_responded', e.target.value)} />
              </Field>
            </div>
          </>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg dark:border-gray-600 dark:text-gray-300">Cancel</button>
          <button type="submit" className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Save RFI</button>
        </div>
      </form>
    </Modal>
  )
}

// ── RFIs Tab ──────────────────────────────────────────────────────────────────
function RFIsTab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['rfis', filterStatus],
    queryFn: () => getRFIs({ status: filterStatus || undefined, page_size: 100 }),
  })
  const rfis = data?.data?.results ?? data?.data ?? []

  const saveMut = useMutation({
    mutationFn: (payload) => editing ? updateRFI(editing.id, payload) : createRFI(payload),
    onSuccess: () => { qc.invalidateQueries(['rfis']); qc.invalidateQueries(['doc-dashboard']); setShowModal(false); setEditing(null); toast.success('RFI saved') },
    onError: () => toast.error('Failed to save'),
  })

  const delMut = useMutation({
    mutationFn: deleteRFI,
    onSuccess: () => { qc.invalidateQueries(['rfis']); qc.invalidateQueries(['doc-dashboard']); toast.success('Deleted') },
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
          <option value="">All Statuses</option>
          {RFI_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={() => { setEditing(null); setShowModal(true) }}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
          <PlusIcon className="h-4 w-4" /> New RFI
        </button>
      </div>

      {isLoading ? <p className="text-center py-12 text-gray-400">Loading…</p> : (
        <div className="space-y-3">
          {rfis.length === 0 && <p className="text-center py-12 text-gray-400">No RFIs found</p>}
          {rfis.map(r => (
            <div key={r.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border dark:border-gray-700">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                      RFI-{r.rfi_number}
                    </span>
                    <Badge text={r.status} colorMap={RFI_STATUS_COLORS} />
                    {r.is_overdue && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                        <ExclamationTriangleIcon className="h-3 w-3" /> Overdue
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">{r.subject}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{r.project_name} · Raised: {r.date_raised} · Due: {r.response_due || '—'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{r.description}</p>
                  {r.response && (
                    <div className="mt-2 pl-3 border-l-2 border-green-400">
                      <p className="text-xs text-green-700 dark:text-green-400 font-medium">Response</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">{r.response}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setEditing(r); setShowModal(true) }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg">
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button onClick={() => { if (confirm('Delete this RFI?')) delMut.mutate(r.id) }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <RFIModal
          initial={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={(p) => saveMut.mutate(p)}
        />
      )}
    </div>
  )
}

// ── Submittal Modal ───────────────────────────────────────────────────────────
function SubmittalModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    project_name: '', project_id: '', submittal_number: '', title: '',
    submittal_type: 'material_sample', description: '', submitted_by: '',
    reviewer: '', date_submitted: new Date().toISOString().slice(0, 10),
    review_due: '', date_reviewed: '', status: 'submitted', review_comments: '',
    ...(initial || {}),
  })
  const [file, setFile] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) fd.append(k, v) })
    if (file) fd.append('file', file)
    onSave(fd)
  }

  return (
    <Modal title={initial ? 'Edit Submittal' : 'New Submittal'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Project" required>
          <ProjectSelect value={form.project_id || ''} onChange={(name, id) => setForm(f => ({ ...f, project_name: name, project_id: id }))} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Submittal Number" required>
            <input required className={inputCls} placeholder="e.g. 001" value={form.submittal_number} onChange={e => set('submittal_number', e.target.value)} />
          </Field>
          <Field label="Type">
            <select className={inputCls} value={form.submittal_type} onChange={e => set('submittal_type', e.target.value)}>
              {SUBMITTAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Title" required>
          <input required className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Submitted By">
            <input className={inputCls} value={form.submitted_by} onChange={e => set('submitted_by', e.target.value)} />
          </Field>
          <Field label="Reviewer">
            <input className={inputCls} value={form.reviewer} onChange={e => set('reviewer', e.target.value)} />
          </Field>
          <Field label="Date Submitted">
            <input type="date" className={inputCls} value={form.date_submitted} onChange={e => set('date_submitted', e.target.value)} />
          </Field>
          <Field label="Review Due">
            <input type="date" className={inputCls} value={form.review_due || ''} onChange={e => set('review_due', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
              {SUBMITTAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Date Reviewed">
            <input type="date" className={inputCls} value={form.date_reviewed || ''} onChange={e => set('date_reviewed', e.target.value)} />
          </Field>
        </div>
        <Field label="Review Comments">
          <textarea className={inputCls} rows={2} value={form.review_comments} onChange={e => set('review_comments', e.target.value)} />
        </Field>
        <Field label="Attach File">
          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"
            onChange={e => setFile(e.target.files[0])}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          {initial?.file_url && !file && (
            <a href={initial.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1">
              <ArrowDownTrayIcon className="h-3 w-3" /> Current file
            </a>
          )}
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg dark:border-gray-600 dark:text-gray-300">Cancel</button>
          <button type="submit" className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Save Submittal</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Submittals Tab ────────────────────────────────────────────────────────────
function SubmittalsTab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['submittals', filterStatus, filterType],
    queryFn: () => getSubmittals({ status: filterStatus || undefined, submittal_type: filterType || undefined, page_size: 100 }),
  })
  const submittals = data?.data?.results ?? data?.data ?? []

  const saveMut = useMutation({
    mutationFn: (fd) => editing ? updateSubmittal(editing.id, fd) : createSubmittal(fd),
    onSuccess: () => { qc.invalidateQueries(['submittals']); qc.invalidateQueries(['doc-dashboard']); setShowModal(false); setEditing(null); toast.success('Submittal saved') },
    onError: () => toast.error('Failed to save'),
  })

  const delMut = useMutation({
    mutationFn: deleteSubmittal,
    onSuccess: () => { qc.invalidateQueries(['submittals']); qc.invalidateQueries(['doc-dashboard']); toast.success('Deleted') },
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
          <option value="">All Types</option>
          {SUBMITTAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
          <option value="">All Statuses</option>
          {SUBMITTAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={() => { setEditing(null); setShowModal(true) }}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
          <PlusIcon className="h-4 w-4" /> New Submittal
        </button>
      </div>

      {isLoading ? <p className="text-center py-12 text-gray-400">Loading…</p> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                {['No.', 'Title', 'Type', 'Status', 'Submitted', 'Review Due', 'Reviewer', 'Project', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {submittals.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No submittals found</td></tr>
              )}
              {submittals.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-mono font-medium text-gray-800 dark:text-gray-200">{s.submittal_number}</td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200 max-w-[160px] truncate">{s.title}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize text-xs">{s.submittal_type?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Badge text={s.status} colorMap={SUB_STATUS_COLORS} />
                      {s.is_overdue && <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-500" title="Overdue" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{s.date_submitted}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{s.review_due || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{s.reviewer || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[120px] truncate">{s.project_name || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {s.file_url && (
                        <a href={s.file_url} target="_blank" rel="noreferrer"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg" title="Download">
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </a>
                      )}
                      <button onClick={() => { setEditing(s); setShowModal(true) }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg">
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => { if (confirm('Delete this submittal?')) delMut.mutate(s.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <SubmittalModal
          initial={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={(fd) => saveMut.mutate(fd)}
        />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const [tab, setTab] = useState('dashboard')

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Document Management</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Drawing register, RFIs, and submittals</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b dark:border-gray-700">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${tab === id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard'  && <DashboardTab />}
      {tab === 'drawings'   && <DrawingsTab />}
      {tab === 'rfis'       && <RFIsTab />}
      {tab === 'submittals' && <SubmittalsTab />}
    </div>
  )
}
