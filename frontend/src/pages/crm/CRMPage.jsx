import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  PlusIcon, MagnifyingGlassIcon, PencilIcon,
  BuildingOfficeIcon, CurrencyDollarIcon, TrophyIcon, ChartBarIcon,
} from '@heroicons/react/24/outline'
import {
  getClients, createClient, updateClient,
  getOpportunities, createOpportunity, updateOpportunity,
} from '../../api/crm'
import usePermissions from '../../hooks/usePermissions'

const STAGES = [
  { value: 'prospect',  label: 'Prospect',        color: 'bg-gray-100 text-gray-600' },
  { value: 'qualified', label: 'Qualified',        color: 'bg-blue-100 text-blue-700' },
  { value: 'bid_prep',  label: 'Bid Preparation',  color: 'bg-amber-100 text-amber-700' },
  { value: 'submitted', label: 'Submitted',         color: 'bg-purple-100 text-purple-700' },
  { value: 'won',       label: 'Won',               color: 'bg-green-100 text-green-700' },
  { value: 'lost',      label: 'Lost',              color: 'bg-red-100 text-red-700' },
]

const stageInfo = (stage) => STAGES.find(s => s.value === stage) || STAGES[0]

const fmt = (n) => n ? `KES ${Number(n).toLocaleString()}` : '—'

// ── Client Modal ─────────────────────────────────────────────────────────────
const EMPTY_CLIENT = { company_name: '', contact_person: '', email: '', phone: '', address: '', kra_pin: '', is_active: true }

