import api from './client'

export const getRequisitions   = (params) => api.get('/requisitions/', { params })
export const getRequisition    = (id)     => api.get(`/requisitions/${id}/`)
export const createRequisition = (data)   => api.post('/requisitions/', data)
export const approveRequisition = (id, data) => api.post(`/requisitions/${id}/approve/`, data)
export const fulfillRequisition = (id, data) => api.post(`/requisitions/${id}/fulfill/`, data)
export const getPendingApprovals = ()    => api.get('/requisitions/pending-approvals/')
