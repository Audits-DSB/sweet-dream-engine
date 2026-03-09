// Shared mock data store - single source of truth for all pages

export const suppliersList = [
  { id: "SUP-001", name: "3M ESPE", country: "الولايات المتحدة", email: "orders@3m.com", phone: "+1 800 364 3577", website: "www.3m.com", paymentTerms: "Net 30", active: true },
  { id: "SUP-002", name: "Septodont", country: "فرنسا", email: "info@septodont.com", phone: "+33 1 49 76 70 00", website: "www.septodont.com", paymentTerms: "Net 45", active: true },
  { id: "SUP-003", name: "Zhermack", country: "إيطاليا", email: "sales@zhermack.com", phone: "+39 049 723 7211", website: "www.zhermack.com", paymentTerms: "Net 30", active: true },
  { id: "SUP-004", name: "GC Corporation", country: "اليابان", email: "info@gc.dental", phone: "+81 3 3278 8721", website: "www.gc.dental", paymentTerms: "Net 60", active: true },
  { id: "SUP-005", name: "Supermax", country: "ماليزيا", email: "sales@supermax.com", phone: "+60 3 6142 6688", website: "www.supermax.com.my", paymentTerms: "Net 30", active: true },
  { id: "SUP-006", name: "Kerr Dental", country: "الولايات المتحدة", email: "info@kerrdental.com", phone: "+1 800 537 7123", website: "www.kerrdental.com", paymentTerms: "Net 30", active: true },
  { id: "SUP-007", name: "Ethicon", country: "الولايات المتحدة", email: "orders@ethicon.com", phone: "+1 800 255 2500", website: "www.ethicon.com", paymentTerms: "Net 45", active: true },
  { id: "SUP-008", name: "Opalescence", country: "الولايات المتحدة", email: "info@ultradent.com", phone: "+1 800 552 5138", website: "www.ultradent.com", paymentTerms: "Net 30", active: true },
  { id: "SUP-009", name: "Ormco", country: "الولايات المتحدة", email: "info@ormco.com", phone: "+1 800 854 1741", website: "www.ormco.com", paymentTerms: "Net 60", active: true },
  { id: "SUP-010", name: "Mani", country: "اليابان", email: "sales@mani.co.jp", phone: "+81 28 667 8592", website: "www.mani.co.jp", paymentTerms: "Net 45", active: true },
  { id: "SUP-011", name: "Ivoclar", country: "ليختنشتاين", email: "info@ivoclar.com", phone: "+423 235 3535", website: "www.ivoclar.com", paymentTerms: "Net 30", active: true },
  { id: "SUP-012", name: "Shofu", country: "اليابان", email: "info@shofu.co.jp", phone: "+81 75 561 1211", website: "www.shofu.co.jp", paymentTerms: "Net 30", active: false },
];

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
  { id: "ORD-048", client: "عيادة د. أحمد", clientId: "C001", date: "2025-03-06", lines: 4, totalSelling: "32,000 ج.م", totalCost: "21,000 ج.م", splitMode: "متساوي", deliveryFee: 500, status: "Draft", source: "REQ-001" },
  { id: "ORD-047", client: "مركز نور لطب الأسنان", clientId: "C002", date: "2025-03-05", lines: 7, totalSelling: "85,000 ج.م", totalCost: "58,000 ج.م", splitMode: "بالمساهمة", deliveryFee: 750, status: "Confirmed", source: "REQ-002" },
  { id: "ORD-046", client: "عيادة جرين فالي", clientId: "C003", date: "2025-03-04", lines: 3, totalSelling: "21,000 ج.م", totalCost: "14,000 ج.م", splitMode: "متساوي", deliveryFee: 500, status: "Ready for Delivery", source: "REQ-003" },
  { id: "ORD-045", client: "المركز الملكي للأسنان", clientId: "C004", date: "2025-03-03", lines: 5, totalSelling: "48,000 ج.م", totalCost: "32,000 ج.م", splitMode: "متساوي", deliveryFee: 0, status: "Delivered", source: "يدوي" },
  { id: "ORD-044", client: "عيادة بلو مون", clientId: "C006", date: "2025-03-01", lines: 6, totalSelling: "56,000 ج.م", totalCost: "38,000 ج.م", splitMode: "بالمساهمة", deliveryFee: 500, status: "Partially Delivered", source: "REQ-006" },
  { id: "ORD-043", client: "عيادة سمايل هاوس", clientId: "C005", date: "2025-02-28", lines: 2, totalSelling: "12,000 ج.م", totalCost: "8,000 ج.م", splitMode: "متساوي", deliveryFee: 500, status: "Invoiced", source: "يدوي" },
  { id: "ORD-042", client: "عيادة د. أحمد", clientId: "C001", date: "2025-02-25", lines: 5, totalSelling: "41,000 ج.م", totalCost: "27,000 ج.م", splitMode: "متساوي", deliveryFee: 500, status: "Closed", source: "REQ-008" },
  { id: "ORD-041", client: "مركز سبايس جاردن", clientId: "C007", date: "2025-02-22", lines: 3, totalSelling: "24,000 ج.م", totalCost: "16,000 ج.م", splitMode: "متساوي", deliveryFee: 0, status: "Awaiting Purchase", source: "REQ-007" },
  { id: "ORD-040", client: "المركز الملكي للأسنان", clientId: "C004", date: "2025-02-20", lines: 4, totalSelling: "36,000 ج.م", totalCost: "24,000 ج.م", splitMode: "بالمساهمة", deliveryFee: 750, status: "Cancelled", source: "يدوي" },
];

