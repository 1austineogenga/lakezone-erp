import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import usePermissions from '../../hooks/usePermissions'
import ForemanDailyReportPage from '../projects/ForemanDailyReportPage'
import ForemanWeeklyReportPage from '../projects/ForemanWeeklyReportPage'
import SurveyorDailyReportPage from '../projects/SurveyorDailyReportPage'
import SurveyorWeeklyReportPage from '../projects/SurveyorWeeklyReportPage'
import MachineDailyReportPage from '../fleet/MachineDailyReportPage'
import MachineWeeklyReportPage from '../fleet/MachineWeeklyReportPage'

const NAV = [
  { key: 'daily', heading: 'Daily Reports', paths: ['/reports/machine/daily', '/reports/surveyor/daily', '/reports/foreman/daily'], links: [
    { to: '/reports/machine/daily',   label: 'Machine Reports',   roles: ['equipment_operator','driver','site_manager','site_engineer','admin_officer','hr_manager','finance_officer','finance_manager','managing_director','general_manager','system_admin','fleet_manager'] },
    { to: '/reports/surveyor/daily',  label: 'Surveyor Reports',  roles: ['site_surveyor','site_manager','site_engineer','admin_officer','hr_manager','finance_officer','finance_manager','managing_director','general_manager','system_admin','fleet_manager'] },
    { to: '/reports/foreman/daily',   label: 'Foreman Reports',   roles: ['site_foreman','site_manager','site_engineer','admin_officer','hr_manager','finance_officer','finance_manager','managing_director','general_manager','system_admin','fleet_manager'] },
  ]},
  { key: 'weekly', heading: 'Weekly Reports', paths: ['/reports/machine/weekly', '/reports/surveyor/weekly', '/reports/foreman/weekly'], links: [
    { to: '/reports/machine/weekly',  label: 'Machine Reports',   roles: ['equipment_operator','driver','site_manager','site_engineer','admin_officer','hr_manager','finance_officer','finance_manager','managing_director','general_manager','system_admin','fleet_manager'] },
    { to: '/reports/surveyor/weekly', label: 'Surveyor Reports',  roles: ['site_surveyor','site_manager','site_engineer','admin_officer','hr_manager','finance_officer','finance_manager','managing_director','general_manager','system_admin','fleet_manager'] },
    { to: '/reports/foreman/weekly',  label: 'Foreman Reports',   roles: ['site_foreman','site_manager','site_engineer','admin_officer','hr_manager','finance_officer','finance_manager','managing_director','general_manager','system_admin','fleet_manager'] },
  ]},
]

export default function SiteReportingPage() {
  const { role } = usePermissions()
  const location = useLocation()

  const defaultRoute =
    role === 'site_foreman' ? '/reports/foreman/daily' :
    role === 'site_surveyor' ? '/reports/surveyor/daily' :
    (role === 'equipment_operator' || role === 'driver') ? '/reports/machine/daily' :
    '/reports/foreman/daily'

  const activeSection = NAV.find(s => s.paths.some(p => location.pathname.startsWith(p))) ?? NAV[0]

  // Default sub-link for each section (first accessible link)
  const defaultSub = (section) =>
    section.links.find(l => l.roles.includes(role))?.to ?? section.links[0].to

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Primary tabs — Daily / Weekly */}
      <div className="bg-white border-b border-gray-200 px-5 shrink-0">
        <div className="flex gap-1">
          {NAV.map(section => {
            const isActive = section.key === activeSection.key
            return (
              <NavLink
                key={section.key}
                to={defaultSub(section)}
                className={() =>
                  `px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-brand-red text-brand-red'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                {section.heading}
              </NavLink>
            )
          })}
        </div>
      </div>

      {/* Secondary tabs — report type */}
      <div className="bg-gray-50 border-b border-gray-200 px-5 shrink-0">
        <div className="flex gap-1">
          {activeSection.links.filter(l => l.roles.includes(role)).map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `px-4 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-brand-red text-brand-red bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-white'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
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
