import { useState, useEffect } from "react";
import { Users, ShoppingCart, FileText, Receipt, TrendingUp, AlertTriangle, Clock, Package, CheckCircle2, Banknote } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Sector, Legend,
} from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { WorkflowBanner } from "@/components/WorkflowBanner";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

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

function toNum(v: string | number | undefined): number {
  if (!v) return 0;
  return typeof v === "number" ? v : Number(String(v).replace(/,/g, "")) || 0;
}

function mapCollection(raw: any): Collection {
  const clientId = raw.clientId || raw.client_id || "";
  return {
    id: raw.id,
    clientId,
    client: raw.client || raw.clientName || raw.client_name || clientId,
    invoiceDate: raw.invoiceDate || raw.invoice_date || raw.createdAt || "",
    status: raw.status || "Awaiting Confirmation",
    totalAmount: toNum(raw.totalAmount ?? raw.total_amount),
    paidAmount: toNum(raw.paidAmount ?? raw.paid_amount),
    outstanding: toNum(raw.outstanding),
  };
}

function buildRevenueData(orders: Order[]) {
  const map: Record<string, { revenue: number; cost: number }> = {};
  orders.forEach(o => {
    const m = (o.date || "").slice(0, 7);
    if (!m) return;
    if (!map[m]) map[m] = { revenue: 0, cost: 0 };
    map[m].revenue += toNum(o.totalSelling);
    map[m].cost += toNum(o.totalCost);
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([ym, vals]) => ({
      month: ARABIC_MONTHS[ym.slice(5, 7)] || ym,
      monthKey: ym,
      revenue: vals.revenue,
      cost: vals.cost,
    }));
}

function buildCollectionTrend(collections: Collection[]) {
  const map: Record<string, { paid: number; outstanding: number }> = {};
  collections.forEach(c => {
    const m = (c.invoiceDate || "").slice(0, 7);
    if (!m) return;
    if (!map[m]) map[m] = { paid: 0, outstanding: 0 };
    map[m].paid += c.paidAmount;
    map[m].outstanding += c.outstanding;
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([ym, vals]) => ({
      month: ARABIC_MONTHS[ym.slice(5, 7)] || ym,
      monthKey: ym,
      paid: vals.paid,
      outstanding: vals.outstanding,
    }));
}

function buildCollectionPieData(collections: Collection[], t: any) {
  let paidCount = 0, partialCount = 0, overdueCount = 0, pendingCount = 0;
  let paidAmt = 0, partialAmt = 0, overdueAmt = 0, pendingAmt = 0;
  const paidDetails: any[] = [], partialDetails: any[] = [], overdueDetails: any[] = [], pendingDetails: any[] = [];

  collections.forEach(c => {
    const s = c.status;
    const total = c.totalAmount;
    if (s === "Paid") {
      paidCount++; paidAmt += c.paidAmount;
      if (paidDetails.length < 3) paidDetails.push({ client: c.client, clientId: c.clientId, collection: c.id, amount: `${c.paidAmount.toLocaleString()} ج.م` });
    } else if (["Partially Paid", "Installment Active"].includes(s)) {
      partialCount++; partialAmt += c.paidAmount; 
      if (partialDetails.length < 3) partialDetails.push({ client: c.client, clientId: c.clientId, collection: c.id, amount: `${c.outstanding.toLocaleString()} ج.م متبقي` });
    } else if (s === "Overdue") {
      overdueCount++; overdueAmt += c.outstanding;
      if (overdueDetails.length < 3) overdueDetails.push({ client: c.client, clientId: c.clientId, collection: c.id, amount: `${c.outstanding.toLocaleString()} ج.م` });
    } else {
      pendingCount++; pendingAmt += total;
      if (pendingDetails.length < 3) pendingDetails.push({ client: c.client, clientId: c.clientId, collection: c.id, amount: `${total.toLocaleString()} ج.م` });
    }
  });

  const total = paidCount + partialCount + overdueCount + pendingCount || 1;
  const result = [
    { name: t.paid || "مكتمل", value: Math.round((paidCount / total) * 100), color: "hsl(152, 60%, 40%)", amount: `${paidAmt.toLocaleString()} ج.م`, count: paidCount, statusFilter: "Paid", details: paidDetails },
    { name: t.partial || "جزئي", value: Math.round((partialCount / total) * 100), color: "hsl(38, 92%, 50%)", amount: `${partialAmt.toLocaleString()} ج.م`, count: partialCount, statusFilter: "Partially Paid", details: partialDetails },
    { name: t.overdue || "متأخر", value: Math.round((overdueCount / total) * 100), color: "hsl(0, 72%, 51%)", amount: `${overdueAmt.toLocaleString()} ج.م`, count: overdueCount, statusFilter: "Overdue", details: overdueDetails },
    { name: "بانتظار التأكيد", value: Math.round((pendingCount / total) * 100), color: "hsl(220, 70%, 60%)", amount: `${pendingAmt.toLocaleString()} ج.م`, count: pendingCount, statusFilter: "Awaiting Confirmation", details: pendingDetails },
  ].filter(d => d.value > 0);
  return result;
}

export default function Dashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeSlice, setActiveSlice] = useState<number | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Client[]>("/clients"),
      api.get<Order[]>("/orders"),
      api.get<any[]>("/collections"),
    ]).then(([c, o, cols]) => {
      setClients(c || []);
      setOrders(o || []);
      setCollections((cols || []).map(mapCollection));
    }).finally(() => setLoading(false));
  }, []);

  const activeClients = clients.filter(c => c.status === "Active").length;
  const activeOrders = orders.filter(o => ["Draft", "Confirmed", "Ready for Delivery", "Awaiting Purchase"].includes(o.status)).length;

  // Collection stats from actual collections table
  const totalCollected = collections.reduce((s, c) => s + c.paidAmount, 0);
  const totalOutstanding = collections.reduce((s, c) => s + c.outstanding, 0);
  const overdueCollections = collections.filter(c => c.status === "Overdue").length;
  const collectionCount = collections.length;

  // Profit from orders (delivered)
  const totalRevenue = orders.filter(o => ["Delivered", "Closed"].includes(o.status)).reduce((s, o) => s + toNum(o.totalSelling), 0);
  const totalCostDelivered = orders.filter(o => ["Delivered", "Closed"].includes(o.status)).reduce((s, o) => s + toNum(o.totalCost), 0);
  const profit = totalRevenue - totalCostDelivered;

  const revenueData = buildRevenueData(orders);
  const collectionTrend = buildCollectionTrend(collections);
  const collectionPieData = buildCollectionPieData(collections, t);
  const recentOrders = [...orders].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5);

  const statusColors: Record<string, string> = {
    Delivered: "bg-success/10 text-success",
    Confirmed: "bg-info/10 text-info",
    Draft: "bg-muted text-muted-foreground",
    "Ready for Delivery": "bg-info/10 text-info",
    "Awaiting Purchase": "bg-warning/10 text-warning",
    "Partially Delivered": "bg-primary/10 text-primary",
    Invoiced: "bg-primary/10 text-primary",
    Closed: "bg-muted text-muted-foreground",
    Cancelled: "bg-destructive/10 text-destructive",
    Overdue: "bg-destructive/10 text-destructive",
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
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <WorkflowBanner />
      <div>
        <h1 className="page-header">{t.dashboardTitle}</h1>
        <p className="page-description">{t.dashboardDesc}</p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="cursor-pointer" onClick={() => navigate("/clients?status=Active")}>
          <StatCard title={t.activeClients} value={activeClients} change={`${clients.length} ${t.total || "إجمالي"}`} changeType="positive" icon={Users} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/orders?status=active")}>
          <StatCard title={t.activeOrders} value={activeOrders} change={`${orders.length} ${t.total || "إجمالي"}`} changeType="positive" icon={ShoppingCart} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/collections?status=Paid")}>
          <StatCard title="إجمالي المحصّل" value={`${Math.round(totalCollected / 1000)}ك`} change={`${collectionCount} تحصيل`} changeType="positive" icon={CheckCircle2} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/collections")}>
          <StatCard title="المتبقي للتحصيل" value={`${Math.round(totalOutstanding / 1000)}ك`} change={`ج.م ${totalOutstanding.toLocaleString()}`} changeType={totalOutstanding > 0 ? "negative" : "positive"} icon={Banknote} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/collections?status=Overdue")}>
          <StatCard title={t.overdueCollections} value={overdueCollections} change={overdueCollections > 0 ? "يحتاج متابعة" : "كل شيء منتظم"} changeType={overdueCollections > 0 ? "negative" : "positive"} icon={AlertTriangle} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/company-profit")}>
          <StatCard title={t.profitRealized} value={profit > 0 ? `${Math.round(profit / 1000)}ك` : "—"} change={`${totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0}% هامش`} changeType={profit > 0 ? "positive" : "neutral"} icon={TrendingUp} />
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Bar: Revenue vs Cost from orders */}
        <div className="stat-card lg:col-span-2">
          <h3 className="font-semibold text-sm mb-4">{t.revenueVsCost}</h3>
          {revenueData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">لا توجد طلبات محققة بعد</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueData} onClick={(data) => { if (data?.activeLabel) navigate(`/monthly-report?month=${encodeURIComponent(data.activeLabel)}`); }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} cursor={{ fill: "hsl(var(--muted) / 0.1)" }} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t.revenue} className="cursor-pointer" />
                <Bar dataKey="cost" fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} name={t.cost} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie: Collection status from actual collections */}
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">{t.collectionStatus}</h3>
          {collections.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">لا توجد تحصيلات بعد</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={collectionPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                    paddingAngle={4} dataKey="value"
                    activeIndex={activeSlice !== null ? activeSlice : undefined}
                    activeShape={renderActiveShape}
                    onMouseEnter={(_, index) => setActiveSlice(index)}
                    onClick={(_, index) => setActiveSlice(prev => prev === index ? null : index)}
                    className="cursor-pointer outline-none"
                  >
                    {collectionPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} opacity={activeSlice !== null && activeSlice !== index ? 0.4 : 1} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(val: any) => [`${val}%`]} />
                </PieChart>
              </ResponsiveContainer>

              {activeSlice !== null && collectionPieData[activeSlice] && (
                <div className="mx-auto max-w-[280px] rounded-lg border border-border p-3 mb-2 transition-all animate-fade-in" style={{ borderColor: collectionPieData[activeSlice].color }}>
                  <div className="text-center">
                    <div className="text-sm font-bold" style={{ color: collectionPieData[activeSlice].color }}>{collectionPieData[activeSlice].name}</div>
                    <div className="text-lg font-extrabold mt-0.5">{collectionPieData[activeSlice].value}%</div>
                    <div className="text-xs text-muted-foreground">{collectionPieData[activeSlice].amount} · {collectionPieData[activeSlice].count} تحصيل</div>
                  </div>
                  {collectionPieData[activeSlice].details.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border space-y-1.5">
                      {collectionPieData[activeSlice].details.map((d: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs gap-2">
                          <span className="font-medium text-primary cursor-pointer hover:underline truncate" onClick={() => navigate(`/clients/${d.clientId}`)}>{d.client}</span>
                          <span className="text-muted-foreground whitespace-nowrap">{d.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    className="w-full mt-2 text-xs font-semibold py-1.5 rounded-md transition-colors hover:opacity-80 text-white"
                    style={{ backgroundColor: collectionPieData[activeSlice].color }}
                    onClick={() => navigate(`/collections?status=${collectionPieData[activeSlice].statusFilter}`)}
                  >
                    عرض الكل ←
                  </button>
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {collectionPieData.map((item, idx) => (
                  <div key={item.name} className="flex items-center gap-1.5 text-xs cursor-pointer transition-opacity" style={{ opacity: activeSlice !== null && activeSlice !== idx ? 0.4 : 1 }} onClick={() => setActiveSlice(prev => prev === idx ? null : idx)}>
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name} ({item.value}%)</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Collections Trend Chart: Paid vs Outstanding per month ── */}
      {collectionTrend.length > 0 && (
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">التحصيل الشهري — المحصّل مقابل المتبقي</h3>
            <button className="text-xs text-primary hover:underline" onClick={() => navigate("/collections")}>عرض كل التحصيلات ←</button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={collectionTrend} onClick={(data) => { if (data?.activePayload) navigate("/collections"); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                cursor={{ fill: "hsl(var(--muted) / 0.1)" }}
                formatter={(val: number, name: string) => [`${val.toLocaleString()} ج.م`, name === "paid" ? "المحصّل" : "المتبقي"]}
              />
              <Legend formatter={(val) => val === "paid" ? "المحصّل" : "المتبقي"} />
              <Bar dataKey="paid" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} name="paid" className="cursor-pointer" onClick={() => navigate("/collections?status=Paid")} />
              <Bar dataKey="outstanding" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} name="outstanding" className="cursor-pointer" onClick={() => navigate("/collections")} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Recent Orders ── */}
      <div className="stat-card">
        <h3 className="font-semibold text-sm mb-4">{t.recentOrders}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.orderNumber}</th>
                <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
                <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.date}</th>
                <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.totalAmount}</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-muted-foreground text-sm">لا توجد طلبات بعد</td></tr>
              ) : recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                  <td className="py-2.5 px-3 font-medium">{order.id}</td>
                  <td className="py-2.5 px-3 cursor-pointer hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${order.clientId}`); }}>{order.client}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{order.date}</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || "bg-muted text-muted-foreground"}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-end font-medium">{toNum(order.totalSelling).toLocaleString()} {t.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Quick Action Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Clock, iconClass: "text-warning", bgClass: "bg-warning/10", title: `${orders.filter(o => ["Ready for Delivery", "Confirmed"].includes(o.status)).length} ${t.pendingDeliveries}`, sub: t.awaitingDelivery || "بانتظار التسليم", href: "/deliveries?status=Pending" },
          { icon: AlertTriangle, iconClass: "text-destructive", bgClass: "bg-destructive/10", title: `${overdueCollections} ${t.overdueCollections}`, sub: "يحتاج متابعة عاجلة", href: "/collections?status=Overdue" },
          { icon: Package, iconClass: "text-primary", bgClass: "bg-primary/10", title: `${activeOrders} ${t.activeOrders}`, sub: "قيد التنفيذ", href: "/orders?status=active" },
        ].map((card) => (
          <div key={card.href} className="stat-card flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors group" onClick={() => navigate(card.href)}>
            <div className={`h-10 w-10 rounded-lg ${card.bgClass} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
              <card.icon className={`h-5 w-5 ${card.iconClass}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{card.title}</p>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </div>
            <div className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors text-lg ltr:ml-auto rtl:mr-auto">›</div>
          </div>
        ))}
      </div>
    </div>
  );
}
