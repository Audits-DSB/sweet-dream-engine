import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Eye, MoreHorizontal, Truck, FileText, Copy, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { clientsList, ordersList as initialData, materialsList } from "@/data/store";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OrderItem {
  materialCode: string;
  name: string;
  quantity: number;
  sellingPrice: number;
  costPrice: number;
}

export default function OrdersPage() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState(initialData);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [form, setForm] = useState({ splitMode: "equal", deliveryFee: "500" });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const navigate = useNavigate();

  const filtered = orders.filter((o) => {
    const matchSearch = !search || o.client.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || o.status === filters.status;
    return matchSearch && matchStatus;
  });

  const addItem = () => {
    setOrderItems([...orderItems, { materialCode: "", name: "", quantity: 1, sellingPrice: 0, costPrice: 0 }]);
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const updated = [...orderItems];
    if (field === "materialCode") {
      const mat = materialsList.find(m => m.code === value);
      if (mat) {
        updated[index] = { ...updated[index], materialCode: mat.code, name: mat.name, sellingPrice: mat.sellingPrice, costPrice: mat.storeCost };
      }
    } else {
      (updated[index] as any)[field] = value;
    }
    setOrderItems(updated);
  };

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const totalSelling = orderItems.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
  const totalCost = orderItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);

  const handleAdd = () => {
    if (!selectedClient || orderItems.length === 0 || orderItems.some(i => !i.materialCode)) {
      toast.error(t.selectClientAndTotal);
      return;
    }
    const client = clientsList.find(c => c.id === selectedClient);
    if (!client) return;
    const num = orders.length > 0 ? parseInt(orders[0].id.split("-")[1]) + 1 : 49;
    const newId = `ORD-${String(num).padStart(3, "0")}`;
    const today = new Date().toISOString().split("T")[0];
    const splitLabel = form.splitMode === "equal" ? t.equal : t.byContribution;
    setOrders([{
      id: newId, client: client.name, clientId: client.id, date: today, lines: orderItems.length,
      totalSelling: `${totalSelling.toLocaleString()} ${t.currency}`, totalCost: `${totalCost.toLocaleString()} ${t.currency}`,
      splitMode: splitLabel, deliveryFee: parseInt(form.deliveryFee) || 0, status: "Draft", source: t.manual,
    }, ...orders]);
    setForm({ splitMode: "equal", deliveryFee: "500" });
    setSelectedClient("");
    setOrderItems([]);
    setDialogOpen(false);
    toast.success(t.orderCreated);
  };

  const statusOptions = [
    { label: t.draft, value: "Draft" }, { label: t.confirmed, value: "Confirmed" },
    { label: t.awaitingPurchase, value: "Awaiting Purchase" }, { label: t.readyForDelivery, value: "Ready for Delivery" },
    { label: t.partiallyDelivered, value: "Partially Delivered" }, { label: t.delivered, value: "Delivered" },
    { label: t.invoiced, value: "Invoiced" }, { label: t.closed, value: "Closed" }, { label: t.cancelled, value: "Cancelled" },
  ];

  const usedMaterialCodes = orderItems.map(i => i.materialCode);

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
                      <DropdownMenuItem onClick={() => { navigate("/deliveries"); }}><Truck className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.registerDelivery}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(`${t.createInvoice}: ${order.id}`)}><FileText className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.createInvoice}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(`${t.copy}: ${order.id}`)}><Copy className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.copy}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">{t.noResults}</div>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setOrderItems([]); setSelectedClient(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader><DialogTitle>{t.newOrder}</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-2">
            <div className="space-y-4">
              {/* Client Selection */}
              <div>
                <Label className="text-xs">{t.client} *</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={t.selectClientPlaceholder} /></SelectTrigger>
                  <SelectContent>
                    {clientsList.filter(c => c.status === "Active").map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} — {c.city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Order Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium">{t.orderItemsLabel} *</Label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addItem}>
                    <Plus className="h-3 w-3 ltr:mr-1 rtl:ml-1" />{t.addItem}
                  </Button>
                </div>

                {orderItems.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-border rounded-md text-muted-foreground text-xs">
                    {t.noItemsAdded}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orderItems.map((item, idx) => (
                      <div key={idx} className="border border-border rounded-md p-3 space-y-2 bg-muted/20">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <Select value={item.materialCode} onValueChange={(v) => updateItem(idx, "materialCode", v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t.selectMaterial} /></SelectTrigger>
                              <SelectContent>
                                {materialsList.filter(m => m.active && (!usedMaterialCodes.includes(m.code) || m.code === item.materialCode)).map(m => (
                                  <SelectItem key={m.code} value={m.code}>
                                    <span className="font-mono text-muted-foreground">{m.code}</span> — {m.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">{t.quantity}</Label>
                            <Input className="h-7 text-xs mt-0.5" type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">{t.sellingPrice}</Label>
                            <Input className="h-7 text-xs mt-0.5" type="number" value={item.sellingPrice} onChange={(e) => updateItem(idx, "sellingPrice", parseFloat(e.target.value) || 0)} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">{t.costPrice}</Label>
                            <Input className="h-7 text-xs mt-0.5" type="number" value={item.costPrice} onChange={(e) => updateItem(idx, "costPrice", parseFloat(e.target.value) || 0)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals Summary */}
              {orderItems.length > 0 && (
                <div className="bg-muted/40 rounded-md p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t.totalSelling}:</span><span className="font-medium">{totalSelling.toLocaleString()} {t.currency}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t.totalCost}:</span><span className="font-medium">{totalCost.toLocaleString()} {t.currency}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t.lines}:</span><span className="font-medium">{orderItems.length}</span></div>
                </div>
              )}

              {/* Settings */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t.deliveryFee}</Label>
                  <Input className="h-9 mt-1" type="number" value={form.deliveryFee} onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })} />
                </div>
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

              <Button className="w-full" onClick={handleAdd}>{t.createOrder}</Button>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
