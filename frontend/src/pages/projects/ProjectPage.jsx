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
  DocumentTextIcon,
  ListBulletIcon,
  PhotoIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { getProjectDashboard } from '../../api/projects'
import EVMPage from './EVMPage'
import ProjectDashboard from './ProjectDashboard'
import BOQPage from './BOQPage'
import BudgetPage from './BudgetPage'
import IPCPage from './IPCPage'
import WeeklyProgressPage from './WeeklyProgressPage'
import RiskRegisterPage from './RiskRegisterPage'
import FleetAssignmentPage from './FleetAssignmentPage'
import TeamPage from './TeamPage'
import ForemanDailyReportPage from './ForemanDailyReportPage'
import ForemanWeeklyReportPage from './ForemanWeeklyReportPage'
import SurveyorDailyReportPage from './SurveyorDailyReportPage'
import SurveyorWeeklyReportPage from './SurveyorWeeklyReportPage'
import RFIPage from './RFIPage'
import WBSPage from './WBSPage'
import PhotoTimelinePage from './PhotoTimelinePage'

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
  { id: 'wbs',        label: 'WBS / Activities',Icon: ListBulletIcon },
  { id: 'photos',     label: 'Photos',          Icon: PhotoIcon },
  { id: 'boq',        label: 'BOQ',             Icon: ClipboardDocumentListIcon },
  { id: 'budget',     label: 'Budget',          Icon: BanknotesIcon },
  { id: 'ipcs',       label: 'IPCs',            Icon: DocumentCheckIcon },
  { id: 'progress',   label: 'Weekly Progress', Icon: CalendarDaysIcon },
  { id: 'evm',        label: 'EVM & Finance',   Icon: ChartBarIcon },
  { id: 'risks',      label: 'Risk Register',   Icon: ExclamationTriangleIcon },
  { id: 'fleet',      label: 'Fleet',           Icon: TruckIcon },
  { id: 'team',       label: 'Team',            Icon: UsersIcon },
  { id: 'reports',    label: 'Reports',         Icon: DocumentTextIcon },
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

  const [reportSubTab, setReportSubTab] = useState('foreman-daily')

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <ProjectDashboard dashData={dashData} />
      case 'wbs':       return <WBSPage />
      case 'photos':    return <PhotoTimelinePage projectName={project.name} />
      case 'boq':       return <BOQPage projectName={project.name} />
      case 'budget':    return <BudgetPage />
      case 'ipcs':      return <IPCPage />
      case 'progress':  return <WeeklyProgressPage />
      case 'evm':       return <EVMPage />
      case 'risks':     return <RiskRegisterPage />
      case 'fleet':     return <FleetAssignmentPage />
      case 'team':      return <TeamPage />
      case 'reports':   return (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'foreman-daily',   label: 'Foreman Daily' },
              { key: 'foreman-weekly',  label: 'Foreman Weekly' },
              { key: 'surveyor-daily',  label: 'Surveyor Daily' },
              { key: 'surveyor-weekly', label: 'Surveyor Weekly' },
              { key: 'rfi',             label: 'Request for Inspection' },
            ].map(opt => (
              <button key={opt.key} onClick={() => setReportSubTab(opt.key)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors
                  ${reportSubTab === opt.key ? 'bg-brand-red text-white border-brand-red' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-red'}`}>
                {opt.label}
              </button>
            ))}
          </div>
          {reportSubTab === 'foreman-daily'   && <ForemanDailyReportPage />}
          {reportSubTab === 'foreman-weekly'  && <ForemanWeeklyReportPage />}
          {reportSubTab === 'surveyor-daily'  && <SurveyorDailyReportPage />}
          {reportSubTab === 'surveyor-weekly' && <SurveyorWeeklyReportPage />}
          {reportSubTab === 'rfi'             && <RFIPage />}
        </div>
      )
      default:          return <ProjectDashboard dashData={dashData} />
    }
  }

  return (
    <div className="flex flex-col h-full min-h-screen -m-6">
      {/* Top header bar */}
      <div className="bg-white border-b border-gray-200 px-6 pt-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-slate"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" /> All Projects
          </button>
          <span className="text-gray-600">|</span>
          {isLoading ? (
            <div className="h-4 bg-gray-100 rounded animate-pulse w-48" />
          ) : (
            <>
              <span className="bg-brand-slate text-white text-xs font-bold px-2 py-0.5 rounded">
                {project?.code || '—'}
              </span>
              <h1 className="text-sm font-semibold text-brand-slate truncate">
                {project?.name || 'Loading project…'}
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project?.status] || STATUS_COLORS.planning}`}>
                {STATUS_LABELS[project?.status] || ''}
              </span>
              <span className="ml-auto text-xs text-gray-600 shrink-0">
                Contract: <span className="font-medium text-brand-slate">KES {Number(project?.contract_value || 0).toLocaleString()}</span>
              </span>
            </>
          )}
        </div>

        {/* Horizontal tabs */}
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors
                ${activeTab === id
                  ? 'border-brand-red text-brand-red'
                  : 'border-transparent text-gray-500 hover:text-brand-slate hover:border-gray-300'}`}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        {renderTab()}
      </div>
    </div>
  )
}
