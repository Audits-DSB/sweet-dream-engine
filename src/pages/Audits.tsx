import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { printInvoice } from "@/lib/printInvoice";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/StatCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus, Eye, MoreHorizontal, ClipboardCheck, AlertTriangle, CheckCircle2, XCircle,
  Upload, FileSpreadsheet, Printer, Download, FileText, Package, Loader2, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { logAudit } from "@/lib/auditLog";

type ComparisonRow = {
  material: string;
  code: string;
  unit: string;
  expected: number;
  actual: number;
  diff: number;
  result: "matched" | "shortage" | "surplus";
  sellingPrice: number;
  storeCost: number;
};

type AuditRecord = {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  auditor: string;
  totalItems: number;
  matched: number;
  shortage: number;
  surplus: number;
  notes: string;
  status: string;
  comparison: ComparisonRow[];
  createdAt: string;
};

type InventoryLot = {
  id: string;
  clientId: string;
  clientName: string;
  material: string;
  code: string;
  unit: string;
  remaining: number;
  sellingPrice: number;
  storeCost: number;
};

function parseCsvText(text: string): { code: string; name: string; actual: number }[] {
  const lines = text.split("\n").filter(l => l.trim());
  const results: { code: string; name: string; actual: number }[] = [];
  const start = lines[0]?.match(/code|material|اسم|كود|الكمية/i) ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    if (cols.length >= 2) {
      const codeMatch = cols.find(c => /^MAT-/i.test(c));
      const numMatch = cols.map(Number).find(n => !isNaN(n) && n >= 0);
      const nameMatch = cols.find(c => c && !/^MAT-/i.test(c) && isNaN(Number(c)));
      results.push({ code: codeMatch || "", name: nameMatch || "", actual: numMatch ?? 0 });
    }
  }
  return results;
}

