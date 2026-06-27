from datetime import date
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


def make_user(email, role="staff"):
    return User.objects.create_user(email=email, password="pass", role=role)


class RequisitionApprovalWorkflowTest(TestCase):
    """Test the draft → submitted → dept_review → approved flow."""

    def setUp(self):
        from requisitions.models import StaffRequisition, RequisitionItem
        self.requester = make_user("requester@test.com", role="staff")
        self.dept_head = make_user("depthead@test.com", role="department_manager")
        self.finance_mgr = make_user("finance@test.com", role="finance_manager")
        self.md = make_user("md@test.com", role="managing_director")

        # Create a low-value requisition (< 200k → goes straight to APPROVED after DEPT_REVIEW)
        self.req = StaffRequisition.objects.create(
            title="Stationery",
            req_type=StaffRequisition.ReqType.STORE_ITEM,
            status=StaffRequisition.Status.SUBMITTED,
            requested_by=self.requester,
            date_required=date(2026, 12, 31),
        )
        RequisitionItem.objects.create(
            requisition=self.req,
            description="Pens",
            quantity=10,
            unit_price=50,
        )
        self.req.recalculate_total()

    def test_initial_status_is_submitted(self):
        self.assertEqual(self.req.status, "submitted")

    def test_dept_head_can_approve_submitted(self):
        from requisitions.models import RequisitionApproval
        client = APIClient()
        client.force_authenticate(user=self.dept_head)
        url = f"/api/v1/requisitions/{self.req.pk}/approve/"
        response = client.post(url, {"action": "approved"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, "dept_review")

    def test_finance_manager_can_approve_dept_review(self):
        from requisitions.models import StaffRequisition
        # Put it in DEPT_REVIEW
        self.req.status = StaffRequisition.Status.DEPT_REVIEW
        self.req.save(update_fields=["status"])
        client = APIClient()
        client.force_authenticate(user=self.finance_mgr)
        url = f"/api/v1/requisitions/{self.req.pk}/approve/"
        response = client.post(url, {"action": "approved"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.req.refresh_from_db()
        # Amount < 200k → goes to APPROVED
        self.assertEqual(self.req.status, "approved")

    def test_wrong_role_cannot_approve(self):
        """A finance manager should not be able to approve a SUBMITTED requisition."""
        client = APIClient()
        client.force_authenticate(user=self.finance_mgr)
        url = f"/api/v1/requisitions/{self.req.pk}/approve/"
        response = client.post(url, {"action": "approved"}, format="json")
        self.assertEqual(response.status_code, 403)


class RequisitionRecallTest(TestCase):
    def setUp(self):
        from requisitions.models import StaffRequisition, RequisitionItem
        self.requester = make_user("recall_requester@test.com", role="staff")
        self.other_user = make_user("other@test.com", role="staff")
        self.req = StaffRequisition.objects.create(
            title="Office Chair",
            req_type=StaffRequisition.ReqType.EXTERNAL_PURCHASE,
            status=StaffRequisition.Status.SUBMITTED,
            requested_by=self.requester,
            date_required=date(2026, 12, 31),
        )
        RequisitionItem.objects.create(
            requisition=self.req,
            description="Chair",
            quantity=1,
            unit_price=15000,
        )
        self.req.recalculate_total()

    def test_requester_can_recall_submitted_requisition(self):
        client = APIClient()
        client.force_authenticate(user=self.requester)
        url = f"/api/v1/requisitions/{self.req.pk}/recall/"
        response = client.post(url)
        self.assertEqual(response.status_code, 200)
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, "draft")

    def test_recall_reverts_to_draft(self):
        from requisitions.models import StaffRequisition
        self.req.status = StaffRequisition.Status.DEPT_REVIEW
        self.req.save(update_fields=["status"])
        client = APIClient()
        client.force_authenticate(user=self.requester)
        url = f"/api/v1/requisitions/{self.req.pk}/recall/"
        response = client.post(url)
        self.assertEqual(response.status_code, 200)
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, "draft")

    def test_other_user_cannot_recall(self):
        client = APIClient()
        client.force_authenticate(user=self.other_user)
        url = f"/api/v1/requisitions/{self.req.pk}/recall/"
        response = client.post(url)
        self.assertEqual(response.status_code, 403)

    def test_cannot_recall_approved_requisition(self):
        from requisitions.models import StaffRequisition
        self.req.status = StaffRequisition.Status.APPROVED
        self.req.save(update_fields=["status"])
        client = APIClient()
        client.force_authenticate(user=self.requester)
        url = f"/api/v1/requisitions/{self.req.pk}/recall/"
        response = client.post(url)
        self.assertEqual(response.status_code, 400)


class RequisitionRejectionTest(TestCase):
    def setUp(self):
        from requisitions.models import StaffRequisition, RequisitionItem
        self.requester = make_user("reject_req@test.com", role="staff")
        self.dept_head = make_user("reject_dh@test.com", role="department_manager")
        self.req = StaffRequisition.objects.create(
            title="Laptop",
            req_type=StaffRequisition.ReqType.EXTERNAL_PURCHASE,
            status=StaffRequisition.Status.SUBMITTED,
            requested_by=self.requester,
            date_required=date(2026, 12, 31),
        )
        RequisitionItem.objects.create(
            requisition=self.req,
            description="Laptop",
            quantity=1,
            unit_price=80000,
        )
        self.req.recalculate_total()

    def test_rejection_sets_rejection_reason(self):
        client = APIClient()
        client.force_authenticate(user=self.dept_head)
        url = f"/api/v1/requisitions/{self.req.pk}/approve/"
        reason = "Budget not available for this quarter."
        response = client.post(url, {"action": "rejected", "comments": reason}, format="json")
        self.assertEqual(response.status_code, 200)
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, "rejected")
        self.assertEqual(self.req.rejection_reason, reason)

    def test_rejection_reason_in_serializer_response(self):
        client = APIClient()
        client.force_authenticate(user=self.dept_head)
        url = f"/api/v1/requisitions/{self.req.pk}/approve/"
        reason = "Not justified."
        response = client.post(url, {"action": "rejected", "comments": reason}, format="json")
        self.assertIn("rejection_reason", response.data)
        self.assertEqual(response.data["rejection_reason"], reason)


