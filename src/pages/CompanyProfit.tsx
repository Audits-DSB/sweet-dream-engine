import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { TrendingUp, TrendingDown, DollarSign, Percent, Download, Wallet, Plus, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/exportCsv";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, PieChart, Pie, Cell } from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { subMonths, format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const EXPENSE_CATEGORIES = ["marketing", "operations", "salaries", "supplies", "rent", "utilities", "logistics", "maintenance", "other"] as const;

export default function CompanyProfitPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [monthsFilter, setMonthsFilter] = useState("6");
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: "", category: "operations" as typeof EXPENSE_CATEGORIES[number], description: "", accountId: "" });
  const [submitting, setSubmitting] = useState(false);

  // Fetch treasury accounts for total balance
  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ["treasury_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("treasury_accounts").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch transactions
  const { data: transactions, isLoading: loadingTx } = useQuery({
    queryKey: ["treasury_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("treasury_transactions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch orders for revenue
  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalBalance = useMemo(() => {
    if (!accounts) return 0;
    return accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  const { monthlyPnL, totals, expenseBreakdown, comparison } = useMemo(() => {
    const cutoff = subMonths(new Date(), parseInt(monthsFilter));
    const monthlyData: Record<string, { revenue: number; cost: number; expenses: Record<string, number> }> = {};

    // Process orders as revenue
    (orders || []).forEach((o) => {
      const d = parseISO(o.created_at);
      if (d < cutoff) return;
      const key = format(d, "yyyy-MM");
      if (!monthlyData[key]) monthlyData[key] = { revenue: 0, cost: 0, expenses: {} };
      monthlyData[key].revenue += o.total_cost || 0;
    });

    // Process transactions as costs/expenses
    (transactions || []).forEach((tx) => {
      const d = parseISO(tx.created_at);
      if (d < cutoff) return;
      const key = format(d, "yyyy-MM");
      if (!monthlyData[key]) monthlyData[key] = { revenue: 0, cost: 0, expenses: {} };
      if (tx.tx_type === "expense" || tx.tx_type === "withdrawal") {
        monthlyData[key].cost += Math.abs(tx.amount);
        const cat = tx.category || "other";
        monthlyData[key].expenses[cat] = (monthlyData[key].expenses[cat] || 0) + Math.abs(tx.amount);
      }
    });

    // Build sorted array
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

    // Monthly comparison
    const comparisonData = pnl.map((m, i) => {
      const prev = i > 0 ? pnl[i - 1] : null;
      return {
        month: m.month,
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

    // Aggregate expenses for pie
    const expAgg: Record<string, number> = {};
    sorted.forEach(([, d]) => {
      Object.entries(d.expenses).forEach(([cat, val]) => {
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
    };
  }, [orders, transactions, monthsFilter]);

  const isLoading = loadingAccounts || loadingTx || loadingOrders;

  const categoryLabel = (key: string) => {
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
      // Insert transaction
      const { error: txError } = await supabase.from("treasury_transactions").insert({
        account_id: expenseForm.accountId,
        amount: -amount,
        tx_type: "expense",
        category: expenseForm.category,
        description: expenseForm.description || null,
        balance_after: account.balance - amount,
        performed_by: user?.id,
      });
      if (txError) throw txError;

      // Update account balance
      const { error: accError } = await supabase.from("treasury_accounts").update({ balance: account.balance - amount }).eq("id", expenseForm.accountId);
      if (accError) throw accError;

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
      <span className={`inline-flex items-center gap-0.5 text-xs ${isPositive ? "text-success" : "text-destructive"}`}>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title={t.totalBalance} value={`${fmtNum(totalBalance)} ${t.currency}`} change={`${accounts?.length || 0} ${t.accountsCount}`} changeType="neutral" icon={Wallet} />
        <StatCard title={t.totalRevenue} value={`${fmtNum(totals.revenue)} ${t.currency}`} change={`${monthsFilter} ${t.monthsLabel}`} changeType="neutral" icon={DollarSign} />
        <StatCard title={t.totalProfitsCompany} value={`${fmtNum(totals.profit)} ${t.currency}`} change={`${t.marginPercent} ${totals.margin}%`} changeType="positive" icon={TrendingUp} />
        <StatCard title={t.companyShare} value={`${fmtNum(totals.companyShare)} ${t.currency}`} change={t.retained} changeType="positive" icon={Percent} />
        <StatCard title={t.totalCostCompany} value={`${fmtNum(totals.cost)} ${t.currency}`} change={`${totals.revenue > 0 ? ((totals.cost / totals.revenue) * 100).toFixed(0) : 0}% ${t.ofRevenue}`} changeType="negative" icon={TrendingDown} />
      </div>

      {/* Monthly Comparison Report */}
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
              </tr>
            </thead>
            <tbody>
              {comparison.map((m, i) => (
                <tr key={m.month} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2.5 px-3 font-medium">{m.month}</td>
                  <td className="py-2.5 px-3 text-end">{fmtNum(m.revenue)} {t.currency}</td>
                  <td className="py-2.5 px-3 text-end">{i > 0 ? <ChangeIndicator value={m.revenueChange} percent={m.revenueChangePercent} /> : "-"}</td>
                  <td className="py-2.5 px-3 text-end text-muted-foreground">{fmtNum(m.cost)} {t.currency}</td>
                  <td className="py-2.5 px-3 text-end">{i > 0 ? <ChangeIndicator value={-m.costChange} percent={-m.costChangePercent} /> : "-"}</td>
                  <td className="py-2.5 px-3 text-end font-medium text-success">{fmtNum(m.profit)} {t.currency}</td>
                  <td className="py-2.5 px-3 text-end">{i > 0 ? <ChangeIndicator value={m.profitChange} percent={m.profitChangePercent} /> : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card lg:col-span-2">
          <h3 className="font-semibold text-sm mb-4">{t.revenueProfitTrend}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyPnL}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <ReTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name={t.revenue} />
              <Line type="monotone" dataKey="profit" stroke="hsl(var(--chart-2))" strokeWidth={2} name={t.profit} />
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

      <div className="stat-card cursor-pointer" onClick={() => navigate("/founders")}>
        <h3 className="font-semibold text-sm mb-4">{t.profitDistribution}</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyPnL}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <ReTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            <Bar dataKey="companyShare" stackId="a" fill="hsl(var(--primary))" name={t.company15} />
            <Bar dataKey="founderShare" stackId="a" fill="hsl(var(--chart-2))" name={t.founders85} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

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
                <tr key={m.month} className="border-b border-border/50 hover:bg-muted/30">
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
    </div>
  );
}
