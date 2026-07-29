import api from './client'

// Requisitions
export const getRequisitions    = (params) => api.get('/requisitions/', { params })
export const getRequisition     = (id)     => api.get(`/requisitions/${id}/`)
export const createRequisition  = (data)   => api.post('/requisitions/', data)
export const approveRequisition = (id, data) => api.post(`/requisitions/${id}/approve/`, data)
export const fulfillRequisition = (id, data) => api.post(`/requisitions/${id}/fulfill/`, data)
export const confirmPayment     = (id, data) => api.post(`/requisitions/${id}/confirm-payment/`, data)
export const recallRequisition  = (id)     => api.post(`/requisitions/${id}/recall/`)
export const getPendingApprovals = ()      => api.get('/requisitions/pending-approvals/')

// Fuel payment (finance only)
export const recordFuelPayment  = (id, data) => api.post(`/requisitions/${id}/fuel-payment/`, data)

// Counter Issue Form (store_request type)
export const issueCounterForm   = (reqId, data) => api.post(`/requisitions/${reqId}/counter-issue/issue/`, data)
export const receiveCounterForm = (reqId, data) => api.post(`/requisitions/${reqId}/counter-issue/receive/`, data)
export const getCounterForm     = (reqId)       => api.get(`/requisitions/${reqId}/counter-issue/`)

// Maintenance schedules
export const getMaintenanceSchedules  = (params) => api.get('/requisitions/maintenance-schedules/', { params })
export const getMaintenanceSchedule   = (id)     => api.get(`/requisitions/maintenance-schedules/${id}/`)
export const createMaintenanceSchedule = (data)  => api.post('/requisitions/maintenance-schedules/', data)
export const updateMaintenanceSchedule = (id, data) => api.patch(`/requisitions/maintenance-schedules/${id}/`, data)
export const approveMaintenanceSchedule = (id, data) => api.post(`/requisitions/maintenance-schedules/${id}/approve/`, data)
