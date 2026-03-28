import { useState, useMemo, useEffect } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Eye, MoreHorizontal, Truck, FileText, Copy, Trash2, Search, Loader2, Users, Package, CreditCard, CheckCircle2, Warehouse } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { logAudit } from "@/lib/auditLog";
import { useQueryClient } from "@tanstack/react-query";
import { useBusinessRules } from "@/lib/useBusinessRules";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

type Order = {
  id: string; client: string; clientId: string; date: string; lines: number;
  totalSelling: string; totalCost: string; splitMode: string;
  deliveryFee: number; deliveryFeeBearer: string; status: string; source: string;
};

type Client = { id: string; name: string; city: string; status: string; };

type MaterialItem = {
  code: string; name: string; category: string; unit: string;
  sellingPrice: number; storeCost: number; active: boolean; imageUrl: string;
};

interface OrderItem {
  materialCode: string; name: string; quantity: number;
  sellingPrice: number; costPrice: number; imageUrl: string; unit: string;
  fromInventory?: boolean; inventoryLotId?: string;
}

type CompanyLot = {
  id: string; materialCode: string; materialName: string; unit: string;
  lotNumber: string; quantity: number; remaining: number; costPrice: number;
  sourceOrder: string; dateAdded: string; status: string;
};

function mapOrder(raw: any): Order {
  return {
    id: raw.id,
    client: raw.client || "",
    clientId: raw.clientId || raw.client_id || "",
    date: raw.date || "",
    lines: Number(raw.lines ?? 0),
    totalSelling: raw.totalSelling ?? raw.total_selling ?? "0",
    totalCost: raw.totalCost ?? raw.total_cost ?? "0",
    splitMode: raw.splitMode ?? raw.split_mode ?? "",
    deliveryFee: Number(raw.deliveryFee ?? raw.delivery_fee ?? 0),
    deliveryFeeBearer: raw.deliveryFeeBearer ?? raw.delivery_fee_bearer ?? "client",
    status: raw.status || "Draft",
    source: raw.source || "",
  };
}

