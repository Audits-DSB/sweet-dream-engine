import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Users, List, ChevronDown, ChevronUp, Download, ShoppingCart, Plus, Minus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const mockInventory = [
  { id: "LOT-001", client: "عيادة د. أحمد", clientId: "C001", material: "حشو كمبوزيت ضوئي", code: "MAT-001", unit: "عبوة", delivered: 50, remaining: 45, sellingPrice: 1200, storeCost: 800, deliveryDate: "2025-02-20", expiry: "2025-06-15", sourceOrder: "ORD-042", status: "In Stock", auditStatus: "Pending" },
  { id: "LOT-002", client: "عيادة د. أحمد", clientId: "C001", material: "إبر تخدير", code: "MAT-002", unit: "علبة", delivered: 20, remaining: 8, sellingPrice: 950, storeCost: 600, deliveryDate: "2025-02-20", expiry: "2025-04-20", sourceOrder: "ORD-042", status: "Low Stock", auditStatus: "Pending" },
  { id: "LOT-003", client: "عيادة د. أحمد", clientId: "C001", material: "مادة طبع سيليكون", code: "MAT-003", unit: "عبوة", delivered: 40, remaining: 30, sellingPrice: 450, storeCost: 280, deliveryDate: "2025-01-15", expiry: "2025-12-01", sourceOrder: "ORD-038", status: "In Stock", auditStatus: "Pending" },
  { id: "LOT-004", client: "عيادة د. أحمد", clientId: "C001", material: "قفازات لاتكس", code: "MAT-005", unit: "كرتونة", delivered: 10, remaining: 2, sellingPrice: 400, storeCost: 280, deliveryDate: "2025-01-15", expiry: "2025-03-25", sourceOrder: "ORD-038", status: "Low Stock", auditStatus: "Pending" },
  { id: "LOT-005", client: "مركز نور لطب الأسنان", clientId: "C002", material: "حشو كمبوزيت ضوئي", code: "MAT-001", unit: "عبوة", delivered: 80, remaining: 65, sellingPrice: 1200, storeCost: 800, deliveryDate: "2025-03-01", expiry: "2025-07-20", sourceOrder: "ORD-045", status: "In Stock", auditStatus: "Pending" },
  { id: "LOT-006", client: "مركز نور لطب الأسنان", clientId: "C002", material: "مبيض أسنان", code: "MAT-008", unit: "عبوة", delivered: 5, remaining: 0.5, sellingPrice: 2800, storeCost: 1800, deliveryDate: "2025-02-10", expiry: "2025-04-01", sourceOrder: "ORD-040", status: "Low Stock", auditStatus: "Pending" },
  { id: "LOT-007", client: "عيادة جرين فالي", clientId: "C003", material: "إبر تخدير", code: "MAT-002", unit: "علبة", delivered: 30, remaining: 22, sellingPrice: 950, storeCost: 600, deliveryDate: "2025-02-25", expiry: "2025-05-30", sourceOrder: "ORD-043", status: "In Stock", auditStatus: "Pending" },
  { id: "LOT-008", client: "المركز الملكي للأسنان", clientId: "C004", material: "حشو كمبوزيت ضوئي", code: "MAT-001", unit: "عبوة", delivered: 100, remaining: 0, sellingPrice: 1200, storeCost: 800, deliveryDate: "2024-12-15", expiry: "2025-03-10", sourceOrder: "ORD-035", status: "Depleted", auditStatus: "Pending" },
  { id: "LOT-009", client: "المركز الملكي للأسنان", clientId: "C004", material: "فرز دوارة", code: "MAT-010", unit: "عبوة", delivered: 5, remaining: 4, sellingPrice: 2000, storeCost: 1300, deliveryDate: "2025-03-01", expiry: "2026-01-01", sourceOrder: "ORD-045", status: "In Stock", auditStatus: "Pending" },
  { id: "LOT-010", client: "عيادة بلو مون", clientId: "C006", material: "قفازات لاتكس", code: "MAT-005", unit: "كرتونة", delivered: 15, remaining: 12, sellingPrice: 400, storeCost: 280, deliveryDate: "2025-03-03", expiry: "2025-09-15", sourceOrder: "ORD-044", status: "In Stock", auditStatus: "Pending" },
  { id: "LOT-011", client: "مركز سبايس جاردن", clientId: "C007", material: "مادة تلميع", code: "MAT-012", unit: "عبوة", delivered: 8, remaining: 0, sellingPrice: 1500, storeCost: 950, deliveryDate: "2025-01-10", expiry: "2025-03-01", sourceOrder: "ORD-036", status: "Expired", auditStatus: "Pending" },
];

