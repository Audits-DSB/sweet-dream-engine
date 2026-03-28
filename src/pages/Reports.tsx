import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, FileText, TrendingUp, Users, Package, Loader2, Truck, Wallet, DollarSign, ArrowUpDown, CheckCircle2 } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area, ComposedChart,
} from "recharts";
import { exportToCsv } from "@/lib/exportCsv";
import { api } from "@/lib/api";

const MONTH_LABELS: Record<string, string> = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
  "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
};

const STATUS_COLORS: Record<string, string> = {
  "Draft": "#94a3b8", "مسودة": "#94a3b8",
  "Processing": "#f59e0b", "قيد المعالجة": "#f59e0b",
  "Confirmed": "#3b82f6", "مؤكد": "#3b82f6",
  "Ready for Delivery": "#8b5cf6", "جاهز للتسليم": "#8b5cf6",
  "Partially Delivered": "#f97316", "مسلم جزئياً": "#f97316",
  "Delivered": "#22c55e", "مُسلَّم": "#22c55e",
  "Completed": "#10b981", "مكتمل": "#10b981",
  "Cancelled": "#ef4444", "ملغي": "#ef4444",
};

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#f97316", "#06b6d4", "#ec4899", "#10b981", "#94a3b8"];

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  direction: "rtl" as const,
};

