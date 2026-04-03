import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRightLeft, Plus, ArrowRight, Filter, Trash2, AlertTriangle, ArrowDownLeft, ArrowUpRight, ExternalLink, Clock, Wallet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";

type Account = { id: string; name: string; balance: number; accountType: string };
type Tx = {
  id: string; accountId: string; txType: string; amount: number; balanceAfter: number;
  category: string | null; description: string | null; referenceId: string | null;
  linkedAccountId: string | null; createdAt: string;
};

const TX_TYPES = ["inflow", "withdrawal", "expense", "transfer_in", "transfer_out", "adjustment"] as const;
const CATEGORIES = ["marketing", "operations", "salaries", "supplies", "rent", "utilities", "logistics", "maintenance", "other"] as const;

function extractLinks(desc: string | null): { orderId?: string; collectionId?: string; text: string } {
  if (!desc) return { text: "" };
  let orderId: string | undefined;
  let collectionId: string | undefined;
  let text = desc;

  const orderMatch = desc.match(/\[orderId:(ORD-\d+)\]/i) || desc.match(/(ORD-\d+)/i);
  if (orderMatch) {
    orderId = orderMatch[1] || orderMatch[0];
    text = text.replace(orderMatch[0], "").trim();
  }

  const colMatch = desc.match(/(?:تحصيل|COL)[:.]?\s*(COL-[\w]+)/i) || desc.match(/(COL-[\w]+)/i);
  if (colMatch) {
    collectionId = colMatch[1] || colMatch[0];
  }

  return { orderId, collectionId, text: text.replace(/\s+/g, " ").trim() };
}

