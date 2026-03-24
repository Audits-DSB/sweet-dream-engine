import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Eye, MoreHorizontal, Mail, Phone, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
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

export default function ClientsPage() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") || "";
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>(initialStatus ? { status: initialStatus } : {});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
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
        email: form.email, phone: form.phone, city: form.city,
        status: form.status,
      });
      setClients(prev => [...prev, mapClient(saved)]);
      setForm(emptyForm);
      setDialogOpen(false);
      toast.success(t.clientAdded);
    } catch (err: any) {
      toast.error(err?.message || t.failedToSaveClient);
    } finally {
      setSaving(false);
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
        onExport={() => exportToCsv("clients", [t.code, t.clientName, t.contactPerson, t.email, t.phone, t.city, t.status, t.joinDate, t.totalOrders, t.outstanding], filtered.map(c => [c.id, c.name, c.contact, c.email, c.phone, c.city, c.status, c.joinDate, c.totalOrders, c.outstanding]))}
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
                        <DropdownMenuItem onClick={() => { if (client.phone) { window.open(`tel:${client.phone}`); } else { toast.info(t.noPhone); } }}><Phone className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.call}</DropdownMenuItem>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.addNewClient}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t.clientName} *</Label><Input className="h-9 mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t.example} /></div>
            <div><Label className="text-xs">{t.contactPerson} *</Label><Input className="h-9 mt-1" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder={t.fullName} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t.email}</Label><Input className="h-9 mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label className="text-xs">{t.phone}</Label><Input className="h-9 mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
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
