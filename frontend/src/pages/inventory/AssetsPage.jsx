import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { getAssets, createAsset, updateAsset, getAssetDashboard } from '../../api/inventory'

const CATEGORIES = [
  { value: 'it_equipment',  label: 'IT Equipment' },
  { value: 'furniture',     label: 'Furniture & Fittings' },
  { value: 'machinery',     label: 'Machinery & Plant' },
  { value: 'vehicles',      label: 'Vehicles & Transport' },
  { value: 'office_equipment', label: 'Office Equipment' },
  { value: 'tools',         label: 'Tools & Equipment' },
  { value: 'communication', label: 'Communication Equipment' },
  { value: 'safety',        label: 'Safety Equipment' },
  { value: 'other',         label: 'Other' },
]

const DEPARTMENTS = [
  'Head Office', 'Projects - MN', 'Projects - NS',
  'Finance', 'HR', 'Procurement', 'Fleet', 'IT', 'Store',
]

const CONDITIONS = ['new', 'good', 'fair', 'poor', 'condemned']
const STATUSES   = ['active', 'under_repair', 'disposed', 'lost']

const CAT_COLORS = {
  it_equipment: 'bg-blue-100 text-blue-700',
  furniture: 'bg-amber-100 text-amber-700',
  machinery: 'bg-red-100 text-red-700',
  vehicles: 'bg-slate-100 text-slate-700',
  office_equipment: 'bg-green-100 text-green-700',
  tools: 'bg-orange-100 text-orange-700',
  communication: 'bg-purple-100 text-purple-700',
  safety: 'bg-teal-100 text-teal-700',
  other: 'bg-gray-100 text-gray-600',
}

const COND_COLORS = {
  new: 'bg-green-100 text-green-700',
  good: 'bg-blue-100 text-blue-700',
  fair: 'bg-amber-100 text-amber-700',
  poor: 'bg-orange-100 text-orange-700',
  condemned: 'bg-red-100 text-red-700',
}

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  under_repair: 'bg-amber-100 text-amber-700',
  disposed: 'bg-gray-100 text-gray-600',
  lost: 'bg-red-100 text-red-700',
}

const EMPTY_FORM = {
  name: '', category: 'it_equipment', department: 'Head Office',
  serial_number: '', make_model: '', purchase_date: '', purchase_value: '',
  current_value: '', condition: 'good', status: 'active',
  location: '', assigned_to: '', notes: '',
}

