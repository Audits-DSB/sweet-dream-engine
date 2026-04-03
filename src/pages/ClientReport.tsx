import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Printer, ArrowRight, Package, TrendingDown, BarChart3, PieChart as PieChartIcon,
  ShoppingCart, Truck, ClipboardCheck, CalendarDays, DollarSign
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

type InventoryItem = {
  id: string;
  material: string;
  code: string;
  unit: string;
  delivered: number;
  remaining: number;
  sellingPrice: number;
  avgWeeklyUsage: number;
  deliveryDate: string;
  sourceOrder: string;
  status: string;
  imageUrl: string;
};

type ClientInfo = {
  id: string;
  name: string;
  contact: string;
  city: string;
  joinDate: string;
};

type OrderInfo = {
  id: string;
  date: string;
  totalSelling: number;
  status: string;
  lines: number;
};

type DeliveryInfo = {
  id: string;
  date: string;
  status: string;
  items: number;
};

type AuditInfo = {
  id: string;
  date: string;
  status: string;
};

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#f59e0b", "#ec4899", "#14b8a6", "#6366f1"];

export default function ClientReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryInfo[]>([]);
  const [lastAudit, setLastAudit] = useState<AuditInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<any[]>("/clients"),
      api.get<any[]>(`/client-inventory?clientId=${id}`).catch(() => []),
      api.get<any[]>("/orders").catch(() => []),
      api.get<any[]>("/deliveries").catch(() => []),
      api.get<any[]>("/audits").catch(() => []),
    ]).then(([clientsData, invData, ordersData, deliveriesData, auditsData]) => {
      const found = (clientsData || []).find((c: any) => c.id === id);
      if (found) {
        setClient({
          id: found.id, name: found.name || "", contact: found.contact || "",
          city: found.city || "", joinDate: found.joinDate || found.join_date || "",
        });
      }
      setInventory((invData || []).filter((i: any) => i.status !== "Expired" && i.status !== "Returned").map((r: any) => ({
        id: r.id,
        material: r.material || "",
        code: r.code || "",
        unit: r.unit || "unit",
        delivered: Number(r.delivered || 0),
        remaining: Number(r.remaining || 0),
        sellingPrice: Number(r.sellingPrice || r.selling_price || 0),
        avgWeeklyUsage: Number(r.avgWeeklyUsage || r.avg_weekly_usage || 0),
        deliveryDate: r.deliveryDate || r.delivery_date || "",
        sourceOrder: r.sourceOrder || r.source_order || "",
        status: r.status || "",
        imageUrl: r.imageUrl || r.image_url || "",
      })));
      const clientOrders = (ordersData || [])
        .filter((o: any) => (o.clientId || o.client_id) === id)
        .map((o: any) => ({
          id: o.id,
          date: o.date || "",
          totalSelling: Number(o.totalSelling ?? o.total_selling ?? 0),
          status: o.status || "",
          lines: Number(o.lines || 0),
        }))
        .sort((a: OrderInfo, b: OrderInfo) => b.date.localeCompare(a.date));
      setOrders(clientOrders);
      const clientDeliveries = (deliveriesData || [])
        .filter((d: any) => (d.clientId || d.client_id) === id)
        .map((d: any) => ({
          id: d.id,
          date: d.date || d.deliveryDate || d.delivery_date || "",
          status: d.status || "",
          items: Number(d.items || d.totalItems || d.total_items || 0),
        }))
        .sort((a: DeliveryInfo, b: DeliveryInfo) => b.date.localeCompare(a.date));
      setDeliveries(clientDeliveries);
      const clientAudits = (auditsData || [])
        .filter((a: any) => (a.clientId || a.client_id) === id)
        .sort((a: any, b: any) => ((b.date || b.createdAt || b.created_at || "").localeCompare(a.date || a.createdAt || a.created_at || "")));
      if (clientAudits.length > 0) {
        const a = clientAudits[0];
        setLastAudit({
          id: a.id,
          date: a.date || a.createdAt || a.created_at || "",
          status: a.status || "",
        });
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const aggregated = useMemo(() => {
    const map = new Map<string, { material: string; code: string; unit: string; totalDelivered: number; totalRemaining: number; totalConsumed: number; avgWeekly: number; sellingPrice: number; count: number }>();
    for (const item of inventory) {
      const key = item.code || item.material;
      const existing = map.get(key);
      const consumed = Math.max(0, item.delivered - item.remaining);
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

  const monthlyOrderData = useMemo(() => {
    const months: Record<string, { orders: number; value: number; deliveries: number }> = {};
    for (const o of orders) {
      if (!o.date) continue;
      const key = o.date.slice(0, 7);
      if (!months[key]) months[key] = { orders: 0, value: 0, deliveries: 0 };
      months[key].orders++;
      months[key].value += o.totalSelling;
    }
    for (const d of deliveries) {
      if (!d.date) continue;
      const key = d.date.slice(0, 7);
      if (!months[key]) months[key] = { orders: 0, value: 0, deliveries: 0 };
      months[key].deliveries++;
    }
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => {
        const [y, m] = month.split("-");
        const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
        return { name: monthNames[parseInt(m) - 1] || m, orders: data.orders, value: data.value, deliveries: data.deliveries };
      });
  }, [orders, deliveries]);

  const barData = aggregated.slice(0, 12).map(a => ({
    name: a.material.length > 18 ? a.material.slice(0, 18) + "…" : a.material,
    consumed: a.totalConsumed,
    remaining: a.totalRemaining,
  }));

  const pieData = aggregated.filter(a => a.totalConsumed > 0).slice(0, 8).map(a => ({
    name: a.material.length > 20 ? a.material.slice(0, 20) + "…" : a.material,
    value: a.totalConsumed,
  }));

  const coverageData = aggregated.filter(a => a.avgWeekly > 0).slice(0, 10).map(a => ({
    name: a.material.length > 18 ? a.material.slice(0, 18) + "…" : a.material,
    weeks: a.totalRemaining > 0 && a.avgWeekly > 0 ? Math.round((a.totalRemaining / a.avgWeekly) * 10) / 10 : 0,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">العميل غير موجود</div>
    );
  }

  const reportDate = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const deliveredOrders = orders.filter(o => ["Delivered", "Closed", "Partially Delivered"].includes(o.status));
  const totalOrderValue = deliveredOrders.reduce((s, o) => s + o.totalSelling, 0);
  const confirmedDeliveries = deliveries.filter(d => d.status === "Delivered");

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="print:hidden sticky top-0 z-10 bg-card border-b px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/clients/${id}`)} className="gap-2">
          <ArrowRight className="h-4 w-4" />
          العودة للبروفايل
        </Button>
        <Button size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />
          طباعة التقرير
        </Button>
      </div>

      <div className="max-w-[900px] mx-auto p-8 print:p-4 print:max-w-none">
        <div className="text-center mb-8 border-b pb-6">
          <h1 className="text-2xl font-bold text-primary mb-1">DSB — Dental Smart Box</h1>
          <h2 className="text-xl font-semibold mb-2">تقرير استهلاك العميل</h2>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="font-medium text-foreground text-lg">{client.name}</span>
            {client.city && <span>📍 {client.city}</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-2">تاريخ التقرير: {reportDate}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatBox label="عدد المواد" value={stats.materialCount} icon={Package} color="bg-blue-500/10 text-blue-600" />
          <StatBox label="إجمالي الطلبات" value={orders.length} icon={ShoppingCart} color="bg-orange-500/10 text-orange-600" />
          <StatBox label="عمليات التوصيل" value={confirmedDeliveries.length} icon={Truck} color="bg-green-500/10 text-green-600" />
          <StatBox label="نسبة الاستهلاك" value={`${stats.consumptionRate}%`} icon={PieChartIcon} color="bg-purple-500/10 text-purple-600" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatBox label="إجمالي الكميات الموّردة" value={stats.totalDelivered.toLocaleString()} icon={BarChart3} color="bg-teal-500/10 text-teal-600" />
          <StatBox label="إجمالي المستهلك" value={stats.totalConsumed.toLocaleString()} icon={TrendingDown} color="bg-red-500/10 text-red-600" />
          <StatBox label="إجمالي قيمة الطلبات" value={`${totalOrderValue.toLocaleString()} ج.م`} icon={DollarSign} color="bg-amber-500/10 text-amber-600" />
          <StatBox label="معدل الاستهلاك الأسبوعي" value={stats.avgWeeklyTotal > 0 ? stats.avgWeeklyTotal.toFixed(1) : "—"} icon={CalendarDays} color="bg-indigo-500/10 text-indigo-600" />
        </div>

        {lastAudit && (
          <div className="mb-6 border rounded-xl p-4 bg-card flex items-center gap-3 print:break-inside-avoid">
            <div className="h-9 w-9 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0">
              <ClipboardCheck className="h-4 w-4 text-pink-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">آخر عملية جرد</p>
              <p className="text-xs text-muted-foreground">
                التاريخ: {lastAudit.date ? new Date(lastAudit.date).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }) : "—"} 
                {" · "}الحالة: <span className={lastAudit.status === "Completed" ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>{lastAudit.status === "Completed" ? "مكتمل" : lastAudit.status === "In Progress" ? "قيد التنفيذ" : lastAudit.status}</span>
              </p>
            </div>
          </div>
        )}

        {monthlyOrderData.length > 0 && (
          <div className="mb-8 border rounded-xl p-5 bg-card print:break-inside-avoid">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              حركة الطلبات والتوصيل الشهرية
            </h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyOrderData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} />
                  <Bar dataKey="orders" fill="#f97316" name="طلبات" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="deliveries" fill="#10b981" name="توصيلات" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {monthlyOrderData.length > 0 && (
          <div className="mb-8 border rounded-xl p-5 bg-card print:break-inside-avoid">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              قيمة الطلبات الشهرية (سعر البيع)
            </h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyOrderData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} formatter={(value: number) => [`${value.toLocaleString()} ج.م`, "القيمة"]} />
                  <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} name="القيمة" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {barData.length > 0 && (
          <div className="mb-8 border rounded-xl p-5 bg-card print:break-inside-avoid">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              الاستهلاك مقابل المتبقي — أعلى المواد
            </h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} formatter={(value: number, name: string) => [value, name === "consumed" ? "مستهلك" : "متبقي"]} />
                  <Bar dataKey="consumed" fill="#f97316" name="مستهلك" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="remaining" fill="#3b82f6" name="متبقي" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {pieData.length > 0 && (
            <div className="border rounded-xl p-5 bg-card print:break-inside-avoid">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-primary" />
                توزيع الاستهلاك حسب المادة
              </h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" labelLine={false} outerRadius={85} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, "مستهلك"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {coverageData.length > 0 && (
            <div className="border rounded-xl p-5 bg-card print:break-inside-avoid">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-primary" />
                تغطية المخزون (أسابيع)
              </h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={coverageData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} formatter={(value: number) => [`${value} أسبوع`, "التغطية"]} />
                    <Bar dataKey="weeks" fill="#10b981" name="أسابيع" radius={[0, 4, 4, 0]}>
                      {coverageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.weeks <= 2 ? "#ef4444" : entry.weeks <= 4 ? "#f59e0b" : "#10b981"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        <div className="border rounded-xl overflow-hidden bg-card mb-8 print:break-inside-avoid">
          <h3 className="text-sm font-semibold p-4 border-b flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            تفاصيل الاستهلاك والأسعار لكل مادة
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
          <div className="border rounded-xl overflow-hidden bg-card mb-8 print:break-inside-avoid">
            <h3 className="text-sm font-semibold p-4 border-b flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              سجل الطلبات (آخر 10)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="py-2.5 px-3 text-start font-semibold">رقم الطلب</th>
                    <th className="py-2.5 px-3 text-start font-semibold">التاريخ</th>
                    <th className="py-2.5 px-3 text-end font-semibold">القيمة (سعر البيع)</th>
                    <th className="py-2.5 px-3 text-start font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 10).map(o => (
                    <tr key={o.id} className="border-b border-border/50">
                      <td className="py-2 px-3 font-mono">{o.id}</td>
                      <td className="py-2 px-3">{o.date}</td>
                      <td className="py-2 px-3 text-end">{o.totalSelling > 0 ? `${o.totalSelling.toLocaleString()} ج.م` : "—"}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          o.status === "Delivered" || o.status === "Closed" ? "bg-green-100 text-green-700" :
                          o.status === "Cancelled" ? "bg-red-100 text-red-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>{o.status === "Delivered" ? "تم التسليم" : o.status === "Closed" ? "مغلق" : o.status === "Processing" ? "قيد المعالجة" : o.status === "Draft" ? "مسودة" : o.status === "Cancelled" ? "ملغي" : o.status}</span>
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
    <div className="border rounded-xl p-4 bg-card print:break-inside-avoid">
      <div className={`h-8 w-8 rounded-lg ${color} flex items-center justify-center mb-2`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
