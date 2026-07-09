import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon,
  BuildingOfficeIcon, CurrencyDollarIcon, TrophyIcon, ChartBarIcon,
  PhoneIcon, EnvelopeIcon, UserGroupIcon, MapPinIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'
import {
  getClients, createClient, updateClient, deleteClient,
  getOpportunities, createOpportunity, updateOpportunity, deleteOpportunity,
  getPipeline,
  getInteractions, createInteraction, updateInteraction, deleteInteraction,
} from '../../api/crm'
import usePermissions from '../../hooks/usePermissions'

const STAGES = [
  { value: 'prospect',  label: 'Prospect',        color: 'bg-gray-100 text-gray-600',   bar: 'bg-gray-400' },
  { value: 'qualified', label: 'Qualified',        color: 'bg-blue-100 text-blue-700',   bar: 'bg-blue-500' },
  { value: 'bid_prep',  label: 'Bid Preparation',  color: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' },
  { value: 'submitted', label: 'Submitted',         color: 'bg-purple-100 text-purple-700', bar: 'bg-purple-500' },
  { value: 'won',       label: 'Won',               color: 'bg-green-100 text-green-700', bar: 'bg-green-500' },
  { value: 'lost',      label: 'Lost',              color: 'bg-red-100 text-red-700',   bar: 'bg-red-400' },
]

const INTERACTION_TYPES = [
  { value: 'call',       label: 'Call',       icon: PhoneIcon },
  { value: 'email',      label: 'Email',      icon: EnvelopeIcon },
  { value: 'meeting',    label: 'Meeting',    icon: UserGroupIcon },
  { value: 'site_visit', label: 'Site Visit', icon: MapPinIcon },
]

const stageInfo = (stage) => STAGES.find(s => s.value === stage) || STAGES[0]
const interactionInfo = (type) => INTERACTION_TYPES.find(t => t.value === type) || INTERACTION_TYPES[0]
const fmt = (n) => n ? `KES ${Number(n).toLocaleString()}` : '—'
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—'
const fmtDateTime = (d) => d ? new Date(d).toLocaleString() : '—'

// ── Client Modal ─────────────────────────────────────────────────────────────
const EMPTY_CLIENT = { company_name: '', contact_person: '', email: '', phone: '', address: '', kra_pin: '', is_active: true }

function ClientModal({ open, onClose, initial, onSave, saving }) {
  const [form, setForm] = useState(initial || EMPTY_CLIENT)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  if (!open) return null
  const isEdit = !!initial?.id
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <h3 className="text-white font-bold text-base">{isEdit ? 'Edit Client' : 'New Client'}</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Company Name *</label>
              <input value={form.company_name} onChange={e => set('company_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contact Person *</label>
              <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">KRA PIN</label>
              <input value={form.kra_pin} onChange={e => set('kra_pin', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
              <input value={form.address} onChange={e => set('address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white" />
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
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="px-4 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.company_name || !form.contact_person}
            className="px-4 bg-brand-red text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90">
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <h3 className="text-white font-bold text-base">{isEdit ? 'Edit Opportunity' : 'New Opportunity'}</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Opportunity Name *</label>
              <input value={form.opportunity_name} onChange={e => set('opportunity_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Client *</label>
              <select value={form.client} onChange={e => set('client', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white">
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tender Number</label>
              <input value={form.tender_number} onChange={e => set('tender_number', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estimated Value (KES)</label>
              <input type="number" value={form.estimated_value} onChange={e => set('estimated_value', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
              <select value={form.stage} onChange={e => set('stage', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white">
                {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Win Probability (%)</label>
              <input type="number" min="0" max="100" value={form.probability_percent} onChange={e => set('probability_percent', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Submission Deadline</label>
              <input type="datetime-local" value={form.submission_deadline?.slice(0, 16) || ''} onChange={e => set('submission_deadline', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white" />
            </div>
            {['won', 'lost'].includes(form.stage) && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Win / Loss Reason</label>
                <textarea value={form.win_loss_reason} onChange={e => set('win_loss_reason', e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white" />
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="px-4 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.opportunity_name || !form.client}
            className="px-4 bg-brand-red text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Opportunity'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Interaction Modal ─────────────────────────────────────────────────────────
const EMPTY_INT = { interaction_type: 'call', date: new Date().toISOString().slice(0, 16), notes: '' }

function InteractionModal({ open, onClose, initial, onSave, saving }) {
  const [form, setForm] = useState(initial || EMPTY_INT)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <h3 className="text-white font-bold text-base">{initial?.id ? 'Edit Interaction' : 'Log Interaction'}</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
            <select value={form.interaction_type} onChange={e => set('interaction_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white">
              {INTERACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date & Time *</label>
            <input type="datetime-local" value={form.date?.slice(0, 16) || ''} onChange={e => set('date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white" />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="px-4 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving}
            className="px-4 bg-brand-red text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Communications Tab ────────────────────────────────────────────────────────
function CommunicationsTab({ canEdit }) {
  const qc = useQueryClient()
  const [selectedClient, setSelectedClient] = useState('')
  const [intModal, setIntModal] = useState(null)

  const { data: clients = [] } = useQuery({
    queryKey: ['crm-clients'],
    queryFn: () => getClients({ page_size: 200 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  const { data: interactions = [], isLoading } = useQuery({
    queryKey: ['crm-interactions', selectedClient],
    queryFn: () => getInteractions(selectedClient),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: !!selectedClient,
  })

  const intMut = useMutation({
    mutationFn: (form) => intModal?.data?.id
      ? updateInteraction(selectedClient, intModal.data.id, form)
      : createInteraction(selectedClient, form),
    onSuccess: () => {
      toast.success(intModal?.data?.id ? 'Interaction updated' : 'Interaction logged')
      qc.invalidateQueries({ queryKey: ['crm-interactions', selectedClient] })
      setIntModal(null)
    },
    onError: () => toast.error('Failed to save interaction'),
  })

  const delMut = useMutation({
    mutationFn: (id) => deleteInteraction(selectedClient, id),
    onSuccess: () => {
      toast.success('Interaction deleted')
      qc.invalidateQueries({ queryKey: ['crm-interactions', selectedClient] })
    },
    onError: () => toast.error('Failed to delete'),
  })

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-end gap-4">
        <div className="flex-1 max-w-xs">
          <label className="block text-xs font-medium text-gray-600 mb-1">Select Client</label>
          <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red bg-white">
            <option value="">— choose a client —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
        {selectedClient && canEdit && (
          <button onClick={() => setIntModal({ mode: 'add' })}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
            <PlusIcon className="h-3.5 w-3.5" /> Log Interaction
          </button>
        )}
      </div>

      {!selectedClient ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-sm">
          Select a client to view their communication history
        </div>
      ) : isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : interactions.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-sm">
          No interactions logged yet for this client.
        </div>
      ) : (
        <div className="space-y-3">
          {interactions.map(int => {
            const ti = interactionInfo(int.interaction_type)
            const Icon = ti.icon
            return (
              <div key={int.id} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4">
                <div className="bg-brand-slate/10 p-2.5 rounded-lg h-fit">
                  <Icon className="h-4 w-4 text-brand-slate" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-brand-slate">{ti.label}</span>
                    <span className="text-xs text-gray-400">{fmtDateTime(int.date)}</span>
                    {int.created_by_name && (
                      <span className="text-xs text-gray-400">· by {int.created_by_name}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 whitespace-pre-line">{int.notes || <span className="italic text-gray-400">No notes</span>}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setIntModal({ mode: 'edit', data: int })}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { if (window.confirm('Delete this interaction?')) delMut.mutate(int.id) }}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-red-50 text-red-400">
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <InteractionModal
        open={!!intModal}
        onClose={() => setIntModal(null)}
        initial={intModal?.data || null}
        onSave={form => intMut.mutate(form)}
        saving={intMut.isPending}
      />
    </div>
  )
}

// ── Pipeline Dashboard ────────────────────────────────────────────────────────
function PipelineDashboard() {
  const { data: pipeline, isLoading } = useQuery({
    queryKey: ['crm-pipeline'],
    queryFn: getPipeline,
    select: r => r.data,
  })

  // Also fetch opportunities for recent list
  const { data: opps = [] } = useQuery({
    queryKey: ['crm-opps', ''],
    queryFn: () => getOpportunities({ page_size: 10 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  if (isLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
  if (!pipeline) return null

  // Backend returns by_stage as dict keyed by stage value
  const byStage = pipeline.by_stage || {}
  const maxVal = Math.max(...Object.values(byStage).map(s => Number(s.total_estimated_value || 0)), 1)
  const activeStages = Object.entries(byStage).filter(([k]) => !['won', 'lost'].includes(k))
  const totalActive = activeStages.reduce((s, [, st]) => s + Number(st.total_estimated_value || 0), 0)
  const wonData = byStage['won'] || { count: 0, total_estimated_value: 0 }
  const winRate = pipeline.win_rate != null ? (pipeline.win_rate * 100).toFixed(1) : '—'

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Pipeline',  value: fmt(totalActive),   sub: `${activeStages.reduce((s, [, st]) => s + st.count, 0)} opportunities` },
          { label: 'Weighted Value',   value: fmt(pipeline.weighted_pipeline_value), sub: 'probability-adjusted' },
          { label: 'Win Rate',         value: winRate === '—' ? '—' : `${winRate}%`, sub: 'of closed deals' },
          { label: 'Won Value',        value: fmt(wonData.total_estimated_value), sub: `${wonData.count} deals won` },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-xl font-bold text-brand-slate">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Stage funnel */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-brand-slate text-sm mb-4">Pipeline by Stage</h3>
        <div className="space-y-3">
          {STAGES.map(({ value, label, bar }) => {
            const s = byStage[value] || { count: 0, total_estimated_value: 0 }
            const pct = maxVal > 0 ? (Number(s.total_estimated_value || 0) / maxVal) * 100 : 0
            return (
              <div key={value} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-600 w-20 text-right shrink-0">{fmt(s.total_estimated_value)}</span>
                <span className="text-xs text-gray-400 w-14 text-right shrink-0">{s.count} deal{s.count !== 1 ? 's' : ''}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent opportunities */}
      {opps.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">Recent Opportunities</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Opportunity', 'Client', 'Value', 'Stage', 'Deadline'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {opps.slice(0, 8).map(o => {
                const si = stageInfo(o.stage)
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-brand-slate">{o.opportunity_name}</td>
                    <td className="px-4 py-3 text-gray-600">{o.client_name}</td>
                    <td className="px-4 py-3 font-medium">{fmt(o.estimated_value)}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${si.color}`}>{si.label}</span></td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(o.submission_deadline)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CRMPage() {
  const qc = useQueryClient()
  const { canWrite, isAdmin } = usePermissions()
  const canEdit = isAdmin || canWrite('crm')

  const [tab, setTab]         = useState('pipeline')
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

  const clientDelMut = useMutation({
    mutationFn: (id) => deleteClient(id),
    onSuccess: () => {
      toast.success('Client deleted')
      qc.invalidateQueries({ queryKey: ['crm-clients'] })
    },
    onError: () => toast.error('Failed to delete client'),
  })

  const oppMut = useMutation({
    mutationFn: (form) => oppModal?.data?.id
      ? updateOpportunity(oppModal.data.id, form)
      : createOpportunity(form),
    onSuccess: () => {
      toast.success(oppModal?.data?.id ? 'Opportunity updated' : 'Opportunity created')
      qc.invalidateQueries({ queryKey: ['crm-opps'] })
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] })
      setOppModal(null)
    },
    onError: e => {
      const data = e.response?.data
      const msg = typeof data === 'object' ? Object.values(data).flat().join(', ') : 'Failed to save opportunity'
      toast.error(msg)
    },
  })

  const oppDelMut = useMutation({
    mutationFn: (id) => deleteOpportunity(id),
    onSuccess: () => {
      toast.success('Opportunity deleted')
      qc.invalidateQueries({ queryKey: ['crm-opps'] })
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] })
    },
    onError: () => toast.error('Failed to delete opportunity'),
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

  const totalPipeline = opps.filter(o => !['won','lost'].includes(o.stage))
    .reduce((s, o) => s + Number(o.estimated_value || 0), 0)
  const wonValue = opps.filter(o => o.stage === 'won')
    .reduce((s, o) => s + Number(o.estimated_value || 0), 0)
  const wonCount = opps.filter(o => o.stage === 'won').length

  const TABS = [
    { id: 'pipeline',      label: 'Pipeline Dashboard' },
    { id: 'clients',       label: 'Clients' },
    { id: 'opportunities', label: 'Tender Pipeline' },
    { id: 'communications', label: 'Communications' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">CRM</h2>
          <p className="text-xs text-gray-600 mt-0.5">Clients, tender pipeline &amp; communication log</p>
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
          { label: 'Total Clients',    value: clients.length,     icon: BuildingOfficeIcon, color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Active Pipeline',  value: fmt(totalPipeline), icon: ChartBarIcon,       color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'Won This Year',    value: wonCount + ' deals', icon: TrophyIcon,        color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Won Value',        value: fmt(wonValue),      icon: CurrencyDollarIcon, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`${bg} p-2 rounded-lg`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-600">{label}</p>
              <p className="font-bold text-brand-slate text-sm">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => { setTab(id); setSearch('') }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                ${tab === id ? 'bg-white text-brand-red shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
        {['clients', 'opportunities'].includes(tab) && (
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red w-full" />
          </div>
        )}
        {tab === 'opportunities' && (
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-red">
            <option value="">All Stages</option>
            {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
      </div>

      {/* Pipeline Dashboard */}
      {tab === 'pipeline' && <PipelineDashboard />}

      {/* Communications */}
      {tab === 'communications' && <CommunicationsTab canEdit={canEdit} />}

      {/* Clients table */}
      {tab === 'clients' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-brand-slate text-sm">Clients ({filteredClients.length})</h3>
          </div>
          {loadingClients ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : filteredClients.length === 0 ? (
            <p className="text-sm text-gray-600 p-10 text-center">No clients found.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Company', 'Contact Person', 'Email', 'Phone', 'KRA PIN', 'Status', canEdit ? 'Actions' : ''].filter(Boolean).map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredClients.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-brand-slate">{c.company_name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.contact_person}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.kra_pin || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => setClientModal({ mode: 'edit', data: c })}
                            className="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded text-xs hover:bg-gray-50">
                            <PencilIcon className="h-3 w-3" /> Edit
                          </button>
                          <button onClick={() => { if (window.confirm(`Delete ${c.company_name}?`)) clientDelMut.mutate(c.id) }}
                            className="flex items-center gap-1 px-2 py-1 border border-red-100 text-red-500 rounded text-xs hover:bg-red-50">
                            <TrashIcon className="h-3 w-3" />
                          </button>
                        </div>
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
            <p className="text-sm text-gray-600 p-10 text-center">No opportunities found.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Opportunity', 'Client', 'Tender No.', 'Est. Value', 'Deadline', 'Probability', 'Assigned To', 'Stage', 'Reason', canEdit ? 'Actions' : ''].filter(Boolean).map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-600">{h}</th>
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
                      <td className="px-4 py-3 font-medium text-brand-slate max-w-[180px] truncate">{o.opportunity_name}</td>
                      <td className="px-4 py-3 text-gray-600">{o.client_name}</td>
                      <td className="px-4 py-3 text-gray-600">{o.tender_number || '—'}</td>
                      <td className="px-4 py-3 font-medium">{fmt(o.estimated_value)}</td>
                      <td className={`px-4 py-3 ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                        {deadline ? deadline.toLocaleDateString() : '—'}
                        {overdue && <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1 rounded">Overdue</span>}
                      </td>
                      <td className="px-4 py-3">
                        {o.probability_percent != null ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-14 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-red rounded-full" style={{ width: `${o.probability_percent}%` }} />
                            </div>
                            <span className="text-gray-600">{o.probability_percent}%</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{o.assigned_to_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${si.color}`}>{si.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate" title={o.win_loss_reason}>
                        {o.win_loss_reason || '—'}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => setOppModal({ mode: 'edit', data: { ...o, client: o.client } })}
                              className="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded text-xs hover:bg-gray-50">
                              <PencilIcon className="h-3 w-3" /> Edit
                            </button>
                            <button onClick={() => { if (window.confirm('Delete this opportunity?')) oppDelMut.mutate(o.id) }}
                              className="flex items-center gap-1 px-2 py-1 border border-red-100 text-red-500 rounded text-xs hover:bg-red-50">
                              <TrashIcon className="h-3 w-3" />
                            </button>
                          </div>
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
