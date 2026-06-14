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
]

ipc_urls = [
    path('', views.IPCListCreateView.as_view()),
    path('<uuid:ipc_pk>/', views.IPCDetailView.as_view()),
    path('<uuid:ipc_pk>/items/', include(ipc_items_urls)),
]

boq_urls = [
    path('', views.BOQListCreateView.as_view()),
    path('import/', views.BOQImportView.as_view()),
    path('<uuid:pk>/', views.BOQDetailView.as_view()),
]

project_urls = [
    path('', views.ProjectDetailView.as_view()),
    path('dashboard/', views.ProjectDashboardView.as_view()),
    path('boqs/', include(boq_urls)),
    path('budgets/', include(budget_urls)),
    path('ipcs/', include(ipc_urls)),
    path('risks/', views.ProjectRiskListCreateView.as_view()),
    path('risks/<uuid:pk>/', views.ProjectRiskDetailView.as_view()),
    path('vehicles/', views.ProjectVehicleListCreateView.as_view()),
    path('vehicles/<uuid:pk>/', views.ProjectVehicleDetailView.as_view()),
    path('personnel/', views.ProjectPersonnelListCreateView.as_view()),
    path('personnel/<uuid:pk>/', views.ProjectPersonnelDetailView.as_view()),
    path('progress/', views.WeeklyProgressListCreateView.as_view()),
    path('progress/<uuid:pk>/', views.WeeklyProgressDetailView.as_view()),
]

urlpatterns = [
    path('', views.ProjectListCreateView.as_view()),
    path('<uuid:project_pk>/', include(project_urls)),
    path('<uuid:pk>/detail/', views.ProjectDetailView.as_view()),
]
