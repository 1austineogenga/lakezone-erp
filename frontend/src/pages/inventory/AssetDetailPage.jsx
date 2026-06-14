import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { ArrowLeftIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import { getAsset, updateAsset, getAssetMaintenance, addAssetMaintenance } from '../../api/inventory'

const COND_COLORS  = { new: 'bg-green-100 text-green-700', good: 'bg-blue-100 text-blue-700', fair: 'bg-amber-100 text-amber-700', poor: 'bg-orange-100 text-orange-700', condemned: 'bg-red-100 text-red-700' }
const STATUS_COLORS = { active: 'bg-green-100 text-green-700', under_repair: 'bg-amber-100 text-amber-700', disposed: 'bg-gray-100 text-gray-600', lost: 'bg-red-100 text-red-700' }
const CAT_COLORS   = { it_equipment: 'bg-blue-100 text-blue-700', furniture: 'bg-amber-100 text-amber-700', machinery: 'bg-red-100 text-red-700', vehicles: 'bg-slate-100 text-slate-700', office_equipment: 'bg-green-100 text-green-700', tools: 'bg-orange-100 text-orange-700', communication: 'bg-purple-100 text-purple-700', safety: 'bg-teal-100 text-teal-700', other: 'bg-gray-100 text-gray-600' }

const fmt = n => `KES ${Number(n || 0).toLocaleString()}`

const EMPTY_LOG = { date: new Date().toISOString().split('T')[0], description: '', cost: '', performed_by: '', next_service_date: '' }

export default function AssetDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showLogModal, setShowLogModal] = useState(false)
  const [logForm, setLogForm] = useState(EMPTY_LOG)

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => getAsset(id),
    select: r => r.data,
  })

  const { data: logs = [] } = useQuery({
    queryKey: ['asset-maintenance', id],
    queryFn: () => getAssetMaintenance(id),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const logMut = useMutation({
    mutationFn: d => addAssetMaintenance(id, d),
    onSuccess: () => {
      toast.success('Maintenance log added')
      qc.invalidateQueries({ queryKey: ['asset-maintenance', id] })
      setShowLogModal(false)
      setLogForm(EMPTY_LOG)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to add log'),
  })

  if (isLoading) return <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
  if (!asset) return <p className="text-sm text-gray-400 p-8 text-center">Asset not found.</p>

  const depreciationPct = asset.purchase_value > 0
    ? Math.min(100, Math.round((Number(asset.current_value) / Number(asset.purchase_value)) * 100))
    : 0

  const infoRows = [
    ['Department',    asset.department],
    ['Assigned To',   asset.assigned_to || '—'],
    ['Serial Number', asset.serial_number || '—'],
    ['Make / Model',  asset.make_model || '—'],
    ['Location',      asset.location || '—'],
    ['Purchase Date', asset.purchase_date || '—'],
    ['Purchase Value', fmt(asset.purchase_value)],
    ['Current Value', fmt(asset.current_value)],
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/assets')} className="mt-1 text-gray-400 hover:text-brand-slate">
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-brand-slate text-white text-xs font-bold px-2 py-0.5 rounded font-mono">{asset.asset_code}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CAT_COLORS[asset.category] || 'bg-gray-100 text-gray-600'}`}>
              {asset.category?.replace('_', ' ')}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[asset.status] || 'bg-gray-100 text-gray-600'}`}>
              {asset.status?.replace('_', ' ')}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COND_COLORS[asset.condition] || 'bg-gray-100 text-gray-600'}`}>
              {asset.condition}
            </span>
          </div>
          <h2 className="font-bold text-brand-slate text-lg mt-1">{asset.name}</h2>
        </div>
        <button onClick={() => setShowLogModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
          <WrenchScrewdriverIcon className="h-3.5 w-3.5" /> Add Maintenance Log
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Info grid */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Asset Information</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {infoRows.map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-xs font-medium text-brand-slate mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          {asset.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Notes</p>
              <p className="text-xs text-gray-600 leading-relaxed">{asset.notes}</p>
            </div>
          )}
        </div>

        {/* Depreciation */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">Value Retention</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Current vs Purchase</span>
                <span className="font-semibold text-brand-slate">{depreciationPct}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${depreciationPct > 60 ? 'bg-green-500' : depreciationPct > 30 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${depreciationPct}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-sm font-bold text-slate-700">{fmt(asset.purchase_value)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Purchase Value</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-sm font-bold text-green-700">{fmt(asset.current_value)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Current Value</p>
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-sm font-bold text-red-700">{fmt(Number(asset.purchase_value) - Number(asset.current_value))}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total Depreciation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance Log */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-brand-slate text-sm">Maintenance History ({logs.length})</h3>
          <button onClick={() => setShowLogModal(true)}
            className="text-xs text-brand-red hover:underline">+ Add Log</button>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400 p-8 text-center">No maintenance logs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Date', 'Description', 'Cost', 'Performed By', 'Next Service'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{log.date}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[280px]">{log.description}</td>
                    <td className="px-4 py-3 font-medium">KES {Number(log.cost || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{log.performed_by || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{log.next_service_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Maintenance Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-brand-slate">Add Maintenance Log</h3>
              <button onClick={() => setShowLogModal(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                  <input type="date" value={logForm.date} onChange={e => setLogForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cost (KES)</label>
                  <input type="number" value={logForm.cost} onChange={e => setLogForm(f => ({ ...f, cost: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                  <textarea value={logForm.description} onChange={e => setLogForm(f => ({ ...f, description: e.target.value }))} rows={2}
                    placeholder="What was done?"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Performed By</label>
                  <input value={logForm.performed_by} onChange={e => setLogForm(f => ({ ...f, performed_by: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Next Service Date</label>
                  <input type="date" value={logForm.next_service_date} onChange={e => setLogForm(f => ({ ...f, next_service_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
              <button onClick={() => setShowLogModal(false)} className="px-4 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => logMut.mutate(logForm)} disabled={logMut.isPending || !logForm.description}
                className="px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                {logMut.isPending ? 'Saving…' : 'Save Log'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
