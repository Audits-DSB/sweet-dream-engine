export function printInvoice(data: {
  title: string;
  subtitle?: string;
  companyName?: string;
  clientName: string;
  invoiceNumber: string;
  date: string;
  columns: string[];
  rows: (string | number)[][];
  totals?: { label: string; value: string }[];
  footer?: string;
  terms?: string[];
}) {
  const logoUrl = window.location.origin + '/images/dsb-logo.png';
  const company = data.companyName || 'Dental Smart Box';
  
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>${data.title} - ${company}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 32px 40px; color: #1a1a1a; direction: rtl; background: #fff; }
    
    .top-bar { height: 4px; background: linear-gradient(90deg, #1a6b8a, #2a9bc0, #1a6b8a); margin: -32px -40px 24px -40px; }
    
    .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #e8e8e8; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand img { width: 64px; height: 64px; object-fit: contain; }
    .brand-text .company { font-size: 22px; font-weight: 700; color: #1a6b8a; letter-spacing: -0.3px; }
    .brand-text .abbr { font-size: 11px; font-weight: 600; color: #999; letter-spacing: 2px; text-transform: uppercase; }
    .brand-text .contact { font-size: 10px; color: #888; margin-top: 4px; line-height: 1.6; }
    
    .invoice-info { text-align: left; background: #f8fafb; border: 1px solid #e8eef1; border-radius: 8px; padding: 14px 18px; min-width: 220px; }
    .invoice-info .doc-type { font-size: 16px; font-weight: 700; color: #1a6b8a; margin-bottom: 8px; }
    .invoice-info .row { display: flex; justify-content: space-between; font-size: 12px; line-height: 2; }
    .invoice-info .row .label { color: #888; }
    .invoice-info .row .val { font-weight: 600; color: #333; }
    
    table { width: 100%; border-collapse: collapse; margin: 24px 0 16px; font-size: 12px; }
    thead { background: #1a6b8a; color: #fff; }
    th { padding: 10px 14px; text-align: start; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    th:first-child { border-radius: 0 6px 0 0; }
    th:last-child { border-radius: 6px 0 0 0; }
    td { padding: 9px 14px; border-bottom: 1px solid #f0f0f0; }
    tbody tr:hover { background: #f8fafb; }
    tbody tr:nth-child(even) { background: #fafbfc; }
    
    .totals-section { display: flex; justify-content: flex-start; margin-top: 16px; }
    .totals-box { background: #f8fafb; border: 1px solid #e8eef1; border-radius: 8px; padding: 14px 20px; min-width: 260px; }
    .total-row { display: flex; justify-content: space-between; font-size: 13px; line-height: 2.2; }
    .total-row .label { color: #666; }
    .total-row .val { font-weight: 600; }
    .total-row.final { font-weight: 700; font-size: 15px; color: #1a6b8a; border-top: 2px solid #1a6b8a; padding-top: 6px; margin-top: 4px; }
    
    .terms { margin-top: 32px; padding: 14px 18px; background: #fefefe; border: 1px solid #eee; border-radius: 6px; }
    .terms h4 { font-size: 11px; font-weight: 700; color: #1a6b8a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .terms ul { list-style: none; font-size: 10px; color: #777; line-height: 2; }
    .terms ul li::before { content: "•"; color: #1a6b8a; margin-left: 6px; font-weight: bold; }
    
    .footer-bar { margin-top: 40px; text-align: center; padding-top: 16px; border-top: 2px solid #e8e8e8; }
    .footer-bar .thanks { font-size: 13px; font-weight: 600; color: #1a6b8a; margin-bottom: 4px; }
    .footer-bar .sub { font-size: 10px; color: #aaa; }
    
    @media print { 
      body { padding: 16px 24px; } 
      .top-bar { margin: -16px -24px 16px -24px; }
    }
  </style>
</head>
<body>
  <div class="top-bar"></div>
  
  <div class="header">
    <div class="brand">
      <img src="${logoUrl}" alt="DSB Logo" />
      <div class="brand-text">
        <div class="company">${company}</div>
        <div class="abbr">DSB</div>
        <div class="contact">
          إدارة مستلزمات طب الأسنان<br/>
          info@dentalsmartbox.com
        </div>
      </div>
    </div>
    <div class="invoice-info">
      <div class="doc-type">${data.title}</div>
      <div class="row"><span class="label">رقم المستند:</span><span class="val">${data.invoiceNumber}</span></div>
      <div class="row"><span class="label">العميل:</span><span class="val">${data.clientName}</span></div>
      <div class="row"><span class="label">التاريخ:</span><span class="val">${data.date}</span></div>
      ${data.subtitle ? `<div class="row"><span class="label">ملاحظة:</span><span class="val">${data.subtitle}</span></div>` : ''}
    </div>
  </div>

  <table>
    <thead><tr>${data.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${data.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>

  ${data.totals ? `
  <div class="totals-section">
    <div class="totals-box">
      ${data.totals.map((t, i) => `<div class="total-row ${i === data.totals!.length - 1 ? 'final' : ''}"><span class="label">${t.label}</span><span class="val">${t.value}</span></div>`).join('')}
    </div>
  </div>` : ''}

  ${data.terms && data.terms.length > 0 ? `
  <div class="terms">
    <h4>الشروط والأحكام</h4>
    <ul>${data.terms.map(t => `<li>${t}</li>`).join('')}</ul>
  </div>` : `
  <div class="terms">
    <h4>الشروط والأحكام</h4>
    <ul>
      <li>جميع الأسعار بالجنيه المصري وشاملة الضريبة ما لم يُذكر خلاف ذلك</li>
      <li>يرجى مراجعة الكميات خلال 48 ساعة من استلام الفاتورة</li>
      <li>المواد المستلمة لا تُرد إلا في حالة وجود عيب مصنعي</li>
      <li>السداد مطلوب خلال 30 يوماً من تاريخ الفاتورة</li>
    </ul>
  </div>`}

  <div class="footer-bar">
    <div class="thanks">شكراً لتعاملكم مع Dental Smart Box</div>
    <div class="sub">${data.footer || 'هذا المستند صادر إلكترونياً ولا يحتاج إلى توقيع'}</div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}
