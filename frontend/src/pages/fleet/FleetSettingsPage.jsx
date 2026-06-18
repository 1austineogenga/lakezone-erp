import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { Cog6ToothIcon, ArrowPathIcon, BugAntIcon } from '@heroicons/react/24/outline'
import { getFleetConfig, saveFleetConfig, forceSync, backfillHistory, fetchHistory, fetchFuelEvents } from '../../api/fleet'
import api from '../../api/client'
import useAuthStore from '../../store/authStore'

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
  const { user } = useAuthStore()
  if (user?.role !== 'system_admin') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <Cog6ToothIcon className="h-10 w-10 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">Access Restricted</p>
        <p className="text-xs text-gray-400">Fleet API settings are only accessible to System Administrators.</p>
      </div>
    )
  }

  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY)

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const [histFrom, setHistFrom] = useState(threeMonthsAgo.toISOString().split('T')[0])
  const [histTo,   setHistTo]   = useState(new Date().toISOString().split('T')[0])

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

  const [debugResult, setDebugResult] = useState(null)
  const debugMut = useMutation({
    mutationFn: () => api.get('/fleet/debug/'),
    onSuccess: d => setDebugResult(d.data),
    onError: e => toast.error('Debug failed: ' + (e.response?.data?.error || e.message)),
  })

  const backfillMut = useMutation({
    mutationFn: backfillHistory,
    onSuccess: d => {
      const { trips_created, fuel_events_created, vehicles_processed } = d.data
      toast.success(`Backfill done — ${trips_created} trips, ${fuel_events_created} fuel events from ${vehicles_processed} vehicles.`)
      qc.invalidateQueries({ queryKey: ['trips-detail'] })
      qc.invalidateQueries({ queryKey: ['fuel-events-detail'] })
      qc.invalidateQueries({ queryKey: ['utilization-report'] })
      qc.invalidateQueries({ queryKey: ['fuel-report'] })
    },
    onError: e => toast.error(e.response?.data?.detail || 'Backfill failed.'),
  })

  const fetchFuelEvtMut = useMutation({
    mutationFn: () => fetchFuelEvents({ date_from: histFrom, date_to: histTo }),
    onSuccess: d => {
      const r = d.data
      if (r.error) { toast.error(r.error); return }
      toast.success(`Fuel events import done — ${r.events_imported} events imported.`)
      qc.invalidateQueries({ queryKey: ['fleet-fuel-events-v'] })
      qc.invalidateQueries({ queryKey: ['fleet-dashboard'] })
    },
    onError: e => toast.error(e.response?.data?.detail || 'Fuel events fetch failed.'),
  })

  const fetchHistMut = useMutation({
    mutationFn: () => fetchHistory({ date_from: histFrom, date_to: histTo }),
    onSuccess: d => {
      const r = d.data
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success(`History import done — ${r.trips_imported} trips imported (${r.trips_in_response} in response).`)
      qc.invalidateQueries({ queryKey: ['trips-detail'] })
      qc.invalidateQueries({ queryKey: ['utilization-report'] })
    },
    onError: e => toast.error(e.response?.data?.detail || 'History fetch failed.'),
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
        <div className="flex gap-2">
          <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-60">
            <ArrowPathIcon className={`h-3.5 w-3.5 ${syncMut.isPending ? 'animate-spin' : ''}`} />
            {syncMut.isPending ? 'Syncing…' : 'Test Sync'}
          </button>
          <button onClick={() => debugMut.mutate()} disabled={debugMut.isPending}
            title="Test raw API connection and see exactly what Fleet Express returns"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-200 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-50 disabled:opacity-60">
            <BugAntIcon className="h-3.5 w-3.5" />
            {debugMut.isPending ? 'Testing…' : 'Debug API'}
          </button>
          <button onClick={() => backfillMut.mutate()} disabled={backfillMut.isPending}
            title="Re-process all historical snapshots to generate trip and fuel event records"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-50 disabled:opacity-60">
            <ArrowPathIcon className={`h-3.5 w-3.5 ${backfillMut.isPending ? 'animate-spin' : ''}`} />
            {backfillMut.isPending ? 'Backfilling…' : 'Backfill History'}
          </button>
        </div>
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

      {/* Debug output */}
      {debugResult && (
        <div className="bg-white border border-amber-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-amber-800 text-sm flex items-center gap-2"><BugAntIcon className="h-4 w-4" /> API Debug Result</h3>
            <button onClick={() => setDebugResult(null)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-50 rounded p-2">
              <p className="font-semibold text-gray-600 mb-1">Token</p>
              <p className={`font-mono break-all ${debugResult.step1_error ? 'text-red-600' : 'text-green-700'}`}>
                {debugResult.step1_error || (debugResult.step1_token ? '✓ ' + String(debugResult.step1_token).slice(0, 40) + '…' : '(none)')}
              </p>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <p className="font-semibold text-gray-600 mb-1">Vehicles in API response</p>
              <p className="font-bold text-2xl text-brand-slate">{debugResult.vehicle_count ?? '?'}</p>
            </div>
          </div>
          {debugResult.step2_error && (
            <p className="text-xs text-red-600 bg-red-50 rounded p-2 font-mono break-all">{debugResult.step2_error}</p>
          )}
          {debugResult.vehicle_nos?.length > 0 && (
            <div className="text-xs">
              <p className="font-semibold text-gray-600 mb-1">Vehicle numbers returned by API:</p>
              <div className="flex flex-wrap gap-1">
                {debugResult.vehicle_nos.map(v => (
                  <span key={v} className="bg-brand-slate text-white px-2 py-0.5 rounded font-mono text-[11px]">{v}</span>
                ))}
              </div>
            </div>
          )}
          {debugResult.step2_raw && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Raw API response (click to expand)</summary>
              <pre className="mt-2 bg-gray-50 rounded p-3 overflow-x-auto text-[10px] text-gray-600 max-h-64">
                {JSON.stringify(debugResult.step2_raw, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Historical trip import */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-brand-slate text-sm mb-1">Import Trip History</h3>
          <p className="text-xs text-gray-400">Fetch up to 3 months of trip records directly from the TrackNTrace API.</p>
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          {[['From', histFrom, setHistFrom], ['To', histTo, setHistTo]].map(([label, val, set]) => (
            <div key={label}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input type="date" value={val} onChange={e => set(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
          ))}
          <button onClick={() => fetchHistMut.mutate()} disabled={fetchHistMut.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-slate text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
            <ArrowPathIcon className={`h-3.5 w-3.5 ${fetchHistMut.isPending ? 'animate-spin' : ''}`} />
            {fetchHistMut.isPending ? 'Fetching…' : 'Fetch History'}
          </button>
        </div>
        {fetchHistMut.data && (
          <div className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-0.5 font-mono">
            <p>Endpoint: {fetchHistMut.data.data.endpoint_used || '—'}</p>
            <p>Trips in response: <strong>{fetchHistMut.data.data.trips_in_response ?? 0}</strong></p>
            <p>Trips imported: <strong>{fetchHistMut.data.data.trips_imported ?? 0}</strong></p>
            {fetchHistMut.data.data.error && <p className="text-red-600 break-all">{fetchHistMut.data.data.error}</p>}
            {fetchHistMut.data.data.raw_response && (
              <p className="text-gray-500 break-all">Raw: {JSON.stringify(fetchHistMut.data.data.raw_response)}</p>
            )}
          </div>
        )}
      </div>

      {/* Fuel events import from API */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-brand-slate text-sm mb-1">Import Fuel Events from API</h3>
          <p className="text-xs text-gray-400">
            Fetch pre-processed fuel fill/drain events directly from Trakzee — values in litres, same source as Fleet Express app.
            Uses the same date range as the trip history above.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <button onClick={() => fetchFuelEvtMut.mutate()} disabled={fetchFuelEvtMut.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-700 text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
            <ArrowPathIcon className={`h-3.5 w-3.5 ${fetchFuelEvtMut.isPending ? 'animate-spin' : ''}`} />
            {fetchFuelEvtMut.isPending ? 'Fetching…' : 'Fetch Fuel Events'}
          </button>
        </div>
        {fetchFuelEvtMut.data && (
          <div className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-0.5 font-mono">
            <p>Endpoint: {fetchFuelEvtMut.data.data.endpoint_used || '—'}</p>
            <p>Events in response: <strong>{fetchFuelEvtMut.data.data.events_in_response ?? 0}</strong></p>
            <p>Events imported: <strong>{fetchFuelEvtMut.data.data.events_imported ?? 0}</strong></p>
            {fetchFuelEvtMut.data.data.error && (
              <p className="text-red-600 break-all">{fetchFuelEvtMut.data.data.error}</p>
            )}
            {fetchFuelEvtMut.data.data.debug_responses?.length > 0 && (
              <details>
                <summary className="cursor-pointer text-gray-500">Endpoint probe results</summary>
                <pre className="mt-1 overflow-x-auto max-h-48 text-[10px]">
                  {JSON.stringify(fetchFuelEvtMut.data.data.debug_responses, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
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
