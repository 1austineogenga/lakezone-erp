import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { Cog6ToothIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { getFleetConfig, saveFleetConfig, forceSync } from '../../api/fleet'
import api from '../../api/client'

const EMPTY = {
  api_type:     'token_based',
  base_url:     '',
  username:     '',
  password:     '',
  company_name: '',   // matches model field
  project_id:   37,  // matches model field
  is_active:    true,
}

export default function FleetSettingsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY)

  const { data: existingConfig } = useQuery({
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
      setForm({
        api_type:     existingConfig.api_type     ?? 'token_based',
        base_url:     existingConfig.base_url     ?? '',
        username:     existingConfig.username     ?? '',
        password:     '',   // never pre-fill password
        company_name: existingConfig.company_name ?? '',
        project_id:   existingConfig.project_id  ?? 37,
        is_active:    existingConfig.is_active    ?? true,
      })
    }
  }, [existingConfig])

  const saveMut = useMutation({
    mutationFn: data => {
      if (existingConfig?.id) {
        return api.patch(`/fleet/config/${existingConfig.id}/`, data)
      }
      return saveFleetConfig(data)
    },
    onSuccess: () => {
      toast.success('Configuration saved.')
      qc.invalidateQueries({ queryKey: ['fleet-config'] })
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to save.'),
  })

  const syncMut = useMutation({
    mutationFn: forceSync,
    onSuccess: d => {
      const count = d.data.vehicles?.length ?? d.data.synced ?? 0
      toast.success(`Sync OK — ${count} vehicles updated.`)
      qc.invalidateQueries({ queryKey: ['fleet-live'] })
      qc.invalidateQueries({ queryKey: ['fleet-vehicles'] })
      qc.invalidateQueries({ queryKey: ['fleet-dashboard'] })
    },
    onError: e => toast.error(e.response?.data?.detail || 'Sync failed. Check credentials.'),
  })

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    const payload = { ...form }
    if (!payload.password) delete payload.password  // keep existing password if blank
    saveMut.mutate(payload)
  }

  const canSave = !saveMut.isPending && (form.base_url || existingConfig?.base_url)

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
          {syncMut.isPending ? 'Syncing…' : 'Test Sync'}
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
            <label className="block text-xs font-medium text-gray-600 mb-1">API Type</label>
            <select value={form.api_type} onChange={e => field('api_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
              <option value="token_based">Token Based (Trakzee / recommended)</option>
              <option value="vehicle_wise">Vehicle Wise (GET per vehicle)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Project ID</label>
            <input type="number" value={form.project_id} onChange={e => field('project_id', Number(e.target.value))}
              placeholder="37"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            <p className="text-[10px] text-gray-400 mt-0.5">From your Trakzee account (default: 37)</p>
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
              placeholder="e.g. tracking@LZEL"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
            <input type="password" value={form.password} onChange={e => field('password', e.target.value)}
              placeholder={existingConfig ? '(leave blank to keep current)' : ''}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Company Name</label>
            <input value={form.company_name} onChange={e => field('company_name', e.target.value)}
              placeholder="e.g. LAKE ZONE ENTERPRISES LTD"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            <p className="text-[10px] text-gray-400 mt-0.5">Exact company name as registered in Trakzee — used to filter vehicles in the API request.</p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={e => field('is_active', e.target.checked)}
            className="rounded border-gray-300 accent-brand-red" />
          Active (enable automatic sync)
        </label>

        <div className="pt-2">
          <button onClick={handleSave} disabled={!canSave}
            className="px-5 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
            {saveMut.isPending ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {existingConfig && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">Current saved values</p>
          <p>URL: <span className="font-mono">{existingConfig.base_url}</span></p>
          <p>Username: <strong>{existingConfig.username}</strong></p>
          <p>Company: <strong>{existingConfig.company_name || '(empty — fill this in!)'}</strong></p>
          <p>Project ID: <strong>{existingConfig.project_id}</strong></p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 space-y-1">
        <p className="font-semibold">How the sync works</p>
        <p>• Auto-refreshes every 2 minutes when Fleet Dashboard is open.</p>
        <p>• Token Based: fetches all vehicles in one batch — vehicles are auto-created in the system on first sync.</p>
        <p>• Vehicle Wise: fetches each registered vehicle individually (1-min rate limit respected).</p>
        <p>• Fuel fills (&gt;5L increase) and drains (&gt;5L drop) are auto-detected and logged.</p>
        <p>• Trips are auto-detected from ignition ON → OFF sequences.</p>
        <p>• Alerts fire for: SOS, speed &gt;100 km/h, low fuel (&lt;10%), offline (&gt;30 min).</p>
        <p>• Run <code>python manage.py fleet_sync</code> as a cron every 2 minutes on the server for background sync.</p>
      </div>
    </div>
  )
}
