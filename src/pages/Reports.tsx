import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, FileText, TrendingUp, Users, Package, Loader2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from "recharts";
import { exportToCsv } from "@/lib/exportCsv";
import { api } from "@/lib/api";

const MONTH_LABELS: Record<string, string> = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
  "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
};

export default function ReportsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any[]>("/orders").catch(() => []),
      api.get<any[]>("/clients").catch(() => []),
    ]).then(([o, c]) => {
      setOrders(o || []);
      setClients(c || []);
    }).finally(() => setLoading(false));
  }, []);

  const clientMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clients || []).forEach((c: any) => { m[c.id] = c.name || c.id; });
    return m;
  }, [clients]);

  const clientRevenue = useMemo(() => {
    const map: Record<string, { client: string; clientId: string; revenue: number; orders: number }> = {};
    for (const o of orders) {
      const cid = o.client_id || o.clientId || "";
      const name = o.client || clientMap[cid] || cid || "غير محدد";
      const rev = parseFloat(String(o.total_selling || o.totalSelling || "0").replace(/,/g, "")) || 0;
      if (!map[cid]) map[cid] = { client: name, clientId: cid, revenue: 0, orders: 0 };
      map[cid].revenue += rev;
      map[cid].orders += 1;
    }
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [orders, clientMap]);

  const monthlyOrders = useMemo(() => {
    const map: Record<string, { month: string; label: string; orders: number; revenue: number }> = {};
    for (const o of orders) {
      const date = o.date || o.created_at || "";
      const ym = date.slice(0, 7); // YYYY-MM
      if (!ym) continue;
      const rev = parseFloat(String(o.total_selling || o.totalSelling || "0").replace(/,/g, "")) || 0;
      if (!map[ym]) map[ym] = { month: ym, label: MONTH_LABELS[ym.slice(5)] || ym.slice(5), orders: 0, revenue: 0 };
      map[ym].orders += 1;
      map[ym].revenue += rev;
    }
    return Object.values(map)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map(m => ({ ...m, month: m.label }));
  }, [orders]);

  const totalRevenue = clientRevenue.reduce((s, c) => s + c.revenue, 0);
  const totalOrdersCount = orders.length;
  const activeClients = new Set(orders.map(o => o.client_id || o.clientId).filter(Boolean)).size;

  const reports = [
    {
      name: t.clientRevenueReport, desc: t.clientRevenueDesc, icon: Users,
      action: () => exportToCsv("client_revenue", [t.client, t.revenue, t.totalOrders],
        clientRevenue.map(c => [c.client, c.revenue, c.orders]))
    },
    {
      name: t.pnlSummary, desc: t.pnlDesc, icon: TrendingUp,
      action: () => navigate("/company-profit")
    },
    {
      name: t.inventoryStatusReport, desc: t.inventoryStatusDesc, icon: Package,
      action: () => navigate("/inventory")
    },
    {
      name: t.agingReport, desc: t.agingDesc, icon: FileText,
      action: () => navigate("/collections")
    },
    {
      name: t.auditReport, desc: t.auditReportDesc, icon: FileText,
      action: () => navigate("/audits")
    },
    {
      name: "تقرير الأوردرات الشهري", desc: "ملخص الأوردرات والإيرادات شهرياً", icon: BarChart3,
      action: () => exportToCsv("monthly_orders", ["الشهر", "الأوردرات", "الإيرادات"],
        monthlyOrders.map(m => [m.month, m.orders, m.revenue]))
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.reportsTitle}</h1>
        <p className="page-description">{t.reportsDesc}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t.totalRevenue}
          value={`${(totalRevenue / 1000).toFixed(0)} ${t.thousand} ${t.currency}`}
          change={t.allClients}
          changeType="positive"
          icon={TrendingUp}
        />
        <StatCard
          title={t.totalOrders}
          value={totalOrdersCount}
          change={`${monthlyOrders.length} ${t.last6Months || "أشهر"}`}
          changeType="neutral"
          icon={BarChart3}
        />
        <StatCard
          title={t.activeClients}
          value={activeClients}
          change={t.haveOrders}
          changeType="neutral"
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by client chart */}
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">{t.revenueByClient}</h3>
          {clientRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={clientRevenue} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <YAxis dataKey="client" type="category" width={100} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: any) => [`${Number(v).toLocaleString()} ${t.currency}`, t.revenue]}
                />
                <Bar
                  dataKey="revenue"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                  name={`${t.revenue} (${t.currency})`}
                  cursor="pointer"
                  onClick={(data: any) => {
                    const cl = clientRevenue.find(c => c.client === data.client);
                    if (cl?.clientId) navigate(`/clients/${cl.clientId}`);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">لا توجد بيانات</div>
          )}
        </div>

        {/* Monthly orders trend */}
        <div className="stat-card cursor-pointer" onClick={() => navigate("/orders")}>
          <h3 className="font-semibold text-sm mb-4">{t.monthlyOrderTrend}</h3>
          {monthlyOrders.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyOrders}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  name={t.orders}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">لا توجد بيانات</div>
          )}
        </div>
      </div>

      {/* Client revenue table */}
      <div className="stat-card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">{t.revenueByClient}</h3>
          <Button variant="outline" size="sm" className="h-8" onClick={() =>
            exportToCsv("client_revenue", [t.client, t.revenue, t.totalOrders],
              clientRevenue.map(c => [c.client, c.revenue.toLocaleString(), c.orders]))
          }>
            <Download className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
            {t.export || "تصدير"}
          </Button>
        </div>
        {clientRevenue.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.totalOrders}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.revenue} ({t.currency})</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">% من الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {clientRevenue.map((c) => (
                <tr
                  key={c.clientId}
                  className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                  onClick={() => c.clientId && navigate(`/clients/${c.clientId}`)}
                >
                  <td className="py-2.5 px-3 font-medium">{c.client}</td>
                  <td className="py-2.5 px-3 text-end">{c.orders}</td>
                  <td className="py-2.5 px-3 text-end font-medium">{c.revenue.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-end text-muted-foreground">
                    {totalRevenue > 0 ? ((c.revenue / totalRevenue) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-8 text-center text-muted-foreground text-sm">لا توجد بيانات أوردرات بعد</div>
        )}
      </div>

      {/* Quick report cards */}
      <div>
        <h3 className="font-semibold text-sm mb-3">{t.availableReports}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reports.map((r) => (
            <div
              key={r.name}
              className="stat-card flex items-start gap-3 !p-4 cursor-pointer hover:border-primary/30 transition-colors"
              onClick={r.action}
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <r.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
