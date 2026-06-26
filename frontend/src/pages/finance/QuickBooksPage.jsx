import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '../../api/client'
import {
  LinkIcon, ArrowPathIcon, CheckCircleIcon, XCircleIcon,
  CloudArrowUpIcon, Cog6ToothIcon, ArrowUpIcon, ArrowDownIcon,
} from '@heroicons/react/24/outline'

const getQBConfig  = ()     => api.get('/finance/quickbooks/config/')
const saveQBConfig = (data) => api.patch('/finance/quickbooks/config/', data)
const getQBAuthUrl = ()     => api.get('/finance/quickbooks/connect/')
const qbCallback   = (data) => api.post('/finance/quickbooks/callback/', data)
const qbDisconnect = ()     => api.post('/finance/quickbooks/disconnect/')
const qbSync       = (data) => api.post('/finance/quickbooks/sync/', data)
const getQBLogs    = ()     => api.get('/finance/quickbooks/logs/')

const BRAND_RED   = '#e11d48'
const BRAND_SLATE = '#1e293b'

const ENTITIES = [
  { key: 'accounts',          label: 'Chart of Accounts', desc: 'Push GL accounts ↑ or pull QB accounts ↓' },
  { key: 'customers',         label: 'Customers',          desc: 'Sync CRM clients with QB Customers' },
  { key: 'vendors',           label: 'Vendors',            desc: 'Sync suppliers with QB Vendors' },
  { key: 'invoices',          label: 'Invoices',           desc: 'Push/pull invoices with QuickBooks' },
  { key: 'bills',             label: 'Bills',              desc: 'Push/pull bills with QuickBooks' },
  { key: 'payments',          label: 'Payments',           desc: 'Push/pull AR & AP payments' },
  { key: 'journal_entries',   label: 'Journal Entries',    desc: 'Pull GL journal entries from QB', pullOnly: true },
  { key: 'bank_transactions', label: 'Bank Transactions',  desc: 'Pull deposits & transfers from QB', pullOnly: true },
  { key: 'credit_notes',      label: 'Credit Notes',       desc: 'Pull credit memos & vendor credits from QB', pullOnly: true },
]

const STATUS_BADGE = {
  success: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  failed:  'bg-red-100 text-red-600',
}

function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleString()
}

