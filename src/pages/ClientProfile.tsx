import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Package, Receipt, ClipboardCheck, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clientsList } from "@/data/store";
import { toast } from "sonner";

const clientData: Record<string, any> = {
  "C001": {
    id: "C001", name: "عيادة د. أحمد", contact: "أحمد خالد", email: "ahmed@clinic.eg",
    phone: "+20 100 111 2233", city: "القاهرة", address: "شارع التحرير، الدقي، الجيزة",
    status: "Active", joinDate: "2024-03-15", totalOrders: 18, totalDelivered: 16,
    outstanding: 32000, totalPaid: 285000, currentInventoryValue: 124000,
    consumptionData: [{ week: "W1", value: 12000 }, { week: "W2", value: 15000 }, { week: "W3", value: 11000 }, { week: "W4", value: 18000 }, { week: "W5", value: 14000 }, { week: "W6", value: 21000 }],
    recentOrders: [
      { id: "ORD-042", date: "2025-03-01", total: "32,000", status: "Delivered" },
      { id: "ORD-038", date: "2025-02-20", total: "28,000", status: "Delivered" },
      { id: "ORD-035", date: "2025-02-12", total: "16,000", status: "Closed" },
    ],
    inventoryItems: [
      { material: "حشو كمبوزيت ضوئي", qty: 45, unit: "عبوة", expiry: "2025-06-15", status: "In Stock" },
      { material: "إبر تخدير", qty: 8, unit: "علبة", expiry: "2025-04-20", status: "Low Stock" },
      { material: "مادة طبع سيليكون", qty: 30, unit: "عبوة", expiry: "2025-12-01", status: "In Stock" },
      { material: "قفازات لاتكس", qty: 2, unit: "كرتونة", expiry: "2025-03-25", status: "Low Stock" },
    ],
  },
};

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [editOpen, setEditOpen] = useState(false);

  // Build default from clientsList if not in detailed data
  const detailed = clientData[id || ""];
  const basic = clientsList.find(c => c.id === id);
  const clientBase = detailed || {
    id: basic?.id || id, name: basic?.name || "—", contact: basic?.contact || "—", email: basic?.email || "",
    phone: basic?.phone || "", city: basic?.city || "", address: "", status: basic?.status || "Active",
    joinDate: basic?.joinDate || "", totalOrders: basic?.totalOrders || 0, totalDelivered: 0,
    outstanding: basic?.outstanding || 0, totalPaid: 0, currentInventoryValue: 0,
    consumptionData: [{ week: "W1", value: 0 }],
    recentOrders: [], inventoryItems: [],
  };

  const [client, setClient] = useState(clientBase);
  const [editForm, setEditForm] = useState({ name: client.name, contact: client.contact, email: client.email, phone: client.phone, city: client.city, address: client.address || "", status: client.status });

  const handleEditSave = () => {
    setClient({ ...client, ...editForm });
    setEditOpen(false);
    toast.success(t.clientUpdated || "تم تحديث بيانات العميل");
  };

  const stats = [
    { label: t.totalOrders, value: client.totalOrders, icon: Package },
    { label: t.totalPaid, value: `${(client.totalPaid || 0).toLocaleString()} ${t.currency}`, icon: Receipt },
    { label: t.outstanding, value: `${(client.outstanding || 0).toLocaleString()} ${t.currency}`, icon: TrendingUp },
    { label: t.inventoryValue, value: `${(client.currentInventoryValue || 0).toLocaleString()} ${t.currency}`, icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/clients")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3"><h1 className="page-header">{client.name}</h1><StatusBadge status={client.status} /></div>
          <p className="page-description">{client.id} · {t.clientProfileJoined} {client.joinDate}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setEditForm({ name: client.name, contact: client.contact, email: client.email, phone: client.phone, city: client.city, address: client.address || "", status: client.status }); setEditOpen(true); }}>{t.editClient}</Button>
      </div>

      <div className="stat-card">
        <div className="flex flex-wrap gap-6 text-sm">
          {client.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />{client.email}</div>}
          {client.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />{client.phone}</div>}
          {client.address && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" />{client.address}</div>}
          <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" />{t.clientProfileJoined} {client.joinDate}</div>
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

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="overview">{t.overview}</TabsTrigger>
          <TabsTrigger value="orders">{t.ordersTab}</TabsTrigger>
          <TabsTrigger value="inventory">{t.inventoryTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="stat-card">
            <h3 className="font-semibold text-sm mb-4">{t.consumptionTrend}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={client.consumptionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

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
                {client.recentOrders.map((order: any) => (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                    <td className="py-2.5 px-3 font-medium text-primary">{order.id}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{order.date}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={order.status} /></td>
                    <td className="py-2.5 px-3 text-end font-medium">{order.total} {t.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="inventory">
          <div className="stat-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>
                  <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.quantity}</th>
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.unit}</th>
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.expiryDate}</th>
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {client.inventoryItems.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate("/inventory")}>
                    <td className="py-2.5 px-3 font-medium">{item.material}</td>
                    <td className="py-2.5 px-3 text-end">{item.qty}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{item.unit}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{item.expiry}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Client Dialog */}
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
            <div><Label className="text-xs">{t.address || "العنوان"}</Label><Input className="h-9 mt-1" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditSave}>{t.save || "حفظ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
