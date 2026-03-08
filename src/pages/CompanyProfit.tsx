import { StatCard } from "@/components/StatCard";
import { TrendingUp, TrendingDown, DollarSign, Percent, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/exportCsv";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from "recharts";

const monthlyPnL = [
  { month: "Oct", revenue: 38000, cost: 24000, profit: 14000, companyShare: 2100, founderShare: 11900 },
  { month: "Nov", revenue: 42000, cost: 27000, profit: 15000, companyShare: 2250, founderShare: 12750 },
  { month: "Dec", revenue: 39000, cost: 25500, profit: 13500, companyShare: 2025, founderShare: 11475 },
  { month: "Jan", revenue: 48000, cost: 30000, profit: 18000, companyShare: 2700, founderShare: 15300 },
  { month: "Feb", revenue: 52000, cost: 32000, profit: 20000, companyShare: 3000, founderShare: 17000 },
  { month: "Mar", revenue: 46000, cost: 29000, profit: 17000, companyShare: 2550, founderShare: 14450 },
];

const expenseBreakdown = [
  { name: "Material Cost", value: 65, color: "hsl(var(--primary))" },
  { name: "Delivery", value: 12, color: "hsl(var(--chart-2))" },
  { name: "Operations", value: 15, color: "hsl(var(--chart-3))" },
  { name: "Other", value: 8, color: "hsl(var(--chart-4))" },
];

const totalRevenue = monthlyPnL.reduce((s, m) => s + m.revenue, 0);
const totalCost = monthlyPnL.reduce((s, m) => s + m.cost, 0);
const totalProfit = monthlyPnL.reduce((s, m) => s + m.profit, 0);
const totalCompanyShare = monthlyPnL.reduce((s, m) => s + m.companyShare, 0);
const avgMargin = ((totalProfit / totalRevenue) * 100).toFixed(1);

export default function CompanyProfitPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Company Profit</h1>
        <p className="page-description">Company profit ledger and performance analytics (last 6 months)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={`SAR ${(totalRevenue / 1000).toFixed(0)}K`} change="6 months" changeType="neutral" icon={DollarSign} />
        <StatCard title="Total Profit" value={`SAR ${(totalProfit / 1000).toFixed(0)}K`} change={`Margin ${avgMargin}%`} changeType="positive" icon={TrendingUp} />
        <StatCard title="Company Share (15%)" value={`SAR ${(totalCompanyShare / 1000).toFixed(1)}K`} change="Retained" changeType="positive" icon={Percent} />
        <StatCard title="Total Cost" value={`SAR ${(totalCost / 1000).toFixed(0)}K`} change={`${((totalCost / totalRevenue) * 100).toFixed(0)}% of revenue`} changeType="negative" icon={TrendingDown} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue vs Profit trend */}
        <div className="stat-card lg:col-span-2">
          <h3 className="font-semibold text-sm mb-4">Revenue & Profit Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyPnL}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name="Revenue" />
              <Line type="monotone" dataKey="profit" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Profit" />
              <Line type="monotone" dataKey="cost" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="5 5" name="Cost" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Expense breakdown */}
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">Expense Breakdown</h3>
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
                <span className="text-muted-foreground">{item.name} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Profit split chart */}
      <div className="stat-card">
        <h3 className="font-semibold text-sm mb-4">Profit Split: Company vs Founders</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyPnL}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            <Bar dataKey="companyShare" stackId="a" fill="hsl(var(--primary))" name="Company (15%)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="founderShare" stackId="a" fill="hsl(var(--chart-2))" name="Founders (85%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly P&L table */}
      <div className="stat-card overflow-x-auto">
        <h3 className="font-semibold text-sm mb-4">Monthly P&L</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Month</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Revenue</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Cost</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Profit</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Margin</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Company</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Founders</th>
            </tr>
          </thead>
          <tbody>
            {monthlyPnL.map((m) => (
              <tr key={m.month} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2.5 px-3 font-medium">{m.month}</td>
                <td className="py-2.5 px-3 text-right">SAR {m.revenue.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">SAR {m.cost.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-right font-medium text-success">SAR {m.profit.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-right">{((m.profit / m.revenue) * 100).toFixed(1)}%</td>
                <td className="py-2.5 px-3 text-right text-primary font-medium">SAR {m.companyShare.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-right">SAR {m.founderShare.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
