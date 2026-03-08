import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Eye, MoreHorizontal, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clientsList } from "@/data/store";

type Request = {
  id: string;
  client: string;
  clientId: string;
  date: string;
  items: number;
  expectedTotal: string;
  status: string;
  notes: string;
};

const initialRequests: Request[] = [
  { id: "REQ-001", client: "عيادة د. أحمد", clientId: "C001", date: "2025-03-06", items: 4, expectedTotal: "32,000", status: "Client Requested", notes: "عاجل - المخزون ينفذ" },
  { id: "REQ-002", client: "مركز نور لطب الأسنان", clientId: "C002", date: "2025-03-05", items: 7, expectedTotal: "85,000", status: "Pending Review", notes: "" },
  { id: "REQ-003", client: "عيادة جرين فالي", clientId: "C003", date: "2025-03-04", items: 3, expectedTotal: "21,000", status: "Approved", notes: "إعادة تخزين شهرية" },
  { id: "REQ-004", client: "المركز الملكي للأسنان", clientId: "C004", date: "2025-03-03", items: 5, expectedTotal: "48,000", status: "Converted to Order", notes: "" },
  { id: "REQ-005", client: "عيادة سمايل هاوس", clientId: "C005", date: "2025-03-02", items: 2, expectedTotal: "12,000", status: "Rejected", notes: "العميل غير نشط" },
  { id: "REQ-006", client: "عيادة بلو مون", clientId: "C006", date: "2025-03-01", items: 6, expectedTotal: "56,000", status: "Pending Review", notes: "أصناف جديدة مطلوبة" },
  { id: "REQ-007", client: "مركز سبايس جاردن", clientId: "C007", date: "2025-02-28", items: 3, expectedTotal: "24,000", status: "Approved", notes: "" },
  { id: "REQ-008", client: "عيادة د. أحمد", clientId: "C001", date: "2025-02-25", items: 5, expectedTotal: "41,000", status: "Converted to Order", notes: "" },
  { id: "REQ-009", client: "المركز الملكي للأسنان", clientId: "C004", date: "2025-02-22", items: 2, expectedTotal: "18,000", status: "Cancelled", notes: "العميل ألغى" },
];

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>(initialRequests);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", items: "", expectedTotal: "", notes: "" });
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const sendNotification = async (title: string, body: string, type: string = "info") => {
    if (!user) return;
    await supabase.from("notifications").insert({ user_id: user.id, title, body, type });
  };

  const filtered = requests.filter((r) => {
    const matchSearch = !search || r.client.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || r.status === filters.status;
    return matchSearch && matchStatus;
  });

  const handleAdd = () => {
    const client = clientsList.find(c => c.id === form.clientId);
    if (!client || !form.items || !form.expectedTotal) {
      toast.error(t.treasuryFillRequired);
      return;
    }
    const num = requests.length + 1;
    const newReq: Request = {
      id: `REQ-${String(num).padStart(3, "0")}`,
      client: client.name,
      clientId: client.id,
      date: new Date().toISOString().split("T")[0],
      items: Number(form.items),
      expectedTotal: Number(form.expectedTotal).toLocaleString(),
      status: "Client Requested",
      notes: form.notes,
    };
    setRequests([newReq, ...requests]);
    setForm({ clientId: "", items: "", expectedTotal: "", notes: "" });
    setDialogOpen(false);
    toast.success(t.requestAdded || "تم إضافة الطلب بنجاح");
    sendNotification("New request created", `${newReq.id} - ${client.name}`, "info");
  };

  const updateStatus = (id: string, newStatus: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.requestsTitle}</h1>
        <p className="page-description">{requests.length} {t.requestCount} · {requests.filter(r => r.status === "Pending Review").length} {t.awaitingReview}</p>
      </div>

      <DataToolbar
        searchPlaceholder={t.searchRequests}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[{ label: t.status, value: "status", options: [
          { label: t.clientRequested, value: "Client Requested" }, { label: t.pendingReview, value: "Pending Review" },
          { label: t.approved, value: "Approved" }, { label: t.rejected, value: "Rejected" },
          { label: t.convertedToOrder, value: "Converted to Order" }, { label: t.cancelled, value: "Cancelled" },
        ]}]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("requests", [t.code, t.client, t.date, t.items, t.expectedTotal, t.status, t.notes], filtered.map(r => [r.id, r.client, r.date, r.items, `${r.expectedTotal} ${t.currency}`, r.status, r.notes]))}
        actions={<Button size="sm" className="h-9" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.newRequest}</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.code}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.date}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.items}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.expectedTotal}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.notes}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((req) => (
              <tr key={req.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{req.id}</td>
                <td className="py-3 px-3 font-medium hover:text-primary cursor-pointer" onClick={() => navigate(`/clients/${req.clientId}`)}>{req.client}</td>
                <td className="py-3 px-3 text-muted-foreground">{req.date}</td>
                <td className="py-3 px-3 text-end">{req.items}</td>
                <td className="py-3 px-3 text-end font-medium">{req.expectedTotal} {t.currency}</td>
                <td className="py-3 px-3"><StatusBadge status={req.status} /></td>
                <td className="py-3 px-3 text-xs text-muted-foreground max-w-[200px] truncate">{req.notes || "—"}</td>
                <td className="py-3 px-3 text-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toast.info(`${t.viewDetails}: ${req.id}`)}><Eye className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.viewDetails}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { updateStatus(req.id, "Approved"); toast.success(`${t.requestApproved}: ${req.id}`); sendNotification(t.requestApproved, `${req.id} - ${req.client}`, "success"); }}><CheckCircle className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.approve}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { updateStatus(req.id, "Rejected"); toast.error(`${t.requestRejected}: ${req.id}`); sendNotification(t.requestRejected, `${req.id} - ${req.client}`, "warning"); }}><XCircle className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.reject}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { updateStatus(req.id, "Converted to Order"); toast.success(`${t.requestConverted}: ${req.id}`); navigate("/orders"); sendNotification(t.requestConverted, `${req.id} - ${req.client}`, "info"); }}><ArrowRight className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.convertToOrder}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">{t.noResults}</div>}
      </div>

      {/* New Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.newRequest}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">{t.client} *</Label>
              <Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t.selectClientPlaceholder} /></SelectTrigger>
                <SelectContent>
                  {clientsList.filter(c => c.status === "Active").map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t.items} *</Label>
                <Input className="mt-1" type="number" min="1" value={form.items} onChange={e => setForm(f => ({ ...f, items: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">{t.expectedTotal} ({t.currency}) *</Label>
                <Input className="mt-1" type="number" min="0" value={form.expectedTotal} onChange={e => setForm(f => ({ ...f, expectedTotal: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t.notes}</Label>
              <Textarea className="mt-1" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd}>{t.add || "إضافة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
