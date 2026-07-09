import api from './client'

// Projects CRUD
export const getProjects         = (params) => api.get('/projects/', { params })
export const importProjects      = (fd)     => api.post('/projects/import/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
export const importBudgetWorkbook = (fd)    => api.post('/projects/import-budget/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
export const getProject          = (id)     => api.get(`/projects/${id}/`)
export const createProject       = (data)   => api.post('/projects/', data)
export const updateProject       = (id, d)  => api.patch(`/projects/${id}/`, d)
export const getProjectDashboard = (id)     => api.get(`/projects/${id}/dashboard/`)

// BOQ
export const getProjectBOQs = (projectId)           => api.get(`/projects/${projectId}/boqs/`)
export const importBOQ      = (projectId, formData) => api.post(`/projects/${projectId}/boqs/import/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const getBOQ         = (projectId, boqId)    => api.get(`/projects/${projectId}/boqs/${boqId}/`)

// Budget
export const getProjectBudgets = (projectId)              => api.get(`/projects/${projectId}/budgets/`)
export const createBudget      = (projectId, data)        => api.post(`/projects/${projectId}/budgets/`, data)
export const getBudgetSummary  = (projectId, budgetId)    => api.get(`/projects/${projectId}/budgets/${budgetId}/summary/`)
export const getBudgetItems    = (projectId, budgetId)    => api.get(`/projects/${projectId}/budgets/${budgetId}/items/`)
export const createBudgetItem  = (projectId, budgetId, data) => api.post(`/projects/${projectId}/budgets/${budgetId}/items/`, data)

// IPCs
export const getIPCs   = (projectId)              => api.get(`/projects/${projectId}/ipcs/`)
export const createIPC = (projectId, data)        => api.post(`/projects/${projectId}/ipcs/`, data)
export const updateIPC = (projectId, ipcId, data) => api.patch(`/projects/${projectId}/ipcs/${ipcId}/`, data)

// Risks
export const getRisks    = (projectId)               => api.get(`/projects/${projectId}/risks/`)
export const createRisk  = (projectId, data)         => api.post(`/projects/${projectId}/risks/`, data)
export const updateRisk  = (projectId, riskId, data) => api.patch(`/projects/${projectId}/risks/${riskId}/`, data)

// Fleet
export const getProjectVehicles = (projectId)       => api.get(`/projects/${projectId}/vehicles/`)
export const assignVehicle      = (projectId, data) => api.post(`/projects/${projectId}/vehicles/`, data)

// Personnel
export const getPersonnel = (projectId)       => api.get(`/projects/${projectId}/personnel/`)
export const addPersonnel    = (projectId, data)       => api.post(`/projects/${projectId}/personnel/`, data)
export const updatePersonnel = (projectId, id, data)   => api.patch(`/projects/${projectId}/personnel/${id}/`, data)

// Progress
export const getProgress    = (projectId)                   => api.get(`/projects/${projectId}/progress/`)
export const createProgress = (projectId, data)             => api.post(`/projects/${projectId}/progress/`, data)
export const updateProgress = (projectId, progressId, data) => api.patch(`/projects/${projectId}/progress/${progressId}/`, data)

// Costing
export const getCosting = (projectId) => api.get(`/projects/${projectId}/costing/`)

// Alias — ProjectDetailPage imports getProjectBOQ (singular)
export const getProjectBOQ = getProjectBOQs

// EVM & Finance
export const getEVM              = (projectId)      => api.get(`/projects/${projectId}/evm/`)
export const getVariationOrders  = (projectId)      => api.get(`/projects/${projectId}/variation-orders/`)
export const createVariationOrder = (projectId, d)  => api.post(`/projects/${projectId}/variation-orders/`, d)
export const updateVariationOrder = (projectId, id, d) => api.patch(`/projects/${projectId}/variation-orders/${id}/`, d)
export const deleteVariationOrder = (projectId, id) => api.delete(`/projects/${projectId}/variation-orders/${id}/`)
