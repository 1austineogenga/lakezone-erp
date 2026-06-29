import api from './client'

export const getFleetDashboard     = ()       => api.get('/fleet/dashboard/')
export const getVehicles           = (params) => api.get('/fleet/vehicles/', { params })
export const getVehicle            = (id)     => api.get(`/fleet/vehicles/${id}/`)
export const createVehicle         = (data)   => api.post('/fleet/vehicles/', data)
export const updateVehicle         = (id, d)  => api.patch(`/fleet/vehicles/${id}/`, d)
export const deleteVehicle         = (id)     => api.delete(`/fleet/vehicles/${id}/`)

export const getFleetLive          = ()       => api.get('/fleet/live/')
export const getVehicleLive        = (id)     => api.get(`/fleet/live/${id}/`)
export const forceSync             = ()       => api.post('/fleet/sync/')

export const getFuelEvents         = (params) => api.get('/fleet/fuel-events/', { params })
export const getTrips              = (params) => api.get('/fleet/trips/', { params })

export const getAlerts             = (params) => {
  if (params instanceof URLSearchParams) return api.get(`/fleet/alerts/?${params}`)
  return api.get('/fleet/alerts/', { params })
}
export const acknowledgeAlert      = (id)     => api.post(`/fleet/alerts/${id}/acknowledge/`)

export const getMaintenance        = (params) => api.get('/fleet/maintenance/', { params })
export const createMaintenance     = (data)   => api.post('/fleet/maintenance/', data)
export const updateMaintenance     = (id, d)  => api.patch(`/fleet/maintenance/${id}/`, d)

export const getFuelReport         = (params) => api.get('/fleet/reports/fuel/', { params })
export const getUtilizationReport  = (params) => api.get('/fleet/reports/utilization/', { params })

export const getFleetConfig        = ()       => api.get('/fleet/config/')
export const saveFleetConfig       = (data)   => api.post('/fleet/config/', data)
export const backfillHistory       = ()       => api.post('/fleet/backfill/')
export const fetchHistory          = (data)   => api.post('/fleet/fetch-history/', data)
export const fetchFuelEvents           = (data)   => api.post('/fleet/fetch-fuel-events/', data)
export const fetchTrackNTraceAlerts    = (data)   => api.post('/fleet/fetch-alerts/', data)
export const checkMaintenanceDue       = ()        => api.post('/fleet/check-maintenance/')

export const updateCompliance     = (vehicleId, data) => api.patch(`/fleet/vehicles/${vehicleId}/compliance/`, data)

export const importFleetRegister = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/fleet/import-register/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}


// Fuel Prices
export const getFuelPrices         = (params) => api.get('/fleet/fuel-prices/', { params })
export const createFuelPrice       = (data)   => api.post('/fleet/fuel-prices/', data)
export const getCurrentFuelPrices  = (location) => api.get(`/fleet/fuel-prices/current/?location=${location || 'Nairobi'}`)
export const updateFuelPrice       = (id, d)  => api.patch(`/fleet/fuel-prices/${id}/`, d)
export const deleteFuelPrice       = (id)     => api.delete(`/fleet/fuel-prices/${id}/`)

// Geofences
export const getGeofences          = (params) => api.get('/fleet/geofences/', { params })
export const createGeofence        = (data)   => api.post('/fleet/geofences/', data)
export const getGeofence           = (id)     => api.get(`/fleet/geofences/${id}/`)
export const updateGeofence        = (id, d)  => api.patch(`/fleet/geofences/${id}/`, d)
export const deleteGeofence        = (id)     => api.delete(`/fleet/geofences/${id}/`)

// Geofence Events
export const getGeofenceEvents     = (params) => api.get('/fleet/geofence-events/', { params })
