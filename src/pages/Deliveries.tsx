import { useState, useEffect } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, MoreHorizontal, Truck, Plus } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ordersList, deliveryActors, clientsList } from "@/data/store";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const initialDeliveries = [
  { id: "DEL-035", order: "ORD-048", client: "عيادة د. أحمد", clientId: "C001", requestedDate: "2025-03-08", actualDate: "—", actor: "أحمد (مؤسس)", items: 4, type: "كامل", status: "Pending" },
  { id: "DEL-034", order: "ORD-047", client: "مركز نور لطب الأسنان", clientId: "C002", requestedDate: "2025-03-07", actualDate: "—", actor: "DHL Express", items: 7, type: "كامل", status: "In Transit" },
  { id: "DEL-033", order: "ORD-046", client: "عيادة جرين فالي", clientId: "C003", requestedDate: "2025-03-06", actualDate: "2025-03-06", actor: "شركة توصيل سريع", items: 3, type: "كامل", status: "Delivered" },
  { id: "DEL-032", order: "ORD-044", client: "عيادة بلو مون", clientId: "C006", requestedDate: "2025-03-03", actualDate: "2025-03-03", actor: "سارة (مؤسس)", items: 4, type: "جزئي", status: "Delivered" },
  { id: "DEL-031", order: "ORD-044", client: "عيادة بلو مون", clientId: "C006", requestedDate: "2025-03-05", actualDate: "—", actor: "أحمد (مؤسس)", items: 2, type: "جزئي", status: "Pending" },
  { id: "DEL-030", order: "ORD-045", client: "المركز الملكي للأسنان", clientId: "C004", requestedDate: "2025-03-02", actualDate: "2025-03-02", actor: "DHL Express", items: 5, type: "كامل", status: "Delivered" },
  { id: "DEL-029", order: "ORD-043", client: "عيادة سمايل هاوس", clientId: "C005", requestedDate: "2025-02-28", actualDate: "2025-03-01", actor: "أحمد (مؤسس)", items: 2, type: "كامل", status: "Delivered" },
];

const deliveryStatusMap: Record<string, string> = {
  "Pending": "warning", "In Transit": "info", "Delivered": "success", "Failed": "destructive",
};

