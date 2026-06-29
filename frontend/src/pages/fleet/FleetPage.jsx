import { Routes, Route, Navigate } from 'react-router-dom'
import FleetDashboard          from './FleetDashboard'
import VehiclesPage            from './VehiclesPage'
import VehicleDetailPage       from './VehicleDetailPage'
import FuelReportPage          from './FuelReportPage'
import TripsReportPage         from './TripsReportPage'
import AlertsPage              from './AlertsPage'
import MaintenancePage         from './MaintenancePage'
import FleetSettingsPage       from './FleetSettingsPage'
import MachineWeeklyReportPage from './MachineWeeklyReportPage'
import MachineDailyReportPage from './MachineDailyReportPage'
import EnhancedFuelReportPage from './EnhancedFuelReportPage'
import GeofenceManagementPage from './GeofenceManagementPage'
import FuelPriceManagementPage from './FuelPriceManagementPage'

export default function FleetPage() {
  return (
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
      <Route path="settings" element={<FleetSettingsPage />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  )
}
