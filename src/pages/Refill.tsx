import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, ShoppingCart, AlertTriangle, TrendingDown, Users, Package2 } from "lucide-react";
import { toast } from "sonner";

const mockRefills = [
  { id: 1, client: "عيادة د. أحمد", clientId: "C001", material: "حشو كمبوزيت ضوئي", code: "MAT-001", unit: "عبوة", currentStock: 45, avgWeeklyUsage: 12, coverageWeeks: 3.75, leadTimeWeeks: 2, safetyStock: 5, reorderPoint: 29, suggestedQty: 50, priority: "Normal" },
  { id: 2, client: "عيادة د. أحمد", clientId: "C001", material: "إبر تخدير", code: "MAT-002", unit: "علبة", currentStock: 8, avgWeeklyUsage: 5, coverageWeeks: 1.6, leadTimeWeeks: 2, safetyStock: 3, reorderPoint: 13, suggestedQty: 25, priority: "Urgent" },
  { id: 3, client: "عيادة د. أحمد", clientId: "C001", material: "قفازات لاتكس", code: "MAT-005", unit: "كرتونة", currentStock: 2, avgWeeklyUsage: 3, coverageWeeks: 0.67, leadTimeWeeks: 2, safetyStock: 2, reorderPoint: 8, suggestedQty: 15, priority: "Critical" },
  { id: 4, client: "مركز نور لطب الأسنان", clientId: "C002", material: "حشو كمبوزيت ضوئي", code: "MAT-001", unit: "عبوة", currentStock: 65, avgWeeklyUsage: 18, coverageWeeks: 3.6, leadTimeWeeks: 2, safetyStock: 8, reorderPoint: 44, suggestedQty: 80, priority: "Normal" },
  { id: 5, client: "مركز نور لطب الأسنان", clientId: "C002", material: "مبيض أسنان", code: "MAT-008", unit: "عبوة", currentStock: 0.5, avgWeeklyUsage: 0.8, coverageWeeks: 0.63, leadTimeWeeks: 3, safetyStock: 0.5, reorderPoint: 2.9, suggestedQty: 5, priority: "Critical" },
  { id: 6, client: "عيادة جرين فالي", clientId: "C003", material: "إبر تخدير", code: "MAT-002", unit: "علبة", currentStock: 22, avgWeeklyUsage: 4, coverageWeeks: 5.5, leadTimeWeeks: 2, safetyStock: 3, reorderPoint: 11, suggestedQty: 0, priority: "OK" },
  { id: 7, client: "المركز الملكي للأسنان", clientId: "C004", material: "فرز دوارة", code: "MAT-010", unit: "عبوة", currentStock: 4, avgWeeklyUsage: 0.5, coverageWeeks: 8, leadTimeWeeks: 3, safetyStock: 1, reorderPoint: 2.5, suggestedQty: 0, priority: "OK" },
  { id: 8, client: "عيادة بلو مون", clientId: "C006", material: "قفازات لاتكس", code: "MAT-005", unit: "كرتونة", currentStock: 12, avgWeeklyUsage: 4, coverageWeeks: 3, leadTimeWeeks: 2, safetyStock: 3, reorderPoint: 11, suggestedQty: 20, priority: "Normal" },
  { id: 9, client: "عيادة سمايل هاوس", clientId: "C005", material: "مادة طبع سيليكون", code: "MAT-003", unit: "عبوة", currentStock: 5, avgWeeklyUsage: 6, coverageWeeks: 0.83, leadTimeWeeks: 1, safetyStock: 3, reorderPoint: 9, suggestedQty: 30, priority: "Critical" },
];

const priorityStyles: Record<string, string> = {
  "Critical": "bg-destructive/10 text-destructive",
  "Urgent": "bg-warning/10 text-warning",
  "Normal": "bg-info/10 text-info",
  "OK": "bg-success/10 text-success",
};

