import { useState, useEffect, useMemo } from "react";
import { Users, ShoppingCart, FileText, Receipt, TrendingUp, AlertTriangle, Clock, Package, CheckCircle2, Banknote, Truck, Wallet, ArrowUpRight, ArrowDownRight, BarChart3, Target, Warehouse, Boxes } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Sector, Legend, LineChart, Line, AreaChart, Area, ComposedChart,
} from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { WorkflowBanner } from "@/components/WorkflowBanner";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Order = {
  id: string; clientId: string; client: string; date: string;
  status: string; totalSelling: string | number; totalCost: string | number;
};
type Client = { id: string; name: string; status: string; outstanding: number };
type Collection = {
  id: string; clientId: string; client: string;
  invoiceDate: string; status: string;
  totalAmount: number; paidAmount: number; outstanding: number;
};

const ARABIC_MONTHS: Record<string, string> = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
  "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
};

const TOOLTIP_STYLE = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" };

function toNum(v: string | number | undefined): number {
  if (!v) return 0;
  return typeof v === "number" ? v : Number(String(v).replace(/,/g, "")) || 0;
}

function mapCollection(raw: any): Collection {
  const clientId = raw.clientId || raw.client_id || "";
  return {
    id: raw.id, clientId,
    client: raw.client || raw.clientName || raw.client_name || clientId,
    invoiceDate: raw.invoiceDate || raw.invoice_date || raw.createdAt || "",
    status: raw.status || "Awaiting Confirmation",
    totalAmount: toNum(raw.totalAmount ?? raw.total_amount),
    paidAmount: toNum(raw.paidAmount ?? raw.paid_amount),
    outstanding: toNum(raw.outstanding),
  };
}

const STATUS_COLORS: Record<string, string> = {
  "Draft": "#94a3b8", "Processing": "#f59e0b", "Confirmed": "#3b82f6",
  "Ready for Delivery": "#8b5cf6", "Partially Delivered": "#f97316",
  "Delivered": "#22c55e", "Completed": "#10b981", "Cancelled": "#ef4444",
  "Awaiting Purchase": "#eab308", "Invoiced": "#6366f1", "Closed": "#6b7280",
};

