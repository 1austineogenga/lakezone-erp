import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { Cog6ToothIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { getFleetConfig, saveFleetConfig, forceSync } from '../../api/fleet'
import api from '../../api/client'

const EMPTY = {
  name: 'Primary Fleet Config',
  api_type: 'token_based',
  base_url: '',
  username: '',
  password: '',
  api_key: '',
  company_id: '',
  extra_params: {},
  is_active: true,
}

export default function FleetSettingsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY)
  const [extraRaw, setExtraRaw] = useState('{}')

  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ['fleet-config'],
    queryFn: getFleetConfig,
    select: r => {
      const d = r.data
      if (Array.isArray(d) && d.length > 0) return d[0]
      if (d?.results?.length > 0) return d.results[0]
      return null
    },
  })

  useEffect(() => {
    if (existingConfig) {
      setForm({ ...EMPTY, ...existingConfig, password: '' })
      setExtraRaw(JSON.stringify(existingConfig.extra_params || {}, null, 2))
    }
  }, [existingConfig])

  const saveMut = useMutation({
    mutationFn: data => {
      if (existingConfig?.id) {
        // Update existing config via PATCH
        return api.patch(`/fleet/config/${existingConfig.id}/`, data)
      }
      return saveFleetConfig(data)
    },
    onSuccess: () => {
      toast.success('Fleet API configuration saved.')
      qc.invalidateQueries({ queryKey: ['fleet-config'] })
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to save.'),
  })

  const syncMut = useMutation({
    mutationFn: forceSync,
    onSuccess: d => {
      toast.success(`Sync OK — ${d.data.synced ?? 0} vehicles updated.`)
      qc.invalidateQueries({ queryKey: ['fleet-live'] })
      qc.invalidateQueries({ queryKey: ['fleet-dashboard'] })
    },
    onError: e => toast.error(e.response?.data?.detail || 'Sync failed. Check credentials.'),
  })

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    let extra = {}
    try { extra = JSON.parse(extraRaw) } catch { toast.error('Extra Params is not valid JSON.'); return }
    saveMut.mutate({ ...form, extra_params: extra, password: form.password || undefined })
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Fleet Settings</h2>
          <p className="text-xs text-gray-400 mt-0.5">Tracking API credentials and sync configuration</p>
        </div>
        <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-60">
          <ArrowPathIcon className={`h-3.5 w-3.5 ${syncMut.isPending ? 'animate-spin' : ''}`} />
          Test Sync
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div>
          <h3 className="font-semibold text-brand-slate text-sm mb-1 flex items-center gap-2">
            <Cog6ToothIcon className="h-4 w-4 text-gray-400" /> API Configuration
          </h3>
          <p className="text-xs text-gray-400">
            Supports <strong>Token Based</strong> (Trakzee-style, recommended) and <strong>Vehicle Wise</strong> GET endpoints.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Config Name</label>
            <input value={form.name} onChange={e => field('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">API Type</label>
            <select value={form.api_type} onChange={e => field('api_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
              <option value="token_based">Token Based (Trakzee / recommended)</option>
              <option value="vehicle_wise">Vehicle Wise (GET per vehicle)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Base URL</label>
            <input value={form.base_url} onChange={e => field('base_url', e.target.value)}
              placeholder="http://165.22.222.196"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
            <input value={form.username} onChange={e => field('username', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
            <input type="password" value={form.password} onChange={e => field('password', e.target.value)}
              placeholder={existingConfig ? '(leave blank to keep current)' : ''}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Company ID</label>
            <input value={form.company_id} onChange={e => field('company_id', e.target.value)}
              placeholder="e.g. Lakezone"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">API Key (if any)</label>
            <input value={form.api_key} onChange={e => field('api_key', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red font-mono" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Extra Params (JSON)</label>
            <textarea value={extraRaw} onChange={e => setExtraRaw(e.target.value)} rows={3}
              placeholder='{"project_id": 37}'
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-brand-red resize-none" />
            <p className="text-[10px] text-gray-400 mt-0.5">For token-based: set <code>project_id</code>. For vehicle-wise: leave empty.</p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={e => field('is_active', e.target.checked)}
            className="rounded border-gray-300 accent-brand-red" />
          Active (enable automatic sync)
        </label>

        <div className="pt-2">
          <button onClick={handleSave} disabled={saveMut.isPending || (!form.base_url && !existingConfig?.base_url)}
            className="px-5 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
            {saveMut.isPending ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 space-y-1">
        <p className="font-semibold">How the sync works</p>
        <p>• The system auto-refreshes live data every 2 minutes when the Fleet Dashboard is open.</p>
        <p>• Token Based API: fetches all vehicles in one batch call using the auth-code token.</p>
        <p>• Vehicle Wise API: fetches each registered vehicle individually (1-min rate limit respected).</p>
        <p>• Fuel fills (&gt;5% increase) and drains (&gt;5% drop) are auto-detected and logged.</p>
        <p>• Trips are auto-detected from ignition ON → OFF sequences.</p>
        <p>• Alerts fire for: SOS, speed &gt;100 km/h, low fuel (&lt;10%), and offline (&gt;30 min).</p>
        <p>• Run <code>python manage.py fleet_sync</code> as a cron every 2 minutes on the server for background sync.</p>
      </div>
    </div>
  )
}
