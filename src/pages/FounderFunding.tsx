import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Landmark, Plus, TrendingUp, Wallet, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { toast } from "sonner";
import { foundersList, ordersList } from "@/data/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialTransactions = [
  { id: "TXN-001", date: "2025-03-05", founder: "أحمد الراشد", type: "contribution", amount: 150000, method: "bank", order: "—", notes: "ضخ رأسمال شهري", balance: 1250000 },
  { id: "TXN-002", date: "2025-03-05", founder: "سارة المنصور", type: "contribution", amount: 100000, method: "bank", order: "—", notes: "ضخ رأسمال شهري", balance: 950000 },
  { id: "TXN-003", date: "2025-03-04", founder: "أحمد الراشد", type: "funding", amount: 85000, method: "fund", order: "ORD-047", notes: "طلب مركز نور (50% حصة)", balance: 1100000 },
  { id: "TXN-004", date: "2025-03-04", founder: "سارة المنصور", type: "funding", amount: 42500, method: "fund", order: "ORD-047", notes: "طلب مركز نور (25%)", balance: 850000 },
  { id: "TXN-005", date: "2025-03-04", founder: "عمر خليل", type: "funding", amount: 42500, method: "fund", order: "ORD-047", notes: "طلب مركز نور (25%)", balance: 757500 },
  { id: "TXN-006", date: "2025-03-01", founder: "أحمد الراشد", type: "withdrawal", amount: 100000, method: "bank", order: "—", notes: "سحب أرباح", balance: 1185000 },
  { id: "TXN-007", date: "2025-02-28", founder: "عمر خليل", type: "contribution", amount: 120000, method: "cash", order: "—", notes: "زيادة رأسمال", balance: 800000 },
];

const typeStylesConfig = {
  contribution: { icon: ArrowUpRight, color: "text-success" },
  funding: { icon: ArrowDownLeft, color: "text-info" },
  withdrawal: { icon: ArrowDownLeft, color: "text-warning" },
};

