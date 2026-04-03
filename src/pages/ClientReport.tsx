import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/exportCsv";
import {
  Printer, ArrowRight, Package, TrendingDown, BarChart3, PieChart as PieChartIcon,
  ShoppingCart, Truck, ClipboardCheck, CalendarDays, DollarSign, Download,
  Receipt, RotateCcw, AlertTriangle, Loader2, CreditCard,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area, ComposedChart,
} from "recharts";

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#f59e0b", "#ec4899", "#14b8a6", "#6366f1"];
const MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const TOOLTIP_STYLE = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", direction: "rtl" as const };

function toMonthLabel(ym: string) {
  const m = parseInt(ym.slice(5));
  return MONTH_NAMES[m - 1] || ym.slice(5);
}

export default function ClientReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"full" | "monthly">("full");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<any[]>("/clients").catch(() => []),
      api.get<any[]>(`/client-inventory?clientId=${id}`).catch(() => []),
      api.get<any[]>("/orders").catch(() => []),
      api.get<any[]>("/deliveries").catch(() => []),
      api.get<any[]>("/audits").catch(() => []),
      api.get<any[]>("/collections").catch(() => []),
      api.get<any[]>("/returns").catch(() => []),
    ]).then(([cl, inv, ord, del, aud, col, ret]) => {
      const found = (cl || []).find((c: any) => c.id === id);
      if (found) {
        setClient({
          id: found.id, name: found.name || "", contact: found.contact || "",
          city: found.city || "", joinDate: found.joinDate || found.join_date || "",
          phone: found.phone || "",
        });
      }
      setInventory((inv || []).filter((i: any) => i.status !== "Expired" && i.status !== "Returned").map((r: any) => ({
        id: r.id, material: r.material || "", code: r.code || "", unit: r.unit || "unit",
        delivered: Number(r.delivered || 0), remaining: Number(r.remaining || 0),
        sellingPrice: Number(r.sellingPrice || r.selling_price || 0),
        avgWeeklyUsage: Number(r.avgWeeklyUsage || r.avg_weekly_usage || 0),
        deliveryDate: r.deliveryDate || r.delivery_date || "",
        sourceOrder: r.sourceOrder || r.source_order || "",
        status: r.status || "",
      })));
      setOrders((ord || []).filter((o: any) => (o.clientId || o.client_id) === id).map((o: any) => ({
        id: o.id, date: o.date || "", totalSelling: Number(o.totalSelling ?? o.total_selling ?? 0),
        status: o.status || "", lines: Number(o.lines || 0),
      })).sort((a: any, b: any) => b.date.localeCompare(a.date)));
      setDeliveries((del || []).filter((d: any) => (d.clientId || d.client_id) === id).map((d: any) => ({
        id: d.id, date: d.date || d.deliveryDate || d.delivery_date || "",
        status: d.status || "", items: Number(d.items || d.totalItems || d.total_items || 0),
      })).sort((a: any, b: any) => b.date.localeCompare(a.date)));
      setAudits((aud || []).filter((a: any) => (a.clientId || a.client_id) === id).sort((a: any, b: any) =>
        (b.date || b.createdAt || b.created_at || "").localeCompare(a.date || a.createdAt || a.created_at || "")
      ));
      setCollections((col || []).filter((c: any) => (c.clientId || c.client_id) === id).map((c: any) => ({
        id: c.id, date: c.date || c.invoiceDate || c.invoice_date || c.createdAt || "",
        totalAmount: Number(c.totalAmount ?? c.total_amount ?? c.amount ?? 0),
        paidAmount: Number(c.paidAmount ?? c.paid_amount ?? c.paid ?? 0),
        status: c.status || "",
      })));
      setReturns((ret || []).filter((r: any) => (r.clientId || r.client_id) === id).map((r: any) => ({
        id: r.id, date: r.date || r.createdAt || r.created_at || "",
        status: r.status || "",
        itemCount: Array.isArray(r.items) ? r.items.length : Number(r.itemsCount || r.items_count || 1),
      })));
    }).finally(() => setLoading(false));
  }, [id]);

  const aggregated = useMemo(() => {
    const map = new Map<string, { material: string; code: string; unit: string; totalDelivered: number; totalRemaining: number; totalConsumed: number; avgWeekly: number; sellingPrice: number; count: number }>();
    for (const item of inventory) {
      const key = item.code || item.material;
      const consumed = Math.max(0, item.delivered - item.remaining);
      const existing = map.get(key);
      if (existing) {
        existing.totalDelivered += item.delivered;
        existing.totalRemaining += item.remaining;
        existing.totalConsumed += consumed;
        existing.avgWeekly = Math.max(existing.avgWeekly, item.avgWeeklyUsage);
        if (item.sellingPrice > 0) existing.sellingPrice = item.sellingPrice;
        existing.count++;
      } else {
        map.set(key, {
          material: item.material, code: item.code, unit: item.unit,
          totalDelivered: item.delivered, totalRemaining: item.remaining,
          totalConsumed: consumed, avgWeekly: item.avgWeeklyUsage,
          sellingPrice: item.sellingPrice, count: 1,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.totalConsumed - a.totalConsumed);
  }, [inventory]);

  const stats = useMemo(() => {
    const totalDelivered = aggregated.reduce((s, i) => s + i.totalDelivered, 0);
    const totalRemaining = aggregated.reduce((s, i) => s + i.totalRemaining, 0);
    const totalConsumed = aggregated.reduce((s, i) => s + i.totalConsumed, 0);
    const consumptionRate = totalDelivered > 0 ? Math.round((totalConsumed / totalDelivered) * 100) : 0;
    const avgWeeklyTotal = aggregated.reduce((s, i) => s + i.avgWeekly, 0);
    const totalSellingValue = aggregated.reduce((s, i) => s + (i.sellingPrice * i.totalDelivered), 0);
    return { totalDelivered, totalRemaining, totalConsumed, consumptionRate, avgWeeklyTotal, materialCount: aggregated.length, totalSellingValue };
  }, [aggregated]);

  const collectionStats = useMemo(() => {
    const totalAmount = collections.reduce((s, c) => s + c.totalAmount, 0);
    const paidAmount = collections.reduce((s, c) => s + c.paidAmount, 0);
    return { total: collections.length, totalAmount, paidAmount, remaining: totalAmount - paidAmount };
  }, [collections]);

  const returnsStats = useMemo(() => {
    const total = returns.length;
    const totalItems = returns.reduce((s, r) => s + r.itemCount, 0);
    const accepted = returns.filter(r => r.status === "Accepted" || r.status === "مقبول").length;
    return { total, totalItems, accepted, pending: total - accepted };
  }, [returns]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; label: string; orders: number; value: number; deliveries: number; collections: number }> = {};
    for (const o of orders) {
      if (!o.date) continue;
      const ym = o.date.slice(0, 7);
      if (!map[ym]) map[ym] = { month: ym, label: toMonthLabel(ym), orders: 0, value: 0, deliveries: 0, collections: 0 };
      map[ym].orders++;
      map[ym].value += o.totalSelling;
    }
    for (const d of deliveries) {
      if (!d.date) continue;
      const ym = d.date.slice(0, 7);
      if (!map[ym]) map[ym] = { month: ym, label: toMonthLabel(ym), orders: 0, value: 0, deliveries: 0, collections: 0 };
      map[ym].deliveries++;
    }
    for (const c of collections) {
      if (!c.date) continue;
      const ym = c.date.slice(0, 7);
      if (!map[ym]) map[ym] = { month: ym, label: toMonthLabel(ym), orders: 0, value: 0, deliveries: 0, collections: 0 };
      map[ym].collections += c.paidAmount;
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12).map(m => ({ ...m, month: m.label }));
  }, [orders, deliveries, collections]);

  const orderStatusDist = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) {
      const s = o.status === "Delivered" ? "مُسلَّم" : o.status === "Processing" ? "قيد المعالجة" : o.status === "Draft" ? "مسودة" : o.status === "Confirmed" ? "مؤكد" : o.status === "Cancelled" ? "ملغي" : o.status === "Closed" ? "مغلق" : o.status;
      map[s] = (map[s] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const barData = aggregated.slice(0, 12).map(a => ({
    name: a.material.length > 18 ? a.material.slice(0, 18) + "…" : a.material,
    consumed: a.totalConsumed, remaining: a.totalRemaining,
  }));

  const pieData = aggregated.filter(a => a.totalConsumed > 0).slice(0, 8).map(a => ({
    name: a.material.length > 20 ? a.material.slice(0, 20) + "…" : a.material,
    value: a.totalConsumed,
  }));

  const coverageData = aggregated.filter(a => a.avgWeekly > 0).slice(0, 10).map(a => ({
    name: a.material.length > 18 ? a.material.slice(0, 18) + "…" : a.material,
    weeks: a.totalRemaining > 0 && a.avgWeekly > 0 ? Math.round((a.totalRemaining / a.avgWeekly) * 10) / 10 : 0,
  }));

  const lowStockItems = aggregated.filter(a => {
    if (a.avgWeekly <= 0) return false;
    const weeks = a.totalRemaining / a.avgWeekly;
    return weeks <= 4;
  }).sort((a, b) => (a.totalRemaining / (a.avgWeekly || 1)) - (b.totalRemaining / (b.avgWeekly || 1)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">العميل غير موجود</div>;
  }

  const reportDate = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const deliveredOrders = orders.filter(o => ["Delivered", "Closed", "Partially Delivered", "Completed"].includes(o.status));
  const totalOrderValue = deliveredOrders.reduce((s, o) => s + o.totalSelling, 0);
  const confirmedDeliveries = deliveries.filter(d => d.status === "Delivered" || d.status === "مُسلَّم");
  const lastAudit = audits.length > 0 ? audits[0] : null;
  const lastAuditDate = lastAudit ? (lastAudit.date || lastAudit.createdAt || lastAudit.created_at || "") : "";

  const handleExportCSV = () => {
    exportToCsv(`client_report_${client.name}`, [
      "المادة", "الكود", "الوحدة", "سعر البيع", "الكمية الموّردة", "المستهلك", "المتبقي", "معدل أسبوعي", "نسبة الاستهلاك"
    ], aggregated.map(item => {
      const rate = item.totalDelivered > 0 ? Math.round((item.totalConsumed / item.totalDelivered) * 100) : 0;
      return [item.material, item.code, item.unit, item.sellingPrice, item.totalDelivered, item.totalConsumed, item.totalRemaining, item.avgWeekly > 0 ? item.avgWeekly.toFixed(1) : "—", `${rate}%`];
    }));
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="print:hidden sticky top-0 z-10 bg-card border-b px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/clients/${id}`)} className="gap-2">
          <ArrowRight className="h-4 w-4" /> العودة للبروفايل
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="h-4 w-4" /> تصدير CSV
          </Button>
          <Button size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> طباعة
          </Button>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto p-8 print:p-4 print:max-w-none">
        <div className="text-center mb-6 border-b pb-5">
          <h1 className="text-2xl font-bold text-primary mb-1">DSB — Dental Smart Box</h1>
          <h2 className="text-xl font-semibold mb-2">تقرير شامل — {client.name}</h2>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            {client.city && <span>📍 {client.city}</span>}
            {client.joinDate && <span>📅 عميل منذ {new Date(client.joinDate).toLocaleDateString("ar-EG", { year: "numeric", month: "long" })}</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-2">تاريخ التقرير: {reportDate}</p>
        </div>

        <div className="print:hidden flex items-center gap-2 mb-6">
          <button onClick={() => setTab("full")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "full" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            تقرير شامل
          </button>
          <button onClick={() => setTab("monthly")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "monthly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            تقرير شهري
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatBox label="عدد المواد" value={stats.materialCount} icon={Package} color="bg-blue-500/10 text-blue-600" />
          <StatBox label="إجمالي الطلبات" value={orders.length} icon={ShoppingCart} color="bg-orange-500/10 text-orange-600" />
          <StatBox label="عمليات التوصيل" value={confirmedDeliveries.length} icon={Truck} color="bg-green-500/10 text-green-600" />
          <StatBox label="نسبة الاستهلاك" value={`${stats.consumptionRate}%`} icon={PieChartIcon} color="bg-purple-500/10 text-purple-600" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatBox label="الكمية الموّردة" value={stats.totalDelivered.toLocaleString()} icon={BarChart3} color="bg-teal-500/10 text-teal-600" />
          <StatBox label="المستهلك" value={stats.totalConsumed.toLocaleString()} icon={TrendingDown} color="bg-red-500/10 text-red-600" />
          <StatBox label="قيمة الطلبات" value={`${totalOrderValue.toLocaleString()} ج.م`} icon={DollarSign} color="bg-amber-500/10 text-amber-600" />
          <StatBox label="التحصيل" value={collectionStats.totalAmount > 0 ? `${Math.round((collectionStats.paidAmount / collectionStats.totalAmount) * 100)}%` : "—"} icon={CreditCard} color="bg-cyan-500/10 text-cyan-600" />
        </div>

        {lowStockItems.length > 0 && (
          <div className="mb-6 border border-amber-300 dark:border-amber-800 rounded-xl p-4 bg-amber-50/50 dark:bg-amber-950/20 print:break-inside-avoid">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" /> تنبيه — مواد تحتاج إعادة تعبئة
            </h3>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map((item, i) => {
                const weeks = item.totalRemaining / (item.avgWeekly || 1);
                return (
                  <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${weeks <= 2 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                    {item.material} — {weeks.toFixed(1)} أسبوع
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {lastAudit && (
          <div className="mb-6 border rounded-xl p-4 bg-card flex items-center gap-3 print:break-inside-avoid">
            <div className="h-9 w-9 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0">
              <ClipboardCheck className="h-4 w-4 text-pink-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">آخر عملية جرد</p>
              <p className="text-xs text-muted-foreground">
                {lastAuditDate ? new Date(lastAuditDate).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                {" · "}عدد الجردات: {audits.length}
                {" · "}الحالة: <span className={lastAudit.status === "Completed" ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>{lastAudit.status === "Completed" ? "مكتمل" : lastAudit.status === "In Progress" ? "قيد التنفيذ" : lastAudit.status}</span>
              </p>
            </div>
          </div>
        )}

        {collectionStats.total > 0 && (
          <div className="mb-6 border rounded-xl p-4 bg-card flex items-center gap-3 print:break-inside-avoid">
            <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
              <Receipt className="h-4 w-4 text-cyan-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">ملخص التحصيل</p>
                <span className={`text-xs font-medium ${collectionStats.remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                  {collectionStats.remaining > 0 ? `متبقي: ${collectionStats.remaining.toLocaleString()} ج.م` : "تم التحصيل بالكامل ✓"}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${collectionStats.totalAmount > 0 ? Math.min(100, (collectionStats.paidAmount / collectionStats.totalAmount) * 100) : 0}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">{collectionStats.paidAmount.toLocaleString()} / {collectionStats.totalAmount.toLocaleString()} ج.م</span>
              </div>
            </div>
          </div>
        )}

        {returnsStats.total > 0 && (
          <div className="mb-6 border rounded-xl p-4 bg-card flex items-center gap-3 print:break-inside-avoid">
            <div className="h-9 w-9 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
              <RotateCcw className="h-4 w-4 text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">المرتجعات</p>
              <p className="text-xs text-muted-foreground">
                {returnsStats.total} عملية مرتجع — {returnsStats.totalItems} عنصر — {returnsStats.accepted} مقبول، {returnsStats.pending} معلق
              </p>
            </div>
          </div>
        )}

        {tab === "monthly" && monthlyData.length > 0 && (
          <div className="mb-6 border rounded-xl p-5 bg-card print:break-inside-avoid">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" /> الملخص الشهري
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="py-2.5 px-3 text-start font-semibold">الشهر</th>
                    <th className="py-2.5 px-3 text-center font-semibold">الطلبات</th>
                    <th className="py-2.5 px-3 text-end font-semibold">قيمة الطلبات</th>
                    <th className="py-2.5 px-3 text-center font-semibold">التوصيلات</th>
                    <th className="py-2.5 px-3 text-end font-semibold">المحصّل</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((m, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium">{m.month}</td>
                      <td className="py-2 px-3 text-center">{m.orders}</td>
                      <td className="py-2 px-3 text-end">{m.value > 0 ? `${m.value.toLocaleString()} ج.م` : "—"}</td>
                      <td className="py-2 px-3 text-center">{m.deliveries}</td>
                      <td className="py-2 px-3 text-end">{m.collections > 0 ? `${m.collections.toLocaleString()} ج.م` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold border-t-2">
                    <td className="py-2.5 px-3">الإجمالي</td>
                    <td className="py-2.5 px-3 text-center">{orders.length}</td>
                    <td className="py-2.5 px-3 text-end">{totalOrderValue.toLocaleString()} ج.م</td>
                    <td className="py-2.5 px-3 text-center">{confirmedDeliveries.length}</td>
                    <td className="py-2.5 px-3 text-end">{collectionStats.paidAmount.toLocaleString()} ج.م</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {monthlyData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="border rounded-xl p-5 bg-card print:break-inside-avoid">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> حركة الطلبات والتوصيل الشهرية
              </h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: "10px" }} />
                    <Bar dataKey="orders" fill="#f97316" name="طلبات" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="deliveries" fill="#10b981" name="توصيلات" radius={[4, 4, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="border rounded-xl p-5 bg-card print:break-inside-avoid">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> قيمة الطلبات الشهرية
              </h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${Number(v).toLocaleString()} ج.م`, "القيمة"]} />
                    <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} fill="url(#valueGrad)" name="القيمة" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {orderStatusDist.length > 0 && (
            <div className="border rounded-xl p-5 bg-card print:break-inside-avoid">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" /> حالات الطلبات
              </h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={orderStatusDist} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 1 }} style={{ fontSize: "9px" }}>
                      {orderStatusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) => [`${v} طلب`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {collectionStats.totalAmount > 0 && (
            <div className="border rounded-xl p-5 bg-card print:break-inside-avoid">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" /> تقدم التحصيل
              </h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      { name: "محصّل", value: collectionStats.paidAmount },
                      { name: "متبقي", value: collectionStats.remaining },
                    ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 1 }} style={{ fontSize: "10px" }}>
                      <Cell fill="#22c55e" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${Number(v).toLocaleString()} ج.م`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {pieData.length > 0 && (
            <div className="border rounded-xl p-5 bg-card print:break-inside-avoid">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-primary" /> توزيع الاستهلاك
              </h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 1 }} style={{ fontSize: "9px" }}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v} وحدة`, "مستهلك"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {barData.length > 0 && (
          <div className="mb-6 border rounded-xl p-5 bg-card print:break-inside-avoid">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> الاستهلاك مقابل المتبقي — أعلى المواد
            </h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) => [v, name === "consumed" ? "مستهلك" : "متبقي"]} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  <Bar dataKey="consumed" fill="#f97316" name="مستهلك" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="remaining" fill="#3b82f6" name="متبقي" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {coverageData.length > 0 && (
          <div className="mb-6 border rounded-xl p-5 bg-card print:break-inside-avoid">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" /> تغطية المخزون (بالأسابيع)
            </h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={coverageData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v} أسبوع`, "التغطية"]} />
                  <Bar dataKey="weeks" fill="#10b981" name="أسابيع" radius={[0, 4, 4, 0]}>
                    {coverageData.map((entry, i) => (
                      <Cell key={i} fill={entry.weeks <= 2 ? "#ef4444" : entry.weeks <= 4 ? "#f59e0b" : "#10b981"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="border rounded-xl overflow-hidden bg-card mb-6 print:break-inside-avoid">
          <h3 className="text-sm font-semibold p-4 border-b flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> تفاصيل الاستهلاك لكل مادة
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="py-2.5 px-3 text-start font-semibold">#</th>
                  <th className="py-2.5 px-3 text-start font-semibold">المادة</th>
                  <th className="py-2.5 px-3 text-start font-semibold">الوحدة</th>
                  <th className="py-2.5 px-3 text-end font-semibold">سعر البيع</th>
                  <th className="py-2.5 px-3 text-end font-semibold">الكمية الموّردة</th>
                  <th className="py-2.5 px-3 text-end font-semibold">المستهلك</th>
                  <th className="py-2.5 px-3 text-end font-semibold">المتبقي</th>
                  <th className="py-2.5 px-3 text-end font-semibold">معدل أسبوعي</th>
                  <th className="py-2.5 px-3 text-end font-semibold">نسبة الاستهلاك</th>
                </tr>
              </thead>
              <tbody>
                {aggregated.map((item, idx) => {
                  const rate = item.totalDelivered > 0 ? Math.round((item.totalConsumed / item.totalDelivered) * 100) : 0;
                  return (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium">{item.material}<br/><span className="text-[10px] text-muted-foreground font-mono">{item.code}</span></td>
                      <td className="py-2 px-3">{item.unit}</td>
                      <td className="py-2 px-3 text-end">{item.sellingPrice > 0 ? `${item.sellingPrice.toLocaleString()} ج.م` : "—"}</td>
                      <td className="py-2 px-3 text-end">{item.totalDelivered}</td>
                      <td className="py-2 px-3 text-end font-medium text-orange-600">{item.totalConsumed}</td>
                      <td className="py-2 px-3 text-end text-blue-600">{item.totalRemaining}</td>
                      <td className="py-2 px-3 text-end">{item.avgWeekly > 0 ? item.avgWeekly.toFixed(1) : "—"}</td>
                      <td className="py-2 px-3 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${rate >= 80 ? "bg-red-500" : rate >= 50 ? "bg-orange-500" : "bg-green-500"}`} style={{ width: `${Math.min(100, rate)}%` }} />
                          </div>
                          <span className="text-[10px]">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {aggregated.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/30 font-semibold border-t-2">
                    <td colSpan={3} className="py-2.5 px-3">الإجمالي</td>
                    <td className="py-2.5 px-3 text-end">{stats.totalSellingValue > 0 ? `${stats.totalSellingValue.toLocaleString()} ج.م` : ""}</td>
                    <td className="py-2.5 px-3 text-end">{stats.totalDelivered}</td>
                    <td className="py-2.5 px-3 text-end text-orange-600">{stats.totalConsumed}</td>
                    <td className="py-2.5 px-3 text-end text-blue-600">{stats.totalRemaining}</td>
                    <td className="py-2.5 px-3 text-end">{stats.avgWeeklyTotal > 0 ? stats.avgWeeklyTotal.toFixed(1) : "—"}</td>
                    <td className="py-2.5 px-3 text-end">{stats.consumptionRate}%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {orders.length > 0 && (
          <div className="border rounded-xl overflow-hidden bg-card mb-6 print:break-inside-avoid">
            <h3 className="text-sm font-semibold p-4 border-b flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" /> سجل الطلبات (آخر 15)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="py-2.5 px-3 text-start font-semibold">رقم الطلب</th>
                    <th className="py-2.5 px-3 text-start font-semibold">التاريخ</th>
                    <th className="py-2.5 px-3 text-center font-semibold">المواد</th>
                    <th className="py-2.5 px-3 text-end font-semibold">القيمة</th>
                    <th className="py-2.5 px-3 text-start font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 15).map(o => (
                    <tr key={o.id} className="border-b border-border/50">
                      <td className="py-2 px-3 font-mono text-[10px]">{o.id}</td>
                      <td className="py-2 px-3">{o.date}</td>
                      <td className="py-2 px-3 text-center">{o.lines}</td>
                      <td className="py-2 px-3 text-end">{o.totalSelling > 0 ? `${o.totalSelling.toLocaleString()} ج.م` : "—"}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          ["Delivered", "Closed", "Completed"].includes(o.status) ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                          o.status === "Cancelled" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}>{o.status === "Delivered" ? "تم التسليم" : o.status === "Closed" ? "مغلق" : o.status === "Completed" ? "مكتمل" : o.status === "Processing" ? "قيد المعالجة" : o.status === "Draft" ? "مسودة" : o.status === "Confirmed" ? "مؤكد" : o.status === "Cancelled" ? "ملغي" : o.status === "Ready for Delivery" ? "جاهز للتسليم" : o.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {deliveries.length > 0 && (
          <div className="border rounded-xl overflow-hidden bg-card mb-6 print:break-inside-avoid">
            <h3 className="text-sm font-semibold p-4 border-b flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" /> سجل التوصيلات (آخر 10)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="py-2.5 px-3 text-start font-semibold">رقم التوصيل</th>
                    <th className="py-2.5 px-3 text-start font-semibold">التاريخ</th>
                    <th className="py-2.5 px-3 text-start font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.slice(0, 10).map(d => (
                    <tr key={d.id} className="border-b border-border/50">
                      <td className="py-2 px-3 font-mono text-[10px]">{d.id}</td>
                      <td className="py-2 px-3">{d.date}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          d.status === "Delivered" || d.status === "مُسلَّم" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}>{d.status === "Delivered" || d.status === "مُسلَّم" ? "تم التسليم" : d.status === "In Transit" ? "في الطريق" : d.status === "Scheduled" ? "مجدول" : d.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground border-t pt-4 print:mt-4">
          <p>تم إنشاء هذا التقرير بواسطة نظام DSB — Dental Smart Box</p>
          <p className="mt-1">{reportDate}</p>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="border rounded-xl p-3 bg-card print:break-inside-avoid">
      <div className={`h-7 w-7 rounded-lg ${color} flex items-center justify-center mb-1.5`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-base font-bold mt-0.5">{value}</p>
    </div>
  );
}
