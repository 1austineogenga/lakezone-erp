import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject, getProjectBOQ, getCosting } from '../../api/projects'
import PageHeader from '../../components/common/PageHeader'
import Badge from '../../components/common/Badge'
import Table from '../../components/common/Table'

const boqColumns = [
  { key: 'description',  label: 'Description' },
  { key: 'unit',         label: 'Unit' },
  { key: 'quantity',     label: 'Qty', render: (r) => Number(r.quantity).toLocaleString() },
  { key: 'unit_rate',    label: 'Unit Rate', render: (r) => `KES ${Number(r.unit_rate).toLocaleString()}` },
  { key: 'total_cost',   label: 'Total Cost', render: (r) => `KES ${Number(r.total_cost).toLocaleString()}` },
]

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: pData } = useQuery({ queryKey: ['project', id], queryFn: () => getProject(id) })
  const { data: boqData } = useQuery({ queryKey: ['boq', id], queryFn: () => getProjectBOQ(id) })
  const { data: costData } = useQuery({ queryKey: ['costing', id], queryFn: () => getCosting(id) })

  const project = pData?.data
  const boq = boqData?.data?.results ?? []
  const costing = costData?.data ?? {}

  if (!project) return <p className="text-gray-600 text-sm p-6">Loading…</p>

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle={project.location}
        action={
          <button onClick={() => navigate('/projects')} className="text-sm text-brand-slate underline">
            ← Back
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Status',          value: <Badge status={project.status} /> },
          { label: 'Contract Value',  value: project.contract_value ? `KES ${Number(project.contract_value).toLocaleString()}` : '—' },
          { label: 'BOQ Total',       value: costing.boq_total ? `KES ${Number(costing.boq_total).toLocaleString()}` : '—' },
          { label: 'Actual Cost',     value: costing.actual_total ? `KES ${Number(costing.actual_total).toLocaleString()}` : '—' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-600 mb-1">{c.label}</p>
            <div className="font-semibold text-gray-800">{c.value}</div>
          </div>
        ))}
      </div>

      {/* BOQ */}
      <h3 className="text-sm font-semibold text-brand-slate mb-3">Bill of Quantities</h3>
      <Table columns={boqColumns} data={boq} />
    </div>
  )
}
