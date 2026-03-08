import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Eye, MoreHorizontal, Truck, FileText, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mockOrders = [
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

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const filtered = mockOrders.filter((o) => {
    const matchSearch = !search || o.client.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || o.status === filters.status;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">الطلبات</h1>
        <p className="page-description">{mockOrders.length} طلب · {mockOrders.filter(o => ["Draft", "Confirmed", "Ready for Delivery"].includes(o.status)).length} نشط</p>
      </div>

      <DataToolbar
        searchPlaceholder="بحث في الطلبات..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "الحالة", value: "status", options: [
            { label: "مسودة", value: "Draft" },
            { label: "مؤكد", value: "Confirmed" },
            { label: "في انتظار الشراء", value: "Awaiting Purchase" },
            { label: "جاهز للتسليم", value: "Ready for Delivery" },
            { label: "تسليم جزئي", value: "Partially Delivered" },
            { label: "تم التسليم", value: "Delivered" },
            { label: "مفوتر", value: "Invoiced" },
            { label: "مغلق", value: "Closed" },
            { label: "ملغي", value: "Cancelled" },
          ]},
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("orders", ["رقم الطلب","العميل","التاريخ","البنود","البيع","التكلفة","التقسيم","المصدر","الحالة"], filtered.map(o => [o.id, o.client, o.date, o.lines, o.totalSelling, o.totalCost, o.splitMode, o.source, o.status]))}
        actions={<Button size="sm" className="h-9" onClick={() => toast.info("نموذج طلب جديد قريباً")}><Plus className="h-3.5 w-3.5 mr-1.5" />طلب جديد</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">رقم الطلب</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">العميل</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">التاريخ</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">البنود</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">البيع</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">التكلفة</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">التقسيم</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">المصدر</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">الحالة</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                <td className="py-3 px-3 font-mono text-xs font-medium">{order.id}</td>
                <td className="py-3 px-3 font-medium">{order.client}</td>
                <td className="py-3 px-3 text-muted-foreground">{order.date}</td>
                <td className="py-3 px-3 text-right">{order.lines}</td>
                <td className="py-3 px-3 text-right font-medium">{order.totalSelling}</td>
                <td className="py-3 px-3 text-right text-muted-foreground">{order.totalCost}</td>
                <td className="py-3 px-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{order.splitMode}</span></td>
                <td className="py-3 px-3 text-xs text-muted-foreground">{order.source}</td>
                <td className="py-3 px-3"><StatusBadge status={order.status} /></td>
                <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/orders/${order.id}`)}><Eye className="h-3.5 w-3.5 mr-2" />عرض التفاصيل</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(`تم تسجيل التسليم لـ ${order.id}`)}><Truck className="h-3.5 w-3.5 mr-2" />تسجيل تسليم</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(`تم إنشاء فاتورة لـ ${order.id}`)}><FileText className="h-3.5 w-3.5 mr-2" />إنشاء فاتورة</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(`تم نسخ ${order.id}`)}><Copy className="h-3.5 w-3.5 mr-2" />نسخ</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
