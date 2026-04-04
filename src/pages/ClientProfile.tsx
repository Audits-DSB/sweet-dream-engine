import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Package, Receipt, TrendingUp, ClipboardCheck, Loader2, ExternalLink, AlertTriangle, Plus, X, BarChart3 } from "lucide-react";
import { parsePhones, serializePhones, type PhoneEntry } from "@/lib/phoneUtils";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { logAudit } from "@/lib/auditLog";
import { toast } from "sonner";

type Client = {
  id: string; name: string; contact: string; email: string; phone: string;

  city: string; status: string; joinDate: string; totalOrders: number;
  outstanding: number;
};

type Order = {
  id: string; date: string; totalSelling: string; totalCost: string; status: string;
};

type InventoryLot = {
  id: string; material: string; code: string; unit: string;
  delivered: number; remaining: number; sellingPrice: number;
  deliveryDate: string; expiry: string; sourceOrder: string; status: string;
  imageUrl: string;
};

function mapClient(raw: any): Client {
  return {
    id: raw.id,
    name: raw.name || "",
    contact: raw.contact || "",
    email: raw.email || "",
    phone: raw.phone || "",
    city: raw.city || "",
    status: raw.status || "Active",
    joinDate: raw.joinDate || raw.join_date || "",
    totalOrders: Number(raw.totalOrders ?? raw.total_orders ?? 0),
    outstanding: Number(raw.outstanding ?? 0),
  };
}

function mapOrder(raw: any): Order {
  return {
    id: raw.id,
    date: raw.date || "",
    totalSelling: raw.totalSelling ?? raw.total_selling ?? "0",
    totalCost: raw.totalCost ?? raw.total_cost ?? "0",
    status: raw.status || "",
  };
}

