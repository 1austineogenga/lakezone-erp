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

export const getAlerts             = (params) => api.get('/fleet/alerts/', { params })
export const acknowledgeAlert      = (id)     => api.post(`/fleet/alerts/${id}/acknowledge/`)

export const getMaintenance        = (params) => api.get('/fleet/maintenance/', { params })
export const createMaintenance     = (data)   => api.post('/fleet/maintenance/', data)
export const updateMaintenance     = (id, d)  => api.patch(`/fleet/maintenance/${id}/`, d)

export const getFuelReport         = (params) => api.get('/fleet/reports/fuel/', { params })
export const getUtilizationReport  = (params) => api.get('/fleet/reports/utilization/', { params })

export const getFleetConfig        = ()       => api.get('/fleet/config/')
export const saveFleetConfig       = (data)   => api.post('/fleet/config/', data)
export const backfillHistory       = ()       => api.post('/fleet/backfill/')
