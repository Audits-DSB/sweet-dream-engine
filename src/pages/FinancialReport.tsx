import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBusinessRules, getCompanyShareRatio, getFounderShareRatio } from "@/lib/useBusinessRules";
import { FileBarChart, DollarSign, TrendingUp, TrendingDown, Wallet, Users, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { exportToCsv } from "@/lib/exportCsv";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { subMonths, format, parseISO } from "date-fns";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

type Order = { id: string; totalSelling?: any; total_selling?: any; totalCost?: any; total_cost?: any; createdAt?: string; created_at?: string };
type TreasuryTx = { id: string; txType?: string; tx_type?: string; amount: number; category?: string; description?: string; createdAt?: string; created_at?: string; performedBy?: string; performed_by?: string; referenceId?: string; reference_id?: string };
type TreasuryAccount = { id: string; name: string; accountType?: string; custodianName?: string; balance: number; isActive?: boolean };
type Founder = { id: string; name: string; alias: string; share?: number };
type Collection = { id: string; total?: any; totalAmount?: any; total_amount?: any; paid?: any; paidAmount?: any; paid_amount?: any; dueDate?: string; due_date?: string; status?: string };

export default function FinancialReportPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [period, setPeriod] = useState("6");
  const { rules } = useBusinessRules();

  const { data: orders = [], isLoading: loadingOrders } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: () => api.get<Order[]>("/orders"),
  });

  const { data: txs = [], isLoading: loadingTxs } = useQuery<TreasuryTx[]>({
    queryKey: ["treasury_transactions"],
    queryFn: () => api.get<TreasuryTx[]>("/treasury/transactions"),
  });

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery<TreasuryAccount[]>({
    queryKey: ["treasury_accounts"],
    queryFn: () => api.get<TreasuryAccount[]>("/treasury/accounts"),
  });

  const { data: founders = [], isLoading: loadingFounders } = useQuery<Founder[]>({
    queryKey: ["founders"],
    queryFn: () => api.get<Founder[]>("/founders"),
  });

  const { data: collections = [], isLoading: loadingCollections } = useQuery<Collection[]>({
    queryKey: ["collections"],
    queryFn: () => api.get<Collection[]>("/collections"),
  });

  const { data: founderTxs = [] } = useQuery<any[]>({
    queryKey: ["founder_transactions"],
    queryFn: () => api.get<any[]>("/founder-transactions"),
  });

  const isLoading = loadingOrders || loadingTxs || loadingAccounts || loadingFounders || loadingCollections;

  const parseAmount = (val: unknown): number => {
    if (!val) return 0;
    if (typeof val === "number") return val;
    const cleaned = String(val).replace(/[^\d.-]/g, "");
    return parseFloat(cleaned) || 0;
  };

  const fmtMoney = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");

  // ── Treasury summary ────────────────────────────────────────────────────────
  const activeAccounts = useMemo(() => (accounts || []).filter((a) => a.isActive !== false), [accounts]);
  const treasuryBalance = useMemo(() => activeAccounts.reduce((s, a) => s + parseAmount(a.balance), 0), [activeAccounts]);
  const treasuryInflows = useMemo(
    () => (txs || []).filter((tx) => (tx.txType || tx.tx_type) === "inflow").reduce((s, tx) => s + parseAmount(tx.amount), 0),
    [txs]
  );
  const treasuryExpenses = useMemo(
    () => (txs || []).filter((tx) => {
      const tt = tx.txType || tx.tx_type;
      return tt === "expense" || tt === "withdrawal";
    }).reduce((s, tx) => s + Math.abs(parseAmount(tx.amount)), 0),
    [txs]
  );

  // ── Monthly P&L from real data ───────────────────────────────────────────────
  const { monthlyPnL, totals } = useMemo(() => {
    const monthCount = parseInt(period) || 6;
    const cutoff = subMonths(new Date(), monthCount);
    const monthlyData: Record<string, { revenue: number; cost: number }> = {};

    const ensure = (key: string) => { if (!monthlyData[key]) monthlyData[key] = { revenue: 0, cost: 0 }; };

    (orders || []).forEach((o) => {
      const dateStr = o.createdAt || o.created_at;
      if (!dateStr) return;
      try {
        const d = parseISO(dateStr);
        if (d < cutoff) return;
        const key = format(d, "yyyy-MM");
        ensure(key);
        monthlyData[key].revenue += parseAmount(o.totalSelling ?? o.total_selling);
      } catch { /* skip */ }
    });

    (txs || []).forEach((tx) => {
      const tt = tx.txType || tx.tx_type;
      if (tt !== "expense" && tt !== "withdrawal") return;
      const dateStr = tx.createdAt || tx.created_at;
      if (!dateStr) return;
      try {
        const d = parseISO(dateStr);
        if (d < cutoff) return;
        const key = format(d, "yyyy-MM");
        ensure(key);
        monthlyData[key].cost += Math.abs(parseAmount(tx.amount));
      } catch { /* skip */ }
    });

    const sorted = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b));
    const pnl = sorted.map(([key, d]) => {
      const profit = d.revenue - d.cost;
      return {
        month: format(parseISO(key + "-01"), "MMM yy"),
        monthKey: key,
        revenue: d.revenue,
        cost: d.cost,
        profit,
        companyShare: profit > 0 ? Math.round(profit * getCompanyShareRatio(rules)) : 0,
        founderShare: profit > 0 ? Math.round(profit * getFounderShareRatio(rules)) : 0,
      };
    });

    const tRev = pnl.reduce((s, m) => s + m.revenue, 0);
    const tCost = pnl.reduce((s, m) => s + m.cost, 0);
    const tProfit = pnl.reduce((s, m) => s + m.profit, 0);
    const tCompany = pnl.reduce((s, m) => s + m.companyShare, 0);
    const tFounder = pnl.reduce((s, m) => s + m.founderShare, 0);

    return {
      monthlyPnL: pnl,
      totals: { revenue: tRev, cost: tCost, profit: tProfit, company: tCompany, founder: tFounder },
    };
  }, [orders, txs, period, rules.companyProfitPercentage]);

  // ── Collections summary from real data ─────────────────────────────────────
  const collectionsSummary = useMemo(() => {
    const today = new Date();
    let totalInvoiced = 0, totalCollected = 0, totalOutstanding = 0, overdueAmount = 0;
    (collections || []).forEach((c) => {
      const total = parseAmount(c.total ?? c.totalAmount ?? c.total_amount);
      const paid = parseAmount(c.paid ?? c.paidAmount ?? c.paid_amount);
      const remaining = total - paid;
      totalInvoiced += total;
      totalCollected += paid;
      totalOutstanding += remaining;
      if (remaining > 0) {
        const due = c.dueDate || c.due_date;
        if (due && new Date(due) < today) overdueAmount += remaining;
      }
    });
    return { totalInvoiced, totalCollected, totalOutstanding, overdueAmount };
  }, [collections]);

  // ── Founder distributions from real data ────────────────────────────────────
  const founderDistributions = useMemo(() => {
    const totalWithdrawnPerFounder: Record<string, number> = {};
    const founderNameMap: Record<string, string> = {};
    (founderTxs || []).forEach((tx: any) => {
      if (tx.type === "withdrawal") {
        const fid = tx.founderId || tx.founderName;
        const fname = tx.founderName || fid;
        totalWithdrawnPerFounder[fid] = (totalWithdrawnPerFounder[fid] || 0) + tx.amount;
        founderNameMap[fid] = fname;
      }
    });
    return (founders || []).map((f, i) => ({
      name: f.name,
      alias: f.alias,
      share: f.share || Math.round(100 / Math.max(founders.length, 1)),
      totalDistributed: totalWithdrawnPerFounder[f.id] || 0,
      color: COLORS[i % COLORS.length],
    }));
  }, [founders, founderTxs]);

  // ── Expense categories ───────────────────────────────────────────────────────
  const expenseByCat = useMemo(() => {
    const map: Record<string, number> = {};
    (txs || []).forEach((tx) => {
      const tt = tx.txType || tx.tx_type;
      if (tt !== "expense" && tt !== "withdrawal") return;
      const cat = tx.category ? (t[("treasury_cat_" + tx.category) as keyof typeof t] as string || tx.category) : (t.treasury_cat_other as string || "أخرى");
      map[cat] = (map[cat] || 0) + Math.abs(parseAmount(tx.amount));
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [txs, t]);

  const collectionRate = collectionsSummary.totalInvoiced > 0
    ? (collectionsSummary.totalCollected / collectionsSummary.totalInvoiced) * 100
    : 0;

  const handleExport = () => {
    const rows = [
      [t.totalRevenue, fmtMoney(totals.revenue)],
      [t.finReportProfit, fmtMoney(totals.profit)],
      [t.companyShare, fmtMoney(totals.company)],
      [t.finReportFounderDist, fmtMoney(totals.founder)],
      [t.treasuryTotalBalance, fmtMoney(treasuryBalance)],
      [t.treasuryInflows, fmtMoney(treasuryInflows)],
      [t.treasuryOutflows, fmtMoney(treasuryExpenses)],
      [t.totalCollected, fmtMoney(collectionsSummary.totalCollected)],
      [t.outstandingAmount, fmtMoney(collectionsSummary.totalOutstanding)],
    ];
    exportToCsv("financial_report", [t.finReportMetric, t.amount], rows);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileBarChart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="page-header">{t.finReportTitle}</h1>
            <p className="page-description">{t.finReportDesc}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px] h-9" data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">{t.finReport3m}</SelectItem>
              <SelectItem value="6">{t.finReport6m}</SelectItem>
              <SelectItem value="12">{t.finReport1y}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export">
            <Download className="h-4 w-4 me-1" />{t.export}
          </Button>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="stat-card text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/company-profit")} data-testid="card-total-revenue">
          <DollarSign className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-[10px] text-muted-foreground">{t.totalRevenue}</p>
          <p className="text-lg font-bold">{fmtMoney(totals.revenue)}</p>
          <p className="text-[10px] text-muted-foreground">{t.currency}</p>
        </div>
        <div className="stat-card text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/company-profit")} data-testid="card-total-profit">
          <TrendingUp className="h-5 w-5 mx-auto text-success mb-1" />
          <p className="text-[10px] text-muted-foreground">{t.finReportProfit}</p>
          <p className="text-lg font-bold text-success">{fmtMoney(totals.profit)}</p>
          <p className="text-[10px] text-muted-foreground">{t.currency}</p>
        </div>
        <div className="stat-card text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/treasury")} data-testid="card-treasury-balance">
          <Wallet className="h-5 w-5 mx-auto text-info mb-1" />
          <p className="text-[10px] text-muted-foreground">{t.treasuryTotalBalance}</p>
          <p className="text-lg font-bold">{fmtMoney(treasuryBalance)}</p>
          <p className="text-[10px] text-muted-foreground">{t.egp}</p>
        </div>
        <div className="stat-card text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/collections")} data-testid="card-collected">
          <TrendingUp className="h-5 w-5 mx-auto text-success mb-1" />
          <p className="text-[10px] text-muted-foreground">{t.totalCollected}</p>
          <p className="text-lg font-bold text-success">{fmtMoney(collectionsSummary.totalCollected)}</p>
          <p className="text-[10px] text-muted-foreground">{t.currency}</p>
        </div>
        <div className="stat-card text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/collections")} data-testid="card-outstanding">
          <TrendingDown className="h-5 w-5 mx-auto text-destructive mb-1" />
          <p className="text-[10px] text-muted-foreground">{t.outstandingAmount}</p>
          <p className="text-lg font-bold text-destructive">{fmtMoney(collectionsSummary.totalOutstanding)}</p>
          <p className="text-[10px] text-muted-foreground">{t.currency}</p>
        </div>
        <div className="stat-card text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/founder-funding")} data-testid="card-founder-dist">
          <Users className="h-5 w-5 mx-auto text-warning mb-1" />
          <p className="text-[10px] text-muted-foreground">{t.finReportFounderDist}</p>
          <p className="text-lg font-bold">{fmtMoney(totals.founder)}</p>
          <p className="text-[10px] text-muted-foreground">{t.currency}</p>
        </div>
      </div>

      {/* Revenue vs Profit Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-3">{t.finReportRevVsProfit}</h3>
          {monthlyPnL.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">{t.noDataPeriod}</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={monthlyPnL}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => `${fmtMoney(v)} ${t.currency}`}
                />
                <Legend />
                <Area type="monotone" dataKey="revenue" name={t.revenue} fill="hsl(var(--primary))" fillOpacity={0.15} stroke="hsl(var(--primary))" strokeWidth={2} />
                <Area type="monotone" dataKey="profit" name={t.profit} fill="hsl(var(--chart-2))" fillOpacity={0.15} stroke="hsl(var(--chart-2))" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Company vs Founder Split */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-3">{t.finReportProfitSplit}</h3>
          {monthlyPnL.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">{t.noDataPeriod}</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyPnL}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => `${fmtMoney(v)} ${t.currency}`}
                />
                <Legend />
                <Bar dataKey="companyShare" name={t.companyShare} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="founderShare" name={t.finReportFounderDist} fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Treasury + Founder Distribution + Expenses Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Treasury Accounts */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t.treasuryAccounts}</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate("/treasury")}>{t.viewAll}</Button>
          </div>
          {activeAccounts.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">{t.treasuryNoAccounts}</p>
          ) : (
            <div className="space-y-2">
              {activeAccounts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate("/treasury/accounts")}
                  data-testid={`card-account-${a.id}`}
                >
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground">{a.custodianName}</p>
                  </div>
                  <p className="text-sm font-semibold">{fmtMoney(parseAmount(a.balance))} {t.egp}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Founder Distributions */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t.finReportFounderDist}</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate("/founder-funding")}>{t.viewAll}</Button>
          </div>
          {founderDistributions.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">{t.noFounders || "لا يوجد مؤسسون"}</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={founderDistributions.map((f) => ({ name: f.name, value: f.share }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                  >
                    {founderDistributions.map((f, i) => (
                      <Cell key={i} fill={f.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {founderDistributions.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ background: f.color }} />
                      <span>{f.name}</span>
                    </div>
                    <span className="font-medium text-muted-foreground">
                      {fmtMoney(f.totalDistributed)} {t.currency}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Expense Categories */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-3">{t.treasuryByCategory}</h3>
          {expenseByCat.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">{t.treasuryNoTx}</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={expenseByCat}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {expenseByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => `${fmtMoney(v)} ${t.currency}`}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Collections Summary */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">{t.finReportCollections}</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate("/collections")}>{t.viewAll}</Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 text-center" data-testid="stat-total-invoiced">
            <p className="text-[10px] text-muted-foreground">{t.finReportTotalInvoiced}</p>
            <p className="text-lg font-bold">{fmtMoney(collectionsSummary.totalInvoiced)}</p>
          </div>
          <div className="p-3 rounded-lg bg-success/10 text-center" data-testid="stat-collected">
            <p className="text-[10px] text-muted-foreground">{t.totalCollected}</p>
            <p className="text-lg font-bold text-success">{fmtMoney(collectionsSummary.totalCollected)}</p>
          </div>
          <div className="p-3 rounded-lg bg-warning/10 text-center" data-testid="stat-outstanding">
            <p className="text-[10px] text-muted-foreground">{t.outstandingAmount}</p>
            <p className="text-lg font-bold text-warning">{fmtMoney(collectionsSummary.totalOutstanding)}</p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/10 text-center" data-testid="stat-overdue">
            <p className="text-[10px] text-muted-foreground">{t.overdueAmount}</p>
            <p className="text-lg font-bold text-destructive">{fmtMoney(collectionsSummary.overdueAmount)}</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">{t.finReportCollectionRate}</span>
            <span className="font-medium">{collectionRate.toFixed(0)}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${Math.min(collectionRate, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