export default function TreasuryTransactionsPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin, hasRole, user, profile } = useAuth();
  const _userName = profile?.full_name || "مستخدم";
  const canManage = isAdmin || hasRole("founder");
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tx | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [form, setForm] = useState({
    account_id: "", tx_type: "expense" as string, amount: "", category: "other" as string,
    description: "", linked_account_id: "",
  });

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { if (searchParams.get("new") === "1" && canManage) setDialogOpen(true); }, [searchParams]);

  const fetchAll = async () => {
    setLoading(true);
    const [txData, accData] = await Promise.all([
      api.get<Tx[]>("/treasury/transactions"),
      api.get<Account[]>("/treasury/accounts"),
    ]);
    setTransactions(txData);
    setAccounts(accData.filter((a: any) => a.isActive));
    setLoading(false);
  };

  const accountName = (id: string) => accounts.find(a => a.id === id)?.name ?? "—";

  const filtered = filterType === "all" ? transactions : transactions.filter(tx => tx.txType === filterType);

  const submitTx = async () => {
    if (!form.account_id || !form.amount || Number(form.amount) <= 0) { toast.error(t.treasuryFillRequired); return; }

    const account = accounts.find(a => a.id === form.account_id);
    if (!account) return;

    const amt = Number(form.amount);
    const isOut = ["withdrawal", "expense", "transfer_out"].includes(form.tx_type);
    const newBalance = isOut ? Number(account.balance) - amt : Number(account.balance) + amt;

    if (isOut && newBalance < 0) { toast.error(t.treasuryInsufficientFunds); return; }

    const txPayload: any = {
      accountId: form.account_id,
      txType: form.tx_type,
      amount: amt,
      balanceAfter: newBalance,
      category: (form.tx_type === "expense" || form.tx_type === "withdrawal") ? form.category : null,
      description: form.description || null,
      linkedAccountId: form.linked_account_id || null,
      performedBy: user?.id || null,
      newBalance,
    };

    if (form.tx_type === "transfer_out" && form.linked_account_id) {
      const linked = accounts.find(a => a.id === form.linked_account_id);
      if (linked) txPayload.linkedNewBalance = Number(linked.balance) + amt;
    }

    const saved = await api.post<Tx>("/treasury/transactions", txPayload);

    if (form.tx_type === "transfer_out" && form.linked_account_id) {
      const linked = accounts.find(a => a.id === form.linked_account_id);
      if (linked) {
        const linkedNewBal = Number(linked.balance) + amt;
        await api.post("/treasury/transactions", {
          accountId: form.linked_account_id,
          txType: "transfer_in",
          amount: amt,
          balanceAfter: linkedNewBal,
          description: `${t.treasuryTransferFrom} ${account.name}`,
          linkedAccountId: form.account_id,
          performedBy: user?.id || null,
        });
      }
    }

    await logAudit({
      entity: "treasury-transaction",
      entityId: saved?.id || "",
      entityName: `${txTypeLabel(form.tx_type)} — ${account.name} — ${fmtMoney(amt)} ${t.currency}`,
      action: "create",
      snapshot: { ...txPayload, accountName: account.name },
      endpoint: "/treasury/transactions", performedBy: _userName,
    });

    toast.success(t.treasuryTxAdded);
    setDialogOpen(false);
    setForm({ account_id: "", tx_type: "expense", amount: "", category: "other", description: "", linked_account_id: "" });
    fetchAll();
  };

  const handleDelete = async (tx: Tx) => {
    setDeleting(true);
    try {
      await api.delete(`/treasury/transactions/${tx.id}`);
      await logAudit({
        entity: "treasury-transaction",
        entityId: tx.id,
        entityName: `${txTypeLabel(tx.txType)} — ${accountName(tx.accountId)} — ${fmtMoney(Number(tx.amount))} ${t.currency}`,
        action: "delete",
        snapshot: tx as any,
        endpoint: "/treasury/transactions",
        idField: "id", performedBy: _userName,
      });
      setTransactions(prev => prev.filter(t => t.id !== tx.id));
      setDeleteTarget(null);
      toast.success("تم حذف المعاملة");
    } catch {
      toast.error("فشل حذف المعاملة");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const result = await api.delete<{ deleted: number }>("/treasury/transactions/all");
      await logAudit({
        entity: "treasury-transaction",
        entityId: "ALL",
        entityName: `حذف كل سجلات الخزينة (${result.deleted} سجل)`,
        action: "delete",
        snapshot: { count: result.deleted },
        endpoint: "/treasury/transactions/all", performedBy: _userName,
      });
      setTransactions([]);
      setDeleteAllOpen(false);
      toast.success(`تم حذف ${result.deleted} معاملة`);
    } catch {
      toast.error("فشل حذف جميع المعاملات");
    } finally {
      setDeleting(false);
    }
  };

  const txTypeLabel = (type: string) => t[("treasury_tx_" + type) as keyof typeof t] as string || type;
  const catLabel = (cat: string) => t[("treasury_cat_" + cat) as keyof typeof t] as string || cat;
  const fmtMoney = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US", { minimumFractionDigits: 2 });

  const isOutflow = (type: string) => ["withdrawal", "expense", "transfer_out"].includes(type);

  const txIcon = (type: string) => {
    if (type === "transfer_in" || type === "transfer_out") return <RefreshCw className="h-4 w-4" />;
    if (isOutflow(type)) return <ArrowUpRight className="h-4 w-4" />;
    return <ArrowDownLeft className="h-4 w-4" />;
  };

  const txColor = (type: string) => {
    if (type === "transfer_in" || type === "transfer_out") return { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400" };
    if (isOutflow(type)) return { bg: "bg-red-100 dark:bg-red-900/30", text: "text-destructive" };
    return { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-success" };
  };

  const totalIn = filtered.filter(tx => !isOutflow(tx.txType)).reduce((s, tx) => s + Number(tx.amount), 0);
  const totalOut = filtered.filter(tx => isOutflow(tx.txType)).reduce((s, tx) => s + Number(tx.amount), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/treasury")}><ArrowRight className="h-4 w-4 rtl:rotate-180" /></Button>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><ArrowRightLeft className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="page-header">{t.treasuryTransactions}</h1>
            <p className="page-description">{filtered.length} معاملة</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px] h-9"><Filter className="h-3.5 w-3.5 me-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.all}</SelectItem>
              {TX_TYPES.map(tt => <SelectItem key={tt} value={tt}>{txTypeLabel(tt)}</SelectItem>)}
            </SelectContent>
          </Select>
          {canManage && transactions.length > 0 && (
            <Button size="sm" variant="destructive" onClick={() => setDeleteAllOpen(true)} data-testid="button-delete-all-tx">
              <Trash2 className="h-4 w-4 me-1" />حذف الكل
            </Button>
          )}
          {canManage && <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="button-new-tx"><Plus className="h-4 w-4 me-1" />{t.treasuryNewTx}</Button>}
        </div>
      </div>

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="stat-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">إجمالي الوارد</p>
            <p className="text-lg font-bold text-success">+{fmtMoney(totalIn)}</p>
          </div>
          <div className="stat-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">إجمالي الصادر</p>
            <p className="text-lg font-bold text-destructive">-{fmtMoney(totalOut)}</p>
          </div>
          <div className="stat-card p-3 text-center col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground mb-1">الصافي</p>
            <p className={`text-lg font-bold ${totalIn - totalOut >= 0 ? "text-primary" : "text-destructive"}`}>
              {totalIn - totalOut >= 0 ? "+" : ""}{fmtMoney(totalIn - totalOut)}
            </p>
          </div>
        </div>
      )}

      <div className="stat-card">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{t.loadingUsers}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>{t.treasuryNoTx}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map(tx => {
              const out = isOutflow(tx.txType);
              const color = txColor(tx.txType);
              const links = extractLinks(tx.description);
              return (
                <div key={tx.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group" data-testid={`row-tx-${tx.id}`}>
                  <div className={`mt-0.5 flex-shrink-0 h-9 w-9 rounded-full ${color.bg} flex items-center justify-center`}>
                    <span className={color.text}>{txIcon(tx.txType)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{txTypeLabel(tx.txType)}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{accountName(tx.accountId)}</Badge>
                      {tx.category && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{catLabel(tx.category)}</Badge>}
                    </div>

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {links.collectionId && (
                        <button
                          className="inline-flex items-center gap-1 font-mono text-xs bg-success/10 text-success px-1.5 py-0.5 rounded hover:bg-success/20 transition-colors"
                          onClick={() => navigate(`/collections?search=${links.collectionId}`)}
                        >
                          {links.collectionId} <ExternalLink className="h-2.5 w-2.5" />
                        </button>
                      )}
                      {links.orderId && (
                        <button
                          className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors"
                          onClick={() => navigate(`/orders/${links.orderId}`)}
                        >
                          {links.orderId} <ExternalLink className="h-2.5 w-2.5" />
                        </button>
                      )}
                      {links.text && <span className="text-xs text-muted-foreground truncate max-w-[250px]">{links.text}</span>}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span>{new Date(tx.createdAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</span>
                      <span className="opacity-60">·</span>
                      <span>الرصيد: {fmtMoney(Number(tx.balanceAfter))}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-sm font-bold ${out ? "text-destructive" : "text-success"}`}>
                      {out ? "-" : "+"}{fmtMoney(Number(tx.amount))}
                      <span className="text-[10px] font-normal text-muted-foreground mr-0.5">{t.currency}</span>
                    </span>
                    {canManage && (
                      <button
                        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                        onClick={() => setDeleteTarget(tx)}
                        data-testid={`button-delete-tx-${tx.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.treasuryNewTx}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.treasuryAccountName}</Label>
              <Select value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))}>
                <SelectTrigger data-testid="select-tx-account"><SelectValue placeholder={t.treasurySelectAccount} /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({fmtMoney(Number(a.balance))})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.treasuryType}</Label>
              <Select value={form.tx_type} onValueChange={v => setForm(f => ({ ...f, tx_type: v }))}>
                <SelectTrigger data-testid="select-tx-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TX_TYPES.map(tt => <SelectItem key={tt} value={tt}>{txTypeLabel(tt)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.amount} ({t.egp})</Label>
              <Input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} data-testid="input-tx-amount" />
            </div>
            {(form.tx_type === "expense" || form.tx_type === "withdrawal") && (
              <div>
                <Label>{t.treasuryCategory}</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{catLabel(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.tx_type === "transfer_out" && (
              <div>
                <Label>{t.treasuryTransferTo}</Label>
                <Select value={form.linked_account_id} onValueChange={v => setForm(f => ({ ...f, linked_account_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t.treasurySelectAccount} /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => a.id !== form.account_id).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>{t.description}</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} data-testid="textarea-tx-description" />
            </div>
          </div>
          <DialogFooter><Button onClick={submitTx} data-testid="button-submit-tx">{t.treasuryRecordTx}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />حذف المعاملة
            </DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف هذه المعاملة؟ لا يمكن التراجع عن الحذف.</p>
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">النوع:</span>
                  <Badge variant={isOutflow(deleteTarget.txType) ? "destructive" : "default"}>{txTypeLabel(deleteTarget.txType)}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الحساب:</span>
                  <span className="font-medium">{accountName(deleteTarget.accountId)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المبلغ:</span>
                  <span className="font-bold">{fmtMoney(Number(deleteTarget.amount))} {t.currency}</span>
                </div>
                {deleteTarget.description && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الوصف:</span>
                    <span className="text-end max-w-[160px] truncate">{deleteTarget.description}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>إلغاء</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)} disabled={deleting} data-testid="button-confirm-delete-tx">
              {deleting ? "جارٍ الحذف..." : "تأكيد الحذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />حذف جميع المعاملات
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">سيتم حذف <span className="font-bold text-foreground">{transactions.length} معاملة</span> نهائياً. هذا الإجراء لا يمكن التراجع عنه.</p>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive">
              لن تتأثر معاملات المؤسسين (المساهمات والسحوبات) بالحذف.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteAllOpen(false)} disabled={deleting}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDeleteAll} disabled={deleting} data-testid="button-confirm-delete-all-tx">
              {deleting ? "جارٍ الحذف..." : `حذف ${transactions.length} معاملة`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
