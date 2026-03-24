import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRightLeft, Plus, ArrowRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Account = { id: string; name: string; balance: number; accountType: string };
type Tx = {
  id: string; accountId: string; txType: string; amount: number; balanceAfter: number;
  category: string | null; description: string | null; referenceId: string | null;
  linkedAccountId: string | null; createdAt: string;
};

const TX_TYPES = ["inflow", "withdrawal", "expense", "transfer_in", "transfer_out", "adjustment"] as const;
const CATEGORIES = ["marketing", "operations", "salaries", "supplies", "rent", "utilities", "logistics", "maintenance", "other"] as const;

export default function TreasuryTransactionsPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin, hasRole, user } = useAuth();
  const canManage = isAdmin || hasRole("founder");
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
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

    await api.post("/treasury/transactions", txPayload);

    // Mirror transaction for transfer_in
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

    toast.success(t.treasuryTxAdded);
    setDialogOpen(false);
    setForm({ account_id: "", tx_type: "expense", amount: "", category: "other", description: "", linked_account_id: "" });
    fetchAll();
  };

  const txTypeLabel = (type: string) => t[("treasury_tx_" + type) as keyof typeof t] as string || type;
  const catLabel = (cat: string) => t[("treasury_cat_" + cat) as keyof typeof t] as string || cat;
  const fmtMoney = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/treasury")}><ArrowRight className="h-4 w-4 rtl:rotate-180" /></Button>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><ArrowRightLeft className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="page-header">{t.treasuryTransactions}</h1>
            <p className="page-description">{filtered.length} {t.treasuryTxCount}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px] h-9"><Filter className="h-3.5 w-3.5 me-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.all}</SelectItem>
              {TX_TYPES.map(tt => <SelectItem key={tt} value={tt}>{txTypeLabel(tt)}</SelectItem>)}
            </SelectContent>
          </Select>
          {canManage && <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="button-new-tx"><Plus className="h-4 w-4 me-1" />{t.treasuryNewTx}</Button>}
        </div>
      </div>

      <div className="stat-card overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{t.loadingUsers}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{t.treasuryNoTx}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.date}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.treasuryType}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.treasuryAccountName}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.amount}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.treasuryBalanceAfter}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.treasuryCategory}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.description}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => {
                const isOut = ["withdrawal", "expense", "transfer_out"].includes(tx.txType);
                return (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-tx-${tx.id}`}>
                    <td className="py-3 px-3 text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</td>
                    <td className="py-3 px-3"><Badge variant={isOut ? "destructive" : "default"}>{txTypeLabel(tx.txType)}</Badge></td>
                    <td className="py-3 px-3">{accountName(tx.accountId)}</td>
                    <td className={`py-3 px-3 font-semibold ${isOut ? "text-destructive" : "text-success"}`}>{isOut ? "-" : "+"}{fmtMoney(Number(tx.amount))}</td>
                    <td className="py-3 px-3 text-muted-foreground">{fmtMoney(Number(tx.balanceAfter))}</td>
                    <td className="py-3 px-3">{tx.category ? <Badge variant="outline">{catLabel(tx.category)}</Badge> : "—"}</td>
                    <td className="py-3 px-3 text-muted-foreground max-w-[200px] truncate">{tx.description || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
    </div>
  );
}
