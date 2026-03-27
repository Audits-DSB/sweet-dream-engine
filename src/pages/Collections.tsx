import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Clock, Receipt, Eye, MoreHorizontal, DollarSign, Trash2, Package, TrendingUp, Users2, Building2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logAudit } from "@/lib/auditLog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type TreasuryAccount = { id: string; name: string; balance: number };
type LineItem = { code: string; material: string; imageUrl: string; unit: string; quantity: number; sellingPrice: number; lineTotal: number };
type Collection = {
  id: string; order: string; client: string; clientId: string;
  issueDate: string; dueDate: string; total: number; paid: number;
  remaining: number; payments: { date: string; amount: number; method: string }[];
  status: string;
  // Audit-sourced fields (stored in notes JSON)
  auditId?: string; auditDate?: string; sourceOrder?: string;
  sourceOrders?: string[]; lineItems?: LineItem[];
};

function parseNotes(notes: any): { auditId?: string; auditDate?: string; sourceOrders?: string[]; sourceOrder?: string; lineItems?: LineItem[] } {
  if (!notes) return {};
  if (typeof notes === "string") {
    try {
      const parsed = JSON.parse(notes);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch { /* plain text */ }
    // Legacy plain text like "جرد: AUD-001"
    if (notes.startsWith("جرد:")) return { auditId: notes.replace("جرد:", "").trim() };
    return {};
  }
  return {};
}

function parsePaymentsField(raw: any): { payments: { date: string; amount: number; method: string }[] } {
  let parsed: any = raw;
  if (typeof raw === "string") { try { parsed = JSON.parse(raw); } catch { parsed = []; } }
  if (Array.isArray(parsed)) return { payments: parsed };
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.history)) return { payments: parsed.history };
  return { payments: [] };
}

function mapCollection(raw: any, clientsMap: Record<string, string> = {}): Collection {
  const total = Number(raw.totalAmount ?? raw.total_amount ?? raw.total ?? 0);
  const paid = Number(raw.paidAmount ?? raw.paid_amount ?? raw.paid ?? 0);
  const clientId = raw.clientId || raw.client_id || "";
  const { payments } = parsePaymentsField(raw.payments);
  const notesMeta = parseNotes(raw.notes);
  return {
    id: raw.id,
    order: raw.order || raw.orderId || raw.order_id || notesMeta.sourceOrders?.[0] || notesMeta.sourceOrder || "",
    client: raw.client || raw.clientName || raw.client_name || clientsMap[clientId] || clientId,
    clientId,
    issueDate: raw.issueDate || raw.invoice_date || raw.invoiceDate || raw.createdAt || "",
    dueDate: raw.dueDate || raw.due_date || "",
    total, paid,
    remaining: Number(raw.outstanding ?? raw.remaining ?? (total - paid)),
    payments,
    status: raw.status || "Awaiting Confirmation",
    auditId: notesMeta.auditId || "",
    auditDate: notesMeta.auditDate || "",
    sourceOrder: notesMeta.sourceOrders?.[0] || notesMeta.sourceOrder || "",
    sourceOrders: notesMeta.sourceOrders || (notesMeta.sourceOrder ? [notesMeta.sourceOrder] : []),
    lineItems: notesMeta.lineItems || [],
  };
}

