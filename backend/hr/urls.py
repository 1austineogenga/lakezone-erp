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

    # Leave Applications
    path('leave-applications/',                  views.LeaveApplicationListCreateView.as_view()),
    path('leave-applications/<uuid:pk>/',        views.LeaveApplicationDetailView.as_view()),
    path('leave-applications/<uuid:pk>/submit/', views.LeaveSubmitView.as_view()),
    path('leave-applications/<uuid:pk>/review/', views.LeaveReviewView.as_view()),

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
]
