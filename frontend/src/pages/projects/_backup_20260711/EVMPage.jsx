import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  PlusIcon, XMarkIcon, PencilIcon, TrashIcon,
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { getEVM, getVariationOrders, createVariationOrder, updateVariationOrder, deleteVariationOrder } from '../../api/projects'

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-red focus:border-transparent'
const lbl = 'block text-xs font-medium text-gray-700 mb-1'

const fmt  = (n, dec = 0) => n == null ? '—' : `KES ${Number(n).toLocaleString('en-KE', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
const fmtM = (n) => n == null ? '—' : `${Number(n).toLocaleString('en-KE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
const pct  = (n) => n == null ? '—' : `${Number(n).toFixed(1)}%`
const idx  = (n) => n == null ? '—' : Number(n).toFixed(2)

const VO_TYPES = [
  { value: 'addition',       label: 'Addition' },
  { value: 'omission',       label: 'Omission' },
  { value: 'substitution',   label: 'Substitution' },
  { value: 'time_extension', label: 'Time Extension' },
]
const VO_STATUSES = [
  { value: 'draft',       label: 'Draft' },
  { value: 'submitted',   label: 'Submitted' },
  { value: 'approved',    label: 'Approved' },
  { value: 'rejected',    label: 'Rejected' },
  { value: 'implemented', label: 'Implemented' },
]
const VO_STATUS_COLORS = {
  draft:       'bg-gray-100 text-gray-600',
  submitted:   'bg-blue-100 text-blue-700',
  approved:    'bg-green-100 text-green-700',
  rejected:    'bg-red-100 text-red-700',
  implemented: 'bg-purple-100 text-purple-700',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function healthColor(cpi) {
  if (cpi == null) return 'text-gray-400'
  if (cpi >= 1)   return 'text-green-600'
  if (cpi >= 0.9) return 'text-amber-600'
  return 'text-red-600'
}

function IndexPill({ value, label }) {
  const n = Number(value)
  const good = n >= 1
  const warn = n >= 0.9
  const cls = good ? 'bg-green-100 text-green-700' : warn ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      {good ? <ArrowTrendingUpIcon className="h-3 w-3" /> : <ArrowTrendingDownIcon className="h-3 w-3" />}
      {label} {idx(value)}
    </span>
  )
}

function MetricCard({ label, value, sub, highlight, note }) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${highlight ? 'border-brand-red' : 'border-gray-200'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-brand-red' : 'text-brand-slate'}`}>{value}</p>
      {sub  && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      {note && <p className={`text-xs mt-1 font-medium ${note.startsWith('+') ? 'text-green-600' : note.startsWith('−') ? 'text-red-600' : 'text-gray-500'}`}>{note}</p>}
    </div>
  )
}

// ── Bar chart (inline SVG) ────────────────────────────────────────────────────
function BudgetActualChart({ byCategory }) {
  const entries = Object.entries(byCategory).filter(([, v]) => v.planned > 0 || v.actual > 0)
  if (entries.length === 0) return <p className="text-xs text-gray-400 py-4 text-center">No budget data</p>
  const maxVal = Math.max(...entries.flatMap(([, v]) => [v.planned, v.actual]))
  const W = 100 / entries.length

  return (
    <div className="mt-4">
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {entries.map(([cat, v]) => (
          <div key={cat} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full flex items-end gap-0.5" style={{ height: 100 }}>
              <div className="flex-1 bg-blue-200 rounded-t-sm" style={{ height: `${maxVal > 0 ? (v.planned / maxVal) * 100 : 0}%` }} title={`Planned: ${fmt(v.planned)}`} />
              <div className="flex-1 bg-brand-red rounded-t-sm opacity-80" style={{ height: `${maxVal > 0 ? (v.actual / maxVal) * 100 : 0}%` }} title={`Actual: ${fmt(v.actual)}`} />
            </div>
            <p className="text-[10px] text-gray-500 text-center capitalize leading-tight">{cat}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-3 rounded-sm bg-blue-200 inline-block" /> Planned</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-3 rounded-sm bg-brand-red inline-block opacity-80" /> Actual</span>
      </div>
    </div>
  )
}

// ── VO Modal ──────────────────────────────────────────────────────────────────
function VOModal({ initial, projectId, onClose, onSave }) {
  const [form, setForm] = useState({
    title: '', description: '', vo_type: 'addition', status: 'draft',
    amount: '', submitted_date: '', approved_date: '',
    ...(initial || {}),
    amount: initial ? String(initial.amount) : '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-brand-slate px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-white">{initial ? 'Edit Variation Order' : 'New Variation Order'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><XMarkIcon className="h-5 w-5 text-white" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div><label className={lbl}>Title *</label><input required className={inp} value={form.title} onChange={e => set('title', e.target.value)} /></div>
          <div><label className={lbl}>Description</label><textarea className={inp} rows={3} value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Type</label>
              <select className={inp} value={form.vo_type} onChange={e => set('vo_type', e.target.value)}>
                {VO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                {VO_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Amount (KES) *</label>
              <input type="number" step="0.01" className={inp} value={form.amount} onChange={e => set('amount', e.target.value)}
                placeholder="Positive = addition, negative = omission" />
            </div>
            <div>
              <label className={lbl}>Submitted Date</label>
              <input type="date" className={inp} value={form.submitted_date || ''} onChange={e => set('submitted_date', e.target.value)} />
            </div>
            {['approved','implemented'].includes(form.status) && (
              <div>
                <label className={lbl}>Approved Date</label>
                <input type="date" className={inp} value={form.approved_date || ''} onChange={e => set('approved_date', e.target.value)} />
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSave({ ...form, amount: Number(form.amount) || 0, submitted_date: form.submitted_date || null, approved_date: form.approved_date || null })}
            disabled={!form.title || !form.amount}
            className="px-4 py-2 text-sm bg-brand-red text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── EVM Page ──────────────────────────────────────────────────────────────────
export default function EVMPage() {
  const { projectId } = useParams()
  const qc = useQueryClient()
  const [showVOModal, setShowVOModal] = useState(false)
  const [editingVO, setEditingVO] = useState(null)

  const { data: evmData, isLoading } = useQuery({
    queryKey: ['evm', projectId],
    queryFn: () => getEVM(projectId),
    select: r => r.data,
  })

  const { data: vos = [] } = useQuery({
    queryKey: ['variation-orders', projectId],
    queryFn: () => getVariationOrders(projectId),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const saveMut = useMutation({
    mutationFn: d => editingVO
      ? updateVariationOrder(projectId, editingVO.id, d)
      : createVariationOrder(projectId, d),
    onSuccess: () => {
      qc.invalidateQueries(['variation-orders', projectId])
      qc.invalidateQueries(['evm', projectId])
      setShowVOModal(false); setEditingVO(null)
      toast.success('Saved')
    },
    onError: () => toast.error('Failed to save'),
  })

  const delMut = useMutation({
    mutationFn: id => deleteVariationOrder(projectId, id),
    onSuccess: () => { qc.invalidateQueries(['variation-orders', projectId]); qc.invalidateQueries(['evm', projectId]); toast.success('Deleted') },
  })

  if (isLoading) return <p className="text-center py-16 text-gray-400">Loading EVM data…</p>
  if (!evmData)  return <p className="text-center py-16 text-gray-400">No data available</p>

  const { evm, revenue, costs, variation_orders: voSummary, project: proj } = evmData
  const hasBudget = evm.bac > 0
  const hasActuals = evm.ac > 0

  const cvPos = evm.cv >= 0
  const svPos = evm.sv >= 0

  return (
    <div className="space-y-6">

      {/* ── EVM Metrics ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-brand-slate text-sm">Earned Value Metrics</h3>
          <div className="flex gap-2">
            {evm.cpi != null && <IndexPill value={evm.cpi} label="CPI" />}
            {evm.spi != null && <IndexPill value={evm.spi} label="SPI" />}
          </div>
        </div>

        {!hasBudget && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800 mb-4">
            No approved budget found. Approve a budget to enable full EVM analysis.
            PV and BAC will be zero until a budget is approved.
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Budget at Completion (BAC)" value={fmt(evm.bac)} sub="Approved baseline cost" />
          <MetricCard label="Planned Value (PV)" value={fmt(evm.pv)} sub="Should have spent to date" />
          <MetricCard label="Earned Value (EV)" value={fmt(evm.ev)} sub="Certified work to date" />
          <MetricCard label="Actual Cost (AC)" value={fmt(evm.ac)} sub="Costs incurred to date" highlight />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <MetricCard
            label="Cost Variance (CV)"
            value={fmt(evm.cv)}
            note={cvPos ? `+ Under budget` : `− Over budget`}
            sub={`EV − AC`}
          />
          <MetricCard
            label="Schedule Variance (SV)"
            value={fmt(evm.sv)}
            note={svPos ? `+ Ahead of schedule` : `− Behind schedule`}
            sub={`EV − PV`}
          />
          <MetricCard label="Estimate at Completion (EAC)" value={fmt(evm.eac)} sub="Projected final cost" />
          <MetricCard label="Variance at Completion (VAC)" value={fmt(evm.vac)} sub="BAC − EAC"
            note={evm.vac >= 0 ? '+ Projected under budget' : '− Projected over budget'} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <MetricCard label="% Complete" value={pct(evm.pct_complete)} sub="EV / BAC" />
          <MetricCard label="TCPI" value={idx(evm.tcpi)} sub="Efficiency needed to finish on budget" />
          <MetricCard label="CPI" value={idx(evm.cpi)} sub={evm.cpi >= 1 ? 'Cost efficient' : 'Cost overrun trend'} />
          <MetricCard label="SPI" value={idx(evm.spi)} sub={evm.spi >= 1 ? 'On / ahead of schedule' : 'Behind schedule'} />
        </div>
      </div>

      {/* ── Revenue & Contract ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Revenue (IPC Summary)</h3>
          <div className="space-y-3">
            {[
              { label: 'Contract Value',          value: fmt(revenue.contract_value) },
              { label: 'Revised Contract Value',  value: fmt(proj.revised_contract_value), note: voSummary.approved_amount > 0 ? `+${fmt(voSummary.approved_amount)} approved VOs` : null },
              { label: 'Claimed to Date',         value: fmt(revenue.claimed),    sub: `${revenue.ipc_count} IPCs submitted` },
              { label: 'Certified to Date (EV)',  value: fmt(revenue.certified) },
              { label: 'Paid to Date',            value: fmt(revenue.paid) },
              { label: 'Outstanding (Cert − Paid)', value: fmt(revenue.certified - revenue.paid) },
            ].map(({ label, value, sub, note }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-xs text-gray-600">{label}</p>
                  {sub  && <p className="text-[10px] text-gray-400">{sub}</p>}
                  {note && <p className="text-[10px] text-green-600">{note}</p>}
                </div>
                <p className="text-sm font-semibold text-brand-slate">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Cost breakdown ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-1">Budget vs Actual by Category</h3>
          <p className="text-xs text-gray-400 mb-2">Blue = Planned · Red = Actual (from Weekly Progress)</p>
          <BudgetActualChart byCategory={costs.by_category} />
          <div className="mt-4 pt-3 border-t border-gray-100 space-y-1">
            {Object.entries(costs.by_category).map(([cat, v]) => (
              <div key={cat} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 capitalize">{cat}</span>
                <span className="text-gray-500">{fmt(v.planned)} planned · <span className={v.actual > v.planned ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>{fmt(v.actual)} actual</span></span>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs font-semibold pt-1 border-t border-gray-100 mt-1">
              <span className="text-brand-slate">Total Actual Cost</span>
              <span className="text-brand-slate">{fmt(costs.ac_weekly)}</span>
            </div>
            {costs.bills_total > 0 && (
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Finance — Bills (AP)</span>
                <span>{fmt(costs.bills_total)}</span>
              </div>
            )}
            {costs.expenses_total > 0 && (
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Finance — Approved Expenses</span>
                <span>{fmt(costs.expenses_total)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Variation Orders ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-brand-slate text-sm">Variation Orders</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {voSummary.count} VOs · Total {fmt(voSummary.total_amount)} · Approved {fmt(voSummary.approved_amount)}
            </p>
          </div>
          <button onClick={() => { setEditingVO(null); setShowVOModal(true) }}
            className="flex items-center gap-2 px-3 py-2 bg-brand-red text-white rounded-lg text-xs font-medium hover:bg-red-700">
            <PlusIcon className="h-3.5 w-3.5" /> New VO
          </button>
        </div>

        {vos.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No variation orders recorded</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['VO No.', 'Title', 'Type', 'Amount', 'Submitted', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vos.map(vo => (
                <tr key={vo.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-brand-red font-semibold">{vo.vo_number}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-brand-slate">{vo.title}</p>
                    {vo.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{vo.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 capitalize">{vo.vo_type?.replace(/_/g, ' ')}</td>
                  <td className={`px-4 py-3 font-semibold text-sm ${Number(vo.amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Number(vo.amount) >= 0 ? '+' : ''}{fmt(vo.amount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{vo.submitted_date || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${VO_STATUS_COLORS[vo.status] || 'bg-gray-100 text-gray-600'}`}>
                      {vo.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingVO(vo); setShowVOModal(true) }}
                        className="p-1.5 text-gray-400 hover:text-brand-slate hover:bg-gray-100 rounded-lg">
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => { if (confirm('Delete this variation order?')) delMut.mutate(vo.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showVOModal && (
        <VOModal
          initial={editingVO}
          projectId={projectId}
          onClose={() => { setShowVOModal(false); setEditingVO(null) }}
          onSave={d => saveMut.mutate(d)}
        />
      )}
    </div>
  )
}
