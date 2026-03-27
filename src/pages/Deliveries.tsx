import { useState, useEffect } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, MoreHorizontal, Truck, Plus, Loader2, Trash2, X, Package } from "lucide-react";
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
  const [requestedDate, setRequestedDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Delivery | null>(null);
  const [deleting, setDeleting] = useState(false);

  type OrderLine = { id: string; materialCode: string; materialName: string; quantity: number; unit: string; imageUrl?: string };
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [partialItems, setPartialItems] = useState<Record<string, { selected: boolean; qty: number }>>({});

  useEffect(() => {
    if (!selectedOrder || deliveryType !== "partial") { setOrderLines([]); setPartialItems({}); return; }
    let cancelled = false;
    setLoadingLines(true);
    setOrderLines([]);
    setPartialItems({});
    api.get<any[]>(`/orders/${selectedOrder}/lines`).then(lines => {
      if (cancelled) return;
      const mapped = (lines || []).filter((l: any) => (Number(l.quantity) || 0) > 0).map((l: any) => ({
        id: l.id, materialCode: l.materialCode || l.material_code || "",
        materialName: l.materialName || l.material_name || l.name || "",
        quantity: Number(l.quantity) || 0, unit: l.unit || "",
        imageUrl: l.imageUrl || l.image_url || "",
      }));
      setOrderLines(mapped);
      const init: Record<string, { selected: boolean; qty: number }> = {};
      mapped.forEach(l => { init[l.id] = { selected: false, qty: l.quantity }; });
      setPartialItems(init);
    }).catch(() => { if (!cancelled) { setOrderLines([]); setPartialItems({}); } }).finally(() => { if (!cancelled) setLoadingLines(false); });
    return () => { cancelled = true; };
  }, [selectedOrder, deliveryType]);

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
    const order = orders.find(o => o.id === selectedOrder);
    if (!order) return;

    if (deliveryType === "partial") {
      const selectedLines = Object.entries(partialItems).filter(([, v]) => v.selected && v.qty > 0);
      if (selectedLines.length === 0) { toast.error("اختر مادة واحدة على الأقل للتسليم الجزئي"); return; }
    }

    setSaving(true);
    const today = requestedDate || new Date().toISOString().split("T")[0];
    const typeLabel = deliveryType === "full" ? (t.full || "كامل") : (t.partialType || "جزئي");
    const newId = `DEL-${Date.now().toString().slice(-6)}`;
    const actorName = selectedActor === "__other__" ? (customActor.trim() || "") : (selectedActor || "");

    let itemsCount = 0;
    let notesPayload = typeLabel;

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
      try {
        const lines = await api.get<any[]>(`/orders/${order.id}/lines`);
        itemsCount = (lines || []).length;
      } catch {}
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
      setSelectedOrder(""); setSelectedActor(""); setCustomActor(""); setDeliveryType("full"); setRequestedDate(""); setOrderLines([]); setPartialItems({});
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detailItem?.id} — {detailItem?.client}</DialogTitle></DialogHeader>
          {detailItem && (() => {
            let parsedItems: any[] = [];
            let typeLabel = detailItem.type;
            try {
              const parsed = JSON.parse(detailItem.type);
              if (parsed.type && Array.isArray(parsed.items)) { parsedItems = parsed.items; typeLabel = parsed.type; }
            } catch {}
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70" onClick={() => { setDetailItem(null); navigate(`/orders/${detailItem.orderId}`); }}>
                    <p className="text-xs text-muted-foreground">{t.order}</p><p className="font-semibold text-primary">{detailItem.orderId}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.executor}</p><p className="font-semibold">{detailItem.actor}</p></div>
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.requestedDate}</p><p className="font-semibold">{detailItem.requestedDate}</p></div>
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.actualDate}</p><p className="font-semibold">{detailItem.actualDate}</p></div>
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.type}</p><p className="font-semibold">{typeLabel}</p></div>
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.status}</p><StatusBadge status={detailItem.status} variant={statusVariant[detailItem.status] as any} /></div>
                </div>
                {parsedItems.length > 0 && (
                  <div>
                    <Label className="text-xs flex items-center gap-1.5 mb-2"><Package className="h-3.5 w-3.5" /> المواد المشمولة في التسليم</Label>
                    <div className="border rounded-lg divide-y">
                      {parsedItems.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 px-3 py-2 text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.materialName}</p>
                            <p className="text-xs text-muted-foreground">{item.materialCode} · {item.unit}</p>
                          </div>
                          <span className="text-sm font-bold text-primary">{item.qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {detailItem.status !== "Delivered" && (
                  <Button className="w-full" onClick={() => { confirmDelivery(detailItem); setDetailItem(null); }}>
                    <Truck className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t.confirmDelivery}
                  </Button>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* New Delivery Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.newDelivery}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t.selectOrder}</Label>
              <Select value={selectedOrder} onValueChange={setSelectedOrder}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={t.selectOrderPlaceholder} /></SelectTrigger>
                <SelectContent>
                  {orders.filter(o => !["Cancelled", "Closed"].includes(o.status)).map(o => (
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

            {deliveryType === "partial" && selectedOrder && (
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

            <Button className="w-full" onClick={handleAdd} disabled={saving || (deliveryType === "partial" && loadingLines)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (t.createDelivery || "إنشاء التسليم")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
