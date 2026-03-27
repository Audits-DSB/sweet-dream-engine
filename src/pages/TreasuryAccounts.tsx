import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Building, Plus, Pencil, Trash2, ArrowRight, AlertTriangle, Users, ArrowUpRight, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";

type Account = {
  id: string; name: string; account_type: string; custodian_name: string;
  custodian_user_id: string | null; bank_name: string | null; account_number: string | null;
  description: string | null; balance: number; is_active: boolean; created_at: string;
};

type Founder = { id: string; name: string; alias: string; active: boolean };
type FounderTx = { id: string; founderId: string; founderName: string; type: string; amount: number; date: string; notes: string; orderId?: string; collectionId?: string };

const ACCOUNT_TYPES = ["cashbox", "bank", "wallet", "founder_held", "other"] as const;

const toNum = (v: unknown) => Number(v) || 0;

export default function TreasuryAccountsPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { isAdmin, hasRole } = useAuth();
  const canManage = isAdmin || hasRole("founder");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({ name: "", account_type: "cashbox" as string, custodian_name: "", bank_name: "", account_number: "", description: "" });
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Founder capital state ──
  const [founders, setFounders] = useState<Founder[]>([]);
  const [founderTxs, setFounderTxs] = useState<FounderTx[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [orders, setOrders] = useState<Record<string, any>>({});
  const [foundersLoading, setFoundersLoading] = useState(true);

  // ── Withdraw dialog ──
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawFounder, setWithdrawFounder] = useState<Founder | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [withdrawSaving, setWithdrawSaving] = useState(false);

  useEffect(() => { fetchAccounts(); fetchFounderData(); }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    const data = await api.get<Account[]>("/treasury/accounts");
    setAccounts(data.map(a => ({ ...a, account_type: a.accountType ?? a.account_type, custodian_name: a.custodianName ?? a.custodian_name, bank_name: a.bankName ?? a.bank_name, account_number: a.accountNumber ?? a.account_number, is_active: a.isActive ?? a.is_active, created_at: a.createdAt ?? a.created_at })) as Account[]);
    setLoading(false);
  };

  const fetchFounderData = async () => {
    setFoundersLoading(true);
    try {
      const [f, txs, cols, ords] = await Promise.all([
        api.get<any[]>("/founders"),
        api.get<FounderTx[]>("/founder-transactions").catch(() => [] as FounderTx[]),
        api.get<any[]>("/collections").catch(() => [] as any[]),
        api.get<any[]>("/orders").catch(() => [] as any[]),
      ]);
      setFounders((f || []).map((x: any) => ({ id: x.id, name: x.name || "", alias: x.alias || "", active: x.active !== false })));
      setFounderTxs(txs || []);
      setCollections(cols || []);
      const om: Record<string, any> = {};
      (ords || []).forEach((o: any) => { om[o.id] = o; });
      setOrders(om);
    } catch { /* silent */ } finally {
      setFoundersLoading(false);
    }
  };

  // ── Capital balance calculation (mirrors Founders.tsx logic) ──
  const capitalByFounder = useMemo(() => {
    const capitalMap: Record<string, number> = {};
    founders.forEach(f => { capitalMap[f.id] = 0; });

    collections.forEach((col: any) => {
      const orderId = col.orderId ?? col.order_id;
      const paidAmount = toNum(col.paidAmount ?? col.paid_amount ?? col.amount);
      const order = orderId ? orders[orderId] : null;
      if (!orderId || !order || paidAmount <= 0) return;

      const totalSelling = toNum(order.totalSelling ?? order.total_selling);
      const totalCost = toNum(order.totalCost ?? order.total_cost);
      const grossProfit = totalSelling - totalCost;
      if (totalSelling <= 0) return;

      const paidRatio = Math.min(paidAmount / totalSelling, 1);
      const realizedProfit = grossProfit > 0 ? grossProfit * paidRatio : 0;
      const capitalReturn = Math.max(0, paidAmount - realizedProfit);
      if (capitalReturn <= 0) return;

      const contribs = Array.isArray(order.founderContributions) ? order.founderContributions
        : Array.isArray(order.founder_contributions) ? order.founder_contributions : [];
      const totalFounderPct = contribs.length > 0 ? contribs.reduce((s: number, c: any) => s + (c.percentage || 0), 0) || 100 : 100;

      founders.forEach(f => {
        let share = 0;
        if (contribs.length > 0) {
          const fc = contribs.find((c: any) => c.founderId === f.id || c.founder_id === f.id || c.founder === f.name);
          if (fc) share = capitalReturn * (fc.percentage || 0) / totalFounderPct;
        } else {
          share = capitalReturn / (founders.length || 1);
        }
        if (share > 0) capitalMap[f.id] = (capitalMap[f.id] || 0) + Math.round(share);
      });
    });
    return capitalMap;
  }, [collections, orders, founders]);

  function founderCapitalBalance(founderId: string): number {
    const myTxs = founderTxs.filter(tx => tx.founderId === founderId || (tx as any).founder_id === founderId);
    const autoCapital = capitalByFounder[founderId] || 0;
    const manualReturn = myTxs.filter(tx => tx.type === "capital_return").reduce((s, tx) => s + toNum(tx.amount), 0);
    const withdrawn = myTxs.filter(tx => tx.type === "capital_withdrawal").reduce((s, tx) => s + toNum(tx.amount), 0);
    return autoCapital + manualReturn - withdrawn;
  }

  // ── Withdraw action ──
  const handleWithdraw = async () => {
    if (!withdrawFounder) return;
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    const balance = founderCapitalBalance(withdrawFounder.id);
    if (amt > balance) { toast.error(`المبلغ يتجاوز الرصيد المتاح (${balance.toLocaleString()} ج.م)`); return; }
    setWithdrawSaving(true);
    try {
      await api.post("/founder-transactions", {
        founderId: withdrawFounder.id, founderName: withdrawFounder.name,
        type: "capital_withdrawal", amount: amt,
        notes: withdrawNotes || "سحب رأس مال",
        date: new Date().toISOString().split("T")[0],
      });
      toast.success(`تم تسجيل سحب ${amt.toLocaleString()} ج.م من رصيد ${withdrawFounder.name}`);
      setWithdrawOpen(false); setWithdrawAmount(""); setWithdrawNotes("");
      fetchFounderData();
    } catch { toast.error("فشل تسجيل السحب"); } finally { setWithdrawSaving(false); }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", account_type: "cashbox", custodian_name: "", bank_name: "", account_number: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setForm({ name: a.name, account_type: a.account_type, custodian_name: a.custodian_name, bank_name: a.bank_name || "", account_number: a.account_number || "", description: a.description || "" });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name || !form.custodian_name) { toast.error(t.treasuryFillRequired); return; }
    const payload = {
      name: form.name, accountType: form.account_type, custodianName: form.custodian_name,
      bankName: form.bank_name || null, accountNumber: form.account_number || null, description: form.description || null,
    };
    if (editing) {
      await api.patch(`/treasury/accounts/${editing.id}`, payload);
      toast.success(t.treasuryAccountUpdated);
    } else {
      await api.post("/treasury/accounts", payload);
      toast.success(t.treasuryAccountAdded);
    }
    setDialogOpen(false);
    fetchAccounts();
  };

  const confirmDelete = (a: Account) => setDeleteTarget(a);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/treasury/accounts/${deleteTarget.id}`);
      await logAudit({
        entity: "treasury-account",
        entityId: deleteTarget.id,
        entityName: deleteTarget.name,
        action: "delete",
        snapshot: {
          name: deleteTarget.name,
          accountType: deleteTarget.account_type,
          custodianName: deleteTarget.custodian_name,
          bankName: deleteTarget.bank_name ?? null,
          accountNumber: deleteTarget.account_number ?? null,
          description: deleteTarget.description ?? null,
        },
        endpoint: "/treasury/accounts",
      });
      toast.success(`تم حذف الحساب "${deleteTarget.name}" بنجاح`);
      setDeleteTarget(null);
      fetchAccounts();
    } catch {
      toast.error("فشل حذف الحساب");
    } finally {
      setDeleting(false);
    }
  };

  const fmtMoney = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/treasury")}><ArrowRight className="h-4 w-4 rtl:rotate-180" /></Button>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="page-header">{t.treasuryAccounts}</h1>
            <p className="page-description">{accounts.length} {t.treasuryAccountCount}</p>
          </div>
        </div>
        {canManage && <Button size="sm" onClick={openNew} data-testid="button-add-account"><Plus className="h-4 w-4 me-1" />{t.treasuryAddAccount}</Button>}
      </div>

      {/* ── Regular Treasury Accounts ── */}
      <div className="stat-card overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{t.loadingUsers}</div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{t.treasuryNoAccounts}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.treasuryAccountName}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.treasuryType}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.treasuryCustodian}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.treasuryBankInfo}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.balance}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
                {canManage && <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>}
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-account-${a.id}`}>
                  <td className="py-3 px-3 font-medium">{a.name}</td>
                  <td className="py-3 px-3"><Badge variant="outline">{t[("treasury_" + a.account_type) as keyof typeof t] as string || a.account_type}</Badge></td>
                  <td className="py-3 px-3">{a.custodian_name}</td>
                  <td className="py-3 px-3 text-muted-foreground">{a.bank_name ? `${a.bank_name} ${a.account_number ? "- " + a.account_number : ""}` : "—"}</td>
                  <td className="py-3 px-3 font-semibold">{fmtMoney(Number(a.balance))} {t.egp}</td>
                  <td className="py-3 px-3"><Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? t.active : t.inactive}</Badge></td>
                  {canManage && (
                    <td className="py-3 px-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)} data-testid={`button-edit-account-${a.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => confirmDelete(a)} data-testid={`button-delete-account-${a.id}`}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Founder Capital Accounts ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">حسابات رأس مال المؤسسين</h2>
            <p className="text-xs text-muted-foreground">الرصيد المتاح لكل مؤسس — قابل للسحب</p>
          </div>
        </div>

        <div className="stat-card overflow-x-auto">
          {foundersLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">جارٍ التحميل...</div>
          ) : founders.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">لا توجد بيانات مؤسسين</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-3 px-4 text-xs font-medium text-muted-foreground">المؤسس</th>
                  <th className="text-start py-3 px-4 text-xs font-medium text-muted-foreground">الحالة</th>
                  <th className="text-start py-3 px-4 text-xs font-medium text-muted-foreground">من تحصيلات</th>
                  <th className="text-start py-3 px-4 text-xs font-medium text-muted-foreground">مسحوب</th>
                  <th className="text-start py-3 px-4 text-xs font-medium text-muted-foreground">الرصيد المتاح</th>
                  {canManage && <th className="text-start py-3 px-4 text-xs font-medium text-muted-foreground">إجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {founders.map(f => {
                  const autoCapital = capitalByFounder[f.id] || 0;
                  const myTxs = founderTxs.filter(tx => tx.founderId === f.id || (tx as any).founder_id === f.id);
                  const manualReturn = myTxs.filter(tx => tx.type === "capital_return").reduce((s, tx) => s + toNum(tx.amount), 0);
                  const withdrawn = myTxs.filter(tx => tx.type === "capital_withdrawal").reduce((s, tx) => s + toNum(tx.amount), 0);
                  const balance = autoCapital + manualReturn - withdrawn;

                  return (
                    <tr key={f.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-primary">{f.name.charAt(0)}</span>
                          </div>
                          <div>
                            <div className="font-medium">{f.name}</div>
                            {f.alias && <div className="text-xs text-muted-foreground">{f.alias}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={f.active ? "text-success border-success/30 bg-success/5" : ""}>
                          {f.active ? t.active : t.inactive}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {autoCapital > 0
                          ? <span className="text-foreground font-medium">{autoCapital.toLocaleString("en-US")} {t.egp}</span>
                          : "—"}
                        {manualReturn > 0 && (
                          <div className="text-xs text-success">+ {manualReturn.toLocaleString("en-US")} مضاف</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {withdrawn > 0
                          ? <span className="text-destructive font-medium">−{withdrawn.toLocaleString("en-US")} {t.egp}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-base font-bold ${balance > 0 ? "text-primary" : balance < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {balance.toLocaleString("en-US")} {t.egp}
                        </span>
                      </td>
                      {canManage && (
                        <td className="py-3 px-4">
                          <button
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-40"
                            disabled={balance <= 0}
                            onClick={() => { setWithdrawFounder(f); setWithdrawAmount(""); setWithdrawNotes(""); setWithdrawOpen(true); }}
                          >
                            <ArrowUpRight className="h-3 w-3" />سحب
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/20">
                  <td colSpan={4} className="py-2.5 px-4 text-xs font-medium text-muted-foreground">إجمالي رأس المال المتاح</td>
                  <td className="py-2.5 px-4 font-bold text-primary">
                    {founders.reduce((s, f) => s + Math.max(0, founderCapitalBalance(f.id)), 0).toLocaleString("en-US")} {t.egp}
                  </td>
                  {canManage && <td />}
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد حذف الحساب
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm">هل أنت متأكد من حذف الحساب:</p>
            <p className="font-semibold text-base">{deleteTarget?.name}</p>
            {deleteTarget && Number(deleteTarget.balance) !== 0 && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                ⚠️ هذا الحساب لديه رصيد {fmtMoney(Number(deleteTarget.balance))} ج.م. تأكد من تصفية المعاملات أولاً.
              </div>
            )}
            <p className="text-xs text-muted-foreground">يمكن استرجاع الحساب لاحقاً من سجل الأنشطة.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "جارٍ الحذف..." : "حذف الحساب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Account Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t.treasuryEditAccount : t.treasuryAddAccount}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t.treasuryAccountName}</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-account-name" /></div>
            <div>
              <Label>{t.treasuryType}</Label>
              <Select value={form.account_type} onValueChange={v => setForm(f => ({ ...f, account_type: v }))}>
                <SelectTrigger data-testid="select-account-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(at => <SelectItem key={at} value={at}>{t[("treasury_" + at) as keyof typeof t] as string || at}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t.treasuryCustodian}</Label><Input value={form.custodian_name} onChange={e => setForm(f => ({ ...f, custodian_name: e.target.value }))} data-testid="input-custodian" /></div>
            {(form.account_type === "bank") && (
              <>
                <div><Label>{t.treasuryBankName}</Label><Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
                <div><Label>{t.treasuryAccountNumber}</Label><Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} /></div>
              </>
            )}
            <div><Label>{t.description}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={save} data-testid="button-save-account">{editing ? t.save : t.add}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Withdraw Capital Dialog ── */}
      <Dialog open={withdrawOpen} onOpenChange={open => { if (!open) setWithdrawOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-destructive" />
              سحب رأس مال — {withdrawFounder?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {withdrawFounder && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                الرصيد المتاح: <span className="font-bold text-primary">{founderCapitalBalance(withdrawFounder.id).toLocaleString("en-US")} {t.egp}</span>
              </div>
            )}
            <div>
              <Label>المبلغ ({t.egp})</Label>
              <Input
                type="number" min="1" placeholder="0"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>ملاحظات (اختياري)</Label>
              <Input value={withdrawNotes} onChange={e => setWithdrawNotes(e.target.value)} placeholder="سبب السحب..." />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setWithdrawOpen(false)} disabled={withdrawSaving}>إلغاء</Button>
            <Button variant="destructive" onClick={handleWithdraw} disabled={withdrawSaving}>
              {withdrawSaving ? "جارٍ الحفظ..." : "تأكيد السحب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
