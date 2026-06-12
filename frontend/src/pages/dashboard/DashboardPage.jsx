import { useQuery } from '@tanstack/react-query'
import {
  FolderIcon, ClipboardDocumentListIcon,
  CubeIcon, UserGroupIcon,
} from '@heroicons/react/24/outline'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import StatCard from '../../components/common/StatCard'
import PageHeader from '../../components/common/PageHeader'
import Badge from '../../components/common/Badge'
import { getProjects } from '../../api/projects'
import { getPRs } from '../../api/procurement'
import { getStockLevels } from '../../api/inventory'
import useAuthStore from '../../store/authStore'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: () => getProjects({ page_size: 100 }) })
  const { data: prs }      = useQuery({ queryKey: ['prs'],      queryFn: () => getPRs({ page_size: 100 }) })
  const { data: levels }   = useQuery({ queryKey: ['levels'],   queryFn: () => getStockLevels({ page_size: 100 }) })

  const projectList = projects?.data?.results ?? []
  const prList      = prs?.data?.results ?? []
  const levelList   = levels?.data?.results ?? []

  const activeProjects = projectList.filter((p) => p.status === 'active').length
  const pendingPRs     = prList.filter((p) => p.status === 'pending').length
  const lowStock       = levelList.filter((l) => l.is_below_reorder).length

  const chartData = [
    { name: 'Active',    count: projectList.filter((p) => p.status === 'active').length },
    { name: 'Planning',  count: projectList.filter((p) => p.status === 'planning').length },
    { name: 'Completed', count: projectList.filter((p) => p.status === 'completed').length },
    { name: 'On Hold',   count: projectList.filter((p) => p.status === 'on_hold').length },
  ]

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.first_name ?? 'User'}`}
        subtitle="Here's what's happening at Lake Zone Enterprises today."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Projects"    value={projectList.length} icon={FolderIcon}                  color="red"   sub={`${activeProjects} active`} />
        <StatCard label="Pending PRs"       value={pendingPRs}         icon={ClipboardDocumentListIcon}   color="slate" sub="Awaiting approval" />
        <StatCard label="Low Stock Alerts"  value={lowStock}           icon={CubeIcon}                   color="amber" sub="Below reorder level" />
        <StatCard label="Total PRs"         value={prList.length}      icon={ClipboardDocumentListIcon}   color="green" sub="All requisitions" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Projects chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-brand-slate mb-4">Projects by Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#BF2026" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent PRs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-brand-slate mb-4">Recent Purchase Requisitions</h3>
          <div className="space-y-3">
            {prList.slice(0, 5).map((pr) => (
              <div key={pr.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium text-gray-700">{pr.reference_number}</p>
                  <p className="text-xs text-gray-400">{pr.requested_by_name}</p>
                </div>
                <Badge status={pr.status} />
              </div>
            ))}
            {prList.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No requisitions yet</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
