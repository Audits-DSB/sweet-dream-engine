import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { exportMultiSectionCsv } from "@/lib/exportCsv";
import {
  Printer, Download, Loader2, TrendingUp, TrendingDown,
  AlertTriangle, AlertCircle, CheckCircle, Package, ShoppingCart, Truck,
  DollarSign, RotateCcw, BarChart3, PieChart as PieChartIcon,
  Activity, Target, Users, Building2, Warehouse, ArrowUpRight,
  ArrowDownRight, Clock, CreditCard, Factory,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, ComposedChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#06b6d4", "#eab308", "#ec4899", "#14b8a6", "#6366f1"];
const STATUS_COLORS: Record<string, string> = {
  Delivered: "#22c55e", Processing: "#3b82f6", Draft: "#9ca3af", Confirmed: "#8b5cf6",
  Cancelled: "#ef4444", Closed: "#6b7280", Completed: "#10b981", "Ready for Delivery": "#f59e0b",
  "Partially Delivered": "#f97316", "In Transit": "#06b6d4", Scheduled: "#a855f7",
};
const GRID_COLOR = "#e5e7eb";

export default function CompanyAnalysis() {
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
    return `${v.toLocaleString()} ${t.coCurrency}`;
  }

  const [clients, setClients] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [clientInventory, setClientInventory] = useState<any[]>([]);
  const [companyInventory, setCompanyInventory] = useState<any[]>([]);
  const [treasury, setTreasury] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any[]>("/clients").catch(() => []),
      api.get<any[]>("/orders").catch(() => []),
      api.get<any[]>("/deliveries").catch(() => []),
      api.get<any[]>("/collections").catch(() => []),
      api.get<any[]>("/returns").catch(() => []),
      api.get<any[]>("/client-inventory").catch(() => []),
      api.get<any[]>("/company-inventory").catch(() => []),
      api.get<any[]>("/treasury/transactions").catch(() => []),
    ]).then(([cl, ord, del, col, ret, cInv, coInv, tx]) => {
      setClients((cl || []).filter((c: any) => c.name !== "company-inventory"));
      setOrders((ord || []).filter((o: any) => {
        const cName = o.client || "";
        return cName !== "company-inventory";
      }).map((o: any) => ({
        id: o.id, date: o.date || "", clientId: o.clientId || o.client_id || "",
        client: o.client || "", status: o.status || "",
        totalSelling: Number(o.totalSelling ?? o.total_selling ?? 0),
        totalCost: Number(o.totalCost ?? o.total_cost ?? 0),
        lines: Number(o.lines || 0),
        lineSuppliers: o.lineSuppliers || o.line_suppliers || [],
      })));
      setDeliveries((del || []).map((d: any) => ({
        id: d.id, date: d.date || d.deliveryDate || d.delivery_date || "",
        clientId: d.clientId || d.client_id || "",
        status: d.status || "", items: Number(d.items || d.totalItems || d.total_items || 0),
      })));
      setCollections((col || []).map((c: any) => ({
        id: c.id, date: c.date || c.invoiceDate || c.invoice_date || c.createdAt || "",
        clientId: c.clientId || c.client_id || "",
        totalAmount: Number(c.totalAmount ?? c.total_amount ?? c.amount ?? 0),
        paidAmount: Number(c.paidAmount ?? c.paid_amount ?? c.paid ?? 0),
      })));
      setReturns((ret || []).map((r: any) => ({
        id: r.id, date: r.date || r.createdAt || r.created_at || "",
        clientId: r.clientId || r.client_id || "", clientName: r.clientName || r.client_name || "",
        status: r.status || "",
        itemCount: Array.isArray(r.items) ? r.items.length : Number(r.itemsCount || r.items_count || 1),
        totalValue: Number(r.totalValue ?? r.total_value ?? 0),
      })));
      setClientInventory((cInv || []).filter((i: any) => i.status !== "Expired" && i.status !== "Returned").map((r: any) => ({
        material: r.material || "", code: r.code || "", unit: r.unit || "unit",
        delivered: Number(r.delivered || 0), remaining: Number(r.remaining || 0),
        avgWeeklyUsage: Number(r.avgWeeklyUsage || r.avg_weekly_usage || 0),
        sellingPrice: Number(r.sellingPrice || r.selling_price || 0),
        clientId: r.clientId || r.client_id || "",
      })));
      setCompanyInventory((coInv || []).map((r: any) => ({
        material: r.material || "", remaining: Number(r.remaining || 0),
        quantity: Number(r.quantity || 0), costPrice: Number(r.costPrice || r.cost_price || 0),
        status: r.status || "",
      })));
      setTreasury((tx || []).map((t: any) => ({
        date: t.date || t.createdAt || t.created_at || "",
        type: t.txType || t.tx_type || t.type || "",
        amount: Number(t.amount || 0),
      })));
    }).finally(() => setLoading(false));
  }, []);

  const DELIVERED_STATUSES = ["Delivered", "Closed", "Partially Delivered", "Completed", "مُسلَّم", "مغلق", "مكتمل"];

  const deliveredOrders = useMemo(() =>
    orders.filter(o => DELIVERED_STATUSES.includes(o.status)),
  [orders]);

  const totalRevenue = useMemo(() =>
    deliveredOrders.reduce((s, o) => s + o.totalSelling, 0),
  [deliveredOrders]);

  const totalCost = useMemo(() =>
    deliveredOrders.reduce((s, o) => s + o.totalCost, 0),
  [deliveredOrders]);

  const netProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  const collectionTotals = useMemo(() => {
    const totalAmount = collections.reduce((s, c) => s + c.totalAmount, 0);
    const paidAmount = collections.reduce((s, c) => s + c.paidAmount, 0);
    return { totalAmount, paidAmount, remaining: totalAmount - paidAmount, rate: totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 100 };
  }, [collections]);

  const activeClients = useMemo(() => {
    const last90 = Date.now() - 90 * 86400000;
    const clientIds = new Set(orders.filter(o => o.date && new Date(o.date).getTime() > last90).map(o => o.clientId));
    return clientIds.size;
  }, [orders]);

  const confirmedDeliveries = useMemo(() =>
    deliveries.filter(d => d.status === "Delivered" || d.status === "مُسلَّم").length,
  [deliveries]);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return months.map(ym => {
      const mOrders = orders.filter(o => o.date?.startsWith(ym) && DELIVERED_STATUSES.includes(o.status));
      const revenue = mOrders.reduce((s, o) => s + o.totalSelling, 0);
      const cost = mOrders.reduce((s, o) => s + o.totalCost, 0);
      const mCol = collections.filter(c => c.date?.startsWith(ym)).reduce((s, c) => s + c.paidAmount, 0);
      const mDel = deliveries.filter(d => d.date?.startsWith(ym)).length;
      const mRet = returns.filter(r => r.date?.startsWith(ym)).length;
      const allOrders = orders.filter(o => o.date?.startsWith(ym)).length;
      return {
        month: toMonthLabel(ym), ym,
        revenue, cost, profit: revenue - cost,
        orders: allOrders, deliveries: mDel, collections: mCol, returns: mRet,
      };
    });
  }, [orders, deliveries, collections, returns, lang]);

  const orderStatusDist = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) { map[o.status] = (map[o.status] || 0) + 1; }
    return Object.entries(map).map(([name, value]) => ({ name, value, fill: STATUS_COLORS[name] || "#9ca3af" }));
  }, [orders]);

  const clientPortfolio = useMemo(() => {
    const map = new Map<string, { name: string; id: string; orders: number; revenue: number; cost: number; paid: number; returns: number }>();
    for (const o of deliveredOrders) {
      const key = o.clientId;
      const existing = map.get(key);
      if (existing) {
        existing.orders++;
        existing.revenue += o.totalSelling;
        existing.cost += o.totalCost;
      } else {
        map.set(key, { name: o.client, id: key, orders: 1, revenue: o.totalSelling, cost: o.totalCost, paid: 0, returns: 0 });
      }
    }
    for (const c of collections) {
      const entry = map.get(c.clientId);
      if (entry) entry.paid += c.paidAmount;
    }
    for (const r of returns) {
      const entry = map.get(r.clientId);
      if (entry) entry.returns++;
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [deliveredOrders, collections, returns]);

  const atRiskClients = useMemo(() => {
    const risks: { name: string; id: string; reasons: string[] }[] = [];
    const clientOrderDates: Record<string, string> = {};
    for (const o of orders) {
      if (!clientOrderDates[o.clientId] || o.date > clientOrderDates[o.clientId]) {
        clientOrderDates[o.clientId] = o.date;
      }
    }
    const clientCollectionDates: Record<string, string> = {};
    for (const c of collections) {
      if (!clientCollectionDates[c.clientId] || c.date > clientCollectionDates[c.clientId]) {
        clientCollectionDates[c.clientId] = c.date;
      }
    }
    const clientReturns: Record<string, number> = {};
    const clientOrders: Record<string, number> = {};
    for (const r of returns) { clientReturns[r.clientId] = (clientReturns[r.clientId] || 0) + 1; }
    for (const o of orders) { clientOrders[o.clientId] = (clientOrders[o.clientId] || 0) + 1; }

    const clientBalances: Record<string, number> = {};
    for (const c of collections) {
      if (!clientBalances[c.clientId]) clientBalances[c.clientId] = 0;
      clientBalances[c.clientId] += (c.totalAmount - c.paidAmount);
    }

    for (const cl of clients) {
      const reasons: string[] = [];
      const lastOrder = clientOrderDates[cl.id];
      if (lastOrder) {
        const daysSince = Math.floor((Date.now() - new Date(lastOrder).getTime()) / 86400000);
        if (daysSince > 45) reasons.push(t.coAtRiskInactive.replace("{days}", String(daysSince)));
      }
      const balance = clientBalances[cl.id] || 0;
      if (balance > 0) {
        const lastCol = clientCollectionDates[cl.id];
        const daysSinceCol = lastCol ? Math.floor((Date.now() - new Date(lastCol).getTime()) / 86400000) : 999;
        if (daysSinceCol > 30) reasons.push(t.coAtRiskOverdue);
      }
      const retCount = clientReturns[cl.id] || 0;
      const ordCount = clientOrders[cl.id] || 0;
      if (ordCount > 0 && (retCount / ordCount) > 0.15) reasons.push(t.coAtRiskHighReturns);

      if (reasons.length > 0) risks.push({ name: cl.name, id: cl.id, reasons });
    }
    return risks;
  }, [clients, orders, collections, returns, lang]);

  const inventoryPredictions = useMemo(() => {
    const map = new Map<string, { material: string; code: string; remaining: number; avgWeekly: number; unit: string }>();
    for (const item of clientInventory) {
      const key = item.code || item.material;
      const existing = map.get(key);
      if (existing) {
        existing.remaining += item.remaining;
        existing.avgWeekly = Math.max(existing.avgWeekly, item.avgWeeklyUsage);
      } else {
        map.set(key, { material: item.material, code: item.code, remaining: item.remaining, avgWeekly: item.avgWeeklyUsage, unit: item.unit });
      }
    }
    return [...map.values()]
      .filter(i => i.remaining > 0)
      .map(i => {
        const weeksLeft = i.avgWeekly > 0 ? i.remaining / i.avgWeekly : null;
        return { ...i, weeksLeft };
      })
      .sort((a, b) => {
        if (a.weeksLeft === null && b.weeksLeft === null) return 0;
        if (a.weeksLeft === null) return 1;
        if (b.weeksLeft === null) return -1;
        return a.weeksLeft - b.weeksLeft;
      })
      .slice(0, 20);
  }, [clientInventory]);

  const supplierAnalysis = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; cost: number }>();
    for (const o of orders) {
      const suppliers = o.lineSuppliers || [];
      for (const s of suppliers) {
        if (!s) continue;
        const sName = typeof s === "string" ? s : (s.name || s);
        const existing = map.get(sName);
        if (existing) {
          existing.orders++;
          existing.cost += o.totalCost / Math.max(1, suppliers.length);
        } else {
          map.set(sName, { name: sName, orders: 1, cost: o.totalCost / Math.max(1, suppliers.length) });
        }
      }
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost).slice(0, 10);
  }, [orders]);

  const returnsByClient = useMemo(() => {
    const map = new Map<string, { name: string; count: number; value: number }>();
    for (const r of returns) {
      const key = r.clientId;
      const existing = map.get(key);
      if (existing) {
        existing.count += r.itemCount;
        existing.value += r.totalValue;
      } else {
        map.set(key, { name: r.clientName || key, count: r.itemCount, value: r.totalValue });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [returns]);

  const topMaterials = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; qty: number }>();
    for (const item of clientInventory) {
      const key = item.code || item.material;
      const existing = map.get(key);
      const rev = item.sellingPrice * item.delivered;
      if (existing) {
        existing.revenue += rev;
        existing.qty += item.delivered;
      } else {
        map.set(key, { name: item.material, revenue: rev, qty: item.delivered });
      }
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [clientInventory]);

  const clientSegments = useMemo(() => {
    const high = clientPortfolio.filter(c => c.revenue > 50000).length;
    const med = clientPortfolio.filter(c => c.revenue > 10000 && c.revenue <= 50000).length;
    const low = clientPortfolio.filter(c => c.revenue > 0 && c.revenue <= 10000).length;
    const newClients = clients.length - clientPortfolio.length;
    return [
      { name: t.coHighValue, value: high, fill: "#22c55e" },
      { name: t.coMedium, value: med, fill: "#3b82f6" },
      { name: t.coLow, value: low, fill: "#f59e0b" },
      { name: t.coNew, value: Math.max(0, newClients), fill: "#9ca3af" },
    ].filter(s => s.value > 0);
  }, [clientPortfolio, clients, lang]);

  const treasuryStats = useMemo(() => {
    const inflow = treasury.filter(tx => ["inflow", "deposit", "founder_contribution"].includes(tx.type)).reduce((s, tx) => s + tx.amount, 0);
    const outflow = treasury.filter(tx => ["expense", "withdrawal", "capital_withdrawal", "transfer"].includes(tx.type)).reduce((s, tx) => s + tx.amount, 0);
    return { inflow, outflow, net: inflow - outflow };
  }, [treasury]);

  const monthlyGrowth = useMemo(() => {
    if (monthlyTrend.length < 2) return 0;
    const cur = monthlyTrend[monthlyTrend.length - 1];
    const prev = monthlyTrend[monthlyTrend.length - 2];
    if (prev.revenue === 0) return cur.revenue > 0 ? 100 : 0;
    return Math.round(((cur.revenue - prev.revenue) / prev.revenue) * 100);
  }, [monthlyTrend]);

  const periodComparison = useMemo(() => {
    if (monthlyTrend.length < 2) return null;
    const cur = monthlyTrend[monthlyTrend.length - 1];
    const prev = monthlyTrend[monthlyTrend.length - 2];
    const pctChange = (field: string) => {
      const c = (cur as any)[field] || 0;
      const p = (prev as any)[field] || 0;
      if (p === 0) return c > 0 ? 100 : 0;
      return Math.round(((c - p) / p) * 100);
    };
    return {
      curMonth: cur.month, prevMonth: prev.month,
      revenue: { cur: cur.revenue, prev: prev.revenue, pct: pctChange("revenue") },
      profit: { cur: cur.profit, prev: prev.profit, pct: pctChange("profit") },
      orders: { cur: cur.orders, prev: prev.orders, pct: pctChange("orders") },
      collections: { cur: cur.collections, prev: prev.collections, pct: pctChange("collections") },
    };
  }, [monthlyTrend]);

  const bestWorstMonth = useMemo(() => {
    const withRevenue = monthlyTrend.filter(m => m.revenue > 0);
    if (withRevenue.length === 0) return null;
    const best = withRevenue.reduce((a, b) => b.revenue > a.revenue ? b : a);
    const worst = withRevenue.reduce((a, b) => b.revenue < a.revenue ? b : a);
    return { best, worst };
  }, [monthlyTrend]);

  const revenueForecast = useMemo(() => {
    const last6 = monthlyTrend.slice(-6);
    if (last6.filter(m => m.revenue > 0).length < 3) return null;
    const n = last6.length;
    const xMean = (n - 1) / 2;
    const yMean = last6.reduce((s, m) => s + m.revenue, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (last6[i].revenue - yMean);
      den += (i - xMean) * (i - xMean);
    }
    const slope = den !== 0 ? num / den : 0;
    const forecast = Math.max(0, Math.round(yMean + slope * (n - xMean)));
    const trend = slope > 0 ? "up" : slope < 0 ? "down" : "flat";
    return { forecast, trend, avgLast6: Math.round(yMean) };
  }, [monthlyTrend]);

  const clientGrowth = useMemo(() => {
    const now = new Date();
    const months: { ym: string; label: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const count = clients.filter(c => {
        const jd = c.joinDate || c.join_date || c.createdAt || c.created_at || "";
        return jd && jd.startsWith(ym);
      }).length;
      months.push({ ym, label: toMonthLabel(ym), count });
    }
    const total = months.reduce((s, m) => s + m.count, 0);
    const avgPerMonth = months.length > 0 ? Math.round((total / months.length) * 10) / 10 : 0;
    return { months: months.filter(m => m.count > 0), total, avgPerMonth };
  }, [clients, lang]);

  const companyHealthScore = useMemo(() => {
    const profitScore = Math.min(100, Math.max(0, profitMargin * 2.5));
    const collScore = collectionTotals.rate;
    const growthScore = Math.min(100, Math.max(0, 50 + monthlyGrowth));
    const returnRate = orders.length > 0 ? (returns.length / orders.length) * 100 : 0;
    const retScore = Math.max(0, 100 - returnRate * 3);
    const deliveryRate = deliveries.length > 0 ? (confirmedDeliveries / deliveries.length) * 100 : 100;

    const overall = Math.round(
      profitScore * 0.25 +
      collScore * 0.25 +
      growthScore * 0.20 +
      retScore * 0.15 +
      deliveryRate * 0.15
    );
    return {
      overall: Math.min(100, Math.max(0, overall)),
      profitScore: Math.round(profitScore),
      collScore: Math.round(collScore),
      growthScore: Math.round(growthScore),
      retScore: Math.round(retScore),
      deliveryRate: Math.round(deliveryRate),
    };
  }, [profitMargin, collectionTotals, monthlyGrowth, orders, returns, deliveries, confirmedDeliveries]);

  const healthLabel = (score: number) => {
    if (score >= 80) return { label: t.coExcellent, color: "text-green-600", ring: "#22c55e" };
    if (score >= 60) return { label: t.coGood, color: "text-blue-600", ring: "#3b82f6" };
    if (score >= 40) return { label: t.coAverage, color: "text-amber-600", ring: "#f59e0b" };
    return { label: t.coWeak, color: "text-red-600", ring: "#ef4444" };
  };

  const radarData = useMemo(() => [
    { metric: t.coProfitMargin, value: companyHealthScore.profitScore },
    { metric: t.coCollectionRate, value: companyHealthScore.collScore },
    { metric: t.coGrowth, value: companyHealthScore.growthScore },
    { metric: t.coReturnRate, value: companyHealthScore.retScore },
    { metric: t.coDeliveryRate, value: companyHealthScore.deliveryRate },
  ], [companyHealthScore, lang]);

  const agingAnalysis = useMemo(() => {
    let a30 = 0, a60 = 0, a90 = 0, a90p = 0;
    const now = Date.now();
    for (const c of collections) {
      const outstanding = c.totalAmount - c.paidAmount;
      if (outstanding <= 0) continue;
      const days = c.date ? Math.floor((now - new Date(c.date).getTime()) / 86400000) : 999;
      if (days <= 30) a30 += outstanding;
      else if (days <= 60) a60 += outstanding;
      else if (days <= 90) a90 += outstanding;
      else a90p += outstanding;
    }
    return [
      { name: t.coAging30, value: a30, fill: "#22c55e" },
      { name: t.coAging60, value: a60, fill: "#f59e0b" },
      { name: t.coAging90, value: a90, fill: "#f97316" },
      { name: t.coAging90Plus, value: a90p, fill: "#ef4444" },
    ].filter(a => a.value > 0);
  }, [collections, lang]);

  const handleExport = () => {
    const sections = [
      {
        title: `📊 ${t.coHealthScore}`,
        headers: [isEn ? "Metric" : "المقياس", isEn ? "Score" : "النتيجة"],
        rows: [
          [isEn ? "Overall" : "إجمالي", `${companyHealthScore.overall}/100`],
          [t.coProfitMargin, `${companyHealthScore.profitScore}%`],
          [t.coCollectionRate, `${companyHealthScore.collScore}%`],
          [t.coGrowth, `${companyHealthScore.growthScore}%`],
          [t.coReturnRate, `${companyHealthScore.retScore}%`],
          [t.coDeliveryRate, `${companyHealthScore.deliveryRate}%`],
        ] as (string | number)[][],
      },
      {
        title: `💰 ${isEn ? "Financial Summary" : "ملخص مالي"}`,
        headers: [isEn ? "Metric" : "البند", isEn ? "Value" : "القيمة"],
        rows: [
          [t.coTotalRevenue, totalRevenue],
          [t.coTotalCost, totalCost],
          [t.coNetProfit, netProfit],
          [t.coProfitMargin, `${profitMargin}%`],
          [t.coTotalCollected, collectionTotals.paidAmount],
          [t.coOutstanding, collectionTotals.remaining],
          [t.coCollectionRate, `${collectionTotals.rate}%`],
          [t.coTotalOrders, orders.length],
          [t.coActiveClients, activeClients],
          [t.coTotalDeliveries, deliveries.length],
          [t.coTotalReturns, returns.length],
        ] as (string | number)[][],
      },
      {
        title: `👥 ${t.coTopClients}`,
        headers: [t.coClientName, t.coClientOrders, t.coClientRevenue, t.coClientProfitMargin, t.coClientPaid, t.coClientBalance],
        rows: clientPortfolio.slice(0, 15).map(c => {
          const m = c.revenue > 0 ? Math.round(((c.revenue - c.cost) / c.revenue) * 100) : 0;
          return [c.name, c.orders, c.revenue, `${m}%`, c.paid, c.revenue - c.paid];
        }),
      },
      {
        title: `📈 ${t.coMonthlyTrend}`,
        headers: [isEn ? "Month" : "الشهر", t.coRevenueByMonth, t.coCostByMonth, t.coProfitByMonth, t.coMonthlyOrders, t.coMonthlyCollections],
        rows: monthlyTrend.map(m => [m.month, m.revenue, m.cost, m.profit, m.orders, m.collections]),
      },
      {
        title: `⚠️ ${t.coAtRiskClients}`,
        headers: [t.coClientName, isEn ? "Reasons" : "الأسباب"],
        rows: atRiskClients.length > 0 ? atRiskClients.map(c => [c.name, c.reasons.join(" | ")]) : [[(isEn ? "No at-risk clients" : "لا يوجد عملاء معرضون للخطر"), ""]],
      },
      {
        title: `📦 ${t.coInventoryPredictions}`,
        headers: [t.coMaterial, t.coTotalRemaining, t.coWeeklyUsage, t.coEstRunout],
        rows: inventoryPredictions.map(i => [i.material, i.remaining, i.avgWeekly > 0 ? i.avgWeekly.toFixed(1) : "—", i.weeksLeft !== null ? `${i.weeksLeft.toFixed(1)} ${t.coWeeks}` : "—"]),
      },
      {
        title: `🏭 ${t.coSupplierAnalysis}`,
        headers: [t.coSupplier, t.coOrderCount, t.coTotalCostVal],
        rows: supplierAnalysis.map(s => [s.name, s.orders, Math.round(s.cost)]),
      },
    ];
    exportMultiSectionCsv("company_analysis", sections);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir={dir}>
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const hi = healthLabel(companyHealthScore.overall);

  return (
    <div dir={dir} className="min-h-screen bg-background print-report-page">
      <div className="hidden print:block print-fixed-header">
        <div className="flex items-center justify-between px-4 py-1 text-xs">
          <div className="flex items-center gap-2">
            <img src="/images/dsb-logo.png" alt="DSB" className="h-6" />
            <span className="font-bold">Dental Smart Box</span>
          </div>
          <span>{t.coTitle} — {new Date().toLocaleDateString(dateLocale)}</span>
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
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" /> {t.coTitle}
            </h1>
            <p className="text-sm text-muted-foreground">{t.coSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline ms-1">{t.coExport}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline ms-1">{t.coPrint}</span>
            </Button>
          </div>
        </div>

        <div className="hidden print:block mb-4">
          <div className="flex items-center gap-4">
            <img src="/images/dsb-logo.png" alt="DSB" className="h-12" />
            <div>
              <h1 className="text-xl font-bold">{t.coTitle}</h1>
              <p className="text-sm text-muted-foreground">{t.coSubtitle}</p>
              <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPI icon={<DollarSign className="h-5 w-5" />} label={t.coTotalRevenue} value={cur(totalRevenue)} color="text-green-600 bg-green-100" />
          <KPI icon={<TrendingUp className="h-5 w-5" />} label={t.coNetProfit} value={cur(netProfit)} sub={`${profitMargin}% ${t.coMargin}`} color="text-blue-600 bg-blue-100" />
          <KPI icon={<ShoppingCart className="h-5 w-5" />} label={t.coTotalOrders} value={String(orders.length)} color="text-orange-600 bg-orange-100" />
          <KPI icon={<Users className="h-5 w-5" />} label={t.coActiveClients} value={String(activeClients)} sub={`/ ${clients.length}`} color="text-purple-600 bg-purple-100" />
          <KPI icon={<CreditCard className="h-5 w-5" />} label={t.coCollectionRate} value={`${collectionTotals.rate}%`} sub={cur(collectionTotals.remaining)} color={collectionTotals.rate >= 80 ? "text-green-600 bg-green-100" : "text-red-600 bg-red-100"} />
          <KPI icon={<RotateCcw className="h-5 w-5" />} label={t.coTotalReturns} value={String(returns.length)} color="text-red-600 bg-red-100" />
        </div>

        {/* Period Comparison */}
        {periodComparison && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: t.coTotalRevenue, cur: periodComparison.revenue.cur, prev: periodComparison.revenue.prev, pct: periodComparison.revenue.pct, isCur: true },
              { label: t.coNetProfit, cur: periodComparison.profit.cur, prev: periodComparison.profit.prev, pct: periodComparison.profit.pct, isCur: true },
              { label: t.coTotalOrders, cur: periodComparison.orders.cur, prev: periodComparison.orders.prev, pct: periodComparison.orders.pct, isCur: false },
              { label: t.coMonthlyCollections, cur: periodComparison.collections.cur, prev: periodComparison.collections.prev, pct: periodComparison.collections.pct, isCur: true },
            ].map((item, i) => (
              <div key={i} className="bg-card rounded-xl border p-3">
                <p className="text-xs text-muted-foreground mb-1 truncate">{item.label}</p>
                <p className="text-sm font-bold">{item.isCur ? cur(item.cur) : item.cur}</p>
                <div className="flex items-center gap-1 mt-1">
                  {item.pct > 0 ? <ArrowUpRight className="h-3 w-3 text-green-600" /> : item.pct < 0 ? <ArrowDownRight className="h-3 w-3 text-red-600" /> : null}
                  <span className={`text-xs font-bold ${item.pct > 0 ? "text-green-600" : item.pct < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                    {item.pct > 0 ? "+" : ""}{item.pct}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">{t.coVsLastMonth}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{periodComparison.prevMonth}: {item.isCur ? cur(item.prev) : item.prev}</p>
              </div>
            ))}
          </div>
        )}

        {/* Monthly Highlights + Forecast */}
        {(bestWorstMonth || revenueForecast || clientGrowth.total > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {bestWorstMonth && (
              <div className="bg-card rounded-xl border p-4 text-center">
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-xs text-muted-foreground">{t.coBestMonth}</p>
                <p className="text-sm font-bold text-green-600">{bestWorstMonth.best.month}</p>
                <p className="text-xs font-semibold">{cur(bestWorstMonth.best.revenue)}</p>
              </div>
            )}
            {bestWorstMonth && (
              <div className="bg-card rounded-xl border p-4 text-center">
                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center mx-auto mb-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
                <p className="text-xs text-muted-foreground">{t.coWorstMonth}</p>
                <p className="text-sm font-bold text-red-600">{bestWorstMonth.worst.month}</p>
                <p className="text-xs font-semibold">{cur(bestWorstMonth.worst.revenue)}</p>
              </div>
            )}
            {revenueForecast && (
              <div className="bg-card rounded-xl border p-4 text-center">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2 ${revenueForecast.trend === "up" ? "bg-blue-100" : "bg-amber-100"}`}>
                  <Target className={`h-5 w-5 ${revenueForecast.trend === "up" ? "text-blue-600" : "text-amber-600"}`} />
                </div>
                <p className="text-xs text-muted-foreground">{t.coNextMonthForecast}</p>
                <p className="text-sm font-bold">{cur(revenueForecast.forecast)}</p>
                <p className="text-[10px] text-muted-foreground">{t.coBasedOnTrend}</p>
              </div>
            )}
            {clientGrowth.total > 0 && (
              <div className="bg-card rounded-xl border p-4 text-center">
                <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center mx-auto mb-2">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-xs text-muted-foreground">{t.coClientGrowth}</p>
                <p className="text-sm font-bold text-purple-600">{clientGrowth.total} {t.coNewClients}</p>
                <p className="text-[10px] text-muted-foreground">~{clientGrowth.avgPerMonth} {t.coNewClientsPerMonth}</p>
              </div>
            )}
          </div>
        )}

        {/* Health Score + Radar + Treasury */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-card rounded-2xl border p-6 flex flex-col items-center">
            <h2 className="text-lg font-bold mb-3">{t.coHealthScore}</h2>
            <div className="relative w-36 h-36 mb-3">
              <svg viewBox="0 0 120 120" className="w-full h-full">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle cx="60" cy="60" r="54" fill="none" stroke={hi.ring} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(companyHealthScore.overall / 100) * 339.3} 339.3`} transform="rotate(-90 60 60)" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-black ${hi.color}`}>{companyHealthScore.overall}</span>
                <span className={`text-sm font-semibold ${hi.color}`}>{hi.label}</span>
              </div>
            </div>
            <div className="w-full space-y-1.5 text-sm">
              <ScoreBar label={t.coProfitMargin} value={companyHealthScore.profitScore} />
              <ScoreBar label={t.coCollectionRate} value={companyHealthScore.collScore} />
              <ScoreBar label={t.coGrowth} value={companyHealthScore.growthScore} />
              <ScoreBar label={t.coReturnRate} value={companyHealthScore.retScore} />
              <ScoreBar label={t.coDeliveryRate} value={companyHealthScore.deliveryRate} />
            </div>
          </div>

          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-3">{t.coRevenueVsTarget}</h2>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} outerRadius="70%">
                <PolarGrid stroke={GRID_COLOR} />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "currentColor" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-3">{t.coTreasuryBalance}</h2>
            <div className="space-y-4">
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground">{t.coInflow}</p>
                <p className="text-xl font-black text-green-600">{cur(treasuryStats.inflow)}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground">{t.coOutflow}</p>
                <p className="text-xl font-black text-red-600">{cur(treasuryStats.outflow)}</p>
              </div>
              <div className={`rounded-xl p-4 text-center ${treasuryStats.net >= 0 ? "bg-blue-50" : "bg-red-50"}`}>
                <p className="text-xs text-muted-foreground">{t.coNetCashFlow}</p>
                <p className={`text-xl font-black ${treasuryStats.net >= 0 ? "text-blue-600" : "text-red-600"}`}>{cur(treasuryStats.net)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Revenue & Profit Trend */}
        <div className="bg-card rounded-2xl border p-6 page-break-before">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> {t.coMonthlyTrend}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "currentColor" }} />
              <YAxis tick={{ fontSize: 10, fill: "currentColor" }} />
              <Tooltip contentStyle={{ fontSize: "12px", direction: dir as "rtl" | "ltr" }} formatter={(v: number) => cur(v)} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="revenue" name={t.coRevenueByMonth} fill="#f97316" radius={[3, 3, 0, 0]} />
              <Bar dataKey="cost" name={t.coCostByMonth} fill="#94a3b8" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="profit" name={t.coProfitByMonth} stroke="#22c55e" strokeWidth={2.5} dot={{ fill: "#22c55e", r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Order Status + Client Segments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" /> {t.coOrderStatusDist}
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={orderStatusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, value }) => `${name} (${value})`} labelLine={false} style={{ fontSize: "10px" }}>
                  {orderStatusDist.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> {t.coClientSegments}
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={clientSegments} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, value }) => `${name} (${value})`} labelLine={false} style={{ fontSize: "11px" }}>
                  {clientSegments.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Clients Table */}
        <div className="bg-card rounded-2xl border p-6 page-break-before">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> {t.coTopClients}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-primary/20">
                  <th className="text-start py-2 font-bold">#</th>
                  <th className="text-start py-2 font-bold">{t.coClientName}</th>
                  <th className="text-center py-2 font-bold">{t.coClientOrders}</th>
                  <th className="text-center py-2 font-bold">{t.coClientRevenue}</th>
                  <th className="text-center py-2 font-bold">{t.coClientProfitMargin}</th>
                  <th className="text-center py-2 font-bold">{t.coClientPaid}</th>
                  <th className="text-center py-2 font-bold">{t.coClientBalance}</th>
                </tr>
              </thead>
              <tbody>
                {clientPortfolio.slice(0, 15).map((c, i) => {
                  const margin = c.revenue > 0 ? Math.round(((c.revenue - c.cost) / c.revenue) * 100) : 0;
                  return (
                  <tr key={i} className="border-b border-muted/30 cursor-pointer hover:bg-muted/20" onClick={() => navigate(`/clients/${c.id}`)}>
                    <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="py-2.5 font-medium">{c.name}</td>
                    <td className="text-center py-2.5">{c.orders}</td>
                    <td className="text-center py-2.5">{cur(c.revenue)}</td>
                    <td className="text-center py-2.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${margin >= 30 ? "bg-green-100 text-green-700" : margin >= 15 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{margin}%</span>
                    </td>
                    <td className="text-center py-2.5">{cur(c.paid)}</td>
                    <td className="text-center py-2.5">
                      <span className={c.revenue - c.paid > 0 ? "text-red-600 font-bold" : "text-green-600"}>{cur(c.revenue - c.paid)}</span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* At-Risk Clients */}
        {atRiskClients.length > 0 && (
          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" /> {t.coAtRiskClients}
            </h2>
            <div className="space-y-2">
              {atRiskClients.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200 cursor-pointer hover:bg-red-100" onClick={() => navigate(`/clients/${c.id}`)}>
                  <span className="font-medium text-red-800">{c.name}</span>
                  <div className="flex gap-2">
                    {c.reasons.map((r, j) => (
                      <span key={j} className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full">{r}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Materials + Delivery Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 page-break-before">
          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> {t.coTopMaterials}
            </h2>
            {topMaterials.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{t.coNoData}</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topMaterials.map(m => ({ ...m, name: m.name.length > 15 ? m.name.slice(0, 15) + "…" : m.name }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "currentColor" }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "currentColor" }} width={120} />
                  <Tooltip contentStyle={{ fontSize: "12px", direction: dir as "rtl" | "ltr" }} formatter={(v: number) => cur(v)} />
                  <Bar dataKey="revenue" name={t.coMaterialRevenue} fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" /> {t.coDeliveryPerformance}
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-green-600">{confirmedDeliveries}</p>
                <p className="text-xs text-muted-foreground">{t.coConfirmedDeliveries}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-amber-600">{deliveries.length - confirmedDeliveries}</p>
                <p className="text-xs text-muted-foreground">{t.coPendingDeliveries}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t.coDeliveryRate}:</span>
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${deliveries.length > 0 ? Math.round((confirmedDeliveries / deliveries.length) * 100) : 0}%` }} />
              </div>
              <span className="font-bold">{deliveries.length > 0 ? Math.round((confirmedDeliveries / deliveries.length) * 100) : 0}%</span>
            </div>
          </div>
        </div>

        {/* Collection Health + Aging */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 page-break-before">
          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> {t.coCollectionHealth}
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground">{t.coCollected}</p>
                <p className="text-xl font-black text-green-600">{cur(collectionTotals.paidAmount)}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground">{t.coRemaining}</p>
                <p className="text-xl font-black text-red-600">{cur(collectionTotals.remaining)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm mt-2">
              <span className="text-muted-foreground">{t.coCollectionRate}:</span>
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${collectionTotals.rate >= 80 ? "bg-green-500" : collectionTotals.rate >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${collectionTotals.rate}%` }} />
              </div>
              <span className="font-bold">{collectionTotals.rate}%</span>
            </div>
          </div>

          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> {t.coAgingAnalysis}
            </h2>
            {agingAnalysis.length === 0 ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">{isEn ? "No outstanding balances" : "لا توجد أرصدة مستحقة"}</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={agingAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "currentColor" }} />
                  <YAxis tick={{ fontSize: 10, fill: "currentColor" }} />
                  <Tooltip contentStyle={{ fontSize: "12px", direction: dir as "rtl" | "ltr" }} formatter={(v: number) => cur(v)} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {agingAnalysis.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Inventory Predictions */}
        <div className="bg-card rounded-2xl border p-6 page-break-before">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-primary" /> {t.coInventoryPredictions}
          </h2>
          {inventoryPredictions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t.coNoData}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-primary/20">
                    <th className="text-start py-2 font-bold">{t.coMaterial}</th>
                    <th className="text-center py-2 font-bold">{t.coTotalRemaining}</th>
                    <th className="text-center py-2 font-bold">{t.coWeeklyUsage}</th>
                    <th className="text-center py-2 font-bold">{t.coEstRunout}</th>
                    <th className="text-center py-2 font-bold">{""}</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryPredictions.map((item, i) => {
                    const status = item.weeksLeft === null ? "ok" : item.weeksLeft <= 2 ? "critical" : item.weeksLeft <= 6 ? "soon" : "ok";
                    return (
                      <tr key={i} className="border-b border-muted/30">
                        <td className="py-2.5 font-medium max-w-[200px] truncate">{item.material}</td>
                        <td className="text-center py-2.5">{item.remaining} {item.unit}</td>
                        <td className="text-center py-2.5">{item.avgWeekly > 0 ? item.avgWeekly.toFixed(1) : "—"}</td>
                        <td className="text-center py-2.5">
                          {item.weeksLeft !== null ? `${item.weeksLeft.toFixed(1)} ${t.coWeeks}` : "—"}
                        </td>
                        <td className="text-center py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            status === "critical" ? "bg-red-100 text-red-700" :
                            status === "soon" ? "bg-amber-100 text-amber-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            {status === "critical" ? t.coReorderNeeded : status === "soon" ? (isEn ? "Low" : "منخفض") : (isEn ? "OK" : "جيد")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Supplier Analysis + Returns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 page-break-before">
          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Factory className="h-5 w-5 text-primary" /> {t.coSupplierAnalysis}
            </h2>
            {supplierAnalysis.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{t.coNoData}</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={supplierAnalysis.map(s => ({ ...s, name: s.name.length > 12 ? s.name.slice(0, 12) + "…" : s.name, cost: Math.round(s.cost) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "currentColor" }} />
                  <YAxis tick={{ fontSize: 10, fill: "currentColor" }} />
                  <Tooltip contentStyle={{ fontSize: "12px", direction: dir as "rtl" | "ltr" }} formatter={(v: number) => cur(v)} />
                  <Bar dataKey="cost" name={t.coTotalCostVal} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" /> {t.coReturnsAnalysis}
            </h2>
            {returnsByClient.length === 0 ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">{isEn ? "No returns recorded" : "لا توجد مرتجعات"}</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={returnsByClient.map(r => ({ ...r, name: r.name.length > 12 ? r.name.slice(0, 12) + "…" : r.name }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "currentColor" }} />
                  <YAxis tick={{ fontSize: 10, fill: "currentColor" }} />
                  <Tooltip contentStyle={{ fontSize: "12px", direction: dir as "rtl" | "ltr" }} />
                  <Bar dataKey="count" name={isEn ? "Return Items" : "عناصر مرتجعة"} fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Monthly Activity Overview */}
        <div className="bg-card rounded-2xl border p-6 page-break-before">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> {isEn ? "Monthly Activity Overview" : "نظرة شهرية على النشاط"}
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "currentColor" }} />
              <YAxis tick={{ fontSize: 10, fill: "currentColor" }} />
              <Tooltip contentStyle={{ fontSize: "12px", direction: dir as "rtl" | "ltr" }} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="orders" name={t.coMonthlyOrders} fill="#f97316" radius={[3, 3, 0, 0]} />
              <Bar dataKey="deliveries" name={t.coMonthlyDeliveries} fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="returns" name={t.coMonthlyReturns} fill="#ef4444" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="collections" name={t.coMonthlyCollections} stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e", r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Client Growth */}
        {clientGrowth.months.length > 0 && (
          <div className="bg-card rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> {t.coClientGrowth}
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={clientGrowth.months}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "currentColor" }} />
                <YAxis tick={{ fontSize: 10, fill: "currentColor" }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: "12px", direction: dir as "rtl" | "ltr" }} />
                <Bar dataKey="count" name={t.coNewClients} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>
    </div>
  );
}

function KPI({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  const [iconColor, bgColor] = color.split(" ");
  return (
    <div className="bg-card rounded-xl border p-3 flex flex-col items-center text-center gap-1">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bgColor} ${iconColor}`}>{icon}</div>
      <p className="text-xs text-muted-foreground leading-tight mt-1">{label}</p>
      <p className="text-sm font-bold leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground flex-1 text-xs">{label}</span>
      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${value >= 80 ? "bg-green-500" : value >= 60 ? "bg-blue-500" : value >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-bold w-8 text-end">{value}%</span>
    </div>
  );
}