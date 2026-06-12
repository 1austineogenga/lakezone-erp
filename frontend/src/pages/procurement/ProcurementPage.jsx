import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getPRs, getPOs } from '../../api/procurement'
import PageHeader from '../../components/common/PageHeader'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'

const prColumns = [
  { key: 'reference_number', label: 'Reference' },
  { key: 'title',            label: 'Title' },
  { key: 'requested_by_name',label: 'Requested By' },
  { key: 'total_amount',     label: 'Amount', render: (r) => r.total_amount ? `TZS ${Number(r.total_amount).toLocaleString()}` : '—' },
  { key: 'date_required',    label: 'Date Required' },
  { key: 'status',           label: 'Status', render: (r) => <Badge status={r.status} /> },
]

const poColumns = [
  { key: 'reference_number', label: 'PO Number' },
  { key: 'supplier_name',    label: 'Supplier' },
  { key: 'total_amount',     label: 'Amount', render: (r) => r.total_amount ? `TZS ${Number(r.total_amount).toLocaleString()}` : '—' },
  { key: 'order_date',       label: 'Order Date' },
  { key: 'expected_delivery',label: 'Delivery Date' },
  { key: 'status',           label: 'Status', render: (r) => <Badge status={r.status} /> },
]

export default function ProcurementPage() {
  const [tab, setTab] = useState('pr')
  const navigate = useNavigate()

  const { data: prData, isLoading: prLoading } = useQuery({
    queryKey: ['prs'], queryFn: () => getPRs({ page_size: 50 }),
  })
  const { data: poData, isLoading: poLoading } = useQuery({
    queryKey: ['pos'], queryFn: () => getPOs({ page_size: 50 }),
  })

  const prs = prData?.data?.results ?? []
  const pos = poData?.data?.results ?? []

  return (
    <div>
      <PageHeader
        title="Procurement"
        subtitle="Purchase Requisitions and Purchase Orders"
        action={
          tab === 'pr' && (
            <button
              onClick={() => navigate('/procurement/new-pr')}
              className="bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              + New Requisition
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {[['pr', 'Purchase Requisitions'], ['po', 'Purchase Orders']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === key ? 'bg-white text-brand-red shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'pr' && (
        prLoading ? <p className="text-gray-400 text-sm">Loading…</p>
          : <Table columns={prColumns} data={prs} onRowClick={(r) => navigate(`/procurement/pr/${r.id}`)} />
      )}
      {tab === 'po' && (
        poLoading ? <p className="text-gray-400 text-sm">Loading…</p>
          : <Table columns={poColumns} data={pos} />
      )}
    </div>
  )
}
