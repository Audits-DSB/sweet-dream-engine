export function printInvoice(data: {
  title: string;
  subtitle?: string;
  companyName: string;
  clientName: string;
  invoiceNumber: string;
  date: string;
  columns: string[];
  rows: (string | number)[][];
  totals?: { label: string; value: string }[];
  footer?: string;
}) {
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>${data.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; color: #1a1a1a; direction: rtl; }
    .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 32px; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
    .company { font-size: 24px; font-weight: 700; }
    .subtitle { font-size: 12px; color: #666; margin-top: 4px; }
    .meta { text-align: left; font-size: 13px; line-height: 1.8; }
    .meta strong { display: inline-block; min-width: 80px; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px; }
    th { background: #f5f5f5; padding: 10px 12px; text-align: start; font-weight: 600; border-bottom: 2px solid #ddd; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    .text-end { text-align: left; }
    .totals { margin-top: 16px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
    .total-row { display: flex; gap: 24px; font-size: 14px; }
    .total-row.final { font-weight: 700; font-size: 16px; border-top: 2px solid #1a1a1a; padding-top: 8px; }
    .footer { margin-top: 48px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 16px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">${data.companyName}</div>
      ${data.subtitle ? `<div class="subtitle">${data.subtitle}</div>` : ''}
    </div>
    <div class="meta">
      <div><strong>${data.title}</strong></div>
      <div><strong>رقم:</strong> ${data.invoiceNumber}</div>
      <div><strong>العميل:</strong> ${data.clientName}</div>
      <div><strong>التاريخ:</strong> ${data.date}</div>
    </div>
  </div>
  <table>
    <thead><tr>${data.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${data.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
  ${data.totals ? `<div class="totals">${data.totals.map((t, i) => `<div class="total-row ${i === data.totals!.length - 1 ? 'final' : ''}"><span>${t.label}</span><span>${t.value}</span></div>`).join('')}</div>` : ''}
  ${data.footer ? `<div class="footer">${data.footer}</div>` : ''}
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}
