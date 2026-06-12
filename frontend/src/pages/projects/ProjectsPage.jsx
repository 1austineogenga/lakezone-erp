import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getProjects } from '../../api/projects'
import PageHeader from '../../components/common/PageHeader'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'

const columns = [
  { key: 'name',          label: 'Project Name' },
  { key: 'client_name',   label: 'Client' },
  { key: 'location',      label: 'Location' },
  { key: 'contract_value',label: 'Contract Value', render: (r) => r.contract_value ? `TZS ${Number(r.contract_value).toLocaleString()}` : '—' },
  { key: 'start_date',    label: 'Start Date' },
  { key: 'status',        label: 'Status', render: (r) => <Badge status={r.status} /> },
]

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects({ page_size: 50 }),
  })
  const projects = data?.data?.results ?? []

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="All construction and civil engineering projects"
        action={
          <button
            onClick={() => navigate('/projects/new')}
            className="bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            + New Project
          </button>
        }
      />
      {isLoading
        ? <p className="text-gray-400 text-sm">Loading…</p>
        : <Table columns={columns} data={projects} onRowClick={(r) => navigate(`/projects/${r.id}`)} />
      }
    </div>
  )
}
