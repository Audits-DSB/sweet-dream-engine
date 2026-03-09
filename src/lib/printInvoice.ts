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
  const company = data.companyName || 'DSB';
  
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>${data.title} - ${company}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page { size: A4; margin: 8mm; }

    body { 
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; 
      color: #1a1a2e; 
      direction: rtl; 
      background: #fff;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
    }

    .page {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px 36px;
    }

    .accent-bar {
      height: 4px;
      background: linear-gradient(90deg, #0f4c75 0%, #1b9aaa 50%, #0f4c75 100%);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 18px 0 14px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand img {
      width: 56px;
      height: 56px;
      object-fit: contain;
      border-radius: 10px;
    }

    .brand-info .company-name {
      font-size: 22px;
      font-weight: 800;
      color: #0f4c75;
      letter-spacing: -0.5px;
      line-height: 1.2;
    }

    .brand-info .tagline {
      font-size: 9px;
      font-weight: 600;
      color: #1b9aaa;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 1px;
    }

    .brand-info .contact-line {
      font-size: 9px;
      color: #8899a6;
      margin-top: 3px;
      line-height: 1.6;
    }

    .meta-card {
      background: linear-gradient(135deg, #f8fbfd 0%, #eef5f9 100%);
      border: 1px solid #d4e4ed;
      border-radius: 10px;
      padding: 14px 18px;
      min-width: 220px;
    }

    .meta-card .doc-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f4c75;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 2px solid #0f4c75;
    }

    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      padding: 2px 0;
    }

    .meta-row .meta-label { color: #8899a6; font-weight: 500; }
    .meta-row .meta-value { font-weight: 700; color: #1a1a2e; }

    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, #d4e4ed 20%, #d4e4ed 80%, transparent 100%);
      margin: 4px 0 14px;
    }

    .client-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f8fbfd;
      border-radius: 6px;
      padding: 8px 14px;
      margin-bottom: 14px;
      border-right: 3px solid #1b9aaa;
    }

    .client-bar .client-label { font-size: 10px; color: #8899a6; font-weight: 600; }
    .client-bar .client-name { font-size: 13px; font-weight: 700; color: #0f4c75; }

    .items-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 0 0 14px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e2ecf1;
    }

    .items-table thead {
      background: linear-gradient(135deg, #0f4c75 0%, #1b6d8a 100%);
    }

    .items-table th {
      padding: 8px 12px;
      text-align: start;
      font-weight: 700;
      font-size: 10px;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    .items-table td {
      padding: 7px 12px;
      border-bottom: 1px solid #f0f4f7;
      font-size: 11px;
      color: #2c3e50;
    }

    .items-table tbody tr:last-child td { border-bottom: none; }
    .items-table tbody tr:nth-child(even) { background: #fafcfd; }

    .items-table th:nth-last-child(-n+2),
    .items-table td:nth-last-child(-n+2) {
      text-align: left;
      font-variant-numeric: tabular-nums;
    }

    .row-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      background: #e8f0f5;
      border-radius: 5px;
      font-size: 9px;
      font-weight: 700;
      color: #0f4c75;
    }

    .totals-wrapper {
      display: flex;
      justify-content: flex-start;
      margin-bottom: 16px;
    }

    .totals-box {
      background: linear-gradient(135deg, #f8fbfd 0%, #eef5f9 100%);
      border: 1px solid #d4e4ed;
      border-radius: 10px;
      padding: 12px 18px;
      min-width: 280px;
    }

    .total-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      font-size: 12px;
    }

    .total-line .t-label { color: #5a6c7d; font-weight: 500; }
    .total-line .t-value { font-weight: 700; color: #1a1a2e; font-variant-numeric: tabular-nums; }

    .total-line.grand {
      margin-top: 6px;
      padding-top: 8px;
      border-top: 2px solid #0f4c75;
      font-size: 14px;
    }

    .total-line.grand .t-label { color: #0f4c75; font-weight: 800; }
    .total-line.grand .t-value { color: #0f4c75; font-weight: 800; font-size: 15px; }

    .terms-section {
      background: #fafcfd;
      border: 1px solid #e8eef2;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }

    .terms-section h4 {
      font-size: 11px;
      font-weight: 800;
      color: #0f4c75;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .terms-section h4::before { content: "📋"; font-size: 12px; }

    .terms-section ul {
      list-style: none;
      font-size: 9.5px;
      color: #5a6c7d;
      line-height: 2;
    }

    .terms-section ul li {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .terms-section ul li::before {
      content: "";
      width: 4px;
      height: 4px;
      background: #1b9aaa;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .signatures {
      display: flex;
      justify-content: space-between;
      margin-bottom: 18px;
      gap: 32px;
    }

    .sig-block { flex: 1; text-align: center; }
    .sig-block .sig-label { font-size: 10px; color: #8899a6; font-weight: 600; margin-bottom: 30px; }
    .sig-block .sig-line { border-top: 1px dashed #c0cdd6; padding-top: 6px; font-size: 9px; color: #8899a6; }

    .footer {
      text-align: center;
      padding-top: 12px;
      border-top: 2px solid #e8eef2;
    }

    .footer .thank-you { font-size: 13px; font-weight: 800; color: #0f4c75; margin-bottom: 2px; }
    .footer .sub-note { font-size: 9px; color: #aab7c4; line-height: 1.6; }

    @media print { 
      body { padding: 0; }
      .page { padding: 16px 28px; max-width: none; }
      .accent-bar, .items-table thead, .meta-card, .client-bar, .totals-box, .terms-section { 
        print-color-adjust: exact; -webkit-print-color-adjust: exact; 
      }
    }
  </style>
</head>
<body>
  <div class="accent-bar"></div>
  <div class="page">

    <div class="header">
      <div class="brand">
        <img src="${logoUrl}" alt="Logo" />
        <div class="brand-info">
          <div class="company-name">${company}</div>
          <div class="tagline">Dental Smart Box</div>
          <div class="contact-line">
            إدارة مستلزمات طب الأسنان<br/>
            info@dentalsmartbox.com · +20 100 000 0000
          </div>
        </div>
      </div>
      <div class="meta-card">
        <div class="doc-title">${data.title}</div>
        <div class="meta-row"><span class="meta-label">رقم المستند</span><span class="meta-value">${data.invoiceNumber}</span></div>
        <div class="meta-row"><span class="meta-label">التاريخ</span><span class="meta-value">${data.date}</span></div>
        ${data.subtitle ? `<div class="meta-row"><span class="meta-label">ملاحظة</span><span class="meta-value">${data.subtitle}</span></div>` : ''}
      </div>
    </div>

    <div class="divider"></div>

    <div class="client-bar">
      <span class="client-label">العميل:</span>
      <span class="client-name">${data.clientName}</span>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 36px">#</th>
          ${data.columns.map(c => `<th>${c}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${data.rows.map((row, i) => `
          <tr>
            <td><span class="row-num">${i + 1}</span></td>
            ${row.map(cell => `<td>${cell}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>

    ${data.totals ? `
    <div class="totals-wrapper">
      <div class="totals-box">
        ${data.totals.map((t, i) => `
          <div class="total-line ${i === data.totals!.length - 1 ? 'grand' : ''}">
            <span class="t-label">${t.label}</span>
            <span class="t-value">${t.value}</span>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    ${data.terms && data.terms.length > 0 ? `
    <div class="terms-section">
      <h4>الشروط والأحكام</h4>
      <ul>${data.terms.map(t => `<li>${t}</li>`).join('')}</ul>
    </div>` : `
    <div class="terms-section">
      <h4>الشروط والأحكام</h4>
      <ul>
        <li>جميع الأسعار بالجنيه المصري وشاملة الضريبة ما لم يُذكر خلاف ذلك</li>
        <li>يرجى مراجعة الكميات خلال 48 ساعة من استلام الفاتورة</li>
        <li>المواد المستلمة لا تُرد إلا في حالة وجود عيب مصنعي</li>
        <li>السداد مطلوب خلال 30 يوماً من تاريخ الفاتورة</li>
      </ul>
    </div>`}

    <div class="signatures">
      <div class="sig-block">
        <div class="sig-label">توقيع المسؤول</div>
        <div class="sig-line">الاسم / التاريخ</div>
      </div>
      <div class="sig-block">
        <div class="sig-label">توقيع العميل</div>
        <div class="sig-line">الاسم / التاريخ</div>
      </div>
    </div>

    <div class="footer">
      <div class="thank-you">شكراً لتعاملكم مع ${company}</div>
      <div class="sub-note">${data.footer || 'هذا المستند صادر إلكترونياً ولا يحتاج إلى توقيع'}</div>
    </div>

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