export default function InventoryPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { createOrderFromInventory } = useWorkflow();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [detailItem, setDetailItem] = useState<typeof mockInventory[0] | null>(null);
  const [viewMode, setViewMode] = useState<"client" | "item">("client");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [inventory, setInventory] = useState(mockInventory);
  
  // Convert to order dialog state
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertClient, setConvertClient] = useState("");
  const [selectedLots, setSelectedLots] = useState<Record<string, number>>({});

  const clients = [...new Set(mockInventory.map(i => i.client))];

  const filtered = inventory.filter((i) => {
    const matchSearch = !search || i.material.toLowerCase().includes(search.toLowerCase()) || i.client.toLowerCase().includes(search.toLowerCase()) || i.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || i.status === filters.status;
    const matchClient = !filters.client || filters.client === "all" || i.client === filters.client;
    return matchSearch && matchStatus && matchClient;
  });

  // Group by client
  const clientGroups = useMemo(() => {
    const groups: Record<string, { clientId: string; items: typeof mockInventory }> = {};
    filtered.forEach(item => {
      if (!groups[item.client]) {
        groups[item.client] = { clientId: item.clientId, items: [] };
      }
      groups[item.client].items.push(item);
    });
    return groups;
  }, [filtered]);

  const lowStockCount = inventory.filter(i => i.status === "Low Stock").length;
  const expiredCount = inventory.filter(i => i.status === "Expired").length;
  const depletedCount = inventory.filter(i => i.status === "Depleted").length;
  const nearExpiryCount = inventory.filter(i => {
    if (!i.expiry) return false;
    const days = (new Date(i.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days > 0 && days <= 30 && i.status !== "Depleted" && i.status !== "Expired";
  }).length;

  const toggleClient = (client: string) => {
    setExpandedClient(expandedClient === client ? null : client);
  };

  // Convert to order functions
  const getClientItemsToConvert = (clientName: string) => {
    return inventory.filter(item => 
      item.client === clientName && item.auditStatus === "Pending" && (item.status === "Depleted" || item.status === "Low Stock")
    );
  };

  const openConvertDialog = (clientName: string) => {
    const items = getClientItemsToConvert(clientName);
    const preSelected: Record<string, number> = {};
    items.forEach(item => {
      preSelected[item.id] = item.delivered;
    });
    setSelectedLots(preSelected);
    setConvertClient(clientName);
    setConvertDialogOpen(true);
  };

  const toggleLotSelection = (lotId: string, defaultQuantity: number) => {
    setSelectedLots(prev => {
      const newSelected = { ...prev };
      if (newSelected[lotId]) {
        delete newSelected[lotId];
      } else {
        newSelected[lotId] = defaultQuantity;
      }
      return newSelected;
    });
  };

  const adjustQuantity = (lotId: string, delta: number) => {
    setSelectedLots(prev => ({
      ...prev,
      [lotId]: Math.max(1, (prev[lotId] || 1) + delta)
    }));
  };

  const handleCreateOrder = () => {
    const selectedItems = inventory.filter(item => selectedLots[item.id]);
    
    if (selectedItems.length === 0) {
      toast.error("يرجى اختيار مادة واحدة على الأقل");
      return;
    }

    const orderItems = selectedItems.map(item => ({
      id: item.id,
      name: item.material,
      quantity: selectedLots[item.id],
      unitPrice: item.storeCost
    }));

    const clientItem = selectedItems[0];
    const newOrder = createOrderFromInventory(
      clientItem.clientId,
      convertClient,
      orderItems
    );

    // Update audit status to Complete for converted items
    setInventory(prev => prev.map(item => 
      selectedLots[item.id] ? { ...item, auditStatus: "Complete" } : item
    ));

    setConvertDialogOpen(false);
    setSelectedLots({});
    
    toast.success(`تم إنشاء الأوردر ${newOrder.id} وتحديث حالة الجرد`, {
      action: {
        label: "عرض الأوردرات",
        onClick: () => navigate("/orders")
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">{t.inventoryTitle}</h1>
          <p className="page-description">{inventory.length} {t.batchCount} {t.acrossClients} {clients.length} {t.clientsLabel}</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          <Button variant={viewMode === "client" ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1.5" onClick={() => setViewMode("client")}>
            <Users className="h-3.5 w-3.5" />{t.viewByClient}
          </Button>
          <Button variant={viewMode === "item" ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1.5" onClick={() => setViewMode("item")}>
            <List className="h-3.5 w-3.5" />{t.viewByItem}
          </Button>
        </div>
      </div>

      {(lowStockCount > 0 || expiredCount > 0 || depletedCount > 0 || nearExpiryCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {lowStockCount > 0 && <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning text-sm cursor-pointer" onClick={() => setFilters({ ...filters, status: "Low Stock" })}><AlertTriangle className="h-4 w-4" />{lowStockCount} {t.lowStockItems}</div>}
          {depletedCount > 0 && <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm cursor-pointer" onClick={() => setFilters({ ...filters, status: "Depleted" })}><AlertTriangle className="h-4 w-4" />{depletedCount} مادة نفذت</div>}
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
          { label: t.client, value: "client", options: clients.map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("inventory", [t.batchNumber, t.client, t.material, t.code, t.unit, t.deliveredQty, t.remainingQty, t.sellingPrice, t.storeCost, t.deliveryDate, t.expiryDate, t.sourceOrder, t.status], filtered.map(i => [i.id, i.client, i.material, i.code, i.unit, i.delivered, i.remaining, i.sellingPrice, i.storeCost, i.deliveryDate, i.expiry, i.sourceOrder, i.status]))}
      />

      {viewMode === "client" ? (
        /* ===== CLIENT VIEW ===== */
        <div className="space-y-3">
          {Object.entries(clientGroups).map(([clientName, group]) => {
            const isExpanded = expandedClient === clientName;
            const totalRemaining = group.items.reduce((s, i) => s + i.remaining * i.sellingPrice, 0);
            const materialsCount = group.items.length;
            const hasWarning = group.items.some(i => i.status === "Low Stock" || i.status === "Expired" || i.status === "Depleted");
            const canConvert = getClientItemsToConvert(clientName).length > 0;

            return (
              <div key={clientName} className="stat-card overflow-hidden">
                {/* Client Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleClient(clientName)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {clientName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm cursor-pointer hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${group.clientId}`); }}>{clientName}</h3>
                        {hasWarning && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{materialsCount} {t.materialsCount} · {t.remainingValue}: {totalRemaining.toLocaleString()} {t.currency}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canConvert && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          openConvertDialog(clientName);
                        }}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        تحويل لأوردر
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        exportToCsv(
                          `inventory_${clientName}`,
                          ["code", "material", "unit", "remaining"],
                          group.items.map(i => [i.code, i.material, i.unit, i.remaining])
                        );
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />{t.export || "Export"}
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[...new Set(group.items.map(item => item.status))].map(status => (
                        <StatusBadge key={status} status={status} />
                      ))}
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded Items Table */}
                {isExpanded && (
                  <div className="border-t border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.batchNumber}</th>
                          <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>
                          <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.deliveredQty}</th>
                          <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.remainingQty}</th>
                          <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.unit}</th>
                          <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.sellingPrice}</th>
                          <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.expiryDate}</th>
                          <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.sourceOrder}</th>
                          <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
                          <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">حالة الجرد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map(lot => {
                          const daysToExpiry = lot.expiry ? Math.ceil((new Date(lot.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                          const isNearExpiry = daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 30;
                          return (
                            <tr key={lot.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetailItem(lot)}>
                              <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{lot.id}</td>
                              <td className="py-2.5 px-3 font-medium">{lot.material}</td>
                              <td className="py-2.5 px-3 text-end">{lot.delivered}</td>
                              <td className="py-2.5 px-3 text-end font-medium">{lot.remaining}</td>
                              <td className="py-2.5 px-3 text-muted-foreground">{lot.unit}</td>
                              <td className="py-2.5 px-3 text-end">{lot.sellingPrice} {t.currency}</td>
                              <td className="py-2.5 px-3 text-xs">
                                <span className={isNearExpiry ? "text-warning font-medium" : "text-muted-foreground"}>
                                  {lot.expiry}{isNearExpiry && ` (${daysToExpiry} ${t.daysRemaining})`}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground hover:text-primary cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/orders/${lot.sourceOrder}`); }}>{lot.sourceOrder}</td>
                              <td className="py-2.5 px-3"><StatusBadge status={lot.status} /></td>
                              <td className="py-2.5 px-3"><StatusBadge status={lot.auditStatus} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {Object.keys(clientGroups).length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">{t.noResults}</div>}
        </div>
      ) : (
        /* ===== ITEM VIEW (original flat table) ===== */
        <div className="stat-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
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
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">حالة الجرد</th>
            </thead>
            <tbody>
              {filtered.map((lot) => {
                const daysToExpiry = lot.expiry ? Math.ceil((new Date(lot.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                const isNearExpiry = daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 30;
                return (
                  <tr key={lot.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetailItem(lot)}>
                    <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{lot.id}</td>
                    <td className="py-3 px-3 font-medium hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${lot.clientId}`); }}>{lot.client}</td>
                    <td className="py-3 px-3 hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate("/materials"); }}>{lot.material}</td>
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
                    <td className="py-3 px-3"><StatusBadge status={lot.auditStatus} /></td>
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
            <DialogDescription>تفاصيل الدفعة {detailItem?.id}</DialogDescription>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">العميل:</span> {detailItem.client}</div>
                <div><span className="text-muted-foreground">الكود:</span> {detailItem.code}</div>
                <div><span className="text-muted-foreground">الوحدة:</span> {detailItem.unit}</div>
                <div><span className="text-muted-foreground">المسلّم:</span> {detailItem.delivered}</div>
                <div><span className="text-muted-foreground">المتبقي:</span> {detailItem.remaining}</div>
                <div><span className="text-muted-foreground">سعر البيع:</span> {detailItem.sellingPrice} {t.currency}</div>
                <div><span className="text-muted-foreground">تكلفة المخزن:</span> {detailItem.storeCost} {t.currency}</div>
                <div><span className="text-muted-foreground">تاريخ التسليم:</span> {detailItem.deliveryDate}</div>
                <div><span className="text-muted-foreground">تاريخ الانتهاء:</span> {detailItem.expiry}</div>
                <div><span className="text-muted-foreground">الأوردر المصدر:</span> {detailItem.sourceOrder}</div>
              </div>
              <div className="pt-2">
                <StatusBadge status={detailItem.status} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Convert to Order Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تحويل الجرد لأوردر - {convertClient}</DialogTitle>
            <DialogDescription>
              اختر المواد والكميات المطلوبة لإنشاء أوردر جديد
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-4">
              {inventory
                .filter(item => item.client === convertClient && item.auditStatus === "Pending" && (item.status === "Depleted" || item.status === "Low Stock"))
                .map((item) => {
                  const isSelected = selectedLots[item.id];
                  const quantity = selectedLots[item.id] || item.delivered;
                  
                  return (
                    <div key={item.id} className="flex items-center gap-4 p-3 border rounded-lg">
                      <Checkbox
                        checked={!!isSelected}
                        onCheckedChange={() => toggleLotSelection(item.id, item.delivered)}
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{item.material}</h4>
                          <StatusBadge status={item.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          الكود: {item.code} | الوحدة: {item.unit}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => adjustQuantity(item.id, -1)}
                            disabled={quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-12 text-center font-medium">{quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => adjustQuantity(item.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {isSelected && (
                        <div className="text-left">
                          <div className="text-sm font-medium">
                            {(quantity * item.storeCost).toLocaleString()} جنيه
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.storeCost} × {quantity}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {Object.keys(selectedLots).length > 0 && (
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">الإجمالي:</span>
                <span className="text-lg font-bold text-primary">
                  {Object.entries(selectedLots).reduce((total, [lotId, quantity]) => {
                    const item = mockInventory.find(i => i.id === lotId);
                    return total + (quantity * (item?.storeCost || 0));
                  }, 0).toLocaleString()} جنيه
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreateOrder} disabled={Object.keys(selectedLots).length === 0}>
              إنشاء الأوردر
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}