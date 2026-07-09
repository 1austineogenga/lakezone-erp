import api from './client'

export const getClients         = (p)     => api.get('/crm/clients/', { params: p })
export const getClient          = (id)    => api.get(`/crm/clients/${id}/`)
export const createClient       = (d)     => api.post('/crm/clients/', d)
export const updateClient       = (id, d) => api.patch(`/crm/clients/${id}/`, d)

export const deleteClient       = (id)    => api.delete(`/crm/clients/${id}/`)

export const getOpportunities   = (p)     => api.get('/crm/opportunities/', { params: p })
export const getOpportunity     = (id)    => api.get(`/crm/opportunities/${id}/`)
export const createOpportunity  = (d)     => api.post('/crm/opportunities/', d)
export const updateOpportunity  = (id, d) => api.patch(`/crm/opportunities/${id}/`, d)
export const deleteOpportunity  = (id)    => api.delete(`/crm/opportunities/${id}/`)

export const getPipeline        = ()      => api.get('/crm/pipeline/')

export const getInteractions    = (clientId) => api.get(`/crm/clients/${clientId}/interactions/`)
export const createInteraction  = (clientId, d) => api.post(`/crm/clients/${clientId}/interactions/`, d)
export const updateInteraction  = (clientId, id, d) => api.patch(`/crm/clients/${clientId}/interactions/${id}/`, d)
export const deleteInteraction  = (clientId, id) => api.delete(`/crm/clients/${clientId}/interactions/${id}/`)
