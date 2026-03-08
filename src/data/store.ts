// Shared mock data store - single source of truth for all pages

export const clientsList = [
  { id: "C001", name: "عيادة د. أحمد", contact: "أحمد خالد", email: "ahmed@clinic.eg", phone: "+20 100 111 2233", city: "القاهرة", status: "Active", joinDate: "2024-03-15", totalOrders: 18, outstanding: 32000, lastAudit: "2025-02-28" },
  { id: "C002", name: "مركز نور لطب الأسنان", contact: "فاطمة حسن", email: "fatima@noor.eg", phone: "+20 111 222 3344", city: "الجيزة", status: "Active", joinDate: "2024-01-20", totalOrders: 24, outstanding: 58000, lastAudit: "2025-03-01" },
  { id: "C003", name: "عيادة جرين فالي", contact: "عمر سعيد", email: "omar@greenvalley.eg", phone: "+20 122 333 4455", city: "القاهرة", status: "Active", joinDate: "2024-06-10", totalOrders: 12, outstanding: 0, lastAudit: "2025-02-20" },
  { id: "C004", name: "المركز الملكي للأسنان", contact: "ليلى ناصر", email: "layla@royal.eg", phone: "+20 100 444 5566", city: "الإسكندرية", status: "Active", joinDate: "2024-02-05", totalOrders: 31, outstanding: 45000, lastAudit: "2025-03-03" },
  { id: "C005", name: "عيادة سمايل هاوس", contact: "يوسف علي", email: "youssef@smile.eg", phone: "+20 111 555 6677", city: "القاهرة", status: "Inactive", joinDate: "2024-08-22", totalOrders: 6, outstanding: 19000, lastAudit: "2025-01-15" },
  { id: "C006", name: "عيادة بلو مون", contact: "هدى إبراهيم", email: "huda@bluemoon.eg", phone: "+20 100 666 7788", city: "الجيزة", status: "Active", joinDate: "2024-04-18", totalOrders: 15, outstanding: 0, lastAudit: "2025-03-05" },
  { id: "C007", name: "مركز سبايس جاردن", contact: "طارق محمد", email: "tariq@spice.eg", phone: "+20 111 777 8899", city: "المنصورة", status: "Active", joinDate: "2024-09-01", totalOrders: 9, outstanding: 21000, lastAudit: "2025-02-25" },
  { id: "C008", name: "عيادة كلاود ناين", contact: "منى صالح", email: "mona@cloudnine.eg", phone: "+20 122 888 9900", city: "القاهرة", status: "Inactive", joinDate: "2024-05-30", totalOrders: 4, outstanding: 0, lastAudit: "2024-12-10" },
];

export const ordersList = [
  { id: "ORD-048", client: "عيادة د. أحمد", date: "2025-03-06", lines: 4, totalSelling: "32,000 ج.م", totalCost: "21,000 ج.م", splitMode: "متساوي", deliveryFee: 500, status: "Draft", source: "REQ-001" },
  { id: "ORD-047", client: "مركز نور لطب الأسنان", date: "2025-03-05", lines: 7, totalSelling: "85,000 ج.م", totalCost: "58,000 ج.م", splitMode: "بالمساهمة", deliveryFee: 750, status: "Confirmed", source: "REQ-002" },
  { id: "ORD-046", client: "عيادة جرين فالي", date: "2025-03-04", lines: 3, totalSelling: "21,000 ج.م", totalCost: "14,000 ج.م", splitMode: "متساوي", deliveryFee: 500, status: "Ready for Delivery", source: "REQ-003" },
  { id: "ORD-045", client: "المركز الملكي للأسنان", date: "2025-03-03", lines: 5, totalSelling: "48,000 ج.م", totalCost: "32,000 ج.م", splitMode: "متساوي", deliveryFee: 0, status: "Delivered", source: "يدوي" },
  { id: "ORD-044", client: "عيادة بلو مون", date: "2025-03-01", lines: 6, totalSelling: "56,000 ج.م", totalCost: "38,000 ج.م", splitMode: "بالمساهمة", deliveryFee: 500, status: "Partially Delivered", source: "REQ-006" },
  { id: "ORD-043", client: "عيادة سمايل هاوس", date: "2025-02-28", lines: 2, totalSelling: "12,000 ج.م", totalCost: "8,000 ج.م", splitMode: "متساوي", deliveryFee: 500, status: "Invoiced", source: "يدوي" },
  { id: "ORD-042", client: "عيادة د. أحمد", date: "2025-02-25", lines: 5, totalSelling: "41,000 ج.م", totalCost: "27,000 ج.م", splitMode: "متساوي", deliveryFee: 500, status: "Closed", source: "REQ-008" },
  { id: "ORD-041", client: "مركز سبايس جاردن", date: "2025-02-22", lines: 3, totalSelling: "24,000 ج.م", totalCost: "16,000 ج.م", splitMode: "متساوي", deliveryFee: 0, status: "Awaiting Purchase", source: "REQ-007" },
  { id: "ORD-040", client: "المركز الملكي للأسنان", date: "2025-02-20", lines: 4, totalSelling: "36,000 ج.م", totalCost: "24,000 ج.م", splitMode: "بالمساهمة", deliveryFee: 750, status: "Cancelled", source: "يدوي" },
];

