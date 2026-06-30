import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getPRs, getPOs, getSuppliers, createSupplier } from '../../api/procurement'
import {
  PlusIcon,
  ShoppingBagIcon,
  MagnifyingGlassIcon,
  BuildingStorefrontIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

// ── Status config ─────────────────────────────────────────────────────────────

const PR_STATUS_COLORS = {
  draft:              'bg-gray-100 text-gray-600',
  pending:            'bg-amber-100 text-amber-700',
  dept_approved:      'bg-blue-100 text-blue-700',
  procurement_review: 'bg-purple-100 text-purple-700',
  finance_approved:   'bg-teal-100 text-teal-700',
  md_approved:        'bg-green-100 text-green-700',
  rejected:           'bg-red-100 text-red-700',
  converted:          'bg-slate-100 text-slate-600',
}

const PR_STATUSES = [
  { value: '', label: 'All' },
  { value: 'draft',              label: 'Draft' },
  { value: 'pending',            label: 'Pending' },
  { value: 'dept_approved',      label: 'Dept Approved' },
  { value: 'procurement_review', label: 'Procurement Review' },
  { value: 'finance_approved',   label: 'Finance Approved' },
  { value: 'md_approved',        label: 'MD Approved' },
  { value: 'rejected',           label: 'Rejected' },
  { value: 'converted',          label: 'Converted' },
]

const PO_STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  approved:  'bg-blue-100 text-blue-700',
  sent:      'bg-purple-100 text-purple-700',
  partial:   'bg-amber-100 text-amber-700',
  received:  'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const PO_STATUSES = [
  { value: '', label: 'All' },
  { value: 'draft',     label: 'Draft' },
  { value: 'approved',  label: 'Approved' },
  { value: 'sent',      label: 'Sent' },
  { value: 'partial',   label: 'Partial' },
  { value: 'received',  label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
]

const SUPPLIER_STATUS_COLORS = {
  pending:    'bg-amber-100 text-amber-700',
  active:     'bg-green-100 text-green-700',
  blacklisted:'bg-red-100 text-red-700',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status, colorMap }) {
  const cls = colorMap[status] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  )
}

function FilterBar({ statuses, value, onChange, search, onSearch, placeholder }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4 items-center">
      <div className="relative">
        <MagnifyingGlassIcon className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder={placeholder}
          className="pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red"
        />
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red bg-white"
      >
        {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </div>
  )
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="py-16 text-center">
      <Icon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-600 text-sm">{message}</p>
    </div>
  )
}

function SkeletonRows({ cols = 6 }) {
  return Array.from({ length: 5 }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j} className="px-4 py-3">
          <div className="h-3 bg-gray-100 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  ))
}

// ── Add Supplier Modal ────────────────────────────────────────────────────────

function AddSupplierModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    company_name: '', kra_pin: '', vat_number: '', contact_person: '',
    email: '', phone: '', payment_terms: '', supply_categories: '',
  })

  const mutation = useMutation({
    mutationFn: (d) => createSupplier(d),
    onSuccess: () => {
      toast.success('Supplier added')
      qc.invalidateQueries(['suppliers'])
      onClose()
    },
    onError: () => toast.error('Failed to add supplier'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const cats = form.supply_categories
      ? form.supply_categories.split(',').map(s => s.trim()).filter(Boolean)
      : []
    mutation.mutate({ ...form, supply_categories: cats })
  }

  const inp = 'w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red'
  const lbl = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-brand-slate">Add Supplier</h2>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={lbl}>Company Name *</label>
            <input required className={inp} value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>KRA PIN *</label>
            <input required className={inp} value={form.kra_pin} onChange={e => setForm({ ...form, kra_pin: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>VAT Number</label>
            <input className={inp} value={form.vat_number} onChange={e => setForm({ ...form, vat_number: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Contact Person *</label>
            <input required className={inp} value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Email *</label>
            <input required type="email" className={inp} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Phone *</label>
            <input required className={inp} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Payment Terms *</label>
            <input required className={inp} value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Supply Categories (comma-separated)</label>
            <input className={inp} placeholder="e.g. materials, fuel, services" value={form.supply_categories} onChange={e => setForm({ ...form, supply_categories: e.target.value })} />
          </div>
          <div className="col-span-2 flex gap-3 pt-2">
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium py-2 rounded-lg disabled:opacity-60">
              {mutation.isPending ? 'Saving…' : 'Save Supplier'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── PRs Tab ───────────────────────────────────────────────────────────────────

function PRsTab() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const params = {}
  if (status) params.status = status
  if (search) params.search = search

  const { data, isLoading } = useQuery({
    queryKey: ['prs', status, search],
    queryFn: () => getPRs({ page_size: 100, ...params }),
    select: r => r.data?.results ?? [],
  })

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <FilterBar
          statuses={PR_STATUSES}
          value={status}
          onChange={setStatus}
          search={search}
          onSearch={setSearch}
          placeholder="Search PR number…"
        />
        <button
          onClick={() => navigate('/procurement/new-pr')}
          className="flex items-center gap-1.5 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <PlusIcon className="h-4 w-4" /> New PR
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['PR #', 'Requested By', 'Department', 'Project', 'Items', 'Est. Value (KES)', 'Status', 'Date', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <SkeletonRows cols={9} /> : !data?.length ? (
              <tr><td colSpan={9}><EmptyState icon={ShoppingBagIcon} message="No purchase requisitions found." /></td></tr>
            ) : data.map(pr => (
              <tr key={pr.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/procurement/pr/${pr.id}`)}>
                <td className="px-4 py-3 font-mono text-brand-slate font-medium">{pr.pr_number}</td>
                <td className="px-4 py-3 text-gray-700">{pr.requested_by_name || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{pr.department_name ?? pr.department ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{pr.project_name ?? pr.project ?? '—'}</td>
                <td className="px-4 py-3 text-center text-gray-600">{pr.line_items?.length ?? 0}</td>
                <td className="px-4 py-3 font-medium text-gray-800">
                  {pr.total_estimated_value != null ? Number(pr.total_estimated_value).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3"><StatusBadge status={pr.status} colorMap={PR_STATUS_COLORS} /></td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{pr.created_at ? new Date(pr.created_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3 text-brand-red hover:underline font-medium">View</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── POs Tab ───────────────────────────────────────────────────────────────────

function POsTab() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const params = {}
  if (status) params.status = status
  if (search) params.search = search

  const { data, isLoading } = useQuery({
    queryKey: ['pos', status, search],
    queryFn: () => getPOs({ page_size: 100, ...params }),
    select: r => r.data?.results ?? [],
  })

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <FilterBar
          statuses={PO_STATUSES}
          value={status}
          onChange={setStatus}
          search={search}
          onSearch={setSearch}
          placeholder="Search PO number…"
        />
        <button
          onClick={() => navigate('/procurement/new-po')}
          className="flex items-center gap-1.5 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <PlusIcon className="h-4 w-4" /> New PO
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['PO #', 'Supplier', 'PR Reference', 'Total Value (KES)', 'Status', 'Delivery Date', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <SkeletonRows cols={7} /> : !data?.length ? (
              <tr><td colSpan={7}><EmptyState icon={ShoppingBagIcon} message="No purchase orders found." /></td></tr>
            ) : data.map(po => (
              <tr key={po.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/procurement/po/${po.id}`)}>
                <td className="px-4 py-3 font-mono text-brand-slate font-medium">{po.po_number}</td>
                <td className="px-4 py-3 text-gray-700">{po.supplier_name || '—'}</td>
                <td className="px-4 py-3 font-mono text-gray-600">{po.pr_number ?? (po.pr ? po.pr : '—')}</td>
                <td className="px-4 py-3 font-medium text-gray-800">
                  {po.total_value != null ? Number(po.total_value).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3"><StatusBadge status={po.status} colorMap={PO_STATUS_COLORS} /></td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{po.delivery_date || '—'}</td>
                <td className="px-4 py-3 text-brand-red hover:underline font-medium">View</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Suppliers Tab ─────────────────────────────────────────────────────────────

function SuppliersTab() {
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', search],
    queryFn: () => getSuppliers(search ? { search } : {}),
    select: r => r.data?.results ?? r.data ?? [],
  })

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <PlusIcon className="h-4 w-4" /> Add Supplier
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Company', 'Contact Person', 'Phone', 'Email', 'KRA PIN', 'Categories', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <SkeletonRows cols={7} /> : !data?.length ? (
              <tr><td colSpan={7}><EmptyState icon={BuildingStorefrontIcon} message="No suppliers found." /></td></tr>
            ) : data.map(s => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-800">{s.company_name}</td>
                <td className="px-4 py-3 text-gray-600">{s.contact_person}</td>
                <td className="px-4 py-3 text-gray-600">{s.phone}</td>
                <td className="px-4 py-3 text-gray-600">{s.email}</td>
                <td className="px-4 py-3 font-mono text-gray-600">{s.kra_pin}</td>
                <td className="px-4 py-3 text-gray-600">
                  {Array.isArray(s.supply_categories) && s.supply_categories.length
                    ? s.supply_categories.join(', ')
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.status} colorMap={SUPPLIER_STATUS_COLORS} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <AddSupplierModal onClose={() => setShowModal(false)} />}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'pr',        label: 'Purchase Requisitions' },
  { key: 'po',        label: 'Purchase Orders' },
  { key: 'suppliers', label: 'Suppliers' },
]

export default function ProcurementPage() {
  const [tab, setTab] = useState('pr')

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-brand-red bg-opacity-10 rounded-lg">
          <ShoppingBagIcon className="h-6 w-6 text-brand-red" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-brand-slate">Procurement</h1>
          <p className="text-sm text-gray-600">Purchase Requisitions, Orders &amp; Suppliers</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === key ? 'bg-white text-brand-red shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'pr'        && <PRsTab />}
      {tab === 'po'        && <POsTab />}
      {tab === 'suppliers' && <SuppliersTab />}
    </div>
  )
}
