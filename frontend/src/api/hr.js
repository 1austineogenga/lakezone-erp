import api from './client'

// Employees
export const getEmployees            = (params) => api.get('/hr/employees/', { params })
export const getEmployee             = (id)     => api.get(`/hr/employees/${id}/`)
export const createEmployee          = (data)   => api.post('/hr/employees/', data)
export const updateEmployee          = (id, d)  => api.patch(`/hr/employees/${id}/`, d)
export const deleteEmployee          = (id)     => api.delete(`/hr/employees/${id}/`)
export const getEmployeeDocuments    = (params) => api.get('/hr/employee-documents/', { params })
export const createEmployeeDocument  = (data)   => api.post('/hr/employee-documents/', data)
export const deleteEmployeeDocument  = (id)     => api.delete(`/hr/employee-documents/${id}/`)

// Job Grades & Positions
export const getJobGrades   = ()    => api.get('/hr/job-grades/')
export const createJobGrade = (d)   => api.post('/hr/job-grades/', d)
export const getPositions   = (p)   => api.get('/hr/positions/', { params: p })
export const createPosition = (d)   => api.post('/hr/positions/', d)

// Biometric Devices
export const getBiometricDevices   = ()       => api.get('/hr/biometric/devices/')
export const createBiometricDevice = (d)      => api.post('/hr/biometric/devices/', d)
export const updateBiometricDevice = (id, d)  => api.patch(`/hr/biometric/devices/${id}/`, d)
export const syncBiometricDevice   = (id)     => api.post(`/hr/biometric/devices/${id}/sync/`)

// Attendance
export const getAttendance      = (p)     => api.get('/hr/attendance/', { params: p })
export const getDailySheet      = (p)     => api.get('/hr/attendance/daily-sheet/', { params: p })
export const getMonthlyReport   = (p)     => api.get('/hr/attendance/monthly-report/', { params: p })
export const bulkMarkAttendance = (d)     => api.post('/hr/attendance/bulk-mark/', d)

// Leave
export const getLeaveTypes          = ()      => api.get('/hr/leave-types/')
export const createLeaveType        = (d)     => api.post('/hr/leave-types/', d)
export const getLeaveBalances       = (p)     => api.get('/hr/leave-balances/', { params: p })
export const getLeaveApplications   = (p)     => api.get('/hr/leave-applications/', { params: p })
export const createLeaveApplication = (d)     => api.post('/hr/leave-applications/', d)
export const submitLeave            = (id)    => api.post(`/hr/leave-applications/${id}/submit/`)
export const reviewLeave            = (id, d) => api.post(`/hr/leave-applications/${id}/review/`, d)

// Payroll Periods
export const getPayrollPeriods   = ()     => api.get('/hr/payroll/periods/')
export const getPayrollPeriod    = (id)   => api.get(`/hr/payroll/periods/${id}/`)
export const createPayrollPeriod = (d)    => api.post('/hr/payroll/periods/', d)
export const generatePayroll     = (id)   => api.post(`/hr/payroll/periods/${id}/generate/`)
export const approvePayroll      = (id)   => api.post(`/hr/payroll/periods/${id}/approve/`)
export const payPayroll          = (id)   => api.post(`/hr/payroll/periods/${id}/pay/`)

// Payroll Entries
export const getPayrollEntries  = (p)     => api.get('/hr/payroll/entries/', { params: p })
export const updatePayrollEntry = (id, d) => api.patch(`/hr/payroll/entries/${id}/`, d)

// Salary Advances
export const getSalaryAdvances   = (p)     => api.get('/hr/advances/', { params: p })
export const createSalaryAdvance = (d)     => api.post('/hr/advances/', d)
export const reviewAdvance       = (id, d) => api.post(`/hr/advances/${id}/review/`, d)

// Disciplinary
export const getDisciplinaryRecords    = (p) => api.get('/hr/disciplinary/', { params: p })
export const createDisciplinaryRecord  = (d) => api.post('/hr/disciplinary/', d)

// Dashboard
export const getHRDashboard = () => api.get('/hr/dashboard/')
