import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  Upload, FileSpreadsheet, Printer, Download, FileText, Package,
} from "lucide-react";
import { toast } from "sonner";
import { clientsList, foundersList } from "@/data/store";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Mock inventory data (same source as Inventory page)
const mockInventory = [
  { id: "LOT-001", client: "عيادة د. أحمد", clientId: "C001", material: "حشو كمبوزيت ضوئي", code: "MAT-001", unit: "عبوة", delivered: 50, remaining: 45, sellingPrice: 1200, storeCost: 800 },
  { id: "LOT-002", client: "عيادة د. أحمد", clientId: "C001", material: "إبر تخدير", code: "MAT-002", unit: "علبة", delivered: 20, remaining: 8, sellingPrice: 950, storeCost: 600 },
  { id: "LOT-003", client: "عيادة د. أحمد", clientId: "C001", material: "مادة طبع سيليكون", code: "MAT-003", unit: "عبوة", delivered: 40, remaining: 30, sellingPrice: 450, storeCost: 280 },
  { id: "LOT-004", client: "عيادة د. أحمد", clientId: "C001", material: "قفازات لاتكس", code: "MAT-005", unit: "كرتونة", delivered: 10, remaining: 2, sellingPrice: 400, storeCost: 280 },
  { id: "LOT-005", client: "مركز نور لطب الأسنان", clientId: "C002", material: "حشو كمبوزيت ضوئي", code: "MAT-001", unit: "عبوة", delivered: 80, remaining: 65, sellingPrice: 1200, storeCost: 800 },
  { id: "LOT-006", client: "مركز نور لطب الأسنان", clientId: "C002", material: "مبيض أسنان", code: "MAT-008", unit: "عبوة", delivered: 5, remaining: 0.5, sellingPrice: 2800, storeCost: 1800 },
  { id: "LOT-007", client: "عيادة جرين فالي", clientId: "C003", material: "إبر تخدير", code: "MAT-002", unit: "علبة", delivered: 30, remaining: 22, sellingPrice: 950, storeCost: 600 },
  { id: "LOT-008", client: "المركز الملكي للأسنان", clientId: "C004", material: "حشو كمبوزيت ضوئي", code: "MAT-001", unit: "عبوة", delivered: 100, remaining: 0, sellingPrice: 1200, storeCost: 800 },
  { id: "LOT-009", client: "المركز الملكي للأسنان", clientId: "C004", material: "فرز دوارة", code: "MAT-010", unit: "عبوة", delivered: 5, remaining: 4, sellingPrice: 2000, storeCost: 1300 },
  { id: "LOT-010", client: "عيادة بلو مون", clientId: "C006", material: "قفازات لاتكس", code: "MAT-005", unit: "كرتونة", delivered: 15, remaining: 12, sellingPrice: 400, storeCost: 280 },
  { id: "LOT-011", client: "مركز سبايس جاردن", clientId: "C007", material: "مادة تلميع", code: "MAT-012", unit: "عبوة", delivered: 8, remaining: 0, sellingPrice: 1500, storeCost: 950 },
];

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

