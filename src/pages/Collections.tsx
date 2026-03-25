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
import { AlertTriangle, CheckCircle2, Clock, Receipt, Eye, MoreHorizontal, DollarSign, Trash2, Package, TrendingUp, Users2, Building2 } from "lucide-react";
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
  // Audit-sourced fields (stored inside payments JSONB meta)
  auditId?: string; auditDate?: string; sourceOrder?: string; lineItems?: LineItem[];
};

function parsePaymentsField(raw: any): { payments: { date: string; amount: number; method: string }[]; meta: { auditId?: string; auditDate?: string; sourceOrder?: string; lineItems?: LineItem[] } } {
  let parsed: any = raw;
  if (typeof raw === "string") { try { parsed = JSON.parse(raw); } catch { parsed = []; } }
  if (Array.isArray(parsed)) return { payments: parsed, meta: {} };
  if (parsed && typeof parsed === "object") {
    return { payments: Array.isArray(parsed.history) ? parsed.history : [], meta: parsed.meta || {} };
  }
  return { payments: [], meta: {} };
}

function mapCollection(raw: any): Collection {
  const total = Number(raw.total ?? raw.totalAmount ?? 0);
  const paid = Number(raw.paid ?? raw.paidAmount ?? 0);
  const { payments, meta } = parsePaymentsField(raw.payments);
  return {
    id: raw.id,
    order: raw.order || raw.orderId || raw.order_id || "",
    client: raw.client || raw.clientName || raw.client_name || "",
    clientId: raw.clientId || raw.client_id || "",
    issueDate: raw.issueDate || raw.issue_date || raw.createdAt || "",
    dueDate: raw.dueDate || raw.due_date || "",
    total, paid,
    remaining: Number(raw.remaining ?? (total - paid)),
    payments,
    status: raw.status || "Awaiting Confirmation",
    auditId: meta.auditId || "", auditDate: meta.auditDate || "",
    sourceOrder: meta.sourceOrder || "", lineItems: meta.lineItems || [],
  };
}

export default function CollectionsPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlStatus = searchParams.get("status") || "";
  const [collections, setCollections] = useState<Collection[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>(urlStatus ? { status: urlStatus } : {});
  const [selectedInvoice, setSelectedInvoice] = useState<Collection | null>(null);
  const [loadingCollections, setLoadingCollections] = useState(true);

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
    ]).then(([cols, accounts]) => {
      setCollections((cols || []).map(mapCollection));
      setTreasuryAccounts((accounts || []).filter((a: any) => a.isActive).map((a: any) => ({ id: a.id, name: a.name, balance: Number(a.balance) })));
    }).finally(() => setLoadingCollections(false));
  }, []);

  const filtered = collections.filter((c) => {
    const matchSearch = !search || c.client.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase()) || c.order.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || c.status === filters.status;
    return matchSearch && matchStatus;
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
        paid: newPaid, remaining: newRemaining, status: newStatus, payments: updatedPaymentsField,
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
                <td className="py-3 px-3 font-mono text-xs text-muted-foreground hover:text-primary cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/orders/${inv.order}`); }}>{inv.order}</td>
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
              {/* Audit badge */}
              {selectedInvoice.auditId && (
                <div className="flex flex-wrap gap-2 text-xs p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <span className="text-amber-700 dark:text-amber-300 font-medium">مصدر: جرد</span>
                  <span className="text-muted-foreground">#{selectedInvoice.auditId}</span>
                  {selectedInvoice.auditDate && <span className="text-muted-foreground">— {selectedInvoice.auditDate}</span>}
                  {selectedInvoice.sourceOrder && <span className="text-muted-foreground">| طلب: {selectedInvoice.sourceOrder}</span>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.totalAmount}</p><p className="font-semibold">{selectedInvoice.total.toLocaleString()} {t.currency}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.remaining}</p><p className={`font-semibold ${selectedInvoice.remaining > 0 ? "text-destructive" : "text-success"}`}>{selectedInvoice.remaining > 0 ? `${selectedInvoice.remaining.toLocaleString()} ${t.currency}` : "مكتمل"}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedInvoice.order ? (
                  <div className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70" onClick={() => { setSelectedInvoice(null); navigate(`/orders/${selectedInvoice.order}`); }}><p className="text-xs text-muted-foreground">{t.order}</p><p className="font-semibold text-primary">{selectedInvoice.order}</p></div>
                ) : <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.order}</p><p className="text-muted-foreground text-sm">—</p></div>}
                <div className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70" onClick={() => { setSelectedInvoice(null); navigate(`/clients/${selectedInvoice.clientId}`); }}><p className="text-xs text-muted-foreground">{t.client}</p><p className="font-semibold text-primary">{selectedInvoice.client}</p></div>
              </div>

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
