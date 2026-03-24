import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Download, Wallet,
  Plus, ArrowUpRight, ArrowDownRight, Minus, ShoppingCart, Receipt, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/exportCsv";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, PieChart, Pie, Cell
} from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMemo, useState } from "react";
import { subMonths, format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const EXPENSE_CATEGORIES = ["marketing", "operations", "salaries", "supplies", "rent", "utilities", "logistics", "maintenance", "other"] as const;

type MonthDetail = {
  month: string;
  monthKey: string;
  revenue: number;
  cost: number;
  profit: number;
  orders: Array<{ id: string; orderNumber?: string; order_number?: string; clientName?: string; client_name?: string; totalCost?: number; total_cost?: number; status: string; createdAt?: string; created_at?: string }>;
  expenses: Array<{ id: string; amount: number; category: string | null; description: string | null; created_at: string }>;
};

export default function CompanyProfitPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [monthsFilter, setMonthsFilter] = useState("6");
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<MonthDetail | null>(null);
  const [expenseForm, setExpenseForm] = useState({ amount: "", category: "operations" as typeof EXPENSE_CATEGORIES[number], description: "", accountId: "" });
  const [submitting, setSubmitting] = useState(false);

  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ["treasury_accounts"],
    queryFn: () => api.get<any[]>("/treasury/accounts").then(d => d.filter((a: any) => a.isActive)),
  });

  const { data: transactions, isLoading: loadingTx } = useQuery({
    queryKey: ["treasury_transactions"],
    queryFn: () => api.get<any[]>("/treasury/transactions"),
  });

  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.get<any[]>("/orders"),
  });

  const totalBalance = useMemo(() => {
    if (!accounts) return 0;
    return accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  const { monthlyPnL, totals, expenseBreakdown, comparison, monthDetails } = useMemo(() => {
    const cutoff = subMonths(new Date(), parseInt(monthsFilter));
    const monthlyData: Record<string, {
      revenue: number;
      cost: number;
      expCats: Record<string, number>;
      orders: typeof orders;
      expenses: typeof transactions;
    }> = {};

    const ensureMonth = (key: string) => {
      if (!monthlyData[key]) monthlyData[key] = { revenue: 0, cost: 0, expCats: {}, orders: [], expenses: [] };
    };

    (orders || []).forEach((o) => {
      const d = parseISO(o.createdAt || o.created_at);
      if (d < cutoff) return;
      const key = format(d, "yyyy-MM");
      ensureMonth(key);
      monthlyData[key].revenue += o.totalCost || o.total_cost || 0;
      monthlyData[key].orders = [...(monthlyData[key].orders || []), o];
    });

    (transactions || []).forEach((tx) => {
      const d = parseISO(tx.createdAt || tx.created_at);
      if (d < cutoff) return;
      const key = format(d, "yyyy-MM");
      ensureMonth(key);
      const txType = tx.txType || tx.tx_type;
      if (txType === "expense" || txType === "withdrawal") {
        monthlyData[key].cost += Math.abs(tx.amount);
        const cat = tx.category || "other";
        monthlyData[key].expCats[cat] = (monthlyData[key].expCats[cat] || 0) + Math.abs(tx.amount);
        monthlyData[key].expenses = [...(monthlyData[key].expenses || []), tx];
      }
    });

    const sorted = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b));

    const pnl = sorted.map(([key, d]) => {
      const profit = d.revenue - d.cost;
      return {
        month: format(parseISO(key + "-01"), "MMM yyyy"),
        monthKey: key,
        revenue: d.revenue,
        cost: d.cost,
        profit,
        companyShare: profit > 0 ? Math.round(profit * 0.15) : 0,
        founderShare: profit > 0 ? Math.round(profit * 0.85) : 0,
      };
    });

    const details: Record<string, MonthDetail> = {};
    sorted.forEach(([key, d]) => {
      const profit = d.revenue - d.cost;
      details[key] = {
        month: format(parseISO(key + "-01"), "MMM yyyy"),
        monthKey: key,
        revenue: d.revenue,
        cost: d.cost,
        profit,
        orders: (d.orders || []) as MonthDetail["orders"],
        expenses: ((d.expenses || []) as MonthDetail["expenses"]),
      };
    });

    const comparisonData = pnl.map((m, i) => {
      const prev = i > 0 ? pnl[i - 1] : null;
      return {
        month: m.month,
        monthKey: m.monthKey,
        revenue: m.revenue,
        cost: m.cost,
        profit: m.profit,
        revenueChange: prev ? m.revenue - prev.revenue : 0,
        revenueChangePercent: prev && prev.revenue > 0 ? ((m.revenue - prev.revenue) / prev.revenue) * 100 : 0,
        costChange: prev ? m.cost - prev.cost : 0,
        costChangePercent: prev && prev.cost > 0 ? ((m.cost - prev.cost) / prev.cost) * 100 : 0,
        profitChange: prev ? m.profit - prev.profit : 0,
        profitChangePercent: prev && prev.profit !== 0 ? ((m.profit - prev.profit) / Math.abs(prev.profit)) * 100 : 0,
      };
    });

    const expAgg: Record<string, number> = {};
    sorted.forEach(([, d]) => {
      Object.entries(d.expCats).forEach(([cat, val]) => {
        expAgg[cat] = (expAgg[cat] || 0) + val;
      });
    });
    const totalExp = Object.values(expAgg).reduce((s, v) => s + v, 0) || 1;
    const colors = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
    const breakdown = Object.entries(expAgg).map(([name, value], i) => ({
      name,
      value: Math.round((value / totalExp) * 100),
      color: colors[i % colors.length],
    }));

    const tRev = pnl.reduce((s, m) => s + m.revenue, 0);
    const tCost = pnl.reduce((s, m) => s + m.cost, 0);
    const tProfit = pnl.reduce((s, m) => s + m.profit, 0);
    const tCompany = pnl.reduce((s, m) => s + m.companyShare, 0);

    return {
      monthlyPnL: pnl,
      totals: { revenue: tRev, cost: tCost, profit: tProfit, companyShare: tCompany, margin: tRev > 0 ? ((tProfit / tRev) * 100).toFixed(1) : "0" },
      expenseBreakdown: breakdown.length > 0 ? breakdown : [{ name: "other", value: 100, color: colors[0] }],
      comparison: comparisonData,
      monthDetails: details,
    };
  }, [orders, transactions, monthsFilter]);

  const isLoading = loadingAccounts || loadingTx || loadingOrders;

  const categoryLabel = (key: string | null) => {
    if (!key) return t.other;
    const map: Record<string, string> = {
      marketing: t.treasury_cat_marketing,
      operations: t.operations,
      salaries: t.treasury_cat_salaries,
      supplies: t.treasury_cat_supplies,
      rent: t.treasury_cat_rent,
      utilities: t.treasury_cat_utilities,
      logistics: t.deliveryCost,
      maintenance: t.treasury_cat_maintenance,
      other: t.other,
    };
    return map[key] || key;
  };

  const fmtNum = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");

  const handleChartClick = (data: { activePayload?: Array<{ payload: { monthKey: string } }> }) => {
    if (!data?.activePayload?.[0]) return;
    const key = data.activePayload[0].payload.monthKey;
    if (monthDetails[key]) setSelectedMonth(monthDetails[key]);
  };

  const handleBarClick = (data: { monthKey: string }) => {
    if (data?.monthKey && monthDetails[data.monthKey]) setSelectedMonth(monthDetails[data.monthKey]);
  };

  const handleAddExpense = async () => {
    if (!expenseForm.amount || !expenseForm.accountId) {
      toast({ title: t.error, description: t.fillRequiredFields, variant: "destructive" });
      return;
    }
    const amount = parseFloat(expenseForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: t.error, description: t.invalidAmount, variant: "destructive" });
      return;
    }
    const account = accounts?.find(a => a.id === expenseForm.accountId);
    if (!account) return;

    setSubmitting(true);
    try {
      const newBalance = account.balance - amount;
      await api.post("/treasury/transactions", {
        id: `TX-${Date.now()}`,
        accountId: expenseForm.accountId,
        amount: -amount,
        txType: "expense",
        category: expenseForm.category,
        description: expenseForm.description || null,
        balanceAfter: newBalance,
        performedBy: user?.id || null,
        date: new Date().toISOString().split("T")[0],
        newBalance,
      });
      toast({ title: t.success, description: t.expenseAdded });
      setExpenseDialogOpen(false);
      setExpenseForm({ amount: "", category: "operations", description: "", accountId: "" });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_accounts"] });
    } catch (err) {
      toast({ title: t.error, description: String(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const ChangeIndicator = ({ value, percent }: { value: number; percent: number }) => {
    if (value === 0) return <span className="text-muted-foreground"><Minus className="h-3 w-3 inline" /></span>;
    const isPositive = value > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
        {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {Math.abs(percent).toFixed(1)}%
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">{t.companyProfitTitle}</h1>
          <p className="page-description">{t.companyProfitDesc}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={monthsFilter} onValueChange={setMonthsFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 {t.monthsLabel}</SelectItem>
              <SelectItem value="6">6 {t.monthsLabel}</SelectItem>
              <SelectItem value="12">12 {t.monthsLabel}</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9">
                <Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.addExpense}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.addExpense}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>{t.treasurySelectAccount} *</Label>
                  <Select value={expenseForm.accountId} onValueChange={(v) => setExpenseForm(f => ({ ...f, accountId: v }))}>
                    <SelectTrigger><SelectValue placeholder={t.selectAccount} /></SelectTrigger>
                    <SelectContent>
                      {accounts?.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name} ({fmtNum(a.balance)} {t.currency})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.amount} *</Label>
                  <Input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>{t.category}</Label>
                  <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm(f => ({ ...f, category: v as typeof EXPENSE_CATEGORIES[number] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.description}</Label>
                  <Textarea value={expenseForm.description} onChange={(e) => setExpenseForm(f => ({ ...f, description: e.target.value }))} placeholder={t.optionalDesc} />
                </div>
                <Button onClick={handleAddExpense} disabled={submitting} className="w-full">
                  {submitting ? t.loading : t.addExpense}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" className="h-9" onClick={() => exportToCsv("company_profit", [t.month, t.revenue, t.cost, t.profit, t.companyCol, t.foundersCol], monthlyPnL.map(m => [m.month, m.revenue, m.cost, m.profit, m.companyShare, m.founderShare]))}>
            <Download className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.export}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title={t.totalBalance} value={`${fmtNum(totalBalance)} ${t.currency}`} change={`${accounts?.length || 0} ${t.accountsCount}`} changeType="neutral" icon={Wallet} />
        <StatCard title={t.totalRevenue} value={`${fmtNum(totals.revenue)} ${t.currency}`} change={`${monthsFilter} ${t.monthsLabel}`} changeType="neutral" icon={DollarSign} />
        <StatCard title={t.totalProfitsCompany} value={`${fmtNum(totals.profit)} ${t.currency}`} change={`${t.marginPercent} ${totals.margin}%`} changeType="positive" icon={TrendingUp} />
        <StatCard title={t.companyShare} value={`${fmtNum(totals.companyShare)} ${t.currency}`} change={t.retained} changeType="positive" icon={Percent} />
        <StatCard title={t.totalCostCompany} value={`${fmtNum(totals.cost)} ${t.currency}`} change={`${totals.revenue > 0 ? ((totals.cost / totals.revenue) * 100).toFixed(0) : 0}% ${t.ofRevenue}`} changeType="negative" icon={TrendingDown} />
      </div>

      {/* Monthly Comparison */}
      <div className="stat-card overflow-x-auto">
        <h3 className="font-semibold text-sm mb-4">{t.monthlyComparison}</h3>
        {comparison.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">{t.noDataPeriod}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.month}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.revenue}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.change}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.cost}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.change}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.profit}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.change}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((m, i) => (
                <tr key={m.month} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => monthDetails[m.monthKey] && setSelectedMonth(monthDetails[m.monthKey])}>
                  <td className="py-2.5 px-3 font-medium">{m.month}</td>
                  <td className="py-2.5 px-3 text-end">{fmtNum(m.revenue)} {t.currency}</td>
                  <td className="py-2.5 px-3 text-end">{i > 0 ? <ChangeIndicator value={m.revenueChange} percent={m.revenueChangePercent} /> : "-"}</td>
                  <td className="py-2.5 px-3 text-end text-muted-foreground">{fmtNum(m.cost)} {t.currency}</td>
                  <td className="py-2.5 px-3 text-end">{i > 0 ? <ChangeIndicator value={-m.costChange} percent={-m.costChangePercent} /> : "-"}</td>
                  <td className="py-2.5 px-3 text-end font-medium text-success">{fmtNum(m.profit)} {t.currency}</td>
                  <td className="py-2.5 px-3 text-end">{i > 0 ? <ChangeIndicator value={m.profitChange} percent={m.profitChangePercent} /> : "-"}</td>
                  <td className="py-2.5 px-3 text-end text-xs text-muted-foreground">{t.viewDetails} →</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">{t.revenueProfitTrend}</h3>
            <span className="text-xs text-muted-foreground">{t.clickForDetails}</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyPnL} onClick={handleChartClick} className="cursor-pointer">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <ReTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name={t.revenue} dot={{ r: 4, cursor: "pointer" }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="profit" stroke="hsl(var(--chart-2))" strokeWidth={2} name={t.profit} dot={{ r: 4, cursor: "pointer" }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="cost" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="5 5" name={t.cost} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">{t.expenseBreakdown}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                {expenseBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <ReTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {expenseBreakdown.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">{categoryLabel(item.name)} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Profit Distribution Bar */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">{t.profitDistribution}</h3>
          <span className="text-xs text-muted-foreground">{t.clickForDetails}</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyPnL} onClick={handleChartClick} className="cursor-pointer">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <ReTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            <Bar dataKey="companyShare" stackId="a" fill="hsl(var(--primary))" name={t.company15} />
            <Bar dataKey="founderShare" stackId="a" fill="hsl(var(--chart-2))" name={t.founders85} radius={[4, 4, 0, 0]}
              onClick={handleBarClick}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly PnL Table */}
      <div className="stat-card overflow-x-auto">
        <h3 className="font-semibold text-sm mb-4">{t.monthlyPnL}</h3>
        {monthlyPnL.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">{t.noDataPeriod}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.month}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.revenue}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.cost}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.profit}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.margin}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.companyCol}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.foundersCol}</th>
              </tr>
            </thead>
            <tbody>
              {monthlyPnL.map((m) => (
                <tr key={m.month} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => monthDetails[m.monthKey] && setSelectedMonth(monthDetails[m.monthKey])}>
                  <td className="py-2.5 px-3 font-medium">{m.month}</td>
                  <td className="py-2.5 px-3 text-end">{fmtNum(m.revenue)} {t.currency}</td>
                  <td className="py-2.5 px-3 text-end text-muted-foreground">{fmtNum(m.cost)} {t.currency}</td>
                  <td className="py-2.5 px-3 text-end font-medium text-success">{fmtNum(m.profit)} {t.currency}</td>
                  <td className="py-2.5 px-3 text-end">{m.revenue > 0 ? ((m.profit / m.revenue) * 100).toFixed(1) : "0"}%</td>
                  <td className="py-2.5 px-3 text-end text-primary font-medium">{fmtNum(m.companyShare)} {t.currency}</td>
                  <td className="py-2.5 px-3 text-end">{fmtNum(m.founderShare)} {t.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Month Detail Sheet */}
      <Sheet open={!!selectedMonth} onOpenChange={(o) => !o && setSelectedMonth(null)}>
        <SheetContent side={lang === "ar" ? "left" : "right"} className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>{selectedMonth?.month} — {t.details}</span>
            </SheetTitle>
          </SheetHeader>
          {selectedMonth && (
            <div className="mt-4 space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="stat-card p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t.revenue}</p>
                  <p className="font-semibold text-sm mt-1">{fmtNum(selectedMonth.revenue)}</p>
                </div>
                <div className="stat-card p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t.cost}</p>
                  <p className="font-semibold text-sm mt-1 text-destructive">{fmtNum(selectedMonth.cost)}</p>
                </div>
                <div className="stat-card p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t.profit}</p>
                  <p className="font-semibold text-sm mt-1 text-success">{fmtNum(selectedMonth.profit)}</p>
                </div>
              </div>

              {/* Orders */}
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  {t.orders} ({selectedMonth.orders.length})
                </h4>
                {selectedMonth.orders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t.noDataPeriod}</p>
                ) : (
                  <div className="space-y-2">
                    {selectedMonth.orders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/orders/${o.id}`)}>
                        <div>
                          <p className="text-xs font-medium">{o.orderNumber || o.order_number || o.id}</p>
                          <p className="text-xs text-muted-foreground">{o.clientName || o.client_name || o.client}</p>
                        </div>
                        <div className="text-end">
                          <p className="text-xs font-semibold">{fmtNum(o.totalCost || o.total_cost || 0)} {t.currency}</p>
                          <Badge variant="outline" className="text-xs mt-0.5">{o.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Expenses */}
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-destructive" />
                  {t.expenses || t.totalCostCompany} ({selectedMonth.expenses.length})
                </h4>
                {selectedMonth.expenses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t.noDataPeriod}</p>
                ) : (
                  <div className="space-y-2">
                    {selectedMonth.expenses.map((e) => (
                      <div key={e.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20">
                        <div>
                          <p className="text-xs font-medium">{categoryLabel(e.category)}</p>
                          {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                        </div>
                        <p className="text-xs font-semibold text-destructive">-{fmtNum(Math.abs(e.amount))} {t.currency}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