export default function ReportsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any[]>("/orders").catch(() => []),
      api.get<any[]>("/clients").catch(() => []),
      api.get<any[]>("/deliveries").catch(() => []),
      api.get<any[]>("/collections").catch(() => []),
      api.get<any[]>("/client-inventory").catch(() => []),
    ]).then(([o, c, d, col, inv]) => {
      setOrders(o || []);
      setClients(c || []);
      setDeliveries(d || []);
      setCollections(col || []);
      setInventory(inv || []);
    }).finally(() => setLoading(false));
  }, []);

  const clientMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clients || []).forEach((c: any) => { m[c.id] = c.name || c.id; });
    return m;
  }, [clients]);

  const clientRevenue = useMemo(() => {
    const map: Record<string, { client: string; clientId: string; revenue: number; cost: number; orders: number }> = {};
    for (const o of orders) {
      const cid = o.client_id || o.clientId || "";
      const name = o.client || clientMap[cid] || cid || "غير محدد";
      const rev = parseFloat(String(o.total_selling || o.totalSelling || "0").replace(/,/g, "")) || 0;
      const cost = parseFloat(String(o.total_cost || o.totalCost || "0").replace(/,/g, "")) || 0;
      if (!map[cid]) map[cid] = { client: name, clientId: cid, revenue: 0, cost: 0, orders: 0 };
      map[cid].revenue += rev;
      map[cid].cost += cost;
      map[cid].orders += 1;
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [orders, clientMap]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; label: string; orders: number; revenue: number; cost: number; profit: number }> = {};
    for (const o of orders) {
      const date = o.date || o.created_at || "";
      const ym = date.slice(0, 7);
      if (!ym) continue;
      const rev = parseFloat(String(o.total_selling || o.totalSelling || "0").replace(/,/g, "")) || 0;
      const cost = parseFloat(String(o.total_cost || o.totalCost || "0").replace(/,/g, "")) || 0;
      if (!map[ym]) map[ym] = { month: ym, label: MONTH_LABELS[ym.slice(5)] || ym.slice(5), orders: 0, revenue: 0, cost: 0, profit: 0 };
      map[ym].orders += 1;
      map[ym].revenue += rev;
      map[ym].cost += cost;
      map[ym].profit += (rev - cost);
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12).map(m => ({ ...m, month: m.label }));
  }, [orders]);

  const orderStatusDist = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) {
      const s = o.status || "Draft";
      map[s] = (map[s] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] || "#94a3b8" }));
  }, [orders]);

  const deliveryStats = useMemo(() => {
    const confirmed = deliveries.filter((d: any) => d.status === "Delivered" || d.status === "مُسلَّم").length;
    const pending = deliveries.filter((d: any) => d.status === "Pending" || d.status === "معلق" || d.status === "In Transit").length;
    const monthMap: Record<string, { month: string; confirmed: number; pending: number }> = {};
    for (const d of deliveries) {
      const date = d.date || d.created_at || "";
      const ym = date.slice(0, 7);
      if (!ym) continue;
      if (!monthMap[ym]) monthMap[ym] = { month: MONTH_LABELS[ym.slice(5)] || ym.slice(5), confirmed: 0, pending: 0 };
      if (d.status === "Delivered" || d.status === "مُسلَّم") monthMap[ym].confirmed += 1;
      else monthMap[ym].pending += 1;
    }
    const monthlyDeliveries = Object.values(monthMap).slice(-6);
    return { total: deliveries.length, confirmed, pending, monthly: monthlyDeliveries };
  }, [deliveries]);

  const collectionStats = useMemo(() => {
    let totalAmount = 0, paidAmount = 0;
    const monthMap: Record<string, { month: string; collected: number; remaining: number }> = {};
    for (const c of collections) {
      const amount = parseFloat(String(c.amount || c.total || "0").replace(/,/g, "")) || 0;
      const paid = parseFloat(String(c.paid || c.paidAmount || c.paid_amount || "0").replace(/,/g, "")) || 0;
      totalAmount += amount;
      paidAmount += paid;
      const date = c.date || c.created_at || "";
      const ym = date.slice(0, 7);
      if (!ym) continue;
      if (!monthMap[ym]) monthMap[ym] = { month: MONTH_LABELS[ym.slice(5)] || ym.slice(5), collected: 0, remaining: 0 };
      monthMap[ym].collected += paid;
      monthMap[ym].remaining += (amount - paid);
    }
    const monthly = Object.values(monthMap).slice(-6);
    return { total: collections.length, totalAmount, paidAmount, remaining: totalAmount - paidAmount, monthly };
  }, [collections]);

  const inventoryStats = useMemo(() => {
    const statusMap: Record<string, number> = {};
    let totalValue = 0;
    for (const inv of inventory) {
      const s = inv.status || "In Stock";
      statusMap[s] = (statusMap[s] || 0) + 1;
      totalValue += (Number(inv.remaining || 0) * Number(inv.sellingPrice || inv.selling_price || 0));
    }
    const byStatus = Object.entries(statusMap).map(([name, value]) => ({ name, value }));
    const uniqueMaterials = new Set(inventory.map((i: any) => i.material || i.code)).size;
    const uniqueClients = new Set(inventory.map((i: any) => i.clientName || i.client_name)).size;
    return { total: inventory.length, totalValue, byStatus, uniqueMaterials, uniqueClients };
  }, [inventory]);

  const topMaterials = useMemo(() => {
    const map: Record<string, { material: string; totalQty: number; totalValue: number }> = {};
    for (const inv of inventory) {
      const mat = inv.material || inv.code || "—";
      const qty = Number(inv.delivered || 0);
      const val = qty * Number(inv.sellingPrice || inv.selling_price || 0);
      if (!map[mat]) map[mat] = { material: mat, totalQty: 0, totalValue: 0 };
      map[mat].totalQty += qty;
      map[mat].totalValue += val;
    }
    return Object.values(map).sort((a, b) => b.totalValue - a.totalValue).slice(0, 8);
  }, [inventory]);

  const totalRevenue = clientRevenue.reduce((s, c) => s + c.revenue, 0);
  const totalCost = clientRevenue.reduce((s, c) => s + c.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const totalOrdersCount = orders.length;
  const activeClients = new Set(orders.map(o => o.client_id || o.clientId).filter(Boolean)).size;

  const reports = [
    { name: t.clientRevenueReport, desc: t.clientRevenueDesc, icon: Users, action: () => exportToCsv("client_revenue", [t.client, t.revenue, t.totalOrders], clientRevenue.map(c => [c.client, c.revenue, c.orders])) },
    { name: t.pnlSummary, desc: t.pnlDesc, icon: TrendingUp, action: () => navigate("/company-profit") },
    { name: t.inventoryStatusReport, desc: t.inventoryStatusDesc, icon: Package, action: () => navigate("/inventory") },
    { name: t.agingReport, desc: t.agingDesc, icon: FileText, action: () => navigate("/collections") },
    { name: t.auditReport, desc: t.auditReportDesc, icon: FileText, action: () => navigate("/audits") },
    { name: "تقرير الأوردرات الشهري", desc: "ملخص الأوردرات والإيرادات شهرياً", icon: BarChart3, action: () => exportToCsv("monthly_orders", ["الشهر", "الأوردرات", "الإيرادات"], monthlyData.map(m => [m.month, m.orders, m.revenue])) },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">{t.reportsTitle}</h1>
          <p className="page-description">{t.reportsDesc}</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() =>
          exportToCsv("full_report", ["القسم", "البيان", "القيمة"], [
            ["الأوردرات", "إجمالي الأوردرات", totalOrdersCount],
            ["الأوردرات", "إجمالي الإيرادات", totalRevenue],
            ["الأوردرات", "إجمالي التكلفة", totalCost],
            ["الأوردرات", "صافي الربح", totalProfit],
            ["العملاء", "عملاء نشطين", activeClients],
            ["التوصيل", "إجمالي التوصيلات", deliveryStats.total],
            ["التوصيل", "مؤكدة", deliveryStats.confirmed],
            ["التحصيل", "إجمالي المبلغ", collectionStats.totalAmount],
            ["التحصيل", "المحصل", collectionStats.paidAmount],
            ["التحصيل", "المتبقي", collectionStats.remaining],
            ["الجرد", "إجمالي الدفعات", inventoryStats.total],
            ["الجرد", "قيمة المخزون", inventoryStats.totalValue],
          ])
        }>
          <Download className="h-3.5 w-3.5" /> تصدير تقرير شامل
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="إجمالي الإيرادات" value={`${(totalRevenue / 1000).toFixed(0)}k`} change={`${t.currency}`} changeType="positive" icon={DollarSign} />
        <StatCard title="صافي الربح" value={`${(totalProfit / 1000).toFixed(0)}k`} change={totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(1)}%` : "0%"} changeType={totalProfit >= 0 ? "positive" : "negative"} icon={TrendingUp} />
        <StatCard title="الأوردرات" value={totalOrdersCount} change={`${monthlyData.length} شهر`} changeType="neutral" icon={BarChart3} />
        <StatCard title="العملاء النشطين" value={activeClients} change={`من ${clients.length}`} changeType="neutral" icon={Users} />
        <StatCard title="التوصيلات" value={deliveryStats.total} change={`${deliveryStats.confirmed} مؤكدة`} changeType="positive" icon={Truck} />
        <StatCard title="التحصيل" value={`${collectionStats.paidAmount > 0 ? ((collectionStats.paidAmount / (collectionStats.totalAmount || 1)) * 100).toFixed(0) : 0}%`} change={`${collectionStats.total} فاتورة`} changeType={collectionStats.remaining > 0 ? "negative" : "positive"} icon={Wallet} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">الإيرادات والأرباح الشهرية</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) => [`${Number(v).toLocaleString()} ${t.currency}`, name]} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="الإيرادات" />
                <Bar dataKey="cost" fill="#94a3b8" radius={[4, 4, 0, 0]} name="التكلفة" />
                <Line type="monotone" dataKey="profit" stroke="#94a3b8" strokeWidth={2} dot={(props: any) => { const c = props.payload.profit >= 0 ? "#22c55e" : "#ef4444"; return <circle key={props.key} cx={props.cx} cy={props.cy} r={3} fill={c} stroke={c} />; }} name="الربح" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">لا توجد بيانات</div>
          )}
        </div>

        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">توزيع حالات الأوردرات</h3>
          {orderStatusDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={orderStatusDist} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={{ strokeWidth: 1 }} style={{ fontSize: "10px" }}>
                  {orderStatusDist.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) => [`${v} أوردر`, name]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">لا توجد بيانات</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">{t.revenueByClient}</h3>
          {clientRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={clientRevenue} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <YAxis dataKey="client" type="category" width={90} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${Number(v).toLocaleString()} ${t.currency}`, t.revenue]} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name={t.revenue} cursor="pointer"
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

        <div className="stat-card cursor-pointer" onClick={() => navigate("/orders")}>
          <h3 className="font-semibold text-sm mb-4">{t.monthlyOrderTrend}</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="orders" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#orderGrad)" name="عدد الأوردرات" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">لا توجد بيانات</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card cursor-pointer" onClick={() => navigate("/deliveries")}>
          <h3 className="font-semibold text-sm mb-4">أداء التوصيلات</h3>
          {deliveryStats.monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deliveryStats.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                <Bar dataKey="confirmed" fill="#22c55e" radius={[4, 4, 0, 0]} name="مؤكدة" stackId="a" />
                <Bar dataKey="pending" fill="#f59e0b" radius={[4, 4, 0, 0]} name="معلقة" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              <div className="text-center">
                <Truck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p>لا توجد بيانات توصيل</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs">
            <span className="text-muted-foreground">الإجمالي: {deliveryStats.total}</span>
            <span className="text-green-600">مؤكدة: {deliveryStats.confirmed}</span>
            <span className="text-yellow-600">معلقة: {deliveryStats.pending}</span>
          </div>
        </div>

        <div className="stat-card cursor-pointer" onClick={() => navigate("/collections")}>
          <h3 className="font-semibold text-sm mb-4">تقدم التحصيل</h3>
          {collectionStats.totalAmount > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={[
                    { name: "محصّل", value: collectionStats.paidAmount, color: "#22c55e" },
                    { name: "متبقي", value: collectionStats.remaining, color: "#ef4444" },
                  ]} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 1 }} style={{ fontSize: "11px" }}>
                    <Cell fill="#22c55e" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${Number(v).toLocaleString()} ${t.currency}`, ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs">
                <span className="text-green-600">محصّل: {collectionStats.paidAmount.toLocaleString()}</span>
                <span className="text-red-600">متبقي: {collectionStats.remaining.toLocaleString()}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              <div className="text-center">
                <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p>لا توجد بيانات تحصيل</p>
              </div>
            </div>
          )}
        </div>

        <div className="stat-card cursor-pointer" onClick={() => navigate("/inventory")}>
          <h3 className="font-semibold text-sm mb-4">حالة المخزون</h3>
          {inventoryStats.byStatus.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={inventoryStats.byStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 1 }} style={{ fontSize: "10px" }}>
                    {inventoryStats.byStatus.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) => [`${v} دفعة`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs">
                <span className="text-muted-foreground">{inventoryStats.total} دفعة</span>
                <span className="text-muted-foreground">{inventoryStats.uniqueMaterials} مادة</span>
                <span className="text-primary font-medium">القيمة: {(inventoryStats.totalValue / 1000).toFixed(0)}k</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              <div className="text-center">
                <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p>لا توجد بيانات مخزون</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {topMaterials.length > 0 && (
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">أكثر المواد قيمة في المخزون</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topMaterials}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="material" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) => [name === "القيمة" ? `${Number(v).toLocaleString()} ${t.currency}` : v, name]} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="totalValue" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="القيمة" />
              <Bar dataKey="totalQty" fill="#06b6d4" radius={[4, 4, 0, 0]} name="الكمية" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">{t.revenueByClient}</h3>
            <Button variant="outline" size="sm" className="h-8" onClick={() =>
              exportToCsv("client_revenue", [t.client, t.revenue, "التكلفة", "الربح", t.totalOrders, "% من الإجمالي"],
                clientRevenue.map(c => [c.client, c.revenue.toLocaleString(), c.cost.toLocaleString(), (c.revenue - c.cost).toLocaleString(), c.orders, totalRevenue > 0 ? ((c.revenue / totalRevenue) * 100).toFixed(1) + "%" : "0%"]))
            }>
              <Download className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" /> {t.export || "تصدير"}
            </Button>
          </div>
          {clientRevenue.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
                  <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.totalOrders}</th>
                  <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">الإيرادات</th>
                  <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">التكلفة</th>
                  <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">الربح</th>
                  <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">%</th>
                </tr>
              </thead>
              <tbody>
                {clientRevenue.map((c) => {
                  const profit = c.revenue - c.cost;
                  return (
                    <tr key={c.clientId} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => c.clientId && navigate(`/clients/${c.clientId}`)}>
                      <td className="py-2.5 px-3 font-medium">{c.client}</td>
                      <td className="py-2.5 px-3 text-end">{c.orders}</td>
                      <td className="py-2.5 px-3 text-end">{c.revenue.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-end text-muted-foreground">{c.cost.toLocaleString()}</td>
                      <td className={`py-2.5 px-3 text-end font-medium ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>{profit.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-end text-muted-foreground">{totalRevenue > 0 ? ((c.revenue / totalRevenue) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/30 font-semibold">
                  <td className="py-2.5 px-3">الإجمالي</td>
                  <td className="py-2.5 px-3 text-end">{totalOrdersCount}</td>
                  <td className="py-2.5 px-3 text-end">{totalRevenue.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-end text-muted-foreground">{totalCost.toLocaleString()}</td>
                  <td className={`py-2.5 px-3 text-end ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{totalProfit.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-end">100%</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">لا توجد بيانات أوردرات بعد</div>
          )}
        </div>

        {collectionStats.monthly.length > 0 && (
          <div className="stat-card">
            <h3 className="font-semibold text-sm mb-4">التحصيل الشهري</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={collectionStats.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) => [`${Number(v).toLocaleString()} ${t.currency}`, name]} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="collected" fill="#22c55e" radius={[4, 4, 0, 0]} name="محصّل" stackId="a" />
                <Bar dataKey="remaining" fill="#ef4444" radius={[4, 4, 0, 0]} name="متبقي" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-3">{t.availableReports}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reports.map((r) => (
            <div key={r.name} className="stat-card flex items-start gap-3 !p-4 cursor-pointer hover:border-primary/30 transition-colors" onClick={r.action}>
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
