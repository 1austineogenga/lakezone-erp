from django.urls import path
from .views import (
    AccountListCreateView, AccountDetailView,
    InvoiceListCreateView, InvoiceDetailView,
    BillListCreateView, BillDetailView,
    PaymentListCreateView,
    FinanceDashboardView,
)

urlpatterns = [
    path('dashboard/',         FinanceDashboardView.as_view(),    name='finance-dashboard'),
    path('accounts/',          AccountListCreateView.as_view(),   name='account-list'),
    path('accounts/<uuid:pk>/', AccountDetailView.as_view(),      name='account-detail'),
    path('invoices/',          InvoiceListCreateView.as_view(),   name='invoice-list'),
    path('invoices/<uuid:pk>/', InvoiceDetailView.as_view(),      name='invoice-detail'),
    path('bills/',             BillListCreateView.as_view(),      name='bill-list'),
    path('bills/<uuid:pk>/',   BillDetailView.as_view(),          name='bill-detail'),
    path('payments/',          PaymentListCreateView.as_view(),   name='payment-list'),
]
