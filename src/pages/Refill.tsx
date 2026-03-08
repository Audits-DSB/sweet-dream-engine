import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart, AlertTriangle, TrendingDown, FileText } from "lucide-react";

const mockRefills = [
  { id: 1, client: "Al Salam Cafe", material: "Arabica Coffee Beans", code: "MAT-001", unit: "kg", currentStock: 45, avgWeeklyUsage: 12, coverageWeeks: 3.75, leadTimeWeeks: 2, safetyStock: 5, reorderPoint: 29, suggestedQty: 50, priority: "Normal" },
  { id: 2, client: "Al Salam Cafe", material: "Green Tea Leaves", code: "MAT-002", unit: "kg", currentStock: 8, avgWeeklyUsage: 5, coverageWeeks: 1.6, leadTimeWeeks: 2, safetyStock: 3, reorderPoint: 13, suggestedQty: 25, priority: "Urgent" },
  { id: 3, client: "Al Salam Cafe", material: "Milk Powder", code: "MAT-005", unit: "kg", currentStock: 2, avgWeeklyUsage: 3, coverageWeeks: 0.67, leadTimeWeeks: 2, safetyStock: 2, reorderPoint: 8, suggestedQty: 15, priority: "Critical" },
  { id: 4, client: "Noor Restaurant", material: "Arabica Coffee Beans", code: "MAT-001", unit: "kg", currentStock: 65, avgWeeklyUsage: 18, coverageWeeks: 3.6, leadTimeWeeks: 2, safetyStock: 8, reorderPoint: 44, suggestedQty: 80, priority: "Normal" },
  { id: 5, client: "Noor Restaurant", material: "Vanilla Extract", code: "MAT-008", unit: "L", currentStock: 0.5, avgWeeklyUsage: 0.8, coverageWeeks: 0.63, leadTimeWeeks: 3, safetyStock: 0.5, reorderPoint: 2.9, suggestedQty: 5, priority: "Critical" },
  { id: 6, client: "Green Valley Lounge", material: "Green Tea Leaves", code: "MAT-002", unit: "kg", currentStock: 22, avgWeeklyUsage: 4, coverageWeeks: 5.5, leadTimeWeeks: 2, safetyStock: 3, reorderPoint: 11, suggestedQty: 0, priority: "OK" },
  { id: 7, client: "Royal Kitchen", material: "Cinnamon Sticks", code: "MAT-010", unit: "kg", currentStock: 4, avgWeeklyUsage: 0.5, coverageWeeks: 8, leadTimeWeeks: 3, safetyStock: 1, reorderPoint: 2.5, suggestedQty: 0, priority: "OK" },
  { id: 8, client: "Blue Moon Cafe", material: "Milk Powder", code: "MAT-005", unit: "kg", currentStock: 12, avgWeeklyUsage: 4, coverageWeeks: 3, leadTimeWeeks: 2, safetyStock: 3, reorderPoint: 11, suggestedQty: 20, priority: "Normal" },
  { id: 9, client: "Taste House", material: "Sugar Syrup", code: "MAT-003", unit: "L", currentStock: 5, avgWeeklyUsage: 6, coverageWeeks: 0.83, leadTimeWeeks: 1, safetyStock: 3, reorderPoint: 9, suggestedQty: 30, priority: "Critical" },
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
        <h1 className="page-header">Refill Planning</h1>
        <p className="page-description">Automated refill recommendations based on consumption and lead times</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Critical Items" value={criticalCount} change="Below safety stock" changeType="negative" icon={AlertTriangle} />
        <StatCard title="Urgent Items" value={urgentCount} change="Running low" changeType="negative" icon={TrendingDown} />
        <StatCard title="Need Refill" value={needsRefill} change={`of ${mockRefills.length} tracked`} changeType="neutral" icon={Package} />
      </div>

      <DataToolbar
        searchPlaceholder="Search materials or clients..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "Priority", value: "priority", options: [
            { label: "Critical", value: "Critical" },
            { label: "Urgent", value: "Urgent" },
            { label: "Normal", value: "Normal" },
            { label: "OK", value: "OK" },
          ]},
          { label: "Client", value: "client", options: clients.map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("refill", ["Client","Material","Code","Unit","Current Stock","Avg Weekly Usage","Coverage Weeks","Lead Time","Safety Stock","Reorder Point","Suggested Qty","Priority"], filtered.map(r => [r.client, r.material, r.code, r.unit, r.currentStock, r.avgWeeklyUsage, r.coverageWeeks, r.leadTimeWeeks, r.safetyStock, r.reorderPoint, r.suggestedQty, r.priority]))}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-9" onClick={selectAllNeedRefill}>Select All Needs</Button>
            {selected.size > 0 && (
              <Button size="sm" className="h-9"><ShoppingCart className="h-3.5 w-3.5 mr-1.5" />Create Order ({selected.size})</Button>
            )}
          </div>
        }
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-3 px-3 w-10"><input type="checkbox" className="rounded" onChange={(e) => e.target.checked ? selectAllNeedRefill() : setSelected(new Set())} /></th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Client</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Material</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Stock</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Avg/Week</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Coverage</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Reorder Pt</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Suggested Qty</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Priority</th>
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
                    {r.coverageWeeks.toFixed(1)}w
                  </span>
                </td>
                <td className="py-3 px-3 text-right text-muted-foreground">{r.reorderPoint}</td>
                <td className="py-3 px-3 text-right font-semibold">{r.suggestedQty > 0 ? r.suggestedQty : "—"}</td>
                <td className="py-3 px-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityStyles[r.priority]}`}>
                    {r.priority}
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
