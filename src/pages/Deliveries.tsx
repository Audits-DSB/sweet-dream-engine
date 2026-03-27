import { useState, useEffect } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, MoreHorizontal, Truck, Plus, Loader2, Trash2, X, Package, Calendar, User, Hash, DollarSign, MapPin, Clock, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { logAudit } from "@/lib/auditLog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type Delivery = {
  id: string; orderId: string; client: string; clientId: string;
  requestedDate: string; actualDate: string; actor: string;
  items: number | string; type: string; status: string;
  deliveryFee: number;
};
type Order = { id: string; client: string; clientId: string; status: string; deliveryFee: number; itemsCount: number };
type Actor = { id: string; name: string; label: string };

const statusVariant: Record<string, string> = {
  Pending: "warning", "In Transit": "info", Delivered: "success", Failed: "destructive",
};

function mapDelivery(raw: any, clientMap: Record<string, string> = {}): Delivery {
  const clientId = raw.clientId || raw.client_id || "";
  return {
    id: raw.id,
    orderId: raw.orderId || raw.order_id || "",
    client: raw.client || clientMap[clientId] || clientId,
    clientId,
    requestedDate: raw.scheduledDate || raw.scheduled_date || raw.requestedDate || raw.requested_date || "",
    actualDate: raw.date || raw.actualDate || raw.actual_date || "—",
    actor: raw.deliveredBy || raw.delivered_by || raw.actor || "",
    items: raw.items ?? 0,
    type: raw.notes || raw.type || "",
    status: raw.status === "Scheduled" ? "Pending" : (raw.status || "Pending"),
    deliveryFee: Number(raw.deliveryFee ?? raw.delivery_fee ?? 0),
  };
}

