import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, FileText, TrendingUp, Users, Package } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from "recharts";
import { exportToCsv } from "@/lib/exportCsv";
import { toast } from "sonner";

const clientRevenue = [
  { client: "مركز نور", clientId: "C002", revenue: 284000, orders: 12 },
  { client: "عيادة د. أحمد", clientId: "C001", revenue: 226000, orders: 15 },
  { client: "المركز الملكي", clientId: "C004", revenue: 182000, orders: 8 },
  { client: "عيادة بلو مون", clientId: "C006", revenue: 148000, orders: 6 },
  { client: "جرين فالي", clientId: "C003", revenue: 112000, orders: 7 },
  { client: "سمايل هاوس", clientId: "C005", revenue: 84000, orders: 5 },
  { client: "سبايس جاردن", clientId: "C007", revenue: 62000, orders: 4 },
];

const materialUsage = [
  { material: "حشو كمبوزيت ضوئي", totalUsed: 480, unit: "عبوة", revenue: 576000 },
  { material: "إبر تخدير", totalUsed: 210, unit: "علبة", revenue: 199500 },
  { material: "مادة طبع سيليكون", totalUsed: 320, unit: "عبوة", revenue: 144000 },
  { material: "قفازات لاتكس", totalUsed: 150, unit: "كرتونة", revenue: 60000 },
  { material: "مبيض أسنان", totalUsed: 25, unit: "عبوة", revenue: 70000 },
  { material: "فرز دوارة", totalUsed: 18, unit: "عبوة", revenue: 36000 },
];

const monthlyOrders = [
  { month: "Oct", orders: 18, revenue: 380000 },
  { month: "Nov", orders: 22, revenue: 420000 },
  { month: "Dec", orders: 19, revenue: 390000 },
  { month: "Jan", orders: 25, revenue: 480000 },
  { month: "Feb", orders: 28, revenue: 520000 },
  { month: "Mar", orders: 23, revenue: 460000 },
];

export default function ReportsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const totalRevenue = clientRevenue.reduce((s, c) => s + c.revenue, 0);
  const totalOrders = monthlyOrders.reduce((s, m) => s + m.orders, 0);

  const reports = [
    { name: t.clientRevenueReport, desc: t.clientRevenueDesc, icon: Users, action: () => exportToCsv("client_revenue", [t.client, t.revenue, t.totalOrders], clientRevenue.map(c => [c.client, c.revenue, c.orders])) },
    { name: t.materialUsageReport, desc: t.materialUsageDesc, icon: Package, action: () => exportToCsv("material_usage", [t.material, t.quantityUsed, t.unit, t.revenue], materialUsage.map(m => [m.material, m.totalUsed, m.unit, m.revenue])) },
    { name: t.pnlSummary, desc: t.pnlDesc, icon: TrendingUp, action: () => navigate("/company-profit") },
    { name: t.inventoryStatusReport, desc: t.inventoryStatusDesc, icon: Package, action: () => navigate("/inventory") },
    { name: t.agingReport, desc: t.agingDesc, icon: FileText, action: () => navigate("/collections") },
    { name: t.auditReport, desc: t.auditReportDesc, icon: FileText, action: () => navigate("/audits") },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.reportsTitle}</h1>
        <p className="page-description">{t.reportsDesc}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title={t.totalRevenue} value={`${(totalRevenue / 1000).toFixed(0)} ${t.thousand} ${t.currency}`} change={t.allClients} changeType="positive" icon={TrendingUp} />
        <StatCard title={t.totalOrders} value={totalOrders} change={t.last6Months} changeType="neutral" icon={BarChart3} />
        <StatCard title={t.activeClients} value={clientRevenue.length} change={t.haveOrders} changeType="neutral" icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">{t.revenueByClient}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={clientRevenue} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis dataKey="client" type="category" width={110} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name={`${t.revenue} (${t.currency})`} cursor="pointer" onClick={(data: any) => { const cl = clientRevenue.find(c => c.client === data.client); if (cl) navigate(`/clients/${cl.clientId}`); }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card cursor-pointer" onClick={() => navigate("/orders")}>
          <h3 className="font-semibold text-sm mb-4">{t.monthlyOrderTrend}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyOrders}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Line type="monotone" dataKey="orders" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} name={t.orders} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="stat-card overflow-x-auto">
        <h3 className="font-semibold text-sm mb-4">{t.materialUsageSummary}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>
              <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.quantityUsed}</th>
              <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.unit}</th>
              <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.revenue}</th>
            </tr>
          </thead>
          <tbody>
            {materialUsage.map((m) => (
              <tr key={m.material} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => navigate("/materials")}>
                <td className="py-2.5 px-3 font-medium">{m.material}</td>
                <td className="py-2.5 px-3 text-end">{m.totalUsed}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{m.unit}</td>
                <td className="py-2.5 px-3 text-end font-medium">{m.revenue.toLocaleString()} {t.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-3">{t.availableReports}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reports.map((r) => (
            <div key={r.name} className="stat-card flex items-start gap-3 !p-4 cursor-pointer" onClick={r.action}>
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><r.icon className="h-4 w-4 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0"><Download className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
