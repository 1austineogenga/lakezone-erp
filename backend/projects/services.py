import re
from decimal import Decimal, InvalidOperation

import openpyxl

from .models import BOQ, BOQBill, BOQItem, Project


SKIP_KEYWORDS = [
    'carried forward', 'carry forward', 'brought forward', 'sub-total',
    'subtotal', 'total', 'sub total', 'page total', 'bill total',
    'grand total', 'summary',
]


def _looks_like_skip_row(description):
    if not description:
        return True
    desc_lower = str(description).strip().lower()
    if not desc_lower:
        return True
    for kw in SKIP_KEYWORDS:
        if kw in desc_lower:
            return True
    return False


def _safe_decimal(value, default=Decimal('0')):
    if value is None:
        return default
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return default


class BOQImportService:
    @staticmethod
    def import_from_excel(file, project_id, title):
        project = Project.objects.get(pk=project_id)

        wb = openpyxl.load_workbook(file, data_only=True)

        boq = BOQ.objects.create(
            project=project,
            title=title,
        )

        bills_created = 0
        items_created = 0
        bill_order = 0

        # First pass: collect bill totals from summary sheet if present
        bill_totals = {}
        for sheet_name in wb.sheetnames:
            if 'summary' in sheet_name.lower():
                ws = wb[sheet_name]
                for row in ws.iter_rows(values_only=True):
                    # Look for rows that have a bill number in col A or B and amount in last cols
                    pass  # summary sheet totals are re-computed from items

        # Second pass: process individual bill sheets
        bill_pattern = re.compile(r'^bill\s*(\d+)$', re.IGNORECASE)

        for sheet_name in wb.sheetnames:
            match = bill_pattern.match(sheet_name.strip())
            if not match:
                continue

            bill_number = match.group(1)
            ws = wb[sheet_name]

            # Find the header row
            header_row_idx = None
            for row_idx, row in enumerate(ws.iter_rows(values_only=True), start=1):
                row_vals = [str(c).strip().lower() if c is not None else '' for c in row]
                # Look for 'description' in B or C column (index 1 or 2)
                if len(row_vals) >= 3:
                    if 'description' in row_vals[1] or 'description' in row_vals[2]:
                        header_row_idx = row_idx
                        break

            if header_row_idx is None:
                # Try first few rows
                header_row_idx = 1

            # Get sheet title from first few rows
            bill_description = sheet_name
            for row in ws.iter_rows(min_row=1, max_row=5, values_only=True):
                for cell in row:
                    if cell and isinstance(cell, str) and len(cell.strip()) > 5:
                        candidate = cell.strip()
                        if 'bill' in candidate.lower() or len(candidate) > 10:
                            bill_description = candidate
                            break
                else:
                    continue
                break

            bill = BOQBill.objects.create(
                boq=boq,
                bill_number=bill_number,
                description=bill_description[:500],
                order=bill_order,
            )
            bill_order += 1
            bills_created += 1

            bill_sub_total = Decimal('0')

            # Read items starting after header row
            for row in ws.iter_rows(min_row=header_row_idx + 1, values_only=True):
                if len(row) < 3:
                    continue

                item_no = row[0]
                description = row[1] if len(row) > 1 else None
                unit = row[2] if len(row) > 2 else None
                qty = row[3] if len(row) > 3 else None
                rate = row[4] if len(row) > 4 else None
                amount = row[5] if len(row) > 5 else None

                # Skip if no item number
                if not item_no or str(item_no).strip() == '':
                    continue

                item_no_str = str(item_no).strip()

                # Skip if description looks like a subtotal
                if _looks_like_skip_row(description):
                    continue

                # Skip if item_no looks like a label rather than a number
                if _looks_like_skip_row(item_no_str):
                    continue

                desc_str = str(description).strip() if description else ''
                if not desc_str:
                    continue

                qty_dec = _safe_decimal(qty)
                rate_dec = _safe_decimal(rate)
                amount_dec = _safe_decimal(amount)

                # If amount is zero but qty and rate are set, compute it
                if amount_dec == 0 and qty_dec != 0 and rate_dec != 0:
                    amount_dec = qty_dec * rate_dec

                BOQItem.objects.create(
                    bill=bill,
                    item_number=item_no_str[:20],
                    description=desc_str,
                    unit=str(unit).strip()[:50] if unit else '',
                    quantity=qty_dec,
                    rate=rate_dec,
                    amount=amount_dec,
                )
                items_created += 1
                bill_sub_total += amount_dec

            # Update bill sub_total
            bill.sub_total = bill_sub_total
            bill.save()

        total_amount = sum(
            bill.sub_total for bill in boq.bills.all()
        )

        return {
            'boq_id': str(boq.id),
            'bills_created': bills_created,
            'items_created': items_created,
            'total_amount': float(total_amount),
        }
