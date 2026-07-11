from django.urls import path, include
from . import views

ipc_items_urls = [
    path('', views.IPCItemListCreateView.as_view()),
    path('<uuid:pk>/', views.IPCItemDetailView.as_view()),
]

budget_item_urls = [
    path('', views.BudgetLineItemListCreateView.as_view()),
    path('<uuid:pk>/', views.BudgetLineItemDetailView.as_view()),
]

budget_urls = [
    path('', views.BudgetListCreateView.as_view()),
    path('<uuid:budget_pk>/', views.BudgetDetailView.as_view()),
    path('<uuid:budget_pk>/items/', include(budget_item_urls)),
    path('<uuid:budget_pk>/summary/', views.BudgetSummaryView.as_view()),
    path('<uuid:budget_pk>/submit/', views.BudgetSubmitView.as_view()),
    path('<uuid:budget_pk>/approve/', views.BudgetApproveView.as_view()),
    path('<uuid:budget_pk>/reject/', views.BudgetRejectView.as_view()),
]

ipc_urls = [
    path('', views.IPCListCreateView.as_view()),
    path('<uuid:ipc_pk>/', views.IPCDetailView.as_view()),
    path('<uuid:ipc_pk>/items/', include(ipc_items_urls)),
    path('<uuid:ipc_pk>/submit/', views.IPCSubmitView.as_view()),
    path('<uuid:ipc_pk>/certify/', views.IPCCertifyView.as_view()),
    path('<uuid:ipc_pk>/approve/', views.IPCApproveView.as_view()),
    path('<uuid:ipc_pk>/pay/', views.IPCPayView.as_view()),
    path('<uuid:ipc_pk>/reject/', views.IPCRejectView.as_view()),
]

boq_urls = [
    path('', views.BOQListCreateView.as_view()),
    path('import/', views.BOQImportView.as_view()),
    path('<uuid:pk>/', views.BOQDetailView.as_view()),
]

activity_urls = [
    path('', views.ProjectActivityListCreate.as_view()),
    path('<uuid:pk>/', views.ProjectActivityDetail.as_view()),
    path('<uuid:activity_pk>/progress/', views.ActivityProgressListCreate.as_view()),
]

phase_urls = [
    path('', views.ProjectPhaseListCreate.as_view()),
    path('<uuid:pk>/', views.ProjectPhaseDetail.as_view()),
    path('<uuid:phase_pk>/activities/', include(activity_urls)),
]

subcontractor_milestone_urls = [
    path('', views.SubcontractorMilestoneListCreate.as_view()),
    path('<uuid:pk>/', views.SubcontractorMilestoneDetail.as_view()),
]

subcontractor_urls = [
    path('', views.SubcontractorListCreate.as_view()),
    path('<uuid:sub_pk>/', views.SubcontractorDetail.as_view()),
    path('<uuid:sub_pk>/milestones/', include(subcontractor_milestone_urls)),
]

project_urls = [
    path('', views.ProjectDetailView.as_view()),
    path('dashboard/', views.ProjectDashboardView.as_view()),
    path('wbs/', views.ProjectWBSSummaryView.as_view()),
    path('wbs/generate/', views.GenerateWBSFromBOQView.as_view()),
    path('phases/', include(phase_urls)),
    path('boqs/', include(boq_urls)),
    path('budgets/', include(budget_urls)),
    path('ipcs/', include(ipc_urls)),
    path('risks/', views.ProjectRiskListCreateView.as_view()),
    path('risks/<uuid:pk>/', views.ProjectRiskDetailView.as_view()),
    path('risks/<uuid:pk>/update-status/', views.ProjectRiskUpdateStatusView.as_view()),
    path('vehicles/', views.ProjectVehicleListCreateView.as_view()),
    path('vehicles/<uuid:pk>/', views.ProjectVehicleDetailView.as_view()),
    path('personnel/', views.ProjectPersonnelListCreateView.as_view()),
    path('personnel/<uuid:pk>/', views.ProjectPersonnelDetailView.as_view()),
    path('progress/', views.WeeklyProgressListCreateView.as_view()),
    path('progress/<uuid:pk>/', views.WeeklyProgressDetailView.as_view()),
    path('costing/', views.ProjectCostingView.as_view()),
    path('evm/', views.EVMView.as_view()),
    path('variation-orders/', views.VariationOrderListCreate.as_view()),
    path('variation-orders/<uuid:pk>/', views.VariationOrderDetail.as_view()),
    # Phase 2
    path('chainage/', views.ChainageSegmentListCreate.as_view()),
    path('chainage/<uuid:pk>/', views.ChainageSegmentDetail.as_view()),
    path('site-diary/', views.SiteDiaryListCreate.as_view()),
    path('site-diary/<uuid:pk>/', views.SiteDiaryDetail.as_view()),
    path('qa-tests/', views.QATestRecordListCreate.as_view()),
    path('qa-tests/<uuid:pk>/', views.QATestRecordDetail.as_view()),
    path('ncr/', views.NonConformanceListCreate.as_view()),
    path('ncr/<uuid:pk>/', views.NonConformanceDetail.as_view()),
    path('rfis/', views.RFIRecordListCreate.as_view()),
    path('rfis/<uuid:pk>/', views.RFIRecordDetail.as_view()),
    path('incidents/', views.IncidentReportListCreate.as_view()),
    path('incidents/<uuid:pk>/', views.IncidentReportDetail.as_view()),
    path('subcontractors/', include(subcontractor_urls)),
]

urlpatterns = [
    path('', views.ProjectListCreateView.as_view()),
    path('import/', views.ProjectImportView.as_view()),
    path('import-budget/', views.BudgetWorkbookImportView.as_view()),
    path('portfolio/', views.PortfolioSummaryView.as_view()),
    path('<uuid:project_pk>/', include(project_urls)),
    path('<uuid:pk>/detail/', views.ProjectDetailView.as_view()),
]