export default function DeliveriesPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const status = searchParams.get("status");
    const orderId = searchParams.get("orderId");
    return { ...(status ? { status } : {}), ...(orderId ? { orderId } : {}) };
  });
  const [autoOpenDone, setAutoOpenDone] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Delivery | null>(null);
  const [selectedOrder, setSelectedOrder] = useState("");
  const [selectedActor, setSelectedActor] = useState("");
  const [customActor, setCustomActor] = useState("");
  const [deliveryType, setDeliveryType] = useState("full");
  const [requestedDate, setRequestedDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Delivery | null>(null);
  const [deleting, setDeleting] = useState(false);

  type OrderLine = { id: string; materialCode: string; materialName: string; quantity: number; unit: string; imageUrl?: string; sellingPrice?: number };
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [partialItems, setPartialItems] = useState<Record<string, { selected: boolean; qty: number }>>({});
  const [detailOrderLines, setDetailOrderLines] = useState<OrderLine[]>([]);
  const [detailOrderInfo, setDetailOrderInfo] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailOtherDeliveries, setDetailOtherDeliveries] = useState<Delivery[]>([]);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);

  const getDeliveredQtyMap = (orderDeliveries: any[]): Record<string, number> => {
    const map: Record<string, number> = {};
    for (const d of orderDeliveries) {
      if (d.status === "Failed") continue;
      const notes = d.notes || d.type || "";
      try {
        const parsed = JSON.parse(notes);
        if (parsed && Array.isArray(parsed.items)) {
          for (const item of parsed.items) {
            const key = item.lineId || item.materialCode || "";
            if (key) map[key] = (map[key] || 0) + (Number(item.qty) || 0);
          }
          continue;
        }
      } catch {}
      if (notes === "كامل" || notes === "full") {
        return { __full__: 1 };
      }
    }
    return map;
  };

  const [deliveredQtyMap, setDeliveredQtyMap] = useState<Record<string, number>>({});
  const [isFullyDelivered, setIsFullyDelivered] = useState(false);

  useEffect(() => {
    if (!selectedOrder) { setOrderLines([]); setPartialItems({}); setDeliveredQtyMap({}); setIsFullyDelivered(false); return; }
    let cancelled = false;
    setLoadingLines(true);
    setOrderLines([]);
    setPartialItems({});
    setDeliveredQtyMap({});
    setIsFullyDelivered(false);

    Promise.all([
      api.get<any[]>(`/orders/${selectedOrder}/lines`),
      api.get<any[]>(`/deliveries?orderId=${selectedOrder}`),
    ]).then(([lines, existingDeliveries]) => {
      if (cancelled) return;

      const activeDeliveries = (existingDeliveries || []).filter((d: any) => {
        const s = d.status || d.Status || "";
        return s !== "Failed";
      });

      const qtyMap = getDeliveredQtyMap(activeDeliveries);

      if (qtyMap.__full__) {
        setIsFullyDelivered(true);
        setDeliveredQtyMap(qtyMap);
        setOrderLines([]);
        setPartialItems({});
        return;
      }

      setDeliveredQtyMap(qtyMap);

      const mapped = (lines || []).filter((l: any) => (Number(l.quantity) || 0) > 0).map((l: any) => {
        const lineId = l.id;
        const totalQty = Number(l.quantity) || 0;
        const alreadyDelivered = qtyMap[lineId] || qtyMap[l.materialCode || l.material_code || ""] || 0;
        const remaining = Math.max(0, totalQty - alreadyDelivered);
        return {
          id: lineId, materialCode: l.materialCode || l.material_code || "",
          materialName: l.materialName || l.material_name || l.name || "",
          quantity: totalQty, unit: l.unit || "",
          imageUrl: l.imageUrl || l.image_url || "",
          remaining,
          alreadyDelivered,
        };
      });

      const allDelivered = mapped.length > 0 && mapped.every(m => m.remaining <= 0);
      setIsFullyDelivered(allDelivered);

      const available = mapped.filter(m => m.remaining > 0);
      setOrderLines(available.map(m => ({ id: m.id, materialCode: m.materialCode, materialName: m.materialName, quantity: m.remaining, unit: m.unit, imageUrl: m.imageUrl })));
      const init: Record<string, { selected: boolean; qty: number }> = {};
      available.forEach(l => { init[l.id] = { selected: false, qty: l.remaining }; });
      setPartialItems(init);
    }).catch(() => { if (!cancelled) { setOrderLines([]); setPartialItems({}); setDeliveredQtyMap({}); } }).finally(() => { if (!cancelled) setLoadingLines(false); });
    return () => { cancelled = true; };
  }, [selectedOrder]);

  useEffect(() => {
    Promise.all([
      api.get<any[]>("/deliveries"),
      api.get<any[]>("/orders"),
      api.get<any[]>("/founders"),
      api.get<any[]>("/clients"),
    ]).then(([dels, ords, founders, clients]) => {
      const clientMap: Record<string, string> = {};
      (clients || []).forEach((c: any) => { clientMap[c.id] = c.name || ""; });
      setOrders((ords || []).map((o: any) => ({
        id: o.id,
        client: o.client || clientMap[o.clientId || o.client_id] || "",
        clientId: o.clientId || o.client_id || "",
        status: o.status || "",
        deliveryFee: Number(o.deliveryFee ?? o.delivery_fee ?? 0),
        itemsCount: Number(o.itemsCount ?? o.items_count ?? 0),
      })));
      setDeliveries((dels || []).map(d => mapDelivery(d, clientMap)));
      const founderActors: Actor[] = (founders || []).map((f: any) => ({
        id: f.id, name: f.name || "", label: f.alias ? `${f.name} (${f.alias})` : f.name,
      }));
      setActors([...founderActors, { id: "__other__", name: "__other__", label: t.otherActor || "مندوب خارجي / آخر" }]);
    }).catch(() => toast.error("تعذّر تحميل التسليمات")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const status = searchParams.get("status");
    const orderId = searchParams.get("orderId");
    setFilters({ ...(status ? { status } : {}), ...(orderId ? { orderId } : {}) });
  }, [searchParams]);

  useEffect(() => {
    const newId = searchParams.get("new");
    if (!newId || autoOpenDone || loading || orders.length === 0) return;
    const match = orders.find(o => o.id === newId);
    if (match) {
      setSelectedOrder(match.id);
      setDialogOpen(true);
      setAutoOpenDone(true);
    }
  }, [searchParams, orders, loading, autoOpenDone]);

  useEffect(() => {
    if (!detailItem) { setDetailOrderLines([]); setDetailOrderInfo(null); setDetailOtherDeliveries([]); return; }
    let cancelled = false;
    setLoadingDetail(true);
    Promise.all([
      api.get<any[]>(`/orders/${detailItem.orderId}/lines`).catch(() => []),
      api.get<any>(`/orders/${detailItem.orderId}`).catch(() => null),
      api.get<any[]>(`/deliveries?orderId=${detailItem.orderId}`).catch(() => []),
    ]).then(([lines, orderInfo, relatedDels]) => {
      if (cancelled) return;
      setDetailOrderLines((lines || []).map((l: any) => ({
        id: l.id, materialCode: l.materialCode || l.material_code || "",
        materialName: l.materialName || l.material_name || "",
        quantity: Number(l.quantity) || 0, unit: l.unit || "",
        imageUrl: l.imageUrl || l.image_url || "",
        sellingPrice: Number(l.sellingPrice || l.selling_price || 0),
      })));
      setDetailOrderInfo(orderInfo);
      const clientMap2: Record<string, string> = {};
      orders.forEach(o => { clientMap2[o.clientId] = o.client; });
      setDetailOtherDeliveries((relatedDels || []).filter((d: any) => d.id !== detailItem.id).map((d: any) => mapDelivery(d, clientMap2)));
    }).finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [detailItem?.id]);

  const filtered = deliveries.filter((d) => {
    const s = search.toLowerCase();
    const matchSearch = !s || d.client.toLowerCase().includes(s) || d.id.toLowerCase().includes(s) || d.orderId.toLowerCase().includes(s);
    const matchStatus = !filters.status || filters.status === "all" || d.status === filters.status;
    const matchOrder = !filters.orderId || d.orderId === filters.orderId;
    return matchSearch && matchStatus && matchOrder;
  });

  const sendNotification = async (title: string, body: string, type: string = "info") => {
    await api.post("/notifications", {
      id: `NOT-${Date.now()}`, type, title, message: body || "",
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      read: false, userId: user?.id || "",
    }).catch(() => {});
  };

  const handleAdd = async () => {
    if (!selectedOrder) { toast.error(t.pleaseSelectOrder); return; }
    if (isFullyDelivered) { toast.error("تم توصيل جميع مواد هذا الطلب بالكامل"); return; }
    const order = orders.find(o => o.id === selectedOrder);
    if (!order) return;

    if (deliveryType === "partial") {
      const selectedLines = Object.entries(partialItems).filter(([, v]) => v.selected && v.qty > 0);
      if (selectedLines.length === 0) { toast.error("اختر مادة واحدة على الأقل للتسليم الجزئي"); return; }
    }

    setSaving(true);
    const today = requestedDate || new Date().toISOString().split("T")[0];
    const newId = `DEL-${Date.now().toString().slice(-6)}`;
    const actorName = selectedActor === "__other__" ? (customActor.trim() || "") : (selectedActor || "");

    let itemsCount = 0;
    let notesPayload: string;

    if (deliveryType === "partial") {
      const lineIds = new Set(orderLines.map(l => l.id));
      const selectedLines = Object.entries(partialItems)
        .filter(([lineId, v]) => v.selected && v.qty > 0 && lineIds.has(lineId))
        .map(([lineId, v]) => {
          const line = orderLines.find(l => l.id === lineId)!;
          const qty = Math.min(v.qty, line.quantity);
          return { lineId, materialCode: line.materialCode, materialName: line.materialName, qty, unit: line.unit };
        });
      itemsCount = selectedLines.length;
      notesPayload = JSON.stringify({ type: "جزئي", items: selectedLines });
    } else {
      const hasPriorDeliveries = Object.keys(deliveredQtyMap).length > 0;
      if (hasPriorDeliveries && orderLines.length > 0) {
        const remainingItems = orderLines.map(l => ({
          lineId: l.id, materialCode: l.materialCode, materialName: l.materialName, qty: l.quantity, unit: l.unit,
        }));
        itemsCount = remainingItems.length;
        notesPayload = JSON.stringify({ type: "جزئي", items: remainingItems });
      } else {
        itemsCount = orderLines.length || order.itemsCount || 0;
        notesPayload = t.full || "كامل";
      }
    }

    const payload = {
      id: newId,
      orderId: order.id,
      clientId: order.clientId,
      scheduledDate: today,
      deliveredBy: actorName,
      items: itemsCount,
      notes: notesPayload,
      deliveryFee: order.deliveryFee || 0,
      status: "Pending",
    };
    try {
      const saved = await api.post<any>("/deliveries", payload);
      await logAudit({ entity: "delivery", entityId: saved.id || newId, entityName: `${saved.id || newId} - ${order.client || order.id}`, action: "create", snapshot: saved, endpoint: "/deliveries" });
      setDeliveries([mapDelivery(saved), ...deliveries]);
      sendNotification(t.newDelivery || "تسليم جديد", `${newId} - ${order.client}`, "info");
      setSelectedOrder(""); setSelectedActor(""); setCustomActor(""); setDeliveryType("full"); setRequestedDate(new Date().toISOString().split("T")[0]); setOrderLines([]); setPartialItems({});
      setDialogOpen(false);
      toast.success(t.deliveryCreated || "تم إنشاء التسليم");
    } catch {
      toast.error("فشل إنشاء التسليم");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/deliveries/${deleteTarget.id}`);
      await logAudit({ entity: "delivery", entityId: deleteTarget.id, entityName: `${deleteTarget.id} - ${deleteTarget.client}`, action: "delete", snapshot: deleteTarget as any, endpoint: "/deliveries" });
      setDeliveries(prev => prev.filter(d => d.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success(`تم حذف التسليم: ${deleteTarget.id}`);
    } catch (err: any) {
      toast.error(err?.message || "فشل حذف التسليم");
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelivery = async (del: Delivery) => {
    const today = new Date().toISOString().split("T")[0];
    try {
      await api.patch(`/deliveries/${del.id}`, { status: "Delivered", date: today });
      setDeliveries(deliveries.map(d => d.id === del.id ? { ...d, status: "Delivered", actualDate: today } : d));

      try {
        const freshOrders = await api.get<any[]>("/orders");
        const updatedOrder = (freshOrders || []).find((o: any) => o.id === del.orderId);
        if (updatedOrder) {
          setOrders(prev => prev.map(o =>
            o.id === del.orderId ? { ...o, status: updatedOrder.status || o.status } : o
          ));
        }
      } catch {}

      toast.success(`${t.deliveryConfirmedMsg || "تم تأكيد التسليم"}: ${del.id}`);
      sendNotification(t.deliveryConfirmed || "تم التسليم", `${del.id} - ${del.client}`, "success");
    } catch {
      toast.error("فشل تحديث التسليم");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.deliveriesTitle}</h1>
        <p className="page-description">{deliveries.length} {t.deliveryCount} · {deliveries.filter(d => d.status === "Pending").length} {t.pendingCount}</p>
      </div>

      {filters.orderId && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm">
          <Truck className="h-4 w-4 text-primary shrink-0" />
          <span className="text-primary font-medium">تسليمات الطلب: <span className="font-mono">{filters.orderId}</span></span>
          <button className="mr-auto text-primary/70 hover:text-primary" onClick={() => setFilters({})}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <DataToolbar
        searchPlaceholder={t.searchDeliveries}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[{ label: t.status, value: "status", options: [
          { label: t.pending, value: "Pending" }, { label: t.inTransit, value: "In Transit" }, { label: t.delivered, value: "Delivered" },
        ]}]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("deliveries", [t.code, t.order, t.client, t.requestedDate, t.actualDate, t.executor, t.items, t.type, t.status],
          filtered.map(d => [d.id, d.orderId, d.client, d.requestedDate, d.actualDate, d.actor, d.items, d.type, d.status]))}
        actions={<Button size="sm" className="h-9" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.newDelivery}</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.code}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.order}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.requestedDate}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.actualDate}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.executor}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.type}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((del) => (
              <tr key={del.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetailItem(del)}>
                <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{del.id}</td>
                <td className="py-3 px-3 font-mono text-xs text-primary hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/orders/${del.orderId}`); }}>{del.orderId}</td>
                <td className="py-3 px-3 font-medium hover:text-primary cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${del.clientId}`); }}>{del.client}</td>
                <td className="py-3 px-3 text-muted-foreground text-xs">{del.requestedDate}</td>
                <td className="py-3 px-3 text-xs">{del.actualDate}</td>
                <td className="py-3 px-3 text-muted-foreground">{del.actor}</td>
                <td className="py-3 px-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{(() => { try { const p = JSON.parse(del.type); return p.type || del.type; } catch { return del.type; } })()}</span></td>
                <td className="py-3 px-3"><StatusBadge status={del.status} variant={statusVariant[del.status] as any} /></td>
                <td className="py-3 px-3 text-end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDetailItem(del)}><Eye className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.viewDetails}</DropdownMenuItem>
                      {del.status !== "Delivered" && (
                        <DropdownMenuItem onClick={() => confirmDelivery(del)}><Truck className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.confirmDelivery}</DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(del)} data-testid={`button-delete-delivery-${del.id}`}>
                        <Trash2 className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">{t.noResults}</div>}
      </div>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="حذف التسليم"
        description={`هل تريد حذف التسليم "${deleteTarget?.id}"؟ يمكنك استعادته لاحقاً من سجل الأنشطة.`}
        onConfirm={handleDelete}
        loading={deleting}
      />

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {detailItem && (() => {
            let parsedItems: any[] = [];
            let typeLabel = detailItem.type;
            let isPartial = false;
            try {
              const parsed = JSON.parse(detailItem.type);
              if (parsed.type && Array.isArray(parsed.items)) { parsedItems = parsed.items; typeLabel = parsed.type; isPartial = true; }
            } catch {}

            const totalOrderQty = detailOrderLines.reduce((s, l) => s + l.quantity, 0);
            const thisDeliveryQty = isPartial ? parsedItems.reduce((s: number, i: any) => s + (Number(i.qty) || 0), 0) : totalOrderQty;

            const allOrderDeliveries = [detailItem, ...detailOtherDeliveries];
            const totalDeliveredQty = allOrderDeliveries.filter(d => d.status === "Delivered").reduce((sum, d) => {
              let dItems: any[] = [];
              try { const p = JSON.parse(d.type); if (p.items) dItems = p.items; } catch {}
              if (dItems.length > 0) return sum + dItems.reduce((s: number, i: any) => s + (Number(i.qty) || 0), 0);
              return sum + totalOrderQty;
            }, 0);
            const deliveryProgress = totalOrderQty > 0 ? Math.min(100, Math.round((totalDeliveredQty / totalOrderQty) * 100)) : 0;

            const orderStatus = detailOrderInfo?.status || "";

            return (
              <>
                <div className={`px-6 pt-6 pb-4 border-b ${detailItem.status === "Delivered" ? "bg-green-50 dark:bg-green-950/20" : "bg-orange-50 dark:bg-orange-950/20"}`}>
                  <DialogHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <DialogTitle className="text-lg mb-1">{detailItem.id}</DialogTitle>
                        <p className="text-sm text-muted-foreground">{detailItem.client}</p>
                      </div>
                      <StatusBadge status={detailItem.status} variant={statusVariant[detailItem.status] as any} />
                    </div>
                  </DialogHeader>
                  <div className="flex items-center gap-3 mt-3 text-xs">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium ${isPartial ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                      <Package className="h-3 w-3" /> {typeLabel}
                    </span>
                    {detailItem.deliveryFee > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted font-medium">
                        <DollarSign className="h-3 w-3" /> رسوم: {detailItem.deliveryFee.toLocaleString()}
                      </span>
                    )}
                    {isPartial && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted font-medium">
                        {parsedItems.length} مادة · {thisDeliveryQty} وحدة
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Hash className="h-3 w-3" /> الطلب</div>
                      <button className="font-semibold text-primary text-sm hover:underline" onClick={() => { setDetailItem(null); navigate(`/orders/${detailItem.orderId}`); }}>{detailItem.orderId}</button>
                      {orderStatus && <p className="text-[10px] text-muted-foreground mt-0.5">{orderStatus}</p>}
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><User className="h-3 w-3" /> المندوب</div>
                      <p className="font-semibold text-sm">{detailItem.actor || "—"}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Calendar className="h-3 w-3" /> تاريخ الطلب</div>
                      <p className="font-semibold text-sm">{detailItem.requestedDate || "—"}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Clock className="h-3 w-3" /> تاريخ التسليم</div>
                      <p className={`font-semibold text-sm ${detailItem.status === "Delivered" ? "text-green-600" : ""}`}>{detailItem.status === "Delivered" ? detailItem.actualDate : "لم يسلّم بعد"}</p>
                    </div>
                  </div>

                  {detailOrderLines.length > 0 && (
                    <div className="rounded-xl border bg-muted/20 overflow-hidden">
                      <div className="px-4 py-2.5 border-b bg-muted/40 flex items-center justify-between">
                        <span className="text-xs font-medium flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> تقدم التسليم للطلب</span>
                        <span className="text-xs font-bold">{deliveryProgress}%</span>
                      </div>
                      <div className="px-4 py-2">
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${deliveryProgress >= 100 ? "bg-green-500" : deliveryProgress > 0 ? "bg-amber-500" : "bg-gray-300"}`} style={{ width: `${deliveryProgress}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 text-center">{totalDeliveredQty} من {totalOrderQty} وحدة تم تسليمها ({allOrderDeliveries.filter(d => d.status === "Delivered").length} توصيلة مؤكدة)</p>
                      </div>
                    </div>
                  )}

                  {loadingDetail ? (
                    <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <>
                      {isPartial && parsedItems.length > 0 && (
                        <div>
                          <Label className="text-xs flex items-center gap-1.5 mb-2 font-semibold"><Package className="h-3.5 w-3.5 text-amber-500" /> المواد في هذا التسليم</Label>
                          <div className="border rounded-xl divide-y overflow-hidden">
                            {parsedItems.map((item: any, idx: number) => {
                              const orderLine = detailOrderLines.find(l => String(l.id) === String(item.lineId));
                              const totalQty = orderLine?.quantity || 0;
                              const pct = totalQty > 0 ? Math.round((Number(item.qty) / totalQty) * 100) : 0;
                              return (
                                <div key={idx} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/30">
                                  <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 font-bold text-xs flex-shrink-0">{idx + 1}</div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{item.materialName}</p>
                                    <p className="text-xs text-muted-foreground">{item.materialCode} · {item.unit}</p>
                                  </div>
                                  <div className="text-left flex-shrink-0">
                                    <p className="text-sm font-bold text-primary">{item.qty} <span className="text-xs text-muted-foreground font-normal">/ {totalQty}</span></p>
                                    <p className="text-[10px] text-muted-foreground">{pct}% من الطلب</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {!isPartial && detailOrderLines.length > 0 && (
                        <div>
                          <Label className="text-xs flex items-center gap-1.5 mb-2 font-semibold"><Package className="h-3.5 w-3.5 text-blue-500" /> جميع مواد الطلب (تسليم كامل)</Label>
                          <div className="border rounded-xl divide-y overflow-hidden">
                            {detailOrderLines.map((line, idx) => (
                              <div key={line.id} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/30">
                                <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">{idx + 1}</div>
                                {line.imageUrl && <img src={line.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover flex-shrink-0" />}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{line.materialName}</p>
                                  <p className="text-xs text-muted-foreground">{line.materialCode} · {line.unit}</p>
                                </div>
                                <p className="text-sm font-bold text-primary flex-shrink-0">{line.quantity}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {detailOtherDeliveries.length > 0 && (
                        <div>
                          <Label className="text-xs flex items-center gap-1.5 mb-2 font-semibold"><Truck className="h-3.5 w-3.5 text-muted-foreground" /> توصيلات أخرى لنفس الطلب ({detailOtherDeliveries.length})</Label>
                          <div className="border rounded-xl divide-y overflow-hidden">
                            {detailOtherDeliveries.map(d => (
                              <button key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-sm w-full text-start hover:bg-muted/30" onClick={() => setDetailItem(d)}>
                                <span className="font-mono text-xs text-muted-foreground">{d.id}</span>
                                <StatusBadge status={d.status} variant={statusVariant[d.status] as any} />
                                <span className="text-xs text-muted-foreground mr-auto">{d.requestedDate}</span>
                                <span className="text-xs">{(() => { try { const p = JSON.parse(d.type); return p.type || d.type; } catch { return d.type; } })()}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex gap-2 pt-2">
                    {detailItem.status !== "Delivered" && (
                      <Button className="flex-1" disabled={confirmingDelivery} onClick={async () => {
                        setConfirmingDelivery(true);
                        await confirmDelivery(detailItem);
                        setDeliveries(prev => prev.map(d => d.id === detailItem.id ? { ...d, status: "Delivered", actualDate: new Date().toISOString().split("T")[0] } : d));
                        setDetailItem({ ...detailItem, status: "Delivered", actualDate: new Date().toISOString().split("T")[0] });
                        setConfirmingDelivery(false);
                      }}>
                        {confirmingDelivery ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <CheckCircle2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
                        {t.confirmDelivery}
                      </Button>
                    )}
                    <Button variant="outline" className="flex-1" onClick={() => { setDetailItem(null); navigate(`/orders/${detailItem.orderId}`); }}>
                      <ArrowLeft className="h-4 w-4 ltr:mr-2 rtl:ml-2" /> فتح الطلب
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* New Delivery Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t.newDelivery}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t.selectOrder}</Label>
              <Select value={selectedOrder} onValueChange={setSelectedOrder}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={t.selectOrderPlaceholder} /></SelectTrigger>
                <SelectContent>
                  {orders.filter(o => !["Cancelled", "Closed", "Completed", "Delivered", "مُسلَّم", "مكتمل", "تم التسليم"].includes(o.status)).map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.id} — {o.client} ({o.status})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t.executorLabel}</Label>
              <Select value={selectedActor} onValueChange={setSelectedActor}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={t.selectExecutor} /></SelectTrigger>
                <SelectContent>
                  {actors.map(a => (
                    <SelectItem key={a.id} value={a.name}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedActor === "__other__" && (
                <Input className="h-9 mt-2" placeholder={t.enterActorName || "اكتب اسم المندوب"} value={customActor} onChange={(e) => setCustomActor(e.target.value)} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t.typeLabel}</Label>
                <Select value={deliveryType} onValueChange={setDeliveryType}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">{t.full || "كامل"}</SelectItem>
                    <SelectItem value="partial">{t.partialType || "جزئي"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">{t.dateLabel}</Label><Input className="h-9 mt-1" type="date" value={requestedDate} onChange={(e) => setRequestedDate(e.target.value)} /></div>
            </div>

            {selectedOrder && isFullyDelivered && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-xs text-green-700 dark:text-green-400 font-medium">تم توصيل جميع مواد هذا الطلب بالكامل — لا يمكن إنشاء توصيلة أخرى</span>
              </div>
            )}

            {selectedOrder && !isFullyDelivered && Object.keys(deliveredQtyMap).length > 0 && !deliveredQtyMap.__full__ && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">تم توصيل بعض المواد مسبقاً — المواد المتبقية فقط متاحة للتوصيل</span>
              </div>
            )}

            {deliveryType === "full" && selectedOrder && !isFullyDelivered && Object.keys(deliveredQtyMap).length > 0 && orderLines.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> المواد المتبقية التي سيتم توصيلها</Label>
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {orderLines.map(line => (
                    <div key={line.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                      {line.imageUrl && <img src={line.imageUrl} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{line.materialName}</p>
                        <p className="text-xs text-muted-foreground">{line.materialCode} · {line.unit}</p>
                      </div>
                      <span className="text-sm font-semibold text-primary">{line.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {deliveryType === "partial" && selectedOrder && !isFullyDelivered && (
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> اختر المواد للتسليم</Label>
                {loadingLines ? (
                  <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : orderLines.length === 0 ? (
                  <div className="text-center py-3 text-xs text-muted-foreground">لا توجد مواد في هذا الطلب</div>
                ) : (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {orderLines.map(line => {
                      const item = partialItems[line.id] || { selected: false, qty: line.quantity };
                      return (
                        <div key={line.id} className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${item.selected ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={(checked) => setPartialItems(prev => ({ ...prev, [line.id]: { ...prev[line.id], selected: !!checked } }))}
                          />
                          {line.imageUrl && <img src={line.imageUrl} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{line.materialName}</p>
                            <p className="text-xs text-muted-foreground">{line.materialCode} · {line.unit}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Input
                              type="number" min={1} max={line.quantity}
                              className="h-7 w-16 text-center text-xs"
                              value={item.qty}
                              disabled={!item.selected}
                              onChange={(e) => {
                                const v = Math.min(Math.max(1, Number(e.target.value) || 1), line.quantity);
                                setPartialItems(prev => ({ ...prev, [line.id]: { ...prev[line.id], qty: v } }));
                              }}
                            />
                            <span className="text-xs text-muted-foreground">/ {line.quantity}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {orderLines.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    {Object.values(partialItems).filter(v => v.selected).length} من {orderLines.length} مادة مختارة
                  </p>
                )}
              </div>
            )}

            <Button className="w-full" onClick={handleAdd} disabled={saving || isFullyDelivered || (deliveryType === "partial" && loadingLines) || (deliveryType === "full" && selectedOrder && orderLines.length === 0 && !loadingLines)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (t.createDelivery || "إنشاء التسليم")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
