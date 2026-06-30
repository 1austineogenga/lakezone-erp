import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { PlusIcon } from '@heroicons/react/24/outline'
import { getRisks, createRisk, updateRisk } from '../../api/projects'
import usePermissions from '../../hooks/usePermissions'

const IMPACT_COLORS = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-yellow-100 text-yellow-700',
  low:      'bg-blue-100 text-blue-700',
}

const STATUS_CHIP = {
  open:      'bg-red-100 text-red-700',
  mitigated: 'bg-yellow-100 text-yellow-700',
  closed:    'bg-green-100 text-green-700',
  escalated: 'bg-purple-100 text-purple-700',
}

const IMPACT_OPTIONS  = ['critical', 'high', 'medium', 'low']
const STATUS_OPTIONS  = ['open', 'mitigated', 'closed', 'escalated']

const EMPTY_FORM = {
  risk_description: '', expected_impact: '', budget_treatment: '',
  realistic_range: '', owner: '', impact_level: 'medium', status: 'open',
}

export default function RiskRegisterPage() {
  const { projectId } = useParams()
  const qc = useQueryClient()
  const { canWrite } = usePermissions()
  const canEdit = canWrite('projects')

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: risks = [], isLoading } = useQuery({
    queryKey: ['project-risks', projectId],
    queryFn: () => getRisks(projectId),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: !!projectId,
  })

  const createMut = useMutation({
    mutationFn: data => createRisk(projectId, data),
    onSuccess: () => {
      toast.success('Risk added.')
      qc.invalidateQueries({ queryKey: ['project-risks', projectId] })
      setShowModal(false)
      setForm(EMPTY_FORM)
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to add risk.'),
  })

  const updateMut = useMutation({
    mutationFn: ({ riskId, data }) => updateRisk(projectId, riskId, data),
    onSuccess: () => {
      toast.success('Risk updated.')
      qc.invalidateQueries({ queryKey: ['project-risks', projectId] })
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to update risk.'),
  })

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const counts = risks.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  if (isLoading) return <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-slate text-lg">Risk Register</h2>
          <p className="text-xs text-gray-600 mt-0.5">{risks.length} risks tracked</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90">
            <PlusIcon className="h-3.5 w-3.5" /> Add Risk
          </button>
        )}
      </div>

      {/* Status Summary Chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { status: 'open',      label: 'Open',      cls: 'bg-red-100 text-red-700 border border-red-200' },
          { status: 'mitigated', label: 'Mitigated', cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
          { status: 'closed',    label: 'Closed',    cls: 'bg-green-100 text-green-700 border border-green-200' },
          { status: 'escalated', label: 'Escalated', cls: 'bg-purple-100 text-purple-700 border border-purple-200' },
        ].map(({ status, label, cls }) => (
          <span key={status} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${cls}`}>
            {counts[status] || 0} {label}
          </span>
        ))}
      </div>

      {/* Risk Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {risks.length === 0 ? (
          <p className="text-sm text-gray-600 p-8 text-center">No risks identified yet. Add the first one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Impact', 'Risk Description', 'Expected Impact', 'Owner', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {risks.map(risk => (
                  <tr key={risk.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${IMPACT_COLORS[risk.impact_level] || 'bg-gray-100 text-gray-600'}`}>
                        {risk.impact_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <p className="font-medium text-brand-slate leading-snug line-clamp-2">{risk.risk_description}</p>
                      {risk.budget_treatment && (
                        <p className="text-gray-600 mt-0.5 text-[10px] line-clamp-1">Treatment: {risk.budget_treatment}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] text-gray-600 line-clamp-2">{risk.expected_impact}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{risk.owner || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_CHIP[risk.status] || 'bg-gray-100 text-gray-600'}`}>
                        {risk.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {risk.status === 'open' && (
                          <button
                            onClick={() => updateMut.mutate({ riskId: risk.id, data: { status: 'mitigated' } })}
                            disabled={updateMut.isPending}
                            className="px-2 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs rounded-lg hover:bg-yellow-100 disabled:opacity-50 whitespace-nowrap"
                          >
                            Mitigate
                          </button>
                        )}
                        {risk.status !== 'closed' && (
                          <button
                            onClick={() => updateMut.mutate({ riskId: risk.id, data: { status: 'closed' } })}
                            disabled={updateMut.isPending}
                            className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 text-xs rounded-lg hover:bg-green-100 disabled:opacity-50 whitespace-nowrap"
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Risk Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-brand-slate">Add Risk</h3>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }}
                className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); createMut.mutate(form) }} className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Risk Description *</label>
                <textarea rows={3} value={form.risk_description} onChange={e => field('risk_description', e.target.value)}
                  placeholder="Describe the risk…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Expected Impact</label>
                <textarea rows={2} value={form.expected_impact} onChange={e => field('expected_impact', e.target.value)}
                  placeholder="What could happen if this risk materialises…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Budget Treatment</label>
                <textarea rows={2} value={form.budget_treatment} onChange={e => field('budget_treatment', e.target.value)}
                  placeholder="Mitigation cost or budget provision…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Realistic Range (KES)</label>
                  <input type="text" value={form.realistic_range} onChange={e => field('realistic_range', e.target.value)}
                    placeholder="e.g. 100k–500k"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Owner</label>
                  <input type="text" value={form.owner} onChange={e => field('owner', e.target.value)}
                    placeholder="Name / role"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Impact Level</label>
                  <select value={form.impact_level} onChange={e => field('impact_level', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                    {IMPACT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => field('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-red">
                    {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={createMut.isPending || !form.risk_description}
                  className="px-5 py-2 bg-brand-red text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                  {createMut.isPending ? 'Saving…' : 'Add Risk'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }}
                  className="px-5 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
