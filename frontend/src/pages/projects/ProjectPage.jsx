import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Squares2X2Icon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  DocumentCheckIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  TruckIcon,
  UsersIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import { getProjectDashboard } from '../../api/projects'
import ProjectDashboard from './ProjectDashboard'
import BOQPage from './BOQPage'
import BudgetPage from './BudgetPage'
import IPCPage from './IPCPage'
import WeeklyProgressPage from './WeeklyProgressPage'
import RiskRegisterPage from './RiskRegisterPage'
import FleetAssignmentPage from './FleetAssignmentPage'
import TeamPage from './TeamPage'

const STATUS_COLORS = {
  planning:  'bg-gray-100 text-gray-600',
  active:    'bg-green-100 text-green-700',
  on_hold:   'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  suspended: 'bg-red-100 text-red-700',
}
const STATUS_LABELS = {
  planning: 'Planning', active: 'Active', on_hold: 'On Hold', completed: 'Completed', suspended: 'Suspended',
}

const TABS = [
  { id: 'dashboard',  label: 'Dashboard',       Icon: Squares2X2Icon },
  { id: 'boq',        label: 'BOQ',             Icon: ClipboardDocumentListIcon },
  { id: 'budget',     label: 'Budget',          Icon: BanknotesIcon },
  { id: 'ipcs',       label: 'IPCs',            Icon: DocumentCheckIcon },
  { id: 'progress',   label: 'Weekly Progress', Icon: CalendarDaysIcon },
  { id: 'risks',      label: 'Risk Register',   Icon: ExclamationTriangleIcon },
  { id: 'fleet',      label: 'Fleet',           Icon: TruckIcon },
  { id: 'team',       label: 'Team',            Icon: UsersIcon },
]

export default function ProjectPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('dashboard')

  // Use dashboard endpoint as single source of project info — it always returns project data
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['project-dashboard', projectId],
    queryFn: () => getProjectDashboard(projectId),
    select: r => r.data,
    enabled: !!projectId,
  })

  const project = dashData?.project || {}

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <ProjectDashboard dashData={dashData} />
      case 'boq':       return <BOQPage />
      case 'budget':    return <BudgetPage />
      case 'ipcs':      return <IPCPage />
      case 'progress':  return <WeeklyProgressPage />
      case 'risks':     return <RiskRegisterPage />
      case 'fleet':     return <FleetAssignmentPage />
      case 'team':      return <TeamPage />
      default:          return <ProjectDashboard dashData={dashData} />
    }
  }

  return (
    <div className="flex gap-0 h-full min-h-screen -m-6">
      {/* Left sidebar nav */}
      <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-100">
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-slate mb-3"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" /> All Projects
          </button>
          {isLoading ? (
            <div className="space-y-1">
              <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-brand-slate text-white text-xs font-bold px-2 py-0.5 rounded">
                  {project?.code || '—'}
                </span>
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project?.status] || STATUS_COLORS.planning}`}>
                  {STATUS_LABELS[project?.status] || project?.status || 'Planning'}
                </span>
              </div>
              <p className="text-xs font-semibold text-brand-slate leading-snug">
                {project?.name || project?.project_name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                KES {(project?.contract_value || 0).toLocaleString()}
              </p>
            </>
          )}
        </div>
        <nav className="flex-1 py-2">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-colors text-left
                ${activeTab === id
                  ? 'bg-red-50 text-brand-red border-r-2 border-brand-red'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-brand-slate'}`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {/* Project name banner */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
          <span className="bg-brand-slate text-white text-xs font-bold px-2 py-0.5 rounded">
            {project?.code || '—'}
          </span>
          <h1 className="text-sm font-semibold text-brand-slate truncate">
            {project?.name || 'Loading project…'}
          </h1>
          <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project?.status] || STATUS_COLORS.planning}`}>
            {STATUS_LABELS[project?.status] || ''}
          </span>
          <span className="ml-auto text-xs text-gray-400 shrink-0">
            Contract: <span className="font-medium text-brand-slate">KES {Number(project?.contract_value || 0).toLocaleString()}</span>
          </span>
        </div>
        <div className="p-6">
          {renderTab()}
        </div>
      </div>
    </div>
  )
}
