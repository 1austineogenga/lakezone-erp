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
