import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { getProjectDashboard } from '../../api/projects'

import ProjectDashboard    from './ProjectDashboard'
import WBSPage             from './WBSPage'
import PhotoTimelinePage   from './PhotoTimelinePage'
import BOQPage             from './BOQPage'
import BudgetPage          from './BudgetPage'
import IPCPage             from './IPCPage'
import WeeklyProgressPage  from './WeeklyProgressPage'
import EVMPage             from './EVMPage'
import RiskRegisterPage    from './RiskRegisterPage'
import FleetAssignmentPage from './FleetAssignmentPage'
import TeamPage            from './TeamPage'
import ForemanDailyReportPage   from './ForemanDailyReportPage'
import ForemanWeeklyReportPage  from './ForemanWeeklyReportPage'
import SurveyorDailyReportPage  from './SurveyorDailyReportPage'
import SurveyorWeeklyReportPage from './SurveyorWeeklyReportPage'
import RFIPage             from './RFIPage'
import SiteDiaryPage       from './SiteDiaryPage'
import QAPage              from './QAPage'
import NCRPage             from './NCRPage'
import RFIListPage         from './RFIListPage'
import SafetyPage          from './SafetyPage'
import SubcontractorsPage  from './SubcontractorsPage'
import ChainagePage        from './ChainagePage'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  planning:  'bg-gray-100 text-gray-600',
  active:    'bg-green-100 text-green-700',
  on_hold:   'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  suspended: 'bg-red-100 text-red-700',
}
const STATUS_LABELS = {
  planning: 'Planning', active: 'Active', on_hold: 'On Hold',
  completed: 'Completed', suspended: 'Suspended',
}

// ── Reports sub-tab render ────────────────────────────────────────────────────

function ReportsView() {
  const [sub, setSub] = useState('foreman-daily')
  const SUB_TABS = [
    { key: 'foreman-daily',   label: 'Foreman Daily' },
    { key: 'foreman-weekly',  label: 'Foreman Weekly' },
    { key: 'surveyor-daily',  label: 'Surveyor Daily' },
    { key: 'surveyor-weekly', label: 'Surveyor Weekly' },
    { key: 'rfi-form',        label: 'RFI Form' },
  ]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setSub(t.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors
              ${sub === t.key ? 'bg-brand-red text-white border-brand-red' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-red'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'foreman-daily'   && <ForemanDailyReportPage />}
      {sub === 'foreman-weekly'  && <ForemanWeeklyReportPage />}
      {sub === 'surveyor-daily'  && <SurveyorDailyReportPage />}
      {sub === 'surveyor-weekly' && <SurveyorWeeklyReportPage />}
      {sub === 'rfi-form'        && <RFIPage />}
    </div>
  )
}

// ── Main render ───────────────────────────────────────────────────────────────

function renderContent(tab, dashData, project) {
  switch (tab) {
    case 'dashboard':      return <ProjectDashboard dashData={dashData} />
    case 'boq':            return <BOQPage projectName={project.name} />
    case 'budget':         return <BudgetPage />
    case 'wbs':            return <WBSPage />
    case 'chainage':       return <ChainagePage />
    case 'ipcs':           return <IPCPage />
    case 'evm':            return <EVMPage />
    case 'site-diary':     return <SiteDiaryPage />
    case 'progress':       return <WeeklyProgressPage />
    case 'qa':             return <QAPage />
    case 'ncr':            return <NCRPage />
    case 'rfi-list':       return <RFIListPage />
    case 'safety':         return <SafetyPage />
    case 'subcontractors': return <SubcontractorsPage />
    case 'fleet':          return <FleetAssignmentPage />
    case 'team':           return <TeamPage />
    case 'risks':          return <RiskRegisterPage />
    case 'photos':         return <PhotoTimelinePage projectName={project.name} />
    case 'reports':        return <ReportsView />
    default:               return <ProjectDashboard dashData={dashData} />
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'dashboard'

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['project-dashboard', projectId],
    queryFn: () => getProjectDashboard(projectId),
    select: r => r.data,
    enabled: !!projectId,
  })

  const project = dashData?.project || {}

  return (
    <div className="space-y-4">
      {/* Project identity bar */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/projects')}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-slate">
          <ArrowLeftIcon className="h-3.5 w-3.5" /> All Projects
        </button>
        {!isLoading && (
          <>
            <span className="text-gray-300">·</span>
            <span className="bg-brand-slate text-white text-xs font-bold px-2 py-0.5 rounded">{project.code || '—'}</span>
            <span className="text-sm font-semibold text-brand-slate truncate">{project.name}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project.status] || STATUS_COLORS.planning}`}>
              {STATUS_LABELS[project.status] || '—'}
            </span>
          </>
        )}
      </div>

      {renderContent(activeTab, dashData, project)}
    </div>
  )
}
