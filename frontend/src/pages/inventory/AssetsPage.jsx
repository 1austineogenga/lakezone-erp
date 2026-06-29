import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  PlusIcon, BuildingOfficeIcon, WrenchScrewdriverIcon,
  CurrencyDollarIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline'
import {
  getAssets, createAsset, updateAsset, getAssetDashboard,
} from '../../api/inventory'
import useAuthStore from '../../store/authStore'
import api from '../../api/client'

const VIEW_ALL_READONLY = ['managing_director', 'finance_officer', 'finance_manager', 'admin_officer', 'general_manager']

const CATEGORY_OPTIONS = [
  { value: 'it_equipment', label: 'IT Equipment', color: 'bg-blue-100 text-blue-700' },
  { value: 'furniture', label: 'Furniture & Fittings', color: 'bg-amber-100 text-amber-700' },
  { value: 'machinery', label: 'Machinery & Plant', color: 'bg-orange-100 text-orange-700' },
  { value: 'vehicles', label: 'Vehicles & Transport', color: 'bg-purple-100 text-purple-700' },
  { value: 'office_equipment', label: 'Office Equipment', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'tools', label: 'Tools & Equipment', color: 'bg-green-100 text-green-700' },
  { value: 'communication', label: 'Communication Equip.', color: 'bg-pink-100 text-pink-700' },
  { value: 'safety', label: 'Safety Equipment', color: 'bg-red-100 text-red-700' },
  { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-600' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-700' },
  { value: 'under_repair', label: 'Under Repair', color: 'bg-amber-100 text-amber-700' },
  { value: 'disposed', label: 'Disposed', color: 'bg-gray-100 text-gray-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-700' },
]
const CONDITION_OPTIONS = ['new','good','fair','poor','condemned']

const emptyAsset = { name: '', category: 'it_equipment', serial_number: '', make_model: '', purchase_date: '', purchase_value: '', current_value: '', condition: 'good', status: 'active', location: '', assigned_to: '', notes: '' }

function StatCard({ icon: Icon, label, value, color = 'blue' }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', amber: 'bg-amber-50 text-amber-600', purple: 'bg-purple-50 text-purple-600' }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${colors[color]}`}><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-lg font-bold text-brand-slate">{value}</p>
      </div>
    </div>
  )
}

