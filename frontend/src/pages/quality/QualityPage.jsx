import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  Squares2X2Icon, ClipboardDocumentCheckIcon, ExclamationCircleIcon,
  BeakerIcon, ListBulletIcon, PlusIcon, PencilIcon, TrashIcon, XMarkIcon,
  CheckCircleIcon, XCircleIcon, ClockIcon,
} from '@heroicons/react/24/outline'
import {
  getQCDashboard, getInspections, createInspection, updateInspection, deleteInspection,
  getNCRs, createNCR, updateNCR, deleteNCR,
  getMaterialTests, createMaterialTest, deleteMaterialTest,
  getPunchList, createPunchItem, updatePunchItem, deletePunchItem,
} from '../../api/quality'
import { getProjects } from '../../api/projects'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'earthworks', label: 'Earthworks' }, { value: 'concrete', label: 'Concrete' },
  { value: 'structural', label: 'Structural' }, { value: 'finishing', label: 'Finishing' },
  { value: 'electrical', label: 'Electrical' }, { value: 'plumbing', label: 'Plumbing' },
  { value: 'road', label: 'Road Works' }, { value: 'drainage', label: 'Drainage' },
  { value: 'general', label: 'General' }, { value: 'other', label: 'Other' },
]

const TEST_TYPES = [
  { value: 'concrete_cube', label: 'Concrete Cube Test' }, { value: 'compaction', label: 'Compaction Test' },
  { value: 'soil_cbr', label: 'Soil CBR' }, { value: 'aggregate', label: 'Aggregate Test' },
  { value: 'asphalt', label: 'Asphalt Test' }, { value: 'water', label: 'Water Quality' },
  { value: 'steel', label: 'Steel Test' }, { value: 'other', label: 'Other' },
]

const RESULT_CFG = {
  pass:        { label: 'Pass',             color: 'bg-green-100 text-green-700' },
  fail:        { label: 'Fail',             color: 'bg-red-100 text-red-700' },
  conditional: { label: 'Conditional Pass', color: 'bg-yellow-100 text-yellow-700' },
  pending:     { label: 'Pending',          color: 'bg-gray-100 text-gray-600' },
}

const NCR_STATUS_CFG = {
  open:      { label: 'Open',       color: 'bg-red-100 text-red-700' },
  in_review: { label: 'In Review',  color: 'bg-yellow-100 text-yellow-700' },
  closed:    { label: 'Closed',     color: 'bg-green-100 text-green-700' },
  voided:    { label: 'Voided',     color: 'bg-gray-100 text-gray-500' },
}

