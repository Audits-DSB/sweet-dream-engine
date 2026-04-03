import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Landmark, Building, TrendingUp, TrendingDown, ArrowRightLeft, Plus, DollarSign, ExternalLink, Clock, ArrowDownLeft, ArrowUpRight, RotateCcw, ShoppingBag, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["hsl(200, 70%, 45%)", "hsl(150, 55%, 45%)", "hsl(38, 90%, 50%)", "hsl(280, 55%, 55%)", "hsl(0, 0%, 55%)"];

type Account = {
  id: string; name: string; accountType: string; custodianName: string;
  balance: number; isActive: boolean; bankName: string | null; description: string | null;
};
type Tx = {
  id: string; accountId: string; txType: string; amount: number; balanceAfter: number;
  category: string | null; description: string | null; createdAt: string;
};

export default function TreasuryDashboard() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [accData, txData] = await Promise.all([
      api.get<Account[]>("/treasury/accounts"),
      api.get<Tx[]>("/treasury/transactions"),
    ]);
    setAccounts(accData.filter((a: Account) => a.isActive));
    setTransactions(txData.slice(0, 20));
    setLoading(false);
  };

  const accountName = (id: string) => accounts.find(a => a.id === id)?.name ?? "—";

  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + Number(a.balance), 0), [accounts]);
  const totalInflows = useMemo(() => transactions.filter(t => t.txType === "inflow" || t.txType === "transfer_in").reduce((s, t) => s + Number(t.amount), 0), [transactions]);
  const totalOutflows = useMemo(() => transactions.filter(t => t.txType === "withdrawal" || t.txType === "expense" || t.txType === "transfer_out").reduce((s, t) => s + Number(t.amount), 0), [transactions]);

  const byTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    accounts.forEach(a => {
      const label = t[("treasury_" + a.accountType) as keyof typeof t] as string || a.accountType;
      map[label] = (map[label] || 0) + Number(a.balance);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [accounts, t]);

  const byCustodianData = useMemo(() => {
    const map: Record<string, number> = {};
    accounts.forEach(a => { map[a.custodianName] = (map[a.custodianName] || 0) + Number(a.balance); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [accounts]);

  const byCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(tx => tx.txType === "expense" || tx.txType === "withdrawal").forEach(tx => {
      const cat = tx.category ? (t[("treasury_cat_" + tx.category) as keyof typeof t] as string || tx.category) : t.treasury_cat_other;
      map[cat] = (map[cat] || 0) + Number(tx.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [transactions, t]);

  const txTypeLabel = (type: string) => t[("treasury_tx_" + type) as keyof typeof t] as string || type;
  const fmtMoney = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US", { minimumFractionDigits: 2 });

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">{t.loadingUsers}</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Landmark className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="page-header">{t.treasury}</h1>
            <p className="page-description">{t.treasuryDesc}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/treasury/accounts")}><Building className="h-4 w-4 me-1" />{t.treasuryAccounts}</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/treasury/transactions")}><ArrowRightLeft className="h-4 w-4 me-1" />{t.treasuryTransactions}</Button>
          <Button size="sm" onClick={() => navigate("/treasury/transactions?new=1")}><Plus className="h-4 w-4 me-1" />{t.treasuryNewTx}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center"><DollarSign className="h-6 w-6 text-primary" /></div>
          <div>
            <p className="text-xs text-muted-foreground">{t.treasuryTotalBalance}</p>
            <p className="text-2xl font-bold text-foreground">{fmtMoney(totalBalance)} <span className="text-xs font-normal text-muted-foreground">{t.egp}</span></p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center"><TrendingUp className="h-6 w-6 text-success" /></div>
          <div>
            <p className="text-xs text-muted-foreground">{t.treasuryInflows}</p>
            <p className="text-2xl font-bold text-success">{fmtMoney(totalInflows)} <span className="text-xs font-normal text-muted-foreground">{t.egp}</span></p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center"><TrendingDown className="h-6 w-6 text-destructive" /></div>
          <div>
            <p className="text-xs text-muted-foreground">{t.treasuryOutflows}</p>
            <p className="text-2xl font-bold text-destructive">{fmtMoney(totalOutflows)} <span className="text-xs font-normal text-muted-foreground">{t.egp}</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-3">{t.treasuryByType}</h3>
          {byTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={byTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {byTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center py-8 text-muted-foreground text-sm">{t.treasuryNoAccounts}</p>}
        </div>
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-3">{t.treasuryByCustodian}</h3>
          {byCustodianData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byCustodianData} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => fmtMoney(v)} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Bar dataKey="value" fill="hsl(200, 70%, 45%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-center py-8 text-muted-foreground text-sm">{t.treasuryNoAccounts}</p>}
        </div>
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-3">{t.treasuryByCategory}</h3>
          {byCategoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={byCategoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {byCategoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center py-8 text-muted-foreground text-sm">{t.treasuryNoTx}</p>}
        </div>
      </div>

      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">{t.treasuryAccounts}</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate("/treasury/accounts")}>{t.viewAll}</Button>
        </div>
        {accounts.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">{t.treasuryNoAccounts}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.treasuryAccountName}</th>
                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.treasuryType}</th>
                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.treasuryCustodian}</th>
                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.balance}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/treasury/accounts`)}>
                    <td className="py-2 px-3 font-medium">{a.name}</td>
                    <td className="py-2 px-3"><Badge variant="outline">{t[("treasury_" + a.accountType) as keyof typeof t] as string || a.accountType}</Badge></td>
                    <td className="py-2 px-3 text-muted-foreground">{a.custodianName}</td>
                    <td className="py-2 px-3 font-semibold">{fmtMoney(Number(a.balance))} {t.egp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">{t.treasuryRecentActivity}</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate("/treasury/transactions")}>{t.viewAll}</Button>
        </div>
        {transactions.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">{t.treasuryNoTx}</p>
        ) : (
          <div className="divide-y divide-border/50">
            {transactions.slice(0, 10).map(tx => {
              const isOut = ["withdrawal", "expense", "transfer_out"].includes(tx.txType);
              const isReturn = tx.category === "return_refund" || (tx.description || "").includes("مرتجع");
              const isFunding = tx.txType === "order_funding";
              const isContrib = tx.txType === "founder_contribution";

              const txIcon = isReturn ? RotateCcw
                : isFunding ? ShoppingBag
                : isContrib ? Receipt
                : isOut ? ArrowUpRight : ArrowDownLeft;
              const iconBg = isReturn ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                : isFunding ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : isContrib ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                : isOut ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400";

              const desc = tx.description || "";
              const orderMatch = desc.match(/\[orderId:(ORD-[^\]]+)\]/);
              const colMatch = desc.match(/COL-[A-Za-z0-9]+/);
              const retMatch = desc.match(/RET-[A-Za-z0-9]+/);
              const clientMatch = desc.match(/\[clientName:([^\]]+)\]/);
              let cleanDesc = desc
                .replace(/\[orderId:[^\]]*\]\s*/g, "")
                .replace(/\[collectionId:[^\]]*\]\s*/g, "")
                .replace(/\[clientName:[^\]]*\]\s*/g, "")
                .trim();
              if (!cleanDesc) cleanDesc = txTypeLabel(tx.txType);

              const TxIcon = txIcon;
              return (
                <div key={tx.id} className="flex items-start gap-3 py-3 px-1 hover:bg-muted/20 rounded-lg transition-colors">
                  <div className={`mt-0.5 flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${iconBg}`}>
                    <TxIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{cleanDesc}</span>
                      <Badge variant={isOut ? "destructive" : "default"} className="text-[10px] h-5">{txTypeLabel(tx.txType)}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {orderMatch && (
                        <button
                          className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors"
                          onClick={() => navigate(`/orders/${orderMatch[1]}`)}
                        >
                          {orderMatch[1]} <ExternalLink className="h-2.5 w-2.5" />
                        </button>
                      )}
                      {retMatch && (
                        <button
                          className="inline-flex items-center gap-1 font-mono text-xs bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 px-1.5 py-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                          onClick={() => navigate(`/returns/${retMatch[0]}`)}
                        >
                          {retMatch[0]} <ExternalLink className="h-2.5 w-2.5" />
                        </button>
                      )}
                      {colMatch && (
                        <button
                          className="inline-flex items-center gap-1 font-mono text-xs bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 px-1.5 py-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                          onClick={() => navigate(`/collections`)}
                        >
                          {colMatch[0]} <ExternalLink className="h-2.5 w-2.5" />
                        </button>
                      )}
                      {clientMatch && (
                        <span className="text-xs text-muted-foreground">· {clientMatch[1]}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(tx.createdAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</span>
                      <span>·</span>
                      <span>{accountName(tx.accountId)}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-end">
                    <span className={`text-sm font-bold ${isOut ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {isOut ? "-" : "+"}{fmtMoney(Number(tx.amount))}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t.currency}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