const initialAudits = [
  { id: "AUD-012", client: "عيادة د. أحمد", clientId: "C001", date: "2025-03-05", auditor: "أحمد الراشد", totalItems: 8, matched: 6, shortage: 1, surplus: 1, notes: "زجاجة شراب السكر تالفة", status: "Completed", comparison: [] as ComparisonRow[] },
  { id: "AUD-011", client: "مركز نور لطب الأسنان", clientId: "C002", date: "2025-02-28", auditor: "سارة المنصور", totalItems: 12, matched: 12, shortage: 0, surplus: 0, notes: "", status: "Completed", comparison: [] as ComparisonRow[] },
  { id: "AUD-010", client: "عيادة جرين فالي", clientId: "C003", date: "2025-02-25", auditor: "أحمد الراشد", totalItems: 6, matched: 5, shortage: 1, surplus: 0, notes: "1 كجم قهوة ناقصة", status: "Discrepancy", comparison: [] as ComparisonRow[] },
  { id: "AUD-009", client: "المركز الملكي للأسنان", clientId: "C004", date: "2025-02-20", auditor: "عمر خليل", totalItems: 10, matched: 9, shortage: 0, surplus: 1, notes: "فانيلا إضافية من توصيل سابق", status: "Completed", comparison: [] as ComparisonRow[] },
  { id: "AUD-008", client: "عيادة بلو مون", clientId: "C006", date: "2025-02-15", auditor: "سارة المنصور", totalItems: 7, matched: 7, shortage: 0, surplus: 0, notes: "", status: "Completed", comparison: [] as ComparisonRow[] },
  { id: "AUD-007", client: "عيادة سمايل هاوس", clientId: "C005", date: "2025-02-10", auditor: "أحمد الراشد", totalItems: 5, matched: 3, shortage: 2, surplus: 0, notes: "أصناف ناقصة", status: "Discrepancy", comparison: [] as ComparisonRow[] },
  { id: "AUD-006", client: "مركز سبايس جاردن", clientId: "C007", date: "2025-02-05", auditor: "عمر خليل", totalItems: 4, matched: 4, shortage: 0, surplus: 0, notes: "", status: "Completed", comparison: [] as ComparisonRow[] },
];

// Default audit details for old audits that don't have comparison data
const defaultAuditDetails: ComparisonRow[] = [
  { material: "حشو كمبوزيت ضوئي", code: "MAT-001", unit: "عبوة", expected: 45, actual: 45, diff: 0, result: "matched", sellingPrice: 1200, storeCost: 800 },
  { material: "إبر تخدير", code: "MAT-002", unit: "علبة", expected: 8, actual: 7, diff: -1, result: "shortage", sellingPrice: 950, storeCost: 600 },
  { material: "مادة طبع سيليكون", code: "MAT-003", unit: "عبوة", expected: 30, actual: 30, diff: 0, result: "matched", sellingPrice: 450, storeCost: 280 },
  { material: "قفازات لاتكس", code: "MAT-005", unit: "كرتونة", expected: 2, actual: 2, diff: 0, result: "matched", sellingPrice: 400, storeCost: 280 },
  { material: "بوند لاصق", code: "MAT-006", unit: "زجاجة", expected: 3, actual: 3, diff: 0, result: "matched", sellingPrice: 1800, storeCost: 1200 },
  { material: "فرز دوارة", code: "MAT-010", unit: "عبوة", expected: 200, actual: 215, diff: 15, result: "surplus", sellingPrice: 2000, storeCost: 1300 },
];

function parseCsvText(text: string): { code: string; name: string; actual: number }[] {
  const lines = text.split("\n").filter(l => l.trim());
  const results: { code: string; name: string; actual: number }[] = [];
  // Skip header if it looks like one
  const start = lines[0]?.match(/code|material|اسم|كود|الكمية/i) ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    if (cols.length >= 2) {
      // Try to find: code, name, actual OR name, actual
      const codeMatch = cols.find(c => /^MAT-/i.test(c));
      const numMatch = cols.map(Number).find(n => !isNaN(n) && n >= 0);
      const nameMatch = cols.find(c => c && !/^MAT-/i.test(c) && isNaN(Number(c)));
      results.push({
        code: codeMatch || "",
        name: nameMatch || "",
        actual: numMatch ?? 0,
      });
    }
  }
  return results;
}

