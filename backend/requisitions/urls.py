from django.urls import path
from .views import (
    RequisitionListCreateView, RequisitionDetailView,
    RequisitionApproveView, RequisitionFulfillView,
    PendingApprovalsView, RequisitionRecallView,
    MaintenanceScheduleListCreateView, MaintenanceScheduleDetailView,
    MaintenanceScheduleApproveView, FuelPaymentView,
    RequisitionConfirmPaymentView,
)

urlpatterns = [
    path('',                                     RequisitionListCreateView.as_view(),        name='requisition-list'),
    path('pending-approvals/',                   PendingApprovalsView.as_view(),             name='pending-approvals'),
    path('<uuid:pk>/',                           RequisitionDetailView.as_view(),            name='requisition-detail'),
    path('<uuid:pk>/approve/',                   RequisitionApproveView.as_view(),           name='requisition-approve'),
    path('<uuid:pk>/recall/',                    RequisitionRecallView.as_view(),            name='requisition-recall'),
    path('<uuid:pk>/fulfill/',                   RequisitionFulfillView.as_view(),           name='requisition-fulfill'),
    path('<uuid:pk>/confirm-payment/',           RequisitionConfirmPaymentView.as_view(),    name='requisition-confirm-payment'),
    path('<uuid:pk>/fuel-payment/',              FuelPaymentView.as_view(),                  name='fuel-payment'),

    # Maintenance Schedules
    path('maintenance-schedules/',               MaintenanceScheduleListCreateView.as_view(), name='maintenance-schedule-list'),
    path('maintenance-schedules/<uuid:pk>/',     MaintenanceScheduleDetailView.as_view(),    name='maintenance-schedule-detail'),
    path('maintenance-schedules/<uuid:pk>/approve/', MaintenanceScheduleApproveView.as_view(), name='maintenance-schedule-approve'),
]