export const materialsList = [
  { code: "MAT-001", name: "حشو كمبوزيت ضوئي", category: "حشوات", unit: "عبوة", sellingPrice: 1200, storeCost: 800, supplier: "3M ESPE", supplierId: "SUP-001", manufacturer: "3M", hasExpiry: true, active: true },
  { code: "MAT-002", name: "إبر تخدير", category: "تخدير", unit: "علبة", sellingPrice: 950, storeCost: 600, supplier: "Septodont", supplierId: "SUP-002", manufacturer: "Septodont", hasExpiry: true, active: true },
  { code: "MAT-003", name: "مادة طبع سيليكون", category: "طبعات", unit: "عبوة", sellingPrice: 450, storeCost: 280, supplier: "Zhermack", supplierId: "SUP-003", manufacturer: "Zhermack", hasExpiry: true, active: true },
  { code: "MAT-004", name: "جلاس أيونومر", category: "حشوات", unit: "عبوة", sellingPrice: 850, storeCost: 550, supplier: "GC Corporation", supplierId: "SUP-004", manufacturer: "GC Fuji", hasExpiry: true, active: true },
  { code: "MAT-005", name: "قفازات لاتكس", category: "مستهلكات", unit: "كرتونة", sellingPrice: 400, storeCost: 280, supplier: "Supermax", supplierId: "SUP-005", manufacturer: "Supermax", hasExpiry: true, active: true },
  { code: "MAT-006", name: "بوند لاصق", category: "حشوات", unit: "زجاجة", sellingPrice: 1800, storeCost: 1200, supplier: "Kerr Dental", supplierId: "SUP-006", manufacturer: "Kerr", hasExpiry: true, active: true },
  { code: "MAT-007", name: "خيط خياطة جراحي", category: "جراحة", unit: "علبة", sellingPrice: 2200, storeCost: 1500, supplier: "Ethicon", supplierId: "SUP-007", manufacturer: "Johnson & Johnson", hasExpiry: true, active: true },
  { code: "MAT-008", name: "مبيض أسنان", category: "تجميل", unit: "عبوة", sellingPrice: 2800, storeCost: 1800, supplier: "Opalescence", supplierId: "SUP-008", manufacturer: "Ultradent", hasExpiry: true, active: true },
  { code: "MAT-009", name: "سلك تقويم", category: "تقويم", unit: "عبوة", sellingPrice: 3500, storeCost: 2400, supplier: "Ormco", supplierId: "SUP-009", manufacturer: "Ormco", hasExpiry: false, active: true },
  { code: "MAT-010", name: "فرز دوارة", category: "أدوات", unit: "عبوة", sellingPrice: 2000, storeCost: 1300, supplier: "Mani", supplierId: "SUP-010", manufacturer: "Mani Inc.", hasExpiry: false, active: true },
  { code: "MAT-011", name: "مادة ضوئية UV", category: "حشوات", unit: "عبوة", sellingPrice: 4200, storeCost: 2900, supplier: "Ivoclar", supplierId: "SUP-011", manufacturer: "Ivoclar Vivadent", hasExpiry: true, active: true },
  { code: "MAT-012", name: "مادة تلميع", category: "تجميل", unit: "عبوة", sellingPrice: 1500, storeCost: 950, supplier: "Shofu", supplierId: "SUP-012", manufacturer: "Shofu Inc.", hasExpiry: true, active: false },
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

export const requestsList = [
  { id: "REQ-012", client: "المركز الملكي للأسنان", clientId: "C004", date: "2025-03-05", items: 5, totalValue: "48,000 ج.م", priority: "High", status: "Converted to Order", convertedOrderId: "ORD-049", notes: "طلب عاجل - العميل يحتاج المواد خلال 48 ساعة" },
  { id: "REQ-011", client: "عيادة د. أحمد", clientId: "C001", date: "2025-03-04", items: 3, totalValue: "21,000 ج.م", priority: "Medium", status: "Under Review", convertedOrderId: null, notes: "مراجعة توافر المخزون" },
  { id: "REQ-010", client: "مركز نور لطب الأسنان", clientId: "C002", date: "2025-03-03", items: 7, totalValue: "85,000 ج.م", priority: "High", status: "Converted to Order", convertedOrderId: "ORD-047", notes: "أوردر كبير - يحتاج موافقة الإدارة" },
  { id: "REQ-009", client: "عيادة بلو مون", clientId: "C006", date: "2025-03-02", items: 4, totalValue: "32,000 ج.م", priority: "Low", status: "Pending", convertedOrderId: null, notes: "" },
  { id: "REQ-008", client: "عيادة سمايل هاوس", clientId: "C005", date: "2025-03-01", items: 2, totalValue: "12,000 ج.م", priority: "Medium", status: "Converted to Order", convertedOrderId: "ORD-043", notes: "عميل جديد - التحقق من الائتمان" },
  { id: "REQ-007", client: "مركز سبايس جاردن", clientId: "C007", date: "2025-02-28", items: 6, totalValue: "54,000 ج.م", priority: "High", status: "Rejected", convertedOrderId: null, notes: "مواد غير متوفرة - تم رفض الطلب" },
  { id: "REQ-006", client: "عيادة جرين فالي", clientId: "C003", date: "2025-02-27", items: 3, totalValue: "21,000 ج.م", priority: "Medium", status: "Converted to Order", convertedOrderId: "ORD-046", notes: "" },
];

export const deliveriesList = [
  { id: "DEL-078", orderId: "ORD-049", client: "المركز الملكي للأسنان", clientId: "C004", date: "2025-03-06", scheduledDate: "2025-03-07", status: "Scheduled", deliveredBy: "أحمد (مؤسس)", deliveryFee: 750, items: 5, notes: "موعد التسليم: 10 صباحاً" },
  { id: "DEL-077", orderId: "ORD-047", client: "مركز نور لطب الأسنان", clientId: "C002", date: "2025-03-05", scheduledDate: "2025-03-06", status: "In Transit", deliveredBy: "DHL Express", deliveryFee: 750, items: 7, notes: "في الطريق - تتبع رقم DHL123456" },
  { id: "DEL-076", orderId: "ORD-046", client: "عيادة جرين فالي", clientId: "C003", date: "2025-03-04", scheduledDate: "2025-03-05", status: "Delivered", deliveredBy: "سارة (مؤسس)", deliveryFee: 500, items: 3, notes: "تم التسليم بنجاح - توقيع مستلم" },
  { id: "DEL-075", orderId: "ORD-045", client: "المركز الملكي للأسنان", clientId: "C004", date: "2025-03-03", scheduledDate: "2025-03-04", status: "Delivered", deliveredBy: "شركة توصيل سريع", deliveryFee: 0, items: 5, notes: "" },
  { id: "DEL-074", orderId: "ORD-044", client: "عيادة بلو مون", clientId: "C006", date: "2025-03-01", scheduledDate: "2025-03-02", status: "Partially Delivered", deliveredBy: "أحمد (مؤسس)", deliveryFee: 500, items: 6, notes: "تم تسليم 4 من 6 عناصر - الباقي في الطريق" },
  { id: "DEL-073", orderId: "ORD-043", client: "عيادة سمايل هاوس", clientId: "C005", date: "2025-02-28", scheduledDate: "2025-03-01", status: "Delivered", deliveredBy: "DHL Express", deliveryFee: 500, items: 2, notes: "" },
  { id: "DEL-072", orderId: "ORD-041", client: "مركز سبايس جاردن", clientId: "C007", date: "2025-02-25", scheduledDate: "2025-02-26", status: "Cancelled", deliveredBy: "-", deliveryFee: 0, items: 3, notes: "ألغاه العميل" },
  { id: "DEL-071", orderId: "ORD-042", client: "عيادة د. أحمد", clientId: "C001", date: "2025-02-22", scheduledDate: "2025-02-23", status: "Delivery Failed", deliveredBy: "شركة توصيل سريع", deliveryFee: 500, items: 5, notes: "العميل غير موجود - إعادة جدولة" },
];

export const collectionsList = [
  { id: "INV-089", orderId: "ORD-049", client: "المركز الملكي للأسنان", clientId: "C004", invoiceDate: "2025-03-06", dueDate: "2025-04-05", totalAmount: 48000, paidAmount: 0, outstanding: 48000, status: "Pending", paymentMethod: "-", notes: "فاتورة جديدة - انتظار التسليم" },
  { id: "INV-088", orderId: "ORD-047", client: "مركز نور لطب الأسنان", clientId: "C002", invoiceDate: "2025-03-05", dueDate: "2025-04-04", totalAmount: 85000, paidAmount: 42500, outstanding: 42500, status: "Partially Paid", paymentMethod: "تحويل بنكي", notes: "تم دفع 50% - الباقي خلال أسبوعين" },
  { id: "INV-087", orderId: "ORD-046", client: "عيادة جرين فالي", clientId: "C003", invoiceDate: "2025-03-04", dueDate: "2025-04-03", totalAmount: 21000, paidAmount: 21000, outstanding: 0, status: "Paid", paymentMethod: "نقداً", notes: "تم الدفع كاملاً عند التسليم" },
  { id: "INV-086", orderId: "ORD-045", client: "المركز الملكي للأسنان", clientId: "C004", invoiceDate: "2025-03-03", dueDate: "2025-04-02", totalAmount: 48000, paidAmount: 48000, outstanding: 0, status: "Paid", paymentMethod: "شيك", notes: "" },
  { id: "INV-085", orderId: "ORD-044", client: "عيادة بلو مون", clientId: "C006", invoiceDate: "2025-03-01", dueDate: "2025-03-31", totalAmount: 56000, paidAmount: 28000, outstanding: 28000, status: "Partially Paid", paymentMethod: "تحويل بنكي", notes: "دفع جزئي - المتبقي خلال 10 أيام" },
  { id: "INV-084", orderId: "ORD-043", client: "عيادة سمايل هاوس", clientId: "C005", invoiceDate: "2025-02-28", dueDate: "2025-02-15", totalAmount: 12000, paidAmount: 0, outstanding: 12000, status: "Overdue", paymentMethod: "-", notes: "متأخر 21 يوم - يحتاج متابعة عاجلة" },
  { id: "INV-083", orderId: "ORD-042", client: "عيادة د. أحمد", clientId: "C001", invoiceDate: "2025-02-25", dueDate: "2025-03-27", totalAmount: 41000, paidAmount: 41000, outstanding: 0, status: "Paid", paymentMethod: "نقداً", notes: "" },
];

export const inventoryList = [
  { materialCode: "MAT-001", materialName: "حشو كمبوزيت ضوئي", category: "حشوات", totalStock: 145, reorderPoint: 50, lots: [
    { lotNumber: "LOT-A123", quantity: 85, expiryDate: "2026-08-15", location: "Shelf A-12", supplier: "3M ESPE" },
    { lotNumber: "LOT-A124", quantity: 60, expiryDate: "2025-04-20", location: "Shelf A-13", supplier: "3M ESPE" },
  ]},
  { materialCode: "MAT-002", materialName: "إبر تخدير", category: "تخدير", totalStock: 320, reorderPoint: 100, lots: [
    { lotNumber: "LOT-B456", quantity: 200, expiryDate: "2025-12-30", location: "Shelf B-05", supplier: "Septodont" },
    { lotNumber: "LOT-B457", quantity: 120, expiryDate: "2025-03-25", location: "Shelf B-06", supplier: "Septodont" },
  ]},
  { materialCode: "MAT-003", materialName: "مادة طبع سيليكون", category: "طبعات", totalStock: 42, reorderPoint: 30, lots: [
    { lotNumber: "LOT-C789", quantity: 42, expiryDate: "2026-01-10", location: "Shelf C-08", supplier: "Zhermack" },
  ]},
  { materialCode: "MAT-005", materialName: "قفازات لاتكس", category: "مستهلكات", totalStock: 18, reorderPoint: 50, lots: [
    { lotNumber: "LOT-E234", quantity: 18, expiryDate: "2025-06-15", location: "Shelf E-02", supplier: "Supermax" },
  ]},
  { materialCode: "MAT-008", materialName: "مبيض أسنان", category: "تجميل", totalStock: 95, reorderPoint: 40, lots: [
    { lotNumber: "LOT-H567", quantity: 55, expiryDate: "2026-03-18", location: "Shelf H-01", supplier: "Opalescence" },
    { lotNumber: "LOT-H568", quantity: 40, expiryDate: "2025-09-22", location: "Shelf H-02", supplier: "Opalescence" },
  ]},
];

export const notificationsList = [
  { id: "NOT-015", type: "warning", title: "مخزون قفازات اللاتكس منخفض", message: "المخزون الحالي: 18 وحدة - أقل من نقطة إعادة الطلب (50)", date: "2025-03-09", time: "09:15", read: false },
  { id: "NOT-014", type: "urgent", title: "إبر التخدير LOT-B457 تنتهي قريباً", message: "تاريخ الانتهاء: 2025-03-25 (16 يوم متبقية)", date: "2025-03-09", time: "08:30", read: false },
  { id: "NOT-013", type: "info", title: "تم إنشاء أوردر جديد ORD-049", message: "للعميل: المركز الملكي للأسنان - القيمة: 48,000 ج.م", date: "2025-03-06", time: "14:20", read: false },
  { id: "NOT-012", type: "success", title: "تم تسليم DEL-076 بنجاح", message: "عيادة جرين فالي - 3 عناصر", date: "2025-03-05", time: "11:45", read: true },
  { id: "NOT-011", type: "warning", title: "فاتورة INV-084 متأخرة", message: "عيادة سمايل هاوس - المبلغ: 12,000 ج.م - متأخر 21 يوم", date: "2025-03-04", time: "10:00", read: false },
  { id: "NOT-010", type: "info", title: "طلب REQ-011 قيد المراجعة", message: "عيادة د. أحمد - يحتاج مراجعة توافر المخزون", date: "2025-03-04", time: "09:30", read: true },
];

// Helper to find client by name
export function findClientByName(name: string) {
  return clientsList.find(c => c.name === name);
}

// Helper to find order by id
export function findOrderById(id: string) {
  return ordersList.find(o => o.id === id);
}
