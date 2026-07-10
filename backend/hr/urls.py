from django.urls import path
from . import views

urlpatterns = [
    # Dashboard
    path('dashboard/',                           views.HRDashboardView.as_view()),

    # Job Grades
    path('job-grades/',                          views.JobGradeListCreateView.as_view()),
    path('job-grades/<uuid:pk>/',                views.JobGradeDetailView.as_view()),

    # Positions
    path('positions/',                           views.PositionListCreateView.as_view()),
    path('positions/<uuid:pk>/',                 views.PositionDetailView.as_view()),

    # Employees
    path('employees/',                           views.EmployeeListCreateView.as_view()),
    path('employees/<uuid:pk>/',                 views.EmployeeDetailView.as_view()),

    # Employee Documents
    path('employee-documents/',                  views.EmployeeDocumentListCreateView.as_view()),
    path('employee-documents/<uuid:pk>/',        views.EmployeeDocumentDetailView.as_view()),

    # Biometric Devices
    path('biometric/devices/',                   views.BiometricDeviceListCreateView.as_view()),
    path('biometric/devices/<uuid:pk>/',         views.BiometricDeviceDetailView.as_view()),
    path('biometric/devices/<uuid:pk>/sync/',    views.BiometricSyncView.as_view()),
    path('biometric/push/',                      views.BiometricPushView.as_view()),

    # Attendance
    path('attendance/',                          views.AttendanceListView.as_view()),
    path('attendance/daily-sheet/',              views.DailySheetView.as_view()),
    path('attendance/monthly-report/',           views.MonthlyReportView.as_view()),
    path('attendance/bulk-mark/',                views.BulkMarkAttendanceView.as_view()),

    # Leave Types
    path('leave-types/',                         views.LeaveTypeListCreateView.as_view()),
    path('leave-types/<uuid:pk>/',               views.LeaveTypeDetailView.as_view()),

    # Leave Balances
    path('leave-balances/',                      views.LeaveBalanceListView.as_view()),
    path('leave-balances/initialize/',           views.LeaveBalanceInitializeView.as_view()),
    path('leave-balances/<uuid:pk>/',            views.LeaveBalanceDetailView.as_view()),

    # Leave Applications
    path('leave-applications/',                  views.LeaveApplicationListCreateView.as_view()),
    path('leave-applications/<uuid:pk>/',        views.LeaveApplicationDetailView.as_view()),
    path('leave-applications/<uuid:pk>/submit/', views.LeaveSubmitView.as_view()),
    path('leave-applications/<uuid:pk>/review/', views.LeaveReviewView.as_view()),
    path('leave-applications/<uuid:pk>/cancel/', views.LeaveCancelView.as_view()),

    # Payroll Periods
    path('payroll/periods/',                     views.PayrollPeriodListCreateView.as_view()),
    path('payroll/periods/<uuid:pk>/',           views.PayrollPeriodDetailView.as_view()),
    path('payroll/periods/<uuid:pk>/generate/',  views.GeneratePayrollView.as_view()),
    path('payroll/periods/<uuid:pk>/approve/',   views.PayrollApproveView.as_view()),
    path('payroll/periods/<uuid:pk>/pay/',       views.PayrollPayView.as_view()),

    # Payroll Entries
    path('payroll/entries/',                     views.PayrollEntryListView.as_view()),
    path('payroll/entries/<uuid:pk>/',           views.PayrollEntryDetailView.as_view()),
    path('payroll/entries/<uuid:pk>/payslip/',   views.PayslipView.as_view()),

    # Salary Advances
    path('advances/',                            views.SalaryAdvanceListCreateView.as_view()),
    path('advances/<uuid:pk>/',                  views.SalaryAdvanceDetailView.as_view()),
    path('advances/<uuid:pk>/review/',           views.AdvanceReviewView.as_view()),

    # Disciplinary
    path('disciplinary/',                        views.DisciplinaryListCreateView.as_view()),
    path('disciplinary/<uuid:pk>/',              views.DisciplinaryDetailView.as_view()),

    # Transfers
    path('transfers/',                           views.EmployeeTransferListCreateView.as_view()),
    path('transfers/<uuid:pk>/',                 views.EmployeeTransferDetailView.as_view()),
    path('transfers/<uuid:pk>/submit/',          views.TransferSubmitView.as_view()),
    path('transfers/<uuid:pk>/review/',          views.TransferReviewView.as_view()),

    # Casuals Register
    path('casuals/',                             views.CasualListCreateView.as_view()),
    path('casuals/lookup/',                      views.CasualLookupView.as_view()),
    path('casuals/import/',                      views.CasualImportView.as_view()),
    path('casuals/daily-logs/',                  views.CasualDailyLogListCreateView.as_view()),
    path('casuals/<uuid:pk>/',                   views.CasualDetailView.as_view()),
    path('casuals/<uuid:pk>/approve/',           views.CasualApproveView.as_view()),
    path('casuals/<uuid:pk>/toggle-active/',     views.CasualToggleActiveView.as_view()),

    # Casual Daily Reports
    path('casual-reports/',                      views.CasualDailyReportListCreateView.as_view()),
    path('casual-reports/<uuid:pk>/',            views.CasualDailyReportDetailView.as_view()),
    path('casual-reports/<uuid:pk>/submit/',     views.CasualReportSubmitView.as_view()),
    path('casual-reports/<uuid:pk>/approve/',    views.CasualReportApproveView.as_view()),
]