const NCR_SEVERITY_CFG = {
  minor:    { label: 'Minor',    color: 'bg-blue-100 text-blue-700' },
  major:    { label: 'Major',    color: 'bg-orange-100 text-orange-700' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 font-bold' },
}

const PUNCH_STATUS_CFG = {
  open:        { label: 'Open',        color: 'bg-red-100 text-red-700' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  closed:      { label: 'Closed',      color: 'bg-green-100 text-green-700' },
}

const PRIORITY_CFG = {
  low:      { label: 'Low',      color: 'bg-gray-100 text-gray-600' },
  medium:   { label: 'Medium',   color: 'bg-blue-100 text-blue-700' },
  high:     { label: 'High',     color: 'bg-orange-100 text-orange-700' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 font-bold' },
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-red focus:border-transparent'
const lbl = 'block text-xs font-medium text-gray-700 mb-1'

function Badge({ cfg }) {
  return cfg ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span> : null
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatCard({ label, value, color = 'text-brand-slate', sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ModalShell({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-brand-slate px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-white/70 hover:text-white" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">{children}</div>
        {footer && <div className="px-6 pb-5 flex justify-end gap-2 shrink-0 border-t border-gray-100 pt-4">{footer}</div>}
      </div>
    </div>
  )
}

function ProjectSelect({ value, onChange }) {
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => getProjects({ page_size: 200 }).then(r => {
      const d = r.data?.results ?? r.data ?? []
      return Array.isArray(d) ? d : []
    }),
  })
  return (
    <select className={inp} value={value} onChange={e => {
      const proj = projects.find(p => p.id === e.target.value)
      onChange(proj ? proj.name : '', e.target.value)
    }}>
      <option value="">— Select project —</option>
      {projects.map(p => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>)}
    </select>
  )
}

// ── Default checklist items per category ─────────────────────────────────────

const DEFAULT_CHECKLISTS = {
  concrete: [
    'Formwork checked and approved', 'Reinforcement placement verified',
    'Cover to steel confirmed', 'Concrete mix design approved',
    'Slump test done', 'Cube samples taken', 'Curing arrangement in place',
  ],
  earthworks: [
    'Layer thickness correct', 'Moisture content within range',
    'Compaction test done', 'Material approved', 'Subgrade level checked',
  ],
  road: [
    'Sub-base compaction verified', 'Base course thickness checked',
    'Surface level surveyed', 'Camber/crossfall correct', 'Drainage outlets clear',
  ],
  general: ['Work meets specification', 'Materials approved', 'Workmanship acceptable', 'Area clean and safe'],
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['qc-dashboard'],
    queryFn: () => getQCDashboard().then(r => r.data),
  })

  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>

  const passRate = data?.total_inspections > 0
    ? Math.round((data.passed / data.total_inspections) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Inspections" value={data?.total_inspections ?? 0} sub={`${data?.inspections_this_month ?? 0} this month`} />
        <StatCard label="Pass Rate" value={`${passRate}%`} color={passRate >= 80 ? 'text-green-600' : 'text-red-600'} sub={`${data?.passed ?? 0} passed / ${data?.failed ?? 0} failed`} />
        <StatCard label="Open NCRs" value={data?.open_ncrs ?? 0} color={data?.open_ncrs > 0 ? 'text-red-600' : 'text-green-600'} sub={data?.overdue_ncrs > 0 ? `${data.overdue_ncrs} overdue` : 'none overdue'} />
        <StatCard label="Open Punch Items" value={data?.open_punch_items ?? 0} color={data?.open_punch_items > 0 ? 'text-orange-600' : 'text-green-600'} sub={data?.overdue_punch > 0 ? `${data.overdue_punch} overdue` : undefined} />
        <StatCard label="Material Tests" value={data?.total_tests ?? 0} sub={`${data?.tests_passed ?? 0} passed / ${data?.tests_failed ?? 0} failed`} />
        <StatCard label="Closed NCRs" value={data?.closed_ncrs ?? 0} color="text-green-600" />
        <StatCard label="Closed Punch Items" value={data?.closed_punch ?? 0} color="text-green-600" />
        <StatCard label="Pass Target" value="≥80%" sub="industry standard" color="text-gray-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-brand-slate">Recent Inspections</h3>
          </div>
          {!data?.recent_inspections?.length
            ? <p className="p-4 text-xs text-gray-400 italic">No inspections recorded</p>
            : <div className="divide-y divide-gray-50">
                {data.recent_inspections.map(ins => (
                  <div key={ins.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-brand-slate truncate">{ins.activity_description}</p>
                      <p className="text-xs text-gray-400">{fmtDate(ins.inspection_date)} · {ins.inspector_name}</p>
                    </div>
                    <Badge cfg={RESULT_CFG[ins.result]} />
                  </div>
                ))}
              </div>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-brand-slate">Recent NCRs</h3>
          </div>
          {!data?.recent_ncrs?.length
            ? <p className="p-4 text-xs text-gray-400 italic">No NCRs raised</p>
            : <div className="divide-y divide-gray-50">
                {data.recent_ncrs.map(ncr => (
                  <div key={ncr.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-brand-slate truncate">{ncr.description}</p>
                      <p className="text-xs text-gray-400">{fmtDate(ncr.date_raised)}{ncr.ncr_number ? ` · NCR #${ncr.ncr_number}` : ''}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Badge cfg={NCR_SEVERITY_CFG[ncr.severity]} />
                      <Badge cfg={NCR_STATUS_CFG[ncr.status]} />
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      </div>

      {data?.by_category?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-brand-slate mb-3">Inspections by Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {data.by_category.map(row => {
              const max = Math.max(...data.by_category.map(r => r.count))
              return (
                <div key={row.category} className="text-center">
                  <div className="h-16 bg-gray-100 rounded-lg flex items-end overflow-hidden">
                    <div className="bg-brand-red w-full rounded-b-lg transition-all" style={{ height: `${(row.count / max) * 100}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{CATEGORIES.find(c => c.value === row.category)?.label || row.category}</p>
                  <p className="text-sm font-bold text-brand-slate">{row.count}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inspections Tab ───────────────────────────────────────────────────────────

function InspectionModal({ inspection, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!inspection
  const defaultItems = (cat) => (DEFAULT_CHECKLISTS[cat] || DEFAULT_CHECKLISTS.general).map(item => ({ item, result: 'pending', remarks: '' }))

  const [form, setForm] = useState({
    project_name: inspection?.project_name || '',
    project_id: inspection?.project_id || '',
    inspection_date: inspection?.inspection_date || new Date().toISOString().split('T')[0],
    category: inspection?.category || 'general',
    activity_description: inspection?.activity_description || '',
    location: inspection?.location || '',
    inspector_name: inspection?.inspector_name || '',
    result: inspection?.result || 'pending',
    checklist_items: inspection?.checklist_items?.length ? inspection.checklist_items : defaultItems('general'),
    observations: inspection?.observations || '',
    corrective_action: inspection?.corrective_action || '',
    approved_by: inspection?.approved_by || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCategoryChange = (cat) => {
    setForm(f => ({ ...f, category: cat, checklist_items: defaultItems(cat) }))
  }

  const setCheckItem = (i, field, val) => {
    setForm(f => {
      const items = [...f.checklist_items]
      items[i] = { ...items[i], [field]: val }
      return { ...f, checklist_items: items }
    })
  }

  const addCheckItem = () => setForm(f => ({ ...f, checklist_items: [...f.checklist_items, { item: '', result: 'pending', remarks: '' }] }))
  const removeCheckItem = (i) => setForm(f => ({ ...f, checklist_items: f.checklist_items.filter((_, idx) => idx !== i) }))

  const mut = useMutation({
    mutationFn: (data) => isEdit ? updateInspection(inspection.id, data) : createInspection(data),
    onSuccess: () => { qc.invalidateQueries(['qc-inspections']); qc.invalidateQueries(['qc-dashboard']); toast.success(isEdit ? 'Updated' : 'Inspection recorded'); onClose() },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <ModalShell title={isEdit ? 'Edit Inspection' : 'Record Inspection'} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Cancel</button>
        <button onClick={() => mut.mutate(form)} disabled={!form.activity_description || mut.isPending}
          className="px-4 py-2 text-sm bg-brand-red text-white rounded-lg font-medium disabled:opacity-50">
          {mut.isPending ? 'Saving…' : 'Save Inspection'}
        </button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={lbl}>Project</label><ProjectSelect value={form.project_id} onChange={(name, id) => setForm(f => ({ ...f, project_name: name, project_id: id }))} /></div>
        <div><label className={lbl}>Date *</label><input type="date" className={inp} value={form.inspection_date} onChange={e => set('inspection_date', e.target.value)} /></div>
        <div><label className={lbl}>Category</label>
          <select className={inp} value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="col-span-2"><label className={lbl}>Activity / Work Being Inspected *</label><input className={inp} value={form.activity_description} onChange={e => set('activity_description', e.target.value)} placeholder="e.g. Foundation concrete pour — Grid A3 to B5" /></div>
        <div><label className={lbl}>Location / Chainage</label><input className={inp} value={form.location} onChange={e => set('location', e.target.value)} /></div>
        <div><label className={lbl}>Inspector Name</label><input className={inp} value={form.inspector_name} onChange={e => set('inspector_name', e.target.value)} /></div>
        <div><label className={lbl}>Overall Result</label>
          <select className={inp} value={form.result} onChange={e => set('result', e.target.value)}>
            {Object.entries(RESULT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Approved By</label><input className={inp} value={form.approved_by} onChange={e => set('approved_by', e.target.value)} /></div>
      </div>

      {/* Checklist */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Checklist Items</label>
          <button onClick={addCheckItem} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"><PlusIcon className="h-3 w-3" /> Add Item</button>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Item</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium w-28">Result</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium w-32">Remarks</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {form.checklist_items.map((ci, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5"><input className="w-full border-0 bg-transparent text-xs focus:outline-none" value={ci.item} onChange={e => setCheckItem(i, 'item', e.target.value)} /></td>
                  <td className="px-3 py-1.5">
                    <select className="text-xs border border-gray-200 rounded px-2 py-1 w-full"
                      value={ci.result} onChange={e => setCheckItem(i, 'result', e.target.value)}>
                      <option value="pass">✓ Pass</option>
                      <option value="fail">✗ Fail</option>
                      <option value="na">N/A</option>
                      <option value="pending">Pending</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5"><input className="w-full border-0 bg-transparent text-xs focus:outline-none" value={ci.remarks} onChange={e => setCheckItem(i, 'remarks', e.target.value)} /></td>
                  <td className="px-2"><button onClick={() => removeCheckItem(i)} className="text-gray-300 hover:text-red-500"><XMarkIcon className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div><label className={lbl}>Observations</label><textarea rows={2} className={inp} value={form.observations} onChange={e => set('observations', e.target.value)} /></div>
      <div><label className={lbl}>Corrective Action Required</label><textarea rows={2} className={inp} value={form.corrective_action} onChange={e => set('corrective_action', e.target.value)} /></div>
    </ModalShell>
  )
}

function InspectionsTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['qc-inspections', search],
    queryFn: () => getInspections({ search: search || undefined }).then(r => { const d = r.data?.results ?? r.data ?? []; return Array.isArray(d) ? d : [] }),
  })
  const delMut = useMutation({ mutationFn: deleteInspection, onSuccess: () => { qc.invalidateQueries(['qc-inspections']); qc.invalidateQueries(['qc-dashboard']) } })

  return (
    <div className="space-y-4">
      {modal === 'add'  && <InspectionModal onClose={() => setModal(null)} />}
      {modal === 'edit' && <InspectionModal inspection={editing} onClose={() => { setModal(null); setEditing(null) }} />}
      <div className="flex items-center justify-between gap-3">
        <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72" placeholder="Search inspections…" value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={() => setModal('add')} className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium"><PlusIcon className="h-4 w-4" /> Record Inspection</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          : items.length === 0 ? <div className="p-12 text-center text-sm text-gray-400">No inspections recorded</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Date', 'Activity / Work', 'Category', 'Location', 'Inspector', 'Result', ''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(ins => (
                  <tr key={ins.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmtDate(ins.inspection_date)}</td>
                    <td className="px-4 py-3 font-medium text-brand-slate max-w-xs truncate">{ins.activity_description}</td>
                    <td className="px-4 py-3 text-gray-600">{CATEGORIES.find(c => c.value === ins.category)?.label}</td>
                    <td className="px-4 py-3 text-gray-500">{ins.location || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{ins.inspector_name || '—'}</td>
                    <td className="px-4 py-3"><Badge cfg={RESULT_CFG[ins.result]} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { setEditing(ins); setModal('edit') }} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"><PencilIcon className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { if (window.confirm('Delete?')) delMut.mutate(ins.id) }} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}

// ── NCR Tab ───────────────────────────────────────────────────────────────────

function NCRModal({ ncr, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!ncr
  const [form, setForm] = useState({
    project_name: ncr?.project_name || '', project_id: ncr?.project_id || '',
    ncr_number: ncr?.ncr_number || '', date_raised: ncr?.date_raised || new Date().toISOString().split('T')[0],
    location: ncr?.location || '', description: ncr?.description || '',
    severity: ncr?.severity || 'minor', root_cause: ncr?.root_cause || '',
    corrective_action: ncr?.corrective_action || '', action_due: ncr?.action_due || '',
    status: ncr?.status || 'open', raised_by: ncr?.raised_by || '', closed_by: ncr?.closed_by || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const mut = useMutation({
    mutationFn: (data) => isEdit ? updateNCR(ncr.id, data) : createNCR(data),
    onSuccess: () => { qc.invalidateQueries(['qc-ncrs']); qc.invalidateQueries(['qc-dashboard']); toast.success('NCR saved'); onClose() },
  })

  return (
    <ModalShell title={isEdit ? 'Edit NCR' : 'Raise NCR'} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Cancel</button>
        <button onClick={() => mut.mutate(form)} disabled={!form.description || mut.isPending}
          className="px-4 py-2 text-sm bg-brand-red text-white rounded-lg font-medium disabled:opacity-50">
          {mut.isPending ? 'Saving…' : 'Save NCR'}
        </button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={lbl}>Project</label><ProjectSelect value={form.project_id} onChange={(name, id) => setForm(f => ({ ...f, project_name: name, project_id: id }))} /></div>
        <div><label className={lbl}>NCR Number</label><input className={inp} value={form.ncr_number} onChange={e => set('ncr_number', e.target.value)} placeholder="e.g. NCR-001" /></div>
        <div><label className={lbl}>Date Raised</label><input type="date" className={inp} value={form.date_raised} onChange={e => set('date_raised', e.target.value)} /></div>
        <div className="col-span-2"><label className={lbl}>Location</label><input className={inp} value={form.location} onChange={e => set('location', e.target.value)} /></div>
        <div className="col-span-2"><label className={lbl}>Description of Non-Conformance *</label><textarea rows={3} className={inp} value={form.description} onChange={e => set('description', e.target.value)} /></div>
        <div><label className={lbl}>Severity</label>
          <select className={inp} value={form.severity} onChange={e => set('severity', e.target.value)}>
            {Object.entries(NCR_SEVERITY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Status</label>
          <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(NCR_STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Raised By</label><input className={inp} value={form.raised_by} onChange={e => set('raised_by', e.target.value)} /></div>
        <div><label className={lbl}>Action Due Date</label><input type="date" className={inp} value={form.action_due} onChange={e => set('action_due', e.target.value)} /></div>
        <div className="col-span-2"><label className={lbl}>Root Cause</label><textarea rows={2} className={inp} value={form.root_cause} onChange={e => set('root_cause', e.target.value)} /></div>
        <div className="col-span-2"><label className={lbl}>Corrective Action</label><textarea rows={2} className={inp} value={form.corrective_action} onChange={e => set('corrective_action', e.target.value)} /></div>
        {form.status === 'closed' && <div><label className={lbl}>Closed By</label><input className={inp} value={form.closed_by} onChange={e => set('closed_by', e.target.value)} /></div>}
      </div>
    </ModalShell>
  )
}

function NCRTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [editing, setEditing] = useState(null)
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['qc-ncrs'],
    queryFn: () => getNCRs().then(r => { const d = r.data?.results ?? r.data ?? []; return Array.isArray(d) ? d : [] }),
  })
  const delMut = useMutation({ mutationFn: deleteNCR, onSuccess: () => { qc.invalidateQueries(['qc-ncrs']); qc.invalidateQueries(['qc-dashboard']) } })

  return (
    <div className="space-y-4">
      {modal === 'add'  && <NCRModal onClose={() => setModal(null)} />}
      {modal === 'edit' && <NCRModal ncr={editing} onClose={() => { setModal(null); setEditing(null) }} />}
      <div className="flex justify-end">
        <button onClick={() => setModal('add')} className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium"><PlusIcon className="h-4 w-4" /> Raise NCR</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          : items.length === 0 ? <div className="p-12 text-center text-sm text-gray-400">No NCRs raised</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['NCR #', 'Date', 'Description', 'Location', 'Severity', 'Action Due', 'Status', ''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(n => (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{n.ncr_number || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmtDate(n.date_raised)}</td>
                    <td className="px-4 py-3 font-medium text-brand-slate max-w-xs truncate">{n.description}</td>
                    <td className="px-4 py-3 text-gray-500">{n.location || '—'}</td>
                    <td className="px-4 py-3"><Badge cfg={NCR_SEVERITY_CFG[n.severity]} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={n.is_overdue && n.status !== 'closed' ? 'text-red-600 font-medium' : 'text-gray-600'}>{fmtDate(n.action_due)}</span>
                    </td>
                    <td className="px-4 py-3"><Badge cfg={NCR_STATUS_CFG[n.status]} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { setEditing(n); setModal('edit') }} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"><PencilIcon className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { if (window.confirm('Delete?')) delMut.mutate(n.id) }} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}

// ── Material Tests Tab ────────────────────────────────────────────────────────

function TestModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    project_name: '', project_id: '', test_type: 'concrete_cube', sample_id: '',
    test_date: new Date().toISOString().split('T')[0], location: '', tested_by: '',
    lab_name: '', result: 'pending', value_obtained: '', required_value: '', unit: '', notes: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const mut = useMutation({
    mutationFn: createMaterialTest,
    onSuccess: () => { qc.invalidateQueries(['qc-tests']); qc.invalidateQueries(['qc-dashboard']); toast.success('Test recorded'); onClose() },
  })

  return (
    <ModalShell title="Record Material Test" onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Cancel</button>
        <button onClick={() => mut.mutate(form)} disabled={mut.isPending}
          className="px-4 py-2 text-sm bg-brand-red text-white rounded-lg font-medium disabled:opacity-50">{mut.isPending ? 'Saving…' : 'Save'}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={lbl}>Project</label><ProjectSelect value={form.project_id} onChange={(name, id) => setForm(f => ({ ...f, project_name: name, project_id: id }))} /></div>
        <div><label className={lbl}>Test Type</label>
          <select className={inp} value={form.test_type} onChange={e => set('test_type', e.target.value)}>
            {TEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Sample ID / Reference</label><input className={inp} value={form.sample_id} onChange={e => set('sample_id', e.target.value)} placeholder="e.g. C01-28DAY" /></div>
        <div><label className={lbl}>Test Date</label><input type="date" className={inp} value={form.test_date} onChange={e => set('test_date', e.target.value)} /></div>
        <div><label className={lbl}>Location</label><input className={inp} value={form.location} onChange={e => set('location', e.target.value)} /></div>
        <div><label className={lbl}>Tested By</label><input className={inp} value={form.tested_by} onChange={e => set('tested_by', e.target.value)} /></div>
        <div><label className={lbl}>Lab Name</label><input className={inp} value={form.lab_name} onChange={e => set('lab_name', e.target.value)} /></div>
        <div><label className={lbl}>Value Obtained</label><input className={inp} value={form.value_obtained} onChange={e => set('value_obtained', e.target.value)} placeholder="e.g. 28.5" /></div>
        <div><label className={lbl}>Required Value</label><input className={inp} value={form.required_value} onChange={e => set('required_value', e.target.value)} placeholder="e.g. 25.0" /></div>
        <div><label className={lbl}>Unit</label><input className={inp} value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="e.g. N/mm²" /></div>
        <div><label className={lbl}>Result</label>
          <select className={inp} value={form.result} onChange={e => set('result', e.target.value)}>
            <option value="pass">Pass</option><option value="fail">Fail</option><option value="pending">Pending</option>
          </select>
        </div>
        <div className="col-span-2"><label className={lbl}>Notes</label><textarea rows={2} className={inp} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
      </div>
    </ModalShell>
  )
}

function MaterialTestsTab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['qc-tests'],
    queryFn: () => getMaterialTests().then(r => { const d = r.data?.results ?? r.data ?? []; return Array.isArray(d) ? d : [] }),
  })
  const delMut = useMutation({ mutationFn: deleteMaterialTest, onSuccess: () => { qc.invalidateQueries(['qc-tests']); qc.invalidateQueries(['qc-dashboard']) } })

  return (
    <div className="space-y-4">
      {showModal && <TestModal onClose={() => setShowModal(false)} />}
      <div className="flex justify-end">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium"><PlusIcon className="h-4 w-4" /> Record Test</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          : items.length === 0 ? <div className="p-12 text-center text-sm text-gray-400">No material tests recorded</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Date', 'Test Type', 'Sample ID', 'Location', 'Obtained', 'Required', 'Unit', 'Result', ''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmtDate(t.test_date)}</td>
                    <td className="px-4 py-3 text-gray-600">{TEST_TYPES.find(tt => tt.value === t.test_type)?.label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{t.sample_id || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{t.location || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-brand-slate">{t.value_obtained || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{t.required_value || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{t.unit || '—'}</td>
                    <td className="px-4 py-3"><Badge cfg={RESULT_CFG[t.result]} /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => { if (window.confirm('Delete?')) delMut.mutate(t.id) }} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}

// ── Punch List Tab ────────────────────────────────────────────────────────────

function PunchModal({ item, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!item
  const [form, setForm] = useState({
    project_name: item?.project_name || '', project_id: item?.project_id || '',
    item_number: item?.item_number || '', location: item?.location || '',
    description: item?.description || '', priority: item?.priority || 'medium',
    status: item?.status || 'open', assigned_to: item?.assigned_to || '',
    due_date: item?.due_date || '', remarks: item?.remarks || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const mut = useMutation({
    mutationFn: (data) => isEdit ? updatePunchItem(item.id, data) : createPunchItem(data),
    onSuccess: () => { qc.invalidateQueries(['qc-punch']); qc.invalidateQueries(['qc-dashboard']); toast.success('Saved'); onClose() },
  })

  return (
    <ModalShell title={isEdit ? 'Edit Punch Item' : 'Add Punch Item'} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Cancel</button>
        <button onClick={() => mut.mutate(form)} disabled={!form.description || mut.isPending}
          className="px-4 py-2 text-sm bg-brand-red text-white rounded-lg font-medium disabled:opacity-50">{mut.isPending ? 'Saving…' : 'Save'}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={lbl}>Project</label><ProjectSelect value={form.project_id} onChange={(name, id) => setForm(f => ({ ...f, project_name: name, project_id: id }))} /></div>
        <div><label className={lbl}>Item #</label><input className={inp} value={form.item_number} onChange={e => set('item_number', e.target.value)} placeholder="e.g. PL-001" /></div>
        <div><label className={lbl}>Location</label><input className={inp} value={form.location} onChange={e => set('location', e.target.value)} /></div>
        <div className="col-span-2"><label className={lbl}>Description *</label><textarea rows={2} className={inp} value={form.description} onChange={e => set('description', e.target.value)} /></div>
        <div><label className={lbl}>Priority</label>
          <select className={inp} value={form.priority} onChange={e => set('priority', e.target.value)}>
            {Object.entries(PRIORITY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Status</label>
          <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(PUNCH_STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Assigned To</label><input className={inp} value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} /></div>
        <div><label className={lbl}>Due Date</label><input type="date" className={inp} value={form.due_date} onChange={e => set('due_date', e.target.value)} /></div>
        <div className="col-span-2"><label className={lbl}>Remarks</label><textarea rows={2} className={inp} value={form.remarks} onChange={e => set('remarks', e.target.value)} /></div>
      </div>
    </ModalShell>
  )
}

function PunchListTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [editing, setEditing] = useState(null)
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['qc-punch'],
    queryFn: () => getPunchList().then(r => { const d = r.data?.results ?? r.data ?? []; return Array.isArray(d) ? d : [] }),
  })
  const delMut = useMutation({ mutationFn: deletePunchItem, onSuccess: () => { qc.invalidateQueries(['qc-punch']); qc.invalidateQueries(['qc-dashboard']) } })
  const closeMut = useMutation({
    mutationFn: (id) => updatePunchItem(id, { status: 'closed', closed_date: new Date().toISOString().split('T')[0] }),
    onSuccess: () => qc.invalidateQueries(['qc-punch']),
  })

  const open = items.filter(i => i.status !== 'closed')
  const closed = items.filter(i => i.status === 'closed')

  return (
    <div className="space-y-4">
      {modal === 'add'  && <PunchModal onClose={() => setModal(null)} />}
      {modal === 'edit' && <PunchModal item={editing} onClose={() => { setModal(null); setEditing(null) }} />}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{open.length} open · {closed.length} closed</p>
        <button onClick={() => setModal('add')} className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium"><PlusIcon className="h-4 w-4" /> Add Item</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          : items.length === 0 ? <div className="p-12 text-center text-sm text-gray-400">No punch list items</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['#', 'Description', 'Location', 'Priority', 'Assigned To', 'Due Date', 'Status', ''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(p => (
                  <tr key={p.id} className={`hover:bg-gray-50 ${p.status === 'closed' ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.item_number || '—'}</td>
                    <td className="px-4 py-3 font-medium text-brand-slate max-w-xs truncate">{p.description}</td>
                    <td className="px-4 py-3 text-gray-500">{p.location || '—'}</td>
                    <td className="px-4 py-3"><Badge cfg={PRIORITY_CFG[p.priority]} /></td>
                    <td className="px-4 py-3 text-gray-600">{p.assigned_to || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={p.is_overdue && p.status !== 'closed' ? 'text-red-600 font-medium' : 'text-gray-600'}>{fmtDate(p.due_date)}</span>
                    </td>
                    <td className="px-4 py-3"><Badge cfg={PUNCH_STATUS_CFG[p.status]} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        {p.status !== 'closed' && (
                          <button onClick={() => closeMut.mutate(p.id)} title="Mark closed"
                            className="p-1.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50"><CheckCircleIcon className="h-3.5 w-3.5" /></button>
                        )}
                        <button onClick={() => { setEditing(p); setModal('edit') }} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"><PencilIcon className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { if (window.confirm('Delete?')) delMut.mutate(p.id) }} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}

// ── Main QC Page ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'dashboard',   label: 'Dashboard',      Icon: Squares2X2Icon },
  { id: 'inspections', label: 'Inspections',     Icon: ClipboardDocumentCheckIcon },
  { id: 'ncrs',        label: 'NCRs',            Icon: ExclamationCircleIcon },
  { id: 'tests',       label: 'Material Tests',  Icon: BeakerIcon },
  { id: 'punch',       label: 'Punch List',      Icon: ListBulletIcon },
]

export default function QualityPage() {
  const [tab, setTab] = useState('dashboard')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-slate">Quality Control</h1>
        <p className="text-sm text-gray-500 mt-0.5">Inspections · NCRs · Material Tests · Punch List</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors
              ${tab === id ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-brand-slate hover:border-gray-300'}`}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard'   && <DashboardTab />}
      {tab === 'inspections' && <InspectionsTab />}
      {tab === 'ncrs'        && <NCRTab />}
      {tab === 'tests'       && <MaterialTestsTab />}
      {tab === 'punch'       && <PunchListTab />}
    </div>
  )
}