class RequisitionItemValidationTest(TestCase):
    def setUp(self):
        from requisitions.models import StaffRequisition
        self.user = make_user("itemval@test.com")
        self.req = StaffRequisition.objects.create(
            title="Test Req",
            req_type=StaffRequisition.ReqType.STORE_ITEM,
            status=StaffRequisition.Status.SUBMITTED,
            requested_by=self.user,
            date_required=date(2026, 12, 31),
        )

    def test_zero_quantity_raises_validation_error(self):
        from django.core.exceptions import ValidationError
        from requisitions.models import RequisitionItem
        item = RequisitionItem(
            requisition=self.req,
            description="Bad Item",
            quantity=0,
            unit_price=100,
        )
        with self.assertRaises(ValidationError):
            item.save()

    def test_negative_quantity_raises_validation_error(self):
        from django.core.exceptions import ValidationError
        from requisitions.models import RequisitionItem
        item = RequisitionItem(
            requisition=self.req,
            description="Negative Item",
            quantity=-5,
            unit_price=100,
        )
        with self.assertRaises(ValidationError):
            item.save()

    def test_negative_unit_price_raises_validation_error(self):
        from django.core.exceptions import ValidationError
        from requisitions.models import RequisitionItem
        item = RequisitionItem(
            requisition=self.req,
            description="Neg Price",
            quantity=1,
            unit_price=-50,
        )
        with self.assertRaises(ValidationError):
            item.save()

    def test_valid_item_saves_successfully(self):
        from requisitions.models import RequisitionItem
        item = RequisitionItem(
            requisition=self.req,
            description="Valid Item",
            quantity=5,
            unit_price=200,
        )
        item.save()  # Should not raise
        self.assertEqual(float(item.total_price), 1000)
