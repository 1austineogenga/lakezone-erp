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
    <div className="flex flex-col h-full min-h-0">
      {/* Horizontal tab bar */}
      <div className="bg-white border-b border-gray-100 px-5 pt-3 shrink-0">
        {NAV.map(section => (
          <div key={section.heading} className="flex items-center gap-1 mb-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mr-2 whitespace-nowrap">
              {section.heading}
            </span>
            {section.links.filter(l => l.roles.includes(role)).map(link => (
              <NavLink key={link.to} to={link.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-brand-red text-brand-red bg-brand-red/5'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}>
                {link.label}
              </NavLink>
            ))}
            <div className="border-b border-gray-100 flex-1 self-end mb-0 pb-0" />
          </div>
        ))}
      </div>

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