function ClientModal({ open, onClose, initial, onSave, saving }) {
  const [form, setForm] = useState(initial || EMPTY_CLIENT)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  if (!open) return null
  const isEdit = !!initial?.id
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-brand-slate">{isEdit ? 'Edit Client' : 'New Client'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Company Name *</label>
              <input value={form.company_name} onChange={e => set('company_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contact Person *</label>
              <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">KRA PIN</label>
              <input value={form.kra_pin} onChange={e => set('kra_pin', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
              <input value={form.address} onChange={e => set('address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            {isEdit && (
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
                    className="rounded border-gray-300" />
                  <span className="text-xs font-medium text-gray-600">Active Client</span>
                </label>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.company_name || !form.contact_person}
            className="px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Client'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Opportunity Modal ─────────────────────────────────────────────────────────
const EMPTY_OPP = { opportunity_name: '', client: '', tender_number: '', estimated_value: '', stage: 'prospect', submission_deadline: '', probability_percent: '', win_loss_reason: '' }

function OppModal({ open, onClose, initial, onSave, saving, clients }) {
  const [form, setForm] = useState(initial || EMPTY_OPP)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  if (!open) return null
  const isEdit = !!initial?.id
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-brand-slate">{isEdit ? 'Edit Opportunity' : 'New Opportunity'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Opportunity Name *</label>
              <input value={form.opportunity_name} onChange={e => set('opportunity_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Client *</label>
              <select value={form.client} onChange={e => set('client', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tender Number</label>
              <input value={form.tender_number} onChange={e => set('tender_number', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estimated Value (KES)</label>
              <input type="number" value={form.estimated_value} onChange={e => set('estimated_value', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
              <select value={form.stage} onChange={e => set('stage', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Win Probability (%)</label>
              <input type="number" min="0" max="100" value={form.probability_percent} onChange={e => set('probability_percent', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Submission Deadline</label>
              <input type="datetime-local" value={form.submission_deadline?.slice(0, 16) || ''} onChange={e => set('submission_deadline', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
            </div>
            {['won', 'lost'].includes(form.stage) && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Win / Loss Reason</label>
                <textarea value={form.win_loss_reason} onChange={e => set('win_loss_reason', e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.opportunity_name || !form.client}
            className="px-4 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Opportunity'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CRMPage() {
  const qc = useQueryClient()
  const { canWrite, isAdmin } = usePermissions()
  const canEdit = isAdmin || canWrite('crm')

  const [tab, setTab]         = useState('clients')
  const [search, setSearch]   = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [clientModal, setClientModal] = useState(null)
  const [oppModal, setOppModal]       = useState(null)

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['crm-clients'],
    queryFn: () => getClients({ page_size: 200 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: opps = [], isLoading: loadingOpps } = useQuery({
    queryKey: ['crm-opps', stageFilter],
    queryFn: () => getOpportunities({ page_size: 200, stage: stageFilter || undefined }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const clientMut = useMutation({
    mutationFn: (form) => clientModal?.data?.id
      ? updateClient(clientModal.data.id, form)
      : createClient(form),
    onSuccess: () => {
      toast.success(clientModal?.data?.id ? 'Client updated' : 'Client created')
      qc.invalidateQueries({ queryKey: ['crm-clients'] })
      setClientModal(null)
    },
    onError: e => {
      const data = e.response?.data
      const msg = typeof data === 'object' ? Object.values(data).flat().join(', ') : 'Failed to save client'
      toast.error(msg)
    },
  })

  const oppMut = useMutation({
    mutationFn: (form) => oppModal?.data?.id
      ? updateOpportunity(oppModal.data.id, form)
      : createOpportunity(form),
    onSuccess: () => {
      toast.success(oppModal?.data?.id ? 'Opportunity updated' : 'Opportunity created')
      qc.invalidateQueries({ queryKey: ['crm-opps'] })
      setOppModal(null)
    },
    onError: e => {
      const data = e.response?.data
      const msg = typeof data === 'object' ? Object.values(data).flat().join(', ') : 'Failed to save opportunity'
      toast.error(msg)
    },
  })

  const filteredClients = clients.filter(c =>
    !search ||
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_person?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredOpps = opps.filter(o =>
    !search ||
    o.opportunity_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.tender_number?.toLowerCase().includes(search.toLowerCase())
  )

  // Pipeline summary
  const totalPipeline = opps.filter(o => !['won','lost'].includes(o.stage))
    .reduce((s, o) => s + Number(o.estimated_value || 0), 0)
  const wonValue = opps.filter(o => o.stage === 'won')
    .reduce((s, o) => s + Number(o.estimated_value || 0), 0)
  const wonCount = opps.filter(o => o.stage === 'won').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">CRM</h2>
          <p className="text-xs text-gray-400 mt-0.5">Clients and tender pipeline management</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setClientModal({ mode: 'add' })}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
              <PlusIcon className="h-3.5 w-3.5" /> New Client
            </button>
            <button onClick={() => setOppModal({ mode: 'add' })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
              <PlusIcon className="h-3.5 w-3.5" /> New Opportunity
            </button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Clients',    value: clients.length,    icon: BuildingOfficeIcon, color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Active Pipeline',  value: fmt(totalPipeline), icon: ChartBarIcon,       color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'Won This Year',    value: wonCount + ' deals', icon: TrophyIcon,         color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Won Value',        value: fmt(wonValue),      icon: CurrencyDollarIcon,  color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`${bg} p-2 rounded-lg`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="font-bold text-brand-slate text-sm">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[['clients', 'Clients'], ['opportunities', 'Tender Pipeline']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors
                ${tab === key ? 'bg-white text-brand-red shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red w-full" />
        </div>
        {tab === 'opportunities' && (
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
            <option value="">All Stages</option>
            {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
      </div>

      {/* Clients table */}
      {tab === 'clients' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">Clients ({filteredClients.length})</h3>
          </div>
          {loadingClients ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : filteredClients.length === 0 ? (
            <p className="text-sm text-gray-400 p-10 text-center">No clients found.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Company', 'Contact Person', 'Email', 'Phone', 'KRA PIN', 'Status', canEdit ? 'Actions' : ''].filter(Boolean).map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredClients.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-brand-slate">{c.company_name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.contact_person}</td>
                    <td className="px-4 py-3 text-gray-500">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.kra_pin || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <button onClick={() => setClientModal({ mode: 'edit', data: c })}
                          className="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded text-xs hover:bg-gray-50">
                          <PencilIcon className="h-3 w-3" /> Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Opportunities table */}
      {tab === 'opportunities' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">Tender Pipeline ({filteredOpps.length})</h3>
          </div>
          {loadingOpps ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : filteredOpps.length === 0 ? (
            <p className="text-sm text-gray-400 p-10 text-center">No opportunities found.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Opportunity', 'Client', 'Tender No.', 'Est. Value', 'Deadline', 'Probability', 'Stage', canEdit ? 'Actions' : ''].filter(Boolean).map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredOpps.map(o => {
                  const si = stageInfo(o.stage)
                  const deadline = o.submission_deadline ? new Date(o.submission_deadline) : null
                  const overdue = deadline && deadline < new Date() && !['won','lost'].includes(o.stage)
                  return (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-brand-slate max-w-[200px] truncate">{o.opportunity_name}</td>
                      <td className="px-4 py-3 text-gray-600">{o.client_name}</td>
                      <td className="px-4 py-3 text-gray-500">{o.tender_number || '—'}</td>
                      <td className="px-4 py-3 font-medium">{fmt(o.estimated_value)}</td>
                      <td className={`px-4 py-3 ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {deadline ? deadline.toLocaleDateString() : '—'}
                        {overdue && <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1 rounded">Overdue</span>}
                      </td>
                      <td className="px-4 py-3">
                        {o.probability_percent != null ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-red rounded-full" style={{ width: `${o.probability_percent}%` }} />
                            </div>
                            <span className="text-gray-500">{o.probability_percent}%</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${si.color}`}>{si.label}</span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setOppModal({ mode: 'edit', data: { ...o, client: o.client } })}
                            className="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded text-xs hover:bg-gray-50">
                            <PencilIcon className="h-3 w-3" /> Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modals */}
      <ClientModal
        open={!!clientModal}
        onClose={() => setClientModal(null)}
        initial={clientModal?.data || null}
        onSave={form => clientMut.mutate(form)}
        saving={clientMut.isPending}
      />
      <OppModal
        open={!!oppModal}
        onClose={() => setOppModal(null)}
        initial={oppModal?.data || null}
        onSave={form => oppMut.mutate(form)}
        saving={oppMut.isPending}
        clients={clients}
      />
    </div>
  )
}
