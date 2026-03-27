import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Users, List, ChevronDown, ChevronUp, Download, ShoppingCart, Plus, Minus, Loader2, Pencil, Trash2, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { logAudit } from "@/lib/auditLog";

type InventoryLot = {
  id: string;
  clientId: string;
  clientName: string;
  material: string;
  code: string;
  unit: string;
  delivered: number;
  remaining: number;
  sellingPrice: number;
  storeCost: number;
  deliveryDate: string;
  expiry: string;
  sourceOrder: string;
  status: string;
  avgWeeklyUsage: number;
  leadTimeWeeks: number;
  safetyStock: number;
  imageUrl?: string;
};

export default function InventoryPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createOrderFromInventory } = useWorkflow();
  const qc = useQueryClient();
  const urlSourceOrder = searchParams.get("sourceOrder") || "";

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [detailItem, setDetailItem] = useState<InventoryLot | null>(null);
  const [editItem, setEditItem] = useState<InventoryLot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryLot | null>(null);
  const [viewMode, setViewMode] = useState<"client" | "item">("client");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  // Convert to order dialog state
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertClientName, setConvertClientName] = useState("");
  const [selectedLots, setSelectedLots] = useState<Record<string, number>>({});

  // Add lot dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newLot, setNewLot] = useState<Partial<InventoryLot>>({});
  const [clientOrders, setClientOrders] = useState<any[]>([]);
  const [clientOrderLines, setClientOrderLines] = useState<any[]>([]);

  const fetchClientOrderMaterials = async (clientId: string) => {
    try {
      const orders = await api.get<any[]>("/orders");
      const clientOrd = orders.filter((o: any) => o.clientId === clientId || o.client_id === clientId);
      setClientOrders(clientOrd);
      const allLines: any[] = [];
      for (const ord of clientOrd) {
        try {
          const lines = await api.get<any[]>(`/orders/${ord.id}/lines`);
          lines.forEach((ln: any) => allLines.push({ ...ln, orderId: ord.id, orderDate: ord.date || ord.created_at }));
        } catch {}
      }
      setClientOrderLines(allLines);
    } catch { setClientOrders([]); setClientOrderLines([]); }
  };

  const { data: rawLots = [], isLoading } = useQuery<InventoryLot[]>({
    queryKey: ["/api/client-inventory"],
    queryFn: () => api.get<InventoryLot[]>("/client-inventory"),
  });

  const { data: clients = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/clients"],
    queryFn: () => api.get<{ id: string; name: string }[]>("/clients"),
  });

  const lots: InventoryLot[] = rawLots.map(l => ({
    ...l,
    delivered: Number(l.delivered),
    remaining: Number(l.remaining),
    sellingPrice: Number(l.sellingPrice),
    storeCost: Number(l.storeCost),
    avgWeeklyUsage: Number(l.avgWeeklyUsage),
    leadTimeWeeks: Number(l.leadTimeWeeks),
    safetyStock: Number(l.safetyStock),
  }));

  const addMutation = useMutation({
    mutationFn: async (data: Partial<InventoryLot>) => {
      const id = `LOT-${Date.now().toString(36).toUpperCase()}`;
      const saved = await api.post<InventoryLot>("/client-inventory", { ...data, id });
      await logAudit({ entity: "client-inventory", entityId: id, entityName: `${data.material} — ${data.clientName}`, action: "create", snapshot: { ...data, id }, endpoint: "/client-inventory" });
      return saved;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/client-inventory"] }); setAddDialogOpen(false); setNewLot({}); toast.success("تم إضافة الدفعة"); },
    onError: () => toast.error("فشل إضافة الدفعة"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InventoryLot> }) => {
      const saved = await api.patch<InventoryLot>(`/client-inventory/${id}`, data);
      await logAudit({ entity: "client-inventory", entityId: id, entityName: `${data.material} — ${data.clientName}`, action: "update", snapshot: data as any, endpoint: "/client-inventory" });
      return saved;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/client-inventory"] }); setEditItem(null); toast.success("تم تحديث الدفعة"); },
    onError: () => toast.error("فشل التحديث"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (lot: InventoryLot) => {
      await api.delete(`/client-inventory/${lot.id}`);
      await logAudit({ entity: "client-inventory", entityId: lot.id, entityName: `${lot.material} — ${lot.clientName}`, action: "delete", snapshot: lot as any, endpoint: "/client-inventory", idField: "id" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/client-inventory"] }); setDeleteTarget(null); toast.success("تم حذف الدفعة"); },
    onError: () => toast.error("فشل الحذف"),
  });

  const clientNames = [...new Set(lots.map(l => l.clientName))];

  const filtered = lots.filter((l) => {
    const matchSearch = !search || l.material.toLowerCase().includes(search.toLowerCase()) || l.clientName.toLowerCase().includes(search.toLowerCase()) || l.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || l.status === filters.status;
    const matchClient = !filters.client || filters.client === "all" || l.clientName === filters.client;
    const matchOrder = !urlSourceOrder || l.sourceOrder === urlSourceOrder;
    return matchSearch && matchStatus && matchClient && matchOrder;
  });

  const clientGroups = useMemo(() => {
    const groups: Record<string, { clientId: string; items: InventoryLot[] }> = {};
    filtered.forEach(item => {
      if (!groups[item.clientName]) groups[item.clientName] = { clientId: item.clientId, items: [] };
      groups[item.clientName].items.push(item);
    });
    return groups;
  }, [filtered]);

  const lowStockCount = lots.filter(l => l.status === "Low Stock").length;
  const expiredCount = lots.filter(l => l.status === "Expired").length;
  const depletedCount = lots.filter(l => l.status === "Depleted").length;
  const nearExpiryCount = lots.filter(l => {
    if (!l.expiry) return false;
    const days = (new Date(l.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days > 0 && days <= 30 && l.status !== "Depleted" && l.status !== "Expired";
  }).length;

  const toggleClient = (cn: string) => setExpandedClient(expandedClient === cn ? null : cn);

  const getClientItems = (clientName: string) => lots.filter(l => l.clientName === clientName && l.status !== "Expired");

  const openConvertDialog = (clientName: string) => {
    const items = getClientItems(clientName);
    const preSelected: Record<string, number> = {};
    items.forEach(item => {
      if (item.status === "Depleted" || item.status === "Low Stock") preSelected[item.id] = item.delivered;
    });
    setSelectedLots(preSelected);
    setConvertClientName(clientName);
    setConvertDialogOpen(true);
  };

  const toggleLotSelection = (lotId: string, defaultQuantity: number) => {
    setSelectedLots(prev => { const n = { ...prev }; if (n[lotId]) delete n[lotId]; else n[lotId] = defaultQuantity; return n; });
  };

  const adjustQuantity = (lotId: string, delta: number) => {
    setSelectedLots(prev => ({ ...prev, [lotId]: Math.max(1, (prev[lotId] || 1) + delta) }));
  };

  const handleCreateOrder = () => {
    const selectedItems = lots.filter(l => selectedLots[l.id]);
    if (selectedItems.length === 0) { toast.error(t.selectAtLeastOneMaterial); return; }
    const orderItems = selectedItems.map(item => ({ id: item.id, name: item.material, quantity: selectedLots[item.id], unitPrice: item.storeCost }));
    const clientItem = selectedItems[0];
    const newOrder = createOrderFromInventory(clientItem.clientId, convertClientName, orderItems);
    setConvertDialogOpen(false);
    setSelectedLots({});
    toast.success(`${t.orderCreatedSuccess} ${newOrder.id}`, { action: { label: t.viewOrdersLabel, onClick: () => navigate("/orders") } });
  };

  const computedStatus = (lot: InventoryLot) => {
    if (lot.expiry) {
      const days = (new Date(lot.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (days < 0) return "Expired";
    }
    if (lot.remaining <= 0) return "Depleted";
    if (lot.avgWeeklyUsage > 0 && lot.remaining < lot.safetyStock * 2) return "Low Stock";
    return lot.status;
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {urlSourceOrder && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm">
          <Package className="h-4 w-4 text-primary shrink-0" />
          <span className="text-primary font-medium">جرد الطلب: <button className="font-mono hover:underline" onClick={() => navigate(`/orders/${urlSourceOrder}`)}>{urlSourceOrder}</button></span>
          <button className="mr-auto text-primary/70 hover:text-primary text-xs" onClick={() => navigate("/inventory")}>عرض الكل</button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">{t.inventoryTitle}</h1>
          <p className="page-description">{filtered.length} {t.batchCount} {t.acrossClients} {clientNames.length} {t.clientsLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> إضافة دفعة
          </Button>
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            <Button variant={viewMode === "client" ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1.5" onClick={() => setViewMode("client")}>
              <Users className="h-3.5 w-3.5" />{t.viewByClient}
            </Button>
            <Button variant={viewMode === "item" ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1.5" onClick={() => setViewMode("item")}>
              <List className="h-3.5 w-3.5" />{t.viewByItem}
            </Button>
          </div>
        </div>
      </div>

      {(lowStockCount > 0 || expiredCount > 0 || depletedCount > 0 || nearExpiryCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {lowStockCount > 0 && <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning text-sm cursor-pointer" onClick={() => setFilters({ ...filters, status: "Low Stock" })}><AlertTriangle className="h-4 w-4" />{lowStockCount} {t.lowStockItems}</div>}
          {depletedCount > 0 && <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm cursor-pointer" onClick={() => setFilters({ ...filters, status: "Depleted" })}><AlertTriangle className="h-4 w-4" />{depletedCount} {t.materialsDepleted}</div>}
          {expiredCount > 0 && <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm cursor-pointer" onClick={() => setFilters({ ...filters, status: "Expired" })}><AlertTriangle className="h-4 w-4" />{expiredCount} {t.expiredItems}</div>}
          {nearExpiryCount > 0 && <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning text-sm"><AlertTriangle className="h-4 w-4" />{nearExpiryCount} {t.expiringIn30}</div>}
        </div>
      )}

      <DataToolbar
        searchPlaceholder={t.searchInventory}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: t.status, value: "status", options: [
            { label: t.inStock, value: "In Stock" }, { label: t.lowStock, value: "Low Stock" },
            { label: t.depleted, value: "Depleted" }, { label: t.expired, value: "Expired" },
          ]},
          { label: t.client, value: "client", options: clientNames.map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("inventory", [t.batchNumber, t.client, t.material, t.code, t.unit, t.deliveredQty, t.remainingQty, t.sellingPrice, t.storeCost, t.deliveryDate, t.expiryDate, t.sourceOrder, t.status], filtered.map(l => [l.id, l.clientName, l.material, l.code, l.unit, l.delivered, l.remaining, l.sellingPrice, l.storeCost, l.deliveryDate, l.expiry, l.sourceOrder, l.status]))}
      />

      {viewMode === "client" ? (
        <div className="space-y-3">
          {Object.entries(clientGroups).map(([clientName, group]) => {
            const isExpanded = expandedClient === clientName;
            const totalRemaining = group.items.reduce((s, l) => s + l.remaining * l.sellingPrice, 0);
            const hasWarning = group.items.some(l => l.status === "Low Stock" || l.status === "Expired" || l.status === "Depleted");
            const canConvert = getClientItems(clientName).length > 0;
            return (
              <div key={clientName} className="stat-card overflow-hidden">
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleClient(clientName)}>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">{clientName.charAt(0)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm cursor-pointer hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${group.clientId}`); }}>{clientName}</h3>
                        {hasWarning && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{group.items.length} {t.materialsCount} · {t.remainingValue}: {totalRemaining.toLocaleString()} {t.currency}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canConvert && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={(e) => { e.stopPropagation(); openConvertDialog(clientName); }}>
                        <ShoppingCart className="h-3.5 w-3.5" />{t.convertToOrderBtn}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); exportToCsv(`inventory_${clientName}`, ["code", "material", "unit", "remaining"], group.items.map(l => [l.code, l.material, l.unit, l.remaining])); }}>
                      <Download className="h-3.5 w-3.5" />{t.export || "Export"}
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">{[...new Set(group.items.map(l => l.status))].map(s => <StatusBadge key={s} status={s} />)}</div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
                {isExpanded && (() => {
                  // Group items by sourceOrder
                  const orderGroups: Record<string, InventoryLot[]> = {};
                  group.items.forEach(lot => {
                    const key = lot.sourceOrder || "—";
                    if (!orderGroups[key]) orderGroups[key] = [];
                    orderGroups[key].push(lot);
                  });
                  return (
                    <div className="border-t border-border divide-y divide-border/50">
                      {Object.entries(orderGroups).map(([orderId, orderItems]) => {
                        const orderDate = orderItems[0]?.deliveryDate || "";
                        const orderTotal = orderItems.reduce((s, l) => s + l.remaining * l.sellingPrice, 0);
                        return (
                          <div key={orderId}>
                            <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/20">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">{t.sourceOrder || "الطلب"}:</span>
                                <button
                                  className="font-mono text-sm font-bold text-primary hover:underline"
                                  onClick={() => navigate(`/orders/${orderId}`)}
                                >{orderId}</button>
                              </div>
                              {orderDate && <span className="text-xs text-muted-foreground">{t.deliveryDate || "تاريخ التسليم"}: {orderDate}</span>}
                              <span className="text-xs text-muted-foreground">{orderItems.length} {t.materialsCount || "مادة"}</span>
                              <span className="text-xs font-medium text-primary mr-auto">{t.remainingValue || "قيمة المتبقي"}: {orderTotal.toLocaleString()} {t.currency}</span>
                            </div>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border/40 bg-muted/10">
                                  <th className="py-2 px-3 w-16"></th>
                                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>
                                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.code || "الكود"}</th>
                                  <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.deliveredQty}</th>
                                  <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.remainingQty}</th>
                                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.unit}</th>
                                  <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.sellingPrice}</th>
                                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.expiryDate}</th>
                                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
                                  <th className="py-2 px-3 w-16"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {orderItems.map(lot => {
                                  const daysToExpiry = lot.expiry ? Math.ceil((new Date(lot.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                                  const isNearExpiry = daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 30;
                                  return (
                                    <tr key={lot.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer group" onClick={() => setDetailItem(lot)}>
                                      <td className="py-2 px-3">
                                        {lot.imageUrl ? (
                                          <img src={lot.imageUrl} alt={lot.material} className="h-12 w-12 rounded-lg object-cover border border-border shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        ) : (
                                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center border border-border"><Package className="h-5 w-5 text-muted-foreground" /></div>
                                        )}
                                      </td>
                                      <td className="py-2 px-3 font-medium">{lot.material}</td>
                                      <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{lot.code}</td>
                                      <td className="py-2 px-3 text-end">{lot.delivered}</td>
                                      <td className="py-2 px-3 text-end font-medium">{lot.remaining}</td>
                                      <td className="py-2 px-3 text-muted-foreground">{lot.unit}</td>
                                      <td className="py-2 px-3 text-end">{lot.sellingPrice.toLocaleString()} {t.currency}</td>
                                      <td className="py-2 px-3 text-xs">
                                        <span className={isNearExpiry ? "text-warning font-medium" : "text-muted-foreground"}>
                                          {lot.expiry || "—"}{isNearExpiry && ` (${daysToExpiry} ${t.daysRemaining})`}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3"><StatusBadge status={lot.status} /></td>
                                      <td className="py-2 px-3 text-end" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditItem(lot)}><Pencil className="h-3.5 w-3.5" /></Button>
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(lot)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          })}
          {Object.keys(clientGroups).length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">{t.noResults}</div>}
        </div>
      ) : (
        <div className="stat-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 px-3 w-16"></th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.batchNumber}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.deliveredQty}</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.remainingQty}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.unit}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.deliveryDate}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.expiryDate}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.sourceOrder}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
                <th className="py-3 px-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lot) => {
                const daysToExpiry = lot.expiry ? Math.ceil((new Date(lot.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                const isNearExpiry = daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 30;
                return (
                  <tr key={lot.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer group" onClick={() => setDetailItem(lot)}>
                    <td className="py-3 px-3">
                      {lot.imageUrl ? (
                        <img src={lot.imageUrl} alt={lot.material} className="h-12 w-12 rounded-lg object-cover border border-border shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center border border-border"><Package className="h-5 w-5 text-muted-foreground" /></div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{lot.id}</td>
                    <td className="py-3 px-3 font-medium hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${lot.clientId}`); }}>{lot.clientName}</td>
                    <td className="py-3 px-3 hover:text-primary">{lot.material}</td>
                    <td className="py-3 px-3 text-end">{lot.delivered}</td>
                    <td className="py-3 px-3 text-end font-medium">{lot.remaining}</td>
                    <td className="py-3 px-3 text-muted-foreground">{lot.unit}</td>
                    <td className="py-3 px-3 text-muted-foreground text-xs">{lot.deliveryDate}</td>
                    <td className="py-3 px-3 text-xs">
                      <span className={isNearExpiry ? "text-warning font-medium" : "text-muted-foreground"}>
                        {lot.expiry}{isNearExpiry && ` (${daysToExpiry} ${t.daysRemaining})`}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-muted-foreground hover:text-primary cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/orders/${lot.sourceOrder}`); }}>{lot.sourceOrder}</td>
                    <td className="py-3 px-3"><StatusBadge status={lot.status} /></td>
                    <td className="py-3 px-3 text-end" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditItem(lot)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(lot)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">{t.noResults}</div>}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detailItem?.material}</DialogTitle>
            <DialogDescription>{t.batchDetails} {detailItem?.id}</DialogDescription>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">{t.clientColon}</span> {detailItem.clientName}</div>
                <div><span className="text-muted-foreground">{t.codeColon}</span> {detailItem.code}</div>
                <div><span className="text-muted-foreground">{t.unitColon}</span> {detailItem.unit}</div>
                <div><span className="text-muted-foreground">{t.deliveredColon}</span> {detailItem.delivered}</div>
                <div><span className="text-muted-foreground">{t.remainingColon}</span> {detailItem.remaining}</div>
                <div><span className="text-muted-foreground">{t.sellingPriceColon}</span> {detailItem.sellingPrice} {t.currency}</div>
                <div><span className="text-muted-foreground">{t.storeCostColon}</span> {detailItem.storeCost} {t.currency}</div>
                <div><span className="text-muted-foreground">{t.deliveryDateColon}</span> {detailItem.deliveryDate}</div>
                <div><span className="text-muted-foreground">{t.expiryDateColon}</span> {detailItem.expiry}</div>
                <div><span className="text-muted-foreground">{t.sourceOrderColon}</span> {detailItem.sourceOrder}</div>
                <div><span className="text-muted-foreground">متوسط أسبوعي:</span> {detailItem.avgWeeklyUsage} {detailItem.unit}/أسبوع</div>
              </div>
              <div className="pt-2"><StatusBadge status={detailItem.status} /></div>
              <DialogFooter className="gap-2">
                <Button size="sm" variant="destructive" onClick={() => { setDetailItem(null); setDeleteTarget(detailItem); }}>
                  <Trash2 className="h-3.5 w-3.5 ml-1.5" /> حذف
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setDetailItem(null); setEditItem(detailItem); }}>
                  <Pencil className="h-3.5 w-3.5 ml-1.5" /> تعديل
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل الدفعة — {editItem?.id}</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">الكمية المتبقية</Label><Input className="h-9 mt-1" type="number" value={editItem.remaining} onChange={e => setEditItem({ ...editItem, remaining: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">الحالة</Label>
                  <Select value={editItem.status} onValueChange={v => setEditItem({ ...editItem, status: v })}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="In Stock">In Stock</SelectItem>
                      <SelectItem value="Low Stock">Low Stock</SelectItem>
                      <SelectItem value="Depleted">Depleted</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">سعر البيع</Label><Input className="h-9 mt-1" type="number" value={editItem.sellingPrice} onChange={e => setEditItem({ ...editItem, sellingPrice: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">التكلفة</Label><Input className="h-9 mt-1" type="number" value={editItem.storeCost} onChange={e => setEditItem({ ...editItem, storeCost: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">تاريخ الانتهاء</Label><Input className="h-9 mt-1" type="date" value={editItem.expiry} onChange={e => setEditItem({ ...editItem, expiry: e.target.value })} /></div>
                <div><Label className="text-xs">متوسط الاستخدام الأسبوعي</Label><Input className="h-9 mt-1" type="number" value={editItem.avgWeeklyUsage} onChange={e => setEditItem({ ...editItem, avgWeeklyUsage: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">مخزون الأمان</Label><Input className="h-9 mt-1" type="number" value={editItem.safetyStock} onChange={e => setEditItem({ ...editItem, safetyStock: Number(e.target.value) })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setEditItem(null)}>إلغاء</Button>
                <Button size="sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: editItem.id, data: editItem })}>
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add New Lot Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) { setNewLot({}); setClientOrders([]); setClientOrderLines([]); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>إضافة دفعة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">العميل</Label>
              <Select value={newLot.clientId || ""} onValueChange={v => {
                const cl = clients.find(c => c.id === v);
                setNewLot({ ...newLot, clientId: v, clientName: cl?.name || "" });
                fetchClientOrderMaterials(v);
              }}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="اختر عميل" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {newLot.clientId && clientOrderLines.length > 0 && (
              <div>
                <Label className="text-xs mb-2 block">اختر مادة من الطلبات</Label>
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {clientOrderLines.map((ln: any, idx: number) => (
                    <button
                      key={`${ln.orderId}-${ln.id}-${idx}`}
                      type="button"
                      className={`w-full flex items-center gap-3 px-3 py-2 text-start hover:bg-primary/5 transition-colors text-sm ${newLot.material === (ln.materialName || ln.material_name) && newLot.sourceOrder === ln.orderId ? "bg-primary/10 border-r-2 border-primary" : ""}`}
                      onClick={() => setNewLot({
                        ...newLot,
                        material: ln.materialName || ln.material_name || "",
                        code: ln.materialCode || ln.material_code || "",
                        unit: ln.unit || "unit",
                        sellingPrice: Number(ln.sellingPrice || ln.selling_price) || 0,
                        storeCost: Number(ln.costPrice || ln.cost_price) || 0,
                        sourceOrder: ln.orderId,
                        delivered: Number(ln.quantity) || 0,
                        remaining: Number(ln.quantity) || 0,
                      })}
                    >
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{ln.materialName || ln.material_name}</div>
                        <div className="text-xs text-muted-foreground">{ln.materialCode || ln.material_code} · {ln.unit} · الكمية: {ln.quantity}</div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="font-mono text-xs font-bold text-primary">{ln.orderId}</div>
                        {ln.orderDate && <div className="text-[10px] text-muted-foreground">{ln.orderDate.split("T")[0]}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {newLot.clientId && clientOrderLines.length === 0 && clientOrders.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-2">لا توجد طلبات لهذا العميل — يمكنك الإدخال يدوياً</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">المادة</Label><Input className="h-9 mt-1" value={newLot.material || ""} onChange={e => setNewLot({ ...newLot, material: e.target.value })} /></div>
              <div className="flex items-end gap-2">
                <div className="flex-1"><Label className="text-xs">رقم الطلب</Label><Input className="h-9 mt-1" placeholder="ORD-001" value={newLot.sourceOrder || ""} onChange={e => setNewLot({ ...newLot, sourceOrder: e.target.value })} /></div>
                {newLot.sourceOrder && (
                  <button className="h-9 px-2 text-xs text-primary hover:underline shrink-0" onClick={() => navigate(`/orders/${newLot.sourceOrder}`)}>عرض الطلب</button>
                )}
              </div>
              <div><Label className="text-xs">الكود</Label><Input className="h-9 mt-1" placeholder="MAT-001" value={newLot.code || ""} onChange={e => setNewLot({ ...newLot, code: e.target.value })} /></div>
              <div><Label className="text-xs">الوحدة</Label><Input className="h-9 mt-1" value={newLot.unit || ""} onChange={e => setNewLot({ ...newLot, unit: e.target.value })} /></div>
              <div><Label className="text-xs">الكمية المسلمة</Label><Input className="h-9 mt-1" type="number" value={newLot.delivered || ""} onChange={e => setNewLot({ ...newLot, delivered: Number(e.target.value), remaining: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">سعر البيع</Label><Input className="h-9 mt-1" type="number" value={newLot.sellingPrice || ""} onChange={e => setNewLot({ ...newLot, sellingPrice: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">التكلفة</Label><Input className="h-9 mt-1" type="number" value={newLot.storeCost || ""} onChange={e => setNewLot({ ...newLot, storeCost: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">تاريخ التسليم</Label><Input className="h-9 mt-1" type="date" value={newLot.deliveryDate || ""} onChange={e => setNewLot({ ...newLot, deliveryDate: e.target.value })} /></div>
              <div><Label className="text-xs">تاريخ الانتهاء</Label><Input className="h-9 mt-1" type="date" value={newLot.expiry || ""} onChange={e => setNewLot({ ...newLot, expiry: e.target.value })} /></div>
              <div><Label className="text-xs">متوسط أسبوعي</Label><Input className="h-9 mt-1" type="number" value={newLot.avgWeeklyUsage || ""} onChange={e => setNewLot({ ...newLot, avgWeeklyUsage: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(false)}>إلغاء</Button>
            <Button size="sm" disabled={addMutation.isPending} onClick={() => addMutation.mutate({ ...newLot, status: "In Stock" })}>
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل تريد حذف الدفعة <strong>{deleteTarget?.material}</strong> للعميل <strong>{deleteTarget?.clientName}</strong>؟ لا يمكن التراجع عن هذه العملية.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>إلغاء</Button>
            <Button variant="destructive" size="sm" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-3.5 w-3.5 ml-1.5" /> حذف</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Order Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.createNewOrderTitle} — {convertClientName}</DialogTitle>
            <DialogDescription>{t.selectMaterialsForRefill}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {getClientItems(convertClientName).map(item => {
              const isChecked = !!selectedLots[item.id];
              return (
                <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isChecked ? "border-primary bg-primary/5" : "border-border"}`}>
                  <Checkbox checked={isChecked} onCheckedChange={() => toggleLotSelection(item.id, item.delivered)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.material}</div>
                    <div className="text-xs text-muted-foreground">{item.code} · {t.remaining}: {item.remaining} {item.unit}</div>
                  </div>
                  <StatusBadge status={item.status} />
                  {isChecked && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => adjustQuantity(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-8 text-center text-sm font-medium">{selectedLots[item.id]}</span>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => adjustQuantity(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>{t.cancel}</Button>
            <Button onClick={handleCreateOrder} disabled={Object.keys(selectedLots).length === 0}>
              <ShoppingCart className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.createOrderBtn} ({Object.keys(selectedLots).length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
