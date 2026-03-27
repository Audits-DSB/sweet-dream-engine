import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Landmark, Plus, TrendingUp, Wallet, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type FounderTx = {
  id: string;
  founderId: string;
  founderName: string;
  type: "contribution" | "withdrawal" | "funding";
  amount: number;
  method: string;
  orderId: string;
  notes: string;
  date: string;
  createdAt: string;
};

type Founder = { id: string; name: string; alias: string };
type Order = { id: string; clientName?: string; client_name?: string; client?: string };

const typeStylesConfig = {
  contribution: { icon: ArrowUpRight, color: "text-success" },
  funding: { icon: ArrowDownLeft, color: "text-info" },
  withdrawal: { icon: ArrowDownLeft, color: "text-warning" },
};

export default function FounderFundingPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<FounderTx | null>(null);
  const [selectedFounder, setSelectedFounder] = useState("");
  const [txnType, setTxnType] = useState<"contribution" | "withdrawal" | "funding">("contribution");
  const [txnAmount, setTxnAmount] = useState("");
  const [txnMethod, setTxnMethod] = useState("bank");
  const [txnOrder, setTxnOrder] = useState("");
  const [txnNotes, setTxnNotes] = useState("");
  const [useBalance, setUseBalance] = useState(false);

  const { data: transactions = [], isLoading: loadingTx } = useQuery<FounderTx[]>({
    queryKey: ["founder_transactions"],
    queryFn: () => api.get<FounderTx[]>("/founder-transactions"),
  });

  const { data: founders = [], isLoading: loadingFounders } = useQuery<Founder[]>({
    queryKey: ["founders"],
    queryFn: () => api.get<Founder[]>("/founders"),
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: () => api.get<Order[]>("/orders"),
  });

  type BalanceEntry = { founderId: string; founderName: string; balance: number };
  const { data: founderBalances = [] } = useQuery<BalanceEntry[]>({
    queryKey: ["founder_balances"],
    queryFn: () => api.get<BalanceEntry[]>("/founder-balances"),
  });
  // map by founderId for quick lookup
  const balanceByFounderId: Record<string, number> = {};
  for (const b of founderBalances) { balanceByFounderId[b.founderId] = b.balance; }

  const addMutation = useMutation({
    mutationFn: (body: object) => api.post("/founder-transactions", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founder_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["founder_balances"] });
      toast({ title: t.success, description: t.transactionRegistered });
      setDialogOpen(false);
      setSelectedFounder("");
      setTxnType("contribution");
      setTxnAmount("");
      setTxnMethod("bank");
      setTxnOrder("");
      setTxnNotes("");
      setUseBalance(false);
    },
    onError: (err: any) => {
      toast({ title: t.error, description: String(err), variant: "destructive" });
    },
  });

  const typeLabel = (type: string) =>
    type === "contribution" ? t.contributionType : type === "funding" ? t.fundingType : t.withdrawalType;
  const methodLabel = (m: string) =>
    m === "bank" ? t.bankTransfer : m === "cash" ? t.cash : t.fromFund;

  const founderNames = [...new Set(transactions.map((tx) => tx.founderName).filter(Boolean))];

  const filtered = transactions.filter((tx) => {
    const matchSearch =
      !search ||
      tx.founderName.toLowerCase().includes(search.toLowerCase()) ||
      tx.id.toLowerCase().includes(search.toLowerCase()) ||
      tx.notes.toLowerCase().includes(search.toLowerCase());
    const matchType = !filters.type || filters.type === "all" || tx.type === filters.type;
    const matchFounder =
      !filters.founder || filters.founder === "all" || tx.founderName === filters.founder;
    return matchSearch && matchType && matchFounder;
  });

  const totalContributions = transactions
    .filter((tx) => tx.type === "contribution")
    .reduce((s, tx) => s + tx.amount, 0);
  const totalFunding = transactions
    .filter((tx) => tx.type === "funding")
    .reduce((s, tx) => s + tx.amount, 0);
  const totalWithdrawals = transactions
    .filter((tx) => tx.type === "withdrawal")
    .reduce((s, tx) => s + tx.amount, 0);

  const fmtNum = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");

  const handleAdd = () => {
    if (!selectedFounder || !txnAmount) {
      toast({ title: t.error, description: t.selectFounderAndAmount, variant: "destructive" });
      return;
    }
    const amount = Number(txnAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: t.error, description: t.invalidAmount, variant: "destructive" });
      return;
    }
    const founder = founders.find((f) => f.id === selectedFounder);
    if (!founder) return;

    const availBal = balanceByFounderId[founder.id] || 0;
    const isFunding = txnType === "funding";
    const walletUsed = isFunding && useBalance ? Math.min(availBal, amount) : 0;
    const cashPortion = amount - walletUsed;
    const method = walletUsed > 0 && cashPortion > 0 ? "mixed" : walletUsed > 0 ? "balance" : txnMethod;
    const notes = walletUsed > 0
      ? (cashPortion > 0
          ? `${txnNotes ? txnNotes + " — " : ""}من الرصيد: ${walletUsed.toLocaleString("en-US")} + تمويل مالي: ${cashPortion.toLocaleString("en-US")}`
          : `${txnNotes ? txnNotes + " — " : ""}تمويل من الرصيد`)
      : txnNotes;

    addMutation.mutate({
      founderId: founder.id,
      founderName: founder.name,
      type: txnType,
      amount,
      method,
      orderId: txnType === "funding" ? txnOrder : "",
      notes,
      date: new Date().toISOString().split("T")[0],
    });
  };

  const isLoading = loadingTx || loadingFounders;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">{t.founderFundingTitle}</h1>
          <p className="page-description">{t.founderFundingDesc}</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="button-add-transaction">
          <Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.registerTransaction}
        </Button>
      </div>

      {/* Founder Balances */}
      {founderBalances.length > 0 && (
        <div className="stat-card">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" />أرصدة المؤسسين</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {founderBalances.map((b) => (
              <div key={b.founderId} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <span className="font-medium text-sm">{b.founderName}</span>
                {b.balance > 0 ? (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                    <Wallet className="h-3 w-3" />{b.balance.toLocaleString("en-US")} {t.currency}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground px-2.5 py-1 rounded-full bg-muted">لا يوجد رصيد</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t.totalContributions}
          value={`${fmtNum(totalContributions)} ${t.currency}`}
          change={`${transactions.filter((tx) => tx.type === "contribution").length} ${t.transactions}`}
          changeType="positive"
          icon={Wallet}
        />
        <StatCard
          title={t.orderFunding}
          value={`${fmtNum(totalFunding)} ${t.currency}`}
          change={t.distributedToOrders}
          changeType="neutral"
          icon={Landmark}
        />
        <StatCard
          title={t.withdrawals}
          value={`${fmtNum(totalWithdrawals)} ${t.currency}`}
          change={t.profitsWithdrawn}
          changeType="neutral"
          icon={TrendingUp}
        />
      </div>

      <DataToolbar
        searchPlaceholder={t.searchTransactions}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          {
            label: t.transactionType,
            value: "type",
            options: [
              { label: t.contributionType, value: "contribution" },
              { label: t.fundingType, value: "funding" },
              { label: t.withdrawalType, value: "withdrawal" },
            ],
          },
          {
            label: t.founder,
            value: "founder",
            options: founderNames.map((f) => ({ label: f, value: f })),
          },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() =>
          exportToCsv(
            "founder_funding",
            [t.code, t.date, t.founder, t.transactionType, t.amount, t.method, t.relatedOrder, t.notes],
            filtered.map((tx) => [
              tx.id, tx.date, tx.founderName, typeLabel(tx.type),
              tx.amount, methodLabel(tx.method), tx.orderId || "—", tx.notes,
            ])
          )
        }
      />

      <div className="stat-card overflow-x-auto">
        {transactions.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground text-sm">{t.noTransactionsYet || "لا توجد معاملات بعد"}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.code}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.date}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.founder}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.transactionType}</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.amount}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.method}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.relatedOrder}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.notes}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => {
                const style = typeStylesConfig[tx.type] || typeStylesConfig.contribution;
                const Icon = style.icon;
                return (
                  <tr
                    key={tx.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setDetailItem(tx)}
                    data-testid={`row-founder-tx-${tx.id}`}
                  >
                    <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{tx.id.slice(0, 8)}…</td>
                    <td className="py-3 px-3 text-muted-foreground">{tx.date}</td>
                    <td
                      className="py-3 px-3 font-medium hover:text-primary"
                      onClick={(e) => { e.stopPropagation(); navigate("/founders"); }}
                    >
                      {tx.founderName}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${style.color}`}>
                        <Icon className="h-3 w-3" />{typeLabel(tx.type)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-end font-semibold">
                      <span className={style.color}>
                        {tx.type === "contribution" ? "+" : "−"}{fmtNum(tx.amount)} {t.currency}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs text-muted-foreground">{methodLabel(tx.method)}</td>
                    <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                      {tx.orderId ? (
                        <span
                          className="hover:text-primary cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); navigate(`/orders/${tx.orderId}`); }}
                        >
                          {tx.orderId}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-3 px-3 text-xs text-muted-foreground max-w-[200px] truncate">{tx.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detailItem?.founderName} — {detailItem && typeLabel(detailItem.type)}</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{t.transactionType}</p>
                  <p className="font-semibold">{typeLabel(detailItem.type)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{t.amount}</p>
                  <p className="font-semibold">{fmtNum(detailItem.amount)} {t.currency}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{t.method}</p>
                  <p className="font-semibold">{methodLabel(detailItem.method)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                  <p className="font-semibold">{detailItem.date}</p>
                </div>
              </div>
              {detailItem.orderId && (
                <div
                  className="p-3 rounded-lg bg-info/10 text-info text-sm cursor-pointer"
                  onClick={() => { setDetailItem(null); navigate(`/orders/${detailItem.orderId}`); }}
                >
                  {t.relatedOrder}: {detailItem.orderId}
                </div>
              )}
              {detailItem.notes && <p className="text-sm text-muted-foreground">{detailItem.notes}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Transaction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setUseBalance(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.newTransaction}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t.selectFounder}</Label>
              <Select value={selectedFounder} onValueChange={(v) => { setSelectedFounder(v); setUseBalance(false); }}>
                <SelectTrigger className="h-9 mt-1" data-testid="select-founder">
                  <SelectValue placeholder={t.selectFounderPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {founders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name} — {f.alias}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Show balance badge under founder select */}
              {selectedFounder && (() => {
                const bal = balanceByFounderId[selectedFounder] || 0;
                return bal > 0 ? (
                  <p className="text-xs mt-1.5 flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <Wallet className="h-3 w-3" />رصيد متاح: {bal.toLocaleString("en-US")} {t.currency}
                  </p>
                ) : (
                  <p className="text-xs mt-1.5 text-muted-foreground">لا يوجد رصيد متاح</p>
                );
              })()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t.transactionTypeLabel}</Label>
                <Select value={txnType} onValueChange={(v) => setTxnType(v as typeof txnType)}>
                  <SelectTrigger className="h-9 mt-1" data-testid="select-tx-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contribution">{t.contributionType}</SelectItem>
                    <SelectItem value="funding">{t.fundOrder}</SelectItem>
                    <SelectItem value="withdrawal">{t.withdrawalType}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t.amount} *</Label>
                <Input
                  className="h-9 mt-1"
                  type="number"
                  min="0"
                  value={txnAmount}
                  onChange={(e) => setTxnAmount(e.target.value)}
                  data-testid="input-amount"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t.paymentMethod}</Label>
              <Select value={txnMethod} onValueChange={setTxnMethod}>
                <SelectTrigger className="h-9 mt-1" data-testid="select-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">{t.bankTransfer}</SelectItem>
                  <SelectItem value="cash">{t.cash}</SelectItem>
                  <SelectItem value="fund">{t.fromFund}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {txnType === "funding" && (
              <div>
                <Label className="text-xs">{t.relatedOrderLabel}</Label>
                <Select value={txnOrder} onValueChange={setTxnOrder}>
                  <SelectTrigger className="h-9 mt-1" data-testid="select-order">
                    <SelectValue placeholder={t.selectOrderPlaceholderFunding} />
                  </SelectTrigger>
                  <SelectContent>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.id} — {o.clientName || o.client_name || o.client || ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Balance checkbox — only for funding + founder with a balance */}
            {txnType === "funding" && selectedFounder && (balanceByFounderId[selectedFounder] || 0) > 0 && (() => {
              const bal = balanceByFounderId[selectedFounder];
              const amount = Number(txnAmount) || 0;
              const walletUsed = useBalance ? Math.min(bal, amount) : 0;
              const cashPortion = amount - walletUsed;
              return (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="use-balance"
                      checked={useBalance}
                      onCheckedChange={(c) => setUseBalance(!!c)}
                    />
                    <label htmlFor="use-balance" className="text-sm font-medium cursor-pointer">
                      السحب من الرصيد
                    </label>
                  </div>
                  {useBalance && amount > 0 && (
                    <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1 pt-1 border-t border-amber-200 dark:border-amber-800">
                      <div className="flex justify-between">
                        <span>من الرصيد</span>
                        <span className="font-semibold">{walletUsed.toLocaleString("en-US")} {t.currency}</span>
                      </div>
                      {cashPortion > 0 && (
                        <div className="flex justify-between">
                          <span>تمويل مالي</span>
                          <span className="font-semibold">{cashPortion.toLocaleString("en-US")} {t.currency}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            <div>
              <Label className="text-xs">{t.notes}</Label>
              <Input className="h-9 mt-1" value={txnNotes} onChange={(e) => setTxnNotes(e.target.value)} data-testid="input-notes" />
            </div>
            <Button className="w-full" onClick={handleAdd} disabled={addMutation.isPending} data-testid="button-save-transaction">
              {addMutation.isPending ? t.loading : t.registerTransaction}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
