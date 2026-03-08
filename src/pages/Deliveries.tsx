import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, MoreHorizontal, Truck, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialDeliveries = [
  { id: "DEL-035", order: "ORD-048", client: "عيادة د. أحمد", requestedDate: "2025-03-08", actualDate: "—", actor: "أحمد (مؤسس)", items: 4, type: "كامل", status: "Pending" },
  { id: "DEL-034", order: "ORD-047", client: "مركز نور لطب الأسنان", requestedDate: "2025-03-07", actualDate: "—", actor: "DHL Express", items: 7, type: "كامل", status: "In Transit" },
  { id: "DEL-033", order: "ORD-046", client: "عيادة جرين فالي", requestedDate: "2025-03-06", actualDate: "2025-03-06", actor: "شركة توصيل سريع", items: 3, type: "كامل", status: "Delivered" },
  { id: "DEL-032", order: "ORD-044", client: "عيادة بلو مون", requestedDate: "2025-03-03", actualDate: "2025-03-03", actor: "سارة (مؤسس)", items: 4, type: "جزئي", status: "Delivered" },
  { id: "DEL-031", order: "ORD-044", client: "عيادة بلو مون", requestedDate: "2025-03-05", actualDate: "—", actor: "أحمد (مؤسس)", items: 2, type: "جزئي", status: "Pending" },
  { id: "DEL-030", order: "ORD-045", client: "المركز الملكي للأسنان", requestedDate: "2025-03-02", actualDate: "2025-03-02", actor: "DHL Express", items: 5, type: "كامل", status: "Delivered" },
  { id: "DEL-029", order: "ORD-043", client: "عيادة سمايل هاوس", requestedDate: "2025-02-28", actualDate: "2025-03-01", actor: "أحمد (مؤسس)", items: 2, type: "كامل", status: "Delivered" },
];

const deliveryStatusMap: Record<string, string> = {
  "Pending": "warning", "In Transit": "info", "Delivered": "success", "Failed": "destructive",
};

const emptyDelivery = { order: "", client: "", actor: "", items: "1", type: "كامل", requestedDate: "" };

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyDelivery);
  const { user } = useAuth();
  const { t } = useLanguage();

  const sendNotification = async (title: string, body: string, type: string = "info") => {
    if (!user) return;
    await supabase.from("notifications").insert({ user_id: user.id, title, body, type });
  };

  const filtered = deliveries.filter((d) => {
    const matchSearch = !search || d.client.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase()) || d.order.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || d.status === filters.status;
    return matchSearch && matchStatus;
  });

  const handleAdd = () => {
    if (!form.client || !form.order) {
      toast.error("يرجى إدخال العميل ورقم الطلب");
      return;
    }
    const num = deliveries.length > 0 ? parseInt(deliveries[0].id.split("-")[1]) + 1 : 36;
    const newId = `DEL-${String(num).padStart(3, "0")}`;
    const today = new Date().toISOString().split("T")[0];
    setDeliveries([{
      id: newId, order: form.order, client: form.client, requestedDate: form.requestedDate || today,
      actualDate: "—", actor: form.actor, items: parseInt(form.items) || 1, type: form.type, status: "Pending",
    }, ...deliveries]);
    sendNotification("توصيل جديد", `${newId} - ${form.client}`, "info");
    setForm(emptyDelivery);
    setDialogOpen(false);
    toast.success("تم إنشاء التوصيل بنجاح");
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
        filters={[
          { label: t.status, value: "status", options: [
            { label: t.pending, value: "Pending" },
            { label: t.inTransit, value: "In Transit" },
            { label: t.delivered, value: "Delivered" },
          ]},
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("deliveries", [t.code, t.order, t.client, t.requestedDate, t.actualDate, t.executor, t.items, t.type, t.status], filtered.map(d => [d.id, d.order, d.client, d.requestedDate, d.actualDate, d.actor, d.items, d.type, d.status]))}
        actions={<Button size="sm" className="h-9" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />توصيل جديد</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.code}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.order}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.requestedDate}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.actualDate}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.executor}</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">{t.items}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.type}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((del) => (
              <tr key={del.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{del.id}</td>
                <td className="py-3 px-3 font-mono text-xs">{del.order}</td>
                <td className="py-3 px-3 font-medium">{del.client}</td>
                <td className="py-3 px-3 text-muted-foreground text-xs">{del.requestedDate}</td>
                <td className="py-3 px-3 text-xs">{del.actualDate}</td>
                <td className="py-3 px-3 text-muted-foreground">{del.actor}</td>
                <td className="py-3 px-3 text-right">{del.items}</td>
                <td className="py-3 px-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{del.type}</span></td>
                <td className="py-3 px-3"><StatusBadge status={del.status} variant={deliveryStatusMap[del.status] as any} /></td>
                <td className="py-3 px-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem><Eye className="h-3.5 w-3.5 mr-2" />{t.view}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        toast.success(`${t.deliveryConfirmed}: ${del.id}`);
                        sendNotification(t.deliveryConfirmed, `${del.id} - ${del.client}`, "success");
                      }}><Truck className="h-3.5 w-3.5 mr-2" />{t.confirmDelivery}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>توصيل جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">رقم الطلب *</Label><Input className="h-9 mt-1" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} placeholder="ORD-XXX" /></div>
              <div><Label className="text-xs">العميل *</Label><Input className="h-9 mt-1" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">المنفذ</Label><Input className="h-9 mt-1" value={form.actor} onChange={(e) => setForm({ ...form, actor: e.target.value })} placeholder="اسم شركة التوصيل أو المؤسس" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">عدد الأصناف</Label><Input className="h-9 mt-1" type="number" value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} /></div>
              <div>
                <Label className="text-xs">النوع</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="كامل">كامل</SelectItem>
                    <SelectItem value="جزئي">جزئي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">التاريخ</Label><Input className="h-9 mt-1" type="date" value={form.requestedDate} onChange={(e) => setForm({ ...form, requestedDate: e.target.value })} /></div>
            </div>
            <Button className="w-full" onClick={handleAdd}>إنشاء التوصيل</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
