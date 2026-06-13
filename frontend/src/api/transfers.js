import api from './client'

export const getTransfers    = (params) => api.get('/hr/transfers/', { params })
export const getTransfer     = (id)     => api.get(`/hr/transfers/${id}/`)
export const createTransfer  = (data)   => api.post('/hr/transfers/', data)
export const updateTransfer  = (id, d)  => api.patch(`/hr/transfers/${id}/`, d)
export const submitTransfer  = (id)     => api.post(`/hr/transfers/${id}/submit/`)
export const reviewTransfer  = (id, d)  => api.post(`/hr/transfers/${id}/review/`, d)
