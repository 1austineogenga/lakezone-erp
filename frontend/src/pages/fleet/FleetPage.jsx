import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import {
  ChartBarIcon, TruckIcon, ArrowTrendingUpIcon, MapIcon,
} from '@heroicons/react/24/outline'

import FleetDashboard          from './FleetDashboard'
import VehiclesPage            from './VehiclesPage'
import VehicleDetailPage       from './VehicleDetailPage'
import FuelReportPage          from './FuelReportPage'
import TripsReportPage         from './TripsReportPage'
import AlertsPage              from './AlertsPage'
import MaintenancePage         from './MaintenancePage'
import FleetSettingsPage       from './FleetSettingsPage'
import MachineWeeklyReportPage from './MachineWeeklyReportPage'
import MachineDailyReportPage  from './MachineDailyReportPage'
import EnhancedFuelReportPage  from './EnhancedFuelReportPage'
import GeofenceManagementPage  from './GeofenceManagementPage'
import FuelPriceManagementPage from './FuelPriceManagementPage'
import VehicleReceivingPage    from './VehicleReceivingPage'
import KeyIssuancePage         from './KeyIssuancePage'

const GROUPS = (role) => [
  {
    id: 'overview',
    label: 'Dashboard',
    icon: ChartBarIcon,
    paths: ['/fleet'],
    defaultPath: '/fleet',
    exact: true,
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    icon: TruckIcon,
    defaultPath: '/fleet/vehicles',
    paths: ['/fleet/vehicles', '/fleet/maintenance', '/fleet/key-issuance', '/fleet/receiving'],
    tabs: [
      { label: 'Vehicles',     path: '/fleet/vehicles' },
      { label: 'Maintenance',  path: '/fleet/maintenance' },
      { label: 'Release Log',  path: '/fleet/key-issuance' },
      ...(role === 'system_admin' ? [{ label: 'Receiving', path: '/fleet/receiving' }] : []),
    ],
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    icon: ArrowTrendingUpIcon,
    defaultPath: '/fleet/fuel',
    paths: ['/fleet/fuel', '/fleet/trips', '/fleet/alerts', '/fleet/enhanced-fuel'],
    tabs: [
      { label: 'Fuel Report', path: '/fleet/fuel' },
      { label: 'Trip Report', path: '/fleet/trips' },
      { label: 'Alerts',      path: '/fleet/alerts' },
      ...(role === 'system_admin' ? [{ label: 'Adv. Fuel', path: '/fleet/enhanced-fuel' }] : []),
    ],
  },
  ...(role === 'system_admin' ? [{
    id: 'control',
    label: 'Control',
    icon: MapIcon,
    defaultPath: '/fleet/geofences',
    paths: ['/fleet/geofences', '/fleet/fuel-prices', '/fleet/settings'],
    tabs: [
      { label: 'Geofences',    path: '/fleet/geofences' },
      { label: 'Fuel Prices',  path: '/fleet/fuel-prices' },
      { label: 'API Settings', path: '/fleet/settings' },
    ],
  }] : []),
]

export default function FleetPage() {
  const { user } = useAuthStore()
  const location  = useLocation()
  const navigate  = useNavigate()
  const role      = user?.role || ''

  const groups = GROUPS(role)

  const matchPath = (p) => location.pathname === p || location.pathname.startsWith(p + '/')

  const activeGroup = groups.find(g =>
    g.exact
      ? location.pathname === g.defaultPath || location.pathname === '/fleet'
      : g.paths.some(p => matchPath(p))
  ) || groups[0]

  const activeTab = activeGroup?.tabs?.find(t => matchPath(t.path)) || activeGroup?.tabs?.[0]

  return (
    <div className="flex flex-col -m-4 lg:-m-6 h-full min-h-screen">

      {/* ── Sticky Header ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 pt-4 sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-lg font-bold text-brand-slate">Fleet</h1>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">{activeGroup?.label}{activeTab ? ` — ${activeTab.label}` : ''}</span>
        </div>

        {/* Sub-tab bar — only when active group has tabs */}
        {activeGroup?.tabs && activeGroup.tabs.length > 0 && (
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {activeGroup.tabs.map(({ label, path }) => {
              const isActive = matchPath(path)
              return (
                <button key={path}
                  onClick={() => navigate(path)}
                  className={`px-4 py-2.5 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors -mb-px border-b-2
                    ${isActive
                      ? 'border-brand-red text-brand-red bg-red-50/40'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Page Content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route index element={<FleetDashboard />} />
          <Route path="vehicles" element={<VehiclesPage />} />
          <Route path="vehicles/:id" element={<VehicleDetailPage />} />
          <Route path="vehicles/:id/weekly-report" element={<MachineWeeklyReportPage />} />
          <Route path="vehicles/:id/daily-report" element={<MachineDailyReportPage />} />
          <Route path="fuel" element={<FuelReportPage />} />
          <Route path="trips" element={<TripsReportPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="enhanced-fuel" element={<EnhancedFuelReportPage />} />
          <Route path="geofences" element={<GeofenceManagementPage />} />
          <Route path="fuel-prices" element={<FuelPriceManagementPage />} />
          <Route path="receiving" element={<VehicleReceivingPage />} />
          <Route path="key-issuance" element={<KeyIssuancePage />} />
          <Route path="settings" element={<FleetSettingsPage />} />
          <Route path="*" element={<Navigate to="" replace />} />
        </Routes>
      </div>
    </div>
  )
}
