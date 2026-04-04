import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { exportMultiSectionCsv } from "@/lib/exportCsv";
import {
  ArrowRight, ArrowLeft, Printer, Download, Loader2,
  TrendingUp, TrendingDown, Minus, AlertTriangle, AlertCircle,
  Info, CheckCircle, Clock, Package, ShoppingCart, Truck,
  DollarSign, RotateCcw, BarChart3, PieChart as PieChartIcon,
  Activity, Target, Calendar, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, RadialBarChart, RadialBar,
} from "recharts";

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#06b6d4", "#eab308", "#ec4899"];
const GRID_COLOR = "#e5e7eb";

export default function ClientAnalysis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang, dir } = useLanguage();
  const isEn = lang === "en";
  const dateLocale = isEn ? "en-US" : "ar-EG";

  const MONTH_NAMES = [t.crMonthJan, t.crMonthFeb, t.crMonthMar, t.crMonthApr, t.crMonthMay, t.crMonthJun, t.crMonthJul, t.crMonthAug, t.crMonthSep, t.crMonthOct, t.crMonthNov, t.crMonthDec];

  function toMonthLabel(ym: string) {
    const m = parseInt(ym.slice(5));
    return MONTH_NAMES[m - 1] || ym.slice(5);
  }

  function cur(v: number) {
    return `${v.toLocaleString()} ${t.caCurrency}`;
  }

  const [client, setClient] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [orderLines, setOrderLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<any[]>("/clients").catch(() => []),
      api.get<any[]>(`/client-inventory?clientId=${id}`).catch(() => []),
      api.get<any[]>("/orders").catch(() => []),
      api.get<any[]>("/deliveries").catch(() => []),
      api.get<any[]>("/collections").catch(() => []),
      api.get<any[]>("/returns").catch(() => []),
      api.get<any[]>("/order-lines").catch(() => []),
    ]).then(([cl, inv, ord, del, col, ret, oLines]) => {
      const found = (cl || []).find((c: any) => c.id === id);
      if (found) {
        setClient({
          id: found.id, name: found.name || "", contact: found.contact || "",
          city: found.city || "", joinDate: found.joinDate || found.join_date || "",
          phone: found.phone || "",
        });
      }
      setInventory((inv || []).filter((i: any) => i.status !== "Expired" && i.status !== "Returned").map((r: any) => ({
        material: r.material || "", code: r.code || "", unit: r.unit || "unit",
        delivered: Number(r.delivered || 0), remaining: Number(r.remaining || 0),
        sellingPrice: Number(r.sellingPrice || r.selling_price || 0),
        avgWeeklyUsage: Number(r.avgWeeklyUsage || r.avg_weekly_usage || 0),
      })));
      const clientOrders = (ord || []).filter((o: any) => (o.clientId || o.client_id) === id).map((o: any) => ({
        id: o.id, date: o.date || "", totalSelling: Number(o.totalSelling ?? o.total_selling ?? 0),
        status: o.status || "", lines: Number(o.lines || 0),
      })).sort((a: any, b: any) => b.date.localeCompare(a.date));
      setOrders(clientOrders);
      setDeliveries((del || []).filter((d: any) => (d.clientId || d.client_id) === id).map((d: any) => ({
        id: d.id, date: d.date || d.deliveryDate || d.delivery_date || "",
        status: d.status || "", items: Number(d.items || d.totalItems || d.total_items || 0),
      })).sort((a: any, b: any) => b.date.localeCompare(a.date)));
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
        totalValue: Number(r.totalValue ?? r.total_value ?? 0),
      })));

      const clientOrderIds = new Set(clientOrders.map((o: any) => o.id));
      setOrderLines((oLines || []).filter((l: any) => clientOrderIds.has(l.orderId || l.order_id)).map((l: any) => ({
        orderId: l.orderId || l.order_id || "",
        materialCode: l.materialCode || l.material_code || "",
        materialName: l.materialName || l.material_name || "",
        quantity: Number(l.quantity || 0),
        unit: l.unit || "unit",
      })));
    }).finally(() => setLoading(false));
  }, [id]);

  const aggregated = useMemo(() => {
    const map = new Map<string, { material: string; code: string; unit: string; totalDelivered: number; totalRemaining: number; totalConsumed: number; avgWeekly: number; sellingPrice: number }>();
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
      } else {
        map.set(key, {
          material: item.material, code: item.code, unit: item.unit,
          totalDelivered: item.delivered, totalRemaining: item.remaining,
          totalConsumed: consumed, avgWeekly: item.avgWeeklyUsage,
          sellingPrice: item.sellingPrice,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.totalConsumed - a.totalConsumed);
  }, [inventory]);

  const collectionStats = useMemo(() => {
    const totalAmount = collections.reduce((s, c) => s + c.totalAmount, 0);
    const paidAmount = collections.reduce((s, c) => s + c.paidAmount, 0);
    return { total: collections.length, totalAmount, paidAmount, remaining: totalAmount - paidAmount };
  }, [collections]);

  const returnsStats = useMemo(() => {
    const total = returns.length;
    const totalItems = returns.reduce((s, r) => s + r.itemCount, 0);
    const accepted = returns.filter(r => r.status === "Accepted" || r.status === "مقبول").length;
    const totalValue = returns.reduce((s, r) => s + r.totalValue, 0);
    return { total, totalItems, accepted, pending: total - accepted, totalValue };
  }, [returns]);

  const clientScore = useMemo(() => {
    const collectionRate = collectionStats.totalAmount > 0
      ? Math.min(100, Math.round((collectionStats.paidAmount / collectionStats.totalAmount) * 100))
      : 100;

    const monthsWithOrders = new Set(orders.map(o => o.date?.slice(0, 7)).filter(Boolean));
    const allMonths = new Set([
      ...orders.map(o => o.date?.slice(0, 7)),
      ...deliveries.map(d => d.date?.slice(0, 7)),
    ].filter(Boolean));
    const totalMonthSpan = allMonths.size || 1;
    const orderRegularity = Math.min(100, Math.round((monthsWithOrders.size / totalMonthSpan) * 100));

    const totalConsumed = aggregated.reduce((s, i) => s + i.totalConsumed, 0);
    const totalDelivered = aggregated.reduce((s, i) => s + i.totalDelivered, 0);
    const consumptionVolume = totalDelivered > 0
      ? Math.min(100, Math.round((totalConsumed / totalDelivered) * 100))
      : 0;

    const returnRateVal = orders.length > 0
      ? Math.round((returns.length / orders.length) * 100)
      : 0;
    const returnScore = Math.max(0, 100 - returnRateVal * 3);

    const overall = Math.round(
      collectionRate * 0.35 +
      orderRegularity * 0.25 +
      consumptionVolume * 0.20 +
      returnScore * 0.20
    );

    return {
      overall: Math.min(100, Math.max(0, overall)),
      collectionRate,
      orderRegularity,
      consumptionVolume,
      returnRate: returnRateVal,
      returnScore,
    };
  }, [collectionStats, orders, deliveries, aggregated, returns, lang]);

  const scoreLabel = (score: number) => {
    if (score >= 80) return { label: t.caScoreExcellent, color: "text-green-600", bg: "bg-green-500" };
    if (score >= 60) return { label: t.caScoreGood, color: "text-blue-600", bg: "bg-blue-500" };
    if (score >= 40) return { label: t.caScoreAverage, color: "text-amber-600", bg: "bg-amber-500" };
    return { label: t.caScoreWeak, color: "text-red-600", bg: "bg-red-500" };
  };

  const monthComparison = useMemo(() => {
    const now = new Date();
    const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const curOrders = orders.filter(o => o.date?.startsWith(curYM));
    const prevOrders = orders.filter(o => o.date?.startsWith(prevYM));
    const curDel = deliveries.filter(d => d.date?.startsWith(curYM));
    const prevDel = deliveries.filter(d => d.date?.startsWith(prevYM));
    const curCol = collections.filter(c => c.date?.startsWith(curYM)).reduce((s, c) => s + c.paidAmount, 0);
    const prevCol = collections.filter(c => c.date?.startsWith(prevYM)).reduce((s, c) => s + c.paidAmount, 0);
    const curRet = returns.filter(r => r.date?.startsWith(curYM));
    const prevRet = returns.filter(r => r.date?.startsWith(prevYM));
    const curVal = curOrders.reduce((s, o) => s + o.totalSelling, 0);
    const prevVal = prevOrders.reduce((s, o) => s + o.totalSelling, 0);

    function pctChange(cur: number, prev: number) {
      if (prev === 0 && cur === 0) return 0;
      if (prev === 0) return 100;
      return Math.round(((cur - prev) / prev) * 100);
    }

    return {
      curLabel: toMonthLabel(curYM),
      prevLabel: toMonthLabel(prevYM),
      rows: [
        { label: t.caOrders, cur: curOrders.length, prev: prevOrders.length, change: pctChange(curOrders.length, prevOrders.length), isCurrency: false },
        { label: t.caOrderValue, cur: curVal, prev: prevVal, change: pctChange(curVal, prevVal), isCurrency: true },
        { label: t.caDeliveries, cur: curDel.length, prev: prevDel.length, change: pctChange(curDel.length, prevDel.length), isCurrency: false },
        { label: t.caCollections, cur: curCol, prev: prevCol, change: pctChange(curCol, prevCol), isCurrency: true },
        { label: t.caReturns, cur: curRet.length, prev: prevRet.length, change: pctChange(curRet.length, prevRet.length), isNegative: true, isCurrency: false },
      ],
    };
  }, [orders, deliveries, collections, returns, lang]);

  const smartAlerts = useMemo(() => {
    const alerts: { type: "danger" | "warning" | "info"; title: string; desc: string }[] = [];

    if (collectionStats.remaining > 0) {
      const lastColDate = collections.length > 0
        ? [...collections].sort((a, b) => b.date.localeCompare(a.date))[0]?.date
        : null;
      const daysSinceCol = lastColDate
        ? Math.floor((Date.now() - new Date(lastColDate).getTime()) / 86400000)
        : 999;
      if (daysSinceCol > 30) {
        alerts.push({
          type: "danger",
          title: t.caAlertOverdue,
          desc: t.caAlertOverdueDesc.replace("{amount}", cur(collectionStats.remaining)).replace("{days}", String(daysSinceCol)),
        });
      }
    }

    if (orders.length > 0) {
      const lastOrderDate = orders[0]?.date;
      if (lastOrderDate) {
        const daysSince = Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / 86400000);
        if (daysSince > 45) {
          alerts.push({
            type: "warning",
            title: t.caAlertInactive,
            desc: t.caAlertInactiveDesc.replace("{days}", String(daysSince)),
          });
        }
      }
    }

    if (orders.length > 0) {
      const returnRate = Math.round((returns.length / orders.length) * 100);
      if (returnRate > 15) {
        alerts.push({
          type: "danger",
          title: t.caAlertHighReturns,
          desc: t.caAlertHighReturnsDesc.replace("{rate}", String(returnRate)),
        });
      }
    }

    const lowConsumptionCount = aggregated.filter(a => {
      const rate = a.totalDelivered > 0 ? (a.totalConsumed / a.totalDelivered) * 100 : 0;
      return rate < 30 && a.totalDelivered > 0;
    }).length;
    if (lowConsumptionCount > 0) {
      alerts.push({
        type: "info",
        title: t.caAlertLowConsumption,
        desc: t.caAlertLowConsumptionDesc.replace("{count}", String(lowConsumptionCount)),
      });
    }

    return alerts;
  }, [collectionStats, orders, returns, aggregated, collections, lang]);

  const consumptionPredictions = useMemo(() => {
    return aggregated
      .filter(a => a.totalRemaining > 0)
      .map(a => {
        const weeksLeft = a.avgWeekly > 0 ? a.totalRemaining / a.avgWeekly : null;
        const daysLeft = weeksLeft !== null ? Math.round(weeksLeft * 7) : null;
        let status: "critical" | "soon" | "ok" = "ok";
        if (weeksLeft !== null) {
          if (weeksLeft <= 2) status = "critical";
          else if (weeksLeft <= 6) status = "soon";
        }
        return {
          material: a.material,
          code: a.code,
          remaining: a.totalRemaining,
          unit: a.unit,
          weeklyUsage: a.avgWeekly,
          weeksLeft,
          daysLeft,
          status,
        };
      })
      .sort((a, b) => {
        if (a.weeksLeft === null && b.weeksLeft === null) return 0;
        if (a.weeksLeft === null) return 1;
        if (b.weeksLeft === null) return -1;
        return a.weeksLeft - b.weeksLeft;
      });
  }, [aggregated]);

  const orderTrendData = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return months.map(ym => {
      const monthOrders = orders.filter(o => o.date?.startsWith(ym));
      return {
        month: toMonthLabel(ym),
        orders: monthOrders.length,
        value: monthOrders.reduce((s, o) => s + o.totalSelling, 0),
      };
    });
  }, [orders, lang]);

  const topMaterials = useMemo(() => {
    const map = new Map<string, { name: string; qty: number }>();
    for (const line of orderLines) {
      const key = line.materialName || line.materialCode;
      const existing = map.get(key);
      if (existing) {
        existing.qty += line.quantity;
      } else {
        map.set(key, { name: key, qty: line.quantity });
      }
    }
    const sorted = [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 6);
    const total = sorted.reduce((s, m) => s + m.qty, 0);
    return sorted.map(m => ({ name: m.name.length > 20 ? m.name.slice(0, 20) + "…" : m.name, fullName: m.name, value: m.qty, pct: total > 0 ? Math.round((m.qty / total) * 100) : 0 }));
  }, [orderLines]);

  const radarData = useMemo(() => [
    { metric: t.caCollectionRate, value: clientScore.collectionRate, fullMark: 100 },
    { metric: t.caOrderRegularity, value: clientScore.orderRegularity, fullMark: 100 },
    { metric: t.caConsumptionVolume, value: clientScore.consumptionVolume, fullMark: 100 },
    { metric: t.caReturnRate, value: clientScore.returnScore, fullMark: 100 },
  ], [clientScore, lang]);

  const overviewStats = useMemo(() => {
    const avgOrderVal = orders.length > 0
      ? Math.round(orders.reduce((s, o) => s + o.totalSelling, 0) / orders.length)
      : 0;
    const monthsActive = new Set(orders.map(o => o.date?.slice(0, 7)).filter(Boolean)).size;
    const ordersPerMonth = monthsActive > 0 ? (orders.length / monthsActive).toFixed(1) : "0";
    const lastOrderDate = orders[0]?.date || "";
    const lastColDate = collections.length > 0
      ? [...collections].sort((a, b) => b.date.localeCompare(a.date))[0]?.date || ""
      : "";
    const daysSinceOrder = lastOrderDate ? Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / 86400000) : null;
    const daysSinceCol = lastColDate ? Math.floor((Date.now() - new Date(lastColDate).getTime()) / 86400000) : null;

    return { avgOrderVal, ordersPerMonth, lastOrderDate, lastColDate, daysSinceOrder, daysSinceCol };
  }, [orders, collections]);

  const handleExportCSV = () => {
    if (!client) return;
    const si = scoreLabel(clientScore.overall);
    const sections = [
      {
        title: `📋 ${isEn ? "Client Info" : "بيانات العميل"}`,
        headers: [isEn ? "Field" : "الحقل", isEn ? "Value" : "القيمة"],
        rows: [
          [isEn ? "Name" : "الاسم", client.name],
          [isEn ? "City" : "المدينة", client.city || "—"],
          [isEn ? "Report Date" : "تاريخ التقرير", new Date().toLocaleDateString(dateLocale)],
        ] as (string | number)[][],
      },
      {
        title: `⭐ ${t.caClientScore}`,
        headers: [isEn ? "Metric" : "المقياس", isEn ? "Score" : "النتيجة"],
        rows: [
          [isEn ? "Overall Score" : "التقييم العام", `${clientScore.overall}/100 (${si.label})`],
          [t.caCollectionRate, `${clientScore.collectionRate}%`],
          [t.caOrderRegularity, `${clientScore.orderRegularity}%`],
          [t.caConsumptionVolume, `${clientScore.consumptionVolume}%`],
          [t.caReturnRate, `${clientScore.returnRate}%`],
        ] as (string | number)[][],
      },
      {
        title: `💰 ${t.caAccountSummary}`,
        headers: [isEn ? "Metric" : "البند", isEn ? "Value" : "القيمة"],
        rows: [
          [t.caTotalOrders, orders.length],
          [t.caTotalDeliveries, deliveries.length],
          [t.caTotalBilled, collectionStats.totalAmount],
          [t.caTotalPaid, collectionStats.paidAmount],
          [t.caOutstanding, collectionStats.remaining],
          [t.caReturns, returnsStats.total],
          [t.caReturnItems, returnsStats.totalItems],
          [t.caAvgOrderValue, overviewStats.avgOrderVal],
          [t.caOrderFrequency, `${overviewStats.ordersPerMonth} ${t.caOrdersPerMonth}`],
        ] as (string | number)[][],
      },
      {
        title: `📊 ${t.caMonthComparison}`,
        headers: ["", monthComparison.curLabel, monthComparison.prevLabel, t.caChange],
        rows: monthComparison.rows.map(r => [
          r.label, r.isCurrency ? r.cur : r.cur, r.isCurrency ? r.prev : r.prev,
          r.change === 0 ? t.caNoChange : `${r.change > 0 ? "+" : ""}${r.change}%`,
        ]),
      },
      {
        title: `⚠️ ${t.caSmartAlerts}`,
        headers: [isEn ? "Type" : "النوع", isEn ? "Alert" : "التنبيه", isEn ? "Details" : "التفاصيل"],
        rows: smartAlerts.length > 0
          ? smartAlerts.map(a => [
              a.type === "danger" ? t.caAlertDanger : a.type === "warning" ? t.caAlertWarning : t.caAlertInfo,
              a.title, a.desc,
            ])
          : [[t.caAlertNoAlerts, "", ""]],
      },
      {
        title: `🔮 ${t.caConsumptionPredictions}`,
        headers: [t.caMaterial, isEn ? "Code" : "الكود", t.caRemaining, t.caWeeklyUsage, isEn ? "Est. Weeks Left" : "أسابيع متبقية", isEn ? "Status" : "الحالة"],
        rows: consumptionPredictions.map(p => [
          p.material, p.code, p.remaining, p.weeklyUsage > 0 ? p.weeklyUsage.toFixed(1) : "—",
          p.weeksLeft !== null ? p.weeksLeft.toFixed(1) : "—",
          p.status === "critical" ? t.caRunoutCritical : p.status === "soon" ? t.caRunoutSoon : t.caRunoutOk,
        ]),
      },
      {
        title: `📈 ${t.caOrderTrend}`,
        headers: [isEn ? "Month" : "الشهر", t.caMonthlyOrders, t.caMonthlyValue],
        rows: orderTrendData.map(d => [d.month, d.orders, d.value]),
      },
      {
        title: `🥇 ${t.caPreferredMaterials}`,
        headers: [t.caMaterial, isEn ? "Quantity" : "الكمية", t.caMaterialShare],
        rows: topMaterials.map(m => [m.fullName, m.value, `${m.pct}%`]),
      },
      {
        title: `📦 ${t.caConsumptionPattern}`,
        headers: [t.caMaterial, isEn ? "Delivered" : "مُسلَّم", isEn ? "Consumed" : "مستهلك", t.caRemaining, t.caConsumptionRate],
        rows: aggregated.map(a => {
          const rate = a.totalDelivered > 0 ? Math.round((a.totalConsumed / a.totalDelivered) * 100) : 0;
          return [a.material, a.totalDelivered, a.totalConsumed, a.totalRemaining, `${rate}%`];
        }),
      },
    ];
    exportMultiSectionCsv(`client_analysis_${client.name}`, sections);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir={dir}>
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir={dir}>
        <p className="text-muted-foreground text-lg">{t.caNoData}</p>
      </div>
    );
  }

  const scoreInfo = scoreLabel(clientScore.overall);

  return (
    <div dir={dir} className="min-h-screen bg-background print-report-page">
      <div className="hidden print:block print-fixed-header">
        <div className="flex items-center justify-between px-4 py-1 text-xs">
          <div className="flex items-center gap-2">
            <img src="/images/dsb-logo.png" alt="DSB" className="h-6" />
            <span className="font-bold">Dental Smart Box</span>
          </div>
          <span>{t.caTitle} — {client.name}</span>
        </div>
      </div>

      <div className="hidden print:block print-fixed-footer">
        <div className="flex items-center justify-between px-4 py-1 text-[10px] text-muted-foreground">
          <span>dsbs.store | +20 11 0229 7174</span>
          <span>{isEn ? "Confidential — Internal Use Only" : "سري — للاستخدام الداخلي فقط"}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/clients/${id}`)}>
              {isEn ? <ArrowLeft className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{t.caTitle}</h1>
              <p className="text-sm text-muted-foreground">{t.caSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline ms-1">{t.caExportCSV}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline ms-1">{t.caPrintReport}</span>
            </Button>
          </div>
        </div>

        <div className="hidden print:block mb-4">
          <div className="flex items-center gap-4">
            <img src="/images/dsb-logo.png" alt="DSB" className="h-12" />
            <div>
              <h1 className="text-xl font-bold">{t.caTitle} — {client.name}</h1>
              <p className="text-sm text-muted-foreground">{t.caSubtitle}</p>
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={<ShoppingCart className="h-5 w-5" />} label={t.caTotalOrders} value={String(orders.length)} color="text-orange-600 bg-orange-100" />
          <StatCard icon={<Truck className="h-5 w-5" />} label={t.caTotalDeliveries} value={String(deliveries.length)} color="text-blue-600 bg-blue-100" />
          <StatCard icon={<DollarSign className="h-5 w-5" />} label={t.caTotalBilled} value={cur(collectionStats.totalAmount)} color="text-green-600 bg-green-100" />
          <StatCard icon={<DollarSign className="h-5 w-5" />} label={t.caTotalPaid} value={cur(collectionStats.paidAmount)} color="text-emerald-600 bg-emerald-100" />
          <StatCard icon={<DollarSign className="h-5 w-5" />} label={t.caOutstanding} value={cur(collectionStats.remaining)} color={collectionStats.remaining > 0 ? "text-red-600 bg-red-100" : "text-green-600 bg-green-100"} />
          <StatCard icon={<RotateCcw className="h-5 w-5" />} label={t.caReturns} value={String(returns.length)} color="text-purple-600 bg-purple-100" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-card rounded-2xl border p-6 flex flex-col items-center justify-center">
            <h2 className="text-lg font-bold mb-4">{t.caClientScore}</h2>
            <div className="relative w-40 h-40 mb-4">
              <svg viewBox="0 0 120 120" className="w-full h-full">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="54" fill="none"
                  stroke={clientScore.overall >= 80 ? "#22c55e" : clientScore.overall >= 60 ? "#3b82f6" : clientScore.overall >= 40 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(clientScore.overall / 100) * 339.3} 339.3`}
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-black ${scoreInfo.color}`}>{clientScore.overall}</span>
                <span className={`text-sm font-semibold ${scoreInfo.color}`}>{scoreInfo.label}</span>
              </div>
            </div>
            <div className="w-full space-y-2 text-sm">
              <ScoreRow label={t.caCollectionRate} value={clientScore.collectionRate} />
              <ScoreRow label={t.caOrderRegularity} value={clientScore.orderRegularity} />
              <ScoreRow label={t.caConsumptionVolume} value={clientScore.consumptionVolume} />
              <ScoreRow label={t.caReturnRate} value={clientScore.returnScore} suffix={`(${clientScore.returnRate}%)`} />
            </div>
          </div>

          <div className="lg:col-span-1 bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" /> {t.caOverview}
            </h2>
            <div className="space-y-3 text-sm">
              <OverviewRow label={t.caLastOrder} value={overviewStats.lastOrderDate ? new Date(overviewStats.lastOrderDate).toLocaleDateString(dateLocale) : "—"} sub={overviewStats.daysSinceOrder !== null ? `${overviewStats.daysSinceOrder} ${t.caDaysAgo}` : undefined} />
              <OverviewRow label={t.caLastCollection} value={overviewStats.lastColDate ? new Date(overviewStats.lastColDate).toLocaleDateString(dateLocale) : "—"} sub={overviewStats.daysSinceCol !== null ? `${overviewStats.daysSinceCol} ${t.caDaysAgo}` : undefined} />
              <OverviewRow label={t.caOrderFrequency} value={`${overviewStats.ordersPerMonth} ${t.caOrdersPerMonth}`} />
              <OverviewRow label={t.caAvgOrderValue} value={cur(overviewStats.avgOrderVal)} />
              <OverviewRow label={t.caCollectionRate} value={`${clientScore.collectionRate}%`} />
              {client.joinDate && <OverviewRow label={t.caJoinDate} value={new Date(client.joinDate).toLocaleDateString(dateLocale)} />}
            </div>
          </div>

          <div className="lg:col-span-1 bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4">{t.caClientScore}</h2>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke={GRID_COLOR} />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "currentColor" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-2xl border p-6 page-break-before">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> {t.caMonthComparison}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-primary/20">
                  <th className="text-start py-2 font-bold">{""}</th>
                  <th className="text-center py-2 font-bold">{monthComparison.curLabel}</th>
                  <th className="text-center py-2 font-bold">{monthComparison.prevLabel}</th>
                  <th className="text-center py-2 font-bold">{t.caChange}</th>
                </tr>
              </thead>
              <tbody>
                {monthComparison.rows.map((row, i) => (
                  <tr key={i} className="border-b border-muted/30">
                    <td className="py-2.5 font-medium">{row.label}</td>
                    <td className="text-center py-2.5">{row.isCurrency ? cur(row.cur) : row.cur}</td>
                    <td className="text-center py-2.5">{row.isCurrency ? cur(row.prev) : row.prev}</td>
                    <td className="text-center py-2.5">
                      <ChangeIndicator value={row.change} isNegative={(row as any).isNegative} t={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card rounded-2xl border p-6 page-break-before">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" /> {t.caSmartAlerts}
          </h2>
          {smartAlerts.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 text-green-700 border border-green-200">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <span className="font-medium">{t.caAlertNoAlerts}</span>
            </div>
          ) : (
            <div className="space-y-3">
              {smartAlerts.map((alert, i) => (
                <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${
                  alert.type === "danger" ? "bg-red-50 text-red-800 border-red-200" :
                  alert.type === "warning" ? "bg-amber-50 text-amber-800 border-amber-200" :
                  "bg-blue-50 text-blue-800 border-blue-200"
                }`}>
                  {alert.type === "danger" ? <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" /> :
                   alert.type === "warning" ? <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /> :
                   <Info className="h-5 w-5 shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-bold text-sm">{alert.title}</p>
                    <p className="text-sm opacity-80">{alert.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl border p-6 page-break-before">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> {t.caConsumptionPredictions}
          </h2>
          {consumptionPredictions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t.caNoData}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-primary/20">
                    <th className="text-start py-2 font-bold">{t.caMaterial}</th>
                    <th className="text-center py-2 font-bold">{t.caRemaining}</th>
                    <th className="text-center py-2 font-bold">{t.caWeeklyUsage}</th>
                    <th className="text-center py-2 font-bold">{t.caEstRunout}</th>
                    <th className="text-center py-2 font-bold">{""}</th>
                  </tr>
                </thead>
                <tbody>
                  {consumptionPredictions.map((p, i) => (
                    <tr key={i} className="border-b border-muted/30">
                      <td className="py-2.5 font-medium max-w-[200px] truncate">{p.material}</td>
                      <td className="text-center py-2.5">{p.remaining} {p.unit}</td>
                      <td className="text-center py-2.5">{p.weeklyUsage > 0 ? p.weeklyUsage.toFixed(1) : "—"}</td>
                      <td className="text-center py-2.5">
                        {p.weeksLeft !== null ? (
                          <span>{p.weeksLeft.toFixed(1)} {t.caWeeks} ({p.daysLeft} {t.caDays})</span>
                        ) : (
                          <span className="text-muted-foreground">{t.caNoUsageData}</span>
                        )}
                      </td>
                      <td className="text-center py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          p.status === "critical" ? "bg-red-100 text-red-700" :
                          p.status === "soon" ? "bg-amber-100 text-amber-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {p.status === "critical" ? t.caRunoutCritical : p.status === "soon" ? t.caRunoutSoon : t.caRunoutOk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 page-break-before">
          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" /> {t.caReturnsAnalysis}
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-purple-600">{returnsStats.total}</p>
                <p className="text-xs text-muted-foreground">{t.caReturnCount}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-purple-600">{returnsStats.totalItems}</p>
                <p className="text-xs text-muted-foreground">{t.caReturnItems}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-green-600">{returnsStats.accepted}</p>
                <p className="text-xs text-muted-foreground">{t.caAcceptedReturns}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-amber-600">{returnsStats.pending}</p>
                <p className="text-xs text-muted-foreground">{t.caPendingReturns}</p>
              </div>
            </div>
            {orders.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t.caReturnRateLabel}:</span>
                <span className={`font-bold ${clientScore.returnRate > 15 ? "text-red-600" : clientScore.returnRate > 5 ? "text-amber-600" : "text-green-600"}`}>
                  {clientScore.returnRate}%
                </span>
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" /> {t.caPreferredMaterials}
            </h2>
            {topMaterials.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{t.caNoData}</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={topMaterials} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, pct }) => `${name} ${pct}%`} labelLine={false} style={{ fontSize: "10px" }}>
                    {topMaterials.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string, entry: any) => [v, entry.payload.fullName]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 page-break-before">
          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> {t.caOrderTrend}
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={orderTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "currentColor" }} />
                <YAxis tick={{ fontSize: 11, fill: "currentColor" }} />
                <Tooltip contentStyle={{ fontSize: "12px", direction: dir as "rtl" | "ltr" }} />
                <Bar dataKey="orders" name={t.caMonthlyOrders} fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> {t.caMonthlyValue}
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={orderTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "currentColor" }} />
                <YAxis tick={{ fontSize: 11, fill: "currentColor" }} />
                <Tooltip contentStyle={{ fontSize: "12px", direction: dir as "rtl" | "ltr" }} formatter={(v: number) => [cur(v), t.caMonthlyValue]} />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: "#3b82f6", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-2xl border p-6 page-break-before">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> {t.caConsumptionPattern}
          </h2>
          {aggregated.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t.caNoData}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-primary/20">
                    <th className="text-start py-2 font-bold">{t.caMaterial}</th>
                    <th className="text-center py-2 font-bold">{isEn ? "Delivered" : "مُسلَّم"}</th>
                    <th className="text-center py-2 font-bold">{isEn ? "Consumed" : "مستهلك"}</th>
                    <th className="text-center py-2 font-bold">{t.caRemaining}</th>
                    <th className="text-center py-2 font-bold">{t.caConsumptionRate}</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregated.slice(0, 15).map((a, i) => {
                    const rate = a.totalDelivered > 0 ? Math.round((a.totalConsumed / a.totalDelivered) * 100) : 0;
                    return (
                      <tr key={i} className="border-b border-muted/30">
                        <td className="py-2.5 font-medium max-w-[200px] truncate">{a.material}</td>
                        <td className="text-center py-2.5">{a.totalDelivered}</td>
                        <td className="text-center py-2.5">{a.totalConsumed}</td>
                        <td className="text-center py-2.5">{a.totalRemaining}</td>
                        <td className="text-center py-2.5">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${rate >= 90 ? "bg-red-500" : rate >= 70 ? "bg-orange-500" : rate >= 40 ? "bg-amber-400" : "bg-green-500"}`} style={{ width: `${Math.min(100, rate)}%` }} />
                            </div>
                            <span className="text-xs font-bold w-10">{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const [iconColor, bgColor] = color.split(" ");
  return (
    <div className="bg-card rounded-xl border p-3 flex flex-col items-center text-center gap-1">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bgColor} ${iconColor}`}>{icon}</div>
      <p className="text-xs text-muted-foreground leading-tight mt-1">{label}</p>
      <p className="text-sm font-bold leading-tight">{value}</p>
    </div>
  );
}

function ScoreRow({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground flex-1 text-xs">{label}</span>
      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${value >= 80 ? "bg-green-500" : value >= 60 ? "bg-blue-500" : value >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-bold w-8 text-end">{value}%</span>
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function OverviewRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-muted/30 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-end">
        <span className="font-semibold">{value}</span>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function ChangeIndicator({ value, isNegative, t }: { value: number; isNegative?: boolean; t: any }) {
  if (value === 0) return <span className="text-muted-foreground text-xs">{t.caNoChange}</span>;

  const isPositive = isNegative ? value < 0 : value > 0;
  const absVal = Math.abs(value);

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${isPositive ? "text-green-600" : "text-red-600"}`}>
      {value > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {absVal}%
    </span>
  );
}