export default function AuditsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedAudit, setSelectedAudit] = useState<AuditRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuditRecord | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedAuditor, setSelectedAuditor] = useState("");
  const [auditDate, setAuditDate] = useState("");
  const [auditNotes, setAuditNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>([]);
  const [step, setStep] = useState<"form" | "compare">("form");
  const [saving, setSaving] = useState(false);

  const { data: rawAudits = [], isLoading } = useQuery<AuditRecord[]>({ queryKey: ["/api/audits"] });
  const { data: clients = [] } = useQuery<{ id: string; name: string; city: string }[]>({ queryKey: ["/api/clients"] });
  const { data: founders = [] } = useQuery<{ id: string; name: string; alias: string }[]>({ queryKey: ["/api/founders"] });
  const { data: rawLots = [] } = useQuery<InventoryLot[]>({ queryKey: ["/api/client-inventory"] });

  const audits: AuditRecord[] = rawAudits.map(a => ({
    ...a,
    comparison: Array.isArray(a.comparison) ? a.comparison : [],
  }));

  const lots: InventoryLot[] = rawLots.map(l => ({
    ...l,
    remaining: Number(l.remaining),
    sellingPrice: Number(l.sellingPrice),
    storeCost: Number(l.storeCost),
  }));

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/audits/${id}`),
    onSuccess: async (_, id) => {
      const target = audits.find(a => a.id === id);
      if (target) {
        await logAudit({ entity: "audits", entityId: id, entityName: `${target.id} — ${target.clientName}`, action: "delete", snapshot: target, endpoint: "/api/audits", idField: "id" });
      }
      qc.invalidateQueries({ queryKey: ["/api/audits"] });
      setDeleteTarget(null);
      toast.success("تم حذف الجرد");
    },
    onError: () => toast.error("فشل الحذف"),
  });

  const clientInventory = useMemo(() => {
    if (!selectedClientId) return [];
    return lots.filter(l => l.clientId === selectedClientId);
  }, [selectedClientId, lots]);

  const filtered = audits.filter((a) => {
    const matchSearch = !search || a.clientName.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase()) || a.auditor.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || a.status === filters.status;
    const matchClient = !filters.client || filters.client === "all" || a.clientName === filters.client;
    return matchSearch && matchStatus && matchClient;
  });

  const completedCount = audits.filter(a => a.status === "Completed").length;
  const discrepancyCount = audits.filter(a => a.status === "Discrepancy").length;
  const scheduledCount = audits.filter(a => a.status === "Scheduled" || a.status === "In Progress").length;
  const auditClientNames = [...new Set(audits.map(a => a.clientName))];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { const text = ev.target?.result as string; buildComparison(parseCsvText(text)); };
    reader.readAsText(file);
    e.target.value = "";
  };

  const buildComparison = (uploadedData: { code: string; name: string; actual: number }[]) => {
    const rows: ComparisonRow[] = clientInventory.map(inv => {
      const match = uploadedData.find(u =>
        (u.code && u.code.toUpperCase() === inv.code.toUpperCase()) ||
        (u.name && inv.material.includes(u.name)) ||
        (u.name && u.name.includes(inv.material))
      );
      const actual = match ? match.actual : 0;
      const diff = actual - inv.remaining;
      const result: ComparisonRow["result"] = diff === 0 ? "matched" : diff < 0 ? "shortage" : "surplus";
      return { material: inv.material, code: inv.code, unit: inv.unit, expected: inv.remaining, actual, diff, result, sellingPrice: inv.sellingPrice, storeCost: inv.storeCost };
    });
    setComparisonRows(rows);
    setStep("compare");
  };

  const handleManualActual = (idx: number, value: number) => {
    setComparisonRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const diff = value - r.expected;
      return { ...r, actual: value, diff, result: diff === 0 ? "matched" : diff < 0 ? "shortage" : "surplus" };
    }));
  };

  const handleSaveAudit = async () => {
    if (!selectedClientId || !selectedAuditor) { toast.error(t.selectClientAndAuditor); return; }
    const client = clients.find(c => c.id === selectedClientId);
    const auditor = founders.find(f => f.id === selectedAuditor);
    if (!client) return;
    const today = auditDate || new Date().toISOString().split("T")[0];
    const matchedCount = comparisonRows.filter(r => r.result === "matched").length;
    const shortageCount = comparisonRows.filter(r => r.result === "shortage").length;
    const surplusCount = comparisonRows.filter(r => r.result === "surplus").length;
    const status = shortageCount > 0 || surplusCount > 0 ? "Discrepancy" : "Completed";

    setSaving(true);
    try {
      const { nextId } = await api.get<{ nextId: string }>("/audits/next-id");
      const newAudit = {
        id: nextId || `AUD-${String(audits.length + 1).padStart(3, "0")}`,
        clientId: client.id,
        clientName: client.name,
        date: today,
        auditor: auditor?.name || selectedAuditor,
        totalItems: comparisonRows.length,
        matched: matchedCount,
        shortage: shortageCount,
        surplus: surplusCount,
        notes: auditNotes,
        status,
        comparison: comparisonRows,
      };
      await api.post("/audits", newAudit);
      qc.invalidateQueries({ queryKey: ["/api/audits"] });
      resetDialog();
      toast.success(t.auditScheduled);
      setSelectedAudit({ ...newAudit, createdAt: new Date().toISOString() });
    } catch {
      toast.error("فشل حفظ الجرد");
    } finally {
      setSaving(false);
    }
  };

  const resetDialog = () => {
    setSelectedClientId(""); setSelectedAuditor(""); setAuditDate(""); setAuditNotes("");
    setComparisonRows([]); setStep("form"); setDialogOpen(false);
  };

  const printClientInvoice = (audit: AuditRecord) => {
    const rows = audit.comparison;
    const shortages = rows.filter(r => r.result === "shortage");
    if (shortages.length === 0) { toast.info(t.noResults); return; }
    printInvoice({
      title: "فاتورة مواد جديدة للعميل", companyName: "DSB", subtitle: `جرد ${audit.id} — مواد مطلوب توصيلها`,
      clientName: audit.clientName, invoiceNumber: `INV-${audit.id}`, date: audit.date,
      columns: [t.material, t.codeCol, t.unit, t.qtyRequired, `${t.priceColon} (${t.currency})`, `${t.total} (${t.currency})`],
      rows: shortages.map(r => [r.material, r.code, r.unit, Math.abs(r.diff), r.sellingPrice, (Math.abs(r.diff) * r.sellingPrice).toLocaleString()]),
      totals: [
        { label: t.totalShortageItems, value: String(shortages.length) },
        { label: t.totalCostForClient, value: `${shortages.reduce((s, r) => s + Math.abs(r.diff) * r.sellingPrice, 0).toLocaleString()} ${t.currency}` },
      ],
      footer: `${t.auditor}: ${audit.auditor} — ${audit.date}`,
    });
  };

  const exportPurchaseSheet = (audit: AuditRecord) => {
    const shortages = audit.comparison.filter(r => r.result === "shortage");
    if (shortages.length === 0) { toast.info(t.noResults); return; }
    exportToCsv(`purchase_list_${audit.id}`,
      [t.material, t.codeCol, t.unit, t.qtyRequired, `${t.storeCostColon} (${t.currency})`, `${t.total} (${t.currency})`, t.client],
      shortages.map(r => [r.material, r.code, r.unit, Math.abs(r.diff), r.storeCost, (Math.abs(r.diff) * r.storeCost).toLocaleString(), audit.clientName])
    );
    toast.success(t.purchaseListExported);
  };

  const resultLabel = (r: string) => r === "matched" ? t.matched : r === "shortage" ? t.shortage : t.surplus;
  const statusLabel = (s: string) => ({ "Completed": t.completed, "Discrepancy": t.discrepancy, "Scheduled": t.scheduled, "In Progress": t.inProgress }[s] || s);

  const initManualEntry = () => {
    if (clientInventory.length === 0) { toast.error(t.noInventoryForClient); return; }
    setComparisonRows(clientInventory.map(inv => ({ material: inv.material, code: inv.code, unit: inv.unit, expected: inv.remaining, actual: inv.remaining, diff: 0, result: "matched" as const, sellingPrice: inv.sellingPrice, storeCost: inv.storeCost })));
    setStep("compare");
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.auditsTitle}</h1>
        <p className="page-description">{t.auditsDesc}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="cursor-pointer" onClick={() => setFilters({ ...filters, status: "Completed" })}>
          <StatCard title={t.completedAudits} value={completedCount} change={t.thisQuarter} changeType="neutral" icon={CheckCircle2} />
        </div>
        <div className="cursor-pointer" onClick={() => setFilters({ ...filters, status: "Discrepancy" })}>
          <StatCard title={t.discrepancies} value={discrepancyCount} change={audits.length > 0 ? `${((discrepancyCount / audits.length) * 100).toFixed(0)}% ${t.ofAudits}` : "0%"} changeType="negative" icon={AlertTriangle} />
        </div>
        <div className="cursor-pointer" onClick={() => setFilters({ ...filters, status: "Scheduled" })}>
          <StatCard title={t.scheduledInProgress} value={scheduledCount} change={t.upcoming} changeType="neutral" icon={ClipboardCheck} />
        </div>
      </div>

      <DataToolbar
        searchPlaceholder={t.searchAudits}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: t.status, value: "status", options: [{ label: t.completed, value: "Completed" }, { label: t.discrepancy, value: "Discrepancy" }, { label: t.scheduled, value: "Scheduled" }, { label: t.inProgress, value: "In Progress" }] },
          { label: t.client, value: "client", options: auditClientNames.map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("audits", [t.code, t.client, t.date, t.auditor, t.itemsCol, t.matched, t.shortage, t.surplus, t.status, t.notes], filtered.map(a => [a.id, a.clientName, a.date, a.auditor, a.totalItems, a.matched, a.shortage, a.surplus, a.status, a.notes]))}
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
                <td className="py-3 px-3 font-medium hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${audit.clientId}`); }}>{audit.clientName}</td>
                <td className="py-3 px-3 text-muted-foreground">{audit.date}</td>
                <td className="py-3 px-3">{audit.auditor}</td>
                <td className="py-3 px-3 text-end">{audit.totalItems}</td>
                <td className="py-3 px-3 text-end text-success font-medium">{audit.matched}</td>
                <td className="py-3 px-3 text-end">{audit.shortage > 0 ? <span className="text-destructive font-medium">{audit.shortage}</span> : "—"}</td>
                <td className="py-3 px-3 text-end">{audit.surplus > 0 ? <span className="text-warning font-medium">{audit.surplus}</span> : "—"}</td>
                <td className="py-3 px-3"><StatusBadge status={statusLabel(audit.status)} /></td>
                <td className="py-3 px-3 text-end" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedAudit(audit)}><Eye className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.viewDetails}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => printClientInvoice(audit)}><Printer className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.clientInvoice}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportPurchaseSheet(audit)}><FileSpreadsheet className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.purchaseListLabel}</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(audit)}><Trash2 className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />حذف</DropdownMenuItem>
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
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>{selectedAudit?.id} — {selectedAudit?.clientName}</DialogTitle></DialogHeader>
          {selectedAudit && (
            <ScrollArea className="max-h-[75vh]">
              <div className="space-y-4 pe-2">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div><span className="text-muted-foreground">{t.date}:</span> <span className="font-medium">{selectedAudit.date}</span></div>
                  <div><span className="text-muted-foreground">{t.auditor}:</span> <span className="font-medium">{selectedAudit.auditor}</span></div>
                  <div className="cursor-pointer" onClick={() => { setSelectedAudit(null); navigate(`/clients/${selectedAudit.clientId}`); }}>
                    <span className="text-muted-foreground">{t.client}:</span> <span className="font-medium text-primary">{selectedAudit.clientName}</span>
                  </div>
                  <StatusBadge status={statusLabel(selectedAudit.status)} />
                </div>
                {selectedAudit.notes && (
                  <div className="p-3 rounded-lg bg-warning/10 text-warning text-sm flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{selectedAudit.notes}
                  </div>
                )}
                {(() => {
                  const details = selectedAudit.comparison;
                  const shortages = details.filter(r => r.result === "shortage");
                  const shortageTotal = shortages.reduce((s, r) => s + Math.abs(r.diff) * r.sellingPrice, 0);
                  const purchaseTotal = shortages.reduce((s, r) => s + Math.abs(r.diff) * r.storeCost, 0);
                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xs text-muted-foreground">{t.matched}</p><p className="text-lg font-bold text-success">{details.filter(r => r.result === "matched").length}</p></div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xs text-muted-foreground">{t.shortage}</p><p className="text-lg font-bold text-destructive">{shortages.length}</p></div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xs text-muted-foreground">{t.surplus}</p><p className="text-lg font-bold text-warning">{details.filter(r => r.result === "surplus").length}</p></div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xs text-muted-foreground">{t.totalShortageCost}</p><p className="text-lg font-bold">{shortageTotal.toLocaleString()} <span className="text-xs font-normal">{t.currency}</span></p></div>
                      </div>
                      {details.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>
                                <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.codeCol}</th>
                                <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.expected}</th>
                                <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.actual}</th>
                                <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.differenceCol}</th>
                                <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.result}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {details.map((d, i) => (
                                <tr key={i} className={`border-b border-border/50 ${d.result === "shortage" ? "bg-destructive/5" : d.result === "surplus" ? "bg-warning/5" : ""}`}>
                                  <td className="py-2 px-3 font-medium">{d.material}</td>
                                  <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{d.code}</td>
                                  <td className="py-2 px-3 text-end">{d.expected}</td>
                                  <td className="py-2 px-3 text-end font-medium">{d.actual}</td>
                                  <td className="py-2 px-3 text-end font-medium">{d.diff === 0 ? "—" : <span className={d.diff < 0 ? "text-destructive" : "text-warning"}>{d.diff > 0 ? "+" : ""}{d.diff}</span>}</td>
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
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button variant="default" size="sm" onClick={() => printClientInvoice(selectedAudit)}>
                          <Printer className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.printClientInvoice}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportPurchaseSheet(selectedAudit)}>
                          <FileSpreadsheet className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.exportPurchaseListBtn}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          printInvoice({
                            title: t.exportInvoice, companyName: "DSB", subtitle: t.auditsTitle,
                            clientName: selectedAudit.clientName, invoiceNumber: selectedAudit.id, date: selectedAudit.date,
                            columns: [t.material, t.codeCol, t.expected, t.actual, t.differenceCol, t.result],
                            rows: details.map(d => [d.material, d.code, d.expected, d.actual, d.diff, resultLabel(d.result)]),
                            totals: [
                              { label: t.matched, value: String(details.filter(d => d.result === "matched").length) },
                              { label: t.shortage, value: String(shortages.length) },
                              { label: t.shortagesCostForClient, value: `${shortageTotal.toLocaleString()} ${t.currency}` },
                              { label: t.purchaseCost, value: `${purchaseTotal.toLocaleString()} ${t.currency}` },
                            ],
                            footer: `${t.auditor}: ${selectedAudit.auditor} — ${selectedAudit.date}`,
                          });
                        }}>
                          <FileText className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.printAuditReport}
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* New Audit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{step === "form" ? t.scheduleAudit : t.reviewComparison}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh]">
            <div className="space-y-4 pe-2">
              {step === "form" ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">{t.selectClient}</Label>
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={t.selectClientPlaceholder} /></SelectTrigger>
                        <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.city}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{t.selectAuditor}</Label>
                      <Select value={selectedAuditor} onValueChange={setSelectedAuditor}>
                        <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={t.selectAuditorPlaceholder} /></SelectTrigger>
                        <SelectContent>{founders.map(f => <SelectItem key={f.id} value={f.id}>{f.name} — {f.alias}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">{t.date}</Label><Input className="h-9 mt-1" type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} /></div>
                    <div><Label className="text-xs">{t.notes}</Label><Input className="h-9 mt-1" value={auditNotes} onChange={(e) => setAuditNotes(e.target.value)} /></div>
                  </div>
                  {selectedClientId && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-2"><Package className="h-4 w-4 text-primary" />{t.currentClientInventory} ({clientInventory.length} {t.itemCount})</h4>
                      {clientInventory.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">{t.noInventoryForClient}</p>
                      ) : (
                        <div className="overflow-x-auto border border-border rounded-lg">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border bg-muted/30">
                                <th className="text-start py-2 px-2.5 font-medium">{t.material}</th>
                                <th className="text-start py-2 px-2.5 font-medium">{t.codeCol}</th>
                                <th className="text-end py-2 px-2.5 font-medium">{t.remaining}</th>
                                <th className="text-start py-2 px-2.5 font-medium">{t.unit}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clientInventory.map(inv => (
                                <tr key={inv.id} className="border-b border-border/50">
                                  <td className="py-1.5 px-2.5 font-medium">{inv.material}</td>
                                  <td className="py-1.5 px-2.5 font-mono text-muted-foreground">{inv.code}</td>
                                  <td className="py-1.5 px-2.5 text-end font-medium">{inv.remaining}</td>
                                  <td className="py-1.5 px-2.5 text-muted-foreground">{inv.unit}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedClientId && clientInventory.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">{t.uploadAuditFileTitle}</h4>
                      <p className="text-xs text-muted-foreground">{t.uploadAuditFileDesc}</p>
                      <div className="flex gap-2">
                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.txt" onChange={handleFileUpload} />
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.uploadCsv}</Button>
                        <Button variant="outline" size="sm" onClick={initManualEntry}><ClipboardCheck className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.manualEntryBtn}</Button>
                        <Button variant="outline" size="sm" onClick={() => { exportToCsv(`audit_template_${selectedClientId}`, [t.codeCol, t.material, t.actual], clientInventory.map(inv => [inv.code, inv.material, ""])); toast.success(t.templateExported); }}>
                          <Download className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.downloadTemplate}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-success/10"><p className="text-xs text-muted-foreground">{t.matched}</p><p className="text-xl font-bold text-success">{comparisonRows.filter(r => r.result === "matched").length}</p></div>
                    <div className="p-3 rounded-lg bg-destructive/10"><p className="text-xs text-muted-foreground">{t.shortage}</p><p className="text-xl font-bold text-destructive">{comparisonRows.filter(r => r.result === "shortage").length}</p></div>
                    <div className="p-3 rounded-lg bg-warning/10"><p className="text-xs text-muted-foreground">{t.surplus}</p><p className="text-xl font-bold text-warning">{comparisonRows.filter(r => r.result === "surplus").length}</p></div>
                  </div>
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>
                          <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.expected}</th>
                          <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.actual}</th>
                          <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.differenceCol}</th>
                          <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.result}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonRows.map((r, i) => (
                          <tr key={i} className={`border-b border-border/50 ${r.result === "shortage" ? "bg-destructive/5" : r.result === "surplus" ? "bg-warning/5" : ""}`}>
                            <td className="py-2 px-3 font-medium">{r.material} <span className="text-xs text-muted-foreground">({r.unit})</span></td>
                            <td className="py-2 px-3 text-end text-muted-foreground">{r.expected}</td>
                            <td className="py-2 px-3 text-end">
                              <Input type="number" className="h-7 w-20 text-end text-sm ms-auto" value={r.actual} onChange={e => handleManualActual(i, Number(e.target.value))} />
                            </td>
                            <td className="py-2 px-3 text-end font-medium">{r.diff === 0 ? "—" : <span className={r.diff < 0 ? "text-destructive" : "text-warning"}>{r.diff > 0 ? "+" : ""}{r.diff}</span>}</td>
                            <td className="py-2 px-3">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium ${r.result === "matched" ? "text-success" : r.result === "shortage" ? "text-destructive" : "text-warning"}`}>
                                {r.result === "matched" ? <CheckCircle2 className="h-3 w-3" /> : r.result === "shortage" ? <XCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                {resultLabel(r.result)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStep("form")}>← رجوع</Button>
                    <Button size="sm" onClick={handleSaveAudit} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.saveAuditBtn}</>}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        itemName={deleteTarget ? `${deleteTarget.id} — ${deleteTarget.clientName}` : ""}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
