import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Eye, MoreHorizontal, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mockRequests = [
  { id: "REQ-001", client: "عيادة د. أحمد", date: "2025-03-06", items: 4, expectedTotal: "32,000 ج.م", status: "Client Requested", notes: "عاجل - المخزون ينفذ" },
  { id: "REQ-002", client: "مركز نور لطب الأسنان", date: "2025-03-05", items: 7, expectedTotal: "85,000 ج.م", status: "Pending Review", notes: "" },
  { id: "REQ-003", client: "عيادة جرين فالي", date: "2025-03-04", items: 3, expectedTotal: "21,000 ج.م", status: "Approved", notes: "إعادة تخزين شهرية" },
  { id: "REQ-004", client: "المركز الملكي للأسنان", date: "2025-03-03", items: 5, expectedTotal: "48,000 ج.م", status: "Converted to Order", notes: "" },
  { id: "REQ-005", client: "عيادة سمايل هاوس", date: "2025-03-02", items: 2, expectedTotal: "12,000 ج.م", status: "Rejected", notes: "العميل غير نشط" },
  { id: "REQ-006", client: "عيادة بلو مون", date: "2025-03-01", items: 6, expectedTotal: "56,000 ج.م", status: "Pending Review", notes: "أصناف جديدة مطلوبة" },
  { id: "REQ-007", client: "مركز سبايس جاردن", date: "2025-02-28", items: 3, expectedTotal: "24,000 ج.م", status: "Approved", notes: "" },
  { id: "REQ-008", client: "عيادة د. أحمد", date: "2025-02-25", items: 5, expectedTotal: "41,000 ج.م", status: "Converted to Order", notes: "" },
  { id: "REQ-009", client: "المركز الملكي للأسنان", date: "2025-02-22", items: 2, expectedTotal: "18,000 ج.م", status: "Cancelled", notes: "العميل ألغى" },
];

export default function RequestsPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filtered = mockRequests.filter((r) => {
    const matchSearch = !search || r.client.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || r.status === filters.status;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">طلبات العملاء</h1>
        <p className="page-description">{mockRequests.length} طلب · {mockRequests.filter(r => r.status === "Pending Review").length} بانتظار المراجعة</p>
      </div>

      <DataToolbar
        searchPlaceholder="بحث في الطلبات..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "الحالة", value: "status", options: [
            { label: "طلب عميل", value: "Client Requested" },
            { label: "بانتظار المراجعة", value: "Pending Review" },
            { label: "موافق عليه", value: "Approved" },
            { label: "مرفوض", value: "Rejected" },
            { label: "تم تحويله لطلب", value: "Converted to Order" },
            { label: "ملغي", value: "Cancelled" },
          ]},
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("requests", ["الكود","العميل","التاريخ","البنود","الإجمالي المتوقع","الحالة","ملاحظات"], filtered.map(r => [r.id, r.client, r.date, r.items, r.expectedTotal, r.status, r.notes]))}
        actions={<Button size="sm" className="h-9" onClick={() => toast.info("نموذج طلب جديد قريباً")}><Plus className="h-3.5 w-3.5 mr-1.5" />طلب جديد</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">الكود</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">العميل</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">التاريخ</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">البنود</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">الإجمالي المتوقع</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">الحالة</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">ملاحظات</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((req) => (
              <tr key={req.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{req.id}</td>
                <td className="py-3 px-3 font-medium">{req.client}</td>
                <td className="py-3 px-3 text-muted-foreground">{req.date}</td>
                <td className="py-3 px-3 text-right">{req.items}</td>
                <td className="py-3 px-3 text-right font-medium">{req.expectedTotal}</td>
                <td className="py-3 px-3"><StatusBadge status={req.status} /></td>
                <td className="py-3 px-3 text-xs text-muted-foreground max-w-[200px] truncate">{req.notes || "—"}</td>
                <td className="py-3 px-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toast.info(`عرض ${req.id}`)}><Eye className="h-3.5 w-3.5 mr-2" />عرض التفاصيل</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { toast.success(`تمت الموافقة على ${req.id}`); }}><CheckCircle className="h-3.5 w-3.5 mr-2" />موافقة</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { toast.error(`تم رفض ${req.id}`); }}><XCircle className="h-3.5 w-3.5 mr-2" />رفض</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { toast.success(`تم تحويل ${req.id} لطلب`); }}><ArrowRight className="h-3.5 w-3.5 mr-2" />تحويل لطلب</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">لا توجد طلبات مطابقة للبحث.</div>
        )}
      </div>
    </div>
  );
}
