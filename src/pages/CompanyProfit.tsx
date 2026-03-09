import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { TrendingUp, TrendingDown, DollarSign, Percent, Download, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/exportCsv";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, PieChart, Pie, Cell } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { subMonths, format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function CompanyProfitPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [monthsFilter, setMonthsFilter] = useState("6");

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

  const { monthlyPnL, totals, expenseBreakdown } = useMemo(() => {
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
        revenue: d.revenue,
        cost: d.cost,
        profit,
        companyShare: profit > 0 ? Math.round(profit * 0.15) : 0,
        founderShare: profit > 0 ? Math.round(profit * 0.85) : 0,
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
    };
  }, [orders, transactions, monthsFilter]);

  const isLoading = loadingAccounts || loadingTx || loadingOrders;

  const categoryLabel = (key: string) => {
    const map: Record<string, string> = {
      marketing: t.marketing || "Marketing",
      operations: t.operations,
      salaries: t.salaries || "Salaries",
      supplies: t.supplies || "Supplies",
      rent: t.rent || "Rent",
      utilities: t.utilities || "Utilities",
      logistics: t.deliveryCost,
      maintenance: t.maintenance || "Maintenance",
      other: t.other,
    };
    return map[key] || key;
  };

  const fmtNum = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");

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
              <SelectItem value="3">3 {t.months || "months"}</SelectItem>
              <SelectItem value="6">6 {t.months || "months"}</SelectItem>
              <SelectItem value="12">12 {t.months || "months"}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={() => exportToCsv("company_profit", [t.month, t.revenue, t.cost, t.profit, t.companyCol, t.foundersCol], monthlyPnL.map(m => [m.month, m.revenue, m.cost, m.profit, m.companyShare, m.founderShare]))}>
            <Download className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.export}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title={t.totalBalance || "Total Balance"} value={`${fmtNum(totalBalance)} ${t.currency}`} change={`${accounts?.length || 0} ${t.accounts || "accounts"}`} changeType="neutral" icon={Wallet} />
        <StatCard title={t.totalRevenue} value={`${fmtNum(totals.revenue)} ${t.currency}`} change={`${monthsFilter} ${t.months || "months"}`} changeType="neutral" icon={DollarSign} />
        <StatCard title={t.totalProfitsCompany} value={`${fmtNum(totals.profit)} ${t.currency}`} change={`${t.marginPercent} ${totals.margin}%`} changeType="positive" icon={TrendingUp} />
        <StatCard title={t.companyShare} value={`${fmtNum(totals.companyShare)} ${t.currency}`} change={t.retained} changeType="positive" icon={Percent} />
        <StatCard title={t.totalCostCompany} value={`${fmtNum(totals.cost)} ${t.currency}`} change={`${totals.revenue > 0 ? ((totals.cost / totals.revenue) * 100).toFixed(0) : 0}% ${t.ofRevenue}`} changeType="negative" icon={TrendingDown} />
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
          <p className="text-muted-foreground text-sm text-center py-8">{t.noData || "No data for this period"}</p>
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
