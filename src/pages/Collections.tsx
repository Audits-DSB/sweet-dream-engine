import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { quickProfit, founderSplit } from "@/lib/orderProfit";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Clock, Receipt, Eye, MoreHorizontal, DollarSign, Trash2, Package, Users2, Building2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logAudit } from "@/lib/auditLog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type TreasuryAccount = { id: string; name: string; balance: number };
type PayEntry = { date: string; amount: number; method: string };
type LineItem = { code: string; material: string; imageUrl: string; unit: string; quantity: number; sellingPrice: number; costPrice: number; lineTotal: number; sourceOrderId?: string; companyProfitPct?: number };
type NotesMeta = { auditId?: string; auditDate?: string; sourceOrders?: string[]; sourceOrder?: string; lineItems?: LineItem[]; paymentHistory?: PayEntry[]; [key: string]: any };
type Collection = {
  id: string; order: string; client: string; clientId: string;
  issueDate: string; dueDate: string; total: number; paid: number;
  remaining: number; payments: PayEntry[];
  status: string;
  auditId?: string; auditDate?: string; sourceOrder?: string;
  sourceOrders?: string[]; lineItems?: LineItem[];
  _notesObj: NotesMeta; // kept for re-serialization when saving payments
};

function parseNotes(notes: any): NotesMeta {
  if (!notes) return {};
  if (typeof notes === "string") {
    try {
      const parsed = JSON.parse(notes);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch { /* plain text */ }
    if (notes.startsWith("جرد:")) return { auditId: notes.replace("جرد:", "").trim() };
    return {};
  }
  return {};
}

function mapCollection(raw: any, clientsMap: Record<string, string> = {}): Collection {
  const storedTotal = Number(raw.totalAmount ?? raw.total_amount ?? raw.total ?? 0);
  const paid = Number(raw.paidAmount ?? raw.paid_amount ?? raw.paid ?? 0);
  const clientId = raw.clientId || raw.client_id || "";
  const notesMeta = parseNotes(raw.notes);
  const lineItems: LineItem[] = notesMeta.lineItems || [];
  const computedTotal = lineItems.length > 0 ? lineItems.reduce((s, l) => s + (l.lineTotal ?? l.sellingPrice * (l.quantity || 1)), 0) : storedTotal;
  const total = computedTotal;
  // Payment history is stored in notes.paymentHistory — no separate DB column needed
  const payments: PayEntry[] = notesMeta.paymentHistory || [];
  return {
    id: raw.id,
    order: raw.order || raw.orderId || raw.order_id || notesMeta.sourceOrders?.[0] || notesMeta.sourceOrder || "",
    client: raw.client || raw.clientName || raw.client_name || clientsMap[clientId] || clientId,
    clientId,
    issueDate: raw.issueDate || raw.invoice_date || raw.invoiceDate || raw.createdAt || "",
    dueDate: raw.dueDate || raw.due_date || "",
    total, paid,
    remaining: Math.max(total - paid, 0),
    payments,
    status: raw.status || "Awaiting Confirmation",
    auditId: notesMeta.auditId || "",
    auditDate: notesMeta.auditDate || "",
    sourceOrders: (() => {
      // Derive from lineItems.sourceOrderId (same source the detail view uses) — more accurate than stored sourceOrders
      const fromLines = [...new Set((notesMeta.lineItems || []).map((l: any) => l.sourceOrderId).filter(Boolean))] as string[];
      if (fromLines.length > 0) return fromLines;
      return notesMeta.sourceOrders || (notesMeta.sourceOrder ? [notesMeta.sourceOrder] : []);
    })(),
    get sourceOrder() { return this.sourceOrders[0] || ""; },
    lineItems: notesMeta.lineItems || [],
    _notesObj: notesMeta,
  };
}

export default function CollectionsPage() {
  const { t, lang } = useLanguage();
  const { user, profile } = useAuth();
  const _userName = profile?.full_name || "مستخدم";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlStatus = searchParams.get("status") || "";
  const urlOrderId = searchParams.get("orderId") || "";
  const urlSearch = searchParams.get("search") || "";
  const urlCollectionId = searchParams.get("collectionId") || "";
  const [collections, setCollections] = useState<Collection[]>([]);
  const [search, setSearch] = useState(urlSearch);
  const [filters, setFilters] = useState<Record<string, string>>({ ...(urlStatus ? { status: urlStatus } : {}), ...(urlOrderId ? { orderId: urlOrderId } : {}) });
  const [selectedInvoice, setSelectedInvoice] = useState<Collection | null>(null);
  const [loadingCollections, setLoadingCollections] = useState(true);
  type OrderData = { orderId: string; totalSelling: number; totalCost: number; splitMode: string; founderContributions: any[]; companyProfitPct: number; deliveryFee?: number; deliveryFeeBearer?: string };
  const [selectedOrdersData, setSelectedOrdersData] = useState<OrderData[]>([]);
  const [selectedOrderLines, setSelectedOrderLines] = useState<LineItem[]>([]);
  const [founders, setFounders] = useState<{ id: string; name: string }[]>([]);
  const [loadingOrderData, setLoadingOrderData] = useState(false);

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Collection | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [linkToTreasury, setLinkToTreasury] = useState(true);
  const [treasuryAccountId, setTreasuryAccountId] = useState("");
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (urlSearch) setSearch(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    Promise.all([
      api.get<any[]>("/collections"),
      api.get<any[]>("/treasury/accounts"),
      api.get<any[]>("/clients"),
      api.get<any[]>("/founders"),
    ]).then(([cols, accounts, clients, fndrs]) => {
      const clientsMap: Record<string, string> = {};
      (clients || []).forEach((c: any) => { clientsMap[c.id] = c.name; });
      const mapped = (cols || []).map(c => mapCollection(c, clientsMap));
      setCollections(mapped);
      setTreasuryAccounts((accounts || []).filter((a: any) => a.isActive).map((a: any) => ({ id: a.id, name: a.name, balance: Number(a.balance) })));
      setFounders((fndrs || []).map((f: any) => ({ id: f.id, name: f.name })));
      if (urlCollectionId) {
        const target = mapped.find(c => c.id === urlCollectionId);
        if (target) setSelectedInvoice(target);
      }
    }).finally(() => setLoadingCollections(false));
  }, []);

  // Fetch linked order data + order lines for ALL source orders when a collection is selected
  useEffect(() => {
    const orderIds = (selectedInvoice?.sourceOrders?.length ?? 0) > 0
      ? (selectedInvoice!.sourceOrders as string[])
      : selectedInvoice?.order
        ? [selectedInvoice.order]
        : [];
    if (orderIds.length === 0) { setSelectedOrdersData([]); setSelectedOrderLines([]); return; }
    setLoadingOrderData(true);
    Promise.all(orderIds.map(orderId =>
      Promise.all([
        api.get<any>(`/orders/${orderId}`),
        api.get<any[]>(`/orders/${orderId}/lines`).catch(() => []),
      ]).then(([o, rawLines]) => ({ orderId, o, rawLines })).catch(() => null)
    )).then(results => {
      const allOrdersData: OrderData[] = [];
      const allLines: LineItem[] = [];
      for (const res of results) {
        if (!res || !res.o) continue;
        const { orderId, o, rawLines } = res;
        let contribs: any[] = [];
        const raw = o.founderContributions ?? o.founder_contributions;
        if (Array.isArray(raw)) contribs = raw;
        else if (typeof raw === "string") { try { contribs = JSON.parse(raw); } catch { contribs = []; } }
        const snappedPct = (contribs[0] as any)?.companyProfitPercentage;
        const companyProfitPct: number = snappedPct ?? o.companyProfitPercentage ?? o.company_profit_percentage ?? 40;
        allOrdersData.push({
          orderId,
          totalSelling: Number(o.totalSelling ?? o.total_selling ?? 0),
          totalCost: Number(o.totalCost ?? o.total_cost ?? 0),
          splitMode: o.splitMode || o.split_mode || "Equal",
          founderContributions: contribs,
          companyProfitPct,
          deliveryFee: Number(o.deliveryFee ?? o.delivery_fee ?? 0),
          deliveryFeeBearer: o.deliveryFeeBearer || o.delivery_fee_bearer || "client",
        });
        const mappedLines: LineItem[] = (rawLines || []).map((l: any) => {
          const qty = Number(l.quantity ?? 0);
          const price = Number(l.sellingPrice ?? l.selling_price ?? 0);
          const cost = Number(l.costPrice ?? l.cost_price ?? 0);
          return {
            code: l.materialCode || l.material_code || "",
            material: l.materialName || l.material_name || l.materialCode || "",
            imageUrl: l.imageUrl || l.image_url || "",
            unit: l.unit || "",
            quantity: qty, sellingPrice: price, costPrice: cost,
            lineTotal: qty * price,
            sourceOrderId: orderId,
            companyProfitPct,
          };
        }).filter((l: LineItem) => l.lineTotal > 0);
        allLines.push(...mappedLines);
      }
      setSelectedOrdersData(allOrdersData);
      setSelectedOrderLines(allLines);
    }).catch(() => { setSelectedOrdersData([]); setSelectedOrderLines([]); })
      .finally(() => setLoadingOrderData(false));
  }, [selectedInvoice?.id]);

  const filtered = collections.filter((c) => {
    const matchSearch = !search || c.client.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase()) || c.order.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || c.status === filters.status;
    const matchOrder = !filters.orderId || c.order === filters.orderId;
    return matchSearch && matchStatus && matchOrder;
  });

  const totalOutstanding = collections.reduce((sum, c) => sum + c.remaining, 0);
  const overdueAmount = collections.filter(c => c.status === "Overdue").reduce((sum, c) => sum + c.remaining, 0);
  const paidCount = collections.filter(c => c.status === "Paid").length;
  const totalCollected = collections.reduce((sum, c) => sum + c.paid, 0);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/collections/${deleteTarget.id}`);
      await logAudit({ entity: "collection", entityId: deleteTarget.id, entityName: `${deleteTarget.id} - ${deleteTarget.client}`, action: "delete", snapshot: deleteTarget as any, endpoint: "/collections", performedBy: _userName });
      setCollections(prev => prev.filter(c => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success(`تم حذف التحصيل: ${deleteTarget.id}`);
    } catch (err: any) {
      toast.error(err?.message || "فشل حذف التحصيل");
    } finally {
      setDeleting(false);
    }
  };

  const openPaymentDialog = (inv: Collection) => {
    setPaymentInvoice(inv);
    setPaymentAmount("");
    setPaymentMethod("cash");
    setLinkToTreasury(true);
    setTreasuryAccountId(treasuryAccounts.length > 0 ? treasuryAccounts[0].id : "");
    setPaymentDialogOpen(true);
  };

  const recordPayment = async () => {
    if (!paymentInvoice) return;
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) { toast.error(t.enterValidAmount); return; }
    if (amt > paymentInvoice.remaining) { toast.error(t.amountExceedsRemaining); return; }

    try {
      const result = await api.post<{ ok: boolean; newPaid: number; newRemaining: number; newStatus: string; paymentHistory: any[] }>(`/collections/${paymentInvoice.id}/record-payment`, {
        amount: amt,
        method: paymentMethod === "cash" ? "Cash" : "Bank Transfer",
        treasuryAccountId: linkToTreasury ? treasuryAccountId : null,
        linkToTreasury,
        orderId: paymentInvoice.order || null,
        performedBy: user?.id || null,
      });

      const { newPaid, newRemaining, newStatus, paymentHistory: updatedHistory } = result;

      if (newRemaining <= 0 && paymentInvoice.order) {
        toast.info("تم تحديث حالة الطلب — الأرباح جاهزة للتوزيع");
      }

      if (linkToTreasury && treasuryAccountId) {
        setTreasuryAccounts(prev => prev.map(a => a.id === treasuryAccountId ? { ...a, balance: Number(a.balance) + amt } : a));
      }

      await logAudit({ entity: "collection", entityId: paymentInvoice.id, entityName: `${paymentInvoice.id} - ${paymentInvoice.client}`, action: "update", snapshot: { paid: newPaid, remaining: newRemaining, status: newStatus, newPayment: { date: new Date().toISOString().split("T")[0], amount: amt } }, endpoint: `/collections/${paymentInvoice.id}/record-payment`, performedBy: _userName });

      const updatedNotesObj = { ...paymentInvoice._notesObj, paymentHistory: updatedHistory };
      setCollections(prev => prev.map(c => c.id !== paymentInvoice.id ? c : { ...c, paid: newPaid, remaining: newRemaining, payments: updatedHistory, status: newStatus, _notesObj: updatedNotesObj }));
      toast.success(t.paymentRecorded);
      setPaymentDialogOpen(false);
      setPaymentInvoice(null);
    } catch (err: any) {
      toast.error(err?.message || "فشل حفظ الدفعة");
    }
  };

  const fmtMoney = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.collectionsTitle}</h1>
        <p className="page-description">{t.collectionsDesc}</p>
      </div>

      {filters.orderId && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm">
          <Receipt className="h-4 w-4 text-primary shrink-0" />
          <span className="text-primary font-medium">تحصيلات الطلب: <span className="font-mono">{filters.orderId}</span></span>
          <button className="mr-auto text-primary/70 hover:text-primary" onClick={() => setFilters({})}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="cursor-pointer" onClick={() => setFilters({ ...filters, status: "Paid" })}>
          <StatCard title={t.totalCollected} value={`${totalCollected.toLocaleString()} ${t.currency}`} change={`${paidCount} ${t.fullyPaid}`} changeType="positive" icon={CheckCircle2} />
        </div>
        <div className="cursor-pointer" onClick={() => setFilters({ ...filters, status: "Partial" })}>
          <StatCard title={t.outstandingAmount} value={`${totalOutstanding.toLocaleString()} ${t.currency}`} change={`${collections.filter(c => c.remaining > 0).length} ${t.invoiceCount}`} changeType="neutral" icon={Clock} />
        </div>
        <div className="cursor-pointer" onClick={() => setFilters({ ...filters, status: "Overdue" })}>
          <StatCard title={t.overdueAmount} value={`${overdueAmount.toLocaleString()} ${t.currency}`} change={`${collections.filter(c => c.status === "Overdue").length} ${t.invoiceCount}`} changeType="negative" icon={AlertTriangle} />
        </div>
        <div className="cursor-pointer" onClick={() => setFilters({ ...filters, status: "all" })}>
          <StatCard title={t.invoicesLabel} value={collections.length} change={t.totalIssued} changeType="neutral" icon={Receipt} />
        </div>
      </div>

      <DataToolbar
        searchPlaceholder={t.searchInvoices}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[{ label: t.status, value: "status", options: [
          { label: t.awaitingConfirmation, value: "Awaiting Confirmation" },
          { label: t.partiallyPaid, value: "Partially Paid" },
          { label: t.installmentActive, value: "Installment Active" },
          { label: t.paid, value: "Paid" },
          { label: t.overdue, value: "Overdue" },
        ]}]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("collections", [t.invoice, t.order, t.client, t.issueDate, t.dueDate, t.totalAmount, t.paidAmount, t.remaining, t.status], filtered.map(c => [c.id, c.order, c.client, c.issueDate, c.dueDate, c.total, c.paid, c.remaining, c.status]))}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.invoice}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.order}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.issueDate}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.dueDate}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.totalAmount}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.paidAmount}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.remaining}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedInvoice(inv)}>
                <td className="py-3 px-3 font-mono text-xs font-medium">{inv.id}</td>
                <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                  {inv.sourceOrders && inv.sourceOrders.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {inv.sourceOrders.map(ordId => (
                        <span key={ordId} className="font-mono font-medium text-primary hover:text-primary/70 cursor-pointer transition-colors" onClick={() => navigate(`/orders/${ordId}`)}>{ordId}</span>
                      ))}
                    </div>
                  ) : inv.order ? (
                    <span className="font-mono font-medium text-primary hover:text-primary/70 cursor-pointer transition-colors" onClick={() => navigate(`/orders/${inv.order}`)}>{inv.order}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 px-3 font-medium hover:text-primary cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${inv.clientId}`); }}>{inv.client}</td>
                <td className="py-3 px-3 text-muted-foreground">{inv.issueDate}</td>
                <td className="py-3 px-3 text-muted-foreground">{inv.dueDate}</td>
                <td className="py-3 px-3 text-end font-medium">{inv.total.toLocaleString()} {t.currency}</td>
                <td className="py-3 px-3 text-end text-success font-medium">{inv.paid.toLocaleString()} {t.currency}</td>
                <td className="py-3 px-3 text-end">{inv.remaining > 0 ? <span className="text-destructive font-medium">{inv.remaining.toLocaleString()} {t.currency}</span> : "—"}</td>
                <td className="py-3 px-3"><StatusBadge status={inv.status} /></td>
                <td className="py-3 px-3 text-end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedInvoice(inv)}><Eye className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.viewDetails}</DropdownMenuItem>
                      {inv.remaining > 0 && <DropdownMenuItem onClick={() => openPaymentDialog(inv)}><DollarSign className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.recordPayment}</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="حذف التحصيل"
        description={`هل تريد حذف التحصيل "${deleteTarget?.id}"؟ يمكنك استعادته لاحقاً من سجل الأنشطة.`}
        onConfirm={handleDelete}
        loading={deleting}
      />

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice && !paymentDialogOpen} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedInvoice?.id} — {selectedInvoice?.client}</DialogTitle></DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">{t.totalAmount}</p>
                  <p className="font-bold">{selectedInvoice.total.toLocaleString("en-US")} {t.currency}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-success/10 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">مدفوع</p>
                  <p className="font-bold text-success">{selectedInvoice.paid.toLocaleString("en-US")} {t.currency}</p>
                </div>
                <div className={`p-2.5 rounded-lg text-center ${selectedInvoice.remaining > 0 ? "bg-destructive/10" : "bg-muted/50"}`}>
                  <p className="text-xs text-muted-foreground mb-0.5">{t.remaining}</p>
                  <p className={`font-bold ${selectedInvoice.remaining > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {selectedInvoice.remaining > 0 ? `${selectedInvoice.remaining.toLocaleString("en-US")} ${t.currency}` : "مكتمل ✓"}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                  <span>{t.paymentProgress}</span>
                  <span className="font-medium">{selectedInvoice.total > 0 ? ((selectedInvoice.paid / selectedInvoice.total) * 100).toFixed(0) : 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${selectedInvoice.total > 0 ? Math.min((selectedInvoice.paid / selectedInvoice.total) * 100, 100) : 0}%` }} />
                </div>
              </div>

              {/* Client + Audit links — compact row */}
              <div className="flex flex-wrap gap-3 text-xs items-center">
                <span className="text-muted-foreground">
                  العميل: <span className="font-semibold text-primary cursor-pointer hover:underline" onClick={() => { setSelectedInvoice(null); navigate(`/clients/${selectedInvoice.clientId}`); }}>{selectedInvoice.client}</span>
                </span>
                {selectedInvoice.auditId && (
                  <span className="text-muted-foreground">
                    الجرد: <span className="font-mono font-semibold text-amber-600 cursor-pointer hover:underline" onClick={() => { setSelectedInvoice(null); navigate(`/audits?search=${selectedInvoice.auditId}`); }}>#{selectedInvoice.auditId}</span>
                    {selectedInvoice.auditDate && <span> ({selectedInvoice.auditDate})</span>}
                  </span>
                )}
                <StatusBadge status={selectedInvoice.status} />
              </div>

              {/* ══ Per-order: materials table + profit calculation ══ */}
              {loadingOrderData ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (() => {
                const rawLines: LineItem[] =
                  (selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0)
                  ? selectedInvoice.lineItems
                  : selectedOrderLines;

                if (rawLines.length === 0 && selectedOrdersData.length === 0) return (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد تفاصيل مواد</p>
                );

                // Build code → sourceOrderId lookup from API lines (always have sourceOrderId)
                const codeToOrderId: Record<string, string> = {};
                for (const l of selectedOrderLines) {
                  if (l.code && l.sourceOrderId) codeToOrderId[l.code] = l.sourceOrderId;
                }
                // Fallback key: collection's primary linked order
                const primaryOrderId = selectedInvoice.order || selectedInvoice.sourceOrders?.[0] || selectedOrdersData[0]?.orderId || "—";

                // Enrich lines: fill missing sourceOrderId via code lookup or primary order
                const sourceLines: LineItem[] = rawLines.map(line => ({
                  ...line,
                  sourceOrderId: line.sourceOrderId || codeToOrderId[line.code] || primaryOrderId,
                }));

                // Group lines by sourceOrderId
                const linesByOrder: Record<string, LineItem[]> = {};
                for (const line of sourceLines) {
                  const key = line.sourceOrderId || primaryOrderId;
                  if (!linesByOrder[key]) linesByOrder[key] = [];
                  linesByOrder[key].push(line);
                }
                if (sourceLines.length === 0) {
                  for (const od of selectedOrdersData) linesByOrder[od.orderId] = [];
                }

                // Proportional coverage: each item gets the same paid% as the collection overall
                // If 75% of the invoice is paid → every item shows 75% coverage (partial)
                // Only "مكتملة" (covered) when 100% is paid
                const payRatio = selectedInvoice.total > 0
                  ? Math.min(selectedInvoice.paid / selectedInvoice.total, 1)
                  : 0;
                const linesByOrderWithCov = Object.fromEntries(
                  Object.entries(linesByOrder).map(([oid, lines]) => [
                    oid,
                    lines.map(item => {
                      if (payRatio <= 0) return { ...item, coveredTotal: 0, cov: "pending" as const };
                      if (payRatio >= 1) return { ...item, coveredTotal: item.lineTotal, cov: "covered" as const };
                      return { ...item, coveredTotal: item.lineTotal * payRatio, cov: "partial" as const };
                    }),
                  ])
                );

                return (
                  <div className="space-y-3">
                    {Object.entries(linesByOrder).map(([orderId, lines]) => {
                      const od = selectedOrdersData.find(o => o.orderId === orderId) || selectedOrdersData[0];
                      const linesWithCov = linesByOrderWithCov[orderId] || [];

                      let profitBox: React.ReactNode = null;
                      if (od) {
                        const contribs = od.founderContributions || [];
                        const snappedPct: number = contribs[0]?.companyProfitPercentage ?? od.companyProfitPct ?? 40;
                        const allTotal = sourceLines.reduce((s, l) => s + l.lineTotal, 0);
                        const orderTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
                        const orderCost = lines.reduce((s, l) => s + (l.lineCostTotal ?? l.costPrice * (l.quantity || 1)), 0);
                        const orderShare = allTotal > 0 ? orderTotal / allTotal : 1;
                        const orderPaid = selectedInvoice.paid * orderShare;
                        const delFeeDeduction = (od.deliveryFeeBearer || (od as any).delivery_fee_bearer) === "company" ? (od.deliveryFee || (od as any).delivery_fee || 0) : 0;
                        const qp = quickProfit({ orderTotal, totalCost: orderCost, paidValue: orderPaid, companyProfitPct: snappedPct, deliveryFeeDeduction: delFeeDeduction });
                        const gross = qp.expectedProfit;
                        const paidRatio = orderTotal > 0 ? Math.min(orderPaid / orderTotal, 1) : 0;
                        const realized = qp.realizedProfit;
                        const companyAmt = qp.companyProfit;
                        const foundersAmt = qp.foundersProfit;
                        const splitMode = od.splitMode?.includes("مساهمة") || od.splitMode?.toLowerCase().includes("contribution") ? "weighted" as const : "equal" as const;
                        const splits = founderSplit(foundersAmt, qp.recoveredCapital, contribs, splitMode);
                        const founderRows = contribs.length > 0
                          ? splits.map(s => ({ name: s.name, amount: s.profit }))
                          : founders.map(f => ({ name: f.name, amount: founders.length > 0 ? foundersAmt / founders.length : 0 }));

                        profitBox = (
                          <div className="bg-muted/30 border-t border-border p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                              <div className="flex justify-between"><span className="text-muted-foreground">إجمالي البيع:</span><span className="font-medium">{orderTotal.toLocaleString("en-US")} ج.م</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">التكلفة:</span><span className="font-medium">{orderCost.toLocaleString("en-US")} ج.م</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">الربح الكلي:</span><span className="font-semibold">{gross.toLocaleString("en-US")} ج.م</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">نسبة المحصّل:</span><span className="font-semibold text-success">{(paidRatio * 100).toFixed(1)}%</span></div>
                              <div className="flex justify-between col-span-2 pt-1 border-t border-border/50">
                                <span className="text-muted-foreground">الربح المحقق:</span>
                                <span className="font-bold text-success">{realized.toLocaleString("en-US")} ج.م</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1 flex justify-between items-center px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs">
                                <span className="text-blue-700 dark:text-blue-300 font-medium flex items-center gap-1"><Building2 className="h-3 w-3" /> شركة ({snappedPct}%)</span>
                                <span className="font-bold text-blue-700 dark:text-blue-300">{companyAmt.toLocaleString("en-US")} ج.م</span>
                              </div>
                              <div className="flex-1 flex justify-between items-center px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-xs">
                                <span className="text-green-700 dark:text-green-300 font-medium flex items-center gap-1"><Users2 className="h-3 w-3" /> مؤسسون ({100 - snappedPct}%)</span>
                                <span className="font-bold text-green-700 dark:text-green-300">{foundersAmt.toLocaleString("en-US")} ج.م</span>
                              </div>
                            </div>
                            {founderRows.length > 0 && (
                              <div className="grid grid-cols-2 gap-1">
                                {founderRows.map((f, i) => (
                                  <div key={i} className="flex justify-between items-center px-2 py-1 rounded bg-muted/50 text-xs">
                                    <span className="text-muted-foreground">{f.name}</span>
                                    <span className="font-semibold text-green-700 dark:text-green-300">{f.amount.toLocaleString("en-US")} ج.م</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div key={orderId} className="rounded-lg border border-border overflow-hidden">
                          {/* Order header */}
                          <div className="bg-muted/50 px-3 py-2 flex items-center justify-between text-xs">
                            {orderId && orderId !== "—" ? (
                              <span className="font-medium flex items-center gap-1.5">
                                أوردر: <span className="font-mono text-primary font-bold cursor-pointer hover:underline" onClick={() => { setSelectedInvoice(null); navigate(`/orders/${orderId}`); }}>{orderId}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">مواد التحصيل</span>
                            )}
                            <span className="text-muted-foreground">{lines.length} مادة</span>
                          </div>

                          {/* Materials table */}
                          {lines.length > 0 && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/30">
                                  <tr>
                                    <th className="text-start py-2 px-2 font-medium text-muted-foreground">المادة</th>
                                    <th className="text-end py-2 px-2 font-medium text-muted-foreground">الكمية</th>
                                    <th className="text-end py-2 px-2 font-medium text-muted-foreground">سعر الوحدة</th>
                                    <th className="text-end py-2 px-2 font-medium text-muted-foreground">الإجمالي</th>
                                    {selectedInvoice.paid > 0 && <th className="text-center py-2 px-2 font-medium text-muted-foreground">التغطية</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {linesWithCov.map((item, i) => (
                                    <tr key={i} className={`border-t border-border/40 ${
                                      item.cov === "covered" ? "bg-success/5" :
                                      item.cov === "partial" ? "bg-amber-50/50 dark:bg-amber-950/10" : ""
                                    }`}>
                                      <td className="py-2 px-2">
                                        <div className="flex items-center gap-1.5">
                                          {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.material} className="h-7 w-7 rounded object-cover flex-shrink-0 border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                          ) : (
                                            <div className="h-7 w-7 rounded bg-muted flex items-center justify-center flex-shrink-0"><Package className="h-3 w-3 text-muted-foreground" /></div>
                                          )}
                                          <div>
                                            <p className="font-medium">{item.material}</p>
                                            {item.code && <p className="text-[10px] text-muted-foreground font-mono">{item.code}</p>}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="py-2 px-2 text-end">{item.quantity} {item.unit}</td>
                                      <td className="py-2 px-2 text-end text-muted-foreground">{item.sellingPrice.toLocaleString("en-US")}</td>
                                      <td className="py-2 px-2 text-end font-semibold">{item.lineTotal.toLocaleString("en-US")}</td>
                                      {selectedInvoice.paid > 0 && (
                                        <td className="py-2 px-2 text-center">
                                          {item.cov === "covered" && <span className="text-success font-medium">✓ مكتملة</span>}
                                          {item.cov === "partial" && <span className="text-amber-600 font-medium">~ {(payRatio * 100).toFixed(1)}%</span>}
                                          {item.cov === "pending" && <span className="text-muted-foreground">—</span>}
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-muted/30 border-t border-border">
                                  <tr>
                                    <td colSpan={3} className="py-1.5 px-2 text-end text-xs text-muted-foreground font-medium">الإجمالي</td>
                                    <td className="py-1.5 px-2 text-end font-bold text-xs">{lines.reduce((s, l) => s + l.lineTotal, 0).toLocaleString("en-US")} ج.م</td>
                                    {selectedInvoice.paid > 0 && <td />}
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}

                          {/* Profit calculation box — integrated below the table */}
                          {profitBox}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}


              {/* Payment history */}
              {selectedInvoice.payments.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{t.paymentHistory}</h4>
                  <div className="space-y-1.5">
                    {selectedInvoice.payments.map((p, i) => (
                      <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-success/5 border border-success/20 text-sm">
                        <div>
                          <span className="font-medium">{p.amount.toLocaleString("en-US")} {t.currency}</span>
                          <span className="text-muted-foreground text-xs ltr:ml-2 rtl:mr-2">{t.via} {p.method}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{p.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedInvoice.remaining > 0 && (
                <Button className="w-full" onClick={() => { setSelectedInvoice(null); openPaymentDialog(selectedInvoice); }}>
                  <DollarSign className="h-4 w-4 me-1" />{t.recordPayment}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog with Treasury Link */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.recordPaymentDialog}</DialogTitle></DialogHeader>
          {paymentInvoice && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t.invoice}</span><span className="font-medium">{paymentInvoice.id}</span></div>
                <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t.client}</span><span className="font-medium">{paymentInvoice.client}</span></div>
                <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t.remaining}</span><span className="font-semibold text-destructive">{fmtMoney(paymentInvoice.remaining)} {t.currency}</span></div>
              </div>

              <div>
                <Label>{t.paymentAmount} ({t.currency})</Label>
                <Input type="number" min="1" max={paymentInvoice.remaining} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder={`${t.remaining}: ${fmtMoney(paymentInvoice.remaining)}`} />
              </div>

              <div>
                <Label>{t.paymentMethod}</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t.cash}</SelectItem>
                    <SelectItem value="bank">{t.bankTransfer}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="text-sm font-medium">{t.linkToTreasury}</p>
                  <p className="text-[10px] text-muted-foreground">{t.paymentLinkedToTreasury}</p>
                </div>
                <Switch checked={linkToTreasury} onCheckedChange={setLinkToTreasury} />
              </div>

              {linkToTreasury && (
                <div>
                  <Label>{t.treasuryAccountForPayment}</Label>
                  <Select value={treasuryAccountId} onValueChange={setTreasuryAccountId}>
                    <SelectTrigger><SelectValue placeholder={t.treasurySelectAccount} /></SelectTrigger>
                    <SelectContent>
                      {treasuryAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name} ({fmtMoney(Number(a.balance))})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {treasuryAccounts.length === 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">{t.treasuryNoAccounts}</p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={recordPayment}><DollarSign className="h-4 w-4 me-1" />{t.recordPayment}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
