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

export const getExpenses      = (params) => api.get('/finance/expenses/', { params })
export const getExpense       = (id)     => api.get(`/finance/expenses/${id}/`)
export const createExpense    = (data)   => api.post('/finance/expenses/', data)
export const submitExpense    = (id)     => api.post(`/finance/expenses/${id}/submit/`)
export const reviewExpense    = (id, data) => api.post(`/finance/expenses/${id}/review/`, data)

export const getCashFlow      = ()       => api.get('/finance/cash-flow/')
export const getProfitability = ()       => api.get('/finance/profitability/')

export const getRetentionSchedule = ()       => api.get('/finance/retention/')
export const getRetentionReleases  = ()       => api.get('/finance/retention/releases/')
export const createRetentionRelease = (data)  => api.post('/finance/retention/releases/', data)
export const actionRetentionRelease = (id, data) => api.post(`/finance/retention/releases/${id}/action/`, data)

export const getAgedDebtors   = ()       => api.get('/finance/aged-debtors/')
export const getAgedCreditors = ()       => api.get('/finance/aged-creditors/')

export const getBudgets       = (params) => api.get('/finance/budgets/', { params })
export const createBudget     = (data)   => api.post('/finance/budgets/', data)
export const updateBudget     = (id, data) => api.patch(`/finance/budgets/${id}/`, data)
export const deleteBudget     = (id)     => api.delete(`/finance/budgets/${id}/`)
export const getBudgetVsActual = (params) => api.get('/finance/budget-vs-actual/', { params })

export const getVATSummary    = ()       => api.get('/finance/vat-summary/')
export const getWHTRegister   = (params) => api.get('/finance/wht-register/', { params })

export const getCertificates  = (params) => api.get('/finance/certificates/', { params })
export const createCertificate = (data)  => api.post('/finance/certificates/', data)
export const updateCertificate = (id, data) => api.patch(`/finance/certificates/${id}/`, data)

export const getBonds         = (params) => api.get('/finance/bonds/', { params })
export const createBond       = (data)   => api.post('/finance/bonds/', data)
export const updateBond       = (id, data) => api.patch(`/finance/bonds/${id}/`, data)
