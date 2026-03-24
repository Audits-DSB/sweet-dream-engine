import { useState, useMemo, useEffect } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Eye, MoreHorizontal, Truck, FileText, Copy, Trash2, Search, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { logAudit } from "@/lib/auditLog";
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
  deliveryFee: number; status: string; source: string;
};

type Client = { id: string; name: string; city: string; status: string; };

type MaterialItem = {
  code: string; name: string; category: string; unit: string;
  sellingPrice: number; storeCost: number; active: boolean; imageUrl: string;
};

interface OrderItem {
  materialCode: string; name: string; quantity: number;
  sellingPrice: number; costPrice: number; imageUrl: string; unit: string;
}

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
  const [form, setForm] = useState({ splitMode: rules.defaultSplitMode, deliveryFee: String(rules.defaultDeliveryFee) });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [materialSearch, setMaterialSearch] = useState("");
  const [realMaterials, setRealMaterials] = useState<MaterialItem[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (dialogOpen) {
      setForm({ splitMode: rules.defaultSplitMode, deliveryFee: String(rules.defaultDeliveryFee) });
    }
  }, [dialogOpen, rules.defaultSplitMode, rules.defaultDeliveryFee]);

  useEffect(() => {
    Promise.all([
      api.get<any[]>("/orders"),
      api.get<any[]>("/clients"),
    ]).then(([ordersData, clientsData]) => {
      const clientMap: Record<string, string> = {};
      const clientArr = (clientsData || []).map((c: any) => {
        clientMap[c.id] = c.name || "";
        return { id: c.id, name: c.name, city: c.city || "", status: c.status || "Active" };
      });
      setClients(clientArr);
      setOrders((ordersData || []).map(raw => {
        const o = mapOrder(raw);
        if (!o.client && o.clientId) o.client = clientMap[o.clientId] || o.clientId;
        return o;
      }));
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
            imageUrl: p.image_url || p.image || "",
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
    const activeStatuses = ["Draft", "Confirmed", "Ready for Delivery"];
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
    setOrderItems([...orderItems, { materialCode: mat.code, name: mat.name, quantity: 1, sellingPrice: mat.sellingPrice, costPrice: mat.storeCost, imageUrl: mat.imageUrl, unit: mat.unit }]);
    setMaterialSearch("");
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const updated = [...orderItems];
    (updated[index] as any)[field] = value;
    setOrderItems(updated);
  };

  const removeItem = (index: number) => setOrderItems(orderItems.filter((_, i) => i !== index));

  const totalSelling = orderItems.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0);
  const totalCost = orderItems.reduce((sum, i) => sum + i.costPrice * i.quantity, 0);

  const handleAdd = async () => {
    if (!selectedClient || orderItems.length === 0) { toast.error(t.selectClientAndTotal); return; }
    const client = clients.find(c => c.id === selectedClient);
    if (!client) return;
    setSaving(true);
    try {
      const { nextId: newId } = await api.get<{ nextId: string }>("/orders/next-id");
      const today = new Date().toISOString().split("T")[0];
      const splitLabel = form.splitMode === "equal" ? t.equal : t.byContribution;
      const saved = await api.post<any>("/orders", {
        id: newId, clientId: client.id, date: today,
        lines: orderItems.length,
        totalSelling: String(totalSelling),
        totalCost: String(totalCost),
        splitMode: splitLabel, deliveryFee: String(parseInt(form.deliveryFee) || 0),
        status: "Draft", source: t.manual,
        items: orderItems,
      });
      if (saved._linesError) {
        toast.warning(`تم حفظ الطلب لكن فشل حفظ تفاصيل المواد: ${saved._linesError}`);
      }
      await logAudit({ entity: "order", entityId: saved.id || newId, entityName: `${saved.id || newId} - ${client.name}`, action: "create", snapshot: saved, endpoint: "/orders" });
      setOrders(prev => [mapOrder(saved), ...prev]);
      setForm({ splitMode: rules.defaultSplitMode, deliveryFee: String(rules.defaultDeliveryFee) });
      setSelectedClient(""); setOrderItems([]); setDialogOpen(false);
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
      await api.delete(`/orders/${deleteTarget.id}`);
      await logAudit({ entity: "order", entityId: deleteTarget.id, entityName: `${deleteTarget.id} - ${deleteTarget.client}`, action: "delete", snapshot: deleteTarget as any, endpoint: "/orders" });
      setOrders(prev => prev.filter(o => o.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success(`تم حذف الطلب: ${deleteTarget.id}`);
    } catch (err: any) {
      toast.error(err?.message || "فشل حذف الطلب");
    } finally {
      setDeleting(false);
    }
  };

  const statusOptions = [
    { label: t.draft, value: "Draft" }, { label: t.confirmed, value: "Confirmed" },
    { label: t.awaitingPurchase, value: "Awaiting Purchase" }, { label: t.readyForDelivery, value: "Ready for Delivery" },
    { label: t.partiallyDelivered, value: "Partially Delivered" }, { label: t.delivered, value: "Delivered" },
    { label: t.invoiced, value: "Invoiced" }, { label: t.closed, value: "Closed" }, { label: t.cancelled, value: "Cancelled" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.ordersTitle}</h1>
        <p className="page-description">{orders.length} {t.orderCount} · {orders.filter(o => ["Draft", "Confirmed", "Ready for Delivery"].includes(o.status)).length} {t.activeOrdersCount}</p>
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
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.lines}</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.selling}</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.costCol}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.splitMode}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.source}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                  <td className="py-3 px-3 font-mono text-xs font-medium">{order.id}</td>
                  <td className="py-3 px-3 font-medium hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${order.clientId}`); }}>{order.client}</td>
                  <td className="py-3 px-3 text-muted-foreground">{order.date}</td>
                  <td className="py-3 px-3 text-end">{order.lines}</td>
                  <td className="py-3 px-3 text-end font-medium">{order.totalSelling}</td>
                  <td className="py-3 px-3 text-end text-muted-foreground">{order.totalCost}</td>
                  <td className="py-3 px-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{order.splitMode}</span></td>
                  <td className="py-3 px-3 text-xs text-muted-foreground">{order.source}</td>
                  <td className="py-3 px-3"><StatusBadge status={order.status} /></td>
                  <td className="py-3 px-3 text-end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/orders/${order.id}`)}><Eye className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.viewDetails}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate("/deliveries")}><Truck className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.registerDelivery}</DropdownMenuItem>
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
              ))}
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

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setOrderItems([]); setSelectedClient(""); setMaterialSearch(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader><DialogTitle>{t.newOrder}</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-2">
            <div className="space-y-4">
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

              <div>
                <Label className="text-xs font-medium mb-2 block">{t.orderItemsLabel} *</Label>
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="h-9 ps-9 text-xs" placeholder={t.searchMaterials} value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} />
                </div>
                {materialSearch && filteredMaterials.length > 0 && (
                  <div className="border border-border rounded-md mt-1 max-h-40 overflow-y-auto bg-background shadow-md">
                    {filteredMaterials.slice(0, 8).map(mat => (
                      <div key={mat.code} className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer text-xs transition-colors" onClick={() => addMaterialDirectly(mat)}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-muted-foreground">{mat.code}</span>
                          <span className="font-medium">{mat.name}</span>
                          <span className="text-muted-foreground">({mat.category})</span>
                        </div>
                        <span className="text-muted-foreground">{mat.sellingPrice} {t.currency}</span>
                      </div>
                    ))}
                  </div>
                )}
                {materialsLoading && <div className="text-center py-2 text-muted-foreground text-xs mt-1 flex items-center justify-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {t.loadingMaterials}</div>}
                {!materialsLoading && materialSearch && filteredMaterials.length === 0 && <div className="text-center py-2 text-muted-foreground text-xs mt-1">{t.noResults}</div>}
              </div>

              {orderItems.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-border rounded-md text-muted-foreground text-xs">{t.noItemsAdded}</div>
              ) : (
                <div className="space-y-2">
                  {orderItems.map((item, idx) => (
                    <div key={idx} className="border border-border rounded-md p-3 space-y-2 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-muted-foreground">{item.materialCode}</span>
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeItem(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div><Label className="text-[10px] text-muted-foreground">{t.quantity}</Label><Input className="h-7 text-xs mt-0.5" type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} /></div>
                        <div><Label className="text-[10px] text-muted-foreground">{t.sellingPrice}</Label><Input className="h-7 text-xs mt-0.5" type="number" value={item.sellingPrice} onChange={(e) => updateItem(idx, "sellingPrice", parseFloat(e.target.value) || 0)} /></div>
                        <div><Label className="text-[10px] text-muted-foreground">{t.costPrice}</Label><Input className="h-7 text-xs mt-0.5" type="number" value={item.costPrice} onChange={(e) => updateItem(idx, "costPrice", parseFloat(e.target.value) || 0)} /></div>
                      </div>
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
