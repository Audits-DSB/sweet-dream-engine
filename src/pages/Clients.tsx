import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Eye, MoreHorizontal, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mockClients = [
  { id: "C001", name: "عيادة د. أحمد", contact: "أحمد خالد", email: "ahmed@clinic.eg", phone: "+20 100 111 2233", city: "القاهرة", status: "Active", joinDate: "2024-03-15", totalOrders: 18, outstanding: 32000, lastAudit: "2025-02-28" },
  { id: "C002", name: "مركز نور لطب الأسنان", contact: "فاطمة حسن", email: "fatima@noor.eg", phone: "+20 111 222 3344", city: "الجيزة", status: "Active", joinDate: "2024-01-20", totalOrders: 24, outstanding: 58000, lastAudit: "2025-03-01" },
  { id: "C003", name: "عيادة جرين فالي", contact: "عمر سعيد", email: "omar@greenvalley.eg", phone: "+20 122 333 4455", city: "القاهرة", status: "Active", joinDate: "2024-06-10", totalOrders: 12, outstanding: 0, lastAudit: "2025-02-20" },
  { id: "C004", name: "المركز الملكي للأسنان", contact: "ليلى ناصر", email: "layla@royal.eg", phone: "+20 100 444 5566", city: "الإسكندرية", status: "Active", joinDate: "2024-02-05", totalOrders: 31, outstanding: 45000, lastAudit: "2025-03-03" },
  { id: "C005", name: "عيادة سمايل هاوس", contact: "يوسف علي", email: "youssef@smile.eg", phone: "+20 111 555 6677", city: "القاهرة", status: "Inactive", joinDate: "2024-08-22", totalOrders: 6, outstanding: 19000, lastAudit: "2025-01-15" },
  { id: "C006", name: "عيادة بلو مون", contact: "هدى إبراهيم", email: "huda@bluemoon.eg", phone: "+20 100 666 7788", city: "الجيزة", status: "Active", joinDate: "2024-04-18", totalOrders: 15, outstanding: 0, lastAudit: "2025-03-05" },
  { id: "C007", name: "مركز سبايس جاردن", contact: "طارق محمد", email: "tariq@spice.eg", phone: "+20 111 777 8899", city: "المنصورة", status: "Active", joinDate: "2024-09-01", totalOrders: 9, outstanding: 21000, lastAudit: "2025-02-25" },
  { id: "C008", name: "عيادة كلاود ناين", contact: "منى صالح", email: "mona@cloudnine.eg", phone: "+20 122 888 9900", city: "القاهرة", status: "Inactive", joinDate: "2024-05-30", totalOrders: 4, outstanding: 0, lastAudit: "2024-12-10" },
];

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const filtered = mockClients.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.contact.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || c.status === filters.status;
    const matchCity = !filters.city || filters.city === "all" || c.city === filters.city;
    return matchSearch && matchStatus && matchCity;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">العملاء</h1>
          <p className="page-description">{mockClients.length} عميل · {mockClients.filter(c => c.status === "Active").length} نشط</p>
        </div>
      </div>

      <DataToolbar
        searchPlaceholder="بحث في العملاء..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "الحالة", value: "status", options: [{ label: "نشط", value: "Active" }, { label: "غير نشط", value: "Inactive" }] },
          { label: "المدينة", value: "city", options: [...new Set(mockClients.map(c => c.city))].map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("clients", ["الكود","الاسم","جهة الاتصال","البريد","الهاتف","المدينة","الحالة","تاريخ الانضمام","الطلبات","المستحق"], filtered.map(c => [c.id, c.name, c.contact, c.email, c.phone, c.city, c.status, c.joinDate, c.totalOrders, c.outstanding]))}
        actions={<Button size="sm" className="h-9"><Plus className="h-3.5 w-3.5 mr-1.5" />إضافة عميل</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">الكود</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">العميل</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">جهة الاتصال</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">المدينة</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">الحالة</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">الطلبات</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">المستحق</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">آخر مراجعة</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => (
              <tr key={client.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{client.id}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{client.name.charAt(0)}</span>
                    </div>
                    <span className="font-medium">{client.name}</span>
                  </div>
                </td>
                <td className="py-3 px-3 text-muted-foreground">{client.contact}</td>
                <td className="py-3 px-3 text-muted-foreground">{client.city}</td>
                <td className="py-3 px-3"><StatusBadge status={client.status} /></td>
                <td className="py-3 px-3 text-right font-medium">{client.totalOrders}</td>
                <td className="py-3 px-3 text-right font-medium">
                  {client.outstanding > 0 ? (
                    <span className="text-warning">{client.outstanding.toLocaleString()} ج.م</span>
                  ) : (
                    <span className="text-success">مسدد</span>
                  )}
                </td>
                <td className="py-3 px-3 text-muted-foreground text-xs">{client.lastAudit}</td>
                <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/clients/${client.id}`)}><Eye className="h-3.5 w-3.5 mr-2" />عرض الملف</DropdownMenuItem>
                      <DropdownMenuItem><Mail className="h-3.5 w-3.5 mr-2" />إرسال بريد</DropdownMenuItem>
                      <DropdownMenuItem><Phone className="h-3.5 w-3.5 mr-2" />اتصال</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">لا يوجد عملاء مطابقين للبحث.</div>
        )}
      </div>
    </div>
  );
}
