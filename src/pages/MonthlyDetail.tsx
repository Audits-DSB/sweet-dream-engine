import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Truck, CreditCard, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const ARABIC_MONTHS: Record<string, string> = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
  "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
};

function toNum(v: string | number | undefined): number {
  if (!v) return 0;
  return typeof v === "number" ? v : Number(String(v).replace(/,/g, "")) || 0;
}

const STATUS_COLORS: Record<string, string> = {
  Processing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Delivered: "bg-green-500/10 text-green-600 border-green-500/20",
  Closed: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  Completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  Cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
  Draft: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
};

const STATUS_AR: Record<string, string> = {
  Processing: "قيد التنفيذ",
  Delivered: "تم التسليم",
  Closed: "مغلق",
  Completed: "مكتمل",
  Cancelled: "ملغي",
  Draft: "مسودة",
};

export default function MonthlyDetail() {
  const { year, month } = useParams<{ year: string; month: string }>();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const ym = `${year}-${month}`;
  const monthName = ARABIC_MONTHS[month || ""] || month;
  const yearStr = year || "";

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get("/orders"),
      api.get("/deliveries"),
      api.get("/collections"),
    ]).then(([o, d, c]) => {
      setOrders(o as any[]);
      setDeliveries(d as any[]);
      setCollections(c as any[]);
    }).catch((e) => {
      setError(e?.message || "فشل تحميل البيانات");
    }).finally(() => setLoading(false));
  }, []);

  const monthOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.clientId === "company-inventory") return false;
      const d = o.date || o.createdAt || "";
      return d.startsWith(ym);
    });
  }, [orders, ym]);

  const monthDeliveries = useMemo(() => {
    return deliveries.filter(d => {
      const dt = d.date || d.createdAt || "";
      return dt.startsWith(ym);
    });
  }, [deliveries, ym]);

  const monthCollections = useMemo(() => {
    return collections.filter(c => {
      const dt = c.invoiceDate || c.createdAt || "";
      return dt.startsWith(ym);
    });
  }, [collections, ym]);

  const deliveredStatuses = ["Delivered", "Closed", "Completed"];

  const stats = useMemo(() => {
    const delivered = monthOrders.filter(o => deliveredStatuses.includes(o.status));
    const revenue = delivered.reduce((s, o) => s + toNum(o.totalSelling), 0);
    const cost = delivered.reduce((s, o) => s + toNum(o.totalCost), 0);
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const avgOrderValue = delivered.length > 0 ? revenue / delivered.length : 0;

    const totalCollected = monthCollections.reduce((s, c) => s + toNum(c.paidAmount), 0);
    const totalOutstanding = monthCollections.reduce((s, c) => s + toNum(c.outstanding), 0);

    const confirmedDeliveries = monthDeliveries.filter(d => d.status === "Delivered" || d.status === "مُسلَّم").length;

    const statusDist: Record<string, number> = {};
    monthOrders.forEach(o => {
      const s = o.status || "Draft";
      statusDist[s] = (statusDist[s] || 0) + 1;
    });

    return {
      totalOrders: monthOrders.length,
      deliveredOrders: delivered.length,
      revenue, cost, profit, margin, avgOrderValue,
      totalDeliveries: monthDeliveries.length,
      confirmedDeliveries,
      totalCollected, totalOutstanding,
      statusDist,
    };
  }, [monthOrders, monthDeliveries, monthCollections]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-red-500 text-sm">{error}</p>
        <button className="text-primary hover:underline text-sm" onClick={() => navigate(-1)}>رجوع</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowRight className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">تفاصيل شهر {monthName} {yearStr}</h1>
          <p className="text-sm text-muted-foreground">ملخص شامل لجميع العمليات خلال الشهر</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card text-center">
          <ShoppingCart className="h-5 w-5 mx-auto mb-1 text-blue-500" />
          <p className="text-2xl font-bold">{stats.totalOrders}</p>
          <p className="text-xs text-muted-foreground">إجمالي الأوردرات</p>
        </div>
        <div className="stat-card text-center">
          <DollarSign className="h-5 w-5 mx-auto mb-1 text-green-500" />
          <p className="text-2xl font-bold">{stats.revenue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">الإيرادات (ج.م)</p>
        </div>
        <div className="stat-card text-center">
          <Package className="h-5 w-5 mx-auto mb-1 text-orange-500" />
          <p className="text-2xl font-bold">{stats.cost.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">التكلفة (ج.م)</p>
        </div>
        <div className="stat-card text-center">
          {stats.profit >= 0 ? (
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
          ) : (
            <TrendingDown className="h-5 w-5 mx-auto mb-1 text-red-500" />
          )}
          <p className={`text-2xl font-bold ${stats.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
            {stats.profit.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">الربح (ج.م)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card text-center">
          <Truck className="h-5 w-5 mx-auto mb-1 text-purple-500" />
          <p className="text-2xl font-bold">{stats.confirmedDeliveries}/{stats.totalDeliveries}</p>
          <p className="text-xs text-muted-foreground">توصيلات مؤكدة</p>
        </div>
        <div className="stat-card text-center">
          <CreditCard className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
          <p className="text-2xl font-bold">{stats.totalCollected.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">محصّل (ج.م)</p>
        </div>
        <div className="stat-card text-center">
          <FileText className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
          <p className="text-2xl font-bold">{stats.margin.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">هامش الربح</p>
        </div>
        <div className="stat-card text-center">
          <DollarSign className="h-5 w-5 mx-auto mb-1 text-sky-500" />
          <p className="text-2xl font-bold">{Math.round(stats.avgOrderValue).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">متوسط قيمة الأوردر</p>
        </div>
      </div>

      {Object.keys(stats.statusDist).length > 0 && (
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-3">توزيع حالات الأوردرات</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.statusDist).map(([status, count]) => (
              <Badge key={status} variant="outline" className={`${STATUS_COLORS[status] || ""} text-sm px-3 py-1`}>
                {STATUS_AR[status] || status}: {count}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="stat-card">
        <h3 className="font-semibold text-sm mb-4">جميع أوردرات الشهر ({monthOrders.length})</h3>
        {monthOrders.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">لا توجد أوردرات في هذا الشهر</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-right py-2 px-2 font-medium">رقم الأوردر</th>
                  <th className="text-right py-2 px-2 font-medium">العميل</th>
                  <th className="text-right py-2 px-2 font-medium">التاريخ</th>
                  <th className="text-right py-2 px-2 font-medium">الإيرادات</th>
                  <th className="text-right py-2 px-2 font-medium">التكلفة</th>
                  <th className="text-right py-2 px-2 font-medium">الربح</th>
                  <th className="text-right py-2 px-2 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {monthOrders
                  .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                  .map(o => {
                    const rev = toNum(o.totalSelling);
                    const cost = toNum(o.totalCost);
                    const profit = rev - cost;
                    const isDelivered = deliveredStatuses.includes(o.status);
                    return (
                      <tr
                        key={o.id}
                        className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/orders/${o.id}`)}
                      >
                        <td className="py-2.5 px-2 font-mono text-xs">{o.id}</td>
                        <td className="py-2.5 px-2">{o.client || o.clientId}</td>
                        <td className="py-2.5 px-2 text-muted-foreground">{o.date}</td>
                        <td className="py-2.5 px-2">{isDelivered ? rev.toLocaleString() : "—"}</td>
                        <td className="py-2.5 px-2">{isDelivered ? cost.toLocaleString() : "—"}</td>
                        <td className={`py-2.5 px-2 font-medium ${isDelivered ? (profit >= 0 ? "text-green-600" : "text-red-600") : ""}`}>
                          {isDelivered ? profit.toLocaleString() : "—"}
                        </td>
                        <td className="py-2.5 px-2">
                          <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[o.status] || ""}`}>
                            {STATUS_AR[o.status] || o.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-semibold">
                  <td className="py-2.5 px-2" colSpan={3}>الإجمالي (المسلّم فقط)</td>
                  <td className="py-2.5 px-2">{stats.revenue.toLocaleString()}</td>
                  <td className="py-2.5 px-2">{stats.cost.toLocaleString()}</td>
                  <td className={`py-2.5 px-2 ${stats.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {stats.profit.toLocaleString()}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {monthDeliveries.length > 0 && (
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">توصيلات الشهر ({monthDeliveries.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-right py-2 px-2 font-medium">رقم التوصيلة</th>
                  <th className="text-right py-2 px-2 font-medium">الأوردر</th>
                  <th className="text-right py-2 px-2 font-medium">التاريخ</th>
                  <th className="text-right py-2 px-2 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {monthDeliveries.map(d => (
                  <tr key={d.id} className="border-b hover:bg-muted/50">
                    <td className="py-2.5 px-2 font-mono text-xs">{d.id}</td>
                    <td className="py-2.5 px-2 cursor-pointer text-primary hover:underline" onClick={() => navigate(`/orders/${d.orderId}`)}>
                      {d.orderId}
                    </td>
                    <td className="py-2.5 px-2 text-muted-foreground">{d.date}</td>
                    <td className="py-2.5 px-2">
                      <Badge variant="outline" className={d.status === "Delivered" || d.status === "مُسلَّم" ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"}>
                        {d.status === "Delivered" || d.status === "مُسلَّم" ? "مؤكدة" : "معلقة"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {monthCollections.length > 0 && (
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">تحصيلات الشهر ({monthCollections.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-right py-2 px-2 font-medium">رقم الفاتورة</th>
                  <th className="text-right py-2 px-2 font-medium">العميل</th>
                  <th className="text-right py-2 px-2 font-medium">المبلغ الكلي</th>
                  <th className="text-right py-2 px-2 font-medium">المحصّل</th>
                  <th className="text-right py-2 px-2 font-medium">المتبقي</th>
                  <th className="text-right py-2 px-2 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {monthCollections.map(c => (
                  <tr key={c.id} className="border-b hover:bg-muted/50">
                    <td className="py-2.5 px-2 font-mono text-xs">{c.id}</td>
                    <td className="py-2.5 px-2">{c.clientName || c.clientId}</td>
                    <td className="py-2.5 px-2">{toNum(c.totalAmount).toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-green-600">{toNum(c.paidAmount).toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-red-600">{toNum(c.outstanding).toLocaleString()}</td>
                    <td className="py-2.5 px-2">
                      <Badge variant="outline" className={
                        c.status === "Paid" ? "bg-green-500/10 text-green-600" :
                        c.status === "Overdue" ? "bg-red-500/10 text-red-600" :
                        "bg-yellow-500/10 text-yellow-600"
                      }>
                        {c.status === "Paid" ? "مكتمل" : c.status === "Overdue" ? "متأخر" : c.status === "Partially Paid" ? "جزئي" : c.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
