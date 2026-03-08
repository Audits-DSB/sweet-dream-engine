import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Landmark, Wallet, Building, Users, TrendingUp, TrendingDown, ArrowRightLeft, Plus, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["hsl(200, 70%, 45%)", "hsl(150, 55%, 45%)", "hsl(38, 90%, 50%)", "hsl(280, 55%, 55%)", "hsl(0, 0%, 55%)"];

type Account = {
  id: string; name: string; account_type: string; custodian_name: string;
  balance: number; is_active: boolean; bank_name: string | null; description: string | null;
};
type Tx = {
  id: string; account_id: string; tx_type: string; amount: number; balance_after: number;
  category: string | null; description: string | null; created_at: string;
  treasury_accounts?: { name: string } | null;
};

export default function TreasuryDashboard() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const ch = supabase.channel("treasury-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "treasury_accounts" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "treasury_transactions" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [accRes, txRes] = await Promise.all([
      supabase.from("treasury_accounts").select("*").eq("is_active", true).order("created_at"),
      supabase.from("treasury_transactions").select("*, treasury_accounts(name)").order("created_at", { ascending: false }).limit(20),
    ]);
    if (accRes.data) setAccounts(accRes.data as Account[]);
    if (txRes.data) setTransactions(txRes.data as Tx[]);
    setLoading(false);
  };

  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + Number(a.balance), 0), [accounts]);
  const totalInflows = useMemo(() => transactions.filter(t => t.tx_type === "inflow" || t.tx_type === "transfer_in").reduce((s, t) => s + Number(t.amount), 0), [transactions]);
  const totalOutflows = useMemo(() => transactions.filter(t => t.tx_type === "withdrawal" || t.tx_type === "expense" || t.tx_type === "transfer_out").reduce((s, t) => s + Number(t.amount), 0), [transactions]);

  const byTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    accounts.forEach(a => { map[t[("treasury_" + a.account_type) as keyof typeof t] as string || a.account_type] = (map[t[("treasury_" + a.account_type) as keyof typeof t] as string || a.account_type] || 0) + Number(a.balance); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [accounts, t]);

  const byCustodianData = useMemo(() => {
    const map: Record<string, number> = {};
    accounts.forEach(a => { map[a.custodian_name] = (map[a.custodian_name] || 0) + Number(a.balance); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [accounts]);

  const byCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(tx => tx.tx_type === "expense" || tx.tx_type === "withdrawal").forEach(tx => {
      const cat = tx.category ? (t[("treasury_cat_" + tx.category) as keyof typeof t] as string || tx.category) : t.treasuryOther;
      map[cat] = (map[cat] || 0) + Number(tx.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [transactions, t]);

  const txTypeLabel = (type: string) => t[("treasury_tx_" + type) as keyof typeof t] as string || type;
  const fmtMoney = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US", { minimumFractionDigits: 2 });

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">{t.loadingUsers}</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
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

      {/* Summary Cards */}
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Balance by Account Type */}
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

        {/* Balance by Custodian */}
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

        {/* Withdrawals by Category */}
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

      {/* Accounts Table */}
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
                    <td className="py-2 px-3"><Badge variant="outline">{t[("treasury_" + a.account_type) as keyof typeof t] as string || a.account_type}</Badge></td>
                    <td className="py-2 px-3 text-muted-foreground">{a.custodian_name}</td>
                    <td className="py-2 px-3 font-semibold">{fmtMoney(Number(a.balance))} {t.egp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">{t.treasuryRecentActivity}</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate("/treasury/transactions")}>{t.viewAll}</Button>
        </div>
        {transactions.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">{t.treasuryNoTx}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.date}</th>
                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.treasuryType}</th>
                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.treasuryAccountName}</th>
                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.amount}</th>
                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.description}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 10).map(tx => {
                  const isOut = ["withdrawal", "expense", "transfer_out"].includes(tx.tx_type);
                  return (
                    <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 text-muted-foreground">{new Date(tx.created_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</td>
                      <td className="py-2 px-3"><Badge variant={isOut ? "destructive" : "default"}>{txTypeLabel(tx.tx_type)}</Badge></td>
                      <td className="py-2 px-3">{(tx.treasury_accounts as any)?.name || "—"}</td>
                      <td className={`py-2 px-3 font-semibold ${isOut ? "text-destructive" : "text-success"}`}>{isOut ? "-" : "+"}{fmtMoney(Number(tx.amount))}</td>
                      <td className="py-2 px-3 text-muted-foreground max-w-[200px] truncate">{tx.description || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
