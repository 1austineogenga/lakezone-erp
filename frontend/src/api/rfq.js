import axios from 'axios'

const BASE = '/api/v1/procurement'

export const getRFQDashboard   = ()         => axios.get(`${BASE}/rfqs/dashboard/`)
export const getRFQs           = (params)   => axios.get(`${BASE}/rfqs/`, { params })
export const createRFQ         = (data)     => axios.post(`${BASE}/rfqs/`, data)
export const updateRFQ         = (id, data) => axios.patch(`${BASE}/rfqs/${id}/`, data)
export const deleteRFQ         = (id)       => axios.delete(`${BASE}/rfqs/${id}/`)
export const awardRFQ          = (id, data) => axios.post(`${BASE}/rfqs/${id}/award/`, data)

export const getRFQQuotes      = (rfqId)           => axios.get(`${BASE}/rfqs/${rfqId}/quotes/`)
export const createRFQQuote    = (rfqId, data)     => axios.post(`${BASE}/rfqs/${rfqId}/quotes/`, data)
export const updateRFQQuote    = (rfqId, id, data) => axios.patch(`${BASE}/rfqs/${rfqId}/quotes/${id}/`, data)
export const deleteRFQQuote    = (rfqId, id)       => axios.delete(`${BASE}/rfqs/${rfqId}/quotes/${id}/`)

export const getDeliverySchedule   = (poId)           => axios.get(`${BASE}/purchase-orders/${poId}/delivery/`)
export const createDeliveryMilestone = (poId, data)   => axios.post(`${BASE}/purchase-orders/${poId}/delivery/`, data)
export const updateDeliveryMilestone = (poId, id, data) => axios.patch(`${BASE}/purchase-orders/${poId}/delivery/${id}/`, data)
export const deleteDeliveryMilestone = (poId, id)     => axios.delete(`${BASE}/purchase-orders/${poId}/delivery/${id}/`)

export const getSuppliers = (params) => axios.get(`${BASE}/suppliers/`, { params })