export default function CollectionsPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlStatus = searchParams.get("status") || "";
  const urlOrderId = searchParams.get("orderId") || "";
  const [collections, setCollections] = useState<Collection[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({ ...(urlStatus ? { status: urlStatus } : {}), ...(urlOrderId ? { orderId: urlOrderId } : {}) });
  const [selectedInvoice, setSelectedInvoice] = useState<Collection | null>(null);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [selectedOrderData, setSelectedOrderData] = useState<{ totalSelling: number; totalCost: number; splitMode: string; founderContributions: any[] } | null>(null);
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
    Promise.all([
      api.get<any[]>("/collections"),
      api.get<any[]>("/treasury/accounts"),
      api.get<any[]>("/clients"),
      api.get<any[]>("/founders"),
    ]).then(([cols, accounts, clients, fndrs]) => {
      const clientsMap: Record<string, string> = {};
      (clients || []).forEach((c: any) => { clientsMap[c.id] = c.name; });
      setCollections((cols || []).map(c => mapCollection(c, clientsMap)));
      setTreasuryAccounts((accounts || []).filter((a: any) => a.isActive).map((a: any) => ({ id: a.id, name: a.name, balance: Number(a.balance) })));
      setFounders((fndrs || []).map((f: any) => ({ id: f.id, name: f.name })));
    }).finally(() => setLoadingCollections(false));
  }, []);

  // Fetch linked order data + order lines when a collection is selected
  useEffect(() => {
    const orderId = selectedInvoice?.order || selectedInvoice?.sourceOrders?.[0];
    if (!orderId) { setSelectedOrderData(null); setSelectedOrderLines([]); return; }
    setLoadingOrderData(true);
    Promise.all([
      api.get<any>(`/orders/${orderId}`),
      api.get<any[]>(`/orders/${orderId}/lines`).catch(() => []),
    ]).then(([o, rawLines]) => {
        if (o) {
          let contribs: any[] = [];
          const raw = o.founderContributions ?? o.founder_contributions;
          if (Array.isArray(raw)) contribs = raw;
          else if (typeof raw === "string") { try { contribs = JSON.parse(raw); } catch { contribs = []; } }
          setSelectedOrderData({
            totalSelling: Number(o.totalSelling ?? o.total_selling ?? 0),
            totalCost: Number(o.totalCost ?? o.total_cost ?? 0),
            splitMode: o.splitMode || o.split_mode || "Equal",
            founderContributions: Array.isArray(contribs) ? contribs : [],
          });
        }
        // Map order lines → LineItem format
        const mappedLines: LineItem[] = (rawLines || []).map((l: any) => {
          const qty = Number(l.quantity ?? 0);
          const price = Number(l.sellingPrice ?? l.selling_price ?? 0);
          return {
            code: l.materialCode || l.material_code || "",
            material: l.materialName || l.material_name || l.materialCode || "",
            imageUrl: l.imageUrl || l.image_url || "",
            unit: l.unit || "",
            quantity: qty,
            sellingPrice: price,
            lineTotal: qty * price,
          };
        }).filter((l: LineItem) => l.lineTotal > 0);
        setSelectedOrderLines(mappedLines);
      })
      .catch(() => { setSelectedOrderData(null); setSelectedOrderLines([]); })
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
      await logAudit({ entity: "collection", entityId: deleteTarget.id, entityName: `${deleteTarget.id} - ${deleteTarget.client}`, action: "delete", snapshot: deleteTarget as any, endpoint: "/collections" });
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

    const newPaid = paymentInvoice.paid + amt;
    const newRemaining = paymentInvoice.total - newPaid;
    const newPaymentEntry = { date: new Date().toISOString().split("T")[0], amount: amt, method: paymentMethod === "cash" ? "Cash" : "Bank Transfer" };
    const newPaymentHistory = [...paymentInvoice.payments, newPaymentEntry];
    const newStatus = newRemaining <= 0 ? "Paid" : "Partially Paid";

    // Persist to Supabase — preserve meta structure if present (audit-sourced)
    const hasMeta = !!(paymentInvoice.auditId || (paymentInvoice.lineItems && paymentInvoice.lineItems.length > 0));
    const updatedPaymentsField = hasMeta
      ? { meta: { auditId: paymentInvoice.auditId, auditDate: paymentInvoice.auditDate, sourceOrder: paymentInvoice.sourceOrder, lineItems: paymentInvoice.lineItems }, history: newPaymentHistory }
      : newPaymentHistory;

    try {
      await api.patch(`/collections/${paymentInvoice.id}`, {
        paidAmount: newPaid, outstanding: newRemaining, status: newStatus,
        notes: paymentInvoice.auditId ? `جرد: ${paymentInvoice.auditId}` : undefined,
      });
    } catch (err: any) {
      toast.error(err?.message || "فشل حفظ الدفعة");
      return;
    }

    // Auto-unlock profit distribution when fully paid
    if (newRemaining <= 0 && paymentInvoice.order) {
      try {
        await api.patch(`/orders/${paymentInvoice.order}`, { status: "Delivered" });
        await logAudit({ entity: "order", entityId: paymentInvoice.order, entityName: `طلب ${paymentInvoice.order}`, action: "update", snapshot: { status: "Delivered", trigger: "collection_paid", collectionId: paymentInvoice.id }, endpoint: `/orders/${paymentInvoice.order}` });
        toast.info("تم تحديث حالة الطلب — الأرباح جاهزة للتوزيع");
      } catch { /* non-critical */ }
    }

    // Link to treasury if enabled
    if (linkToTreasury && treasuryAccountId) {
      const account = treasuryAccounts.find(a => a.id === treasuryAccountId);
      if (account) {
        const newBalance = Number(account.balance) + amt;
        await api.post("/treasury/transactions", {
          accountId: treasuryAccountId, txType: "inflow", amount: amt,
          balanceAfter: newBalance,
          description: `تحصيل: ${paymentInvoice.id} - ${paymentInvoice.client}`,
          referenceId: paymentInvoice.id, performedBy: user?.id || null, newBalance,
        });
        setTreasuryAccounts(prev => prev.map(a => a.id === treasuryAccountId ? { ...a, balance: newBalance } : a));
      }
    }

    await logAudit({ entity: "collection", entityId: paymentInvoice.id, entityName: `${paymentInvoice.id} - ${paymentInvoice.client}`, action: "update", snapshot: { paid: newPaid, remaining: newRemaining, status: newStatus, newPayment: newPaymentEntry }, endpoint: `/collections/${paymentInvoice.id}` });

    // Update local state
    setCollections(prev => prev.map(c => c.id !== paymentInvoice.id ? c : { ...c, paid: newPaid, remaining: newRemaining, payments: newPaymentHistory, status: newStatus }));
    toast.success(t.paymentRecorded);
    setPaymentDialogOpen(false);
    setPaymentInvoice(null);
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
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(inv)} data-testid={`button-delete-collection-${inv.id}`}>
                        <Trash2 className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />حذف
                      </DropdownMenuItem>
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
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.totalAmount}</p><p className="font-semibold">{selectedInvoice.total.toLocaleString()} {t.currency}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.remaining}</p><p className={`font-semibold ${selectedInvoice.remaining > 0 ? "text-destructive" : "text-success"}`}>{selectedInvoice.remaining > 0 ? `${selectedInvoice.remaining.toLocaleString()} ${t.currency}` : "مكتمل"}</p></div>
              </div>

              {/* Orders + Client + Audit Source */}
              <div className={`grid gap-3 text-sm ${selectedInvoice.auditId ? "grid-cols-3" : "grid-cols-2"}`}>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1.5">{t.order}</p>
                  {selectedInvoice.sourceOrders && selectedInvoice.sourceOrders.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedInvoice.sourceOrders.map(ordId => (
                        <span key={ordId} className="font-mono text-sm font-semibold text-primary underline-offset-2 hover:underline cursor-pointer" onClick={() => { setSelectedInvoice(null); navigate(`/orders/${ordId}`); }}>{ordId}</span>
                      ))}
                    </div>
                  ) : selectedInvoice.order ? (
                    <span className="font-semibold text-primary underline-offset-2 hover:underline cursor-pointer" onClick={() => { setSelectedInvoice(null); navigate(`/orders/${selectedInvoice.order}`); }}>{selectedInvoice.order}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70" onClick={() => { setSelectedInvoice(null); navigate(`/clients/${selectedInvoice.clientId}`); }}>
                  <p className="text-xs text-muted-foreground">{t.client}</p>
                  <p className="font-semibold text-primary">{selectedInvoice.client}</p>
                </div>
                {selectedInvoice.auditId && (
                  <div
                    className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                    onClick={() => { setSelectedInvoice(null); navigate(`/audits?search=${selectedInvoice.auditId}`); }}
                  >
                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">مصدر الجرد</p>
                    <p className="font-mono font-semibold text-amber-700 dark:text-amber-300 text-sm">#{selectedInvoice.auditId}</p>
                    {selectedInvoice.auditDate && <p className="text-xs text-muted-foreground mt-0.5">{selectedInvoice.auditDate}</p>}
                  </div>
                )}
              </div>

              {/* ── Profit Breakdown ── */}
              {(selectedOrderData || loadingOrderData) && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-success" />
                    توزيع الربح المحقق
                    {loadingOrderData && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ms-1" />}
                  </h4>
                  {selectedOrderData && (() => {
                    const contribs = selectedOrderData.founderContributions || [];
                    // Use ONLY the snapshotted % from the order — never falls back to current settings
                    const snappedCompanyPct: number | undefined = contribs[0]?.companyProfitPercentage;
                    if (snappedCompanyPct === undefined) {
                      return (
                        <p className="text-xs text-muted-foreground py-2 text-center">{t.noOrderProfitData}</p>
                      );
                    }
                    const grossProfit = selectedOrderData.totalSelling - selectedOrderData.totalCost;
                    // paidRatio = paid ÷ FULL ORDER total (not just this invoice amount)
                    const paidRatio = selectedOrderData.totalSelling > 0
                      ? Math.min(selectedInvoice.paid / selectedOrderData.totalSelling, 1)
                      : 0;
                    const realizedProfit = Math.round(grossProfit * paidRatio);
                    const companyShare = Math.round(realizedProfit * snappedCompanyPct / 100);
                    const foundersShare = realizedProfit - companyShare;

                    // Per-founder distribution using order's founderContributions
                    const totalFounderPct = contribs.length > 0
                      ? contribs.reduce((s: number, fc: any) => s + (fc.percentage || 0), 0) || 100
                      : 100;
                    const founderRows = contribs.length > 0
                      ? contribs.map((fc: any) => ({
                          id: fc.founderId || fc.founder,
                          name: fc.founder || fc.founderId || "مؤسس",
                          amount: Math.round(foundersShare * (fc.percentage || 0) / totalFounderPct),
                        }))
                      : founders.map(f => ({
                          id: f.id, name: f.name,
                          amount: founders.length > 0 ? Math.round(foundersShare / founders.length) : 0,
                        }));

                    const hasContribs = contribs.length > 0;
                    return (
                      <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-1">
                          <span>إجمالي الربح: <strong className="text-foreground">{grossProfit.toLocaleString()} ج.م</strong></span>
                          <span>نسبة المحصّل: <strong className="text-foreground">{(paidRatio * 100).toFixed(1)}%</strong></span>
                          <span>ربح محقق: <strong className="text-success">{realizedProfit.toLocaleString()} ج.م</strong></span>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-center">
                            <Building2 className="h-4 w-4 mx-auto mb-1 text-blue-600 dark:text-blue-400" />
                            <p className="text-xs text-muted-foreground">حصة الشركة ({snappedCompanyPct}%)</p>
                            <p className="font-bold text-blue-700 dark:text-blue-300">{companyShare.toLocaleString()} ج.م</p>
                          </div>
                          <div className="flex-1 p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-center">
                            <Users2 className="h-4 w-4 mx-auto mb-1 text-green-600 dark:text-green-400" />
                            <p className="text-xs text-muted-foreground">حصة المؤسسين ({100 - snappedCompanyPct}%)</p>
                            <p className="font-bold text-green-700 dark:text-green-300">{foundersShare.toLocaleString()} ج.م</p>
                          </div>
                        </div>
                        {founderRows.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <p className="text-xs text-muted-foreground font-medium">
                              توزيع المؤسسين ({hasContribs ? (contribs.every((fc: any) => Math.abs((fc.percentage || 0) - (contribs[0]?.percentage || 0)) < 0.5) ? "متساوٍ" : "حسب المساهمة") : "متساوٍ"}):
                            </p>
                            {founderRows.map(f => (
                              <div key={f.id} className="flex justify-between items-center text-xs px-2 py-1 rounded bg-muted/40">
                                <span>{f.name}</span>
                                <span className="font-semibold text-green-700 dark:text-green-300">{f.amount.toLocaleString()} ج.م</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── Material Coverage by Paid Amount ── */}
              {(() => {
                // Use order lines from DB (primary) or lineItems from notes (fallback for audit collections)
                const sourceLines: LineItem[] =
                  selectedOrderLines.length > 0 ? selectedOrderLines
                  : (selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0 ? selectedInvoice.lineItems : []);
                if (sourceLines.length === 0 || selectedInvoice.paid <= 0) return null;

                let remaining = selectedInvoice.paid;
                const coverage = sourceLines.map(item => {
                  if (remaining <= 0) return { ...item, coveredQty: 0, coveredTotal: 0, status: "pending" as const };
                  if (remaining >= item.lineTotal) {
                    remaining -= item.lineTotal;
                    return { ...item, coveredQty: item.quantity, coveredTotal: item.lineTotal, status: "covered" as const };
                  }
                  // Partial: how many WHOLE units can be covered
                  const coveredQty = item.sellingPrice > 0 ? Math.floor(remaining / item.sellingPrice) : 0;
                  const coveredTotal = coveredQty * item.sellingPrice;
                  const leftoverValue = remaining - coveredTotal; // fractional amount left
                  remaining = 0;
                  // If we couldn't cover even 1 unit but there's money left, show as partial with 0 units
                  return {
                    ...item,
                    coveredQty,
                    coveredTotal: coveredTotal + leftoverValue, // include the sub-unit leftover in the amount
                    status: (coveredQty > 0 || leftoverValue > 0) ? "partial" as const : "pending" as const,
                  };
                });

                const totalOrderValue = sourceLines.reduce((s, l) => s + l.lineTotal, 0);
                const coveredTotal = coverage.reduce((s, c) => s + c.coveredTotal, 0);
                const uncoveredTotal = totalOrderValue - coveredTotal;
                const coveredCount = coverage.filter(c => c.status === "covered").length;
                const partialCount = coverage.filter(c => c.status === "partial").length;

                return (
                  <div className="space-y-3">
                    {/* Summary bar */}
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        المواد المغطّاة بالمبلغ المحصّل
                        <span className="text-xs font-normal text-muted-foreground">
                          (مدفوع: {selectedInvoice.paid.toLocaleString()} ج.م من {selectedInvoice.total.toLocaleString()} ج.م)
                        </span>
                      </h4>
                      {/* Coverage progress */}
                      <div className="rounded-lg bg-muted/30 border border-border p-3 mb-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                          <span>مغطّى: <strong className="text-success">{coveredTotal.toLocaleString()} ج.م</strong></span>
                          <span>متبقّي بدون تغطية: <strong className="text-destructive">{Math.max(0, uncoveredTotal).toLocaleString()} ج.م</strong></span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-success rounded-full transition-all"
                            style={{ width: `${totalOrderValue > 0 ? Math.min((coveredTotal / totalOrderValue) * 100, 100) : 0}%` }}
                          />
                        </div>
                        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" />{coveredCount} مادة مكتملة</span>
                          {partialCount > 0 && <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" />{partialCount} جزئية</span>}
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-muted-foreground" />{coverage.filter(c => c.status === "pending").length} معلّقة</span>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60">
                          <tr>
                            <th className="text-start py-2 px-2 font-medium text-muted-foreground">المادة</th>
                            <th className="text-end py-2 px-2 font-medium text-muted-foreground">الكمية الكلية</th>
                            <th className="text-end py-2 px-2 font-medium text-muted-foreground">سعر الوحدة</th>
                            <th className="text-end py-2 px-2 font-medium text-muted-foreground">قيمة السطر</th>
                            <th className="text-end py-2 px-2 font-medium text-muted-foreground">الكمية المغطّاة</th>
                            <th className="text-end py-2 px-2 font-medium text-muted-foreground">المبلغ المغطّى</th>
                            <th className="text-center py-2 px-2 font-medium text-muted-foreground">الحالة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {coverage.map((item, i) => (
                            <tr key={i} className={`border-t border-border/50 transition-colors ${
                              item.status === "covered" ? "bg-success/5" :
                              item.status === "partial" ? "bg-amber-50/50 dark:bg-amber-950/10" :
                              "opacity-40"
                            }`}>
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-2">
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.material} className="h-7 w-7 rounded object-cover flex-shrink-0 border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  ) : (
                                    <div className="h-7 w-7 rounded bg-muted flex items-center justify-center flex-shrink-0"><Package className="h-3 w-3 text-muted-foreground" /></div>
                                  )}
                                  <span className="font-medium">{item.material}</span>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-end">{item.quantity} {item.unit}</td>
                              <td className="py-2 px-2 text-end text-muted-foreground">{item.sellingPrice.toLocaleString()}</td>
                              <td className="py-2 px-2 text-end">{item.lineTotal.toLocaleString()}</td>
                              <td className="py-2 px-2 text-end font-medium">
                                {item.status === "covered" ? `${item.coveredQty} ${item.unit}` :
                                 item.status === "partial" ? `${item.coveredQty} ${item.unit}` :
                                 "—"}
                              </td>
                              <td className="py-2 px-2 text-end font-semibold">
                                {item.status !== "pending" ? `${Math.round(item.coveredTotal).toLocaleString()} ج.م` : "—"}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {item.status === "covered" && <span className="inline-flex items-center gap-1 text-success text-xs font-medium"><CheckCircle2 className="h-3 w-3" />مكتملة</span>}
                                {item.status === "partial" && <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium"><AlertTriangle className="h-3 w-3" />جزئية</span>}
                                {item.status === "pending" && <span className="text-muted-foreground text-xs">غير مغطّاة</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/40 border-t border-border">
                          <tr>
                            <td colSpan={3} className="py-2 px-2 font-semibold text-end text-xs text-muted-foreground">الإجمالي</td>
                            <td className="py-2 px-2 text-end font-bold text-xs">{totalOrderValue.toLocaleString()} ج.م</td>
                            <td />
                            <td className="py-2 px-2 text-end font-bold text-xs text-success">{Math.round(coveredTotal).toLocaleString()} ج.م</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Line items from audit */}
              {selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Package className="h-4 w-4 text-primary" />المواد المستهلكة</h4>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60">
                        <tr>
                          <th className="text-start py-2 px-2 font-medium text-muted-foreground">المادة</th>
                          <th className="text-start py-2 px-2 font-medium text-muted-foreground">الكود</th>
                          <th className="text-end py-2 px-2 font-medium text-muted-foreground">الكمية</th>
                          <th className="text-end py-2 px-2 font-medium text-muted-foreground">سعر الوحدة</th>
                          <th className="text-end py-2 px-2 font-medium text-muted-foreground">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.lineItems.map((item, i) => (
                          <tr key={i} className="border-t border-border/50 hover:bg-muted/30">
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-2">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.material} className="h-8 w-8 rounded object-cover flex-shrink-0 border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                ) : (
                                  <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0"><Package className="h-3.5 w-3.5 text-muted-foreground" /></div>
                                )}
                                <span className="font-medium">{item.material}</span>
                              </div>
                            </td>
                            <td className="py-2 px-2 font-mono text-muted-foreground">{item.code}</td>
                            <td className="py-2 px-2 text-end">{item.quantity} {item.unit}</td>
                            <td className="py-2 px-2 text-end">{item.sellingPrice.toLocaleString()}</td>
                            <td className="py-2 px-2 text-end font-semibold">{item.lineTotal.toLocaleString()} {t.currency}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/40 border-t border-border">
                        <tr>
                          <td colSpan={4} className="py-2 px-2 font-semibold text-end">الإجمالي</td>
                          <td className="py-2 px-2 text-end font-bold text-primary">{selectedInvoice.total.toLocaleString()} {t.currency}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-2">{t.paymentHistory}</h4>
                {selectedInvoice.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.noPayments}</p>
                ) : (
                  <div className="space-y-2">
                    {selectedInvoice.payments.map((p, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 rounded-lg bg-success/5 border border-success/20 text-sm">
                        <div>
                          <span className="font-medium">{p.amount.toLocaleString()} {t.currency}</span>
                          <span className="text-muted-foreground ltr:ml-2 rtl:mr-2">{t.via} {p.method}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{p.date}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{t.paymentProgress}</span>
                  <span className="font-medium">{((selectedInvoice.paid / selectedInvoice.total) * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(selectedInvoice.paid / selectedInvoice.total) * 100}%` }} />
                </div>
              </div>
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
