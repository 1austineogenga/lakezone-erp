import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import {
  ChartBarIcon, TruckIcon, WrenchScrewdriverIcon, BeakerIcon,
  ArrowTrendingUpIcon, ExclamationTriangleIcon, KeyIcon, ArrowDownTrayIcon,
  MapIcon, CurrencyDollarIcon, Cog6ToothIcon, SparklesIcon,
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

const TABS = (role) => [
  { label: 'Dashboard',    path: '/fleet',              icon: ChartBarIcon,           exact: true },
  { label: 'Vehicles',     path: '/fleet/vehicles',     icon: TruckIcon },
  { label: 'Maintenance',  path: '/fleet/maintenance',  icon: WrenchScrewdriverIcon },
  { label: 'Fuel Report',  path: '/fleet/fuel',         icon: BeakerIcon },
  { label: 'Trip Report',  path: '/fleet/trips',        icon: ArrowTrendingUpIcon },
  { label: 'Alerts',       path: '/fleet/alerts',       icon: ExclamationTriangleIcon },
  { label: 'Release Log',  path: '/fleet/key-issuance', icon: KeyIcon },
  ...(role === 'system_admin' ? [
    { label: 'Receiving',    path: '/fleet/receiving',    icon: ArrowDownTrayIcon },
    { label: 'Adv. Fuel',   path: '/fleet/enhanced-fuel',icon: SparklesIcon },
    { label: 'Geofences',   path: '/fleet/geofences',    icon: MapIcon },
    { label: 'Fuel Prices', path: '/fleet/fuel-prices',  icon: CurrencyDollarIcon },
    { label: 'Settings',    path: '/fleet/settings',     icon: Cog6ToothIcon },
  ] : []),
]

export default function FleetPage() {
  const { user } = useAuthStore()
  const location  = useLocation()
  const navigate  = useNavigate()
  const role      = user?.role || ''

  const tabs = TABS(role)

  const activeTab = tabs.find(t =>
    t.exact
      ? location.pathname === t.path
      : location.pathname === t.path || location.pathname.startsWith(t.path + '/')
  ) || tabs[0]

  return (
    <div className="flex flex-col -m-4 lg:-m-6 h-full min-h-screen">

      {/* ── Sticky Header ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 pt-4 sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-lg font-bold text-brand-slate">Fleet</h1>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">{activeTab?.label}</span>
        </div>

        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {tabs.map(({ label, path, icon: Icon, exact }) => {
            const isActive = exact
              ? location.pathname === path
              : location.pathname === path || location.pathname.startsWith(path + '/')
            return (
              <button key={path}
                onClick={() => navigate(path)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px whitespace-nowrap transition-colors
                  ${isActive
                    ? 'border-brand-red text-brand-red bg-red-50/40'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            )
          })}
        </div>
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
