import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart, AlertTriangle, TrendingDown, FileText } from "lucide-react";

const mockRefills = [
  { id: 1, client: "عيادة د. أحمد", material: "حشو كمبوزيت ضوئي", code: "MAT-001", unit: "عبوة", currentStock: 45, avgWeeklyUsage: 12, coverageWeeks: 3.75, leadTimeWeeks: 2, safetyStock: 5, reorderPoint: 29, suggestedQty: 50, priority: "Normal" },
  { id: 2, client: "عيادة د. أحمد", material: "إبر تخدير", code: "MAT-002", unit: "علبة", currentStock: 8, avgWeeklyUsage: 5, coverageWeeks: 1.6, leadTimeWeeks: 2, safetyStock: 3, reorderPoint: 13, suggestedQty: 25, priority: "Urgent" },
  { id: 3, client: "عيادة د. أحمد", material: "قفازات لاتكس", code: "MAT-005", unit: "كرتونة", currentStock: 2, avgWeeklyUsage: 3, coverageWeeks: 0.67, leadTimeWeeks: 2, safetyStock: 2, reorderPoint: 8, suggestedQty: 15, priority: "Critical" },
  { id: 4, client: "مركز نور لطب الأسنان", material: "حشو كمبوزيت ضوئي", code: "MAT-001", unit: "عبوة", currentStock: 65, avgWeeklyUsage: 18, coverageWeeks: 3.6, leadTimeWeeks: 2, safetyStock: 8, reorderPoint: 44, suggestedQty: 80, priority: "Normal" },
  { id: 5, client: "مركز نور لطب الأسنان", material: "مبيض أسنان", code: "MAT-008", unit: "عبوة", currentStock: 0.5, avgWeeklyUsage: 0.8, coverageWeeks: 0.63, leadTimeWeeks: 3, safetyStock: 0.5, reorderPoint: 2.9, suggestedQty: 5, priority: "Critical" },
  { id: 6, client: "عيادة جرين فالي", material: "إبر تخدير", code: "MAT-002", unit: "علبة", currentStock: 22, avgWeeklyUsage: 4, coverageWeeks: 5.5, leadTimeWeeks: 2, safetyStock: 3, reorderPoint: 11, suggestedQty: 0, priority: "OK" },
  { id: 7, client: "المركز الملكي للأسنان", material: "فرز دوارة", code: "MAT-010", unit: "عبوة", currentStock: 4, avgWeeklyUsage: 0.5, coverageWeeks: 8, leadTimeWeeks: 3, safetyStock: 1, reorderPoint: 2.5, suggestedQty: 0, priority: "OK" },
  { id: 8, client: "عيادة بلو مون", material: "قفازات لاتكس", code: "MAT-005", unit: "كرتونة", currentStock: 12, avgWeeklyUsage: 4, coverageWeeks: 3, leadTimeWeeks: 2, safetyStock: 3, reorderPoint: 11, suggestedQty: 20, priority: "Normal" },
  { id: 9, client: "عيادة سمايل هاوس", material: "مادة طبع سيليكون", code: "MAT-003", unit: "عبوة", currentStock: 5, avgWeeklyUsage: 6, coverageWeeks: 0.83, leadTimeWeeks: 1, safetyStock: 3, reorderPoint: 9, suggestedQty: 30, priority: "Critical" },
];

const priorityStyles: Record<string, string> = {
  "Critical": "bg-destructive/10 text-destructive",
  "Urgent": "bg-warning/10 text-warning",
  "Normal": "bg-info/10 text-info",
  "OK": "bg-success/10 text-success",
};

