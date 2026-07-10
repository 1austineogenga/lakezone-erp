import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Squares2X2Icon, ClipboardDocumentListIcon, BanknotesIcon, DocumentCheckIcon,
  CalendarDaysIcon, ExclamationTriangleIcon, TruckIcon, UsersIcon, ArrowLeftIcon,
  DocumentTextIcon, ListBulletIcon, PhotoIcon, ChartBarIcon, BookOpenIcon,
  BeakerIcon, ExclamationCircleIcon, QuestionMarkCircleIcon, ShieldExclamationIcon,
  BuildingOfficeIcon, MapPinIcon, ChevronDownIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline'
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

// ── Sidebar navigation groups ─────────────────────────────────────────────────

const NAV = [
  {
    group: null,
    items: [
      { id: 'dashboard', label: 'Dashboard', Icon: Squares2X2Icon },
    ],
  },
  {
    group: 'Planning',
    items: [
      { id: 'boq',     label: 'Bill of Quantities', Icon: ClipboardDocumentListIcon },
      { id: 'budget',  label: 'Budget / Workbook',  Icon: BanknotesIcon },
      { id: 'wbs',     label: 'WBS / Activities',   Icon: ListBulletIcon },
      { id: 'chainage',label: 'Chainage Segments',  Icon: MapPinIcon },
    ],
  },
  {
    group: 'Commercial',
    items: [
      { id: 'ipcs',    label: 'IPCs',               Icon: DocumentCheckIcon },
      { id: 'evm',     label: 'EVM & Finance',      Icon: ChartBarIcon },
    ],
  },
  {
    group: 'Execution',
    items: [
      { id: 'site-diary', label: 'Site Diary',      Icon: BookOpenIcon },
      { id: 'progress',   label: 'Weekly Progress', Icon: CalendarDaysIcon },
    ],
  },
  {
    group: 'Quality & Safety',
    items: [
      { id: 'qa',       label: 'QA / Testing',      Icon: BeakerIcon },
      { id: 'ncr',      label: 'NCR',               Icon: ExclamationCircleIcon },
      { id: 'rfi-list', label: 'RFIs',              Icon: QuestionMarkCircleIcon },
      { id: 'safety',   label: 'Safety',            Icon: ShieldExclamationIcon },
    ],
  },
  {
    group: 'Resources',
    items: [
      { id: 'subcontractors', label: 'Subcontractors', Icon: BuildingOfficeIcon },
      { id: 'fleet',          label: 'Fleet',           Icon: TruckIcon },
      { id: 'team',           label: 'Team',            Icon: UsersIcon },
    ],
  },
  {
    group: 'Management',
    items: [
      { id: 'risks',   label: 'Risk Register',      Icon: ExclamationTriangleIcon },
      { id: 'photos',  label: 'Photos',             Icon: PhotoIcon },
      { id: 'reports', label: 'Reports',            Icon: DocumentTextIcon },
    ],
  },
]

// ── Sidebar link component ────────────────────────────────────────────────────

function NavItem({ item, active, onClick }) {
  return (
    <button
      onClick={() => onClick(item.id)}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors
        ${active
          ? 'bg-brand-red text-white'
          : 'text-gray-600 hover:bg-gray-100 hover:text-brand-slate'}`}
    >
      <item.Icon className="h-4 w-4 flex-shrink-0" />
      {item.label}
    </button>
  )
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
  const [activeTab, setActiveTab] = useState('dashboard')
  const [collapsed, setCollapsed] = useState({})

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['project-dashboard', projectId],
    queryFn: () => getProjectDashboard(projectId),
    select: r => r.data,
    enabled: !!projectId,
  })

  const project = dashData?.project || {}

  const toggleGroup = g => setCollapsed(c => ({ ...c, [g]: !c[g] }))

  return (
    <div className="flex h-full min-h-screen -m-6">

      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">

        {/* Project identity */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-slate mb-2"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" /> All Projects
          </button>
          {isLoading
            ? <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
            : <>
                <span className="inline-block bg-brand-slate text-white text-xs font-bold px-2 py-0.5 rounded mb-1">
                  {project.code || '—'}
                </span>
                <p className="text-xs font-semibold text-brand-slate leading-tight truncate">
                  {project.name || 'Loading…'}
                </p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project.status] || STATUS_COLORS.planning}`}>
                  {STATUS_LABELS[project.status] || '—'}
                </span>
              </>
          }
        </div>

        {/* Contract value chip */}
        {!isLoading && project.contract_value && (
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-400">Contract Value</p>
            <p className="text-xs font-semibold text-brand-slate">
              KES {Number(project.contract_value).toLocaleString()}
            </p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(({ group, items }) => (
            <div key={group || '__top'} className="mb-1">
              {group && (
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-600"
                >
                  {group}
                  {collapsed[group]
                    ? <ChevronRightIcon className="h-3 w-3" />
                    : <ChevronDownIcon  className="h-3 w-3" />}
                </button>
              )}
              {!collapsed[group] && items.map(item => (
                <NavItem
                  key={item.id}
                  item={item}
                  active={activeTab === item.id}
                  onClick={setActiveTab}
                />
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Thin top bar showing current section */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0">
          {(() => {
            const all = NAV.flatMap(g => g.items)
            const cur = all.find(i => i.id === activeTab)
            return cur
              ? <>
                  <cur.Icon className="h-4 w-4 text-brand-red" />
                  <span className="text-sm font-semibold text-brand-slate">{cur.label}</span>
                </>
              : null
          })()}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto p-6">
          {renderContent(activeTab, dashData, project)}
        </div>
      </div>
    </div>
  )
}