function AssetModal({ open, onClose, initial, onSave, saving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-brand-slate">{initial?.id ? 'Edit Asset' : 'Add Asset'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg font-bold">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Asset Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red"
                placeholder="e.g. Dell Laptop Core i7" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department *</label>
              <select value={form.department} onChange={e => set('department', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Serial Number</label>
              <input value={form.serial_number} onChange={e => set('serial_number', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Make / Model</label>
              <input value={form.make_model} onChange={e => set('make_model', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Date</label>
              <input type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Value (KES)</label>
              <input type="number" value={form.purchase_value} onChange={e => set('purchase_value', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Current Value (KES)</label>
              <input type="number" value={form.current_value} onChange={e => set('current_value', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Condition</label>
              <select value={form.condition} onChange={e => set('condition', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                {CONDITIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
              <select value={form.location} onChange={e => set('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                <option value="">Select location…</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
              <input value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}
                placeholder="Employee name"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.name}
            className="px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Asset'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AssetsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterCat, setFilterCat]   = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modal, setModal] = useState(null) // null | { mode: 'add'|'edit', asset?: {} }

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', filterDept, filterCat, filterStatus],
    queryFn: () => getAssets({ department: filterDept || undefined, category: filterCat || undefined, status: filterStatus || undefined, page_size: 500 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: dash } = useQuery({
    queryKey: ['asset-dashboard'],
    queryFn: getAssetDashboard,
    select: r => r.data,
  })

  const saveMut = useMutation({
    mutationFn: (form) => modal?.asset?.id ? updateAsset(modal.asset.id, form) : createAsset(form),
    onSuccess: () => {
      toast.success(modal?.asset?.id ? 'Asset updated' : 'Asset added')
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['asset-dashboard'] })
      setModal(null)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to save asset'),
  })

  const filtered = assets.filter(a =>
    !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.asset_code?.toLowerCase().includes(search.toLowerCase())
  )

  const statCards = [
    { label: 'Total Assets', value: dash?.total_assets ?? assets.length, color: 'slate' },
    { label: 'Total Value', value: `KES ${Number(dash?.total_value ?? 0).toLocaleString()}`, color: 'teal' },
    { label: 'Active', value: dash?.active_count ?? assets.filter(a => a.status === 'active').length, color: 'green' },
    { label: 'Under Repair / Disposed', value: (dash?.under_repair_count ?? 0) + (dash?.disposed_count ?? 0), color: 'amber' },
  ]

  const borderColors = { slate: 'border-l-slate-500 bg-slate-50 text-slate-700', teal: 'border-l-teal-500 bg-teal-50 text-teal-700', green: 'border-l-green-500 bg-green-50 text-green-700', amber: 'border-l-amber-500 bg-amber-50 text-amber-700' }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Fixed Assets Register</h2>
          <p className="text-xs text-gray-400 mt-0.5">Department asset inventory — equipment, furniture, tools and more</p>
        </div>
        <button onClick={() => setModal({ mode: 'add' })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> Add Asset
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {statCards.map(s => (
          <div key={s.label} className={`border border-gray-200 border-l-4 ${borderColors[s.color]} rounded-xl p-4`}>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or code…"
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red w-48" />
        </div>
        {[
          ['Department', filterDept, setFilterDept, [['', 'All Departments'], ...DEPARTMENTS.map(d => [d, d])]],
          ['Category', filterCat, setFilterCat, [['', 'All Categories'], ...CATEGORIES.map(c => [c.value, c.label])]],
          ['Status', filterStatus, setFilterStatus, [['', 'All Statuses'], ...STATUSES.map(s => [s, s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())])]],
        ].map(([label, val, set, opts]) => (
          <div key={label}>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            <select value={val} onChange={e => set(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-brand-slate text-sm">Assets ({filtered.length})</h3>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 p-10 text-center">No assets found. Add your first asset to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Code', 'Name', 'Category', 'Department', 'Assigned To', 'Condition', 'Status', 'Purchase Value', 'Current Value', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/assets/${a.id}`)}>
                    <td className="px-4 py-3 font-mono font-semibold text-brand-slate">{a.asset_code}</td>
                    <td className="px-4 py-3 font-medium text-brand-slate max-w-[160px] truncate">{a.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CAT_COLORS[a.category] || 'bg-gray-100 text-gray-600'}`}>
                        {CATEGORIES.find(c => c.value === a.category)?.label || a.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{a.department}</td>
                    <td className="px-4 py-3 text-gray-500">{a.assigned_to || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COND_COLORS[a.condition] || 'bg-gray-100 text-gray-600'}`}>
                        {a.condition}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                        {a.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">KES {Number(a.purchase_value || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium text-brand-slate">KES {Number(a.current_value || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button onClick={e => { e.stopPropagation(); setModal({ mode: 'edit', asset: a }) }}
                        className="px-2 py-1 border border-gray-200 rounded text-xs hover:bg-gray-50">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AssetModal
        open={!!modal}
        onClose={() => setModal(null)}
        initial={modal?.asset ? { ...modal.asset, purchase_date: modal.asset.purchase_date || '', purchase_value: modal.asset.purchase_value || '', current_value: modal.asset.current_value || '' } : EMPTY_FORM}
        onSave={form => saveMut.mutate(form)}
        saving={saveMut.isPending}
      />
    </div>
  )
}