export default function AuditsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [audits, setAudits] = useState(initialAudits);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedAudit, setSelectedAudit] = useState<typeof initialAudits[0] | null>(null);

  // New Audit flow state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedAuditor, setSelectedAuditor] = useState("");
  const [auditDate, setAuditDate] = useState("");
  const [auditNotes, setAuditNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comparison state
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>([]);
  const [step, setStep] = useState<"form" | "compare">("form");

  const clientInventory = useMemo(() => {
    if (!selectedClient) return [];
    return mockInventory.filter(i => i.clientId === selectedClient);
  }, [selectedClient]);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsvText(text);
      buildComparison(parsed);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const buildComparison = (uploadedData: { code: string; name: string; actual: number }[]) => {
    const rows: ComparisonRow[] = clientInventory.map(inv => {
      // Match by code first, then by name
      const match = uploadedData.find(u =>
        (u.code && u.code.toUpperCase() === inv.code.toUpperCase()) ||
        (u.name && inv.material.includes(u.name)) ||
        (u.name && u.name.includes(inv.material))
      );
      const actual = match ? match.actual : 0;
      const diff = actual - inv.remaining;
      const result: ComparisonRow["result"] = diff === 0 ? "matched" : diff < 0 ? "shortage" : "surplus";
      return {
        material: inv.material,
        code: inv.code,
        unit: inv.unit,
        expected: inv.remaining,
        actual,
        diff,
        result,
        sellingPrice: inv.sellingPrice,
        storeCost: inv.storeCost,
      };
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

  const handleSaveAudit = () => {
    if (!selectedClient || !selectedAuditor) { toast.error(t.selectClientAndAuditor); return; }
    const client = clientsList.find(c => c.id === selectedClient);
    const auditor = foundersList.find(f => f.id === selectedAuditor);
    if (!client || !auditor) return;
    const num = audits.length + 1;
    const newId = `AUD-${String(num).padStart(3, "0")}`;
    const today = auditDate || new Date().toISOString().split("T")[0];
    const matchedCount = comparisonRows.filter(r => r.result === "matched").length;
    const shortageCount = comparisonRows.filter(r => r.result === "shortage").length;
    const surplusCount = comparisonRows.filter(r => r.result === "surplus").length;
    const status = shortageCount > 0 || surplusCount > 0 ? "Discrepancy" : "Completed";

    const newAudit = {
      id: newId, client: client.name, clientId: client.id, date: today,
      auditor: auditor.name, totalItems: comparisonRows.length, matched: matchedCount,
      shortage: shortageCount, surplus: surplusCount, notes: auditNotes, status,
      comparison: comparisonRows,
    };

    setAudits([newAudit, ...audits]);
    resetDialog();
    toast.success(t.auditScheduled);
    // Immediately open the result
    setSelectedAudit(newAudit);
  };

  const resetDialog = () => {
    setSelectedClient(""); setSelectedAuditor(""); setAuditDate(""); setAuditNotes("");
    setComparisonRows([]); setStep("form"); setDialogOpen(false);
  };

  const printClientInvoice = (audit: typeof initialAudits[0]) => {
    const rows = getAuditDetails(audit);
    const shortages = rows.filter(r => r.result === "shortage");
    if (shortages.length === 0) { toast.info(t.noResults); return; }
    printInvoice({
      title: "فاتورة مواد جديدة للعميل",
      companyName: "OpsHub",
      subtitle: `جرد ${audit.id} — مواد مطلوب توصيلها`,
      clientName: audit.client,
      invoiceNumber: `INV-${audit.id}`,
      date: audit.date,
      columns: [t.material, t.codeCol || "الكود", t.unit, "الكمية المطلوبة", `السعر (${t.currency})`, `الإجمالي (${t.currency})`],
      rows: shortages.map(r => [
        r.material, r.code, r.unit,
        Math.abs(r.diff),
        r.sellingPrice,
        (Math.abs(r.diff) * r.sellingPrice).toLocaleString(),
      ]),
      totals: [
        { label: "إجمالي الأصناف الناقصة", value: String(shortages.length) },
        { label: "إجمالي التكلفة للعميل", value: `${shortages.reduce((s, r) => s + Math.abs(r.diff) * r.sellingPrice, 0).toLocaleString()} ${t.currency}` },
      ],
      footer: `${t.auditor}: ${audit.auditor} — ${audit.date}`,
    });
  };

  const exportPurchaseSheet = (audit: typeof initialAudits[0]) => {
    const rows = getAuditDetails(audit);
    const shortages = rows.filter(r => r.result === "shortage");
    if (shortages.length === 0) { toast.info(t.noResults); return; }
    exportToCsv(
      `purchase_list_${audit.id}`,
      ["المادة", "الكود", "الوحدة", "الكمية المطلوبة", `سعر التكلفة (${t.currency})`, `الإجمالي (${t.currency})`, "العميل"],
      shortages.map(r => [
        r.material, r.code, r.unit,
        Math.abs(r.diff),
        r.storeCost,
        (Math.abs(r.diff) * r.storeCost).toLocaleString(),
        audit.client,
      ])
    );
    toast.success("تم تصدير قائمة المشتريات");
  };

  const getAuditDetails = (audit: typeof initialAudits[0]): ComparisonRow[] => {
    return audit.comparison && audit.comparison.length > 0 ? audit.comparison : defaultAuditDetails;
  };

  const resultLabel = (r: string) => r === "matched" ? t.matched : r === "shortage" ? t.shortage : t.surplus;
  
  // Status translation helper
  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      "Completed": t.completed,
      "Discrepancy": t.discrepancy,
      "Scheduled": t.scheduled,
      "In Progress": t.inProgress,
    };
    return map[status] || status;
  };

  const initManualEntry = () => {
    if (clientInventory.length === 0) { toast.error("لا يوجد مخزون لهذا العميل"); return; }
    const rows: ComparisonRow[] = clientInventory.map(inv => ({
      material: inv.material,
      code: inv.code,
      unit: inv.unit,
      expected: inv.remaining,
      actual: inv.remaining, // default to expected
      diff: 0,
      result: "matched" as const,
      sellingPrice: inv.sellingPrice,
      storeCost: inv.storeCost,
    }));
    setComparisonRows(rows);
    setStep("compare");
  };

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
          <StatCard title={t.discrepancies} value={discrepancyCount} change={`${((discrepancyCount / audits.length) * 100).toFixed(0)}% ${t.ofAudits}`} changeType="negative" icon={AlertTriangle} />
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
                <td className="py-3 px-3"><StatusBadge status={statusLabel(audit.status)} /></td>
                <td className="py-3 px-3 text-end" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedAudit(audit)}><Eye className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.viewDetails}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => printClientInvoice(audit)}><Printer className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />فاتورة العميل</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportPurchaseSheet(audit)}><FileSpreadsheet className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />قائمة المشتريات</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length === 0 && <tfoot><tr><td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">{t.noResults}</td></tr></tfoot>}
        </table>
      </div>

      {/* ===== Audit Detail / Result Dialog ===== */}
      <Dialog open={!!selectedAudit} onOpenChange={() => setSelectedAudit(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>{selectedAudit?.id} — {selectedAudit?.client}</DialogTitle></DialogHeader>
          {selectedAudit && (
            <ScrollArea className="max-h-[75vh]">
              <div className="space-y-4 pe-2">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div><span className="text-muted-foreground">{t.date}:</span> <span className="font-medium">{selectedAudit.date}</span></div>
                  <div><span className="text-muted-foreground">{t.auditor}:</span> <span className="font-medium">{selectedAudit.auditor}</span></div>
                  <div className="cursor-pointer" onClick={() => { setSelectedAudit(null); navigate(`/clients/${selectedAudit.clientId}`); }}>
                    <span className="text-muted-foreground">{t.client}:</span> <span className="font-medium text-primary">{selectedAudit.client}</span>
                  </div>
                  <StatusBadge status={statusLabel(selectedAudit.status)} />
                </div>

                {selectedAudit.notes && (
                  <div className="p-3 rounded-lg bg-warning/10 text-warning text-sm flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{selectedAudit.notes}
                  </div>
                )}

                {/* Summary cards */}
                {(() => {
                  const details = getAuditDetails(selectedAudit);
                  const shortages = details.filter(r => r.result === "shortage");
                  const shortageTotal = shortages.reduce((s, r) => s + Math.abs(r.diff) * r.sellingPrice, 0);
                  const purchaseTotal = shortages.reduce((s, r) => s + Math.abs(r.diff) * r.storeCost, 0);
                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">{t.matched}</p>
                          <p className="text-lg font-bold text-success">{details.filter(r => r.result === "matched").length}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">{t.shortage}</p>
                          <p className="text-lg font-bold text-destructive">{shortages.length}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">{t.surplus}</p>
                          <p className="text-lg font-bold text-warning">{details.filter(r => r.result === "surplus").length}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">تكلفة النقص</p>
                          <p className="text-lg font-bold">{shortageTotal.toLocaleString()} <span className="text-xs font-normal">{t.currency}</span></p>
                        </div>
                      </div>

                      {/* Comparison table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>
                              <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">الكود</th>
                              <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.expected}</th>
                              <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.actual}</th>
                              <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">الفرق</th>
                              <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.result}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {details.map((d, i) => (
                              <tr key={i} className={`border-b border-border/50 ${d.result === "shortage" ? "bg-destructive/5" : d.result === "surplus" ? "bg-warning/5" : ""}`}>
                                <td className="py-2 px-3 font-medium hover:text-primary cursor-pointer" onClick={() => { setSelectedAudit(null); navigate(`/materials?search=${encodeURIComponent(d.code)}`); }}>{d.material}</td>
                                <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{d.code}</td>
                                <td className="py-2 px-3 text-end">{d.expected}</td>
                                <td className="py-2 px-3 text-end font-medium">{d.actual}</td>
                                <td className="py-2 px-3 text-end font-medium">
                                  {d.diff === 0 ? "—" : <span className={d.diff < 0 ? "text-destructive" : "text-warning"}>{d.diff > 0 ? "+" : ""}{d.diff}</span>}
                                </td>
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

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button variant="default" size="sm" onClick={() => printClientInvoice(selectedAudit)}>
                          <Printer className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />طباعة فاتورة العميل
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportPurchaseSheet(selectedAudit)}>
                          <FileSpreadsheet className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />تصدير قائمة المشتريات
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          printInvoice({
                            title: t.exportInvoice,
                            companyName: "OpsHub",
                            subtitle: t.auditsTitle,
                            clientName: selectedAudit.client,
                            invoiceNumber: selectedAudit.id,
                            date: selectedAudit.date,
                            columns: [t.material, "الكود", t.expected, t.actual, "الفرق", t.result],
                            rows: details.map(d => [d.material, d.code, d.expected, d.actual, d.diff, resultLabel(d.result)]),
                            totals: [
                              { label: t.matched, value: String(details.filter(d => d.result === "matched").length) },
                              { label: t.shortage, value: String(shortages.length) },
                              { label: "تكلفة النقص للعميل", value: `${shortageTotal.toLocaleString()} ${t.currency}` },
                              { label: "تكلفة الشراء", value: `${purchaseTotal.toLocaleString()} ${t.currency}` },
                            ],
                            footer: `${t.auditor}: ${selectedAudit.auditor} — ${selectedAudit.date}`,
                          });
                        }}>
                          <FileText className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />طباعة تقرير الجرد
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

      {/* ===== New Audit Dialog (2 steps) ===== */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{step === "form" ? t.scheduleAudit : "مراجعة المقارنة"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh]">
            <div className="space-y-4 pe-2">
              {step === "form" ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">{t.date}</Label><Input className="h-9 mt-1" type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} /></div>
                    <div><Label className="text-xs">{t.notes}</Label><Input className="h-9 mt-1" value={auditNotes} onChange={(e) => setAuditNotes(e.target.value)} /></div>
                  </div>

                  {/* Show client's current inventory */}
                  {selectedClient && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        مخزون العميل الحالي ({clientInventory.length} صنف)
                      </h4>
                      {clientInventory.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">لا يوجد مخزون مسجل لهذا العميل</p>
                      ) : (
                        <div className="overflow-x-auto border border-border rounded-lg">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border bg-muted/30">
                                <th className="text-start py-2 px-2.5 font-medium">المادة</th>
                                <th className="text-start py-2 px-2.5 font-medium">الكود</th>
                                <th className="text-end py-2 px-2.5 font-medium">المتبقي</th>
                                <th className="text-start py-2 px-2.5 font-medium">الوحدة</th>
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

                  {/* Upload or manual entry */}
                  {selectedClient && clientInventory.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">رفع ملف الجرد أو إدخال يدوي</h4>
                      <p className="text-xs text-muted-foreground">ارفع ملف CSV يحتوي على الكميات الفعلية (كود، اسم المادة، الكمية) أو أدخل يدوياً</p>
                      <div className="flex gap-2">
                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.txt,.xlsx" onChange={handleFileUpload} />
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />رفع ملف CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={initManualEntry}>
                          <ClipboardCheck className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />إدخال يدوي
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          exportToCsv(
                            `audit_template_${selectedClient}`,
                            ["الكود", "المادة", "الكمية الفعلية"],
                            clientInventory.map(inv => [inv.code, inv.material, ""])
                          );
                          toast.success("تم تصدير القالب");
                        }}>
                          <Download className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />تحميل قالب
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Step 2: Comparison */
                <>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-success/10">
                      <p className="text-xs text-muted-foreground">{t.matched}</p>
                      <p className="text-xl font-bold text-success">{comparisonRows.filter(r => r.result === "matched").length}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-destructive/10">
                      <p className="text-xs text-muted-foreground">{t.shortage}</p>
                      <p className="text-xl font-bold text-destructive">{comparisonRows.filter(r => r.result === "shortage").length}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-warning/10">
                      <p className="text-xs text-muted-foreground">{t.surplus}</p>
                      <p className="text-xl font-bold text-warning">{comparisonRows.filter(r => r.result === "surplus").length}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-start py-2 px-2.5 font-medium">المادة</th>
                          <th className="text-start py-2 px-2.5 font-medium">الكود</th>
                          <th className="text-end py-2 px-2.5 font-medium">المتوقع</th>
                          <th className="text-end py-2 px-2.5 font-medium">الفعلي</th>
                          <th className="text-end py-2 px-2.5 font-medium">الفرق</th>
                          <th className="text-start py-2 px-2.5 font-medium">النتيجة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonRows.map((r, i) => (
                          <tr key={i} className={`border-b border-border/50 ${r.result === "shortage" ? "bg-destructive/5" : r.result === "surplus" ? "bg-warning/5" : ""}`}>
                            <td className="py-1.5 px-2.5 font-medium">{r.material}</td>
                            <td className="py-1.5 px-2.5 font-mono text-muted-foreground">{r.code}</td>
                            <td className="py-1.5 px-2.5 text-end">{r.expected}</td>
                            <td className="py-1.5 px-2.5 text-end">
                              <Input
                                type="number"
                                min={0}
                                value={r.actual}
                                onChange={(e) => handleManualActual(i, parseFloat(e.target.value) || 0)}
                                className="h-7 w-20 text-xs text-end inline-block"
                              />
                            </td>
                            <td className="py-1.5 px-2.5 text-end font-medium">
                              {r.diff === 0 ? "—" : <span className={r.diff < 0 ? "text-destructive" : "text-warning"}>{r.diff > 0 ? "+" : ""}{r.diff}</span>}
                            </td>
                            <td className="py-1.5 px-2.5">
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
                    <Button variant="outline" size="sm" onClick={() => setStep("form")}>رجوع</Button>
                    <Button size="sm" className="flex-1" onClick={handleSaveAudit}>
                      <CheckCircle2 className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />حفظ الجرد
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
