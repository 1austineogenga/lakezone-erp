import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import usePermissions from '../../hooks/usePermissions'
import useAuthStore from '../../store/authStore'
import ForemanDailyReportPage from '../projects/ForemanDailyReportPage'
import ForemanWeeklyReportPage from '../projects/ForemanWeeklyReportPage'
import SurveyorDailyReportPage from '../projects/SurveyorDailyReportPage'
import SurveyorWeeklyReportPage from '../projects/SurveyorWeeklyReportPage'
import MachineDailyReportPage from '../fleet/MachineDailyReportPage'
import MachineWeeklyReportPage from '../fleet/MachineWeeklyReportPage'

const NAV = [
  { heading: 'Daily Reports', links: [
    { to: '/reports/machine/daily',   label: 'Machine Reports',   roles: ['equipment_operator','driver','site_manager','site_engineer','admin_officer','hr_manager','finance_officer','finance_manager','managing_director','general_manager','system_admin','fleet_manager'] },
    { to: '/reports/surveyor/daily',  label: 'Surveyor Reports',  roles: ['site_surveyor','site_manager','site_engineer','admin_officer','hr_manager','finance_officer','finance_manager','managing_director','general_manager','system_admin','fleet_manager'] },
    { to: '/reports/foreman/daily',   label: 'Foreman Reports',   roles: ['site_foreman','site_manager','site_engineer','admin_officer','hr_manager','finance_officer','finance_manager','managing_director','general_manager','system_admin','fleet_manager'] },
  ]},
  { heading: 'Weekly Reports', links: [
    { to: '/reports/machine/weekly',  label: 'Machine Reports',   roles: ['equipment_operator','driver','site_manager','site_engineer','admin_officer','hr_manager','finance_officer','finance_manager','managing_director','general_manager','system_admin','fleet_manager'] },
    { to: '/reports/surveyor/weekly', label: 'Surveyor Reports',  roles: ['site_surveyor','site_manager','site_engineer','admin_officer','hr_manager','finance_officer','finance_manager','managing_director','general_manager','system_admin','fleet_manager'] },
    { to: '/reports/foreman/weekly',  label: 'Foreman Reports',   roles: ['site_foreman','site_manager','site_engineer','admin_officer','hr_manager','finance_officer','finance_manager','managing_director','general_manager','system_admin','fleet_manager'] },
  ]},
]

export default function SiteReportingPage() {
  const { role } = usePermissions()

  const defaultRoute =
    role === 'site_foreman' ? '/reports/foreman/daily' :
    role === 'site_surveyor' ? '/reports/surveyor/daily' :
    (role === 'equipment_operator' || role === 'driver') ? '/reports/machine/daily' :
    '/reports/foreman/daily'

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* Left nav */}
      <aside className="w-44 shrink-0 bg-white border-r border-gray-100 py-4 px-2 space-y-4 overflow-y-auto">
        {NAV.map(section => (
          <div key={section.heading}>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{section.heading}</p>
            {section.links.filter(l => l.roles.includes(role)).map(link => (
              <NavLink key={link.to} to={link.to}
                className={({ isActive }) =>
                  `block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isActive ? 'bg-brand-red/10 text-brand-red' : 'text-gray-600 hover:bg-gray-50'}`}>
                {link.label}
              </NavLink>
            ))}
          </div>
        ))}
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <Routes>
          <Route index element={<Navigate to={defaultRoute} replace />} />
          <Route path="foreman/daily"   element={<ForemanDailyReportPage />} />
          <Route path="foreman/weekly"  element={<ForemanWeeklyReportPage />} />
          <Route path="surveyor/daily"  element={<SurveyorDailyReportPage />} />
          <Route path="surveyor/weekly" element={<SurveyorWeeklyReportPage />} />
          <Route path="machine/daily"   element={<MachineDailyReportPage />} />
          <Route path="machine/weekly"  element={<MachineWeeklyReportPage />} />
        </Routes>
      </div>
    </div>
  )
}
