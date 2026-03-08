import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/StatCard";
import { Plus, Eye, MoreHorizontal, ClipboardCheck, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { clientsList, foundersList } from "@/data/store";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialAudits = [
  { id: "AUD-012", client: "عيادة د. أحمد", date: "2025-03-05", auditor: "أحمد الراشد", totalItems: 8, matched: 6, shortage: 1, surplus: 1, notes: "زجاجة شراب السكر تالفة", status: "Completed" },
  { id: "AUD-011", client: "مركز نور لطب الأسنان", date: "2025-02-28", auditor: "سارة المنصور", totalItems: 12, matched: 12, shortage: 0, surplus: 0, notes: "", status: "Completed" },
  { id: "AUD-010", client: "عيادة جرين فالي", date: "2025-02-25", auditor: "أحمد الراشد", totalItems: 6, matched: 5, shortage: 1, surplus: 0, notes: "1 كجم قهوة ناقصة", status: "Discrepancy" },
  { id: "AUD-009", client: "المركز الملكي للأسنان", date: "2025-02-20", auditor: "عمر خليل", totalItems: 10, matched: 9, shortage: 0, surplus: 1, notes: "فانيلا إضافية من توصيل سابق", status: "Completed" },
  { id: "AUD-008", client: "عيادة بلو مون", date: "2025-02-15", auditor: "سارة المنصور", totalItems: 7, matched: 7, shortage: 0, surplus: 0, notes: "", status: "Completed" },
  { id: "AUD-007", client: "عيادة سمايل هاوس", date: "2025-02-10", auditor: "أحمد الراشد", totalItems: 5, matched: 3, shortage: 2, surplus: 0, notes: "أصناف ناقصة: شاي أخضر 2كجم، حليب بودرة 1كجم", status: "Discrepancy" },
  { id: "AUD-006", client: "مركز سبايس جاردن", date: "2025-02-05", auditor: "عمر خليل", totalItems: 4, matched: 4, shortage: 0, surplus: 0, notes: "", status: "Completed" },
  { id: "AUD-DRAFT", client: "المركز الملكي للأسنان", date: "2025-03-08", auditor: "سارة المنصور", totalItems: 0, matched: 0, shortage: 0, surplus: 0, notes: "", status: "Scheduled" },
  { id: "AUD-PROG", client: "مركز نور لطب الأسنان", date: "2025-03-07", auditor: "عمر خليل", totalItems: 12, matched: 8, shortage: 0, surplus: 0, notes: "جاري التنفيذ...", status: "In Progress" },
];

const auditDetails = [
  { material: "حشو كمبوزيت ضوئي", expected: 45, actual: 45, unit: "عبوة", result: "مطابق" },
  { material: "إبر تخدير", expected: 8, actual: 7, unit: "علبة", result: "نقص" },
  { material: "مادة طبع سيليكون", expected: 30, actual: 30, unit: "عبوة", result: "مطابق" },
  { material: "قفازات لاتكس", expected: 2, actual: 2, unit: "كرتونة", result: "مطابق" },
  { material: "مبيض أسنان", expected: 1.5, actual: 1.5, unit: "عبوة", result: "مطابق" },
  { material: "بوند لاصق", expected: 3, actual: 3, unit: "زجاجة", result: "مطابق" },
  { material: "فرز دوارة", expected: 200, actual: 215, unit: "عبوة", result: "فائض" },
  { material: "خيط خياطة جراحي", expected: 50, actual: 49, unit: "علبة", result: "نقص" },
];

export default function AuditsPage() {
  const [audits, setAudits] = useState(initialAudits);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedAudit, setSelectedAudit] = useState<typeof initialAudits[0] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedAuditor, setSelectedAuditor] = useState("");
  const [auditDate, setAuditDate] = useState("");
  const [auditNotes, setAuditNotes] = useState("");

  const filtered = audits.filter((a) => {
    const matchSearch = !search || a.client.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase()) || a.auditor.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || a.status === filters.status;
    const matchClient = !filters.client || filters.client === "all" || a.client === filters.client;
    return matchSearch && matchStatus && matchClient;
  });

  const completedCount = audits.filter(a => a.status === "Completed").length;
  const discrepancyCount = audits.filter(a => a.status === "Discrepancy").length;
  const scheduledCount = audits.filter(a => a.status === "Scheduled" || a.status === "In Progress").length;

  const handleAdd = () => {
    if (!selectedClient || !selectedAuditor) { toast.error("يرجى اختيار العميل والمراجع"); return; }
    const client = clientsList.find(c => c.id === selectedClient);
    const auditor = foundersList.find(f => f.id === selectedAuditor);
    if (!client || !auditor) return;
    const num = audits.length + 1;
    const newId = `AUD-${String(num).padStart(3, "0")}`;
    const today = auditDate || new Date().toISOString().split("T")[0];
    setAudits([{ id: newId, client: client.name, date: today, auditor: auditor.name, totalItems: 0, matched: 0, shortage: 0, surplus: 0, notes: auditNotes, status: "Scheduled" }, ...audits]);
    setSelectedClient(""); setSelectedAuditor(""); setAuditDate(""); setAuditNotes("");
    setDialogOpen(false);
    toast.success("تم جدولة الجرد بنجاح");
  };

  const auditClients = [...new Set(audits.map(a => a.client))];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">الجرد والمراجعة</h1>
        <p className="page-description">جلسات المراجعة الأسبوعية وتتبع الاستهلاك</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="جرد مكتمل" value={completedCount} change="هذا الربع" changeType="neutral" icon={CheckCircle2} />
        <StatCard title="تباينات" value={discrepancyCount} change={`${((discrepancyCount / audits.length) * 100).toFixed(0)}% من الجرد`} changeType="negative" icon={AlertTriangle} />
        <StatCard title="مجدول / قيد التنفيذ" value={scheduledCount} change="قادم" changeType="neutral" icon={ClipboardCheck} />
      </div>

      <DataToolbar
        searchPlaceholder="بحث في الجرد..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "الحالة", value: "status", options: [
            { label: "مكتمل", value: "Completed" }, { label: "تباين", value: "Discrepancy" },
            { label: "مجدول", value: "Scheduled" }, { label: "قيد التنفيذ", value: "In Progress" },
          ]},
          { label: "العميل", value: "client", options: auditClients.map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("audits", ["الكود","العميل","التاريخ","المراجع","الأصناف","مطابق","نقص","فائض","الحالة","ملاحظات"], filtered.map(a => [a.id, a.client, a.date, a.auditor, a.totalItems, a.matched, a.shortage, a.surplus, a.status, a.notes]))}
        actions={<Button size="sm" className="h-9" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />جرد جديد</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">الكود</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">العميل</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">التاريخ</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">المراجع</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">الأصناف</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">مطابق</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">نقص</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">فائض</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">الحالة</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((audit) => (
              <tr key={audit.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedAudit(audit)}>
                <td className="py-3 px-3 font-mono text-xs font-medium">{audit.id}</td>
                <td className="py-3 px-3 font-medium">{audit.client}</td>
                <td className="py-3 px-3 text-muted-foreground">{audit.date}</td>
                <td className="py-3 px-3">{audit.auditor}</td>
                <td className="py-3 px-3 text-right">{audit.totalItems}</td>
                <td className="py-3 px-3 text-right text-success font-medium">{audit.matched}</td>
                <td className="py-3 px-3 text-right">{audit.shortage > 0 ? <span className="text-destructive font-medium">{audit.shortage}</span> : "—"}</td>
                <td className="py-3 px-3 text-right">{audit.surplus > 0 ? <span className="text-warning font-medium">{audit.surplus}</span> : "—"}</td>
                <td className="py-3 px-3"><StatusBadge status={audit.status} /></td>
                <td className="py-3 px-3 text-right" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedAudit(audit)}><Eye className="h-3.5 w-3.5 mr-2" />عرض التفاصيل</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length === 0 && (
            <tfoot><tr><td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">لا توجد نتائج مطابقة.</td></tr></tfoot>
          )}
        </table>
      </div>

      {/* Audit Detail Dialog */}
      <Dialog open={!!selectedAudit} onOpenChange={() => setSelectedAudit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>جرد {selectedAudit?.id} — {selectedAudit?.client}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <div><span className="text-muted-foreground">التاريخ:</span> <span className="font-medium">{selectedAudit?.date}</span></div>
              <div><span className="text-muted-foreground">المراجع:</span> <span className="font-medium">{selectedAudit?.auditor}</span></div>
              <div><StatusBadge status={selectedAudit?.status || ""} /></div>
            </div>
            {selectedAudit?.notes && (
              <div className="p-3 rounded-lg bg-warning/10 text-warning text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {selectedAudit.notes}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">المادة</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">المتوقع</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">الفعلي</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">الوحدة</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">النتيجة</th>
                  </tr>
                </thead>
                <tbody>
                  {auditDetails.map((d, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium">{d.material}</td>
                      <td className="py-2 px-3 text-right">{d.expected}</td>
                      <td className="py-2 px-3 text-right font-medium">{d.actual}</td>
                      <td className="py-2 px-3 text-muted-foreground">{d.unit}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${d.result === "مطابق" ? "text-success" : d.result === "نقص" ? "text-destructive" : "text-warning"}`}>
                          {d.result === "مطابق" ? <CheckCircle2 className="h-3 w-3" /> : d.result === "نقص" ? <XCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          {d.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Audit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>جدولة جرد جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">العميل *</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="اختر العميل..." /></SelectTrigger>
                <SelectContent>
                  {clientsList.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">المراجع *</Label>
              <Select value={selectedAuditor} onValueChange={setSelectedAuditor}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="اختر المراجع..." /></SelectTrigger>
                <SelectContent>
                  {foundersList.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name} — {f.alias}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">التاريخ</Label><Input className="h-9 mt-1" type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} /></div>
            <div><Label className="text-xs">ملاحظات</Label><Input className="h-9 mt-1" value={auditNotes} onChange={(e) => setAuditNotes(e.target.value)} /></div>
            <Button className="w-full" onClick={handleAdd}>جدولة الجرد</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
