import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getClients, getOpportunities } from '../../api/crm'
import PageHeader from '../../components/common/PageHeader'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'

const clientColumns = [
  { key: 'name',         label: 'Client Name' },
  { key: 'contact_person', label: 'Contact Person' },
  { key: 'email',        label: 'Email' },
  { key: 'phone',        label: 'Phone' },
  { key: 'location',     label: 'Location' },
  { key: 'is_active',    label: 'Status', render: (r) => <Badge status={r.is_active ? 'active' : 'cancelled'} label={r.is_active ? 'Active' : 'Inactive'} /> },
]

const oppColumns = [
  { key: 'title',        label: 'Opportunity' },
  { key: 'client_name',  label: 'Client' },
  { key: 'tender_number', label: 'Tender No.' },
  { key: 'estimated_value', label: 'Est. Value', render: (r) => r.estimated_value ? `KES ${Number(r.estimated_value).toLocaleString()}` : '—' },
  { key: 'submission_deadline', label: 'Deadline' },
  { key: 'status',       label: 'Status', render: (r) => <Badge status={r.status} /> },
]

export default function CRMPage() {
  const [tab, setTab] = useState('clients')

  const { data: clientData } = useQuery({ queryKey: ['clients'],      queryFn: () => getClients({ page_size: 100 }) })
  const { data: oppData    } = useQuery({ queryKey: ['opportunities'], queryFn: () => getOpportunities({ page_size: 100 }) })

  const clients = clientData?.data?.results ?? []
  const opps    = oppData?.data?.results    ?? []

  return (
    <div>
      <PageHeader
        title="CRM"
        subtitle="Clients and tender opportunities"
        action={
          <button className="bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium px-4 py-2 rounded-lg">
            + New Client
          </button>
        }
      />

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {[['clients','Clients'], ['opportunities','Tender Opportunities']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === key ? 'bg-white text-brand-red shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'clients'       && <Table columns={clientColumns} data={clients} />}
      {tab === 'opportunities' && <Table columns={oppColumns}    data={opps} />}
    </div>
  )
}