export default function DeliveriesPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const status = searchParams.get("status");
    return status ? { status } : {};
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<typeof initialDeliveries[0] | null>(null);
  const [selectedOrder, setSelectedOrder] = useState("");
  const [selectedActor, setSelectedActor] = useState("");
  const [deliveryType, setDeliveryType] = useState("full");
  const [requestedDate, setRequestedDate] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    const status = searchParams.get("status");
    setFilters(status ? { status } : {});
  }, [searchParams]);

  const sendNotification = async (title: string, body: string, type: string = "info") => {
    await api.post("/notifications", {
      id: `NOT-${Date.now()}`,
      type, title, message: body || "",
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      read: false, userId: user?.id || "",
    });
  };

  const filtered = deliveries.filter((d) => {
    const matchSearch = !search || d.client.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase()) || d.order.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || d.status === filters.status;
    return matchSearch && matchStatus;
  });

  const handleAdd = () => {
    if (!selectedOrder) { toast.error(t.pleaseSelectOrder); return; }
    const order = ordersList.find(o => o.id === selectedOrder);
    if (!order) return;
    const num = deliveries.length > 0 ? parseInt(deliveries[0].id.split("-")[1]) + 1 : 36;
    const newId = `DEL-${String(num).padStart(3, "0")}`;
    const today = requestedDate || new Date().toISOString().split("T")[0];
    const typeLabel = deliveryType === "full" ? t.full : t.partialType;
    setDeliveries([{
      id: newId, order: order.id, client: order.client, clientId: order.clientId, requestedDate: today,
      actualDate: "—", actor: selectedActor || "—", items: order.lines, type: typeLabel, status: "Pending",
    }, ...deliveries]);
    sendNotification(t.newDelivery, `${newId} - ${order.client}`, "info");
    setSelectedOrder(""); setSelectedActor(""); setDeliveryType("full"); setRequestedDate("");
    setDialogOpen(false);
    toast.success(t.deliveryCreated);
  };

  const confirmDelivery = (del: typeof initialDeliveries[0]) => {
    setDeliveries(deliveries.map(d => d.id === del.id ? { ...d, status: "Delivered", actualDate: new Date().toISOString().split("T")[0] } : d));
    toast.success(`${t.deliveryConfirmedMsg}: ${del.id}`);
    sendNotification(t.deliveryConfirmed, `${del.id} - ${del.client}`, "success");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.deliveriesTitle}</h1>
        <p className="page-description">{deliveries.length} {t.deliveryCount} · {deliveries.filter(d => d.status === "Pending").length} {t.pendingCount}</p>
      </div>

      <DataToolbar
        searchPlaceholder={t.searchDeliveries}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[{ label: t.status, value: "status", options: [
          { label: t.pending, value: "Pending" }, { label: t.inTransit, value: "In Transit" }, { label: t.delivered, value: "Delivered" },
        ]}]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("deliveries", [t.code, t.order, t.client, t.requestedDate, t.actualDate, t.executor, t.items, t.type, t.status], filtered.map(d => [d.id, d.order, d.client, d.requestedDate, d.actualDate, d.actor, d.items, d.type, d.status]))}
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
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.items}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.type}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((del) => (
              <tr key={del.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetailItem(del)}>
                <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{del.id}</td>
                <td className="py-3 px-3 font-mono text-xs hover:text-primary cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/orders/${del.order}`); }}>{del.order}</td>
                <td className="py-3 px-3 font-medium hover:text-primary cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${del.clientId}`); }}>{del.client}</td>
                <td className="py-3 px-3 text-muted-foreground text-xs">{del.requestedDate}</td>
                <td className="py-3 px-3 text-xs">{del.actualDate}</td>
                <td className="py-3 px-3 text-muted-foreground">{del.actor}</td>
                <td className="py-3 px-3 text-end">{del.items}</td>
                <td className="py-3 px-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{del.type}</span></td>
                <td className="py-3 px-3"><StatusBadge status={del.status} variant={deliveryStatusMap[del.status] as any} /></td>
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">{t.noResults}</div>}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detailItem?.id} — {detailItem?.client}</DialogTitle></DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70" onClick={() => { setDetailItem(null); navigate(`/orders/${detailItem.order}`); }}><p className="text-xs text-muted-foreground">{t.order}</p><p className="font-semibold text-primary">{detailItem.order}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.executor}</p><p className="font-semibold">{detailItem.actor}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.requestedDate}</p><p className="font-semibold">{detailItem.requestedDate}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.actualDate}</p><p className="font-semibold">{detailItem.actualDate}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.items}</p><p className="font-semibold">{detailItem.items}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.type}</p><p className="font-semibold">{detailItem.type}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t.status}:</span>
                <StatusBadge status={detailItem.status} variant={deliveryStatusMap[detailItem.status] as any} />
              </div>
              {detailItem.status !== "Delivered" && (
                <Button className="w-full" onClick={() => { confirmDelivery(detailItem); setDetailItem(null); }}>
                  <Truck className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t.confirmDelivery}
                </Button>
              )}
            </div>
          )}
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
                  {ordersList.filter(o => !["Cancelled", "Closed"].includes(o.status)).map(o => (
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
                  {deliveryActors.map(a => (
                    <SelectItem key={a.id} value={a.name}>{a.name} ({a.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t.typeLabel}</Label>
                <Select value={deliveryType} onValueChange={setDeliveryType}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">{t.full}</SelectItem>
                    <SelectItem value="partial">{t.partialType}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">{t.dateLabel}</Label><Input className="h-9 mt-1" type="date" value={requestedDate} onChange={(e) => setRequestedDate(e.target.value)} /></div>
            </div>
            <Button className="w-full" onClick={handleAdd}>{t.createDelivery}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
