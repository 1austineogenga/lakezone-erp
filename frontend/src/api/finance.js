import api from './client'

export const getFinanceDashboard = ()       => api.get('/finance/dashboard/')
export const getAccounts          = ()       => api.get('/finance/accounts/')
export const createAccount        = (data)   => api.post('/finance/accounts/', data)

export const getInvoices   = (params) => api.get('/finance/invoices/', { params })
export const getInvoice    = (id)     => api.get(`/finance/invoices/${id}/`)
export const createInvoice = (data)   => api.post('/finance/invoices/', data)
export const updateInvoice = (id, data) => api.patch(`/finance/invoices/${id}/`, data)

export const getBills   = (params) => api.get('/finance/bills/', { params })
export const getBill    = (id)     => api.get(`/finance/bills/${id}/`)
export const createBill = (data)   => api.post('/finance/bills/', data)
export const updateBill = (id, data) => api.patch(`/finance/bills/${id}/`, data)

export const createPayment = (data) => api.post('/finance/payments/', data)
