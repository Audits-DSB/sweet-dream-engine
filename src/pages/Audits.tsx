import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/StatCard";
import { Plus, Eye, MoreHorizontal, ClipboardCheck, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { clientsList, foundersList } from "@/data/store";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialAudits = [
  { id: "AUD-012", client: "عيادة د. أحمد", clientId: "C001", date: "2025-03-05", auditor: "أحمد الراشد", totalItems: 8, matched: 6, shortage: 1, surplus: 1, notes: "زجاجة شراب السكر تالفة", status: "Completed" },
  { id: "AUD-011", client: "مركز نور لطب الأسنان", clientId: "C002", date: "2025-02-28", auditor: "سارة المنصور", totalItems: 12, matched: 12, shortage: 0, surplus: 0, notes: "", status: "Completed" },
  { id: "AUD-010", client: "عيادة جرين فالي", clientId: "C003", date: "2025-02-25", auditor: "أحمد الراشد", totalItems: 6, matched: 5, shortage: 1, surplus: 0, notes: "1 كجم قهوة ناقصة", status: "Discrepancy" },
  { id: "AUD-009", client: "المركز الملكي للأسنان", clientId: "C004", date: "2025-02-20", auditor: "عمر خليل", totalItems: 10, matched: 9, shortage: 0, surplus: 1, notes: "فانيلا إضافية من توصيل سابق", status: "Completed" },
  { id: "AUD-008", client: "عيادة بلو مون", clientId: "C006", date: "2025-02-15", auditor: "سارة المنصور", totalItems: 7, matched: 7, shortage: 0, surplus: 0, notes: "", status: "Completed" },
  { id: "AUD-007", client: "عيادة سمايل هاوس", clientId: "C005", date: "2025-02-10", auditor: "أحمد الراشد", totalItems: 5, matched: 3, shortage: 2, surplus: 0, notes: "أصناف ناقصة", status: "Discrepancy" },
  { id: "AUD-006", client: "مركز سبايس جاردن", clientId: "C007", date: "2025-02-05", auditor: "عمر خليل", totalItems: 4, matched: 4, shortage: 0, surplus: 0, notes: "", status: "Completed" },
  { id: "AUD-DRAFT", client: "المركز الملكي للأسنان", clientId: "C004", date: "2025-03-08", auditor: "سارة المنصور", totalItems: 0, matched: 0, shortage: 0, surplus: 0, notes: "", status: "Scheduled" },
  { id: "AUD-PROG", client: "مركز نور لطب الأسنان", clientId: "C002", date: "2025-03-07", auditor: "عمر خليل", totalItems: 12, matched: 8, shortage: 0, surplus: 0, notes: "جاري التنفيذ...", status: "In Progress" },
];

const auditDetails = [
  { material: "حشو كمبوزيت ضوئي", expected: 45, actual: 45, unit: "عبوة", result: "matched" },
  { material: "إبر تخدير", expected: 8, actual: 7, unit: "علبة", result: "shortage" },
  { material: "مادة طبع سيليكون", expected: 30, actual: 30, unit: "عبوة", result: "matched" },
  { material: "قفازات لاتكس", expected: 2, actual: 2, unit: "كرتونة", result: "matched" },
  { material: "مبيض أسنان", expected: 1.5, actual: 1.5, unit: "عبوة", result: "matched" },
  { material: "بوند لاصق", expected: 3, actual: 3, unit: "زجاجة", result: "matched" },
  { material: "فرز دوارة", expected: 200, actual: 215, unit: "عبوة", result: "surplus" },
  { material: "خيط خياطة جراحي", expected: 50, actual: 49, unit: "علبة", result: "shortage" },
];

export default function AuditsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [audits, setAudits] = useState(initialAudits);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedAudit, setSelectedAudit] = useState<typeof initialAudits[0] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedAuditor, setSelectedAuditor] = useState("");
  const [auditDate, setAuditDate] = useState("");
  const [auditNotes, setAuditNotes] = useState("");

  const filtered = audits.filter((a) => {
    const matchSearch = !search || a.client.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase()) || a.auditor.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || a.status === filters.status;
    const matchClient = !filters.client || filters.client === "all" || a.client === filters.client;
    return matchSearch && matchStatus && matchClient;
  });

  const completedCount = audits.filter(a => a.status === "Completed").length;
  const discrepancyCount = audits.filter(a => a.status === "Discrepancy").length;
  const scheduledCount = audits.filter(a => a.status === "Scheduled" || a.status === "In Progress").length;
  const auditClients = [...new Set(audits.map(a => a.client))];

  const handleAdd = () => {
    if (!selectedClient || !selectedAuditor) { toast.error(t.selectClientAndAuditor); return; }
    const client = clientsList.find(c => c.id === selectedClient);
    const auditor = foundersList.find(f => f.id === selectedAuditor);
    if (!client || !auditor) return;
    const num = audits.length + 1;
    const newId = `AUD-${String(num).padStart(3, "0")}`;
    const today = auditDate || new Date().toISOString().split("T")[0];
    setAudits([{ id: newId, client: client.name, clientId: client.id, date: today, auditor: auditor.name, totalItems: 0, matched: 0, shortage: 0, surplus: 0, notes: auditNotes, status: "Scheduled" }, ...audits]);
    setSelectedClient(""); setSelectedAuditor(""); setAuditDate(""); setAuditNotes("");
    setDialogOpen(false);
    toast.success(t.auditScheduled);
  };

  const resultLabel = (r: string) => r === "matched" ? t.matched : r === "shortage" ? t.shortage : t.surplus;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.auditsTitle}</h1>
        <p className="page-description">{t.auditsDesc}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title={t.completedAudits} value={completedCount} change={t.thisQuarter} changeType="neutral" icon={CheckCircle2} />
        <StatCard title={t.discrepancies} value={discrepancyCount} change={`${((discrepancyCount / audits.length) * 100).toFixed(0)}% ${t.ofAudits}`} changeType="negative" icon={AlertTriangle} />
        <StatCard title={t.scheduledInProgress} value={scheduledCount} change={t.upcoming} changeType="neutral" icon={ClipboardCheck} />
      </div>

      <DataToolbar
        searchPlaceholder={t.searchAudits}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: t.status, value: "status", options: [
            { label: t.completed, value: "Completed" }, { label: t.discrepancy, value: "Discrepancy" },
            { label: t.scheduled, value: "Scheduled" }, { label: t.inProgress, value: "In Progress" },
          ]},
          { label: t.client, value: "client", options: auditClients.map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("audits", [t.code, t.client, t.date, t.auditor, t.itemsCol, t.matched, t.shortage, t.surplus, t.status, t.notes], filtered.map(a => [a.id, a.client, a.date, a.auditor, a.totalItems, a.matched, a.shortage, a.surplus, a.status, a.notes]))}
        actions={<Button size="sm" className="h-9" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.newAudit}</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.code}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.date}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.auditor}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.itemsCol}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.matched}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.shortage}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.surplus}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((audit) => (
              <tr key={audit.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedAudit(audit)}>
                <td className="py-3 px-3 font-mono text-xs font-medium">{audit.id}</td>
                <td className="py-3 px-3 font-medium hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${audit.clientId}`); }}>{audit.client}</td>
                <td className="py-3 px-3 text-muted-foreground">{audit.date}</td>
                <td className="py-3 px-3">{audit.auditor}</td>
                <td className="py-3 px-3 text-end">{audit.totalItems}</td>
                <td className="py-3 px-3 text-end text-success font-medium">{audit.matched}</td>
                <td className="py-3 px-3 text-end">{audit.shortage > 0 ? <span className="text-destructive font-medium">{audit.shortage}</span> : "—"}</td>
                <td className="py-3 px-3 text-end">{audit.surplus > 0 ? <span className="text-warning font-medium">{audit.surplus}</span> : "—"}</td>
                <td className="py-3 px-3"><StatusBadge status={audit.status} /></td>
                <td className="py-3 px-3 text-end" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedAudit(audit)}><Eye className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.viewDetails}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length === 0 && <tfoot><tr><td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">{t.noResults}</td></tr></tfoot>}
        </table>
      </div>

      {/* Audit Detail Dialog */}
      <Dialog open={!!selectedAudit} onOpenChange={() => setSelectedAudit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{selectedAudit?.id} — {selectedAudit?.client}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <div><span className="text-muted-foreground">{t.date}:</span> <span className="font-medium">{selectedAudit?.date}</span></div>
              <div><span className="text-muted-foreground">{t.auditor}:</span> <span className="font-medium">{selectedAudit?.auditor}</span></div>
              <div className="cursor-pointer" onClick={() => { setSelectedAudit(null); navigate(`/clients/${selectedAudit?.clientId}`); }}><span className="text-muted-foreground">{t.client}:</span> <span className="font-medium text-primary">{selectedAudit?.client}</span></div>
              <div><StatusBadge status={selectedAudit?.status || ""} /></div>
            </div>
            {selectedAudit?.notes && (
              <div className="p-3 rounded-lg bg-warning/10 text-warning text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{selectedAudit.notes}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>
                    <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.expected}</th>
                    <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.actual}</th>
                    <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.unit}</th>
                    <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.result}</th>
                  </tr>
                </thead>
                <tbody>
                  {auditDetails.map((d, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium hover:text-primary cursor-pointer" onClick={() => { setSelectedAudit(null); navigate("/materials"); }}>{d.material}</td>
                      <td className="py-2 px-3 text-end">{d.expected}</td>
                      <td className="py-2 px-3 text-end font-medium">{d.actual}</td>
                      <td className="py-2 px-3 text-muted-foreground">{d.unit}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${d.result === "matched" ? "text-success" : d.result === "shortage" ? "text-destructive" : "text-warning"}`}>
                          {d.result === "matched" ? <CheckCircle2 className="h-3 w-3" /> : d.result === "shortage" ? <XCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          {resultLabel(d.result)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { toast.success(t.exportInvoice); }}>{t.exportInvoice}</Button>
              <Button variant="outline" size="sm" onClick={() => { toast.success(t.exportPurchaseList); }}>{t.exportPurchaseList}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Audit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.scheduleAudit}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t.selectClient}</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={t.selectClientPlaceholder} /></SelectTrigger>
                <SelectContent>
                  {clientsList.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.city}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t.selectAuditor}</Label>
              <Select value={selectedAuditor} onValueChange={setSelectedAuditor}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={t.selectAuditorPlaceholder} /></SelectTrigger>
                <SelectContent>
                  {foundersList.map(f => <SelectItem key={f.id} value={f.id}>{f.name} — {f.alias}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">{t.date}</Label><Input className="h-9 mt-1" type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} /></div>
            <div><Label className="text-xs">{t.notes}</Label><Input className="h-9 mt-1" value={auditNotes} onChange={(e) => setAuditNotes(e.target.value)} /></div>
            <Button className="w-full" onClick={handleAdd}>{t.newAudit}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