export default function RefillPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const clients = [...new Set(mockRefills.map(r => r.client))];

  const filtered = mockRefills.filter((r) => {
    const matchSearch = !search || r.client.toLowerCase().includes(search.toLowerCase()) || r.material.toLowerCase().includes(search.toLowerCase());
    const matchPriority = !filters.priority || filters.priority === "all" || r.priority === filters.priority;
    const matchClient = !filters.client || filters.client === "all" || r.client === filters.client;
    return matchSearch && matchPriority && matchClient;
  });

  const criticalCount = mockRefills.filter(r => r.priority === "Critical").length;
  const urgentCount = mockRefills.filter(r => r.priority === "Urgent").length;
  const needsRefill = mockRefills.filter(r => r.suggestedQty > 0).length;

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAllNeedRefill = () => {
    setSelected(new Set(filtered.filter(r => r.suggestedQty > 0).map(r => r.id)));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">تخطيط إعادة التعبئة</h1>
        <p className="page-description">توصيات إعادة تعبئة تلقائية بناءً على الاستهلاك ومواعيد التوريد</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="أصناف حرجة" value={criticalCount} change="أقل من حد الأمان" changeType="negative" icon={AlertTriangle} />
        <StatCard title="أصناف عاجلة" value={urgentCount} change="المخزون ينفذ" changeType="negative" icon={TrendingDown} />
        <StatCard title="تحتاج تعبئة" value={needsRefill} change={`من ${mockRefills.length} متتبع`} changeType="neutral" icon={Package} />
      </div>

      <DataToolbar
        searchPlaceholder="بحث في المواد أو العملاء..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "الأولوية", value: "priority", options: [
            { label: "حرج", value: "Critical" },
            { label: "عاجل", value: "Urgent" },
            { label: "عادي", value: "Normal" },
            { label: "جيد", value: "OK" },
          ]},
          { label: "العميل", value: "client", options: clients.map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("refill", ["العميل","المادة","الكود","الوحدة","المخزون الحالي","متوسط الاستهلاك الأسبوعي","التغطية بالأسابيع","وقت التوريد","حد الأمان","نقطة إعادة الطلب","الكمية المقترحة","الأولوية"], filtered.map(r => [r.client, r.material, r.code, r.unit, r.currentStock, r.avgWeeklyUsage, r.coverageWeeks, r.leadTimeWeeks, r.safetyStock, r.reorderPoint, r.suggestedQty, r.priority]))}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-9" onClick={selectAllNeedRefill}>تحديد الكل</Button>
            {selected.size > 0 && (
              <Button size="sm" className="h-9"><ShoppingCart className="h-3.5 w-3.5 mr-1.5" />إنشاء طلب ({selected.size})</Button>
            )}
          </div>
        }
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-3 px-3 w-10"><input type="checkbox" className="rounded" onChange={(e) => e.target.checked ? selectAllNeedRefill() : setSelected(new Set())} /></th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">العميل</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">المادة</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">المخزون</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">متوسط/أسبوع</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">التغطية</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">نقطة الطلب</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">الكمية المقترحة</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">الأولوية</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${selected.has(r.id) ? "bg-primary/5" : ""}`}>
                <td className="py-3 px-3">
                  {r.suggestedQty > 0 && (
                    <input type="checkbox" className="rounded" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                  )}
                </td>
                <td className="py-3 px-3 font-medium">{r.client}</td>
                <td className="py-3 px-3">{r.material} <span className="text-muted-foreground text-xs">({r.unit})</span></td>
                <td className="py-3 px-3 text-right font-medium">{r.currentStock}</td>
                <td className="py-3 px-3 text-right text-muted-foreground">{r.avgWeeklyUsage}</td>
                <td className="py-3 px-3 text-right">
                  <span className={r.coverageWeeks < 2 ? "text-destructive font-medium" : r.coverageWeeks < 4 ? "text-warning" : "text-muted-foreground"}>
                    {r.coverageWeeks.toFixed(1)} أسبوع
                  </span>
                </td>
                <td className="py-3 px-3 text-right text-muted-foreground">{r.reorderPoint}</td>
                <td className="py-3 px-3 text-right font-semibold">{r.suggestedQty > 0 ? r.suggestedQty : "—"}</td>
                <td className="py-3 px-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityStyles[r.priority]}`}>
                    {r.priority === "Critical" ? "حرج" : r.priority === "Urgent" ? "عاجل" : r.priority === "Normal" ? "عادي" : "جيد"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