export default function RefillPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [groupBy, setGroupBy] = useState<"client" | "material">("client");

  const clients = [...new Set(mockRefills.map(r => r.client))];
  const materials = [...new Set(mockRefills.map(r => r.material))];
  const priorityLabel = (p: string) => p === "Critical" ? t.critical : p === "Urgent" ? t.urgent : p === "Normal" ? t.normal : t.ok;

  const filtered = mockRefills.filter((r) => {
    const matchSearch = !search || r.client.toLowerCase().includes(search.toLowerCase()) || r.material.toLowerCase().includes(search.toLowerCase());
    const matchPriority = !filters.priority || filters.priority === "all" || r.priority === filters.priority;
    const matchClient = !filters.client || filters.client === "all" || r.client === filters.client;
    return matchSearch && matchPriority && matchClient;
  });

  // Group filtered data based on groupBy selection
  const groupedData = filtered.reduce((acc: Record<string, typeof filtered>, item) => {
    const key = groupBy === "client" ? item.client : item.material;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const criticalCount = mockRefills.filter(r => r.priority === "Critical").length;
  const urgentCount = mockRefills.filter(r => r.priority === "Urgent").length;
  const needsRefill = mockRefills.filter(r => r.suggestedQty > 0).length;

  const toggleSelect = (id: number) => { const next = new Set(selected); if (next.has(id)) next.delete(id); else next.add(id); setSelected(next); };
  const selectAllNeedRefill = () => setSelected(new Set(filtered.filter(r => r.suggestedQty > 0).map(r => r.id)));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.refillTitle}</h1>
        <p className="page-description">{t.refillDesc}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title={t.criticalItems} value={criticalCount} change={t.belowSafetyLevel} changeType="negative" icon={AlertTriangle} />
        <StatCard title={t.urgentItems} value={urgentCount} change={t.stockRunningOut} changeType="negative" icon={TrendingDown} />
        <StatCard title={t.needsRefill} value={needsRefill} change={`${mockRefills.length} ${t.ofTracked}`} changeType="neutral" icon={Package} />
      </div>

      <DataToolbar
        searchPlaceholder={t.searchRefill}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: t.priority, value: "priority", options: [
            { label: t.critical, value: "Critical" }, { label: t.urgent, value: "Urgent" }, { label: t.normal, value: "Normal" }, { label: t.ok, value: "OK" },
          ]},
          { label: t.client, value: "client", options: clients.map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("refill", [t.client, t.material, t.code, t.unit, t.currentStock, t.avgPerWeek, t.coverage, t.reorderPoint, t.suggestedQty, t.priority], filtered.map(r => [r.client, r.material, r.code, r.unit, r.currentStock, r.avgWeeklyUsage, r.coverageWeeks, r.reorderPoint, r.suggestedQty, r.priority]))}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-9" onClick={selectAllNeedRefill}>{t.selectAll}</Button>
            {selected.size > 0 && (
              <Button size="sm" className="h-9" onClick={() => { navigate("/orders"); toast.success(t.createOrderFromSelection); }}><ShoppingCart className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.createOrderFromSelection} ({selected.size})</Button>
            )}
          </div>
        }
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-3 px-3 w-10"><input type="checkbox" className="rounded" onChange={(e) => e.target.checked ? selectAllNeedRefill() : setSelected(new Set())} /></th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.currentStock}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.avgPerWeek}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.coverage}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.reorderPoint}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.suggestedQty}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.priority}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${selected.has(r.id) ? "bg-primary/5" : ""}`}>
                <td className="py-3 px-3">{r.suggestedQty > 0 && <input type="checkbox" className="rounded" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />}</td>
                <td className="py-3 px-3 font-medium hover:text-primary cursor-pointer" onClick={() => navigate(`/clients/${r.clientId}`)}>{r.client}</td>
                <td className="py-3 px-3 hover:text-primary cursor-pointer" onClick={() => navigate("/materials")}>{r.material} <span className="text-muted-foreground text-xs">({r.unit})</span></td>
                <td className="py-3 px-3 text-end font-medium">{r.currentStock}</td>
                <td className="py-3 px-3 text-end text-muted-foreground">{r.avgWeeklyUsage}</td>
                <td className="py-3 px-3 text-end">
                  <span className={r.coverageWeeks < 2 ? "text-destructive font-medium" : r.coverageWeeks < 4 ? "text-warning" : "text-muted-foreground"}>
                    {r.coverageWeeks.toFixed(1)} {t.weeks}
                  </span>
                </td>
                <td className="py-3 px-3 text-end text-muted-foreground">{r.reorderPoint}</td>
                <td className="py-3 px-3 text-end font-semibold">{r.suggestedQty > 0 ? r.suggestedQty : "—"}</td>
                <td className="py-3 px-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityStyles[r.priority]}`}>
                    {priorityLabel(r.priority)}
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
