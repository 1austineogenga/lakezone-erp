# Software Requirements Specification (SRS)
## Lakezone ERP System
### Version 1.0 | Lakezone Enterprises Ltd | June 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Overview](#2-system-overview)
3. [Stakeholders & User Roles](#3-stakeholders--user-roles)
4. [Functional Requirements](#4-functional-requirements)
   - 4.1 Authentication & User Management
   - 4.2 Dashboard
   - 4.3 Project Management
   - 4.4 Procurement
   - 4.5 Finance & Accounting
   - 4.6 Human Resources & Payroll
   - 4.7 Inventory & Assets
   - 4.8 Fleet Management
   - 4.9 CRM
   - 4.10 Staff Requisitions
   - 4.11 Notifications
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [System Architecture](#6-system-architecture)
7. [Data Model Summary](#7-data-model-summary)
8. [API Specification Summary](#8-api-specification-summary)
9. [Business Workflows](#9-business-workflows)
10. [External Integrations](#10-external-integrations)
11. [Security Requirements](#11-security-requirements)
12. [Constraints & Assumptions](#12-constraints--assumptions)

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) describes the functional and non-functional requirements for the **Lakezone ERP System**, a web-based enterprise resource planning platform built for Lakezone Enterprises Ltd. The system covers project management, procurement, finance, human resources, fleet tracking, inventory, and CRM operations across multiple branches.

### 1.2 Scope

The Lakezone ERP is a full-stack web application that serves as the single operational backbone for Lakezone Enterprises Ltd. It integrates all business departments into one platform, enabling real-time data sharing, multi-level approval workflows, telematics-based fleet management, biometric-linked HR, and project-based cost accounting.

### 1.3 Definitions & Abbreviations

| Term | Definition |
|------|-----------|
| ERP | Enterprise Resource Planning |
| BOQ | Bill of Quantities |
| IPC | Interim Payment Certificate |
| PR | Purchase Requisition |
| PO | Purchase Order |
| GRN | Goods Received Note |
| RFI | Request for Inspection |
| JWT | JSON Web Token |
| RBAC | Role-Based Access Control |
| PAYE | Pay As You Earn (Kenya income tax) |
| NSSF | National Social Security Fund (Kenya) |
| NHIF | National Hospital Insurance Fund (Kenya) |
| WHT | Withholding Tax |
| VAT | Value Added Tax |
| GL | General Ledger |
| AR | Accounts Receivable |
| AP | Accounts Payable |
| KPI | Key Performance Indicator |
| GPS | Global Positioning System |
| IMEI | International Mobile Equipment Identity |
| WAC | Weighted Average Cost |

### 1.4 Document Conventions

- **SHALL** — mandatory requirement
- **SHOULD** — recommended requirement
- **MAY** — optional feature
- **FR-XX** — Functional Requirement identifier
- **NFR-XX** — Non-Functional Requirement identifier

---

## 2. System Overview

### 2.1 System Description

The Lakezone ERP is a cloud-hosted web application consisting of:

- A **Django REST Framework** backend exposing a versioned JSON API at `/api/v1/`
- A **React 19** single-page frontend with TanStack Query for data fetching and Tailwind CSS for styling
- A **PostgreSQL** relational database with UUID primary keys
- A **JWT-based** authentication layer with refresh token support
- Real-time **GPS/telematics** integration for fleet tracking
- **Biometric device** integration for attendance management

### 2.2 System Context

Lakezone Enterprises Ltd operates in the construction and infrastructure sector. The ERP serves the following operational needs:

- Managing multiple construction projects simultaneously with project-specific cost tracking
- Tracking a fleet of vehicles across sites with live GPS and fuel monitoring
- Managing a multi-grade workforce including permanent staff, site casuals, and subcontractors
- Processing procurement from requisition through supplier payment
- Generating financial statements, tax reports, and cash-flow analysis aligned with Kenyan regulatory requirements

### 2.3 System Boundaries

**In Scope:**
- All 10 functional modules described in Section 4
- Web browser access (desktop and tablet-optimized)
- REST API for potential mobile app integration
- PDF report generation (print-to-browser)
- Excel/CSV file import for bulk data loading

**Out of Scope:**
- Native mobile application (iOS/Android)
- Offline-first functionality
- Integration with Kenya Revenue Authority e-filing systems (data export only)
- External accounting software synchronization (e.g., QuickBooks, Sage)

---

## 3. Stakeholders & User Roles

### 3.1 Stakeholder Groups

| Stakeholder | Interaction with System |
|-------------|------------------------|
| Managing Director | Executive dashboard, final approvals |
| General Manager | Operations oversight, project reviews |
| Finance Officer | AR/AP, GL, payroll, tax reports |
| HR Manager | Employee master, payroll, attendance, leave |
| Procurement Officer | Supplier management, PRs, POs |
| Facility Manager | Asset register, maintenance |
| Admin Officer | User management, general administration |
| Site Manager | Project progress, fleet assignment, site reports |
| Site Engineer | BOQ progress, IPC submissions, RFIs |
| Site Foreman | Daily/weekly site reports, casual attendance |
| Site Surveyor | Survey reports, control point records |
| Driver | Vehicle usage (read-only) |
| Head of Security | Surveillance operations |
| System Admin | Full system access, configuration |

### 3.2 User Roles (20 Defined Roles)

```
SYSTEM_ADMIN       — Full access; user management and system configuration
MANAGING_DIRECTOR  — Executive access; final-stage approvals
GENERAL_MANAGER    — Broad read/write; operational approvals
FINANCE_OFFICER    — Finance module; payroll approval; expense review
HR_MANAGER         — HR module; payroll generation; leave approval
PROCUREMENT_OFFICER — Procurement module; supplier management; PO issuance
FACILITY_MANAGER   — Inventory; asset register; maintenance
ADMIN_OFFICER      — Administrative operations; general users
SITE_MANAGER       — Project progress; fleet assignment; personnel
SITE_ENGINEER      — BOQ tracking; IPC submission; RFI
SITE_FOREMAN       — Daily/weekly reports; casual attendance
SITE_SURVEYOR      — Survey reports; control points
MECHANIC           — Fleet maintenance records
WELDER             — Site operations (limited access)
EQUIPMENT_OPERATOR — Fleet read access; site operations
DRIVER             — Vehicle assignment view
HEAD_OF_SECURITY   — Security operations
SURVEILLANCE_OFFICER — Read access
CHEF               — Support staff
CLEANER            — Support staff
```

### 3.3 Access Control Matrix

| Module | System Admin | MD | General Mgr | Finance | HR | Procurement | Site Manager | Site Staff | Driver |
|--------|:-----------:|:--:|:-----------:|:-------:|:--:|:-----------:|:------------:|:----------:|:------:|
| Users | R/W | R | R | — | — | — | — | — | — |
| Projects | R/W | R/W | R/W | R | R | R | R/W | R/W | — |
| Procurement | R/W | Approve | R/W | Approve | — | R/W | Request | — | — |
| Finance | R/W | Approve | R | R/W | R | — | R | — | — |
| HR & Payroll | R/W | Approve | R | R/W | R/W | — | R | Self | — |
| Inventory | R/W | R | R | — | — | R/W | R | — | — |
| Fleet | R/W | R | R/W | — | — | — | R/W | R | R(self) |
| CRM | R/W | R/W | R/W | R | — | — | — | — | — |
| Requisitions | R/W | Approve | Approve | Approve | — | Fulfill | Submit | Submit | — |
| Reports | R/W | R/W | R/W | R/W | R/W | R | R/W | R | — |

*(R = Read, W = Create/Update, Approve = Can approve in workflow, Submit = Can create and submit, Self = Own records only)*

---

## 4. Functional Requirements

---

### 4.1 Authentication & User Management

#### 4.1.1 Authentication

**FR-AUTH-01:** The system SHALL authenticate users via email and password, returning a JWT access token and refresh token upon successful login.

**FR-AUTH-02:** The system SHALL provide a token refresh endpoint. Access tokens SHALL have a shorter expiry than refresh tokens.

**FR-AUTH-03:** The system SHALL allow authenticated users to log out by blacklisting the active refresh token.

**FR-AUTH-04:** An authenticated user SHALL be able to view and update their own profile, including name, phone number, and profile photo.

**FR-AUTH-05:** An authenticated user SHALL be able to change their own password by providing the current password and a new password.

#### 4.1.2 User Management (System Admin)

**FR-USR-01:** System Administrators SHALL be able to list, create, update, and deactivate user accounts.

**FR-USR-02:** User accounts SHALL have the following fields: email (unique), first name, last name, role, phone number, profile photo, branch, department, and active status.

**FR-USR-03:** The system SHALL support assignment of one of 20 predefined roles to each user.

**FR-USR-04:** System Administrators SHALL be able to reset any user's password. The system SHALL generate a cryptographically secure 12-character password and display it once to the administrator with a copy-to-clipboard function.

**FR-USR-05:** User list SHALL be filterable by role, branch, department, and active status.

#### 4.1.3 Organisational Structure

**FR-ORG-01:** The system SHALL support multiple branches, each with a name, location, and active status.

**FR-ORG-02:** The system SHALL support departments linked to a branch, with an optional department head.

---

### 4.2 Dashboard

**FR-DASH-01:** Upon login, the system SHALL display a system-wide dashboard with KPIs aggregated across all modules the user has access to.

**FR-DASH-02:** The dashboard SHALL include, at minimum: active project count and contract value, open procurement requests, outstanding invoices and bills, fleet alert summary, and pending approvals.

**FR-DASH-03:** Each module (Projects, Finance, HR, Fleet) SHALL have its own module-level dashboard with module-specific KPIs.

---

### 4.3 Project Management

#### 4.3.1 Project Registry

**FR-PRJ-01:** The system SHALL allow creation of projects with the following fields: project code (unique), project name, client, contract number, contract value, location, GPS coordinates (latitude/longitude), status, start date, end date, and assigned branch.

**FR-PRJ-02:** Project statuses SHALL be: Planning, Active, On Hold, Completed, Suspended.

**FR-PRJ-03:** The system SHALL support bulk project import via Excel file upload.

**FR-PRJ-04:** Each project SHALL have a dedicated dashboard showing: contract value, amount invoiced, amount certified, project budget vs. actual spend, fleet assigned, personnel on site, and risk summary.

#### 4.3.2 Bill of Quantities (BOQ)

**FR-BOQ-01:** Each project SHALL support one or more BOQ records. Each BOQ SHALL have a title, contingency percentage, and Variation of Prices (VOP) percentage.

**FR-BOQ-02:** BOQs SHALL be structured into Bills, which are further divided into Line Items. Each line item SHALL record: item number, description, unit, quantity, rate, calculated amount, and actual cost.

**FR-BOQ-03:** The system SHALL support BOQ import via Excel file.

**FR-BOQ-04:** BOQ items SHALL be linkable to IPC claims, purchase requisitions, and stock transactions for cost tracing.

#### 4.3.3 Budget Management

**FR-BUD-01:** Each project SHALL support one or more Budget records. A budget SHALL have a title, time period (weeks), and status (Draft/Approved/Locked).

**FR-BUD-02:** Budget line items SHALL support the following cost categories: Materials, Fuel, Labour, Casuals, Management, Other.

**FR-BUD-03:** Each line item SHALL record: week/month number, description, quantity, base rate, waste allowance percentage, low and high variance percentages, and computed costs.

**FR-BUD-04:** The system SHALL provide a budget financial summary showing total budgeted cost, low-case, and high-case cost with variance reserve.

**FR-BUD-05:** The system SHALL support budget import via Excel workbook upload.

**FR-BUD-06:** The system SHALL track reference rates (e.g., plant hire rates, labour rates) per budget.

#### 4.3.4 Interim Payment Certificates (IPCs)

**FR-IPC-01:** Each project SHALL support IPC records. An IPC SHALL capture: IPC number, period from/to, chainage from/to, amount claimed, amount certified, amount paid, and status.

**FR-IPC-02:** IPC statuses SHALL be: Draft, Submitted, Certified, Paid, Disputed.

**FR-IPC-03:** Each IPC SHALL contain line items linked to BOQ items, capturing quantity this IPC, cumulative quantity to date, rate, and amount.

#### 4.3.5 Risk Register

**FR-RISK-01:** Each project SHALL maintain a risk register. Each risk entry SHALL capture: description, expected impact, budget treatment amount, realistic range, risk owner, impact level (Low/Medium/High/Critical), and status (Open/Mitigated/Closed/Escalated).

#### 4.3.6 Personnel Management

**FR-PERS-01:** Each project SHALL support a personnel roster capturing: employee name, role (Engineer/Foreman/Surveyor/Operator/Casual), start date, end date, monthly rate, and budget inclusion flag.

#### 4.3.7 Fleet Assignment

**FR-FLTA-01:** Vehicles SHALL be assignable to projects with an assigned-from date, assigned-to date, and daily rate.

#### 4.3.8 Weekly Progress Reports

**FR-PROG-01:** Each project SHALL support weekly progress entries capturing: week number, week dates, actual spend by category (materials, fuel, labour, casuals), total actual, casual headcount, and progress notes.

**FR-PROG-02:** The system SHALL compute budget vs. actual variance per category per week.

#### 4.3.9 Site Reports (Printable)

**FR-RPT-01:** The system SHALL provide a Foreman Daily Report form capturing: project header, labour breakdown by skill category, plant/equipment and materials used, work activities executed (with location/chainage and unit quantities), instructions and issues, and foreman/engineer signatures. The report SHALL be printable as a formatted PDF.

**FR-RPT-02:** The system SHALL provide a Foreman Weekly Report form capturing: project header, weekly labour summary by category and day (Mon–Sun), works executed during the week (with target vs. achieved), materials/issues/next-week plan, and prepared-by/reviewed-by signatures. The report SHALL be printable as a formatted PDF.

**FR-RPT-03:** The system SHALL provide a Surveyor Daily Report form capturing: project header, team attendance and equipment inventory, survey activities completed (with location/chainage, activity, output/reference), control points/levels checked (with easting, northing, level, and observation), and issues/instructions/next-day plan. The report SHALL be printable as a formatted PDF.

**FR-RPT-04:** The system SHALL provide a Surveyor Weekly Report form capturing: project header, weekly activity summary per day, benchmark/control summary, equipment status, challenges, next-week plan, and signatures. The report SHALL be printable as a formatted PDF.

**FR-RPT-05:** The system SHALL provide a Request for Inspection (RFI) form capturing: project header, work item description, inspection stage (Pre-construction/During Work/Before Covering Up/Final), contractor readiness checklist (with Yes/No and remarks per checklist item), attachments submitted (multi-select), contractor request details (name, designation, signature date), and engineer/consultant response (inspection result, comments, inspector details). The form SHALL be printable as a formatted PDF.

---

### 4.4 Procurement

#### 4.4.1 Supplier Management

**FR-SUP-01:** The system SHALL maintain a supplier master with: company name, KRA PIN (unique), VAT number, contact person, email, phone, payment terms, supply categories (multi-value), and performance rating.

**FR-SUP-02:** Supplier statuses SHALL be: Pending, Active, Blacklisted.

#### 4.4.2 Purchase Requisitions (PRs)

**FR-PR-01:** Any authorised user SHALL be able to create a Purchase Requisition with: auto-generated PR number, requesting user, department, linked project (optional), linked BOQ item (optional), required-by date, and one or more line items (description, unit, quantity, estimated unit rate).

**FR-PR-02:** The PR workflow SHALL follow a multi-stage approval sequence: Draft → Pending → Department Approved → Procurement Review → Finance Approved → MD Approved → Rejected / Converted.

**FR-PR-03:** Each approval action SHALL be recorded with: stage, approving user, action (approved/rejected), comment, and timestamp.

**FR-PR-04:** Upon MD approval, a PR SHALL be convertible to a Purchase Order.

#### 4.4.3 Purchase Orders (POs)

**FR-PO-01:** POs SHALL be generated from approved PRs or created directly. Each PO SHALL capture: auto-generated PO number, linked PR (optional), supplier, project, delivery date, delivery address, status, and line items.

**FR-PO-02:** PO statuses SHALL be: Draft, Approved, Sent, Partial, Received, Cancelled.

**FR-PO-03:** Each PO line item SHALL track received quantity to support partial deliveries.

---

### 4.5 Finance & Accounting

#### 4.5.1 Chart of Accounts

**FR-FIN-01:** The system SHALL maintain a hierarchical Chart of Accounts. Each account SHALL have: account code (unique), name, account type (Asset/Liability/Equity/Revenue/Expense), cost code, and optional parent account.

#### 4.5.2 Invoices (Accounts Receivable)

**FR-INV-01:** The system SHALL support client invoice creation with: auto-generated invoice number, invoice type (Progress Claim/Variation/Advance/Final/Other), client, project, issue date, due date, reporting period, subtotal, VAT rate and amount, retention rate and amount, total amount, amount paid, and balance due.

**FR-INV-02:** Invoice statuses SHALL be: Draft, Sent, Certified, Partial, Paid, Overdue, Disputed, Cancelled.

**FR-INV-03:** Invoice line items SHALL be mappable to GL accounts.

#### 4.5.3 Bills (Accounts Payable)

**FR-BILL-01:** The system SHALL support supplier/subcontractor bill capture with: auto-generated bill number, bill type (Supplier/Subcontractor/Utility/Professional/Other), supplier, project, linked PO (optional), issue date, due date, subtotal, VAT, withholding tax, total amount, amount paid, and balance due.

**FR-BILL-02:** Bill statuses SHALL be: Draft, Pending, Approved, Partial, Paid, Overdue, Disputed.

**FR-BILL-03:** Bill line items SHALL be mappable to GL accounts and project cost codes.

#### 4.5.4 Payments

**FR-PAY-01:** The system SHALL record payments against invoices (receipts) and bills (payments). Each payment SHALL capture: payment type, payment method (Bank Transfer/Cheque/M-Pesa/Cash), linked invoice or bill, amount, payment date, reference number, and recorded-by user.

#### 4.5.5 Expense Claims

**FR-EXP-01:** Employees SHALL be able to submit expense claims with: reference number, title, linked project, line items (date, description, category, amount, receipt reference), and total.

**FR-EXP-02:** Expense claim statuses SHALL be: Draft, Submitted, Approved, Rejected, Paid.

**FR-EXP-03:** Expense claims SHALL be reviewed and approved by a Finance Officer before payment.

#### 4.5.6 Retention Management

**FR-RET-01:** The system SHALL track retention funds on invoices (receivable) and bills (payable) separately.

**FR-RET-02:** Retention releases SHALL be created and tracked through an approval-to-payment workflow with statuses: Pending, Released, Paid.

#### 4.5.7 Payment Certificates

**FR-CERT-01:** The system SHALL support architect/QS payment certificate records capturing: certificate number, linked invoice, project, certified-by, certificate date, contract value, work done to date, certified amount, retention held, and net payment due.

#### 4.5.8 Performance Bonds

**FR-BOND-01:** The system SHALL track financial bonds and bank guarantees with: bond type (Performance/Advance/Retention/Bid/Maintenance/Other), reference, project, issuing bank, beneficiary, amount, issue date, expiry date, and status.

#### 4.5.9 Timesheets

**FR-TS-01:** Employees SHALL submit weekly timesheets with: week start date, and daily line items per project/cost code recording hours worked, hourly rate, and computed amount.

**FR-TS-02:** Timesheets SHALL be submitted, reviewed, and approved through a workflow, feeding cost data into payroll and project costing.

#### 4.5.10 GL Journal

**FR-GL-01:** The system SHALL maintain a double-entry General Ledger. Journal entries SHALL have: reference, entry type, date, accounting period, description, project, and status (Draft/Posted/Reversed).

**FR-GL-02:** Each journal entry SHALL contain at least two lines. Each line SHALL record: account, description, debit amount, credit amount, project, and cost code. The sum of debits SHALL equal the sum of credits.

**FR-GL-03:** The system SHALL support posting and reversal of journal entries. Reversal entries SHALL link back to the original entry.

**FR-GL-04:** The system SHALL generate a Trial Balance report from posted journals.

#### 4.5.11 Financial Reports

**FR-FRPT-01:** The system SHALL provide the following financial reports:
- Finance Dashboard (KPIs: revenue, expenses, outstanding AR/AP, cash position)
- Cash Flow analysis
- Project Profitability report
- Retention schedule (receivable and payable)
- Aged Debtors and Aged Creditors reports
- Budget vs. Actual report
- VAT Summary report
- Withholding Tax (WHT) register
- Payroll summary

---

### 4.6 Human Resources & Payroll

#### 4.6.1 Employee Master

**FR-HR-01:** The system SHALL maintain a comprehensive employee record including: auto-generated employee number, linked user account, employment type (Staff/Casual), personal demographics (name, gender, date of birth, marital status, national ID, KRA PIN, NSSF number, NHIF number), department, position, branch, reporting manager, employment dates, contract terms, salary, allowances (house, transport, medical, other), bank details, and emergency contact.

**FR-HR-02:** The system SHALL support document storage per employee (contract, ID copy, certificates, statutory documents).

#### 4.6.2 Job Grades & Positions

**FR-HR-03:** The system SHALL maintain job grades (G1–Gn) with salary band (minimum/maximum). Positions SHALL link to departments and job grades.

#### 4.6.3 Biometric Attendance

**FR-BIO-01:** The system SHALL support registration of biometric devices (fingerprint, face recognition, card/RFID, hybrid) with device ID, name, location, IP address, and API key.

**FR-BIO-02:** The system SHALL sync attendance data from biometric devices via API. Bulk attendance records SHALL be pushable to the ERP.

**FR-BIO-03:** Attendance records SHALL capture: employee, date, time in, time out, data source (Biometric/Manual/Mobile), device, computed status (Present/Absent/Late/Half Day/On Leave/Public Holiday/Off), late minutes, and overtime minutes.

**FR-BIO-04:** The system SHALL provide daily attendance sheets and monthly attendance reports filterable by department, branch, and project.

#### 4.6.4 Leave Management

**FR-LV-01:** The system SHALL support configurable leave types with: name, code, annual entitlement days, paid/unpaid flag, carry-forward rules, and applicability (All Staff/Staff Only/Casual Only).

**FR-LV-02:** The system SHALL track annual leave balances per employee per leave type, including entitled days, taken days, and carried-forward days.

**FR-LV-03:** Employees SHALL apply for leave specifying: leave type, start and end dates, reason, and handover contact. The system SHALL auto-calculate working days.

**FR-LV-04:** Leave applications SHALL follow a Submit → HR Review → Approve/Reject workflow.

#### 4.6.5 Payroll

**FR-PAY-01:** The system SHALL support monthly payroll periods. Each period SHALL have a month/year, status (Draft/Processing/Approved/Paid/Closed), and scheduled payment date.

**FR-PAY-02:** The system SHALL auto-generate payroll entries from employee records and attendance data. Each entry SHALL compute: working days, days worked, days on leave, basic salary, allowances, gross pay, PAYE tax (Kenya bands), NSSF (employee and employer), NHIF (employee and employer), loan/advance deductions, and net pay.

**FR-PAY-03:** The system SHALL support payroll approval: HR generates → Finance reviews → MD approves → Marked as Paid.

**FR-PAY-04:** Individual payroll entries SHALL be editable before approval.

**FR-PAY-05:** The system SHALL generate individual payslips for each employee.

#### 4.6.6 Salary Advances

**FR-ADV-01:** Employees SHALL be able to request salary advances with: amount, reason, and requested deduction period. Advances SHALL require approval and SHALL be tracked for payroll deduction.

#### 4.6.7 Disciplinary Records

**FR-DIS-01:** The system SHALL record disciplinary actions per employee capturing: incident date, record type (Warning/Suspension/Termination/Counselling/Other), description, action taken, issuing officer, and acknowledgement status.

#### 4.6.8 Employee Transfers

**FR-TRF-01:** The system SHALL track employee transfers (permanent or temporary) between sites, branches, and head office, capturing: destination, linked project (for site transfers), dates, relocation allowance, daily allowance, and approval status.

---

### 4.7 Inventory & Assets

#### 4.7.1 Stock Management

**FR-INV-01:** The system SHALL maintain a stock item master with: item code (unique), name, category, unit of measure, reorder level, valuation method (FIFO/WAC), and active status.

**FR-INV-02:** The system SHALL track current stock levels per item per store, including quantity on hand and weighted average cost.

**FR-INV-03:** The system SHALL record all stock movements as transactions with: transaction type (GRN/Issue/Transfer/Return/Adjustment), item, source and destination stores, quantity, unit cost, linked project/BOQ item/PO, reference number, and processed-by user.

**FR-INV-04:** The system SHALL display a low-stock alert list for items at or below reorder level.

#### 4.7.2 Fixed Assets

**FR-AST-01:** The system SHALL maintain a fixed asset register with: auto-generated asset code, name, category (IT/Furniture/Machinery/Vehicles/Office/Tools/Communication/Safety/Other), department, serial number, make and model, purchase date, purchase value, current value, condition (New/Good/Fair/Poor/Condemned), status (Active/Under Repair/Disposed/Lost), location, and assigned user.

**FR-AST-02:** Each asset SHALL have a maintenance history log capturing: date, description, cost, performed by, and next service date.

**FR-AST-03:** The system SHALL provide an asset dashboard with KPIs: total asset count, asset value, condition distribution, and upcoming maintenance.

---

### 4.8 Fleet Management

#### 4.8.1 Vehicle Registry

**FR-FLT-01:** The system SHALL maintain a vehicle master with: vehicle registration number (unique), vehicle name, IMEI, vehicle type, make, model, year, colour, fuel type, fuel capacity, assigned project, telematics API config, active status, asset number, chassis number, erp code, erp status, priority flag, known defects, and required actions.

**FR-FLT-02:** The system SHALL support bulk vehicle import via Excel register file.

#### 4.8.2 Telematics Integration

**FR-GPS-01:** The system SHALL integrate with external telematics providers via configurable API credentials. Two integration modes SHALL be supported: vehicle-wise (per-vehicle endpoint) and token-based (unified authentication).

**FR-GPS-02:** The system SHALL automatically sync vehicle live data at regular intervals (default: 90 seconds). Manual sync SHALL also be available.

**FR-GPS-03:** Live data captured per vehicle SHALL include: timestamp, GPS coordinates (latitude/longitude), location name, speed, heading, GPS status, ignition status, power status, fuel level, battery percentage, odometer reading, and driver name.

**FR-GPS-04:** The system SHALL provide a live fleet map/list view showing all vehicles with their current status, speed, location, and fuel level.

#### 4.8.3 Fuel Event Detection

**FR-FUEL-01:** The system SHALL automatically detect fuel fill events when fuel level increases by ≥ 10 litres (or equivalent percentage) between consecutive readings.

**FR-FUEL-02:** The system SHALL automatically detect fuel drain events when fuel level decreases by ≥ 10 litres between consecutive readings under conditions consistent with draining (not normal consumption).

**FR-FUEL-03:** The system SHALL detect fuel theft events when fuel decreases by ≥ 20 litres with the ignition off.

**FR-FUEL-04:** The system SHALL apply a 30-minute deduplication window per vehicle per event type to prevent duplicate events from multiple sync cycles during a single real-world event.

**FR-FUEL-05:** The system SHALL detect and suppress sensor bounce events — where a momentary low reading is followed within 60 minutes by a fill of ≥ 70% the drain magnitude — and delete both false events.

**FR-FUEL-06:** Fuel events SHALL record: vehicle, event type, timestamp, location, GPS coordinates, fuel level before and after, and fuel change amount.

#### 4.8.4 Trip Recording

**FR-TRIP-01:** The system SHALL record trip history per vehicle capturing: start/end timestamps, start/end locations, GPS coordinates trace, start/end odometer, distance travelled, trip duration, maximum speed, fuel consumed, and driver name.

#### 4.8.5 Fleet Alerts

**FR-ALRT-01:** The system SHALL generate alerts for the following event types: SOS, Speeding, Low Fuel, Fuel Refill, Fuel Drain, Ignition Off While Moving, Extended Idle, Device Offline, Insurance Expiry, Inspection Expiry, Speed Governor Expiry, and Compliance Issues.

**FR-ALRT-02:** Alert severity levels SHALL be: Low, Medium, High, Critical.

**FR-ALRT-03:** Alerts SHALL be displayed in a filterable list. The Alerts page SHALL by default show only: Fuel Refill, Fuel Drain, Insurance Expiry, Inspection Expiry, Speed Governor Expiry, and Geofence alerts.

**FR-ALRT-04:** Authorised users SHALL be able to acknowledge alerts. Acknowledgements SHALL record the acknowledging user and timestamp.

#### 4.8.6 Maintenance

**FR-MAINT-01:** The system SHALL record maintenance events per vehicle with: maintenance type (Service/Repair/Inspection/Tyre/Oil/Other), description, date, odometer at service, cost, performed by, next service date, and next service odometer.

#### 4.8.7 Compliance Tracking

**FR-COMP-01:** The system SHALL track three compliance items per vehicle: insurance expiry, vehicle inspection expiry, and speed governor certificate expiry.

**FR-COMP-02:** Compliance statuses SHALL be: Valid, Expiring Soon, Expired, Not in System, Not Applicable, Unknown.

**FR-COMP-03:** The system SHALL generate alerts when compliance items are approaching expiry.

#### 4.8.8 Fleet Reports

**FR-FRPT-01:** The system SHALL provide a Fuel Consumption report per vehicle over a selectable date range.

**FR-FRPT-02:** The system SHALL provide a Vehicle Utilisation report showing active vs. idle time per vehicle.

---

### 4.9 CRM

**FR-CRM-01:** The system SHALL maintain a client master with: company name, contact person, email, phone, address, KRA PIN, and active status.

**FR-CRM-02:** The system SHALL track tender opportunities with: opportunity name, client, tender number, estimated value, pipeline stage, submission deadline, assigned user, probability percentage, and win/loss reason.

**FR-CRM-03:** Tender pipeline stages SHALL be: Prospect, Qualified, Bid Preparation, Submitted, Won, Lost.

---

### 4.10 Staff Requisitions

**FR-REQ-01:** Any authorised user SHALL be able to raise a staff requisition for store items, external purchases, or services, with: auto-generated reference number, title, requisition type, priority (Low/Medium/High/Urgent), department, project, description, date required, and one or more line items.

**FR-REQ-02:** Requisition workflow SHALL be: Draft → Submitted → Department Review → Finance Review → MD Review → Approved → Fulfilled.

**FR-REQ-03:** Each approval stage SHALL be recorded with action, approver, comments, and timestamp.

**FR-REQ-04:** Approved requisitions SHALL be fulfillable with fulfillment notes and fulfilled-by user.

**FR-REQ-05:** The system SHALL provide a pending-approvals view showing all requisitions awaiting the current user's action.

---

### 4.11 Notifications

**FR-NOT-01:** The system SHALL deliver in-app notifications to users for the following events: PR approved/rejected, PR submitted (to approver), PO approved, low stock alert, tender submission deadline approaching, IPC issued, and general system announcements.

**FR-NOT-02:** Users SHALL be able to view unread notifications, mark individual notifications as read, and mark all as read.

**FR-NOT-03:** The system SHALL expose an unread notification count for display in the navigation header.

---

## 5. Non-Functional Requirements

### 5.1 Performance

**NFR-01:** All list endpoint responses with up to 200 records SHALL respond within 1 second under normal load.

**NFR-02:** The live fleet data view SHALL display current vehicle statuses within 5 seconds of opening.

**NFR-03:** The system SHALL support at least 50 concurrent users without performance degradation.

**NFR-04:** Background telematics sync SHALL complete a full fleet sync cycle within 60 seconds.

### 5.2 Availability

**NFR-05:** The system SHALL target 99.5% uptime (excluding scheduled maintenance windows).

**NFR-06:** The system SHALL be accessible via modern web browsers (Chrome, Firefox, Edge, Safari — latest 2 versions).

### 5.3 Scalability

**NFR-07:** The database schema SHALL use UUID primary keys to support distributed data and future horizontal scaling.

**NFR-08:** The system architecture SHALL support addition of new modules without requiring major refactoring of existing modules.

### 5.4 Usability

**NFR-09:** The user interface SHALL be responsive for desktop and tablet devices (minimum 768px width).

**NFR-10:** All data tables SHALL support filtering, sorting, and pagination.

**NFR-11:** All forms SHALL provide inline validation feedback before submission.

**NFR-12:** Print-formatted PDF reports SHALL faithfully represent the Lakezone Enterprises Ltd branded document templates with company logo, brand colours, and structured layout.

### 5.5 Maintainability

**NFR-13:** The backend API SHALL be versioned (currently `/api/v1/`) to allow future breaking changes without disrupting existing clients.

**NFR-14:** The system SHALL include API documentation (Swagger/Redoc) auto-generated from backend code.

**NFR-15:** The codebase SHALL follow a modular structure with each business domain in a separate Django app and React page directory.

### 5.6 Data Integrity

**NFR-16:** All financial amounts SHALL be stored using decimal precision fields (not floating point).

**NFR-17:** Double-entry journal lines SHALL be validated to ensure debits equal credits before posting.

**NFR-18:** Referential integrity SHALL be enforced at the database level via foreign key constraints.

**NFR-19:** Stock level records SHALL be kept consistent with stock transaction history at all times.

---

## 6. System Architecture

### 6.1 Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend Framework | Django 4.x with Django REST Framework (DRF) |
| Language | Python 3.x |
| Database | PostgreSQL |
| Authentication | SimpleJWT (JWT access + refresh tokens) |
| Background Tasks | Django management commands / scheduled tasks |
| API Documentation | drf-spectacular (OpenAPI 3) |
| Frontend Framework | React 19 |
| Build Tool | Vite |
| State Management | TanStack Query v5 (React Query) |
| Styling | Tailwind CSS |
| HTTP Client | Axios |
| PDF Generation | Browser print API (printDoc utility) |

### 6.2 Deployment Architecture

```
Internet
    │
    ▼
Nginx (reverse proxy + static file serving)
    │
    ├──▶ Django/Gunicorn (WSGI, 3 workers, 127.0.0.1:8000)
    │         │
    │         └──▶ PostgreSQL (database)
    │
    └──▶ React frontend (static build at /frontend/dist)
```

### 6.3 Module Dependency Map

```
core (Auth/Users)
    ▼
projects ──▶ finance (invoices, budgets)
    │     ──▶ procurement (PRs, POs)
    │     ──▶ fleet (vehicle assignments)
    │     ──▶ hr (personnel, timesheets)
    │     ──▶ inventory (stock transactions)
    │
procurement ──▶ inventory (GRN)
             ──▶ finance (bills, payments)
             ──▶ notifications

hr ──▶ finance (payroll, timesheets)
    ──▶ notifications (leave approvals)

fleet ──▶ projects (assignments)
      ──▶ external telematics API

inventory ──▶ procurement (PO linkage)
          ──▶ projects (cost allocation)

crm ──▶ projects (client linkage)

requisitions ──▶ procurement (PR conversion)
             ──▶ inventory (fulfillment)
             ──▶ notifications

notifications ◀── all modules
```

---

## 7. Data Model Summary

### 7.1 Core Entities

| Entity | Primary Key | Key Relationships |
|--------|------------|-------------------|
| User | UUID | Branch, Department |
| Branch | UUID | Has many Departments, Users |
| Department | UUID | FK Branch, FK User (head) |

### 7.2 Project Entities

| Entity | Primary Key | Key Relationships |
|--------|------------|-------------------|
| Project | UUID | FK Client; has many BOQ, Budget, IPC, Risk, Vehicle, Personnel, Progress |
| BOQ | UUID | FK Project; has many BOQBill → BOQItem |
| Budget | UUID | FK Project; has many BudgetLineItem, BudgetRate |
| IPC | UUID | FK Project; has many IPCItem → BOQItem |
| ProjectRisk | UUID | FK Project |
| ProjectVehicle | UUID | FK Project, Vehicle |
| ProjectPersonnel | UUID | FK Project |
| WeeklyProgress | UUID | FK Project |

### 7.3 Finance Entities

| Entity | Primary Key | Key Relationships |
|--------|------------|-------------------|
| Account | UUID | Self-ref parent (hierarchy) |
| Invoice | UUID | FK Client, Project; has many InvoiceLine |
| Bill | UUID | FK Supplier, Project, PO; has many BillLine |
| Payment | UUID | FK Invoice or Bill |
| ExpenseClaim | UUID | FK Employee, Project; has many ExpenseClaimItem |
| RetentionRelease | UUID | FK Invoice or Bill |
| PaymentCertificate | UUID | FK Invoice, Project |
| PerformanceBond | UUID | FK Project |
| Timesheet | UUID | FK Employee; has many TimesheetLine |
| JournalEntry | UUID | FK Project; self-ref reversal; has many JournalLine |
| ProjectBudget | UUID | FK Project, Account |

### 7.4 HR Entities

| Entity | Primary Key | Key Relationships |
|--------|------------|-------------------|
| Employee | UUID | FK User, Department, Position, Branch, Manager(self) |
| AttendanceRecord | UUID | FK Employee, BiometricDevice |
| LeaveBalance | UUID | FK Employee, LeaveType |
| LeaveApplication | UUID | FK Employee, LeaveType |
| PayrollPeriod | UUID | Has many PayrollEntry |
| PayrollEntry | UUID | FK PayrollPeriod, Employee, Project |
| SalaryAdvance | UUID | FK Employee |
| DisciplinaryRecord | UUID | FK Employee |
| EmployeeTransfer | UUID | FK Employee, Project |

### 7.5 Inventory Entities

| Entity | Primary Key | Key Relationships |
|--------|------------|-------------------|
| StockItem | UUID | Has many StockLevel, StockTransaction |
| StockLevel | UUID | FK StockItem, Store |
| StockTransaction | UUID | FK StockItem, Store, Project, BOQItem, PO |
| Asset | UUID | FK Department, User; has many AssetMaintenanceLog |

### 7.6 Fleet Entities

| Entity | Primary Key | Key Relationships |
|--------|------------|-------------------|
| Vehicle | UUID | FK Project, FleetAPIConfig; has many LiveData, FuelEvent, Trip, Alert, Maintenance, Compliance |
| VehicleLiveData | UUID | FK Vehicle (time-series) |
| FuelEvent | UUID | FK Vehicle |
| TripRecord | UUID | FK Vehicle |
| FleetAlert | UUID | FK Vehicle |
| MaintenanceRecord | UUID | FK Vehicle |
| VehicleCompliance | UUID | FK Vehicle |
| VehicleAssignment | UUID | FK Vehicle, Employee |

### 7.7 Other Entities

| Entity | Primary Key | Key Relationships |
|--------|------------|-------------------|
| Supplier | UUID | Has many PO, Bill |
| PurchaseRequisition | UUID | FK User, Department, Project, BOQItem; has many PRLineItem, PRApproval |
| PurchaseOrder | UUID | FK PR, Supplier, Project; has many POLineItem |
| Client | UUID | Has many Invoice, TenderOpportunity |
| TenderOpportunity | UUID | FK Client, User |
| StaffRequisition | UUID | FK User, Department, Project; has many RequisitionItem, RequisitionApproval |
| Notification | UUID | FK User (recipient) |

---

## 8. API Specification Summary

All endpoints are prefixed with `/api/v1/`. Authentication is required via `Authorization: Bearer <access_token>` header on all endpoints except `/auth/login/` and `/auth/token/refresh/`.

### 8.1 Authentication Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| POST | `/auth/login/` | Public | Login and receive JWT tokens |
| POST | `/auth/logout/` | Authenticated | Blacklist refresh token |
| POST | `/auth/token/refresh/` | Public | Refresh access token |
| GET/PATCH | `/auth/me/` | Authenticated | Get/update own profile |
| POST | `/auth/change-password/` | Authenticated | Change own password |
| GET/POST | `/auth/users/` | System Admin | List/create users |
| GET/PATCH/DELETE | `/auth/users/{id}/` | System Admin | User detail |
| POST | `/auth/users/{id}/reset-password/` | System Admin | Admin password reset |
| GET/POST | `/auth/branches/` | Management | Branch list/create |
| GET/POST | `/auth/departments/` | Management | Department list/create |

### 8.2 Project Endpoints (24 endpoints)

Prefixed: `/projects/`

Key endpoints: list/create projects, project CRUD, import, dashboard, BOQ CRUD+import, budget CRUD+summary+line items, IPC CRUD+items, risks CRUD, personnel CRUD, vehicle assignments CRUD, progress CRUD, project costing report.

### 8.3 Procurement Endpoints (8 endpoints)

Prefixed: `/procurement/`

Key endpoints: supplier CRUD, PR CRUD+approve+convert, PO CRUD.

### 8.4 Finance Endpoints (35+ endpoints)

Prefixed: `/finance/`

Key endpoints: dashboard, accounts CRUD, invoice CRUD, bill CRUD, payments, expense claims CRUD+workflow, cash flow, profitability, retention+releases+action, aged debtors/creditors, budget vs actual, VAT summary, WHT register, payment certificates CRUD, bonds CRUD, timesheets CRUD+workflow, payroll summary, journals CRUD+post+reverse, trial balance.

### 8.5 HR Endpoints (40+ endpoints)

Prefixed: `/hr/`

Key endpoints: dashboard, job grades CRUD, positions CRUD, employees CRUD, documents CRUD, biometric devices CRUD+sync+push, attendance query+daily sheet+monthly report+bulk mark, leave types CRUD, leave balances, leave applications CRUD+submit+review, payroll periods CRUD+generate+approve+pay, payroll entries+payslip, advances CRUD+review, disciplinary CRUD, transfers CRUD+submit+review.

### 8.6 Inventory Endpoints (12 endpoints)

Prefixed: `/inventory/`

Key endpoints: stores CRUD, stock items CRUD+low-stock, stock levels, transactions, asset dashboard, assets CRUD, asset maintenance CRUD.

### 8.7 Fleet Endpoints (22 endpoints)

Prefixed: `/fleet/`

Key endpoints: dashboard, vehicles CRUD+compliance, live data (all+single), manual sync, fuel events, trips, alerts+acknowledge, maintenance CRUD, fuel report, utilization report, API config CRUD, backfill, fetch history, fetch fuel events, import register.

### 8.8 CRM Endpoints (4 endpoints)

Prefixed: `/crm/`

Key endpoints: clients CRUD, opportunities CRUD.

### 8.9 Requisitions Endpoints (6 endpoints)

Prefixed: `/requisitions/`

Key endpoints: list/create, pending approvals, detail+update, approve, fulfill.

### 8.10 Notifications Endpoints (4 endpoints)

Prefixed: `/notifications/`

Key endpoints: list, unread count, mark all read, mark single read.

---

## 9. Business Workflows

### 9.1 Procurement Workflow

```
1. User creates Purchase Requisition (Draft)
2. User submits PR → Status: Pending
3. Department Head reviews → Status: Dept Approved
4. Procurement Officer reviews → Status: Procurement Review
5. Finance Officer approves → Status: Finance Approved
6. Managing Director approves → Status: MD Approved
   └─ OR: Any approver rejects → Status: Rejected (with reason)
7. Procurement Officer converts PR to PO → PR Status: Converted
8. PO sent to supplier → Status: Sent
9. Goods received (partial or full GRN) → Stock Transactions created
10. Supplier bill received → Bill created and linked to PO
11. Finance Officer pays bill → Payment recorded
```

### 9.2 Project Lifecycle Workflow

```
1. CRM: Client onboarded; Tender opportunity tracked to Won
2. Project created (Planning status)
3. BOQ imported/created; Budget built
4. Project activated (Active status)
5. Personnel and fleet assigned to project
6. Weekly progress entries track actual vs. budget
7. IPC submitted to client; certified amount recorded
8. Client invoice raised; payment tracked
9. Retention managed until final certificate
10. Project completed or suspended
```

### 9.3 Payroll Workflow

```
1. HR creates Payroll Period for month
2. System generates payroll entries from employee records + attendance
3. HR Manager reviews and edits individual entries
4. Finance Officer reviews total payroll cost
5. Managing Director approves payroll run
6. Payroll marked as Paid
7. Individual payslips available for download
8. GL journal entries auto-posted for salary and statutory deductions
```

### 9.4 Leave Workflow

```
1. Employee creates Leave Application (Draft)
2. Employee submits → Status: Submitted
3. HR Manager reviews → Approved / Rejected
4. If approved: leave balance reduced; attendance records updated
5. Notification sent to employee and handover contact
```

### 9.5 Expense Claim Workflow

```
1. Employee creates Expense Claim with receipts (Draft)
2. Employee submits for approval
3. Finance Officer reviews → Approved / Rejected
4. Approved claim paid; payment recorded against claim
5. GL journal entry created for expense
```

### 9.6 Staff Requisition Workflow

```
1. Staff member creates Requisition (Draft) for items/services
2. Staff submits → Status: Submitted
3. Department Head reviews → Status: Dept Review
4. Finance reviews cost → Status: Finance
5. MD approves → Status: Approved
6. Storekeeper or Procurement fulfills → Status: Fulfilled
```

### 9.7 Fleet Alert Workflow

```
[Automated]
1. Telematics sync detects event (fuel drop, speed, SOS, compliance expiry)
2. System evaluates event against thresholds
3. FleetAlert record created with severity and message
4. Alert appears in Alerts page for relevant users
5. Authorised user acknowledges alert (records user + timestamp)
```

### 9.8 Site Reporting Workflow

```
1. Site Foreman/Surveyor opens Project → Reports
2. Selects report type (Daily/Weekly/RFI)
3. Fills in form fields (all fields editable on-screen)
4. Clicks "Print/Download PDF" → formatted report opens in print window
5. User prints or saves as PDF using browser print dialog
```

---

## 10. External Integrations

### 10.1 GPS/Telematics API

| Attribute | Detail |
|-----------|--------|
| Purpose | Real-time vehicle tracking, fuel monitoring, trip recording |
| Integration Mode | Configurable per installation: Vehicle-wise or Token-based |
| Trigger | Automatic (90s interval background task) + manual sync |
| Data Received | GPS coordinates, speed, fuel level, odometer, ignition status, temperature, battery, driver |
| Authentication | Username/password or pre-shared token (stored in FleetAPIConfig) |
| Providers Supported | Trakzee, TrackNTrace, or compatible REST API |

### 10.2 Biometric Device API

| Attribute | Detail |
|-----------|--------|
| Purpose | Automated employee attendance capture |
| Device Types | Fingerprint, Face Recognition, Card/RFID, Hybrid |
| Integration Mode | Pull (sync from device) and Push (device posts to ERP) |
| Authentication | Per-device API key |
| Data Received | Employee ID, punch timestamp, device ID |

### 10.3 File Import/Export

| Operation | Format | Module |
|-----------|--------|--------|
| Project import | Excel (.xlsx) | Projects |
| Budget import | Excel workbook | Projects |
| BOQ import | Excel (.xlsx) | Projects |
| Fleet register import | Excel (.xlsx) | Fleet |
| Payslip export | PDF (print-to-browser) | HR/Finance |
| Site report export | PDF (print-to-browser) | Projects |

---

## 11. Security Requirements

**NFR-SEC-01:** All API endpoints (except login and token refresh) SHALL require a valid JWT access token.

**NFR-SEC-02:** Passwords SHALL be hashed using Django's PBKDF2-SHA256 algorithm. Plain-text passwords SHALL never be stored.

**NFR-SEC-03:** System-generated passwords (admin reset) SHALL use Python's `secrets` module (cryptographically secure random) with a character set including uppercase, lowercase, digits, and symbols.

**NFR-SEC-04:** Refresh tokens SHALL be blacklisted upon logout to prevent token reuse.

**NFR-SEC-05:** All API responses SHALL include appropriate HTTP status codes. Error messages SHALL not expose internal system details (stack traces, database errors) to clients.

**NFR-SEC-06:** The system SHALL enforce RBAC on all endpoints. Users SHALL only access data and perform actions permitted by their assigned role.

**NFR-SEC-07:** All HTTP traffic SHALL be served over HTTPS in production.

**NFR-SEC-08:** API configuration credentials (telematics API keys, biometric device API keys) SHALL be stored in the database and not in source code or environment configuration files in plaintext.

**NFR-SEC-09:** File uploads SHALL be validated for allowed file types and maximum size before processing.

**NFR-SEC-10:** SQL injection SHALL be prevented by using Django ORM parameterised queries exclusively. Raw SQL, if used, SHALL use parameterised inputs only.

---

## 12. Constraints & Assumptions

### 12.1 Constraints

1. **Regulatory Compliance:** The payroll module SHALL comply with current Kenya Revenue Authority (KRA) PAYE tax bands, NSSF Act contributions, and NHIF contribution tables.

2. **Currency:** The system's primary currency is Kenyan Shillings (KES). Multi-currency support is out of scope for v1.

3. **Hosting Environment:** The system is deployed on a Linux server (Ubuntu/Debian) with Nginx as the reverse proxy and Gunicorn as the WSGI application server.

4. **Browser Support:** The frontend SHALL support Chrome, Firefox, Edge, and Safari (latest 2 major versions). Internet Explorer is not supported.

5. **Print Reports:** PDF generation relies on the browser's built-in print dialog. A dedicated PDF generation service is not required.

### 12.2 Assumptions

1. Users access the system via a stable internet connection. Offline functionality is not provided.

2. The telematics provider's API is available and returns data in the expected format. The ERP does not dictate the format of the external GPS provider beyond the two supported integration modes.

3. Each employee is associated with exactly one User account in the system.

4. The biometric device API accepts HTTP calls from the ERP server's IP address.

5. Project BOQ and budget Excel imports conform to a predefined template structure.

6. All financial data relates to a single legal entity (Lakezone Enterprises Ltd). Multi-company accounting is out of scope for v1.

7. The system is administered by at least one user with the System Admin role who manages user accounts and system configuration.

---

*End of Software Requirements Specification*

*Document prepared for Lakezone Enterprises Ltd | P.O Box 74140-00200 Nairobi*
*Prepared by: Lakezone ERP Development Team | June 2026*
