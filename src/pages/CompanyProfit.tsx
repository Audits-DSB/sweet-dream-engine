import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { TrendingUp, TrendingDown, DollarSign, Percent, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/exportCsv";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";

const monthlyPnL = [
  { month: "Oct", revenue: 380000, cost: 240000, profit: 140000, companyShare: 21000, founderShare: 119000 },
  { month: "Nov", revenue: 420000, cost: 270000, profit: 150000, companyShare: 22500, founderShare: 127500 },
  { month: "Dec", revenue: 390000, cost: 255000, profit: 135000, companyShare: 20250, founderShare: 114750 },
  { month: "Jan", revenue: 480000, cost: 300000, profit: 180000, companyShare: 27000, founderShare: 153000 },
  { month: "Feb", revenue: 520000, cost: 320000, profit: 200000, companyShare: 30000, founderShare: 170000 },
  { month: "Mar", revenue: 460000, cost: 290000, profit: 170000, companyShare: 25500, founderShare: 144500 },
];

const expenseBreakdown = [
  { name: "materialCost", value: 65, color: "hsl(var(--primary))" },
  { name: "deliveryCost", value: 12, color: "hsl(var(--chart-2))" },
  { name: "operations", value: 15, color: "hsl(var(--chart-3))" },
  { name: "other", value: 8, color: "hsl(var(--chart-4))" },
];

const totalRevenue = monthlyPnL.reduce((s, m) => s + m.revenue, 0);
const totalCost = monthlyPnL.reduce((s, m) => s + m.cost, 0);
const totalProfit = monthlyPnL.reduce((s, m) => s + m.profit, 0);
const totalCompanyShare = monthlyPnL.reduce((s, m) => s + m.companyShare, 0);
const avgMargin = ((totalProfit / totalRevenue) * 100).toFixed(1);

export default function CompanyProfitPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const expenseName = (key: string) => {
    const map: Record<string, string> = { materialCost: t.materialCost, deliveryCost: t.deliveryCost, operations: t.operations, other: t.other };
    return map[key] || key;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">{t.companyProfitTitle}</h1>
          <p className="page-description">{t.companyProfitDesc}</p>
        </div>
        <Button variant="outline" size="sm" className="h-9" onClick={() => exportToCsv("company_profit", [t.month, t.revenue, t.cost, t.profit, t.companyCol, t.foundersCol], monthlyPnL.map(m => [m.month, m.revenue, m.cost, m.profit, m.companyShare, m.founderShare]))}>
          <Download className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.export}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t.totalRevenue} value={`${(totalRevenue / 1000).toFixed(0)} ${t.thousand} ${t.currency}`} change={t.months6} changeType="neutral" icon={DollarSign} />
        <StatCard title={t.totalProfitsCompany} value={`${(totalProfit / 1000).toFixed(0)} ${t.thousand} ${t.currency}`} change={`${t.marginPercent} ${avgMargin}%`} changeType="positive" icon={TrendingUp} />
        <StatCard title={t.companyShare} value={`${(totalCompanyShare / 1000).toFixed(1)} ${t.thousand} ${t.currency}`} change={t.retained} changeType="positive" icon={Percent} />
        <StatCard title={t.totalCostCompany} value={`${(totalCost / 1000).toFixed(0)} ${t.thousand} ${t.currency}`} change={`${((totalCost / totalRevenue) * 100).toFixed(0)}% ${t.ofRevenue}`} changeType="negative" icon={TrendingDown} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card lg:col-span-2">
          <h3 className="font-semibold text-sm mb-4">{t.revenueProfitTrend}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyPnL}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
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
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {expenseBreakdown.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">{expenseName(item.name)} ({item.value}%)</span>
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
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            <Bar dataKey="companyShare" stackId="a" fill="hsl(var(--primary))" name={t.company15} />
            <Bar dataKey="founderShare" stackId="a" fill="hsl(var(--chart-2))" name={t.founders85} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="stat-card overflow-x-auto">
        <h3 className="font-semibold text-sm mb-4">{t.monthlyPnL}</h3>
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
                <td className="py-2.5 px-3 text-end">{m.revenue.toLocaleString()} {t.currency}</td>
                <td className="py-2.5 px-3 text-end text-muted-foreground">{m.cost.toLocaleString()} {t.currency}</td>
                <td className="py-2.5 px-3 text-end font-medium text-success">{m.profit.toLocaleString()} {t.currency}</td>
                <td className="py-2.5 px-3 text-end">{((m.profit / m.revenue) * 100).toFixed(1)}%</td>
                <td className="py-2.5 px-3 text-end text-primary font-medium">{m.companyShare.toLocaleString()} {t.currency}</td>
                <td className="py-2.5 px-3 text-end">{m.founderShare.toLocaleString()} {t.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