export default function FounderFundingPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<typeof initialTransactions[0] | null>(null);
  const [selectedFounder, setSelectedFounder] = useState("");
  const [txnType, setTxnType] = useState("contribution");
  const [txnAmount, setTxnAmount] = useState("");
  const [txnMethod, setTxnMethod] = useState("bank");
  const [txnOrder, setTxnOrder] = useState("");
  const [txnNotes, setTxnNotes] = useState("");

  const founders = [...new Set(transactions.map(t => t.founder))];
  const typeLabel = (type: string) => type === "contribution" ? t.contributionType : type === "funding" ? t.fundingType : t.withdrawalType;
  const methodLabel = (m: string) => m === "bank" ? t.bankTransfer : m === "cash" ? t.cash : t.fromFund;

  const filtered = transactions.filter((tx) => {
    const matchSearch = !search || tx.founder.toLowerCase().includes(search.toLowerCase()) || tx.id.toLowerCase().includes(search.toLowerCase()) || tx.notes.toLowerCase().includes(search.toLowerCase());
    const matchType = !filters.type || filters.type === "all" || tx.type === filters.type;
    const matchFounder = !filters.founder || filters.founder === "all" || tx.founder === filters.founder;
    return matchSearch && matchType && matchFounder;
  });

  const totalContributions = transactions.filter(t => t.type === "contribution").reduce((s, t) => s + t.amount, 0);
  const totalFunding = transactions.filter(t => t.type === "funding").reduce((s, t) => s + t.amount, 0);
  const totalWithdrawals = transactions.filter(t => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0);

  const handleAdd = () => {
    if (!selectedFounder || !txnAmount) { toast.error(t.selectFounderAndAmount); return; }
    const founder = foundersList.find(f => f.id === selectedFounder);
    if (!founder) return;
    const num = transactions.length + 1;
    const newId = `TXN-${String(num).padStart(3, "0")}`;
    const today = new Date().toISOString().split("T")[0];
    setTransactions([{
      id: newId, date: today, founder: founder.name, type: txnType, amount: Number(txnAmount),
      method: txnMethod, order: txnType === "funding" ? txnOrder || "—" : "—", notes: txnNotes, balance: 0,
    }, ...transactions]);
    setSelectedFounder(""); setTxnType("contribution"); setTxnAmount(""); setTxnMethod("bank"); setTxnOrder(""); setTxnNotes("");
    setDialogOpen(false);
    toast.success(t.transactionRegistered);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">{t.founderFundingTitle}</h1>
          <p className="page-description">{t.founderFundingDesc}</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.registerTransaction}</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title={t.totalContributions} value={`${(totalContributions / 1000).toFixed(0)} ${t.thousand} ${t.currency}`} change={`${transactions.filter(t => t.type === "contribution").length} ${t.transactions}`} changeType="positive" icon={Wallet} />
        <StatCard title={t.orderFunding} value={`${(totalFunding / 1000).toFixed(1)} ${t.thousand} ${t.currency}`} change={t.distributedToOrders} changeType="neutral" icon={Landmark} />
        <StatCard title={t.withdrawals} value={`${(totalWithdrawals / 1000).toFixed(0)} ${t.thousand} ${t.currency}`} change={t.profitsWithdrawn} changeType="neutral" icon={TrendingUp} />
      </div>

      <DataToolbar
        searchPlaceholder={t.searchTransactions}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: t.transactionType, value: "type", options: [
            { label: t.contributionType, value: "contribution" }, { label: t.fundingType, value: "funding" }, { label: t.withdrawalType, value: "withdrawal" },
          ]},
          { label: t.founder, value: "founder", options: founders.map(f => ({ label: f, value: f })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("founder_funding", [t.code, t.date, t.founder, t.transactionType, t.amount, t.method, t.order, t.notes, t.balance], filtered.map(tx => [tx.id, tx.date, tx.founder, typeLabel(tx.type), tx.amount, methodLabel(tx.method), tx.order, tx.notes, tx.balance]))}
      />

      <div className="stat-card overflow-x-auto">
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
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.transactionBalance}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => {
              const style = typeStylesConfig[tx.type as keyof typeof typeStylesConfig];
              const Icon = style?.icon || ArrowUpRight;
              return (
                <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetailItem(tx)}>
                  <td className="py-3 px-3 font-mono text-xs">{tx.id}</td>
                  <td className="py-3 px-3 text-muted-foreground">{tx.date}</td>
                  <td className="py-3 px-3 font-medium hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate("/founders"); }}>{tx.founder}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${style?.color}`}>
                      <Icon className="h-3 w-3" />{typeLabel(tx.type)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-end font-semibold">
                    <span className={style?.color}>{tx.type === "contribution" ? "+" : "−"}{tx.amount.toLocaleString()} {t.currency}</span>
                  </td>
                  <td className="py-3 px-3 text-xs text-muted-foreground">{methodLabel(tx.method)}</td>
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                    {tx.order !== "—" ? <span className="hover:text-primary cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/orders/${tx.order}`); }}>{tx.order}</span> : "—"}
                  </td>
                  <td className="py-3 px-3 text-xs text-muted-foreground max-w-[200px] truncate">{tx.notes}</td>
                  <td className="py-3 px-3 text-end font-medium">{tx.balance.toLocaleString()} {t.currency}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{detailItem?.id} — {detailItem?.founder}</DialogTitle></DialogHeader>
          {detailItem && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.transactionType}</p><p className="font-semibold">{typeLabel(detailItem.type)}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.amount}</p><p className="font-semibold">{detailItem.amount.toLocaleString()} {t.currency}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.method}</p><p className="font-semibold">{methodLabel(detailItem.method)}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.date}</p><p className="font-semibold">{detailItem.date}</p></div>
              </div>
              {detailItem.order !== "—" && (
                <div className="p-3 rounded-lg bg-info/10 text-info text-sm cursor-pointer" onClick={() => { setDetailItem(null); navigate(`/orders/${detailItem.order}`); }}>{t.relatedOrder}: {detailItem.order}</div>
              )}
              {detailItem.notes && <p className="text-sm text-muted-foreground">{detailItem.notes}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Transaction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.newTransaction}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t.selectFounder}</Label>
              <Select value={selectedFounder} onValueChange={setSelectedFounder}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={t.selectFounderPlaceholder} /></SelectTrigger>
                <SelectContent>
                  {foundersList.map(f => <SelectItem key={f.id} value={f.id}>{f.name} — {f.alias}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t.transactionTypeLabel}</Label>
                <Select value={txnType} onValueChange={setTxnType}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contribution">{t.contributionType}</SelectItem>
                    <SelectItem value="funding">{t.fundOrder}</SelectItem>
                    <SelectItem value="withdrawal">{t.withdrawalType}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">{t.amount} *</Label><Input className="h-9 mt-1" type="number" value={txnAmount} onChange={(e) => setTxnAmount(e.target.value)} /></div>
            </div>
            <div>
              <Label className="text-xs">{t.paymentMethod}</Label>
              <Select value={txnMethod} onValueChange={setTxnMethod}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={t.selectOrderPlaceholderFunding} /></SelectTrigger>
                  <SelectContent>
                    {ordersList.map(o => <SelectItem key={o.id} value={o.id}>{o.id} — {o.client}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label className="text-xs">{t.notes}</Label><Input className="h-9 mt-1" value={txnNotes} onChange={(e) => setTxnNotes(e.target.value)} /></div>
            <Button className="w-full" onClick={handleAdd}>{t.registerTransaction}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