function statusColor(status: string) {
  if (status === "Low Stock") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  if (status === "Depleted") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  if (status === "Expired") return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
}

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const isEn = lang === "en";
  const { profile } = useAuth();
  const _userName = profile?.full_name || "مستخدم";
  const [client, setClient] = useState<Client | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", contact: "", email: "", phone: "", city: "", status: "Active" });
  const [editPhones, setEditPhones] = useState<PhoneEntry[]>([{ name: "", number: "" }]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<any[]>("/clients"),
      api.get<any[]>("/orders"),
      // Server-side enriched: includes imageUrl from order_lines automatically
      api.get<any[]>(`/client-inventory?clientId=${id}`).catch(() => []),
    ]).then(([clientsData, ordersData, invData]) => {
      const found = (clientsData || []).find((c: any) => c.id === id);
      if (found) {
        const c = mapClient(found);
        setClient(c);
        setEditForm({ name: c.name, contact: c.contact, email: c.email, phone: c.phone, city: c.city, status: c.status });
        const parsed = parsePhones(c.phone);
        setEditPhones(parsed.length > 0 ? parsed : [{ name: "", number: "" }]);
      }
      const clientOrders = (ordersData || [])
        .filter((o: any) => (o.clientId || o.client_id) === id)
        .map(mapOrder);
      setOrders(clientOrders);

      setInventory((invData || []).map((r: any) => {
        const code = r.code || r.materialCode || "";
        return {
          id: r.id,
          material: r.material || "",
          code,
          unit: r.unit || "",
          delivered: Number(r.delivered ?? 0),
          remaining: Number(r.remaining ?? 0),
          sellingPrice: Number(r.sellingPrice ?? r.selling_price ?? 0),
          deliveryDate: r.deliveryDate || r.delivery_date || "",
          expiry: r.expiry || "",
          sourceOrder: r.sourceOrder || r.source_order || "",
          status: r.status || "In Stock",
          imageUrl: r.imageUrl || r.image_url || "",
        };
      }));
    }).catch(() => toast.error(t.failedToLoadClientData))
      .finally(() => setLoading(false));
  }, [id]);

  const handleEditSave = async () => {
    if (!client) return;
    setSaving(true);
    try {
      const phoneSerialized = serializePhones(editPhones);
      const patchData = { ...editForm, phone: phoneSerialized };
      await api.patch(`/clients/${client.id}`, patchData);
      await logAudit({ entity: "client", entityId: client.id, entityName: editForm.name || client.name, action: "update", snapshot: { ...client, ...patchData }, endpoint: "/clients", performedBy: _userName });
      setClient({ ...client, ...patchData });
      setEditOpen(false);
      toast.success(t.clientUpdated);
    } catch {
      toast.error(t.failedToUpdateClient);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/clients")}><ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t.back}</Button>
        <div className="text-center py-16 text-muted-foreground">{t.clientNotFound}</div>
      </div>
    );
  }

  const inventoryValue = inventory.reduce((sum, lot) => sum + lot.remaining * lot.sellingPrice, 0);
  const lowStockCount = inventory.filter(l => l.status === "Low Stock" || l.status === "Depleted").length;

  const stats = [
    { label: t.totalOrders, value: orders.length, icon: Package },
    { label: t.outstanding, value: `${client.outstanding.toLocaleString()} ${t.currency}`, icon: TrendingUp },
    { label: t.totalPaid, value: `${inventory.length} ${t.materialCol || "صنف"}`, icon: Receipt },
    { label: t.inventoryValue, value: `${inventoryValue.toLocaleString()} ${t.currency}`, icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/clients")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3"><h1 className="page-header">{client.name}</h1><StatusBadge status={client.status} /></div>
          <p className="page-description">{client.id} · {t.contactPerson}: {client.contact}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/clients/${id}/report`)} className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            {isEn ? "Client Report" : "تقرير العميل"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/clients/${id}/analysis`)} className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            {isEn ? "Internal Analysis" : "تحليل داخلي"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>{t.editClient}</Button>
        </div>
      </div>

      <div className="stat-card">
        <div className="flex flex-wrap gap-6 text-sm">
          {client.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />{client.email}</div>}
          {client.phone && (() => {
            const phonesArr = parsePhones(client.phone);
            return phonesArr.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <a href={`tel:${p.number}`} className="hover:text-primary" dir="ltr">{p.number}</a>
                {p.name && <span className="text-xs text-muted-foreground/70">({p.name})</span>}
              </div>
            ));
          })()}
          {client.city && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" />{client.city}</div>}
          {client.joinDate && <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" />{t.clientProfileJoined} {client.joinDate}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center gap-2 mb-1"><stat.icon className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">{stat.label}</span></div>
            <p className="text-xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="orders">{t.ordersTab}</TabsTrigger>
          <TabsTrigger value="inventory">{t.inventoryTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <div className="stat-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.orderNumber}</th>
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.date}</th>
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
                  <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.totalAmount}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                    <td className="py-2.5 px-3 font-medium text-primary">{order.id}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{order.date}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={order.status} /></td>
                    <td className="py-2.5 px-3 text-end font-medium">{order.totalSelling} {t.currency}</td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={4} className="py-10 text-center text-muted-foreground text-sm">{t.noResults}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="inventory">
          <div className="stat-card overflow-hidden">
            {/* Header with link to full inventory page */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">مخزون العميل</span>
                <span className="text-xs text-muted-foreground">({inventory.length} صنف)</span>
                {lowStockCount > 0 && (
                  <Badge variant="destructive" className="text-xs py-0 px-1.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {lowStockCount} يحتاج تجديد
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate("/inventory")}>
                <ExternalLink className="h-3 w-3" />
                صفحة المخزون الكاملة
              </Button>
            </div>

            {inventory.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا يوجد مخزون لهذا العميل</p>
                <p className="text-xs mt-1">يُضاف المخزون تلقائياً عند تأكيد التسليم</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">المادة</th>
                      <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">الكود</th>
                      <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">الطلب</th>
                      <th className="text-center py-2.5 px-3 text-xs font-medium text-muted-foreground">المُسلَّم</th>
                      <th className="text-center py-2.5 px-3 text-xs font-medium text-muted-foreground">المتبقي</th>
                      <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">القيمة</th>
                      <th className="text-center py-2.5 px-3 text-xs font-medium text-muted-foreground">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((lot) => (
                      <tr key={lot.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-md border border-border overflow-hidden bg-muted/50 flex-shrink-0 flex items-center justify-center">
                              {lot.imageUrl
                                ? <img src={lot.imageUrl} alt={lot.material} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                : <Package className="h-4 w-4 text-muted-foreground" />}
                            </div>
                            <span className="font-medium">{lot.material}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{lot.code}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className="text-xs text-primary cursor-pointer hover:underline"
                            onClick={() => navigate(`/orders/${lot.sourceOrder}`)}
                          >
                            {lot.sourceOrder}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">{lot.delivered} {lot.unit}</td>
                        <td className="py-2.5 px-3 text-center font-semibold">{lot.remaining} {lot.unit}</td>
                        <td className="py-2.5 px-3 text-end font-medium">
                          {(lot.remaining * lot.sellingPrice).toLocaleString()} {t.currency}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(lot.status)}`}>
                            {lot.status === "In Stock" ? "في المخزون" :
                             lot.status === "Low Stock" ? "مخزون منخفض" :
                             lot.status === "Depleted" ? "نفد" :
                             lot.status === "Expired" ? "منتهي" : lot.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30">
                      <td colSpan={5} className="py-2.5 px-3 text-xs font-semibold text-muted-foreground">إجمالي قيمة المخزون</td>
                      <td className="py-2.5 px-3 text-end font-bold text-primary">{inventoryValue.toLocaleString()} {t.currency}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (open && client) {
          const parsed = parsePhones(client.phone);
          setEditPhones(parsed.length > 0 ? parsed : [{ name: "", number: "" }]);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.editClient}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t.clientName} *</Label><Input className="h-9 mt-1" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div><Label className="text-xs">{t.contactPerson}</Label><Input className="h-9 mt-1" value={editForm.contact} onChange={e => setEditForm({ ...editForm, contact: e.target.value })} /></div>
            <div><Label className="text-xs">{t.email}</Label><Input className="h-9 mt-1" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">أرقام الهاتف</Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={() => setEditPhones([...editPhones, { name: "", number: "" }])}>
                  <Plus className="h-3 w-3" />إضافة رقم
                </Button>
              </div>
              <div className="space-y-2">
                {editPhones.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input className="h-9 flex-1" placeholder="الاسم (اختياري)" value={p.name} onChange={(e) => { const u = [...editPhones]; u[i] = { ...u[i], name: e.target.value }; setEditPhones(u); }} />
                    <Input className="h-9 flex-1" placeholder="رقم الهاتف" value={p.number} onChange={(e) => { const u = [...editPhones]; u[i] = { ...u[i], number: e.target.value }; setEditPhones(u); }} dir="ltr" />
                    {editPhones.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setEditPhones(editPhones.filter((_, j) => j !== i))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t.city}</Label><Input className="h-9 mt-1" value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} /></div>
              <div>
                <Label className="text-xs">{t.status}</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">{t.active}</SelectItem>
                    <SelectItem value="Inactive">{t.inactive}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
