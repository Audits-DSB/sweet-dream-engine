import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, ShoppingCart, AlertTriangle, TrendingDown, Users, Package2, CheckCircle2, Loader2, ClipboardCheck, Factory } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

type InventoryLot = {
  id: string;
  clientId: string;
  clientName: string;
  material: string;
  code: string;
  unit: string;
  remaining: number;
  avgWeeklyUsage: number;
  leadTimeWeeks: number;
  safetyStock: number;
  status: string;
  shortageQty: number;
  imageUrl?: string;
  sourceOrder?: string;
};

type AuditRecord = {
  id: string;
  clientId?: string;
  client_id?: string;
  orderId?: string;
  order_id?: string;
  status: string;
  date?: string;
  createdAt?: string;
  created_at?: string;
};

type RefillItem = {
  id: string;
  client: string;
  clientId: string;
  material: string;
  code: string;
  unit: string;
  currentStock: number;
  avgWeeklyUsage: number;
  coverageWeeks: number;
  leadTimeWeeks: number;
  safetyStock: number;
  reorderPoint: number;
  suggestedQty: number;
  priority: "Critical" | "Urgent" | "Normal" | "OK";
  fromAudit: boolean;
  imageUrl?: string;
  sourceOrder?: string;
  auditStatus?: string;
  auditId?: string;
  lastSupplierId?: string;
  lastSupplierName?: string;
  lastCostPrice?: number;
  lastOrderDate?: string;
  pendingOrderIds?: string[];
};

function computePriority(coverageWeeks: number, leadTimeWeeks: number): "Critical" | "Urgent" | "Normal" | "OK" {
  if (coverageWeeks <= leadTimeWeeks * 0.5) return "Critical";
  if (coverageWeeks <= leadTimeWeeks) return "Urgent";
  if (coverageWeeks <= leadTimeWeeks * 2) return "Normal";
  return "OK";
}

const priorityStyles: Record<string, string> = {
  "Critical": "bg-destructive/10 text-destructive",
  "Urgent": "bg-warning/10 text-warning",
  "Normal": "bg-info/10 text-info",
  "OK": "bg-success/10 text-success",
};

const priorityChipStyles: Record<string, { active: string; inactive: string }> = {
  "Critical": { active: "bg-destructive text-destructive-foreground shadow-sm", inactive: "bg-destructive/10 text-destructive hover:bg-destructive/20" },
  "Urgent": { active: "bg-warning text-warning-foreground shadow-sm", inactive: "bg-warning/10 text-warning hover:bg-warning/20" },
  "Normal": { active: "bg-info text-info-foreground shadow-sm", inactive: "bg-info/10 text-info hover:bg-info/20" },
  "OK": { active: "bg-success text-success-foreground shadow-sm", inactive: "bg-success/10 text-success hover:bg-success/20" },
};

const priorityOrder = ["Critical", "Urgent", "Normal", "OK"];

