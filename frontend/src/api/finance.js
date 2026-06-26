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

export const getPayments         = (params) => api.get('/finance/payments/', { params })
export const createPayment       = (data)   => api.post('/finance/payments/', data)
export const getBankTransactions = (params) => api.get('/finance/bank-transactions/', { params })
export const getCreditNotes      = (params) => api.get('/finance/credit-notes/', { params })

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

export const getTimesheets    = (params) => api.get('/finance/timesheets/', { params })
export const createTimesheet  = (data)   => api.post('/finance/timesheets/', data)
export const submitTimesheet  = (id)     => api.post(`/finance/timesheets/${id}/submit/`)
export const reviewTimesheet  = (id, data) => api.post(`/finance/timesheets/${id}/review/`, data)
export const getPayrollSummary = (params) => api.get('/finance/payroll-summary/', { params })

export const getJournals      = (params) => api.get('/finance/journals/', { params })
export const createJournal    = (data)   => api.post('/finance/journals/', data)
export const postJournal      = (id)     => api.post(`/finance/journals/${id}/post/`)
export const reverseJournal   = (id)     => api.post(`/finance/journals/${id}/reverse/`)
export const getTrialBalance  = (params) => api.get('/finance/trial-balance/', { params })

// QuickBooks integration
export const getQBConfig     = ()     => api.get('/finance/quickbooks/config/')
export const saveQBConfig    = (data) => api.patch('/finance/quickbooks/config/', data)
export const getQBAuthUrl    = ()     => api.get('/finance/quickbooks/connect/')
export const qbCallback      = (data) => api.post('/finance/quickbooks/callback/', data)
export const qbDisconnect    = ()     => api.post('/finance/quickbooks/disconnect/')
export const qbSync          = (data) => api.post('/finance/quickbooks/sync/', data)
export const getQBLogs       = ()     => api.get('/finance/quickbooks/logs/')
