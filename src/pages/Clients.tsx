import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Eye, MoreHorizontal, Mail, Phone, Loader2, Trash2, Pencil, X } from "lucide-react";
import { parsePhones, serializePhones, getPrimaryPhone, getPhoneDisplay, type PhoneEntry } from "@/lib/phoneUtils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { logAudit } from "@/lib/auditLog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Client = {
  id: string; name: string; contact: string; email: string; phone: string;
  city: string; status: string; joinDate: string; totalOrders: number;
  outstanding: number; lastAudit: string;
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
    lastAudit: raw.lastAudit || raw.last_audit || "—",
  };
}

const emptyForm = { name: "", contact: "", email: "", phone: "", city: "", status: "Active" };
const emptyPhone: PhoneEntry = { name: "", number: "" };

export default function ClientsPage() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const _userName = profile?.full_name || "مستخدم";
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") || "";
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>(initialStatus ? { status: initialStatus } : {});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [phones, setPhones] = useState<PhoneEntry[]>([{ ...emptyPhone }]);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<any[]>("/clients")
      .then(data => setClients((data || []).map(mapClient)))
      .catch(() => toast.error(t.failedToLoadClients))
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.contact.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || c.status === filters.status;
    const matchCity = !filters.city || filters.city === "all" || c.city === filters.city;
    return matchSearch && matchStatus && matchCity;
  });

  const handleAdd = async () => {
    if (!form.name || !form.contact) { toast.error(t.enterNameAndContact); return; }
    setSaving(true);
    try {
      const newId = `C${String(clients.length + 1).padStart(3, "0")}`;
      const today = new Date().toISOString().split("T")[0];
      const saved = await api.post<any>("/clients", {
        id: newId, name: form.name, contact: form.contact,
        email: form.email, phone: serializePhones(phones), city: form.city,
        status: form.status,
      });
      await logAudit({ entity: "client", entityId: saved.id || newId, entityName: form.name, action: "create", snapshot: saved, endpoint: "/clients" , performedBy: _userName });
      setClients(prev => [...prev, mapClient(saved)]);
      setForm(emptyForm);
      setPhones([{ ...emptyPhone }]);
      setDialogOpen(false);
      toast.success(t.clientAdded);
    } catch (err: any) {
      toast.error(err?.message || t.failedToSaveClient);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/clients/${deleteTarget.id}`);
      await logAudit({ entity: "client", entityId: deleteTarget.id, entityName: deleteTarget.name, action: "delete", snapshot: deleteTarget as any, endpoint: "/clients" , performedBy: _userName });
      setClients(prev => prev.filter(c => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success(`تم حذف العميل: ${deleteTarget.name}`);
    } catch (err: any) {
      toast.error(err?.message || "فشل حذف العميل");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.clientsTitle}</h1>
        <p className="page-description">{clients.length} {t.clientCount} · {clients.filter(c => c.status === "Active").length} {t.activeCount}</p>
      </div>

      <DataToolbar
        searchPlaceholder={t.searchClients}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: t.status, value: "status", options: [{ label: t.active, value: "Active" }, { label: t.inactive, value: "Inactive" }] },
          { label: t.city, value: "city", options: [...new Set(clients.map(c => c.city))].filter(Boolean).map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("clients", [t.code, t.clientName, t.contactPerson, t.email, t.phone, t.city, t.status, t.joinDate, t.totalOrders, t.outstanding], filtered.map(c => [c.id, c.name, c.contact, c.email, getPhoneDisplay(c.phone), c.city, c.status, c.joinDate, c.totalOrders, c.outstanding]))}
        actions={<Button size="sm" className="h-9" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.addClient}</Button>}
      />

      <div className="stat-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.code}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.clientName}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.contactPerson}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.city}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.totalOrders}</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.outstanding}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.lastAudit}</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr key={client.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{client.id}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{client.name.charAt(0)}</span>
                      </div>
                      <span className="font-medium">{client.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">{client.contact}</td>
                  <td className="py-3 px-3 text-muted-foreground">{client.city}</td>
                  <td className="py-3 px-3"><StatusBadge status={client.status} /></td>
                  <td className="py-3 px-3 text-end font-medium">{client.totalOrders}</td>
                  <td className="py-3 px-3 text-end font-medium">
                    {client.outstanding > 0 ? (
                      <span className="text-warning">{client.outstanding.toLocaleString()} {t.currency}</span>
                    ) : (
                      <span className="text-success">{t.settled}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground text-xs">{client.lastAudit}</td>
                  <td className="py-3 px-3 text-end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/clients/${client.id}`)}><Eye className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.viewProfile}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { if (client.email) { window.open(`mailto:${client.email}`); } else { toast.info(t.noEmail); } }}><Mail className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.sendEmail}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { const p = getPrimaryPhone(client.phone); if (p) { window.open(`tel:${p}`); } else { toast.info(t.noPhone); } }}><Phone className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.call}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(client)} data-testid={`button-delete-client-${client.id}`}>
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
        title="حذف العميل"
        description={`هل تريد حذف "${deleteTarget?.name}"؟ يمكنك استعادته لاحقاً من سجل الأنشطة.`}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setForm(emptyForm); setPhones([{ ...emptyPhone }]); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.addNewClient}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t.clientName} *</Label><Input className="h-9 mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t.example} /></div>
            <div><Label className="text-xs">{t.contactPerson} *</Label><Input className="h-9 mt-1" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder={t.fullName} /></div>
            <div><Label className="text-xs">{t.email}</Label><Input className="h-9 mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">أرقام الهاتف</Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={() => setPhones([...phones, { ...emptyPhone }])}>
                  <Plus className="h-3 w-3" />إضافة رقم
                </Button>
              </div>
              <div className="space-y-2">
                {phones.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input className="h-9 flex-1" placeholder="الاسم (اختياري)" value={p.name} onChange={(e) => { const u = [...phones]; u[i] = { ...u[i], name: e.target.value }; setPhones(u); }} />
                    <Input className="h-9 flex-1" placeholder="رقم الهاتف" value={p.number} onChange={(e) => { const u = [...phones]; u[i] = { ...u[i], number: e.target.value }; setPhones(u); }} dir="ltr" />
                    {phones.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setPhones(phones.filter((_, j) => j !== i))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t.city}</Label><Input className="h-9 mt-1" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div>
                <Label className="text-xs">{t.status}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">{t.active}</SelectItem>
                    <SelectItem value="Inactive">{t.inactive}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.addClient}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