export default function RefillPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<"client" | "material">("client");
  const [activePriorities, setActivePriorities] = useState<Set<string>>(new Set());

  const { data: rawLots = [], isLoading } = useQuery<InventoryLot[]>({
    queryKey: ["/api/client-inventory"],
    queryFn: () => api.get<InventoryLot[]>("/client-inventory"),
  });

  const { data: rawAudits = [] } = useQuery<AuditRecord[]>({
    queryKey: ["/api/audits"],
    queryFn: () => api.get<AuditRecord[]>("/audits").catch(() => []),
  });

  const { data: materialHistory = { materials: {}, pending: {} } } = useQuery<{
    materials: Record<string, { supplierId: string; supplierName: string; lastCostPrice: number; lastOrderDate: string }>;
    pending: Record<string, string[]>;
  }>({
    queryKey: ["/api/material-last-suppliers"],
    queryFn: () => api.get("/material-last-suppliers").catch(() => ({ materials: {}, pending: {} })),
  });

  const [converting, setConverting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [editQty, setEditQty] = useState<Record<string, number>>({});
  const [supplierFilter, setSupplierFilter] = useState("");

  const lots: InventoryLot[] = rawLots.map(l => ({
    ...l,
    remaining: Number(l.remaining),
    avgWeeklyUsage: Number(l.avgWeeklyUsage),
    leadTimeWeeks: Number(l.leadTimeWeeks),
    safetyStock: Number(l.safetyStock),
    shortageQty: Number((l as any).shortageQty || 0),
  }));

  const auditsByOrder = useMemo(() => {
    const map: Record<string, AuditRecord> = {};
    for (const a of rawAudits) {
      const oid = a.orderId || a.order_id || "";
      if (oid && (!map[oid] || a.status === "Completed")) map[oid] = a;
    }
    return map;
  }, [rawAudits]);

  // Compute refill items from client inventory
  const refillItems: RefillItem[] = useMemo(() => {
    return lots
      .filter(l => l.status !== "Expired")
      .map(l => {
        const fromAudit = l.status === "Needs Refill" && l.shortageQty > 0;
        const coverageWeeks = l.avgWeeklyUsage > 0 ? l.remaining / l.avgWeeklyUsage : 999;
        const reorderPoint = l.avgWeeklyUsage * l.leadTimeWeeks + l.safetyStock;

        // Items flagged by audit are always Urgent (or Critical if depleted)
        let priority: "Critical" | "Urgent" | "Normal" | "OK";
        if (fromAudit) {
          priority = l.remaining <= 0 ? "Critical" : "Urgent";
        } else if (l.avgWeeklyUsage > 0) {
          priority = computePriority(coverageWeeks, l.leadTimeWeeks);
        } else {
          priority = l.remaining <= 0 ? "Critical" : "OK";
        }

        // Suggested qty: audit shortage takes precedence over computed qty
        let suggestedQty = 0;
        if (fromAudit) {
          suggestedQty = l.shortageQty;
        } else if (priority !== "OK" && l.avgWeeklyUsage > 0) {
          suggestedQty = Math.ceil(l.avgWeeklyUsage * (l.leadTimeWeeks * 3) - l.remaining + l.safetyStock);
        }

        const audit = l.sourceOrder ? auditsByOrder[l.sourceOrder] : undefined;

        const ls = materialHistory.materials?.[l.code];
        const pend = materialHistory.pending?.[l.code];
        return {
          id: l.id,
          client: l.clientName,
          clientId: l.clientId,
          material: l.material,
          code: l.code,
          unit: l.unit,
          currentStock: l.remaining,
          avgWeeklyUsage: l.avgWeeklyUsage,
          coverageWeeks: l.avgWeeklyUsage > 0 ? Math.round(coverageWeeks * 10) / 10 : 0,
          leadTimeWeeks: l.leadTimeWeeks,
          safetyStock: l.safetyStock,
          reorderPoint: Math.round(reorderPoint * 10) / 10,
          suggestedQty: Math.max(0, suggestedQty),
          priority,
          fromAudit,
          imageUrl: l.imageUrl,
          sourceOrder: l.sourceOrder,
          auditStatus: audit?.status,
          auditId: audit?.id,
          lastSupplierId: ls?.supplierId,
          lastSupplierName: ls?.supplierName,
          lastCostPrice: ls?.lastCostPrice,
          lastOrderDate: ls?.lastOrderDate,
          pendingOrderIds: pend,
        };
      });
  }, [lots, auditsByOrder, materialHistory]);

  useEffect(() => {
    const f = searchParams.get("filter");
    if (!f) setActivePriorities(new Set());
  }, [searchParams]);

  const clientNames = [...new Set(refillItems.map(r => r.client))];
  const supplierNames = useMemo(() => {
    const names = new Set<string>();
    refillItems.forEach(r => { if (r.lastSupplierName) names.add(r.lastSupplierName); });
    return [...names].sort();
  }, [refillItems]);
  const priorityLabel = (p: string) => p === "Critical" ? t.critical : p === "Urgent" ? t.urgent : p === "Normal" ? t.normal : t.ok;

  const priorityCounts = priorityOrder.reduce((acc, p) => {
    acc[p] = refillItems.filter(r => r.priority === p).length;
    return acc;
  }, {} as Record<string, number>);

  const togglePriority = (p: string) => {
    const next = new Set(activePriorities);
    if (next.has(p)) next.delete(p); else next.add(p);
    setActivePriorities(next);
  };

  const filtered = refillItems.filter((r) => {
    const quickFilter = searchParams.get("filter");
    const matchQuickFilter = quickFilter !== "low_stock" || r.suggestedQty > 0;
    const matchSearch = !search || r.client.toLowerCase().includes(search.toLowerCase()) || r.material.toLowerCase().includes(search.toLowerCase());
    const matchPriority = activePriorities.size === 0 || activePriorities.has(r.priority);
    const matchClient = !filters.client || filters.client === "all" || r.client === filters.client;
    const matchSupplier = !supplierFilter || r.lastSupplierName === supplierFilter;
    return matchQuickFilter && matchSearch && matchPriority && matchClient && matchSupplier;
  });

  const groupedData = filtered.reduce((acc: Record<string, RefillItem[]>, item) => {
    const key = groupBy === "client" ? item.client : item.material;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const criticalCount = refillItems.filter(r => r.priority === "Critical").length;
  const urgentCount = refillItems.filter(r => r.priority === "Urgent").length;
  const needsRefill = refillItems.filter(r => r.suggestedQty > 0).length;

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAllNeedRefill = () => setSelected(new Set(filtered.filter(r => r.suggestedQty > 0).map(r => r.id)));

  const toggleSelectGroup = (items: RefillItem[]) => {
    const refillable = items.filter(r => r.suggestedQty > 0);
    const allSelected = refillable.every(r => selected.has(r.id));
    const next = new Set(selected);
    if (allSelected) refillable.forEach(r => next.delete(r.id));
    else refillable.forEach(r => next.add(r.id));
    setSelected(next);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.refillTitle}</h1>
        <p className="page-description">{t.refillDesc}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="cursor-pointer" onClick={() => setActivePriorities(new Set(["Critical"]))}>
          <StatCard title={t.criticalItems} value={criticalCount} change={t.belowSafetyLevel} changeType="negative" icon={AlertTriangle} />
        </div>
        <div className="cursor-pointer" onClick={() => setActivePriorities(new Set(["Urgent"]))}>
          <StatCard title={t.urgentItems} value={urgentCount} change={t.stockRunningOut} changeType="negative" icon={TrendingDown} />
        </div>
        <div className="cursor-pointer" onClick={() => setActivePriorities(new Set(["Critical", "Urgent", "Normal"]))}>
          <StatCard title={t.needsRefill} value={needsRefill} change={`${refillItems.length} ${t.ofTracked}`} changeType="neutral" icon={Package} />
        </div>
      </div>

      {/* Priority filter chips */}
      <div className="flex flex-wrap gap-2">
        {priorityOrder.map((p) => {
          const isActive = activePriorities.has(p);
          const style = priorityChipStyles[p];
          return (
            <button
              key={p}
              onClick={() => togglePriority(p)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border-0 ${isActive ? style.active : style.inactive}`}
            >
              {isActive && <CheckCircle2 className="h-3 w-3" />}
              {priorityLabel(p)}
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold ${isActive ? "bg-background/30" : "bg-background/50"} px-1`}>
                {priorityCounts[p]}
              </span>
            </button>
          );
        })}
        {activePriorities.size > 0 && (
          <button
            onClick={() => setActivePriorities(new Set())}
            className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-all cursor-pointer border border-border"
          >
            ✕ {t.selectAll}
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t.groupBy}:</span>
            <Select value={groupBy} onValueChange={(value: "client" | "material") => setGroupBy(value)}>
              <SelectTrigger className="h-9 w-[140px]">
                {groupBy === "client" ? <Users className="h-3.5 w-3.5 mr-1.5" /> : <Package2 className="h-3.5 w-3.5 mr-1.5" />}
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">{t.client}</SelectItem>
                <SelectItem value="material">{t.material}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {supplierNames.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">المورد:</span>
              <Select value={supplierFilter || "__all__"} onValueChange={(v) => setSupplierFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-9 w-[160px]">
                  <Factory className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">الكل</SelectItem>
                  {supplierNames.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <DataToolbar
        searchPlaceholder={t.searchRefill}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: t.client, value: "client", options: clientNames.map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("refill", [t.client, t.material, t.code, t.unit, t.currentStock, t.avgPerWeek, t.coverage, t.reorderPoint, t.suggestedQty, "آخر مورد", "آخر سعر", t.priority], filtered.map(r => [r.client, r.material, r.code, r.unit, r.currentStock, r.avgWeeklyUsage, r.coverageWeeks, r.reorderPoint, r.suggestedQty, r.lastSupplierName || "", r.lastCostPrice || "", r.priority]))}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-9" onClick={selectAllNeedRefill}>{t.selectAll}</Button>
            {selected.size > 0 && (
              <Button size="sm" className="h-9" onClick={() => setShowConfirm(true)}>
                <ShoppingCart className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
                تحويل لطلب ({selected.size})
              </Button>
            )}
          </div>
        }
      />

      {showConfirm && (() => {
        const refillable = filtered.filter(r => selected.has(r.id) && r.suggestedQty > 0);
        const totalEstCost = refillable.reduce((s, i) => s + (editQty[i.id] ?? i.suggestedQty) * (i.lastCostPrice || 0), 0);
        const supplierGroups = new Map<string, number>();
        refillable.forEach(r => {
          const sup = r.lastSupplierName || "بدون مورد";
          supplierGroups.set(sup, (supplierGroups.get(sup) || 0) + 1);
        });
        const hasPending = refillable.some(r => r.pendingOrderIds && r.pendingOrderIds.length > 0);
        return (
          <div className="stat-card p-5 space-y-4 border-2 border-primary/30 bg-primary/5">
            <h3 className="font-semibold text-sm flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" />ملخص التحويل لطلب</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><span className="text-muted-foreground">عدد المواد:</span> <span className="font-bold">{refillable.length}</span></div>
              <div><span className="text-muted-foreground">إجمالي التكلفة المتوقعة:</span> <span className="font-bold">{totalEstCost.toLocaleString()}</span></div>
              <div><span className="text-muted-foreground">موردين:</span> <span className="font-bold">{supplierGroups.size}</span></div>
              <div><span className="text-muted-foreground">العميل:</span> <span className="font-bold">{refillable[0]?.client}</span></div>
            </div>
            {hasPending && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>بعض المواد موجودة بالفعل في طلبات قيد التنفيذ — تأكد إنك مش بتطلبها مرتين</span>
              </div>
            )}
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-muted/50 border-b border-border">
                  <th className="py-2 px-3 text-start">المادة</th>
                  <th className="py-2 px-3 text-end">الكمية</th>
                  <th className="py-2 px-3 text-end">سعر الشراء</th>
                  <th className="py-2 px-3 text-start">المورد</th>
                  <th className="py-2 px-3 text-start">حالة</th>
                </tr></thead>
                <tbody>
                  {refillable.map(r => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium">{r.material} <span className="text-muted-foreground">({r.unit})</span></td>
                      <td className="py-2 px-3 text-end">
                        <input type="number" min={1} className="w-16 h-7 text-center text-xs border border-border rounded px-1 bg-background" value={editQty[r.id] ?? r.suggestedQty} onChange={(e) => setEditQty(prev => ({ ...prev, [r.id]: Math.max(1, Number(e.target.value) || 1) }))} />
                      </td>
                      <td className="py-2 px-3 text-end text-muted-foreground">{r.lastCostPrice ? r.lastCostPrice.toLocaleString() : "—"}</td>
                      <td className="py-2 px-3">{r.lastSupplierName ? <span className="inline-flex items-center gap-1"><Factory className="h-3 w-3" />{r.lastSupplierName}</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 px-3">{r.pendingOrderIds && r.pendingOrderIds.length > 0 ? <span className="text-amber-600 text-[10px] font-bold">⚠ في طلب قائم</span> : <span className="text-green-600 text-[10px]">✓</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setShowConfirm(false); setEditQty({}); }}>إلغاء</Button>
              <Button size="sm" disabled={converting} onClick={async () => {
                if (refillable.length === 0) return;
                setConverting(true);
                try {
                  const uniqueClients = [...new Set(refillable.map(i => i.clientId))];
                  const clientId = uniqueClients[0];
                  const clientName = refillable[0].client;
                  const today = new Date().toISOString().slice(0, 10);
                  const items = refillable.map(item => ({
                    materialCode: item.code,
                    name: item.material,
                    quantity: editQty[item.id] ?? item.suggestedQty,
                    sellingPrice: 0,
                    costPrice: item.lastCostPrice || 0,
                    imageUrl: item.imageUrl || "",
                    unit: item.unit,
                    supplierId: item.lastSupplierId || "",
                  }));
                  const totalCost = items.reduce((s, i) => s + i.costPrice * i.quantity, 0);
                  const order = await api.post("/orders", {
                    id: `ORD-${Date.now()}`,
                    clientId,
                    client: clientName,
                    date: today,
                    status: "Draft",
                    source: "Refill",
                    orderType: "client",
                    totalSelling: "0",
                    totalCost: String(totalCost),
                    splitMode: "equal",
                    items,
                  });
                  toast.success(`تم إنشاء الطلب ${order.id} بنجاح`);
                  setShowConfirm(false);
                  setEditQty({});
                  navigate(`/orders/${order.id}`);
                } catch (e: any) {
                  toast.error("خطأ في إنشاء الطلب: " + (e.message || ""));
                } finally {
                  setConverting(false);
                }
              }}>
                {converting ? <Loader2 className="h-3.5 w-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5" /> : <ShoppingCart className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />}
                تأكيد وإنشاء الطلب
              </Button>
            </div>
          </div>
        );
      })()}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{filtered.length} / {refillItems.length} {t.itemsCount}</span>
        {activePriorities.size > 0 && (
          <span className="text-xs">— {[...activePriorities].map(p => priorityLabel(p)).join(", ")}</span>
        )}
      </div>

      <div className="stat-card overflow-x-auto">
        {refillItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            لا توجد بيانات مخزون عملاء. أضف دفعات من صفحة <span className="text-primary cursor-pointer" onClick={() => navigate("/inventory")}>المخزون</span>.
          </div>
        ) : Object.entries(groupedData).map(([groupKey, items]) => {
          const groupCritical = items.filter(i => i.priority === "Critical").length;
          const groupUrgent = items.filter(i => i.priority === "Urgent").length;
          return (
            <div key={groupKey} className="mb-6">
              <div className="flex items-center gap-2 mb-3 p-3 bg-muted/30 rounded-lg">
                {groupBy === "client" ? <Users className="h-4 w-4" /> : <Package2 className="h-4 w-4" />}
                <h3 className="font-semibold text-sm">{groupKey}</h3>
                <span className="text-xs text-muted-foreground">({items.length} {t.itemsCount})</span>
                {groupCritical > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-3 w-3" /> {groupCritical} {t.critical}
                  </span>
                )}
                {groupUrgent > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/10 text-warning">
                    <TrendingDown className="h-3 w-3" /> {groupUrgent} {t.urgent}
                  </span>
                )}
                <div className="flex-1" />
                {items.some(r => r.suggestedQty > 0) && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleSelectGroup(items)}>
                    {items.filter(r => r.suggestedQty > 0).every(r => selected.has(r.id)) ? "إلغاء تحديد الكل" : "تحديد الكل"}
                  </Button>
                )}
              </div>

              <table className="w-full text-sm mb-6" style={{ minWidth: "1000px" }}>
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 px-3 w-10"><input type="checkbox" className="rounded" onChange={(e) => e.target.checked ? selectAllNeedRefill() : setSelected(new Set())} /></th>
                    <th className="py-3 px-3 min-w-[60px] w-16"></th>
                    {groupBy === "material" && <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>}
                    {groupBy === "client" && <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>}
                    <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">الطلب</th>
                    <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.currentStock}</th>
                    <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.avgPerWeek}</th>
                    <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.coverage}</th>
                    <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.reorderPoint}</th>
                    <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.suggestedQty}</th>
                    <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">آخر مورد</th>
                    <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">آخر سعر</th>
                    <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">آخر توريد</th>
                    <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.priority}</th>
                    <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">الجرد</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${selected.has(r.id) ? "bg-primary/5" : ""} ${r.fromAudit ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
                      <td className="py-3 px-3">{r.suggestedQty > 0 && <input type="checkbox" className="rounded" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />}</td>
                      <td className="py-2 px-3 min-w-[60px]">
                        {r.imageUrl ? (
                          <img src={r.imageUrl} alt={r.material} className="h-12 w-12 rounded-lg object-cover bg-white border border-border shadow-sm p-0.5 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center border border-border shrink-0"><Package className="h-5 w-5 text-muted-foreground" /></div>
                        )}
                      </td>
                      {groupBy === "material" && (
                        <td className="py-3 px-3 font-medium hover:text-primary cursor-pointer" onClick={() => navigate(`/clients/${r.clientId}`)}>
                          {r.client}
                          {r.fromAudit && <span className="ms-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">جرد</span>}
                        </td>
                      )}
                      {groupBy === "client" && (
                        <td className="py-3 px-3 hover:text-primary cursor-pointer" onClick={() => navigate("/materials")}>
                          {r.material} <span className="text-muted-foreground text-xs">({r.unit})</span>
                          {r.fromAudit && <span className="ms-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">جرد</span>}
                        </td>
                      )}
                      <td className="py-3 px-3">
                        {r.sourceOrder ? (
                          <button className="font-mono text-[11px] text-primary hover:text-primary/80 hover:underline bg-primary/5 px-1.5 py-0.5 rounded" onClick={() => navigate(`/orders/${r.sourceOrder}`)}>{r.sourceOrder}</button>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-3 text-end font-medium">{r.currentStock}</td>
                      <td className="py-3 px-3 text-end text-muted-foreground">{r.avgWeeklyUsage > 0 ? r.avgWeeklyUsage : "—"}</td>
                      <td className="py-3 px-3 text-end">
                        {r.avgWeeklyUsage > 0 ? (
                          <span className={r.coverageWeeks < 2 ? "text-destructive font-medium" : r.coverageWeeks < 4 ? "text-warning" : "text-muted-foreground"}>
                            {r.coverageWeeks.toFixed(1)} {t.weeks}
                          </span>
                        ) : r.fromAudit ? <span className="text-amber-600 text-xs">من الجرد</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-3 text-end text-muted-foreground">{r.avgWeeklyUsage > 0 ? r.reorderPoint : "—"}</td>
                      <td className="py-3 px-3 text-end font-semibold">
                        {r.suggestedQty > 0
                          ? <span className={r.fromAudit ? "text-amber-700 dark:text-amber-400" : ""}>{r.suggestedQty}</span>
                          : "—"}
                      </td>
                      <td className="py-3 px-3">
                        {r.lastSupplierName ? (
                          <button className="inline-flex items-center gap-1 text-xs text-primary hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/suppliers/${r.lastSupplierId}`); }}>
                            <Factory className="h-3 w-3" />{r.lastSupplierName}
                          </button>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="py-3 px-3 text-end text-xs text-muted-foreground">{r.lastCostPrice ? r.lastCostPrice.toLocaleString() : "—"}</td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">
                        {r.lastOrderDate || "—"}
                        {r.pendingOrderIds && r.pendingOrderIds.length > 0 && (
                          <span className="ms-1 inline-flex items-center gap-0.5 text-[10px] text-amber-600 font-bold" title={`موجودة في ${r.pendingOrderIds.join(", ")}`}>
                            <AlertTriangle className="h-3 w-3" />طلب قائم
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityStyles[r.priority]}`}>
                          {priorityLabel(r.priority)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {r.auditId ? (
                          <button
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity ${r.auditStatus === "Completed" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : r.auditStatus === "Discrepancy" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"}`}
                            onClick={() => navigate("/audits")}
                          >
                            <ClipboardCheck className="h-3 w-3" />
                            {r.auditStatus === "Completed" ? "مكتمل" : r.auditStatus === "Discrepancy" ? "تباين" : r.auditStatus === "In Progress" ? "جاري" : "مجدول"}
                          </button>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        {filtered.length === 0 && refillItems.length > 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">{t.noResults}</div>
        )}
      </div>
    </div>
  );
}