export default function OrdersPage() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const urlStatus = searchParams.get("status") || "";
  const { rules } = useBusinessRules();
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>(urlStatus ? { status: urlStatus } : {});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [form, setForm] = useState({ splitMode: rules.defaultSplitMode, deliveryFee: String(rules.defaultDeliveryFee), deliveryFeeBearer: "client" as "client" | "company" });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [materialSearch, setMaterialSearch] = useState("");
  const [realMaterials, setRealMaterials] = useState<MaterialItem[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [founders, setFounders] = useState<{ id: string; name: string }[]>([]);
  const [orderType, setOrderType] = useState<"client" | "inventory">("client");
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [companyLots, setCompanyLots] = useState<CompanyLot[]>([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [showInventoryPicker, setShowInventoryPicker] = useState(false);
  const [selectedFounders, setSelectedFounders] = useState<string[]>([]);
  const [founderPcts, setFounderPcts] = useState<Record<string, number>>({});
  const [collectionsMap, setCollectionsMap] = useState<Record<string, { paid: number; total: number; collectionId: string; status: string; date: string }>>({});
  const [deliveriesMap, setDeliveriesMap] = useState<Record<string, { total: number; confirmed: number }>>({});
  const [inventoryMap, setInventoryMap] = useState<Record<string, { count: number; date: string }>>({});
  const [auditsMap, setAuditsMap] = useState<Record<string, { auditId: string; status: string; date: string }>>({});
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (dialogOpen) {
      setForm({ splitMode: rules.defaultSplitMode, deliveryFee: String(rules.defaultDeliveryFee), deliveryFeeBearer: "client" });
      setSelectedFounders([]);
      setFounderPcts({});
      api.get<any[]>("/founders").then((data) => {
        const active = (data || []).filter((f: any) => f.active !== false).map((f: any) => ({ id: f.id, name: f.name }));
        setFounders(active);
        setSelectedFounders(active.map((f: any) => f.id));
        const eqPct = active.length > 0 ? Math.floor(100 / active.length) : 0;
        const pcts: Record<string, number> = {};
        active.forEach((f: any, i: number) => { pcts[f.id] = i === active.length - 1 ? 100 - eqPct * (active.length - 1) : eqPct; });
        setFounderPcts(pcts);
      }).catch(() => {});
      api.get<any[]>("/company-inventory").then(data => {
        setCompanyLots((data || []).filter((l: any) => Number(l.remaining) > 0).map((l: any) => ({
          id: l.id, materialCode: l.materialCode || l.material_code || "",
          materialName: l.materialName || l.material_name || "",
          unit: l.unit || "", lotNumber: l.lotNumber || l.lot_number || "",
          quantity: Number(l.quantity ?? 0), remaining: Number(l.remaining ?? 0),
          costPrice: Number(l.costPrice ?? l.cost_price ?? 0),
          sourceOrder: l.sourceOrder || l.source_order || "",
          dateAdded: l.dateAdded || l.date_added || "", status: l.status || "In Stock",
        })));
      }).catch(() => {});
    }
  }, [dialogOpen, rules.defaultSplitMode, rules.defaultDeliveryFee]);

  useEffect(() => {
    Promise.all([
      api.get<any[]>("/orders"),
      api.get<any[]>("/clients"),
      api.get<any[]>("/collections"),
      api.get<any[]>("/deliveries"),
      api.get<any[]>("/client-inventory"),
      api.get<any[]>("/audits"),
      api.get<any[]>("/suppliers").catch(() => []),
    ]).then(([ordersData, clientsData, collectionsData, deliveriesData, inventoryData, auditsData, suppliersData]) => {
      setSuppliers((suppliersData || []).map((s: any) => ({ id: s.id, name: s.name })));
      const clientMap: Record<string, string> = {};
      const clientArr = (clientsData || []).map((c: any) => {
        clientMap[c.id] = c.name || "";
        return { id: c.id, name: c.name, city: c.city || "", status: c.status || "Active" };
      });
      setClients(clientArr);
      setOrders((ordersData || []).map(raw => {
        const o = mapOrder(raw);
        if (o.clientId === "company-inventory") {
          o.client = "مخزون الشركة";
        } else if (!o.client && o.clientId) {
          o.client = clientMap[o.clientId] || o.clientId;
        }
        return o;
      }));
      const cmap: Record<string, { paid: number; total: number; collectionId: string; status: string; date: string }> = {};
      (collectionsData || []).forEach((c: any) => {
        const primaryOrderId = c.order || c.orderId || c.order_id || "";
        const paid = Number(c.paid ?? c.paidAmount ?? 0);
        const total = Number(c.total ?? c.totalAmount ?? 0);
        const colEntry = { paid, total, collectionId: c.id, status: c.status || "", date: c.invoiceDate || c.invoice_date || "" };

        let mapped = false;
        try {
          const notes = typeof c.notes === "string" ? JSON.parse(c.notes) : c.notes;
          if (notes?.sourceOrders && Array.isArray(notes.sourceOrders)) {
            const relatedOrders: string[] = notes.sourceOrders.filter(Boolean);
            if (relatedOrders.length > 0 && notes.lineItems && Array.isArray(notes.lineItems) && notes.lineItems.length > 0) {
              const orderLineTotals: Record<string, number> = {};
              notes.lineItems.forEach((li: any) => {
                const oid = li.sourceOrderId || "";
                if (!oid) return;
                orderLineTotals[oid] = (orderLineTotals[oid] || 0) + (Number(li.lineTotal) || 0);
              });
              const lineSum = Object.values(orderLineTotals).reduce((s, v) => s + v, 0);
              relatedOrders.forEach(oid => {
                const ratio = lineSum > 0 ? (orderLineTotals[oid] || 0) / lineSum : 1 / relatedOrders.length;
                const entry = {
                  paid: Math.round(paid * ratio),
                  total: Math.round(total * ratio),
                  collectionId: c.id,
                  status: c.status || "",
                  date: c.invoiceDate || c.invoice_date || "",
                };
                if (!cmap[oid] || entry.paid > cmap[oid].paid) cmap[oid] = entry;
              });
              mapped = true;
            } else if (relatedOrders.length > 0) {
              const share = 1 / relatedOrders.length;
              relatedOrders.forEach(oid => {
                const entry = {
                  paid: Math.round(paid * share),
                  total: Math.round(total * share),
                  collectionId: c.id,
                  status: c.status || "",
                  date: c.invoiceDate || c.invoice_date || "",
                };
                if (!cmap[oid] || entry.paid > cmap[oid].paid) cmap[oid] = entry;
              });
              mapped = true;
            }
          }
        } catch {}

        if (!mapped && primaryOrderId) {
          if (!cmap[primaryOrderId] || paid > cmap[primaryOrderId].paid) {
            cmap[primaryOrderId] = colEntry;
          }
        }
      });
      setCollectionsMap(cmap);
      const dmap: Record<string, { total: number; confirmed: number }> = {};
      (deliveriesData || []).forEach((d: any) => {
        const oid = d.orderId || d.order_id || "";
        if (!oid) return;
        if (!dmap[oid]) dmap[oid] = { total: 0, confirmed: 0 };
        dmap[oid].total++;
        if (d.status === "Delivered") dmap[oid].confirmed++;
      });
      setDeliveriesMap(dmap);
      const imap: Record<string, { count: number; date: string }> = {};
      (inventoryData || []).forEach((inv: any) => {
        const oid = inv.sourceOrder || inv.source_order || "";
        if (!oid) return;
        if (!imap[oid]) imap[oid] = { count: 0, date: inv.deliveryDate || inv.delivery_date || "" };
        imap[oid].count++;
        const d = inv.deliveryDate || inv.delivery_date || "";
        if (d && d > imap[oid].date) imap[oid].date = d;
      });
      setInventoryMap(imap);

      const amap: Record<string, { auditId: string; status: string; date: string }> = {};
      const invSourceOrders: Record<string, Set<string>> = {};
      (inventoryData || []).forEach((inv: any) => {
        const cid = inv.clientId || inv.client_id || "";
        const oid = inv.sourceOrder || inv.source_order || "";
        if (cid && oid) {
          if (!invSourceOrders[cid]) invSourceOrders[cid] = new Set();
          invSourceOrders[cid].add(oid);
        }
      });
      (auditsData || []).forEach((a: any) => {
        const clientId = a.clientId || a.client_id || "";
        const auditId = a.id || "";
        const auditDate = a.date || a.createdAt || a.created_at || "";
        const auditStatus = a.status || "";
        const orderIds = invSourceOrders[clientId] || new Set();
        orderIds.forEach(oid => {
          if (!amap[oid] || auditDate > amap[oid].date) {
            amap[oid] = { auditId, status: auditStatus, date: auditDate };
          }
        });
      });
      (collectionsData || []).forEach((c: any) => {
        try {
          const notes = typeof c.notes === "string" ? JSON.parse(c.notes) : c.notes;
          if (notes?.auditId && notes?.sourceOrders) {
            const auditRec = (auditsData || []).find((a: any) => a.id === notes.auditId);
            if (auditRec) {
              (notes.sourceOrders as string[]).filter(Boolean).forEach(oid => {
                if (!amap[oid] || (auditRec.date || "") > (amap[oid].date || "")) {
                  amap[oid] = { auditId: auditRec.id, status: auditRec.status || "", date: auditRec.date || "" };
                }
              });
            }
          }
        } catch {}
      });
      setAuditsMap(amap);
    }).catch(() => toast.error(t.failedToLoadData))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setMaterialsLoading(true);
    api.get<{ products: any[] }>("/external-materials")
      .then(json => {
        if (json?.products?.length) {
          setRealMaterials(json.products.map((p: any) => ({
            code: p.sku || p.id?.slice(0, 8) || "",
            name: p.name, category: p.category || "General",
            unit: p.unit || "unit", sellingPrice: p.price_retail || 0,
            storeCost: p.price_wholesale || 0, active: true,
            imageUrl: (p.image_url || p.image || "").startsWith("http") ? (p.image_url || p.image || "") : "",
          })));
        }
      }).catch(() => {}).finally(() => setMaterialsLoading(false));
  }, []);

  // Load refill data AFTER external materials are ready so prices/images are correct
  useEffect(() => {
    if (realMaterials.length === 0) return;
    const refillData = localStorage.getItem('refillOrderData');
    if (!refillData) return;
    localStorage.removeItem('refillOrderData');
    try {
      const data = JSON.parse(refillData);
      if (Date.now() - data.createdAt > 10 * 60 * 1000) return;
      const matMap = Object.fromEntries(realMaterials.map(m => [m.code, m]));
      setOrderItems(data.items.map((item: any) => {
        const mat = matMap[item.materialCode];
        return {
          materialCode: item.materialCode,
          name: item.materialName || mat?.name || item.materialCode,
          quantity: item.quantity || 1,
          sellingPrice: mat?.sellingPrice ?? 0,
          costPrice: mat?.storeCost ?? 0,
          imageUrl: mat?.imageUrl || "",
          unit: mat?.unit || item.unit || "unit",
        };
      }));
      const uniqueClients = [...new Set(data.items.map((i: any) => i.clientId).filter(Boolean))];
      if (uniqueClients.length === 1) setSelectedClient(String(uniqueClients[0]));
      setDialogOpen(true);
    } catch { /* ignore malformed data */ }
  }, [realMaterials]);

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q || o.client.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) || o.date.includes(q) || o.source.toLowerCase().includes(q) || o.status.toLowerCase().includes(q);
    const activeStatuses = ["Processing", "Draft", "Confirmed", "Ready for Delivery"];
    const matchStatus = !filters.status || filters.status === "all" || (filters.status === "active" ? activeStatuses.includes(o.status) : o.status === filters.status);
    return matchSearch && matchStatus;
  });

  const usedMaterialCodes = orderItems.map(i => i.materialCode);
  const filteredMaterials = useMemo(() => realMaterials.filter(m => {
    if (!m.active || usedMaterialCodes.includes(m.code)) return false;
    if (!materialSearch) return true;
    return m.name.toLowerCase().includes(materialSearch.toLowerCase()) || m.code.toLowerCase().includes(materialSearch.toLowerCase()) || m.category.toLowerCase().includes(materialSearch.toLowerCase());
  }), [materialSearch, usedMaterialCodes, realMaterials]);

  const addMaterialDirectly = (mat: MaterialItem) => {
    setOrderItems([{ materialCode: mat.code, name: mat.name, quantity: 1, sellingPrice: orderType === "inventory" ? 0 : mat.sellingPrice, costPrice: mat.storeCost, imageUrl: mat.imageUrl, unit: mat.unit }, ...orderItems]);
    setMaterialSearch("");
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    if (field === "sellingPrice" && orderType === "inventory") return;
    const updated = [...orderItems];
    (updated[index] as any)[field] = value;
    setOrderItems(updated);
  };

  const removeItem = (index: number) => setOrderItems(orderItems.filter((_, i) => i !== index));

  const totalSelling = orderItems.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0);
  const totalCost = orderItems.reduce((sum, i) => sum + i.costPrice * i.quantity, 0);

  const handleAdd = async () => {
    if (orderType === "client" && !selectedClient) { toast.error(t.selectClientAndTotal); return; }
    if (orderItems.length === 0) { toast.error(t.selectClientAndTotal); return; }
    const client = orderType === "client" ? clients.find(c => c.id === selectedClient) : null;
    if (orderType === "client" && !client) return;
    setSaving(true);
    try {
      const inventoryItems = orderItems.filter(i => i.fromInventory && i.inventoryLotId);
      for (const item of inventoryItems) {
        const lot = companyLots.find(l => l.id === item.inventoryLotId);
        if (lot && item.quantity > lot.remaining) {
          toast.error(`الكمية المطلوبة (${item.quantity}) من "${item.name}" أكبر من المتبقي (${lot.remaining})`);
          setSaving(false);
          return;
        }
      }

      const { nextId: newId } = await api.get<{ nextId: string }>("/orders/next-id");
      const today = new Date().toISOString().split("T")[0];
      const splitLabel = form.splitMode === "equal" ? t.equal : t.byContribution;
      const participating = founders.filter(f => selectedFounders.includes(f.id));
      const nonInventoryCost = orderItems.filter(i => !i.fromInventory).reduce((sum, i) => sum + i.costPrice * i.quantity, 0);
      const fundingCost = orderType === "inventory" ? totalCost : nonInventoryCost;
      const founderContributions = participating.map(f => {
        const pct = form.splitMode === "equal"
          ? (participating.length > 0 ? 100 / participating.length : 0)
          : (founderPcts[f.id] || 0);
        const share = fundingCost * pct / 100;
        return { founderId: f.id, founder: f.name, amount: Math.round(share * 100) / 100, percentage: Math.round(pct * 100) / 100, paid: fundingCost === 0, companyProfitPercentage: rules.companyProfitPercentage };
      });

      const effectiveSelling = orderType === "inventory" ? "0" : String(totalSelling);
      const clientId = orderType === "inventory" ? "company-inventory" : client!.id;
      const clientName = orderType === "inventory" ? "مخزون الشركة" : client!.name;

      const saved = await api.post<any>("/orders", {
        id: newId, clientId, client: clientName, date: today,
        lines: orderItems.length,
        totalSelling: effectiveSelling,
        totalCost: String(totalCost),
        splitMode: splitLabel, deliveryFee: String(parseInt(form.deliveryFee) || 0),
        deliveryFeeBearer: form.deliveryFeeBearer,
        status: "Processing", source: t.manual,
        orderType,
        supplierId: orderType === "inventory" ? selectedSupplier : "",
        founderContributions,
        items: orderItems.map(i => ({ ...i, fromInventory: i.fromInventory || false, inventoryLotId: i.inventoryLotId || "" })),
      });
      if (saved._linesError) {
        toast.warning(`تم حفظ الطلب لكن فشل حفظ تفاصيل المواد: ${saved._linesError}`);
      }

      await logAudit({ entity: "order", entityId: saved.id || newId, entityName: `${saved.id || newId} - ${clientName}`, action: "create", snapshot: saved, endpoint: "/orders" });

      setOrders(prev => [mapOrder(saved), ...prev]);
      setForm({ splitMode: rules.defaultSplitMode, deliveryFee: String(rules.defaultDeliveryFee), deliveryFeeBearer: "client" });
      setSelectedClient(""); setOrderItems([]); setDialogOpen(false); setOrderType("client");
      if (!saved._linesError) toast.success(t.orderCreated);
    } catch (err: any) {
      toast.error(err?.message || t.failedToSaveOrder);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const snapshot = { ...deleteTarget, collectionPaid: collectionsMap[deleteTarget.id]?.paid ?? 0, collectionTotal: collectionsMap[deleteTarget.id]?.total ?? 0 };
      const deleteResult = await api.delete<{ ok: boolean; relatedSnapshot?: any }>(`/orders/${deleteTarget.id}`);
      const related = (deleteResult as any)?.relatedSnapshot || {};
      await logAudit({
        entity: "order", entityId: deleteTarget.id,
        entityName: `${deleteTarget.id} - ${deleteTarget.client}`,
        action: "delete",
        snapshot: { ...snapshot, _related: related } as any,
        endpoint: "/orders",
      });
      setOrders(prev => prev.filter(o => o.id !== deleteTarget.id));
      setCollectionsMap(prev => { const next = { ...prev }; delete next[deleteTarget.id]; return next; });
      queryClient.invalidateQueries({ queryKey: ["orders_full"] });
      setDeleteTarget(null);
      toast.success(`تم حذف الطلب: ${deleteTarget.id}`);
    } catch (err: any) {
      toast.error(err?.message || "فشل حذف الطلب");
    } finally {
      setDeleting(false);
    }
  };

  const statusOptions = [
    { label: "قيد المعالجة", value: "Processing" }, { label: t.draft, value: "Draft" }, { label: t.confirmed, value: "Confirmed" },
    { label: t.awaitingPurchase, value: "Awaiting Purchase" }, { label: t.readyForDelivery, value: "Ready for Delivery" },
    { label: t.partiallyDelivered, value: "Partially Delivered" }, { label: t.delivered, value: "Delivered" },
    { label: t.invoiced, value: "Invoiced" }, { label: t.closed, value: "Closed" }, { label: t.cancelled, value: "Cancelled" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.ordersTitle}</h1>
        <p className="page-description">{orders.length} {t.orderCount} · {orders.filter(o => ["Processing", "Draft", "Confirmed", "Ready for Delivery"].includes(o.status)).length} {t.activeOrdersCount}</p>
      </div>

      <DataToolbar
        searchPlaceholder={t.searchOrders}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[{ label: t.status, value: "status", options: statusOptions }]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("orders", [t.orderNumber, t.client, t.date, t.lines, t.selling, t.costCol, t.splitMode, t.source, t.status], filtered.map(o => [o.id, o.client, o.date, o.lines, o.totalSelling, o.totalCost, o.splitMode, o.source, o.status]))}
        actions={<Button size="sm" className="h-9" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.newOrder}</Button>}
      />

      <div className="stat-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.orderNumber}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.date}</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.selling}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground"><Truck className="h-3.5 w-3.5 inline-block ml-1" />التوصيل</th>
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground"><Package className="h-3.5 w-3.5 inline-block ml-1" />الجرد</th>
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground"><CreditCard className="h-3.5 w-3.5 inline-block ml-1" />التحصيل</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const delInfo = deliveriesMap[order.id];
                const invInfo = inventoryMap[order.id];
                const auditInfo = auditsMap[order.id];
                const colInfo = collectionsMap[order.id];
                const colPct = colInfo && colInfo.total > 0 ? Math.round((colInfo.paid / colInfo.total) * 100) : 0;
                return (
                <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                  <td className="py-3 px-3 font-mono text-xs font-medium">{order.id}</td>
                  <td className="py-3 px-3 font-medium hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${order.clientId}`); }}>{order.client}</td>
                  <td className="py-3 px-3 text-muted-foreground text-xs">{order.date}</td>
                  <td className="py-3 px-3 text-end font-medium">{order.totalSelling}</td>
                  <td className="py-3 px-3"><StatusBadge status={order.status} /></td>
                  <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    {delInfo ? (
                      <button className="inline-flex items-center gap-1 text-xs hover:underline" onClick={() => navigate(`/deliveries?orderId=${order.id}`)}>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${delInfo.confirmed === delInfo.total && delInfo.total > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                          <Truck className="h-3 w-3" /> {delInfo.confirmed}/{delInfo.total}
                        </span>
                      </button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    {auditInfo ? (
                      <button className="inline-flex flex-col items-center gap-0.5 text-xs hover:underline" onClick={() => navigate(`/audits?auditId=${auditInfo.auditId}`)}>
                        <span className="font-mono text-[10px] text-primary hover:underline">{auditInfo.auditId}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                          auditInfo.status === "تم التحصيل" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : auditInfo.status === "Completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}>
                          {auditInfo.status === "تم التحصيل" || auditInfo.status === "Completed" ? <CheckCircle2 className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                          {auditInfo.status === "تم التحصيل" ? "تم ✓" : auditInfo.status === "Completed" ? "تم ✓" : auditInfo.status === "Discrepancy" ? "نواقص" : "تم"}
                        </span>
                      </button>
                    ) : invInfo ? (
                      <button className="inline-flex items-center gap-1 text-xs hover:underline" onClick={() => navigate(`/inventory?sourceOrder=${order.id}`)}>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                          <Package className="h-3 w-3" /> {invInfo.count}
                        </span>
                      </button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    {colInfo ? (
                      <button className="inline-flex flex-col items-center gap-0.5 text-xs hover:underline" onClick={() => navigate(`/collections?collectionId=${colInfo.collectionId}`)}>
                        <span className="font-mono text-[10px] text-primary hover:underline">{colInfo.collectionId}</span>
                        <span className={`font-medium ${colPct >= 100 ? "text-green-600" : "text-primary"}`}>{colInfo.paid.toLocaleString()} / {colInfo.total.toLocaleString()}</span>
                        <div className="w-14 bg-muted rounded-full h-1 overflow-hidden"><div className={`h-full rounded-full ${colPct >= 100 ? "bg-green-500" : "bg-primary"}`} style={{ width: `${colPct}%` }} /></div>
                      </button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="py-3 px-3 text-end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/orders/${order.id}`)}><Eye className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.viewDetails}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/deliveries?new=${order.id}`)}><Truck className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.registerDelivery}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.success(`${t.createInvoice}: ${order.id}`)}><FileText className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.createInvoice}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.success(`${t.copy}: ${order.id}`)}><Copy className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.copy}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(order)} data-testid={`button-delete-order-${order.id}`}>
                          <Trash2 className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">{t.noResults}</div>}
      </div>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="حذف الطلب"
        description={`هل تريد حذف الطلب "${deleteTarget?.id}"؟ يمكنك استعادته لاحقاً من سجل الأنشطة.`}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setOrderItems([]); setSelectedClient(""); setMaterialSearch(""); setOrderType("client"); setShowInventoryPicker(false); setInventorySearch(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader><DialogTitle>{t.newOrder}</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-2">
            <div className="space-y-4">
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <button className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors ${orderType === "client" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setOrderType("client")}>
                  لعميل
                </button>
                <button className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors ${orderType === "inventory" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => { setOrderType("inventory"); setSelectedClient(""); setOrderItems(prev => prev.map(i => ({ ...i, sellingPrice: 0 }))); }}>
                  <Warehouse className="h-3.5 w-3.5 inline-block ml-1" />للمخزون
                </button>
              </div>

              {orderType === "client" && (
                <div>
                  <Label className="text-xs">{t.client} *</Label>
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={t.selectClientPlaceholder} /></SelectTrigger>
                    <SelectContent>
                      {clients.filter(c => c.status === "Active").map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name} — {c.city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {orderType === "inventory" && (
                <div className="space-y-3">
                  <div className="p-3 rounded-md border border-primary/20 bg-primary/5 text-xs text-muted-foreground">
                    <Warehouse className="h-4 w-4 inline-block ml-1 text-primary" />
                    طلب لمخزون الشركة — المواد ستضاف للمخزون عند التسليم
                  </div>
                  <div>
                    <Label className="text-xs">المورد</Label>
                    <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                      <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="اختر المورد (اختياري)" /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs font-medium mb-2 block">{t.orderItemsLabel} *</Label>
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="h-9 ps-9 text-xs" placeholder={t.searchMaterials} value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} />
                </div>
                {materialSearch && filteredMaterials.length > 0 && (
                  <div className="border border-border rounded-md mt-1 max-h-60 overflow-y-auto bg-background shadow-md">
                    {filteredMaterials.slice(0, 8).map(mat => (
                      <div key={mat.code} className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer text-xs transition-colors" onClick={() => addMaterialDirectly(mat)}>
                        <div className="flex items-center gap-2">
                          {mat.imageUrl ? (
                            <img src={mat.imageUrl} alt={mat.name} className="h-8 w-8 rounded object-cover shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-medium block">{mat.name}</span>
                            <span className="text-muted-foreground">{mat.code} · {mat.category}</span>
                          </div>
                        </div>
                        <span className="text-muted-foreground shrink-0">{mat.sellingPrice} {t.currency}</span>
                      </div>
                    ))}
                  </div>
                )}
                {materialsLoading && <div className="text-center py-2 text-muted-foreground text-xs mt-1 flex items-center justify-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {t.loadingMaterials}</div>}
                {!materialsLoading && materialSearch && filteredMaterials.length === 0 && <div className="text-center py-2 text-muted-foreground text-xs mt-1">{t.noResults}</div>}
              </div>

              {orderType === "client" && companyLots.length > 0 && (
                <div>
                  <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => setShowInventoryPicker(!showInventoryPicker)}>
                    <Warehouse className="h-3.5 w-3.5" />سحب من مخزون الشركة ({companyLots.length} دُفعة متاحة)
                  </Button>
                  {showInventoryPicker && (
                    <div className="border border-border rounded-md mt-2 bg-background shadow-md">
                      <div className="p-2 border-b border-border">
                        <Input className="h-8 text-xs" placeholder="بحث في المخزون..." value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {companyLots.filter(l => {
                          const q = inventorySearch.toLowerCase();
                          return !q || l.materialName.toLowerCase().includes(q) || l.materialCode.toLowerCase().includes(q);
                        }).map(lot => (
                          <div key={lot.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer text-xs transition-colors border-b border-border/30" onClick={() => {
                            if (orderItems.some(i => i.inventoryLotId === lot.id)) { toast.error("هذه الدُفعة مضافة بالفعل"); return; }
                            const matMatch = realMaterials.find(m => m.code === lot.materialCode) || realMaterials.find(m => m.name && lot.materialName && m.name.toLowerCase().trim() === lot.materialName.toLowerCase().trim());
                            setOrderItems(prev => [...prev, { materialCode: lot.materialCode, name: lot.materialName, quantity: 1, sellingPrice: 0, costPrice: lot.costPrice, imageUrl: matMatch?.imageUrl || "", unit: lot.unit, fromInventory: true, inventoryLotId: lot.id }]);
                            setShowInventoryPicker(false);
                            setInventorySearch("");
                          }}>
                            <div className="min-w-0">
                              <span className="font-medium block">{lot.materialName}</span>
                              <span className="text-muted-foreground">{lot.materialCode} · متبقي: {lot.remaining} {lot.unit} · سعر: {lot.costPrice.toLocaleString()}</span>
                            </div>
                            <Plus className="h-4 w-4 text-primary shrink-0" />
                          </div>
                        ))}
                        {companyLots.filter(l => { const q = inventorySearch.toLowerCase(); return !q || l.materialName.toLowerCase().includes(q) || l.materialCode.toLowerCase().includes(q); }).length === 0 && (
                          <div className="text-center py-3 text-muted-foreground text-xs">لا توجد نتائج</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {orderItems.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-border rounded-md text-muted-foreground text-xs">{t.noItemsAdded}</div>
              ) : (
                <div className="space-y-2">
                  {orderItems.map((item, idx) => (
                    <div key={idx} className="border border-border rounded-md p-3 space-y-2 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="h-9 w-9 rounded object-cover shrink-0 border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }} />
                          ) : null}
                          <div className={`h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0 ${item.imageUrl ? "hidden" : ""}`}>
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium block">{item.name}</span>
                            <span className="font-mono text-muted-foreground">{item.materialCode}</span>
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeItem(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div><Label className="text-[10px] text-muted-foreground">{t.quantity}</Label><Input className="h-7 text-xs mt-0.5" type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} /></div>
                        <div><Label className="text-[10px] text-muted-foreground">{t.sellingPrice}</Label><Input className={`h-7 text-xs mt-0.5 ${orderType === "inventory" ? "opacity-50" : ""}`} type="number" value={orderType === "inventory" ? 0 : item.sellingPrice} onChange={(e) => updateItem(idx, "sellingPrice", parseFloat(e.target.value) || 0)} disabled={orderType === "inventory"} /></div>
                        <div><Label className="text-[10px] text-muted-foreground">{t.costPrice}</Label><Input className="h-7 text-xs mt-0.5" type="number" value={item.costPrice} onChange={(e) => updateItem(idx, "costPrice", parseFloat(e.target.value) || 0)} /></div>
                      </div>
                      {item.fromInventory && (
                        <div className="flex items-center gap-1 text-[10px] text-primary"><Warehouse className="h-3 w-3" />من المخزون — دُفعة: {item.inventoryLotId?.slice(0, 15)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {orderItems.length > 0 && (
                <div className="bg-muted/40 rounded-md p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t.totalSelling}:</span><span className="font-medium">{totalSelling.toLocaleString()} {t.currency}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t.totalCost}:</span><span className="font-medium">{totalCost.toLocaleString()} {t.currency}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t.lines}:</span><span className="font-medium">{orderItems.length}</span></div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">{t.deliveryFee}</Label><Input className="h-9 mt-1" type="number" value={form.deliveryFee} onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })} /></div>
                <div>
                  <Label className="text-xs">{t.splitModeLabel}</Label>
                  <Select value={form.splitMode} onValueChange={(v) => setForm({ ...form, splitMode: v })}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equal">{t.equal}</SelectItem>
                      <SelectItem value="contribution">{t.byContribution}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(parseInt(form.deliveryFee) || 0) > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/20">
                  <Label className="text-xs font-medium flex-shrink-0">{t.deliveryFeeBearerLabel}</Label>
                  <div className="flex items-center gap-4 mr-auto">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox checked={form.deliveryFeeBearer === "client"} onCheckedChange={() => setForm({ ...form, deliveryFeeBearer: "client" })} />
                      <span className="text-xs">{t.deliveryFeeBearerClient}</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox checked={form.deliveryFeeBearer === "company"} onCheckedChange={() => setForm({ ...form, deliveryFeeBearer: "company" })} />
                      <span className="text-xs">{t.deliveryFeeBearerCompany}</span>
                    </label>
                  </div>
                </div>
              )}

              {founders.length > 0 && (
                <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold">المؤسسون المشاركون في هذا الطلب</span>
                    <span className="text-xs text-muted-foreground mr-auto">نسبة الشركة: {rules.companyProfitPercentage}%</span>
                  </div>
                  {founders.map(f => {
                    const isSelected = selectedFounders.includes(f.id);
                    const pct = form.splitMode === "equal"
                      ? (selectedFounders.length > 0 ? 100 / selectedFounders.length : 0)
                      : (founderPcts[f.id] || 0);
                    const costShare = totalCost * pct / 100;
                    return (
                      <div key={f.id} className={`flex items-center gap-3 p-2 rounded-md transition-colors ${isSelected ? "bg-primary/5 border border-primary/20" : "opacity-50"}`}>
                        <Checkbox checked={isSelected} onCheckedChange={(checked) => {
                          setSelectedFounders(prev => checked ? [...prev, f.id] : prev.filter(id => id !== f.id));
                        }} />
                        <span className="flex-1 text-sm font-medium">{f.name}</span>
                        {form.splitMode === "contribution" && isSelected ? (
                          <div className="flex items-center gap-1">
                            <Input className="h-7 w-16 text-xs text-center" type="number" min={0} max={100} value={founderPcts[f.id] || 0} onChange={e => setFounderPcts(prev => ({ ...prev, [f.id]: Number(e.target.value) }))} />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                        )}
                        {totalCost > 0 && isSelected && (
                          <span className="text-xs font-medium min-w-[70px] text-end text-primary">{costShare.toLocaleString("en-US", { maximumFractionDigits: 0 })} {t.currency}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <Button className="w-full" onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.createOrder}
              </Button>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
