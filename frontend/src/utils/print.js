/**
 * Opens a styled print window for any document.
 * Usage: printDoc({ title, html })
 */
export function printDoc({ title, html }) {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; background: #fff; padding: 32px 40px; }
    @media print { body { padding: 16px 24px; } .no-print { display: none !important; } }

    /* Header */
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e11d48; padding-bottom: 16px; margin-bottom: 20px; }
    .doc-logo { font-size: 18px; font-weight: 800; color: #e11d48; letter-spacing: -0.5px; }
    .doc-logo span { color: #1e293b; }
    .doc-meta { text-align: right; }
    .doc-meta h1 { font-size: 15px; font-weight: 700; color: #1e293b; }
    .doc-meta p { font-size: 10px; color: #64748b; margin-top: 2px; }

    /* Info grid */
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
    .info-box label { display: block; font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
    .info-box span { font-size: 11px; font-weight: 600; color: #1e293b; }

    /* Status badge */
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; border: 1px solid currentColor; }
    .badge-gray { color: #64748b; background: #f1f5f9; }
    .badge-green { color: #16a34a; background: #f0fdf4; }
    .badge-amber { color: #d97706; background: #fffbeb; }
    .badge-red { color: #dc2626; background: #fef2f2; }
    .badge-blue { color: #2563eb; background: #eff6ff; }
    .badge-purple { color: #7c3aed; background: #f5f3ff; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: #f1f5f9; }
    th { padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; }
    td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #334155; }
    tr:last-child td { border-bottom: none; }
    tfoot tr { background: #f8fafc; }
    tfoot td { font-weight: 700; color: #1e293b; border-top: 2px solid #e2e8f0; }
    .amount { text-align: right; font-variant-numeric: tabular-nums; }
    .section-title { font-size: 11px; font-weight: 700; color: #1e293b; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }

    /* Totals */
    .totals-block { margin-left: auto; width: 280px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 24px; }
    .totals-row { display: flex; justify-content: space-between; padding: 7px 14px; border-bottom: 1px solid #f1f5f9; }
    .totals-row:last-child { border-bottom: none; background: #f8fafc; font-weight: 700; color: #1e293b; }
    .totals-label { color: #64748b; font-size: 10px; }
    .totals-value { font-weight: 600; font-size: 11px; font-variant-numeric: tabular-nums; }

    /* Footer */
    .doc-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
    .doc-footer p { font-size: 9px; color: #94a3b8; }
    .print-btn { background: #e11d48; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .print-btn:hover { background: #be123c; }

    /* Signatures */
    .sig-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 32px; }
    .sig-box { border-top: 1px solid #1e293b; padding-top: 6px; }
    .sig-box label { font-size: 9px; color: #64748b; display: block; }
    .sig-box span { font-size: 10px; font-weight: 600; color: #1e293b; display: block; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="doc-header">
    <div class="doc-logo">LAKE<span>ZONE</span><br><small style="font-size:10px;font-weight:400;color:#64748b;">Lake Zone Enterprises Ltd</small></div>
    <div class="doc-meta">
      <h1>${title}</h1>
      <p>Printed: ${new Date().toLocaleString()}</p>
    </div>
  </div>
  ${html}
  <div class="doc-footer no-print" style="margin-top:24px;">
    <p>Lake Zone Enterprises Ltd · ERP System</p>
    <button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>
  </div>
  <div class="doc-footer" style="display:none;" id="print-footer">
    <p>Lake Zone Enterprises Ltd · ERP System · Confidential</p>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`)
  win.document.close()
}

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`

export function printPR(pr) {
  const total = Number(pr.total_estimated_value) || 0
  const rows = (pr.line_items || []).map((item, i) => {
    const amount = Number(item.quantity) * Number(item.estimated_unit_rate)
    return `<tr>
      <td>${i + 1}</td>
      <td>${item.description}</td>
      <td>${item.unit}</td>
      <td class="amount">${Number(item.quantity).toLocaleString()}</td>
      <td class="amount">${Number(item.estimated_unit_rate).toLocaleString()}</td>
      <td class="amount">${amount.toLocaleString()}</td>
      <td>${item.notes || '—'}</td>
    </tr>`
  }).join('')

  const statusClass = { draft: 'badge-gray', pending: 'badge-amber', md_approved: 'badge-green', rejected: 'badge-red' }[pr.status] || 'badge-blue'
  const statusLabel = pr.status_display ?? pr.status?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase())

  printDoc({
    title: `PR ${pr.pr_number}`,
    html: `
    <div class="info-grid">
      <div class="info-box"><label>PR Number</label><span>${pr.pr_number}</span></div>
      <div class="info-box"><label>Status</label><span><span class="badge ${statusClass}">${statusLabel}</span></span></div>
      <div class="info-box"><label>Requested By</label><span>${pr.requested_by_name || '—'}</span></div>
      <div class="info-box"><label>Date</label><span>${pr.created_at ? new Date(pr.created_at).toLocaleDateString() : '—'}</span></div>
      <div class="info-box"><label>Department</label><span>${pr.department_name || '—'}</span></div>
      <div class="info-box"><label>Project</label><span>${pr.project_name || '—'}</span></div>
      <div class="info-box"><label>Required By</label><span>${pr.required_by_date || '—'}</span></div>
      <div class="info-box"><label>Est. Total</label><span>${fmt(total)}</span></div>
    </div>

    <p class="section-title">Line Items</p>
    <table>
      <thead><tr><th>#</th><th>Description</th><th>Unit</th><th class="amount">Qty</th><th class="amount">Unit Rate</th><th class="amount">Amount (KES)</th><th>Notes</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="5" style="text-align:right;padding-right:16px;">Total Estimated Value</td><td class="amount">${fmt(total)}</td><td></td></tr></tfoot>
    </table>

    ${pr.approvals?.length ? `
    <p class="section-title">Approval History</p>
    <table>
      <thead><tr><th>Stage</th><th>Action</th><th>By</th><th>Date</th><th>Comment</th></tr></thead>
      <tbody>${pr.approvals.map(a => `<tr>
        <td>${a.stage?.replace(/_/g, ' ') || '—'}</td>
        <td style="color:${a.action === 'approved' ? '#16a34a' : '#dc2626'};font-weight:600;">${a.action}</td>
        <td>${a.approved_by_name || '—'}</td>
        <td>${a.timestamp ? new Date(a.timestamp).toLocaleDateString() : '—'}</td>
        <td>${a.comment || '—'}</td>
      </tr>`).join('')}</tbody>
    </table>` : ''}

    <div class="sig-row">
      <div class="sig-box"><label>Requested By</label><span>${pr.requested_by_name || ''}</span></div>
      <div class="sig-box"><label>Approved By (Dept)</label><span>&nbsp;</span></div>
      <div class="sig-box"><label>MD / CEO Approval</label><span>&nbsp;</span></div>
    </div>`,
  })
}

export function printPO(po) {
  const total = Number(po.total_value) || 0
  const rows = (po.line_items || []).map((item, i) => {
    const lineTotal = Number(item.unit_price) * Number(item.quantity)
    return `<tr>
      <td>${i + 1}</td>
      <td>${item.description}</td>
      <td>${item.unit}</td>
      <td class="amount">${Number(item.quantity).toLocaleString()}</td>
      <td class="amount">${Number(item.unit_price).toLocaleString()}</td>
      <td class="amount">${lineTotal.toLocaleString()}</td>
    </tr>`
  }).join('')

  printDoc({
    title: `PO ${po.po_number}`,
    html: `
    <div class="info-grid">
      <div class="info-box"><label>PO Number</label><span>${po.po_number}</span></div>
      <div class="info-box"><label>Supplier</label><span>${po.supplier_name || '—'}</span></div>
      <div class="info-box"><label>PR Reference</label><span>${po.pr_number || '—'}</span></div>
      <div class="info-box"><label>Status</label><span>${po.status?.replace(/_/g, ' ') || '—'}</span></div>
      <div class="info-box"><label>Delivery Date</label><span>${po.delivery_date || '—'}</span></div>
      <div class="info-box"><label>Delivery Address</label><span>${po.delivery_address || '—'}</span></div>
      <div class="info-box"><label>Project</label><span>${po.project_name || '—'}</span></div>
      <div class="info-box"><label>Total Value</label><span>${fmt(total)}</span></div>
    </div>

    <p class="section-title">Line Items</p>
    <table>
      <thead><tr><th>#</th><th>Description</th><th>Unit</th><th class="amount">Qty</th><th class="amount">Unit Price (KES)</th><th class="amount">Total (KES)</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="5" style="text-align:right;padding-right:16px;">Total Order Value</td><td class="amount">${fmt(total)}</td></tr></tfoot>
    </table>

    ${po.notes ? `<p class="section-title">Notes</p><p style="font-size:11px;color:#475569;margin-bottom:20px;">${po.notes}</p>` : ''}

    <div class="sig-row">
      <div class="sig-box"><label>Prepared By</label><span>&nbsp;</span></div>
      <div class="sig-box"><label>Approved By</label><span>&nbsp;</span></div>
      <div class="sig-box"><label>Received By</label><span>&nbsp;</span></div>
    </div>`,
  })
}

export function printBOQ(boq, projectName) {
  const subTotal = Number(boq.sub_total || 0)
  const vop = subTotal * 1.1
  const grand = vop * 1.1

  const billsHtml = (boq.bills || []).map(bill => {
    const billSub = Number(bill.sub_total || 0)
    const itemRows = (bill.items || []).map(item => `<tr>
      <td>${item.item_number}</td>
      <td>${item.description}</td>
      <td>${item.unit}</td>
      <td class="amount">${Number(item.quantity || 0).toLocaleString()}</td>
      <td class="amount">${Number(item.rate || 0).toLocaleString()}</td>
      <td class="amount">${Number(item.amount || 0).toLocaleString()}</td>
    </tr>`).join('')

    return `
    <p class="section-title" style="margin-top:16px;">Bill ${bill.bill_number} — ${bill.description} &nbsp;<span style="float:right;font-weight:700;">${fmt(billSub)}</span></p>
    <table>
      <thead><tr><th>#</th><th>Description</th><th>Unit</th><th class="amount">Qty</th><th class="amount">Rate (KES)</th><th class="amount">Amount (KES)</th></tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr><td colspan="5" style="text-align:right;padding-right:16px;">Bill Sub-Total</td><td class="amount">${fmt(billSub)}</td></tr></tfoot>
    </table>`
  }).join('')

  printDoc({
    title: `BOQ — ${projectName || boq.title || 'Project'}`,
    html: `
    <div class="info-grid" style="grid-template-columns:repeat(3,1fr);">
      <div class="info-box"><label>Project</label><span>${projectName || '—'}</span></div>
      <div class="info-box"><label>BOQ Title</label><span>${boq.title || '—'}</span></div>
      <div class="info-box"><label>Bills</label><span>${boq.bills?.length || 0}</span></div>
    </div>

    ${billsHtml}

    <div class="totals-block">
      <div class="totals-row"><span class="totals-label">Sub Total</span><span class="totals-value">${fmt(subTotal)}</span></div>
      <div class="totals-row"><span class="totals-label">+ 10% VoP</span><span class="totals-value">${fmt(vop)}</span></div>
      <div class="totals-row"><span class="totals-label">Grand Total (+ 10% Contingency)</span><span class="totals-value">${fmt(grand)}</span></div>
    </div>`,
  })
}

// ── Leave Application Form ────────────────────────────────────────────────────
export function printLeaveApplication(leave, user) {
  const leaveTypes = {
    annual:        'Annual Leave',
    sick:          'Sick Leave',
    maternity:     'Maternity Leave',
    paternity:     'Paternity Leave',
    compassionate: 'Compassionate',
    study:         'Study Leave',
    unpaid:        'Unpaid Leave',
    emergency:     'Emergency Leave',
  }
  const typeName = leave.leave_type_name || leaveTypes[leave.leave_type] || leave.leave_type || ''

  const checkboxes = [
    'Annual Leave','Maternity Leave','Compassionate Leave','Study Leave',
    'Sick Leave','Paternity Leave','Other','Unpaid Leave',
  ].map(t => `
    <span style="display:inline-flex;align-items:center;gap:4px;margin-right:16px;margin-bottom:6px;">
      <span style="display:inline-block;width:14px;height:14px;border:1px solid #334155;text-align:center;line-height:13px;font-size:11px;">
        ${t === typeName || t.replace(' Leave','') === typeName ? '✓' : ''}
      </span> ${t}
    </span>`).join('')

  printDoc({
    title: 'Leave Application Form',
    html: `
    <div style="border:2px solid #1e293b;padding:0;">
      <div style="background:#1e293b;color:#fff;padding:8px 16px;font-size:13px;font-weight:700;text-align:center;letter-spacing:1px;">
        LEAVE APPLICATION FORM &nbsp;—&nbsp; TO BE FILLED BY APPLICANT (A)
      </div>

      <div style="padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px;border-bottom:1px solid #cbd5e1;">
        <div><label style="font-size:10px;color:#64748b;">Name:</label>
          <div style="border-bottom:1px solid #334155;padding:4px 0;font-weight:600;">${user?.full_name || user?.first_name + ' ' + (user?.last_name || '') || '_______________'}</div>
        </div>
        <div><label style="font-size:10px;color:#64748b;">Designation:</label>
          <div style="border-bottom:1px solid #334155;padding:4px 0;">${user?.role_display || '_______________'}</div>
        </div>
        <div><label style="font-size:10px;color:#64748b;">Department:</label>
          <div style="border-bottom:1px solid #334155;padding:4px 0;">${user?.department || '_______________'}</div>
        </div>
        <div><label style="font-size:10px;color:#64748b;">Date:</label>
          <div style="border-bottom:1px solid #334155;padding:4px 0;">${new Date().toLocaleDateString('en-KE')}</div>
        </div>
      </div>

      <div style="padding:12px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-size:10px;font-weight:700;color:#1e293b;margin-bottom:8px;">Leave Applied For (Please Mark ✓):</div>
        <div style="flex-wrap:wrap;">${checkboxes}</div>
      </div>

      <div style="padding:12px 16px;border-bottom:1px solid #cbd5e1;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;">
        <div><label style="font-size:10px;color:#64748b;">From (Date):</label>
          <div style="border-bottom:1px solid #334155;padding:4px 0;font-weight:600;">${leave.start_date || '___________'}</div>
        </div>
        <div><label style="font-size:10px;color:#64748b;">To (Date):</label>
          <div style="border-bottom:1px solid #334155;padding:4px 0;font-weight:600;">${leave.end_date || '___________'}</div>
        </div>
        <div><label style="font-size:10px;color:#64748b;">No. of Days:</label>
          <div style="border-bottom:1px solid #334155;padding:4px 0;font-weight:600;">${leave.days_requested || '___'}</div>
        </div>
        <div><label style="font-size:10px;color:#64748b;">Time From:</label>
          <div style="border-bottom:1px solid #334155;padding:4px 0;">___________</div>
        </div>
      </div>

      <div style="padding:12px 16px;border-bottom:1px solid #cbd5e1;">
        <label style="font-size:10px;color:#64748b;">For Show &amp; Half Day Leaves — Short Day Leave / Half Day Leave:</label>
        <div style="display:flex;gap:24px;margin-top:6px;">
          <span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:14px;height:14px;border:1px solid #334155;display:inline-block;"></span> Short Day Leave</span>
          <span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:14px;height:14px;border:1px solid #334155;display:inline-block;"></span> Half Day Leave</span>
        </div>
      </div>

      <div style="padding:12px 16px;border-bottom:1px solid #cbd5e1;">
        <label style="font-size:10px;color:#64748b;">Remarks (if any):</label>
        <div style="border:1px solid #cbd5e1;min-height:48px;padding:6px;margin-top:4px;">${leave.reason || ''}</div>
      </div>

      <div style="padding:12px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-size:11px;font-weight:700;margin-bottom:8px;">LEAVE COVERAGE (B)</div>
        <p style="font-size:10px;margin-bottom:8px;">The following key duties will be performed by the covering staff during the leave period:</p>
        ${[1,2,3,4,5].map(n => `<div style="display:flex;gap:8px;margin-bottom:6px;"><span>${n}.</span><div style="flex:1;border-bottom:1px solid #cbd5e1;">&nbsp;</div></div>`).join('')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px;">
          <div><label style="font-size:10px;color:#64748b;">Employee Signature:</label><div style="border-bottom:1px solid #334155;height:32px;"></div></div>
          <div><label style="font-size:10px;color:#64748b;">Date:</label><div style="border-bottom:1px solid #334155;height:32px;"></div></div>
        </div>
      </div>

      <div style="padding:12px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-size:11px;font-weight:700;margin-bottom:8px;">ACKNOWLEDGMENT &amp; ACCEPTANCE (C)</div>
        <p style="font-size:10px;margin-bottom:8px;">I, the above-listed duties during the period of leave. I understand my responsibilities and commit to fulfilling them to the best of my abilities.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div><label style="font-size:10px;color:#64748b;">Signature:</label><div style="border-bottom:1px solid #334155;height:32px;"></div></div>
          <div><label style="font-size:10px;color:#64748b;">ID No:</label><div style="border-bottom:1px solid #334155;height:32px;"></div></div>
        </div>
      </div>

      <div style="padding:12px 16px;background:#f8fafc;">
        <div style="font-size:11px;font-weight:700;margin-bottom:10px;background:#1e293b;color:#fff;padding:6px 10px;">OFFICE USE ONLY (D)</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#e2e8f0;">
            <th style="padding:6px 8px;text-align:left;font-size:10px;border:1px solid #cbd5e1;">#</th>
            <th style="padding:6px 8px;text-align:left;font-size:10px;border:1px solid #cbd5e1;">Item</th>
            <th style="padding:6px 8px;text-align:left;font-size:10px;border:1px solid #cbd5e1;">Days/Details</th>
            <th style="padding:6px 8px;text-align:left;font-size:10px;border:1px solid #cbd5e1;">Date</th>
          </tr></thead>
          <tbody>
            ${['Leave Balance Brought Forward (Previous Year)','Current Year\'s Leave Entitlement','Leave Applied for (This Application)','Leave Already Taken to Date','Leave Days Outstanding (After this Leave)','Supporting Documents Attached (If Applicable, Yes/NO)'].map((item,i) => `
            <tr>
              <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:10px;">${i+1}</td>
              <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:10px;">${item}</td>
              <td style="padding:6px 8px;border:1px solid #cbd5e1;">&nbsp;</td>
              <td style="padding:6px 8px;border:1px solid #cbd5e1;">&nbsp;</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:16px;">
          <div>
            <div style="font-size:10px;font-weight:700;margin-bottom:4px;">HOD/Supervisor, Name/Signature</div>
            <div style="border-bottom:1px solid #334155;height:40px;"></div>
          </div>
          <div>
            <div style="font-size:10px;font-weight:700;margin-bottom:4px;">HR Department, Name/Signature</div>
            <div style="border-bottom:1px solid #334155;height:40px;"></div>
          </div>
        </div>
        <div style="margin-top:12px;">
          <div style="font-size:10px;font-weight:700;margin-bottom:4px;">Approvals:</div>
          <div style="border-bottom:1px solid #334155;height:32px;"></div>
        </div>
      </div>
    </div>`,
  })
}

// ── Surveyor Daily Report ─────────────────────────────────────────────────────
export function printSurveyorDaily(report) {
  const rows = (report.activities || []).map(a => `<tr>
    <td style="border:1px solid #cbd5e1;padding:5px;">${a.location || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${a.activity || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${a.output || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${a.remarks || ''}</td>
  </tr>`).join('') || Array(8).fill(`<tr>${['','','',''].map(() => '<td style="border:1px solid #cbd5e1;padding:14px;"></td>').join('')}</tr>`).join('')

  const cpRows = (report.control_points || []).map(c => `<tr>
    <td style="border:1px solid #cbd5e1;padding:5px;">${c.point_id || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${c.easting || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${c.northing || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${c.level || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${c.status || ''}</td>
  </tr>`).join('') || Array(4).fill(`<tr>${['','','','',''].map(() => '<td style="border:1px solid #cbd5e1;padding:14px;"></td>').join('')}</tr>`).join('')

  printDoc({
    title: 'Surveyor Daily Report',
    html: `
    <div style="border:2px solid #1e293b;">
      <div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;border-bottom:1px solid #cbd5e1;">
        ${[['Project name:', report.project_name],['Contract No./Location:', report.contract_no],['Location/Section:', report.location]].map(([l,v])=>`
        <div><label style="font-size:10px;color:#64748b;">${l}</label><div style="border-bottom:1px solid #334155;padding:3px 0;font-weight:600;">${v||'_________________'}</div></div>`).join('')}
      </div>
      <div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;border-bottom:1px solid #cbd5e1;">
        ${[['Date:',report.date],['Day:',report.day],['Weather:',report.weather],['Surveyor:',report.surveyor]].map(([l,v])=>`
        <div><label style="font-size:10px;color:#64748b;">${l}</label><div style="border-bottom:1px solid #334155;padding:3px 0;">${v||''}</div></div>`).join('')}
        ${[['Assistant:',report.assistant],['Total Station:',report.total_station],['Battery/Calibration:',report.battery],['Staff/Prism:',report.staff_prism]].map(([l,v])=>`
        <div><label style="font-size:10px;color:#64748b;">${l}</label><div style="border-bottom:1px solid #334155;padding:3px 0;">${v||''}</div></div>`).join('')}
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">A. Team attendance and equipment</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          ${[['Vehicle/Access:',''],['RTK/GPS:','']].map(([l,v])=>`<div><label style="font-size:10px;color:#64748b;">${l}</label><div style="border-bottom:1px solid #334155;padding:3px 0;">${v}</div></div>`).join('')}
        </div>
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">B. Survey activities completed</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f1f5f9;">
            <th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;text-align:left;">No.</th>
            <th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;text-align:left;">Location/Chainage</th>
            <th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;text-align:left;">Activity</th>
            <th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;text-align:left;">Output/Reference</th>
            <th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;text-align:left;">Remarks</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">C. Control points / levels checked</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f1f5f9;">
            ${['Point ID','Easting','Northing','Level','Status / Observation'].map(h=>`<th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;text-align:left;">${h}</th>`).join('')}
          </tr></thead>
          <tbody>${cpRows}</tbody>
        </table>
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:6px;background:#e2e8f0;padding:4px 8px;">D. Issues, instructions and next plan</div>
        ${['Issues encountered','Instructions received / issued','Planned activities for next day'].map(label=>`
        <div style="margin-bottom:8px;"><label style="font-size:10px;font-weight:600;">${label}:</label>
        <div style="border:1px solid #cbd5e1;min-height:36px;padding:4px;margin-top:3px;">${report[label.toLowerCase().replace(/ /g,'_')] || ''}</div></div>`).join('')}
      </div>

      <div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr;gap:32px;">
        <div><div style="font-size:10px;font-weight:700;">Prepared by (Surveyor)</div><div style="border-bottom:1px solid #334155;height:40px;margin-top:4px;"></div></div>
        <div><div style="font-size:10px;font-weight:700;">Checked by (Site Agent/Engineer)</div><div style="border-bottom:1px solid #334155;height:40px;margin-top:4px;"></div></div>
      </div>
    </div>`,
  })
}

// ── Surveyor Weekly Report ────────────────────────────────────────────────────
export function printSurveyorWeekly(report) {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  const actRows = days.map(day => `<tr>
    <td style="border:1px solid #cbd5e1;padding:5px;font-weight:600;">${day}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${report.activities?.[day]?.location || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${report.activities?.[day]?.output || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${report.activities?.[day]?.remarks || ''}</td>
  </tr>`).join('')

  const benchRows = (report.benchmarks || []).map(b => `<tr>
    <td style="border:1px solid #cbd5e1;padding:5px;">${b.item || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${b.status_this_week || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${b.action_required || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${b.remarks || ''}</td>
  </tr>`).join('') || Array(4).fill(`<tr>${Array(4).fill('<td style="border:1px solid #cbd5e1;padding:14px;"></td>').join('')}</tr>`).join('')

  printDoc({
    title: 'Surveyor Weekly Report',
    html: `
    <div style="border:2px solid #1e293b;">
      <div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;border-bottom:1px solid #cbd5e1;">
        ${[['Project name:',report.project_name],['Contract No./Location:',report.contract_no],['Week No.:',report.week_no]].map(([l,v])=>`
        <div><label style="font-size:10px;color:#64748b;">${l}</label><div style="border-bottom:1px solid #334155;padding:3px 0;font-weight:600;">${v||''}</div></div>`).join('')}
        ${[['Period:',report.period],['From:',report.from_date],['To:',report.to_date]].map(([l,v])=>`
        <div><label style="font-size:10px;color:#64748b;">${l}</label><div style="border-bottom:1px solid #334155;padding:3px 0;">${v||''}</div></div>`).join('')}
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">A. Weekly summary of survey activities</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f1f5f9;">
            ${['Day','Location/Chainage','Output','Remarks'].map(h=>`<th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;text-align:left;">${h}</th>`).join('')}
          </tr></thead>
          <tbody>${actRows}</tbody>
        </table>
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">B. Benchmark / control summary and support to teams</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f1f5f9;">
            ${['Item','Status this week','Action required','Remarks'].map(h=>`<th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;text-align:left;">${h}</th>`).join('')}
          </tr></thead>
          <tbody>${benchRows}</tbody>
        </table>
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">C. Equipment status, constraints and next week plan</div>
        ${['Equipment condition / calibration','Challenges / constraints','Planned activities for next week'].map(label=>`
        <div style="margin-bottom:8px;"><label style="font-size:10px;font-weight:600;">${label}:</label>
        <div style="border:1px solid #cbd5e1;min-height:40px;padding:4px;margin-top:3px;"></div></div>`).join('')}
      </div>

      <div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr;gap:32px;">
        <div><div style="font-size:10px;font-weight:700;">Prepared by (Surveyor)</div><div style="border-bottom:1px solid #334155;height:40px;margin-top:4px;"></div></div>
        <div><div style="font-size:10px;font-weight:700;">Reviewed by (Site Agent/Engineer)</div><div style="border-bottom:1px solid #334155;height:40px;margin-top:4px;"></div></div>
      </div>
    </div>`,
  })
}

// ── Foreman Weekly Report ─────────────────────────────────────────────────────
export function printForemanWeekly(report) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const categories = ['Skilled labour','Semi-skilled','Unskilled','Operators','Supervisors']

  const labourRows = categories.map(cat => `<tr>
    <td style="border:1px solid #cbd5e1;padding:5px;font-weight:600;">${cat}</td>
    ${days.map(d => `<td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${report.labour?.[cat]?.[d] || ''}</td>`).join('')}
    <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-weight:700;">${report.labour?.[cat]?.total || ''}</td>
  </tr>`).join('')

  const worksRows = (report.works || []).map(w => `<tr>
    <td style="border:1px solid #cbd5e1;padding:5px;">${w.no || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${w.location || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${w.description || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${w.unit || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;text-align:right;">${w.weekly_target || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;text-align:right;">${w.weekly_achieved || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${w.remarks || ''}</td>
  </tr>`).join('') || Array(6).fill(`<tr>${Array(7).fill('<td style="border:1px solid #cbd5e1;padding:14px;"></td>').join('')}</tr>`).join('')

  printDoc({
    title: 'Foreman Weekly Report',
    html: `
    <div style="border:2px solid #1e293b;">
      <div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;border-bottom:1px solid #cbd5e1;">
        ${[['Project name:',report.project_name],['Contract No./Location:',report.contract_no],['Week No.:',report.week_no],['Period:',report.period],['From:',report.from_date],['To:',report.to_date]].map(([l,v])=>`
        <div><label style="font-size:10px;color:#64748b;">${l}</label><div style="border-bottom:1px solid #334155;padding:3px 0;">${v||''}</div></div>`).join('')}
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">A. Weekly labour summary</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f1f5f9;">
            <th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;text-align:left;">Category</th>
            ${days.map(d=>`<th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;text-align:center;">${d}</th>`).join('')}
            <th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;text-align:center;">Total</th>
          </tr></thead>
          <tbody>${labourRows}</tbody>
        </table>
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">B. Works executed during the week</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f1f5f9;">
            ${['No.','Location/Section','Description','Unit','Weekly Target','Weekly Achieved','Remarks'].map(h=>`<th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;text-align:left;">${h}</th>`).join('')}
          </tr></thead>
          <tbody>${worksRows}</tbody>
        </table>
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">C. Materials, issues and next week plan</div>
        ${['Materials received/used','Major issues / constraints','Safety / quality / environment summary','Planned activities for next week'].map(label=>`
        <div style="margin-bottom:8px;"><label style="font-size:10px;font-weight:600;">${label}:</label>
        <div style="border:1px solid #cbd5e1;min-height:36px;padding:4px;margin-top:3px;"></div></div>`).join('')}
      </div>

      <div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr;gap:32px;">
        <div><div style="font-size:10px;font-weight:700;">Prepared by (Foreman)</div><div style="border-bottom:1px solid #334155;height:40px;margin-top:4px;"></div></div>
        <div><div style="font-size:10px;font-weight:700;">Reviewed by (Site Agent/Engineer)</div><div style="border-bottom:1px solid #334155;height:40px;margin-top:4px;"></div></div>
      </div>
    </div>`,
  })
}

// ── Machine Weekly Report ─────────────────────────────────────────────────────
export function printMachineWeekly(report) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat']
  const hoursRows = ['Hours Idle','Hours Worked','Hrs Breakdown','Hrs Standby'].map(cat => `<tr>
    <td style="border:1px solid #cbd5e1;padding:5px;font-weight:600;">${cat}</td>
    ${days.map(d=>`<td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${report.hours?.[cat]?.[d] || ''}</td>`).join('')}
    <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-weight:700;">${report.hours?.[cat]?.total || ''}</td>
  </tr>`).join('')

  const worksRows = (report.works || []).map(w => `<tr>
    <td style="border:1px solid #cbd5e1;padding:5px;">${w.no||''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${w.location||''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${w.description||''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${w.unit||''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;text-align:right;">${w.weekly_target||''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;text-align:right;">${w.weekly_achieved||''}</td>
  </tr>`).join('') || Array(5).fill(`<tr>${Array(6).fill('<td style="border:1px solid #cbd5e1;padding:14px;"></td>').join('')}</tr>`).join('')

  const maintItems = ['Engine oil change','Filter replacement','Greasing/lubrication','Tyre/track inspection','Hydraulic check','General servicing']
  const maintRows = maintItems.map(item => `<tr>
    <td style="border:1px solid #cbd5e1;padding:5px;">${item}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${report.maintenance?.[item]?.scheduled || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${report.maintenance?.[item]?.completed || ''}</td>
    <td style="border:1px solid #cbd5e1;padding:5px;">${report.maintenance?.[item]?.remarks || ''}</td>
  </tr>`).join('')

  printDoc({
    title: 'Machine Weekly Report',
    html: `
    <div style="border:2px solid #1e293b;">
      <div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;border-bottom:1px solid #cbd5e1;">
        ${[['Project name:',report.project_name],['Contract No./Location:',report.contract_no],['Week No.:',report.week_no],
           ['Period:',report.period],['From:',report.from_date],['To:',report.to_date],
           ['Machine type:',report.machine_type],['Machine name:',report.machine_name],['Machine ID/Reg. No.:',report.machine_id],
           ['Primary Operator:',report.operator]].map(([l,v])=>`
        <div><label style="font-size:10px;color:#64748b;">${l}</label><div style="border-bottom:1px solid #334155;padding:3px 0;">${v||''}</div></div>`).join('')}
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">A. Machine / Equipment Identification</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          ${[['Category:',report.category],['Hours Idle:',report.total_idle],['Hours Worked:',report.total_worked]].map(([l,v])=>`
          <div><label style="font-size:10px;color:#64748b;">${l}</label><div style="border-bottom:1px solid #334155;padding:3px 0;">${v||''}</div></div>`).join('')}
        </div>
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">B. Weekly Hours Summary</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f1f5f9;">
            <th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;">Category</th>
            ${days.map(d=>`<th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;text-align:center;">${d}</th>`).join('')}
            <th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;text-align:center;">Total</th>
          </tr></thead>
          <tbody>${hoursRows}</tbody>
        </table>
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">C. Weekly Fuels &amp; Fluids Summary</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
          ${[['Opening Meter (Mgo):',report.opening_meter],['Closing Meter (Sat):',report.closing_meter],['Total Fuel Added (Ltrs):',report.total_fuel],['Total Grease Added:',report.total_grease]].map(([l,v])=>`
          <div><label style="font-size:10px;color:#64748b;">${l}</label><div style="border-bottom:1px solid #334155;padding:3px 0;">${v||''}</div></div>`).join('')}
        </div>
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">D. Works Executed During the Week</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f1f5f9;">
            ${['No.','Location/Section','Description','Unit','Weekly Target','Weekly Achieved'].map(h=>`<th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;">${h}</th>`).join('')}
          </tr></thead>
          <tbody>${worksRows}</tbody>
        </table>
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">E. Weekly Maintenance Summary</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f1f5f9;">
            ${['Maintenance Item','Scheduled?','Completed?','Remarks'].map(h=>`<th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;">${h}</th>`).join('')}
          </tr></thead>
          <tbody>${maintRows}</tbody>
        </table>
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">F. Breakdowns / Downtime</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f1f5f9;">
            ${['Day','Breakdown Desc.','Hrs Lost','Action Taken'].map(h=>`<th style="border:1px solid #cbd5e1;padding:5px;font-size:10px;">${h}</th>`).join('')}
          </tr></thead>
          <tbody>${Array(3).fill(`<tr>${Array(4).fill('<td style="border:1px solid #cbd5e1;padding:14px;"></td>').join('')}</tr>`).join('')}</tbody>
        </table>
      </div>

      <div style="padding:10px 16px;border-bottom:1px solid #cbd5e1;">
        <div style="font-weight:700;font-size:11px;margin-bottom:8px;background:#e2e8f0;padding:4px 8px;">G. Materials, Issues and Next Week Plan</div>
        ${['Materials/consumables received or used','Major issues / constraints','Safety / quality / environment','Planned activities for next week'].map(label=>`
        <div style="margin-bottom:8px;"><label style="font-size:10px;font-weight:600;">${label}:</label>
        <div style="border:1px solid #cbd5e1;min-height:36px;padding:4px;margin-top:3px;"></div></div>`).join('')}
      </div>

      <div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr;gap:32px;">
        <div><div style="font-size:10px;font-weight:700;">Prepared by (Operator/Driver)</div><div style="border-bottom:1px solid #334155;height:40px;margin-top:4px;"></div></div>
        <div><div style="font-size:10px;font-weight:700;">Reviewed by (Site Agent/Engineer)</div><div style="border-bottom:1px solid #334155;height:40px;margin-top:4px;"></div></div>
      </div>
    </div>`,
  })
}
