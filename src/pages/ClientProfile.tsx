import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Package, Receipt, TrendingUp, ClipboardCheck, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Client = {
  id: string; name: string; contact: string; email: string; phone: string;
  city: string; status: string; joinDate: string; totalOrders: number;
  outstanding: number;
};

type Order = {
  id: string; date: string; totalSelling: string; totalCost: string; status: string;
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

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [client, setClient] = useState<Client | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", contact: "", email: "", phone: "", city: "", status: "Active" });

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<any[]>("/clients"),
      api.get<any[]>("/orders"),
    ]).then(([clientsData, ordersData]) => {
      const found = (clientsData || []).find((c: any) => c.id === id);
      if (found) {
        const c = mapClient(found);
        setClient(c);
        setEditForm({ name: c.name, contact: c.contact, email: c.email, phone: c.phone, city: c.city, status: c.status });
      }
      const clientOrders = (ordersData || [])
        .filter((o: any) => (o.clientId || o.client_id) === id)
        .map(mapOrder);
      setOrders(clientOrders);
    }).catch(() => toast.error(t.failedToLoadClientData))
      .finally(() => setLoading(false));
  }, [id]);

  const handleEditSave = async () => {
    if (!client) return;
    setSaving(true);
    try {
      await api.patch(`/clients/${client.id}`, editForm);
      setClient({ ...client, ...editForm });
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

  const stats = [
    { label: t.totalOrders, value: orders.length, icon: Package },
    { label: t.outstanding, value: `${client.outstanding.toLocaleString()} ${t.currency}`, icon: TrendingUp },
    { label: t.totalPaid, value: "—", icon: Receipt },
    { label: t.inventoryValue, value: "—", icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/clients")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3"><h1 className="page-header">{client.name}</h1><StatusBadge status={client.status} /></div>
          <p className="page-description">{client.id} · {t.contactPerson}: {client.contact}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>{t.editClient}</Button>
      </div>

      <div className="stat-card">
        <div className="flex flex-wrap gap-6 text-sm">
          {client.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />{client.email}</div>}
          {client.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />{client.phone}</div>}
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
          <div className="stat-card">
            <p className="text-center py-10 text-muted-foreground text-sm">{t.inventoryFromPage}</p>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.editClient}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t.clientName} *</Label><Input className="h-9 mt-1" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div><Label className="text-xs">{t.contactPerson}</Label><Input className="h-9 mt-1" value={editForm.contact} onChange={e => setEditForm({ ...editForm, contact: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t.email}</Label><Input className="h-9 mt-1" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
              <div><Label className="text-xs">{t.phone}</Label><Input className="h-9 mt-1" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
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