function AssetModal({ asset, deptName, onClose, onSuccess }) {
  const isEdit = !!asset
  const [form, setForm] = useState(isEdit ? {
    name: asset.name, category: asset.category, serial_number: asset.serial_number || '',
    make_model: asset.make_model || '', purchase_date: asset.purchase_date || '',
    purchase_value: asset.purchase_value || '', current_value: asset.current_value || '',
    condition: asset.condition, status: asset.status, location: asset.location || '',
    assigned_to: asset.assigned_to || '', notes: asset.notes || '',
  } : { ...emptyAsset })
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: isEdit ? d => updateAsset(asset.id, d) : createAsset,
    onSuccess: () => {
      toast.success(isEdit ? 'Asset updated' : 'Asset added')
      qc.invalidateQueries(['assets'])
      qc.invalidateQueries(['asset-dashboard'])
      onSuccess?.()
      onClose()
    },
    onError: e => toast.error(e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Failed'),
  })
  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red'
  const handleSave = () => {
    const payload = { ...form }
    if (!isEdit) payload.department = deptName
    if (payload.purchase_value === '') delete payload.purchase_value
    if (payload.current_value === '') delete payload.current_value
    mut.mutate(payload)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-brand-slate">{isEdit ? 'Edit Asset' : 'Add Asset'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
        </div>
        {deptName && <div className="mb-4 text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-lg flex items-center gap-1.5"><BuildingOfficeIcon className="h-3.5 w-3.5" />{deptName}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Name *</label><input required className={inp} value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select className={inp} value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
              {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Condition</label>
            <select className={inp} value={form.condition} onChange={e => setForm(f=>({...f,condition:e.target.value}))}>
              {CONDITION_OPTIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select className={inp} value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Serial Number</label><input className={inp} value={form.serial_number} onChange={e => setForm(f=>({...f,serial_number:e.target.value}))} /></div>
          <div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Make / Model</label><input className={inp} value={form.make_model} onChange={e => setForm(f=>({...f,make_model:e.target.value}))} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Purchase Date</label><input type="date" className={inp} value={form.purchase_date} onChange={e => setForm(f=>({...f,purchase_date:e.target.value}))} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Purchase Value (KES)</label><input type="number" min="0" step="any" className={inp} value={form.purchase_value} onChange={e => setForm(f=>({...f,purchase_value:e.target.value}))} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Current Value (KES)</label><input type="number" min="0" step="any" className={inp} value={form.current_value} onChange={e => setForm(f=>({...f,current_value:e.target.value}))} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Location</label><input className={inp} value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))} /></div>
          <div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Assigned To</label><input className={inp} value={form.assigned_to} onChange={e => setForm(f=>({...f,assigned_to:e.target.value}))} /></div>
          <div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Notes</label><textarea rows={2} className={`${inp} resize-none`} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} /></div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={handleSave} disabled={mut.isPending || !form.name}
            className="flex-1 bg-brand-red text-white text-sm font-medium py-2 rounded-lg disabled:opacity-60">
            {mut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Asset'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function AssetsPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const role = user?.role || ''
  const canEdit = role === 'system_admin' || !VIEW_ALL_READONLY.includes(role)
  const canViewAll = role === 'system_admin' || VIEW_ALL_READONLY.includes(role)

  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedDept, setSelectedDept] = useState(null) // dept name string for view-all
  const [showModal, setShowModal] = useState(false)
  const [editAsset, setEditAsset] = useState(null)

  // Fetch departments for view-all users
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/core/departments/').then(r => r.data?.results ?? r.data ?? []),
    enabled: canViewAll,
  })

  const assetParams = { page_size: 500 }
  if (filterCategory) assetParams.category = filterCategory
  if (filterStatus) assetParams.status = filterStatus
  if (canViewAll && selectedDept) assetParams.department = selectedDept

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', assetParams],
    queryFn: () => getAssets(assetParams),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: dashboard } = useQuery({
    queryKey: ['asset-dashboard'],
    queryFn: () => getAssetDashboard().then(r => r.data),
  })

  const filtered = assets.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.asset_code.toLowerCase().includes(search.toLowerCase()) ||
    (a.assigned_to || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalValue = Number(dashboard?.total_current_value || 0)
  const activeCount = Number(dashboard?.active_count || 0)
  const repairCount = Number(dashboard?.under_repair_count || 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-brand-slate">Assets</h1>
          <p className="text-xs text-gray-400 mt-0.5">Fixed assets register</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditAsset(null); setShowModal(true) }}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90">
            <PlusIcon className="h-4 w-4" /> Add Asset
          </button>
        )}
      </div>

      {/* Department context */}
      {canViewAll ? (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-gray-500 mr-1">Department:</span>
          <button onClick={() => setSelectedDept(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!selectedDept ? 'bg-brand-slate text-white border-brand-slate' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            All
          </button>
          {departments.map(d => (
            <button key={d.id} onClick={() => setSelectedDept(d.name)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${selectedDept === d.name ? 'bg-brand-slate text-white border-brand-slate' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {d.name}
            </button>
          ))}
        </div>
      ) : (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border ${canEdit ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
          <BuildingOfficeIcon className="h-4 w-4" />
          <span>{canEdit ? `${user?.department_name} — Your Department` : `Viewing: ${user?.department_name}`}</span>
          {!canEdit && <span className="ml-auto text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">View only</span>}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={BuildingOfficeIcon} label="Total Assets" value={assets.length} color="blue" />
        <StatCard icon={CurrencyDollarIcon} label="Current Value" value={`KES ${totalValue.toLocaleString(undefined,{maximumFractionDigits:0})}`} color="green" />
        <StatCard icon={CheckCircleIcon} label="Active" value={activeCount} color="purple" />
        <StatCard icon={WrenchScrewdriverIcon} label="Under Repair" value={repairCount} color="amber" />
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search assets…"
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red w-48" />
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red">
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red">
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BuildingOfficeIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No assets found.</p>
            {canEdit && <button onClick={() => setShowModal(true)} className="mt-3 text-xs text-brand-red font-medium hover:underline">+ Add your first asset</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>{['Code','Name','Category','Department','Assigned To','Condition','Status','Purchase Value','Current Value',''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(asset => {
                  const cat = CATEGORY_OPTIONS.find(c => c.value === asset.category)
                  const st = STATUS_OPTIONS.find(s => s.value === asset.status)
                  return (
                    <tr key={asset.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/assets/${asset.id}`)}>
                      <td className="px-3 py-2.5 font-mono text-gray-500">{asset.asset_code}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-800">{asset.name}</td>
                      <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat?.color ?? 'bg-gray-100 text-gray-600'}`}>{cat?.label ?? asset.category}</span></td>
                      <td className="px-3 py-2.5 text-gray-500">{asset.department}</td>
                      <td className="px-3 py-2.5 text-gray-500">{asset.assigned_to || '—'}</td>
                      <td className="px-3 py-2.5 capitalize text-gray-500">{asset.condition}</td>
                      <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st?.color ?? 'bg-gray-100 text-gray-600'}`}>{st?.label ?? asset.status}</span></td>
                      <td className="px-3 py-2.5 text-gray-700">{Number(asset.purchase_value).toLocaleString()}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-800">{Number(asset.current_value).toLocaleString()}</td>
                      <td className="px-3 py-2.5">
                        {canEdit && (
                          <button onClick={e => { e.stopPropagation(); setEditAsset(asset); setShowModal(true) }}
                            className="text-xs text-brand-red hover:underline font-medium">Edit</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <AssetModal
          asset={editAsset}
          deptName={editAsset?.department ?? user?.department_name}
          onClose={() => { setShowModal(false); setEditAsset(null) }}
        />
      )}
    </div>
  )
}