export default function Dashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeSlice, setActiveSlice] = useState<number | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [companyInventory, setCompanyInventory] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Client[]>("/clients"),
      api.get<Order[]>("/orders"),
      api.get<any[]>("/collections"),
      api.get<any[]>("/deliveries").catch(() => []),
      api.get<any[]>("/client-inventory").catch(() => []),
      api.get<any[]>("/alerts").catch(() => []),
      api.get<any[]>("/company-inventory").catch(() => []),
    ]).then(([c, o, cols, del, inv, al, compInv]) => {
      setClients(c || []);
      setOrders(o || []);
      setCollections((cols || []).map(mapCollection));
      setDeliveries(del || []);
      setInventory(inv || []);
      setAlerts(al || []);
      setCompanyInventory(compInv || []);
    }).finally(() => setLoading(false));
  }, []);

  const activeClients = clients.filter(c => c.status === "Active").length;
  const activeOrders = orders.filter(o => ["Processing", "Draft", "Confirmed", "Ready for Delivery", "Awaiting Purchase"].includes(o.status)).length;
  const totalCollected = collections.reduce((s, c) => s + c.paidAmount, 0);
  const totalOutstanding = collections.reduce((s, c) => s + c.outstanding, 0);
  const overdueCollections = collections.filter(c => c.status === "Overdue").length;
  const deliveredOrders = orders.filter(o => ["Delivered", "Closed", "Completed"].includes(o.status));
  const totalRevenue = deliveredOrders.reduce((s, o) => s + toNum(o.totalSelling), 0);
  const totalCostDelivered = deliveredOrders.reduce((s, o) => s + toNum(o.totalCost), 0);
  const profit = totalRevenue - totalCostDelivered;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const confirmedDeliveries = deliveries.filter((d: any) => d.status === "Delivered" || d.status === "مُسلَّم").length;
  const pendingDeliveries = deliveries.length - confirmedDeliveries;

  const inventoryValue = inventory.reduce((s, i) => s + (Number(i.remaining || 0) * Number(i.sellingPrice || i.selling_price || 0)), 0);
  const inventoryItems = inventory.length;
  const lowStockItems = inventory.filter((i: any) => i.status === "Low Stock" || Number(i.remaining || 0) === 0).length;

  const ciTotalLots = companyInventory.length;
  const ciTotalValue = companyInventory.reduce((s, i) => s + (Number(i.remaining || 0) * Number(i.costPrice || i.cost_price || 0)), 0);
  const ciTotalRemaining = companyInventory.reduce((s, i) => s + Number(i.remaining || 0), 0);
  const ciTotalOriginal = companyInventory.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const ciLowStock = companyInventory.filter((i: any) => i.status === "Low Stock").length;
  const ciDepleted = companyInventory.filter((i: any) => i.status === "Depleted" || Number(i.remaining || 0) === 0).length;
  const ciUsagePct = ciTotalOriginal > 0 ? Math.round(((ciTotalOriginal - ciTotalRemaining) / ciTotalOriginal) * 100) : 0;
  const ciUniqueMaterials = new Set(companyInventory.map((i: any) => i.materialCode || i.material_code)).size;

  const ciByMaterial = useMemo(() => {
    const map: Record<string, { name: string; remaining: number; total: number; value: number }> = {};
    companyInventory.forEach((lot: any) => {
      const code = lot.materialCode || lot.material_code || "";
      const name = lot.materialName || lot.material_name || code;
      if (!map[code]) map[code] = { name, remaining: 0, total: 0, value: 0 };
      map[code].remaining += Number(lot.remaining || 0);
      map[code].total += Number(lot.quantity || 0);
      map[code].value += Number(lot.remaining || 0) * Number(lot.costPrice || lot.cost_price || 0);
    });
    return Object.entries(map).map(([code, v]) => ({
      code, name: v.name, remaining: v.remaining, total: v.total, value: v.value,
      usedPct: v.total > 0 ? Math.round(((v.total - v.remaining) / v.total) * 100) : 0,
    })).sort((a, b) => b.value - a.value);
  }, [companyInventory]);

  const ciStatusData = useMemo(() => {
    const inStock = companyInventory.filter(i => i.status === "In Stock").length;
    const low = ciLowStock;
    const depleted = ciDepleted;
    return [
      { name: "متوفر", value: inStock, color: "#22c55e" },
      { name: "منخفض", value: low, color: "#f59e0b" },
      { name: "نفد", value: depleted, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [companyInventory, ciLowStock, ciDepleted]);

  const criticalAlerts = alerts.filter((a: any) => a.severity === "critical").length;
  const warningAlerts = alerts.filter((a: any) => a.severity === "warning").length;

  const monthlyData = useMemo(() => {
    const map: Record<string, { revenue: number; cost: number; profit: number; orders: number }> = {};
    orders.forEach(o => {
      const m = (o.date || "").slice(0, 7);
      if (!m) return;
      if (!map[m]) map[m] = { revenue: 0, cost: 0, profit: 0, orders: 0 };
      map[m].revenue += toNum(o.totalSelling);
      map[m].cost += toNum(o.totalCost);
      map[m].profit += toNum(o.totalSelling) - toNum(o.totalCost);
      map[m].orders += 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([ym, vals]) => ({ month: ARABIC_MONTHS[ym.slice(5, 7)] || ym, ...vals }));
  }, [orders]);

  const orderStatusDist = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => { const s = o.status || "Draft"; map[s] = (map[s] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] || "#94a3b8" }));
  }, [orders]);

  const collectionPieData = useMemo(() => {
    let paid = 0, partial = 0, overdue = 0, pending = 0;
    collections.forEach(c => {
      if (c.status === "Paid") paid += c.paidAmount;
      else if (["Partially Paid", "Installment Active"].includes(c.status)) partial += c.paidAmount;
      else if (c.status === "Overdue") overdue += c.outstanding;
      else pending += c.totalAmount;
    });
    return [
      { name: "مكتمل", value: paid, color: "#22c55e" },
      { name: "جزئي", value: partial, color: "#f59e0b" },
      { name: "متأخر", value: overdue, color: "#ef4444" },
      { name: "معلق", value: pending, color: "#3b82f6" },
    ].filter(d => d.value > 0);
  }, [collections]);

  const topClients = useMemo(() => {
    const map: Record<string, { client: string; clientId: string; revenue: number; orders: number; profit: number }> = {};
    orders.forEach(o => {
      const cid = o.clientId || "";
      const name = o.client || cid;
      if (!map[cid]) map[cid] = { client: name, clientId: cid, revenue: 0, orders: 0, profit: 0 };
      map[cid].revenue += toNum(o.totalSelling);
      map[cid].profit += toNum(o.totalSelling) - toNum(o.totalCost);
      map[cid].orders += 1;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders]);

  const deliveryMonthly = useMemo(() => {
    const map: Record<string, { confirmed: number; pending: number }> = {};
    deliveries.forEach((d: any) => {
      const m = (d.date || d.created_at || "").slice(0, 7);
      if (!m) return;
      if (!map[m]) map[m] = { confirmed: 0, pending: 0 };
      if (d.status === "Delivered" || d.status === "مُسلَّم") map[m].confirmed += 1;
      else map[m].pending += 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
      .map(([ym, v]) => ({ month: ARABIC_MONTHS[ym.slice(5, 7)] || ym, ...v }));
  }, [deliveries]);

  const collectionTrend = useMemo(() => {
    const map: Record<string, { paid: number; outstanding: number }> = {};
    collections.forEach(c => {
      const m = (c.invoiceDate || "").slice(0, 7);
      if (!m) return;
      if (!map[m]) map[m] = { paid: 0, outstanding: 0 };
      map[m].paid += c.paidAmount;
      map[m].outstanding += c.outstanding;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
      .map(([ym, v]) => ({ month: ARABIC_MONTHS[ym.slice(5, 7)] || ym, ...v }));
  }, [collections]);

  const recentOrders = [...orders].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5);

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.9} />
        <Sector cx={cx} cy={cy} innerRadius={outerRadius + 10} outerRadius={outerRadius + 14} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      </g>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <WorkflowBanner />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">{t.dashboardTitle}</h1>
          <p className="page-description">{t.dashboardDesc}</p>
        </div>
        {(criticalAlerts > 0 || warningAlerts > 0) && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/alerts")}>
            <AlertTriangle className={`h-3.5 w-3.5 ${criticalAlerts > 0 ? "text-destructive" : "text-yellow-500"}`} />
            {criticalAlerts > 0 && <Badge className="bg-destructive text-destructive-foreground border-0 h-5 text-[10px]">{criticalAlerts} حرج</Badge>}
            {warningAlerts > 0 && <Badge className="bg-yellow-500/20 text-yellow-600 border-0 h-5 text-[10px]">{warningAlerts} تحذير</Badge>}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        <div className="cursor-pointer" onClick={() => navigate("/company-profit")}>
          <StatCard title="صافي الربح" value={profit !== 0 ? `${(profit / 1000).toFixed(0)}k` : "—"} change={`${profitMargin.toFixed(1)}% هامش`} changeType={profit >= 0 ? "positive" : "negative"} icon={TrendingUp} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/orders")}>
          <StatCard title="الإيرادات" value={`${(totalRevenue / 1000).toFixed(0)}k`} change={`${deliveredOrders.length} مسلّم`} changeType="positive" icon={Banknote} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/orders?status=active")}>
          <StatCard title="أوردرات نشطة" value={activeOrders} change={`${orders.length} إجمالي`} changeType="neutral" icon={ShoppingCart} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/clients?status=Active")}>
          <StatCard title="عملاء نشطين" value={activeClients} change={`${clients.length} إجمالي`} changeType="positive" icon={Users} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/deliveries")}>
          <StatCard title="التوصيلات" value={deliveries.length} change={`${confirmedDeliveries} مؤكدة`} changeType="positive" icon={Truck} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/collections")}>
          <StatCard title="التحصيل" value={`${(totalCollected / 1000).toFixed(0)}k`} change={totalOutstanding > 0 ? `${(totalOutstanding / 1000).toFixed(0)}k متبقي` : "مكتمل"} changeType={totalOutstanding > 0 ? "negative" : "positive"} icon={Wallet} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/inventory")}>
          <StatCard title="جرد العملاء" value={inventoryItems} change={lowStockItems > 0 ? `${lowStockItems} منخفض` : "مستقر"} changeType={lowStockItems > 0 ? "negative" : "positive"} icon={Package} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/company-inventory")}>
          <StatCard title="مخزون الشركة" value={ciTotalLots} change={ciDepleted > 0 ? `${ciDepleted} نفد` : ciLowStock > 0 ? `${ciLowStock} منخفض` : "مستقر"} changeType={ciDepleted > 0 || ciLowStock > 0 ? "negative" : "positive"} icon={Boxes} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/alerts")}>
          <StatCard title="التنبيهات" value={alerts.length} change={criticalAlerts > 0 ? `${criticalAlerts} حرج` : "لا يوجد حرج"} changeType={criticalAlerts > 0 ? "negative" : "positive"} icon={AlertTriangle} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">الأداء المالي الشهري</h3>
            <button className="text-xs text-primary hover:underline" onClick={() => navigate("/reports")}>تقارير مفصلة ←</button>
          </div>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={monthlyData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) => [`${Number(v).toLocaleString()} ${name === "عدد الأوردرات" ? "" : "ج.م"}`, name]} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" fill="url(#revGrad)" stroke="#3b82f6" strokeWidth={2} name="الإيرادات" />
                <Bar yAxisId="left" dataKey="cost" fill="#94a3b8" radius={[4, 4, 0, 0]} name="التكلفة" barSize={20} />
                <Line yAxisId="left" type="monotone" dataKey="profit" stroke="#94a3b8" strokeWidth={2.5} dot={(props: any) => { const c = props.payload.profit >= 0 ? "#22c55e" : "#ef4444"; return <circle key={props.key} cx={props.cx} cy={props.cy} r={4} fill={c} stroke={c} />; }} name="الربح" />
                <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: "#f59e0b", r: 3 }} name="عدد الأوردرات" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">لا توجد بيانات بعد</div>
          )}
        </div>

        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">توزيع حالات الأوردرات</h3>
          {orderStatusDist.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={orderStatusDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
                    activeIndex={activeSlice !== null ? activeSlice : undefined} activeShape={renderActiveShape}
                    onMouseEnter={(_, i) => setActiveSlice(i)} onClick={(_, i) => setActiveSlice(p => p === i ? null : i)}
                    className="cursor-pointer outline-none">
                    {orderStatusDist.map((e, i) => <Cell key={i} fill={e.color} opacity={activeSlice !== null && activeSlice !== i ? 0.4 : 1} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v} أوردر`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {orderStatusDist.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded px-2 py-1 transition-colors"
                    style={{ opacity: activeSlice !== null && activeSlice !== i ? 0.5 : 1 }}
                    onClick={() => setActiveSlice(p => p === i ? null : i)}>
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="flex-1">{s.name}</span>
                    <span className="font-semibold">{s.value}</span>
                    <span className="text-muted-foreground">({orders.length > 0 ? ((s.value / orders.length) * 100).toFixed(0) : 0}%)</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">لا توجد أوردرات</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">أداء التوصيلات</h3>
            <button className="text-xs text-primary hover:underline" onClick={() => navigate("/deliveries")}>عرض الكل ←</button>
          </div>
          {deliveryMonthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={deliveryMonthly}>
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
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              <div className="text-center"><Truck className="h-6 w-6 mx-auto mb-2 opacity-40" /><p>لا توجد توصيلات</p></div>
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs">
            <span className="text-muted-foreground">{deliveries.length} إجمالي</span>
            <span className="text-green-600">{confirmedDeliveries} مؤكدة</span>
            <span className="text-yellow-600">{pendingDeliveries} معلقة</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">حالة التحصيل</h3>
            <button className="text-xs text-primary hover:underline" onClick={() => navigate("/collections")}>عرض الكل ←</button>
          </div>
          {collectionPieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={collectionPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value">
                    {collectionPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) => [`${Number(v).toLocaleString()} ج.م`, name]} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs">
                <span className="text-green-600">محصّل: {(totalCollected / 1000).toFixed(0)}k</span>
                <span className="text-red-600">متبقي: {(totalOutstanding / 1000).toFixed(0)}k</span>
                <span className="text-muted-foreground">{collections.length} فاتورة</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              <div className="text-center"><Wallet className="h-6 w-6 mx-auto mb-2 opacity-40" /><p>لا توجد تحصيلات</p></div>
            </div>
          )}
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">ملخص جرد العملاء</h3>
            <button className="text-xs text-primary hover:underline" onClick={() => navigate("/inventory")}>عرض الكل ←</button>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-primary/5 p-3 text-center">
                <p className="text-2xl font-bold text-primary">{inventoryItems}</p>
                <p className="text-[11px] text-muted-foreground">دفعة</p>
              </div>
              <div className="rounded-lg bg-green-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{(inventoryValue / 1000).toFixed(0)}k</p>
                <p className="text-[11px] text-muted-foreground">قيمة المخزون</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-lg p-3 text-center ${lowStockItems > 0 ? "bg-destructive/5" : "bg-muted/50"}`}>
                <p className={`text-2xl font-bold ${lowStockItems > 0 ? "text-destructive" : "text-muted-foreground"}`}>{lowStockItems}</p>
                <p className="text-[11px] text-muted-foreground">مخزون منخفض</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold text-muted-foreground">{new Set(inventory.map((i: any) => i.material)).size}</p>
                <p className="text-[11px] text-muted-foreground">مادة مختلفة</p>
              </div>
            </div>
            {lowStockItems > 0 && (
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => navigate("/refill")}>
                <Target className="h-3.5 w-3.5" /> إعادة طلب المواد المنخفضة ({lowStockItems})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Company Inventory Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Boxes className="h-4 w-4 text-primary" /> مخزون الشركة — استهلاك المواد</h3>
            <button className="text-xs text-primary hover:underline" onClick={() => navigate("/company-inventory")}>عرض الكل ←</button>
          </div>
          {ciByMaterial.length > 0 ? (
            <div className="space-y-3">
              {ciByMaterial.slice(0, 8).map((mat) => (
                <div key={mat.code} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate max-w-[200px]">{mat.name}</span>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{mat.remaining} / {mat.total}</span>
                      <span className="font-mono font-medium">{mat.value.toLocaleString()} ج.م</span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${mat.usedPct >= 80 ? "bg-red-500" : mat.usedPct >= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${100 - mat.usedPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">لا توجد بيانات في المخزون</div>
          )}
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">ملخص مخزون الشركة</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-blue-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{ciTotalLots}</p>
                <p className="text-[11px] text-muted-foreground">دُفعة</p>
              </div>
              <div className="rounded-lg bg-emerald-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{ciTotalValue >= 1000 ? `${(ciTotalValue / 1000).toFixed(1)}k` : ciTotalValue.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground">القيمة المتبقية</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-purple-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-purple-600">{ciUniqueMaterials}</p>
                <p className="text-[11px] text-muted-foreground">مادة مختلفة</p>
              </div>
              <div className="rounded-lg bg-amber-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{ciUsagePct}%</p>
                <p className="text-[11px] text-muted-foreground">نسبة الاستهلاك</p>
              </div>
            </div>

            {ciStatusData.length > 0 && (
              <div className="pt-2">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={ciStatusData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                      {ciStatusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [`${v} دُفعة`, name]} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(v) => v} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {(ciLowStock > 0 || ciDepleted > 0) && (
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => navigate("/company-inventory")}>
                <Warehouse className="h-3.5 w-3.5" /> {ciDepleted > 0 ? `${ciDepleted} دُفعة نفدت` : `${ciLowStock} منخفض`} — مراجعة المخزون
              </Button>
            )}
          </div>
        </div>
      </div>

      {collectionTrend.length > 0 && (
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">التحصيل الشهري — المحصّل مقابل المتبقي</h3>
            <button className="text-xs text-primary hover:underline" onClick={() => navigate("/collections")}>عرض كل التحصيلات ←</button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={collectionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [`${v.toLocaleString()} ج.م`, name === "paid" ? "المحصّل" : "المتبقي"]} />
              <Legend formatter={(v) => v === "paid" ? "المحصّل" : "المتبقي"} wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="paid" fill="#22c55e" radius={[4, 4, 0, 0]} name="paid" />
              <Bar dataKey="outstanding" fill="#ef4444" radius={[4, 4, 0, 0]} name="outstanding" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">أعلى 5 عملاء — الإيرادات</h3>
            <button className="text-xs text-primary hover:underline" onClick={() => navigate("/reports")}>التقارير ←</button>
          </div>
          {topClients.length > 0 ? (
            <div className="space-y-3">
              {topClients.map((c, i) => {
                const maxRev = topClients[0]?.revenue || 1;
                const pct = (c.revenue / maxRev) * 100;
                return (
                  <div key={c.clientId} className="cursor-pointer hover:bg-muted/30 rounded-lg p-2 transition-colors" onClick={() => navigate(`/clients/${c.clientId}`)}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                        <span className="text-sm font-medium">{c.client}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-bold">{c.revenue.toLocaleString()}</span>
                        <span className="text-[10px] text-muted-foreground mr-1">ج.م</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                        <span>{c.orders} أوردر</span>
                        <span className={c.profit >= 0 ? "text-green-600" : "text-red-600"}>
                          {c.profit >= 0 ? <ArrowUpRight className="h-3 w-3 inline" /> : <ArrowDownRight className="h-3 w-3 inline" />}
                          {c.profit.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">لا توجد بيانات</div>
          )}
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">{t.recentOrders}</h3>
            <button className="text-xs text-primary hover:underline" onClick={() => navigate("/orders")}>كل الأوردرات ←</button>
          </div>
          <div className="space-y-2">
            {recentOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">لا توجد طلبات بعد</div>
            ) : recentOrders.map(order => (
              <div key={order.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:border-primary/30 cursor-pointer transition-colors" onClick={() => navigate(`/orders/${order.id}`)}>
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold font-mono">{order.id}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      STATUS_COLORS[order.status] ? "" : "bg-muted text-muted-foreground"
                    }`} style={{ backgroundColor: `${STATUS_COLORS[order.status] || "#94a3b8"}20`, color: STATUS_COLORS[order.status] || "#94a3b8" }}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{order.client} · {order.date}</p>
                </div>
                <span className="text-sm font-bold shrink-0">{toNum(order.totalSelling).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Clock, iconClass: "text-yellow-600", bgClass: "bg-yellow-500/10", title: `${pendingDeliveries} توصيلة معلقة`, sub: "بانتظار التسليم", href: "/deliveries?status=Pending" },
          { icon: AlertTriangle, iconClass: "text-destructive", bgClass: "bg-destructive/10", title: `${overdueCollections} فاتورة متأخرة`, sub: "يحتاج متابعة", href: "/collections?status=Overdue" },
          { icon: Package, iconClass: "text-primary", bgClass: "bg-primary/10", title: `${activeOrders} أوردر نشط`, sub: "قيد التنفيذ", href: "/orders?status=active" },
          { icon: Target, iconClass: "text-violet-600", bgClass: "bg-violet-500/10", title: `${criticalAlerts} تنبيه حرج`, sub: "يحتاج إجراء فوري", href: "/alerts" },
        ].map((card) => (
          <div key={card.href} className="stat-card flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors group" onClick={() => navigate(card.href)}>
            <div className={`h-10 w-10 rounded-lg ${card.bgClass} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
              <card.icon className={`h-5 w-5 ${card.iconClass}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{card.title}</p>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
