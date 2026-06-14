import api from './client'

export const getClients         = (p)     => api.get('/crm/clients/', { params: p })
export const getClient          = (id)    => api.get(`/crm/clients/${id}/`)
export const createClient       = (d)     => api.post('/crm/clients/', d)
export const updateClient       = (id, d) => api.patch(`/crm/clients/${id}/`, d)

export const getOpportunities   = (p)     => api.get('/crm/opportunities/', { params: p })
export const getOpportunity     = (id)    => api.get(`/crm/opportunities/${id}/`)
export const createOpportunity  = (d)     => api.post('/crm/opportunities/', d)
export const updateOpportunity  = (id, d) => api.patch(`/crm/opportunities/${id}/`, d)
