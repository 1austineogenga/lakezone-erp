from django.urls import path
from .views import (
    RequisitionListCreateView, RequisitionDetailView,
    RequisitionApproveView, RequisitionFulfillView,
    MyPendingApprovalsView, RequisitionRecallView,
)

urlpatterns = [
    path('',                         RequisitionListCreateView.as_view(), name='requisition-list'),
    path('pending-approvals/',       MyPendingApprovalsView.as_view(),    name='pending-approvals'),
    path('<uuid:pk>/',               RequisitionDetailView.as_view(),     name='requisition-detail'),
    path('<uuid:pk>/approve/',       RequisitionApproveView.as_view(),    name='requisition-approve'),
    path('<uuid:pk>/recall/',        RequisitionRecallView.as_view(),     name='requisition-recall'),
    path('<uuid:pk>/fulfill/',       RequisitionFulfillView.as_view(),    name='requisition-fulfill'),
]
