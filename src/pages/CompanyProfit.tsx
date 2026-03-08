import { StatCard } from "@/components/StatCard";
import { TrendingUp, TrendingDown, DollarSign, Percent, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/exportCsv";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from "recharts";

const monthlyPnL = [
  { month: "أكتوبر", revenue: 380000, cost: 240000, profit: 140000, companyShare: 21000, founderShare: 119000 },
  { month: "نوفمبر", revenue: 420000, cost: 270000, profit: 150000, companyShare: 22500, founderShare: 127500 },
  { month: "ديسمبر", revenue: 390000, cost: 255000, profit: 135000, companyShare: 20250, founderShare: 114750 },
  { month: "يناير", revenue: 480000, cost: 300000, profit: 180000, companyShare: 27000, founderShare: 153000 },
  { month: "فبراير", revenue: 520000, cost: 320000, profit: 200000, companyShare: 30000, founderShare: 170000 },
  { month: "مارس", revenue: 460000, cost: 290000, profit: 170000, companyShare: 25500, founderShare: 144500 },
];

const expenseBreakdown = [
  { name: "تكلفة المواد", value: 65, color: "hsl(var(--primary))" },
  { name: "التوصيل", value: 12, color: "hsl(var(--chart-2))" },
  { name: "العمليات", value: 15, color: "hsl(var(--chart-3))" },
  { name: "أخرى", value: 8, color: "hsl(var(--chart-4))" },
];

const totalRevenue = monthlyPnL.reduce((s, m) => s + m.revenue, 0);
const totalCost = monthlyPnL.reduce((s, m) => s + m.cost, 0);
const totalProfit = monthlyPnL.reduce((s, m) => s + m.profit, 0);
const totalCompanyShare = monthlyPnL.reduce((s, m) => s + m.companyShare, 0);
const avgMargin = ((totalProfit / totalRevenue) * 100).toFixed(1);

export default function CompanyProfitPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">أرباح الشركة</h1>
          <p className="page-description">دفتر أرباح الشركة وتحليلات الأداء (آخر 6 أشهر)</p>
        </div>
        <Button variant="outline" size="sm" className="h-9" onClick={() => exportToCsv("company_profit", ["الشهر","الإيرادات","التكلفة","الربح","حصة الشركة","حصة المؤسسين"], monthlyPnL.map(m => [m.month, m.revenue, m.cost, m.profit, m.companyShare, m.founderShare]))}>
          <Download className="h-3.5 w-3.5 mr-1.5" />تصدير
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="إجمالي الإيرادات" value={`${(totalRevenue / 1000).toFixed(0)} ألف ج.م`} change="6 أشهر" changeType="neutral" icon={DollarSign} />
        <StatCard title="إجمالي الأرباح" value={`${(totalProfit / 1000).toFixed(0)} ألف ج.م`} change={`هامش ${avgMargin}%`} changeType="positive" icon={TrendingUp} />
        <StatCard title="حصة الشركة (15%)" value={`${(totalCompanyShare / 1000).toFixed(1)} ألف ج.م`} change="محتجزة" changeType="positive" icon={Percent} />
        <StatCard title="إجمالي التكلفة" value={`${(totalCost / 1000).toFixed(0)} ألف ج.م`} change={`${((totalCost / totalRevenue) * 100).toFixed(0)}% من الإيرادات`} changeType="negative" icon={TrendingDown} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card lg:col-span-2">
          <h3 className="font-semibold text-sm mb-4">اتجاه الإيرادات والأرباح</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyPnL}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name="الإيرادات" />
              <Line type="monotone" dataKey="profit" stroke="hsl(var(--chart-2))" strokeWidth={2} name="الأرباح" />
              <Line type="monotone" dataKey="cost" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="5 5" name="التكلفة" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">توزيع المصروفات</h3>
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

      <div className="stat-card">
        <h3 className="font-semibold text-sm mb-4">توزيع الأرباح: الشركة مقابل المؤسسين</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyPnL}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            <Bar dataKey="companyShare" stackId="a" fill="hsl(var(--primary))" name="الشركة (15%)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="founderShare" stackId="a" fill="hsl(var(--chart-2))" name="المؤسسون (85%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="stat-card overflow-x-auto">
        <h3 className="font-semibold text-sm mb-4">الأرباح والخسائر الشهرية</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">الشهر</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">الإيرادات</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">التكلفة</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">الربح</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">الهامش</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">الشركة</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">المؤسسون</th>
            </tr>
          </thead>
          <tbody>
            {monthlyPnL.map((m) => (
              <tr key={m.month} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2.5 px-3 font-medium">{m.month}</td>
                <td className="py-2.5 px-3 text-right">{m.revenue.toLocaleString()} ج.م</td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">{m.cost.toLocaleString()} ج.م</td>
                <td className="py-2.5 px-3 text-right font-medium text-success">{m.profit.toLocaleString()} ج.م</td>
                <td className="py-2.5 px-3 text-right">{((m.profit / m.revenue) * 100).toFixed(1)}%</td>
                <td className="py-2.5 px-3 text-right text-primary font-medium">{m.companyShare.toLocaleString()} ج.م</td>
                <td className="py-2.5 px-3 text-right">{m.founderShare.toLocaleString()} ج.م</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
