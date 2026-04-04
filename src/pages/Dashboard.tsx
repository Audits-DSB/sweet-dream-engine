import { useState, useEffect, useMemo } from "react";
import {
  Users, ShoppingCart, TrendingUp, AlertTriangle, Clock, Package,
  Banknote, Truck, Wallet, ArrowUpRight, ArrowDownRight, Boxes,
  Target, Plus, RotateCcw, BarChart3, Percent,
  ChevronLeft, CircleDollarSign, Activity, Zap,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Sector, Legend, Line, Area, ComposedChart,
} from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { WorkflowFab } from "@/components/WorkflowBanner";
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

function mapCollection(raw: any): Collection & { dueDate: string } {
  const clientId = raw.clientId || raw.client_id || "";
  return {
    id: raw.id, clientId,
    client: raw.client || raw.clientName || raw.client_name || clientId,
    invoiceDate: raw.invoiceDate || raw.invoice_date || raw.createdAt || "",
    dueDate: raw.dueDate || raw.due_date || "",
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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء الخير";
  return "مساء الخير";
}

function SectionHeader({ icon: Icon, title, action, onAction }: { icon: any; title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h3>
      {action && onAction && (
        <button className="text-xs text-primary hover:underline flex items-center gap-1" onClick={onAction}>
          {action} <ChevronLeft className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

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
  const [returnsData, setReturnsData] = useState<any[]>([]);
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
      api.get<any[]>("/returns").catch(() => []),
    ]).then(([c, o, cols, del, inv, al, compInv, rets]) => {
      setClients(c || []);
      setOrders(o || []);
      setCollections((cols || []).map(mapCollection));
      setDeliveries(del || []);
      setInventory(inv || []);
      setAlerts(al || []);
      setCompanyInventory(compInv || []);
      setReturnsData(rets || []);
    }).finally(() => setLoading(false));
  }, []);

  const returnDeductions = useMemo(() => {
    const map: Record<string, { returnedSelling: number; returnedCost: number }> = {};
    returnsData.forEach((ret: any) => {
      if (ret.status !== "accepted") return;
      const oid = ret.orderId || ret.order_id;
      if (!oid) return;
      if (!map[oid]) map[oid] = { returnedSelling: 0, returnedCost: 0 };
      const items: any[] = ret.items || [];
      items.forEach((it: any) => {
        const qty = Number(it.quantity || 0);
        map[oid].returnedSelling += Number(it.sellingPrice || 0) * qty;
        map[oid].returnedCost += Number(it.costPrice || 0) * qty;
      });
    });
    return map;
  }, [returnsData]);

  const clientOrders = useMemo(() => orders.filter(o => o.clientId !== "company-inventory"), [orders]);
  const deliveredStatuses = ["Delivered", "Closed", "Completed", "مرتجع جزئي"];

  const activeClients = clients.filter(c => c.status === "Active").length;
  const activeOrders = orders.filter(o => ["Processing", "Draft", "Confirmed", "Ready for Delivery", "Awaiting Purchase"].includes(o.status)).length;
  const totalCollected = collections.reduce((s, c) => s + c.paidAmount, 0);
  const totalOutstanding = collections.reduce((s, c) => s + c.outstanding, 0);
  const overdueCollections = collections.filter(c => c.status === "Overdue").length;

  const deliveredOrders = orders.filter(o => deliveredStatuses.includes(o.status) && o.status !== "مرتجع كلي" && o.clientId !== "company-inventory");
  const totalRevenue = deliveredOrders.reduce((s, o) => {
    const ded = returnDeductions[o.id];
    return s + Math.max(toNum(o.totalSelling) - (ded?.returnedSelling || 0), 0);
  }, 0);
  const totalCostDelivered = deliveredOrders.reduce((s, o) => {
    const ded = returnDeductions[o.id];
    return s + Math.max(toNum(o.totalCost) - (ded?.returnedCost || 0), 0);
  }, 0);
  const profit = totalRevenue - totalCostDelivered;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const allOrdersSelling = clientOrders.reduce((s, o) => s + toNum(o.totalSelling), 0);
  const collectionRate = allOrdersSelling > 0 ? (totalCollected / allOrdersSelling) * 100 : 0;

  const confirmedDeliveries = deliveries.filter((d: any) => d.status === "Delivered" || d.status === "مُسلَّم").length;
  const pendingDeliveries = deliveries.length - confirmedDeliveries;

  const activeInventory = inventory.filter((i: any) => (i.status !== "Returned") && Number(i.remaining || 0) > 0);
  const inventoryValue = activeInventory.reduce((s, i) => s + (Number(i.remaining || 0) * Number(i.sellingPrice || i.selling_price || 0)), 0);
  const inventoryItems = activeInventory.length;
  const lowStockItems = activeInventory.filter((i: any) => i.status === "Low Stock").length;

  const ciTotalLots = companyInventory.length;
  const ciTotalValue = companyInventory.reduce((s, i) => s + (Number(i.remaining || 0) * Number(i.costPrice || i.cost_price || 0)), 0);
  const ciTotalRemaining = companyInventory.reduce((s, i) => s + Number(i.remaining || 0), 0);
  const ciTotalOriginal = companyInventory.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const ciLowStock = companyInventory.filter((i: any) => i.status === "Low Stock").length;
  const ciDepleted = companyInventory.filter((i: any) => i.status === "Depleted" || Number(i.remaining || 0) === 0).length;
  const ciUsagePct = ciTotalOriginal > 0 ? Math.round(((ciTotalOriginal - ciTotalRemaining) / ciTotalOriginal) * 100) : 0;
  const ciUniqueMaterials = new Set(companyInventory.map((i: any) => i.materialCode || i.material_code)).size;

  const criticalAlerts = alerts.filter((a: any) => a.severity === "critical").length;
  const warningAlerts = alerts.filter((a: any) => a.severity === "warning").length;

  const totalReturns = returnsData.length;
  const acceptedReturns = returnsData.filter((r: any) => r.status === "accepted").length;
  const pendingReturns = returnsData.filter((r: any) => r.status === "pending").length;

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
    return [
      { name: "متوفر", value: inStock, color: "#22c55e" },
      { name: "منخفض", value: ciLowStock, color: "#f59e0b" },
      { name: "نفد", value: ciDepleted, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [companyInventory, ciLowStock, ciDepleted]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { revenue: number; cost: number; profit: number; orders: number }> = {};
    orders.filter(o => o.clientId !== "company-inventory" && o.status !== "مرتجع كلي").forEach(o => {
      const m = (o.date || "").slice(0, 7);
      if (!m) return;
      if (!map[m]) map[m] = { revenue: 0, cost: 0, profit: 0, orders: 0 };
      map[m].orders += 1;
      if (deliveredStatuses.includes(o.status)) {
        const ded = returnDeductions[o.id];
        const rev = Math.max(toNum(o.totalSelling) - (ded?.returnedSelling || 0), 0);
        const cost = Math.max(toNum(o.totalCost) - (ded?.returnedCost || 0), 0);
        map[m].revenue += rev;
        map[m].cost += cost;
        map[m].profit += rev - cost;
      }
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([ym, vals]) => ({ month: ARABIC_MONTHS[ym.slice(5, 7)] || ym, ym, ...vals }));
  }, [orders, returnDeductions]);

  const orderStatusDist = useMemo(() => {
    const map: Record<string, number> = {};
    clientOrders.forEach(o => { const s = o.status || "Draft"; map[s] = (map[s] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] || "#94a3b8" }));
  }, [clientOrders]);

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
    orders.filter(o => o.clientId !== "company-inventory" && o.status !== "مرتجع كلي").forEach(o => {
      const cid = o.clientId || "";
      const name = o.client || cid;
      if (!map[cid]) map[cid] = { client: name, clientId: cid, revenue: 0, orders: 0, profit: 0 };
      map[cid].orders += 1;
      if (deliveredStatuses.includes(o.status)) {
        const ded = returnDeductions[o.id];
        const rev = Math.max(toNum(o.totalSelling) - (ded?.returnedSelling || 0), 0);
        const cost = Math.max(toNum(o.totalCost) - (ded?.returnedCost || 0), 0);
        map[cid].revenue += rev;
        map[cid].profit += rev - cost;
      }
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders, returnDeductions]);

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
      .map(([ym, v]) => ({ month: ARABIC_MONTHS[ym.slice(5, 7)] || ym, ym, ...v }));
  }, [collections]);

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
      .map(([ym, v]) => ({ month: ARABIC_MONTHS[ym.slice(5, 7)] || ym, ym, ...v }));
  }, [deliveries]);

  const recentOrders = [...orders].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5);

  const handleChartClick = (data: any) => {
    const ym = data?.activePayload?.[0]?.payload?.ym || data?.ym;
    if (ym) {
      const [y, m] = ym.split("-");
      navigate(`/monthly/${y}/${m}`);
    }
  };

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
      <WorkflowFab />

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{getGreeting()} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t.dashboardDesc}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => navigate("/orders/new")}>
            <Plus className="h-3.5 w-3.5" /> أوردر جديد
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => navigate("/clients")}>
            <Users className="h-3.5 w-3.5" /> العملاء
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => navigate("/reports")}>
            <BarChart3 className="h-3.5 w-3.5" /> التقارير
          </Button>
          {(criticalAlerts > 0 || warningAlerts > 0) && (
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs border-destructive/30" onClick={() => navigate("/alerts")}>
              <AlertTriangle className={`h-3.5 w-3.5 ${criticalAlerts > 0 ? "text-destructive" : "text-yellow-500"}`} />
              {criticalAlerts > 0 && <Badge className="bg-destructive text-destructive-foreground border-0 h-4 text-[10px] px-1.5">{criticalAlerts}</Badge>}
              {warningAlerts > 0 && <Badge className="bg-yellow-500/20 text-yellow-600 border-0 h-4 text-[10px] px-1.5">{warningAlerts}</Badge>}
            </Button>
          )}
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card cursor-pointer hover:shadow-md transition-shadow border-r-4 border-r-emerald-500" onClick={() => navigate("/company-profit")}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">صافي الربح</p>
              <p className="text-2xl font-bold">{profit !== 0 ? `${profit.toLocaleString()}` : "—"}</p>
              <p className={`text-xs mt-1 font-medium ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {profitMargin.toFixed(1)}% هامش ربح
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="stat-card cursor-pointer hover:shadow-md transition-shadow border-r-4 border-r-blue-500" onClick={() => navigate("/orders")}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">إجمالي المبيعات</p>
              <p className="text-2xl font-bold">{totalRevenue.toLocaleString()}</p>
              <p className="text-xs mt-1 text-muted-foreground">
                {deliveredOrders.length} أوردر مُسلَّم
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Banknote className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="stat-card cursor-pointer hover:shadow-md transition-shadow border-r-4 border-r-amber-500" onClick={() => navigate("/collections")}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">نسبة التحصيل</p>
              <p className="text-2xl font-bold">{collectionRate.toFixed(1)}%</p>
              <div className="w-full h-1.5 rounded-full bg-muted mt-2 overflow-hidden" style={{ width: "100px" }}>
                <div className={`h-full rounded-full transition-all ${collectionRate >= 70 ? "bg-emerald-500" : collectionRate >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(collectionRate, 100)}%` }} />
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Percent className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="stat-card cursor-pointer hover:shadow-md transition-shadow border-r-4 border-r-violet-500" onClick={() => navigate("/orders?status=active")}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">أوردرات نشطة</p>
              <p className="text-2xl font-bold">{activeOrders}</p>
              <p className="text-xs mt-1 text-muted-foreground">
                من {clientOrders.length} إجمالي
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-violet-600" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Quick Stats Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="stat-card flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => navigate("/clients?status=Active")}>
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-lg font-bold">{activeClients}</p>
            <p className="text-[11px] text-muted-foreground">عميل نشط</p>
          </div>
        </div>

        <div className="stat-card flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => navigate("/deliveries")}>
          <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
            <Truck className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <p className="text-lg font-bold">{confirmedDeliveries}<span className="text-xs text-muted-foreground font-normal">/{deliveries.length}</span></p>
            <p className="text-[11px] text-muted-foreground">توصيلة مؤكدة</p>
          </div>
        </div>

        <div className="stat-card flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => navigate("/collections")}>
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-bold">{totalCollected >= 1000 ? `${(totalCollected / 1000).toFixed(0)}k` : totalCollected.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">محصّل</p>
          </div>
        </div>

        <div className="stat-card flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => navigate("/returns")}>
          <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
            <RotateCcw className="h-4 w-4 text-orange-600" />
          </div>
          <div>
            <p className="text-lg font-bold">{totalReturns}</p>
            <p className="text-[11px] text-muted-foreground">{pendingReturns > 0 ? `${pendingReturns} بانتظار` : `${acceptedReturns} مقبول`}</p>
          </div>
        </div>

        <div className="stat-card flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => navigate("/inventory")}>
          <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
            <Package className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <p className="text-lg font-bold">{inventoryItems}</p>
            <p className="text-[11px] text-muted-foreground">{lowStockItems > 0 ? <span className="text-red-600">{lowStockItems} منخفض</span> : "جرد العملاء"}</p>
          </div>
        </div>

        <div className="stat-card flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => navigate("/company-inventory")}>
          <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
            <Boxes className="h-4 w-4 text-cyan-600" />
          </div>
          <div>
            <p className="text-lg font-bold">{ciTotalLots}</p>
            <p className="text-[11px] text-muted-foreground">{ciDepleted > 0 ? <span className="text-red-600">{ciDepleted} نفد</span> : "مخزون الشركة"}</p>
          </div>
        </div>
      </div>

      {/* ─── Today's Summary + Overdue Clients ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <SectionHeader icon={Zap} title={t.todaySummary} />
          <div className="grid grid-cols-3 gap-3">
            {(() => {
              const today = new Date().toISOString().slice(0, 10);
              const todayOrders = orders.filter(o => o.date === today && o.clientId !== "company-inventory").length;
              const dueCols = collections.filter(c => {
                const dd = (c as any).dueDate || "";
                return dd && dd <= today && c.status !== "Paid" && c.outstanding > 0;
              }).length;
              const lowStockAll = [...inventory.filter(i => i.status === "Low Stock"), ...companyInventory.filter(i => i.status === "Low Stock" || Number(i.remaining || 0) === 0)].length;
              return (
                <>
                  <div className="rounded-xl bg-blue-500/10 p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{todayOrders}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{t.todayOrders}</p>
                  </div>
                  <div className="rounded-xl bg-amber-500/10 p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">{dueCols}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{t.dueTodayCollections}</p>
                  </div>
                  <div className="rounded-xl bg-red-500/10 p-4 text-center">
                    <p className="text-2xl font-bold text-red-600">{lowStockAll}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{t.lowStockAlerts}</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="stat-card">
          <SectionHeader icon={AlertTriangle} title={t.overdueClients} action={t.viewAll} onAction={() => navigate("/collections?status=Overdue")} />
          {(() => {
            const overdue = collections
              .filter(c => c.status === "Overdue" && c.outstanding > 0)
              .reduce((acc, c) => {
                const existing = acc.find(x => x.clientId === c.clientId);
                if (existing) { existing.amount += c.outstanding; }
                else { acc.push({ clientId: c.clientId, client: c.client, amount: c.outstanding }); }
                return acc;
              }, [] as { clientId: string; client: string; amount: number }[])
              .sort((a, b) => b.amount - a.amount)
              .slice(0, 5);
            if (overdue.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">{t.noOverdue}</p>;
            return (
              <div className="space-y-2">
                {overdue.map((o, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent/30 cursor-pointer transition-colors" onClick={() => navigate(`/clients/${o.clientId}`)}>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-red-500/10 flex items-center justify-center text-xs font-bold text-red-600">{i + 1}</div>
                      <span className="text-sm font-medium">{o.client}</span>
                    </div>
                    <span className="text-sm font-bold text-red-600">{o.amount.toLocaleString()} {t.currency}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ─── Financial Chart + Order Status ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card lg:col-span-2">
          <SectionHeader icon={Activity} title="الأداء المالي الشهري" action="تقارير مفصلة" onAction={() => navigate("/reports")} />
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={monthlyData} onClick={handleChartClick} className="cursor-pointer">
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
          <SectionHeader icon={CircleDollarSign} title="توزيع حالات الأوردرات" />
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
                    <span className="text-muted-foreground">({clientOrders.length > 0 ? ((s.value / clientOrders.length) * 100).toFixed(0) : 0}%)</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">لا توجد أوردرات</div>
          )}
        </div>
      </div>

      {/* ─── Deliveries + Collection + Inventory Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card">
          <SectionHeader icon={Truck} title="أداء التوصيلات" action="عرض الكل" onAction={() => navigate("/deliveries")} />
          {deliveryMonthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={deliveryMonthly} onClick={handleChartClick} className="cursor-pointer">
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
          <SectionHeader icon={Wallet} title="حالة التحصيل" action="عرض الكل" onAction={() => navigate("/collections")} />
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
                <span className="text-green-600">محصّل: {totalCollected.toLocaleString()}</span>
                <span className="text-red-600">متبقي: {totalOutstanding.toLocaleString()}</span>
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
          <SectionHeader icon={Package} title="ملخص المخزون" />
          <div className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">جرد العملاء</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold">{inventoryItems}</p>
                <p className="text-xs text-muted-foreground">دفعة</p>
                <p className="text-xs text-muted-foreground ms-auto">{inventoryValue >= 1000 ? `${(inventoryValue / 1000).toFixed(0)}k` : inventoryValue.toLocaleString()} ج.م</p>
              </div>
              {lowStockItems > 0 && <p className="text-[11px] text-red-600 mt-1">{lowStockItems} مادة منخفضة المخزون</p>}
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">مخزون الشركة</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold">{ciTotalLots}</p>
                <p className="text-xs text-muted-foreground">دفعة</p>
                <p className="text-xs text-muted-foreground ms-auto">{ciTotalValue >= 1000 ? `${(ciTotalValue / 1000).toFixed(0)}k` : ciTotalValue.toLocaleString()} ج.م</p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${ciUsagePct >= 80 ? "bg-red-500" : ciUsagePct >= 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${100 - ciUsagePct}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground">{ciUsagePct}% مُستهلك</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-blue-500/5 py-2">
                <p className="text-sm font-bold text-blue-600">{ciUniqueMaterials}</p>
                <p className="text-[10px] text-muted-foreground">مادة</p>
              </div>
              <div className="rounded-lg bg-amber-500/5 py-2">
                <p className="text-sm font-bold text-amber-600">{ciLowStock}</p>
                <p className="text-[10px] text-muted-foreground">منخفض</p>
              </div>
              <div className="rounded-lg bg-red-500/5 py-2">
                <p className="text-sm font-bold text-red-600">{ciDepleted}</p>
                <p className="text-[10px] text-muted-foreground">نفد</p>
              </div>
            </div>

            {ciStatusData.length > 0 && (
              <ResponsiveContainer width="100%" height={100}>
                <PieChart>
                  <Pie data={ciStatusData} cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={3} dataKey="value">
                    {ciStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [`${v} دُفعة`, name]} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}

            {lowStockItems > 0 && (
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => navigate("/refill")}>
                <Target className="h-3.5 w-3.5" /> إعادة طلب المواد المنخفضة ({lowStockItems})
              </Button>
            )}
            {(ciLowStock > 0 || ciDepleted > 0) && (
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => navigate("/company-inventory")}>
                <Boxes className="h-3.5 w-3.5" /> {ciDepleted > 0 ? `${ciDepleted} دُفعة نفدت` : `${ciLowStock} منخفض`} — مراجعة المخزون
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Monthly Collections Trend ─── */}
      {collectionTrend.length > 0 && (
        <div className="stat-card">
          <SectionHeader icon={BarChart3} title="التحصيل الشهري — المحصّل مقابل المتبقي" action="عرض كل التحصيلات" onAction={() => navigate("/collections")} />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={collectionTrend} onClick={handleChartClick} className="cursor-pointer">
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

      {/* ─── Company Inventory Materials ─── */}
      {ciByMaterial.length > 0 && (
        <div className="stat-card">
          <SectionHeader icon={Boxes} title="مخزون الشركة — استهلاك المواد" action="عرض الكل" onAction={() => navigate("/company-inventory")} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            {ciByMaterial.slice(0, 8).map((mat) => (
              <div key={mat.code}>
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
        </div>
      )}

      {/* ─── Top Clients + Recent Orders ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <SectionHeader icon={Users} title="أعلى 5 عملاء — الإيرادات" action="التقارير" onAction={() => navigate("/reports")} />
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
                        <span className="text-[10px] text-muted-foreground me-1">ج.م</span>
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
          <SectionHeader icon={Clock} title={t.recentOrders} action="كل الأوردرات" onAction={() => navigate("/orders")} />
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">لا توجد طلبات بعد</div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map(order => (
                <div key={order.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:border-primary/30 cursor-pointer transition-colors" onClick={() => navigate(`/orders/${order.id}`)}>
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold font-mono">{order.id}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${STATUS_COLORS[order.status] || "#94a3b8"}20`, color: STATUS_COLORS[order.status] || "#94a3b8" }}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{order.client} · {order.date}</p>
                  </div>
                  <span className="text-sm font-bold shrink-0">{toNum(order.totalSelling).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Monthly Snapshot ─── */}
      <div className="stat-card">
        <SectionHeader icon={Target} title={t.monthlySnapshot} />
        <div className="flex flex-wrap items-center gap-3">
          {(() => {
            const now = new Date();
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const ym = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
            const lmOrders = orders.filter(o => o.date?.startsWith(ym) && o.clientId !== "company-inventory");
            const lmRevenue = lmOrders.filter(o => ["Delivered", "Closed", "Completed"].includes(o.status)).reduce((s, o) => s + toNum(o.totalSelling), 0);
            const lmCost = lmOrders.filter(o => ["Delivered", "Closed", "Completed"].includes(o.status)).reduce((s, o) => s + toNum(o.totalCost), 0);
            const lmNewClients = clients.filter(c => (c as any).joinDate?.startsWith(ym) || (c as any).join_date?.startsWith(ym)).length;
            const lmCols = collections.filter(c => c.invoiceDate?.startsWith(ym));
            const lmTotalAmt = lmCols.reduce((s, c) => s + c.totalAmount, 0);
            const lmPaid = lmCols.reduce((s, c) => s + c.paidAmount, 0);
            const lmRate = lmTotalAmt > 0 ? (lmPaid / lmTotalAmt) * 100 : 0;
            const lmProfit = lmRevenue - lmCost;
            const monthLabel = ARABIC_MONTHS[ym.slice(5)] || ym;
            return (
              <>
                <span className="text-sm font-medium text-muted-foreground">{monthLabel} {ym.slice(0, 4)}</span>
                <span className="text-xs bg-muted px-2 py-1 rounded">{t.snapshotRevenue}: {lmRevenue.toLocaleString()}</span>
                <span className="text-xs bg-muted px-2 py-1 rounded">{t.snapshotProfit}: {lmProfit.toLocaleString()}</span>
                <span className="text-xs bg-muted px-2 py-1 rounded">{t.snapshotOrders}: {lmOrders.length}</span>
                <span className="text-xs bg-muted px-2 py-1 rounded">{t.snapshotNewClients}: {lmNewClients}</span>
                <span className="text-xs bg-muted px-2 py-1 rounded">{t.snapshotCollectionRate}: {lmRate.toFixed(1)}%</span>
                <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={async () => {
                  try {
                    await (await import("@/lib/api")).api.post("/monthly-snapshots", {
                      month: ym, revenue: lmRevenue, profit: lmProfit, orders_count: lmOrders.length,
                      new_clients: lmNewClients, collection_rate: Math.round(lmRate * 10) / 10,
                      total_collected: lmPaid, total_outstanding: lmTotalAmt - lmPaid,
                    });
                    const { toast } = await import("sonner");
                    toast.success(t.snapshotSaved);
                  } catch { }
                }}>
                  {t.generateSnapshot}
                </Button>
              </>
            );
          })()}
        </div>
      </div>

      {/* ─── Action Alerts ─── */}
      {(pendingDeliveries > 0 || overdueCollections > 0 || criticalAlerts > 0 || pendingReturns > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            pendingDeliveries > 0 && { icon: Clock, iconClass: "text-yellow-600", bgClass: "bg-yellow-500/10", title: `${pendingDeliveries} توصيلة معلقة`, sub: "بانتظار التسليم", href: "/deliveries?status=Pending" },
            overdueCollections > 0 && { icon: AlertTriangle, iconClass: "text-destructive", bgClass: "bg-destructive/10", title: `${overdueCollections} فاتورة متأخرة`, sub: "يحتاج متابعة", href: "/collections?status=Overdue" },
            pendingReturns > 0 && { icon: RotateCcw, iconClass: "text-orange-600", bgClass: "bg-orange-500/10", title: `${pendingReturns} مرتجع بانتظار`, sub: "يحتاج مراجعة", href: "/returns" },
            criticalAlerts > 0 && { icon: Zap, iconClass: "text-destructive", bgClass: "bg-destructive/10", title: `${criticalAlerts} تنبيه حرج`, sub: "يحتاج إجراء فوري", href: "/alerts" },
          ].filter(Boolean).map((card: any) => (
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
      )}
    </div>
  );
}