export default function QuickBooksPage() {
  const qc = useQueryClient()

  const [configForm, setConfigForm] = useState(null)
  const [showCallbackModal, setShowCallbackModal] = useState(false)
  const [cbCode, setCbCode]         = useState('')
  const [cbRealm, setCbRealm]       = useState('')
  const [syncResults, setSyncResults] = useState({})     // `${entity}-${dir}` -> {ok, fail, status}
  const [syncing, setSyncing]         = useState({})     // `${entity}-${dir}` -> bool
  const [syncDir, setSyncDir]         = useState({})     // entity -> 'push'|'pull'
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['qb-config'],
    queryFn: () => getQBConfig().then(r => r.data),
  })

  useEffect(() => {
    if (configData && !configForm) {
      setConfigForm({
        client_id:     configData.client_id    || '',
        client_secret: '',
        environment:   configData.environment  || 'sandbox',
        redirect_uri:  configData.redirect_uri || '',
      })
    }
  }, [configData])

  const { data: logsData } = useQuery({
    queryKey: ['qb-logs'],
    queryFn: () => getQBLogs().then(r => Array.isArray(r.data) ? r.data : (r.data?.results ?? [])),
    refetchInterval: 30000,
  })

  const saveMut = useMutation({
    mutationFn: saveQBConfig,
    onSuccess: () => {
      toast.success('QuickBooks config saved.')
      qc.invalidateQueries(['qb-config'])
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Save failed'),
  })

  const connectMut = useMutation({
    mutationFn: getQBAuthUrl,
    onSuccess: (r) => {
      window.open(r.data.auth_url, '_blank', 'noopener')
      setShowCallbackModal(true)
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Could not generate auth URL'),
  })

  const callbackMut = useMutation({
    mutationFn: qbCallback,
    onSuccess: () => {
      toast.success('Connected to QuickBooks!')
      setShowCallbackModal(false)
      setCbCode(''); setCbRealm('')
      qc.invalidateQueries(['qb-config'])
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Connection failed'),
  })

  const disconnectMut = useMutation({
    mutationFn: qbDisconnect,
    onSuccess: () => {
      toast.success('Disconnected from QuickBooks.')
      setShowDisconnectConfirm(false)
      qc.invalidateQueries(['qb-config'])
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Disconnect failed'),
  })

  const handleSync = async (entity, direction) => {
    const k = `${entity}-${direction}`
    setSyncing(s => ({ ...s, [k]: true }))
    try {
      const r = await qbSync({ entity, direction })
      const log = r.data.log
      setSyncResults(s => ({ ...s, [k]: { ok: log.records_ok, fail: log.records_fail, status: log.status } }))
      if (log.status === 'success') toast.success(`${entity}: ${log.records_ok} ${direction === 'pull' ? 'imported' : 'pushed'}`)
      else if (log.status === 'partial') toast.warn(`${entity}: ${log.records_ok} ok, ${log.records_fail} failed`)
      else toast.error(`${entity} sync failed`)
      qc.invalidateQueries(['qb-logs'])
    } catch (e) {
      toast.error(e?.response?.data?.detail || `${entity} sync error`)
    } finally {
      setSyncing(s => ({ ...s, [k]: false }))
    }
  }

  const config = configData || {}
  const isConnected = config.is_connected

  const cf = configForm || { client_id: '', client_secret: '', environment: 'sandbox', redirect_uri: '' }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: BRAND_SLATE }}>
          <LinkIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: BRAND_SLATE }}>QuickBooks Online</h1>
          <p className="text-sm text-gray-500">Sync your Lakezone ERP data with QuickBooks</p>
        </div>
      </div>

      {/* Connection Status */}
      <div className={`rounded-xl border-2 p-5 flex items-center justify-between ${isConnected ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <div className="flex items-center gap-3">
          {isConnected
            ? <CheckCircleIcon className="w-8 h-8 text-green-600" />
            : <XCircleIcon className="w-8 h-8 text-red-500" />}
          <div>
            <p className={`font-semibold text-lg ${isConnected ? 'text-green-800' : 'text-red-700'}`}>
              {isConnected ? 'Connected to QuickBooks' : 'Not Connected'}
            </p>
            {isConnected && (
              <p className="text-sm text-green-700">
                Company ID: <span className="font-mono">{config.realm_id}</span>
                {config.last_sync_at && <> &bull; Last sync: {fmtDate(config.last_sync_at)}</>}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isConnected ? (
            <button
              onClick={() => setShowDisconnectConfirm(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-600 hover:bg-red-100 transition"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => connectMut.mutate()}
              disabled={connectMut.isPending || !cf.client_id || !cf.redirect_uri}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
              style={{ backgroundColor: BRAND_RED }}
            >
              {connectMut.isPending ? 'Opening...' : 'Connect to QuickBooks'}
            </button>
          )}
        </div>
      </div>

      {/* Config Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Cog6ToothIcon className="w-5 h-5 text-gray-500" />
          <h2 className="font-semibold text-gray-800">Configuration</h2>
        </div>
        {configLoading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client ID</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': BRAND_RED }}
                value={cf.client_id}
                onChange={e => setConfigForm(f => ({ ...f, client_id: e.target.value }))}
                placeholder="QB OAuth Client ID"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Secret</label>
              <input
                type="password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                value={cf.client_secret}
                onChange={e => setConfigForm(f => ({ ...f, client_secret: e.target.value }))}
                placeholder="Leave blank to keep existing"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Environment</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={cf.environment}
                onChange={e => setConfigForm(f => ({ ...f, environment: e.target.value }))}
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Redirect URI</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={cf.redirect_uri}
                onChange={e => setConfigForm(f => ({ ...f, redirect_uri: e.target.value }))}
                placeholder="https://yourapp.com/qb/callback"
              />
            </div>
          </div>
        )}
        <div className="mt-4 flex gap-3 items-center">
          <button
            onClick={() => {
              const payload = { ...cf }
              if (!payload.client_secret) delete payload.client_secret
              saveMut.mutate(payload)
            }}
            disabled={saveMut.isPending}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ backgroundColor: BRAND_SLATE }}
          >
            {saveMut.isPending ? 'Saving...' : 'Save Config'}
          </button>
          {!isConnected && (
            <button
              onClick={() => connectMut.mutate()}
              disabled={connectMut.isPending || !cf.client_id || !cf.redirect_uri}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
              style={{ backgroundColor: BRAND_RED }}
            >
              Connect to QuickBooks
            </button>
          )}
        </div>
      </div>

      {/* Sync Controls */}
      {isConnected && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CloudArrowUpIcon className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-800">Sync Controls</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ENTITIES.map(({ key, label, desc, pullOnly }) => {
              const dir = pullOnly ? 'pull' : (syncDir[key] || 'push')
              const k = `${key}-${dir}`
              const res = syncResults[k]
              const busy = syncing[k]
              return (
                <div key={key} className="border border-gray-200 rounded-lg p-4 flex flex-col gap-2">
                  <div>
                    <p className="font-medium text-sm text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500 mb-1">{desc}</p>
                  </div>
                  {/* Push / Pull toggle — hidden for pull-only entities */}
                  {!pullOnly && <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
                    <button
                      onClick={() => setSyncDir(d => ({ ...d, [key]: 'push' }))}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 transition ${dir === 'push' ? 'bg-brand-red text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                      <ArrowUpIcon className="w-3 h-3" /> Push ↑
                    </button>
                    <button
                      onClick={() => setSyncDir(d => ({ ...d, [key]: 'pull' }))}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 transition ${dir === 'pull' ? 'bg-brand-red text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                      <ArrowDownIcon className="w-3 h-3" /> Pull ↓
                    </button>
                  </div>}
                  {res && (
                    <p className="text-xs">
                      <span className="text-green-600 font-medium">{res.ok} ok</span>
                      {res.fail > 0 && <span className="text-red-500 font-medium ml-2">{res.fail} failed</span>}
                    </p>
                  )}
                  <button
                    onClick={() => handleSync(key, dir)}
                    disabled={busy}
                    className="mt-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition disabled:opacity-60"
                    style={{ backgroundColor: BRAND_RED }}
                  >
                    {busy
                      ? <><ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> Syncing...</>
                      : dir === 'pull' ? 'Pull from QB' : 'Push to QB'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sync History */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-3">Sync History</h2>
        {!logsData || logsData.length === 0 ? (
          <p className="text-sm text-gray-400">No sync logs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-4">Entity</th>
                  <th className="pb-2 pr-4">Direction</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">OK</th>
                  <th className="pb-2 pr-4">Failed</th>
                  <th className="pb-2 pr-4">Triggered By</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {logsData.slice(0, 20).map(log => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium capitalize">{log.entity_type}</td>
                    <td className="py-2 pr-4 text-gray-600 capitalize">{log.direction}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[log.status] || 'bg-gray-100 text-gray-600'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-green-600 font-medium">{log.records_ok}</td>
                    <td className="py-2 pr-4 text-red-500 font-medium">{log.records_fail}</td>
                    <td className="py-2 pr-4 text-gray-500">{log.triggered_by_name || '—'}</td>
                    <td className="py-2 text-gray-400 whitespace-nowrap">{fmtDate(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Complete Connection Modal */}
      {showCallbackModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-1" style={{ color: BRAND_SLATE }}>Complete QuickBooks Connection</h3>
            <p className="text-sm text-gray-500 mb-4">
              QuickBooks opened in a new tab. After authorizing, paste the <code>code</code> and <code>realmId</code> from the redirect URL below.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Authorization Code</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                  value={cbCode}
                  onChange={e => setCbCode(e.target.value)}
                  placeholder="code=..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Realm ID (Company ID)</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                  value={cbRealm}
                  onChange={e => setCbRealm(e.target.value)}
                  placeholder="123456789"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => callbackMut.mutate({ code: cbCode, realm_id: cbRealm })}
                disabled={callbackMut.isPending || !cbCode || !cbRealm}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: BRAND_RED }}
              >
                {callbackMut.isPending ? 'Connecting...' : 'Complete Connection'}
              </button>
              <button
                onClick={() => { setShowCallbackModal(false); setCbCode(''); setCbRealm('') }}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirm Modal */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-2 text-gray-800">Disconnect QuickBooks?</h3>
            <p className="text-sm text-gray-500 mb-5">This will revoke your OAuth tokens. You will need to reconnect to sync again.</p>
            <div className="flex gap-3">
              <button
                onClick={() => disconnectMut.mutate()}
                disabled={disconnectMut.isPending}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: BRAND_RED }}
              >
                {disconnectMut.isPending ? 'Disconnecting...' : 'Yes, Disconnect'}
              </button>
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