export const materialsList = [
  { code: "MAT-001", name: "حشو كمبوزيت ضوئي", category: "حشوات", unit: "عبوة", sellingPrice: 1200, storeCost: 800, supplier: "3M ESPE", hasExpiry: true, active: true },
  { code: "MAT-002", name: "إبر تخدير", category: "تخدير", unit: "علبة", sellingPrice: 950, storeCost: 600, supplier: "Septodont", hasExpiry: true, active: true },
  { code: "MAT-003", name: "مادة طبع سيليكون", category: "طبعات", unit: "عبوة", sellingPrice: 450, storeCost: 280, supplier: "Zhermack", hasExpiry: true, active: true },
  { code: "MAT-004", name: "جلاس أيونومر", category: "حشوات", unit: "عبوة", sellingPrice: 850, storeCost: 550, supplier: "GC Corporation", hasExpiry: true, active: true },
  { code: "MAT-005", name: "قفازات لاتكس", category: "مستهلكات", unit: "كرتونة", sellingPrice: 400, storeCost: 280, supplier: "Supermax", hasExpiry: true, active: true },
  { code: "MAT-006", name: "بوند لاصق", category: "حشوات", unit: "زجاجة", sellingPrice: 1800, storeCost: 1200, supplier: "Kerr Dental", hasExpiry: true, active: true },
  { code: "MAT-007", name: "خيط خياطة جراحي", category: "جراحة", unit: "علبة", sellingPrice: 2200, storeCost: 1500, supplier: "Ethicon", hasExpiry: true, active: true },
  { code: "MAT-008", name: "مبيض أسنان", category: "تجميل", unit: "عبوة", sellingPrice: 2800, storeCost: 1800, supplier: "Opalescence", hasExpiry: true, active: true },
  { code: "MAT-009", name: "سلك تقويم", category: "تقويم", unit: "عبوة", sellingPrice: 3500, storeCost: 2400, supplier: "Ormco", hasExpiry: false, active: true },
  { code: "MAT-010", name: "فرز دوارة", category: "أدوات", unit: "عبوة", sellingPrice: 2000, storeCost: 1300, supplier: "Mani", hasExpiry: false, active: true },
  { code: "MAT-011", name: "مادة ضوئية UV", category: "حشوات", unit: "عبوة", sellingPrice: 4200, storeCost: 2900, supplier: "Ivoclar", hasExpiry: true, active: true },
  { code: "MAT-012", name: "مادة تلميع", category: "تجميل", unit: "عبوة", sellingPrice: 1500, storeCost: 950, supplier: "Shofu", hasExpiry: true, active: false },
];

export const foundersList = [
  { id: "1", name: "أحمد الراشد", alias: "المدير التنفيذي", email: "ahmed@opshub.com", phone: "+20 100 123 4567" },
  { id: "2", name: "سارة المنصور", alias: "مدير العمليات", email: "sara@opshub.com", phone: "+20 111 234 5678" },
  { id: "3", name: "عمر خليل", alias: "المدير المالي", email: "omar@opshub.com", phone: "+20 122 345 6789" },
];

export const deliveryActors = [
  { id: "1", name: "أحمد (مؤسس)", type: "مؤسس" },
  { id: "2", name: "DHL Express", type: "خارجي" },
  { id: "3", name: "شركة توصيل سريع", type: "خارجي" },
  { id: "4", name: "سارة (مؤسس)", type: "مؤسس" },
];
