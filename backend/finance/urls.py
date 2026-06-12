from django.urls import path
from .views import (
    AccountListCreateView, AccountDetailView,
    InvoiceListCreateView, InvoiceDetailView,
    BillListCreateView, BillDetailView,
    PaymentListCreateView,
    ExpenseClaimListCreateView, ExpenseClaimDetailView,
    ExpenseClaimSubmitView, ExpenseClaimReviewView,
    CashFlowView, ContractProfitabilityView,
    FinanceDashboardView,
)

urlpatterns = [
    path('dashboard/',                          FinanceDashboardView.as_view(),        name='finance-dashboard'),
    path('accounts/',                           AccountListCreateView.as_view(),        name='account-list'),
    path('accounts/<uuid:pk>/',                 AccountDetailView.as_view(),            name='account-detail'),
    path('invoices/',                           InvoiceListCreateView.as_view(),        name='invoice-list'),
    path('invoices/<uuid:pk>/',                 InvoiceDetailView.as_view(),            name='invoice-detail'),
    path('bills/',                              BillListCreateView.as_view(),           name='bill-list'),
    path('bills/<uuid:pk>/',                    BillDetailView.as_view(),               name='bill-detail'),
    path('payments/',                           PaymentListCreateView.as_view(),        name='payment-list'),
    path('expenses/',                           ExpenseClaimListCreateView.as_view(),   name='expense-list'),
    path('expenses/<uuid:pk>/',                 ExpenseClaimDetailView.as_view(),       name='expense-detail'),
    path('expenses/<uuid:pk>/submit/',          ExpenseClaimSubmitView.as_view(),       name='expense-submit'),
    path('expenses/<uuid:pk>/review/',          ExpenseClaimReviewView.as_view(),       name='expense-review'),
    path('cash-flow/',                          CashFlowView.as_view(),                name='cash-flow'),
    path('profitability/',                      ContractProfitabilityView.as_view(),   name='profitability'),
]
