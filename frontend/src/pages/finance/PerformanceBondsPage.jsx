import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getBonds, createBond, updateBond } from '../../api/finance'
import api from '../../api/client'
import { PlusIcon, ExclamationTriangleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`

const STATUS_COLORS = {
  active:   'bg-green-100 text-green-700',
  expiring: 'bg-yellow-100 text-yellow-700',
  expired:  'bg-red-100 text-red-700',
  released: 'bg-gray-100 text-gray-500',
  called:   'bg-red-200 text-red-800',
}

const BOND_TYPE_LABELS = {
  performance: 'Performance Bond',
  advance:     'Advance Payment Guarantee',
  retention:   'Retention Bond',
  bid:         'Bid Bond / Tender Security',
  maintenance: 'Maintenance Bond',
  other:       'Other',
}

const EMPTY_FORM = {
  bond_type: 'performance', reference: '', project: '',
  issuing_bank: '', beneficiary: '', amount: '',
  issue_date: '', expiry_date: '', notes: '',
}

export default function PerformanceBondsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [statusFilter, setStatusFilter] = useState('')

  const { data: bonds, isLoading } = useQuery({
    queryKey: ['bonds', statusFilter],
    queryFn: () => getBonds(statusFilter ? { status: statusFilter } : undefined),
    select: r => r.data?.results ?? r.data,
  })

  const { data: projects } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => api.get('/projects/'),
    select: r => r.data?.results ?? r.data,
  })

  const createMut = useMutation({
    mutationFn: createBond,
    onSuccess: () => {
      toast.success('Bond registered.')
      qc.invalidateQueries(['bonds'])
      setShowForm(false)
      setForm(EMPTY_FORM)
    },
    onError: () => toast.error('Failed to register bond.'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status }) => updateBond(id, { status }),
    onSuccess: () => { toast.success('Status updated.'); qc.invalidateQueries(['bonds']) },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form, amount: parseFloat(form.amount) }
    if (!payload.project) delete payload.project
    createMut.mutate(payload)
  }

  const f = (k) => ({ value: form[k], onChange: e => setForm({ ...form, [k]: e.target.value }) })
  const cls = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red'

  const active   = bonds?.filter(b => b.status === 'active').length || 0
  const expiring = bonds?.filter(b => b.status === 'expiring').length || 0
  const totalVal = bonds?.filter(b => ['active','expiring'].includes(b.status))
                         .reduce((s, b) => s + Number(b.amount), 0) || 0

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Active Bonds</p>
          <p className="text-xl font-bold text-green-600">{active}</p>
        </div>
        <div className={`rounded-xl border p-4 ${expiring > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Expiring Soon (30 days)</p>
          <div className="flex items-center gap-2">
            {expiring > 0 && <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />}
            <p className={`text-xl font-bold ${expiring > 0 ? 'text-yellow-700' : 'text-brand-slate'}`}>{expiring}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Total Bond Value</p>
          <p className="text-xl font-bold text-brand-slate">{fmt(totalVal)}</p>
          <p className="text-xs text-gray-600 mt-1">Active + expiring bonds</p>
        </div>
      </div>

      {/* Filters + add */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-red">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_COLORS).map(([k]) => (
            <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
          ))}
        </select>
        <button onClick={() => setShowForm(s => !s)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark">
          <PlusIcon className="h-4 w-4" /> Register Bond
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-brand-slate text-sm mb-4">New Performance Bond / Guarantee</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Bond Type *</label>
              <select required {...f('bond_type')} className={cls}>
                {Object.entries(BOND_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Reference / Bond No.</label>
              <input {...f('reference')} className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Project</label>
              <select {...f('project')} className={cls}>
                <option value="">No specific project</option>
                {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Issuing Bank *</label>
              <input required {...f('issuing_bank')} className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Beneficiary *</label>
              <input required {...f('beneficiary')} placeholder="Client / Employer" className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Bond Amount (KES) *</label>
              <input required type="number" min="0" step="0.01" {...f('amount')} className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Issue Date *</label>
              <input required type="date" {...f('issue_date')} className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Expiry Date *</label>
              <input required type="date" {...f('expiry_date')} className={cls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Notes</label>
              <input {...f('notes')} className={cls} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" disabled={createMut.isPending}
              className="px-4 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:bg-brand-red-dark disabled:opacity-60">
              Register Bond
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-brand-slate text-sm">Bond Register</h3>
        </div>
        {isLoading
          ? <p className="text-sm text-gray-600 p-8 text-center">Loading…</p>
          : !bonds || bonds.length === 0
            ? <p className="text-sm text-gray-600 p-8 text-center">No bonds registered yet.</p>
            : <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Type', 'Project', 'Issuing Bank', 'Beneficiary', 'Amount', 'Issue Date', 'Expiry', 'Days Left', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bonds.map(b => (
                      <tr key={b.id} className={`hover:bg-gray-50 ${b.status === 'expiring' ? 'bg-yellow-50' : ''}`}>
                        <td className="px-4 py-3 text-xs">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheckIcon className="h-3.5 w-3.5 text-brand-slate" />
                            <span>{BOND_TYPE_LABELS[b.bond_type] || b.bond_type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{b.project_name || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{b.issuing_bank}</td>
                        <td className="px-4 py-3 text-gray-700 text-xs">{b.beneficiary}</td>
                        <td className="px-4 py-3 font-semibold text-brand-slate">{fmt(b.amount)}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{b.issue_date}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{b.expiry_date}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${b.days_to_expiry < 0 ? 'text-red-600' : b.days_to_expiry <= 30 ? 'text-yellow-700' : 'text-gray-600'}`}>
                            {b.days_to_expiry < 0 ? `${Math.abs(b.days_to_expiry)}d ago` : `${b.days_to_expiry}d`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[b.status]}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {['active', 'expiring'].includes(b.status) && (
                              <button onClick={() => updateMut.mutate({ id: b.id, status: 'released' })}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium">Release</button>
                            )}
                            {b.status !== 'called' && b.status !== 'released' && (
                              <button onClick={() => updateMut.mutate({ id: b.id, status: 'called' })}
                                className="text-xs text-red-600 hover:text-red-800 font-medium">Called</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        }
      </div>
    </div>
  )
}
