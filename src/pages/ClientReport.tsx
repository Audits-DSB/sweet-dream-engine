import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { exportMultiSectionCsv } from "@/lib/exportCsv";
import {
  Printer, ArrowRight, ArrowLeft, Package, TrendingDown, TrendingUp, BarChart3, PieChart as PieChartIcon,
  ShoppingCart, Truck, ClipboardCheck, CalendarDays, DollarSign, Download,
  Receipt, RotateCcw, AlertTriangle, Loader2, CreditCard, ChevronRight, ChevronLeft,
  Calendar, FileText, Award, Users,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, ComposedChart,
} from "recharts";

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#06b6d4", "#eab308", "#ec4899", "#14b8a6", "#6366f1"];
const GRID_COLOR = "#e5e7eb";
const AXIS_TICK = { fontSize: 12, fill: "currentColor", fontWeight: 600 };
const PIE_LABEL_STYLE = { fontSize: "10px", fontWeight: 600, fill: "currentColor" };

const QR_URL = "https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://dsbs.store";

export default function ClientReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang, dir } = useLanguage();
  const isEn = lang === "en";
  const dateLocale = isEn ? "en-US" : "ar-EG";

  const MONTH_NAMES = [t.crMonthJan, t.crMonthFeb, t.crMonthMar, t.crMonthApr, t.crMonthMay, t.crMonthJun, t.crMonthJul, t.crMonthAug, t.crMonthSep, t.crMonthOct, t.crMonthNov, t.crMonthDec];

  const TOOLTIP_STYLE = { backgroundColor: "#fff", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "13px", direction: dir as "rtl" | "ltr", color: "#111" };

  function toMonthLabel(ym: string) {
    const m = parseInt(ym.slice(5));
    return MONTH_NAMES[m - 1] || ym.slice(5);
  }

  function toYMLabel(ym: string) {
    const [y, m] = ym.split("-");
    return `${MONTH_NAMES[parseInt(m) - 1] || m} ${y}`;
  }

  function toFullMonthLabel(ym: string) {
    const [y, m] = ym.split("-");
    const monthName = MONTH_NAMES[parseInt(m) - 1] || m;
    return isEn ? `${monthName} ${y}` : `${t.crMonthPrefix} ${monthName} ${y}`;
  }

  function statusLabel(s: string) {
    const map: Record<string, string> = {
      Delivered: t.crStatusDelivered, Processing: t.crStatusProcessing, Draft: t.crStatusDraft, Confirmed: t.crStatusConfirmed,
      Cancelled: t.crStatusCancelled, Closed: t.crStatusClosed, Completed: t.crStatusCompleted, "Ready for Delivery": t.crStatusReady,
      "Partially Delivered": t.crStatusPartial, "In Transit": t.crStatusTransit, Scheduled: t.crStatusScheduled,
      Accepted: t.crStatusAccepted, Pending: t.crStatusPending,
    };
    return map[s] || s;
  }

  function cur(v: number) {
    return `${v.toLocaleString()} ${t.crCurrency}`;
  }

  const [client, setClient] = useState<any>(null);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [allCollections, setAllCollections] = useState<any[]>([]);
  const [orderLines, setOrderLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"full" | "monthly">("full");
  const [selectedMonth, setSelectedMonth] = useState("");

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
      api.get<any[]>("/order-lines").catch(() => []),
    ]).then(([cl, inv, ord, del, aud, col, ret, oLines]) => {
      const allCl = (cl || []).filter((c: any) => c.name !== "company-inventory");
      setAllClients(allCl);
      const found = allCl.find((c: any) => c.id === id);
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
        imageUrl: r.imageUrl || r.image_url || "",
      })));
      const allOrd = (ord || []).filter((o: any) => {
        const cName = o.client || "";
        return cName !== "company-inventory";
      }).map((o: any) => ({
        id: o.id, date: o.date || "", totalSelling: Number(o.totalSelling ?? o.total_selling ?? 0),
        status: o.status || "", lines: Number(o.lines || 0),
        clientId: o.clientId || o.client_id || "",
      }));
      setAllOrders(allOrd);
      const clientOrders = allOrd.filter((o: any) => o.clientId === id).map((o: any) => ({
        id: o.id, date: o.date, totalSelling: o.totalSelling,
        status: o.status, lines: o.lines,
      })).sort((a: any, b: any) => b.date.localeCompare(a.date));
      setOrders(clientOrders);
      setDeliveries((del || []).filter((d: any) => (d.clientId || d.client_id) === id).map((d: any) => ({
        id: d.id, date: d.date || d.deliveryDate || d.delivery_date || "",
        status: d.status || "", items: Number(d.items || d.totalItems || d.total_items || 0),
        orderId: d.orderId || d.order_id || "",
      })).sort((a: any, b: any) => b.date.localeCompare(a.date)));
      setAudits((aud || []).filter((a: any) => (a.clientId || a.client_id) === id).sort((a: any, b: any) =>
        (b.date || b.createdAt || b.created_at || "").localeCompare(a.date || a.createdAt || a.created_at || "")
      ));
      const allCol = (col || []).map((c: any) => ({
        id: c.id, date: c.date || c.invoiceDate || c.invoice_date || c.createdAt || "",
        totalAmount: Number(c.totalAmount ?? c.total_amount ?? c.amount ?? 0),
        paidAmount: Number(c.paidAmount ?? c.paid_amount ?? c.paid ?? 0),
        status: c.status || "", clientId: c.clientId || c.client_id || "",
      }));
      setAllCollections(allCol);
      setCollections(allCol.filter((c: any) => c.clientId === id));
      setReturns((ret || []).filter((r: any) => (r.clientId || r.client_id) === id).map((r: any) => ({
        id: r.id, date: r.date || r.createdAt || r.created_at || "",
        status: r.status || "",
        itemCount: Array.isArray(r.items) ? r.items.length : Number(r.itemsCount || r.items_count || 1),
      })));

      const clientOrderIds = new Set(clientOrders.map((o: any) => o.id));
      setOrderLines((oLines || []).filter((l: any) => clientOrderIds.has(l.orderId || l.order_id)).map((l: any) => ({
        orderId: l.orderId || l.order_id || "",
        materialCode: l.materialCode || l.material_code || "",
        materialName: l.materialName || l.material_name || "",
        quantity: Number(l.quantity || 0),
        unit: l.unit || "unit",
      })));

      const allDates = [
        ...clientOrders.map(o => o.date),
        ...(del || []).filter((d: any) => (d.clientId || d.client_id) === id).map((d: any) => d.date || d.deliveryDate || d.delivery_date || ""),
      ].filter(Boolean).map(d => d.slice(0, 7));
      const uniqueMonths = [...new Set(allDates)].sort().reverse();
      if (uniqueMonths.length > 0) setSelectedMonth(uniqueMonths[0]);
    }).finally(() => setLoading(false));
  }, [id]);

  const availableMonths = useMemo(() => {
    const allDates = [
      ...orders.map(o => o.date),
      ...deliveries.map(d => d.date),
      ...collections.map(c => c.date),
      ...returns.map(r => r.date),
    ].filter(Boolean).map(d => d.slice(0, 7));
    return [...new Set(allDates)].sort().reverse();
  }, [orders, deliveries, collections, returns]);

  const aggregated = useMemo(() => {
    const map = new Map<string, { material: string; code: string; unit: string; totalDelivered: number; totalRemaining: number; totalConsumed: number; avgWeekly: number; sellingPrice: number; count: number; imageUrl: string }>();
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
        if (item.imageUrl && !existing.imageUrl) existing.imageUrl = item.imageUrl;
        existing.count++;
      } else {
        map.set(key, {
          material: item.material, code: item.code, unit: item.unit,
          totalDelivered: item.delivered, totalRemaining: item.remaining,
          totalConsumed: consumed, avgWeekly: item.avgWeeklyUsage,
          sellingPrice: item.sellingPrice, count: 1,
          imageUrl: item.imageUrl || "",
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

  const monthlyOverviewData = useMemo(() => {
    const map: Record<string, { ym: string; label: string; orders: number; value: number; deliveries: number; collections: number }> = {};
    for (const o of orders) {
      if (!o.date) continue;
      const ym = o.date.slice(0, 7);
      if (!map[ym]) map[ym] = { ym, label: toMonthLabel(ym), orders: 0, value: 0, deliveries: 0, collections: 0 };
      map[ym].orders++;
      map[ym].value += o.totalSelling;
    }
    for (const d of deliveries) {
      if (!d.date) continue;
      const ym = d.date.slice(0, 7);
      if (!map[ym]) map[ym] = { ym, label: toMonthLabel(ym), orders: 0, value: 0, deliveries: 0, collections: 0 };
      map[ym].deliveries++;
    }
    for (const c of collections) {
      if (!c.date) continue;
      const ym = c.date.slice(0, 7);
      if (!map[ym]) map[ym] = { ym, label: toMonthLabel(ym), orders: 0, value: 0, deliveries: 0, collections: 0 };
      map[ym].collections += c.paidAmount;
    }
    return Object.values(map).sort((a, b) => a.ym.localeCompare(b.ym)).slice(-12);
  }, [orders, deliveries, collections, lang]);

  const orderStatusDist = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) { const lbl = statusLabel(o.status); map[lbl] = (map[lbl] || 0) + 1; }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [orders, lang]);

  const barData = aggregated.slice(0, 8).map(a => ({
    name: a.material.length > 15 ? a.material.slice(0, 15) + "…" : a.material,
    fullName: a.material,
    consumed: a.totalConsumed, remaining: a.totalRemaining,
  }));

  const pieData = aggregated.filter(a => a.totalConsumed > 0).slice(0, 8).map(a => ({
    name: a.material.length > 20 ? a.material.slice(0, 20) + "…" : a.material,
    value: a.totalConsumed,
  }));

  const coverageData = aggregated.filter(a => a.avgWeekly > 0).slice(0, 8).map(a => ({
    name: a.material.length > 15 ? a.material.slice(0, 15) + "…" : a.material,
    weeks: a.totalRemaining > 0 && a.avgWeekly > 0 ? Math.round((a.totalRemaining / a.avgWeekly) * 10) / 10 : 0,
  }));

  const lowStockItems = aggregated.filter(a => {
    if (a.avgWeekly <= 0) return false;
    return (a.totalRemaining / a.avgWeekly) <= 4;
  }).sort((a, b) => (a.totalRemaining / (a.avgWeekly || 1)) - (b.totalRemaining / (b.avgWeekly || 1)));

  const mOrders = useMemo(() => orders.filter(o => o.date?.startsWith(selectedMonth)), [orders, selectedMonth]);
  const mDeliveries = useMemo(() => deliveries.filter(d => d.date?.startsWith(selectedMonth)), [deliveries, selectedMonth]);
  const mCollections = useMemo(() => collections.filter(c => c.date?.startsWith(selectedMonth)), [collections, selectedMonth]);
  const mReturns = useMemo(() => returns.filter(r => r.date?.startsWith(selectedMonth)), [returns, selectedMonth]);
  const mInventoryDelivered = useMemo(() => inventory.filter(i => i.deliveryDate?.startsWith(selectedMonth)), [inventory, selectedMonth]);

  const mStats = useMemo(() => {
    const totalValue = mOrders.reduce((s, o) => s + o.totalSelling, 0);
    const totalCollected = mCollections.reduce((s, c) => s + c.paidAmount, 0);
    const totalDue = mCollections.reduce((s, c) => s + c.totalAmount, 0);
    const totalReturns = mReturns.reduce((s, r) => s + r.itemCount, 0);
    const deliveredQty = mInventoryDelivered.reduce((s, i) => s + i.delivered, 0);
    return { totalValue, totalCollected, totalDue, totalReturns, deliveredQty, ordersCount: mOrders.length, deliveriesCount: mDeliveries.length, collectionsCount: mCollections.length, returnsCount: mReturns.length };
  }, [mOrders, mDeliveries, mCollections, mReturns, mInventoryDelivered]);

  const mOrderStatusDist = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of mOrders) { const lbl = statusLabel(o.status); map[lbl] = (map[lbl] || 0) + 1; }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [mOrders, lang]);

  const mDailyData = useMemo(() => {
    const map: Record<string, { day: string; orders: number; deliveries: number; value: number }> = {};
    for (const o of mOrders) {
      const day = o.date?.slice(8, 10) || "";
      if (!day) continue;
      if (!map[day]) map[day] = { day, orders: 0, deliveries: 0, value: 0 };
      map[day].orders++;
      map[day].value += o.totalSelling;
    }
    for (const d of mDeliveries) {
      const day = d.date?.slice(8, 10) || "";
      if (!day) continue;
      if (!map[day]) map[day] = { day, orders: 0, deliveries: 0, value: 0 };
      map[day].deliveries++;
    }
    return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
  }, [mOrders, mDeliveries]);

  const mMaterialDist = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of mInventoryDelivered) {
      const key = item.material;
      map[key] = (map[key] || 0) + item.delivered;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({
      name: name.length > 20 ? name.slice(0, 20) + "…" : name, value,
    }));
  }, [mInventoryDelivered]);

  const inventoryImageMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of inventory) {
      if (item.imageUrl) {
        if (item.code && !map[item.code]) map[item.code] = item.imageUrl;
        if (item.material && !map[item.material.toLowerCase().trim()]) map[item.material.toLowerCase().trim()] = item.imageUrl;
      }
    }
    return map;
  }, [inventory]);

  const mMaterialConsumption = useMemo(() => {
    const mOrderIds = new Set(mOrders.map(o => o.id));
    const lines = orderLines.filter(l => mOrderIds.has(l.orderId));
    const map = new Map<string, { materialName: string; materialCode: string; unit: string; totalQty: number; orderIds: Set<string> }>();
    for (const l of lines) {
      const key = l.materialCode || l.materialName;
      const existing = map.get(key);
      if (existing) {
        existing.totalQty += l.quantity;
        existing.orderIds.add(l.orderId);
      } else {
        map.set(key, { materialName: l.materialName, materialCode: l.materialCode, unit: l.unit, totalQty: l.quantity, orderIds: new Set([l.orderId]) });
      }
    }
    return [...map.values()].map(v => ({
      materialName: v.materialName, materialCode: v.materialCode, unit: v.unit, totalQty: v.totalQty, orderCount: v.orderIds.size,
      imageUrl: inventoryImageMap[v.materialCode] || inventoryImageMap[v.materialName.toLowerCase().trim()] || "",
    })).sort((a, b) => b.totalQty - a.totalQty);
  }, [mOrders, orderLines, inventoryImageMap]);

  const mAggregated = useMemo(() => {
    const map = new Map<string, { material: string; code: string; unit: string; totalDelivered: number; totalRemaining: number; totalConsumed: number; sellingPrice: number; imageUrl: string }>();
    for (const item of mInventoryDelivered) {
      const key = item.code || item.material;
      const consumed = Math.max(0, item.delivered - item.remaining);
      const existing = map.get(key);
      if (existing) {
        existing.totalDelivered += item.delivered;
        existing.totalRemaining += item.remaining;
        existing.totalConsumed += consumed;
        if (item.sellingPrice > 0) existing.sellingPrice = item.sellingPrice;
        if (item.imageUrl && !existing.imageUrl) existing.imageUrl = item.imageUrl;
      } else {
        map.set(key, {
          material: item.material, code: item.code, unit: item.unit,
          totalDelivered: item.delivered, totalRemaining: item.remaining,
          totalConsumed: consumed, sellingPrice: item.sellingPrice,
          imageUrl: item.imageUrl || "",
        });
      }
    }
    return [...map.values()].sort((a, b) => b.totalConsumed - a.totalConsumed);
  }, [mInventoryDelivered]);

  const mBarData = mAggregated.map(a => ({
    name: a.material.length > 15 ? a.material.slice(0, 15) + "…" : a.material,
    fullName: a.material,
    consumed: a.totalConsumed, remaining: a.totalRemaining,
  }));

  const mPieData = mAggregated.filter(a => a.totalConsumed > 0).slice(0, 8).map(a => ({
    name: a.material.length > 20 ? a.material.slice(0, 20) + "…" : a.material,
    value: a.totalConsumed,
  }));

  const mTotalDelivered = mAggregated.reduce((s, i) => s + i.totalDelivered, 0);
  const mTotalConsumed = mAggregated.reduce((s, i) => s + i.totalConsumed, 0);
  const mConsumptionRate = mTotalDelivered > 0 ? Math.round((mTotalConsumed / mTotalDelivered) * 100) : 0;

  const mCollectionPie = useMemo(() => {
    if (mStats.totalDue <= 0) return [];
    return [
      { name: t.crCollected, value: mStats.totalCollected },
      { name: t.crRemainingCol, value: Math.max(0, mStats.totalDue - mStats.totalCollected) },
    ].filter(d => d.value > 0);
  }, [mStats, t]);

  const partnerMonths = useMemo(() => {
    if (!client?.joinDate) return 0;
    const join = new Date(client.joinDate);
    const now = new Date();
    return Math.max(1, Math.round((now.getTime() - join.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  }, [client]);

  const collectionRate = useMemo(() => {
    if (collectionStats.totalAmount <= 0) return 0;
    return Math.round((collectionStats.paidAmount / collectionStats.totalAmount) * 100);
  }, [collectionStats]);

  const avgComparison = useMemo(() => {
    const DELIVERED = ["Delivered", "Closed", "Partially Delivered", "Completed"];
    const totalClients = allClients.length;
    if (totalClients <= 1) return null;

    const clientOrdersMap: Record<string, number> = {};
    const clientValueMap: Record<string, number> = {};
    for (const o of allOrders) {
      clientOrdersMap[o.clientId] = (clientOrdersMap[o.clientId] || 0) + 1;
      if (DELIVERED.includes(o.status)) {
        clientValueMap[o.clientId] = (clientValueMap[o.clientId] || 0) + o.totalSelling;
      }
    }

    const clientCollTotalMap: Record<string, number> = {};
    const clientCollPaidMap: Record<string, number> = {};
    for (const c of allCollections) {
      clientCollTotalMap[c.clientId] = (clientCollTotalMap[c.clientId] || 0) + c.totalAmount;
      clientCollPaidMap[c.clientId] = (clientCollPaidMap[c.clientId] || 0) + c.paidAmount;
    }

    const avgOrders = Object.values(clientOrdersMap).reduce((s, v) => s + v, 0) / totalClients;

    const allDeliveredOrders = allOrders.filter(o => DELIVERED.includes(o.status));
    const globalAvgOrderValue = allDeliveredOrders.length > 0
      ? allDeliveredOrders.reduce((s, o) => s + o.totalSelling, 0) / allDeliveredOrders.length
      : 0;

    const collRates = allClients.map(c => {
      const total = clientCollTotalMap[c.id] || 0;
      const paid = clientCollPaidMap[c.id] || 0;
      return total > 0 ? (paid / total) * 100 : 100;
    });
    const avgCollRate = Math.round(collRates.reduce((s, v) => s + v, 0) / collRates.length);

    const myDeliveredOrders = orders.filter(o => DELIVERED.includes(o.status));
    const myAvgOrderValue = myDeliveredOrders.length > 0
      ? myDeliveredOrders.reduce((s, o) => s + o.totalSelling, 0) / myDeliveredOrders.length
      : 0;
    const myOrders = orders.length;
    const myCollRate = collectionRate;

    return {
      orders: { mine: myOrders, avg: Math.round(avgOrders * 10) / 10 },
      value: { mine: Math.round(myAvgOrderValue), avg: Math.round(globalAvgOrderValue) },
      collRate: { mine: myCollRate, avg: avgCollRate },
    };
  }, [allClients, allOrders, allCollections, orders, collectionRate, stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">{t.crClientNotFound}</div>;
  }

  const reportDate = new Date().toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" });
  const deliveredOrders = orders.filter(o => ["Delivered", "Closed", "Partially Delivered", "Completed"].includes(o.status));
  const totalOrderValue = deliveredOrders.reduce((s, o) => s + o.totalSelling, 0);
  const confirmedDeliveries = deliveries.filter(d => d.status === "Delivered" || d.status === "مُسلَّم");
  const lastAudit = audits.length > 0 ? audits[0] : null;
  const lastAuditDate = lastAudit ? (lastAudit.date || lastAudit.createdAt || lastAudit.created_at || "") : "";

  const handleExportCSV = () => {
    const sections = [
      {
        title: `📋 ${isEn ? "Client Info" : "بيانات العميل"}`,
        headers: [isEn ? "Field" : "الحقل", isEn ? "Value" : "القيمة"],
        rows: [
          [isEn ? "Name" : "الاسم", client.name],
          [isEn ? "City" : "المدينة", client.city || "—"],
          [isEn ? "Phone" : "الهاتف", client.phone || "—"],
          [isEn ? "Report Date" : "تاريخ التقرير", new Date().toLocaleDateString(dateLocale)],
        ] as (string | number)[][],
      },
      {
        title: `💰 ${t.crAccountSummary || (isEn ? "Account Summary" : "ملخص الحساب")}`,
        headers: [isEn ? "Metric" : "البند", isEn ? "Value" : "القيمة"],
        rows: [
          [isEn ? "Total Orders" : "إجمالي الطلبات", orders.length],
          [isEn ? "Delivered Orders" : "طلبات مسلّمة", deliveredOrders.length],
          [isEn ? "Total Order Value" : "إجمالي قيمة الطلبات", totalOrderValue],
          [isEn ? "Total Deliveries" : "إجمالي التوصيلات", deliveries.length],
          [isEn ? "Total Billed" : "إجمالي المفوتر", collectionStats.totalAmount],
          [isEn ? "Total Paid" : "إجمالي المدفوع", collectionStats.paidAmount],
          [isEn ? "Outstanding" : "المتبقي", collectionStats.remaining],
          [isEn ? "Returns" : "المرتجعات", returnsStats.total],
          [isEn ? "Returned Items" : "عناصر مرتجعة", returnsStats.totalItems],
        ] as (string | number)[][],
      },
      {
        title: `📦 ${t.crMaterial}`,
        headers: [t.crMaterial, isEn ? "Code" : "الكود", t.crUnit, t.crSellingPrice, t.crDelivered, t.crConsumedQty, t.crRemainingQty, t.crWeekly, t.crConsRate],
        rows: aggregated.map(item => {
          const rate = item.totalDelivered > 0 ? Math.round((item.totalConsumed / item.totalDelivered) * 100) : 0;
          return [item.material, item.code, item.unit, item.sellingPrice, item.totalDelivered, item.totalConsumed, item.totalRemaining, item.avgWeekly > 0 ? item.avgWeekly.toFixed(1) : "—", `${rate}%`];
        }),
      },
      {
        title: `📅 ${isEn ? "Monthly Overview" : "نظرة شهرية"}`,
        headers: [isEn ? "Month" : "الشهر", t.crOrders, isEn ? "Value" : "القيمة", t.crDeliveries, isEn ? "Collections" : "التحصيلات"],
        rows: monthlyOverviewData.map(m => [m.label, m.orders, m.value, m.deliveries, m.collections]),
      },
    ];
    exportMultiSectionCsv(`client_report_${client.name}`, sections);
  };

  const navigateMonth = (dir: number) => {
    const idx = availableMonths.indexOf(selectedMonth);
    const next = idx + dir;
    if (next >= 0 && next < availableMonths.length) setSelectedMonth(availableMonths[next]);
  };

  const BackArrow = isEn ? ArrowLeft : ArrowRight;

  const reportTypeLabel = tab === "monthly" && selectedMonth ? `${t.crReportOf} ${toFullMonthLabel(selectedMonth)}` : t.crCompReport;

  const execSummaryText = (() => {
    const parts: string[] = [];
    if (partnerMonths > 0) parts.push(`${t.crPartnerSince} ${partnerMonths} ${t.crMonthsUnit}`);
    if (totalOrderValue > 0) parts.push(`${t.crTotalSupplyVal}: ${cur(totalOrderValue)}`);
    if (collectionRate > 0) parts.push(`${t.crCollectionRate}: ${collectionRate}%`);
    if (stats.consumptionRate > 0) parts.push(`${t.crConsumptionSummary}: ${stats.consumptionRate}%`);
    return parts.join("  •  ");
  })();

  const renderProgressBar = (d: { consumed: number; remaining: number; name: string }, idx: number) => {
    const total = d.consumed + d.remaining;
    const pct = total > 0 ? Math.round((d.consumed / total) * 100) : 0;
    const isLow = d.remaining <= 5 && d.remaining > 0;
    const isDepleted = d.remaining === 0 && d.consumed > 0;
    return (
      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 print:even:bg-gray-50">
        <td className="py-2 px-3 text-gray-500 font-medium text-xs">{idx + 1}</td>
        <td className="py-2 px-3 font-semibold text-gray-900 text-xs">{d.name}</td>
        <td className="py-2 px-3 text-end font-medium text-gray-700 text-xs">{total}</td>
        <td className="py-2 px-3 text-end font-bold text-orange-600 text-xs">{d.consumed}</td>
        <td className={`py-2 px-3 text-end font-bold text-xs ${isDepleted ? "text-red-600" : isLow ? "text-amber-600" : "text-blue-600"}`}>{d.remaining}</td>
        <td className="py-2 px-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-200" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
              <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-500" : pct >= 40 ? "bg-amber-400" : "bg-green-500"}`} style={{ width: `${pct}%`, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}></div>
            </div>
            <span className={`text-xs font-bold min-w-[36px] text-end ${pct >= 90 ? "text-red-600" : pct >= 70 ? "text-orange-600" : "text-gray-700"}`}>{pct}%</span>
          </div>
        </td>
      </tr>
    );
  };

  const renderMaterialImage = (imageUrl: string, material: string) => {
    if (imageUrl && imageUrl.startsWith("http")) {
      return (
        <>
          <img src={imageUrl} alt={material} className="w-8 h-8 object-cover rounded border border-gray-200 mx-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.querySelector('.img-fallback')?.classList.remove("hidden"); (e.target as HTMLImageElement).parentElement!.querySelector('.img-fallback')?.classList.add("flex"); }} />
          <div className="w-8 h-8 rounded border border-gray-200 bg-gray-50 items-center justify-center mx-auto hidden img-fallback"><Package className="h-4 w-4 text-gray-300" /></div>
        </>
      );
    }
    return <div className="w-8 h-8 rounded border border-gray-200 bg-gray-50 flex items-center justify-center mx-auto"><Package className="h-4 w-4 text-gray-300" /></div>;
  };

  return (
    <div className="min-h-screen bg-background print:bg-white" dir={dir}>
      {/* PRINT REPEATING HEADER */}
      <div className="hidden print:block print-fixed-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/images/dsb-logo.png" alt="DSB" className="w-6 h-6 object-contain" />
            <span className="text-[9px] font-bold text-gray-700">Dental Smart Box</span>
          </div>
          <span className="text-[9px] font-semibold text-gray-600">{client.name} — {reportTypeLabel}</span>
          <span className="text-[9px] text-gray-400">{reportDate}</span>
        </div>
      </div>

      {/* PRINT REPEATING FOOTER */}
      <div className="hidden print:block print-fixed-footer">
        <div className="flex items-center justify-between border-t border-gray-300 pt-1">
          <span className="text-[8px] text-gray-400">DSB — {t.crDentalMgmt}</span>
          <span className="text-[8px] text-gray-400" dir="ltr">+20 11 0229 7174 | dsbs.store</span>
        </div>
      </div>

      {/* SCREEN TOOLBAR */}
      <div className="print:hidden sticky top-0 z-10 bg-card border-b px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/clients/${id}`)} className="gap-2">
          <BackArrow className="h-4 w-4" /> {t.crBackToProfile}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="h-4 w-4" /> {t.crExportCsv}
          </Button>
          <Button size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> {t.crPrint}
          </Button>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto p-8 print:p-0 print:pt-10 print:max-w-none print-report-page">
        {/* === SCREEN HEADER === */}
        <div className="report-header mb-8 rounded-2xl overflow-hidden border border-orange-100 print:hidden">
          <div className="bg-gradient-to-l from-orange-500 via-orange-400 to-amber-400 px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center p-1.5">
                <img src="/images/dsb-logo.png" alt="DSB Logo" className="w-full h-full object-contain rounded-full" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-wide">Dental Smart Box</h1>
                <p className="text-orange-100 text-sm font-medium mt-0.5">{t.crDentalMgmt}</p>
              </div>
            </div>
            <div className={`${isEn ? "text-right" : "text-left"} text-xs text-orange-100 font-medium leading-relaxed`}>
              <p dir="ltr" className="text-white font-semibold">+20 11 0229 7174</p>
              <p dir="ltr">dsbs.store</p>
            </div>
          </div>
          <div className="bg-white px-8 py-5 text-center">
            <p className="text-xs text-orange-500 font-bold tracking-widest uppercase mb-1">
              {reportTypeLabel}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{client.name}</h2>
            <div className="flex items-center justify-center gap-4 text-sm text-gray-500 font-medium flex-wrap">
              {client.city && <span className="flex items-center gap-1"><span className="text-orange-400">●</span> {client.city}</span>}
              {client.phone && <span className="flex items-center gap-1" dir="ltr"><span className="text-orange-400">●</span> {client.phone}</span>}
              {client.joinDate && <span className="flex items-center gap-1"><span className="text-orange-400">●</span> {t.crClientSince} {new Date(client.joinDate).toLocaleDateString(dateLocale, { year: "numeric", month: "long" })}</span>}
            </div>
            <p className="text-xs text-gray-400 mt-2">{reportDate}</p>
          </div>
        </div>

        {/* === PRINT-ONLY HEADER === */}
        <div className="hidden print:block mb-6 print-header-block">
          <div className="flex items-center justify-between border-b-[3px] border-orange-500 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <img src="/images/dsb-logo.png" alt="DSB Logo" className="w-14 h-14 object-contain" />
              <div>
                <p className="text-xl font-bold text-gray-900" style={{ letterSpacing: '1px' }}>Dental Smart Box</p>
                <p className="text-xs text-gray-500 font-medium">{t.crDentalMgmt}</p>
              </div>
            </div>
            <div className={`${isEn ? "text-right" : "text-left"} text-xs text-gray-600 leading-relaxed`}>
              <p dir="ltr" className="font-semibold">+20 11 0229 7174</p>
              <p dir="ltr">dsbs.store</p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-orange-600 font-bold tracking-[3px] uppercase mb-1">
              {reportTypeLabel}
            </p>
            <p className="text-lg font-bold text-gray-900">{client.name}</p>
            <div className="flex items-center justify-center gap-3 text-xs text-gray-500 font-medium mt-1">
              {client.city && <span>📍 {client.city}</span>}
              {client.phone && <span dir="ltr">📞 {client.phone}</span>}
              {client.joinDate && <span>📅 {t.crClientSince} {new Date(client.joinDate).toLocaleDateString(dateLocale, { year: "numeric", month: "long" })}</span>}
            </div>
            <p className="text-[9px] text-gray-400 mt-1">{reportDate}</p>
          </div>
        </div>

        {/* === EXECUTIVE SUMMARY (Print Only) === */}
        {execSummaryText && (
          <div className="hidden print:block mb-5 print-exec-summary">
            <div className="border-2 border-orange-200 rounded-lg py-3 px-4">
              <p className="text-[10px] font-bold text-orange-700 mb-1">{t.crExecSummary}</p>
              <p className="text-[10px] text-gray-700 leading-relaxed">{execSummaryText}</p>
            </div>
          </div>
        )}

        {/* === SCREEN THANK YOU === */}
        <div className="mb-6 rounded-xl overflow-hidden print:hidden">
          <div className="bg-gradient-to-l from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/20 dark:via-teal-950/20 dark:to-cyan-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl py-4 px-6 text-center">
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">✨ {t.crThankYou} ✨</p>
          </div>
        </div>
        {/* === PRINT-ONLY THANK YOU === */}
        <div className="hidden print:block mb-4 print-thankyou-block">
          <div className="border border-gray-300 rounded-lg py-2 px-4 text-center">
            <p className="text-[10px] font-semibold text-gray-600">{t.crThankYou}</p>
          </div>
        </div>

        {/* === SCREEN ACCOUNT SUMMARY === */}
        <div className="mb-8 grid grid-cols-3 gap-4 print:hidden">
          <div className="rounded-xl p-5 text-center bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
            <DollarSign className="h-6 w-6 mx-auto text-gray-400 mb-2" />
            <p className="text-xs text-gray-500 font-semibold mb-1">{t.crTotalSupplies}</p>
            <p className="text-2xl font-bold text-gray-900">{totalOrderValue > 0 ? `${totalOrderValue.toLocaleString()}` : "0"}</p>
            <p className="text-xs text-gray-400 font-medium">{t.crCurrency}</p>
          </div>
          <div className="rounded-xl p-5 text-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/30 dark:to-emerald-900/20 border border-green-200 dark:border-green-800/40 shadow-sm">
            <CreditCard className="h-6 w-6 mx-auto text-green-500 mb-2" />
            <p className="text-xs text-green-600 font-semibold mb-1">{t.crPaidAmount}</p>
            <p className="text-2xl font-bold text-green-700">{collectionStats.paidAmount > 0 ? `${collectionStats.paidAmount.toLocaleString()}` : "0"}</p>
            <p className="text-xs text-green-500 font-medium">{t.crCurrency}</p>
          </div>
          <div className={`rounded-xl p-5 text-center shadow-sm ${collectionStats.remaining > 0 ? "bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-950/30 dark:to-rose-900/20 border border-red-200 dark:border-red-800/40" : "bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-700"}`}>
            <Receipt className="h-6 w-6 mx-auto mb-2" style={{ color: collectionStats.remaining > 0 ? '#ef4444' : '#9ca3af' }} />
            <p className={`text-xs font-semibold mb-1 ${collectionStats.remaining > 0 ? "text-red-600" : "text-gray-500"}`}>{t.crRemainingAmount}</p>
            <p className={`text-2xl font-bold ${collectionStats.remaining > 0 ? "text-red-700" : "text-gray-900"}`}>{collectionStats.remaining > 0 ? `${collectionStats.remaining.toLocaleString()}` : "0"}</p>
            <p className={`text-xs font-medium ${collectionStats.remaining > 0 ? "text-red-400" : "text-gray-400"}`}>{t.crCurrency}</p>
          </div>
        </div>
        {/* === PRINT-ONLY ACCOUNT SUMMARY === */}
        <div className="hidden print:block mb-5 print-account-block">
          <table className="w-full border-collapse text-center">
            <thead>
              <tr>
                <th className="border border-gray-300 py-2 px-3 text-[10px] font-bold text-gray-600 bg-gray-50">{t.crTotalSupplies}</th>
                <th className="border border-gray-300 py-2 px-3 text-[10px] font-bold text-green-700 bg-gray-50">{t.crPaidAmount}</th>
                <th className="border border-gray-300 py-2 px-3 text-[10px] font-bold text-red-700 bg-gray-50">{t.crRemainingAmount}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 py-2 px-3 text-sm font-bold text-gray-900">{totalOrderValue > 0 ? cur(totalOrderValue) : `0 ${t.crCurrency}`}</td>
                <td className="border border-gray-300 py-2 px-3 text-sm font-bold text-green-700">{collectionStats.paidAmount > 0 ? cur(collectionStats.paidAmount) : `0 ${t.crCurrency}`}</td>
                <td className="border border-gray-300 py-2 px-3 text-sm font-bold text-red-700">{collectionStats.remaining > 0 ? cur(collectionStats.remaining) : `0 ${t.crCurrency}`}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* === COMPARISON WITH AVERAGE === */}
        {avgComparison && (
          <div className="mb-8 border-2 border-gray-200 rounded-xl overflow-hidden bg-card print:break-inside-avoid">
            <h3 className="text-base font-bold p-5 border-b-2 border-gray-200 flex items-center gap-2 text-gray-900 bg-gray-50">
              <Users className="h-5 w-5 text-primary" /> {t.crCompareWithAvg}
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-0 divide-x divide-y divide-gray-100 rtl:divide-x-reverse">
              {[
                { label: t.crAvgOrders, mine: avgComparison.orders.mine, avg: avgComparison.orders.avg, unit: "", format: false },
                { label: t.crAvgOrderValue, mine: avgComparison.value.mine, avg: avgComparison.value.avg, unit: t.crCurrency, format: true },
                { label: t.crAvgCollRate, mine: avgComparison.collRate.mine, avg: avgComparison.collRate.avg, unit: "%", format: false },
              ].map((item, idx) => {
                const diff = item.avg > 0 ? Math.round(((item.mine - item.avg) / item.avg) * 100) : 0;
                const isAbove = diff > 5;
                const isBelow = diff < -5;
                return (
                  <div key={idx} className="p-4 text-center">
                    <p className="text-xs text-gray-500 font-semibold mb-2">{item.label}</p>
                    <div className="flex items-center justify-center gap-4">
                      <div>
                        <p className="text-lg font-black text-gray-900">{item.format ? item.mine.toLocaleString() : item.mine}{item.unit === "%" ? "%" : ""}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{t.crYourClient}</p>
                      </div>
                      <div className="text-gray-300 text-lg font-light">/</div>
                      <div>
                        <p className="text-lg font-bold text-gray-500">{item.format ? Math.round(item.avg).toLocaleString() : item.avg}{item.unit === "%" ? "%" : ""}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{t.crAllClientsAvg}</p>
                      </div>
                    </div>
                    {diff !== 0 && (
                      <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${isAbove ? "bg-green-100 text-green-700" : isBelow ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                        {isAbove ? <TrendingUp className="h-3 w-3" /> : isBelow ? <TrendingDown className="h-3 w-3" /> : null}
                        {isAbove ? `+${diff}% ${t.crAboveAvg}` : isBelow ? `${diff}% ${t.crBelowAvg}` : t.crAtAvg}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === TABS === */}
        <div className="print:hidden flex items-center gap-2 mb-6">
          <button onClick={() => setTab("full")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "full" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {t.crCompReport}
          </button>
          <button onClick={() => setTab("monthly")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "monthly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {t.crMonthReport}
          </button>
        </div>

        {tab === "monthly" && (
          <>
            <div className="print:hidden mb-6 flex items-center justify-center gap-3">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigateMonth(1)} disabled={availableMonths.indexOf(selectedMonth) >= availableMonths.length - 1}>
                <ChevronRight className="h-5 w-5" />
              </Button>
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className={`appearance-none bg-card border-2 rounded-xl py-2.5 text-sm font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[160px] ${isEn ? "pl-10 pr-5" : "pr-10 pl-5"}`}
                >
                  {availableMonths.map(ym => (
                    <option key={ym} value={ym}>{toYMLabel(ym)}</option>
                  ))}
                </select>
                <Calendar className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none ${isEn ? "left-3" : "right-3"}`} />
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigateMonth(-1)} disabled={availableMonths.indexOf(selectedMonth) <= 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              <StatBox label={t.crMaterialCount} value={mAggregated.length > 0 ? mAggregated.length : mMaterialConsumption.length} icon={Package} color="bg-blue-100 text-blue-700" />
              <StatBox label={t.crTotalOrders} value={mStats.ordersCount} icon={ShoppingCart} color="bg-orange-100 text-orange-700" />
              <StatBox label={t.crDeliveryOps} value={mStats.deliveriesCount} icon={Truck} color="bg-green-100 text-green-700" />
              <StatBox label={t.crQtySupplied} value={mStats.deliveredQty > 0 ? mStats.deliveredQty.toLocaleString() : "—"} icon={BarChart3} color="bg-teal-100 text-teal-700" />
              <StatBox label={t.crConsRate} value={mConsumptionRate > 0 ? `${mConsumptionRate}%` : "—"} icon={PieChartIcon} color="bg-purple-100 text-purple-700" />
            </div>

            {mDailyData.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
                <div className="border-2 border-gray-200 rounded-xl p-6 bg-card print:break-inside-avoid">
                  <h3 className="text-base font-bold mb-2 flex items-center gap-2 text-gray-900">
                    <CalendarDays className="h-5 w-5 text-primary" /> {t.crDailyActivity}
                  </h3>
                  <p className="hidden print:block text-xs text-gray-500 mb-3">{t.crPrintDailyDesc}</p>
                  <div className="h-[260px] print:h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={mDailyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                        <XAxis dataKey="day" tick={AXIS_TICK} stroke="currentColor" />
                        <YAxis tick={AXIS_TICK} stroke="currentColor" />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: "12px", fontWeight: 600 }} />
                        <Bar dataKey="orders" fill="#f97316" name={t.crOrdersChart} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="deliveries" fill="#22c55e" name={t.crDeliveriesChart} radius={[4, 4, 0, 0]} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 border-t border-gray-200 pt-3">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-gray-50 border-b border-gray-200"><th className="py-2 px-3 text-start font-bold text-gray-700">{t.crDay}</th><th className="py-2 px-3 text-end font-bold text-gray-700">{t.crOrdersChart}</th><th className="py-2 px-3 text-end font-bold text-gray-700">{t.crDeliveriesChart}</th></tr></thead>
                      <tbody>{mDailyData.filter(d => d.orders > 0 || d.deliveries > 0).map((d, i) => <tr key={i} className="border-b border-gray-100 print:even:bg-gray-50"><td className="py-1.5 px-3 font-medium text-gray-800">{d.day}</td><td className="py-1.5 px-3 text-end font-semibold text-orange-600">{d.orders}</td><td className="py-1.5 px-3 text-end font-semibold text-green-600">{d.deliveries}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>

                {mStats.totalValue > 0 && (
                  <div className="border-2 border-gray-200 rounded-xl p-6 bg-card print:break-inside-avoid">
                    <h3 className="text-base font-bold mb-2 flex items-center gap-2 text-gray-900">
                      <DollarSign className="h-5 w-5 text-primary" /> {t.crDailyOrderVal}
                    </h3>
                    <p className="hidden print:block text-xs text-gray-500 mb-3">{t.crPrintDailyValDesc}</p>
                    <div className="h-[260px] print:h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={mDailyData}>
                          <defs>
                            <linearGradient id="mValueGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                          <XAxis dataKey="day" tick={AXIS_TICK} stroke="currentColor" />
                          <YAxis tick={AXIS_TICK} stroke="currentColor" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [cur(Number(v)), t.crValueOnly]} />
                          <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={3} fill="url(#mValueGrad)" name={t.crValueOnly} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-3 border-t border-gray-200 pt-3">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-gray-50 border-b border-gray-200"><th className="py-2 px-3 text-start font-bold text-gray-700">{t.crDay}</th><th className="py-2 px-3 text-end font-bold text-gray-700">{t.crValueEgp}</th></tr></thead>
                        <tbody>{mDailyData.filter(d => d.value > 0).map((d, i) => <tr key={i} className="border-b border-gray-100 print:even:bg-gray-50"><td className="py-1.5 px-3 font-medium text-gray-800">{d.day}</td><td className="py-1.5 px-3 text-end font-semibold text-orange-600">{cur(d.value)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(mCollectionPie.length > 0 || mPieData.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
                {mPieData.length > 0 && (
                  <div className="border-2 border-gray-200 rounded-xl p-5 bg-card print:break-inside-avoid">
                    <h3 className="text-base font-bold mb-2 flex items-center gap-2 text-gray-900">
                      <PieChartIcon className="h-5 w-5 text-primary" /> {t.crConsDist}
                    </h3>
                    <p className="hidden print:block text-xs text-gray-500 mb-3">{t.crPrintConsDistMonthDesc}</p>
                    <div className="h-[220px] print:h-[160px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={mPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value" strokeWidth={2} stroke="#fff">
                            {mPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v} ${t.crUnits}`, t.crConsumed]} />
                          <Legend wrapperStyle={{ fontSize: "11px", fontWeight: 600 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-3 border-t border-gray-200 pt-2 space-y-1">
                      {mPieData.map((d, i) => <div key={i} className="flex justify-between text-xs"><span className="font-medium text-gray-700 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>{d.name}</span><span className="font-bold text-gray-900">{d.value} {t.crUnits}</span></div>)}
                    </div>
                  </div>
                )}

                {mCollectionPie.length > 0 && (
                  <div className="border-2 border-gray-200 rounded-xl p-5 bg-card print:break-inside-avoid">
                    <h3 className="text-base font-bold mb-2 flex items-center gap-2 text-gray-900">
                      <Receipt className="h-5 w-5 text-primary" /> {t.crMonthColl}
                    </h3>
                    <p className="hidden print:block text-xs text-gray-500 mb-3">{t.crPrintCollDesc}</p>
                    <div className="h-[220px] print:h-[160px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={mCollectionPie} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={4} dataKey="value" strokeWidth={2} stroke="#fff">
                            <Cell fill="#22c55e" />
                            <Cell fill="#ef4444" />
                          </Pie>
                          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [cur(Number(v)), ""]} />
                          <Legend wrapperStyle={{ fontSize: "11px", fontWeight: 600 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-3 border-t border-gray-200 pt-2 space-y-1">
                      {mCollectionPie.map((d, i) => <div key={i} className="flex justify-between text-xs"><span className="font-medium text-gray-700 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: i === 0 ? "#22c55e" : "#ef4444" }}></span>{d.name}</span><span className="font-bold text-gray-900">{cur(d.value)}</span></div>)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {mBarData.length > 0 && (
              <div className="mb-8 border-2 border-gray-200 rounded-xl overflow-hidden bg-card print:break-inside-avoid">
                <h3 className="text-base font-bold p-5 border-b-2 border-gray-200 flex items-center gap-2 text-gray-900 bg-gray-50">
                  <BarChart3 className="h-5 w-5 text-primary" /> {t.crConsVsRemain} — {toFullMonthLabel(selectedMonth)}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-200 text-xs">
                        <th className="py-2.5 px-3 text-start font-bold text-gray-600 w-[30px]">#</th>
                        <th className="py-2.5 px-3 text-start font-bold text-gray-600">{t.crMaterial}</th>
                        <th className="py-2.5 px-3 text-end font-bold text-gray-600 w-[60px]">{t.crSupplied}</th>
                        <th className="py-2.5 px-3 text-end font-bold text-gray-600 w-[60px]">{t.crConsumed}</th>
                        <th className="py-2.5 px-3 text-end font-bold text-gray-600 w-[60px]">{t.crRemainingCol}</th>
                        <th className="py-2.5 px-3 text-center font-bold text-gray-600 w-[200px]">{t.crConsRate}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mBarData.map((d, idx) => renderProgressBar(d, idx))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {mAggregated.length > 0 && (
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-card mb-8 print:break-inside-avoid">
                <h3 className="text-base font-bold p-5 border-b-2 border-gray-200 flex items-center gap-2 text-gray-900 bg-gray-50">
                  <Package className="h-5 w-5 text-primary" /> {t.crMaterialDetails} — {toFullMonthLabel(selectedMonth)}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[30px]" />
                      <col className="w-[45px]" />
                      <col />
                      <col className="w-[50px]" />
                      <col className="w-[70px]" />
                      <col className="w-[55px]" />
                      <col className="w-[55px]" />
                      <col className="w-[55px]" />
                      <col className="w-[90px]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-gray-100 border-b-2 border-gray-300">
                        <th className="py-3 px-2 text-start font-bold text-gray-900">#</th>
                        <th className="py-3 px-2 text-center font-bold text-gray-900">{t.crImage}</th>
                        <th className="py-3 px-2 text-start font-bold text-gray-900">{t.crMaterial}</th>
                        <th className="py-3 px-2 text-start font-bold text-gray-900 w-14">{t.crUnit}</th>
                        <th className="py-3 px-2 text-end font-bold text-gray-900 w-20">{t.crSellingPrice}</th>
                        <th className="py-3 px-2 text-end font-bold text-gray-900 w-16">{t.crDelivered}</th>
                        <th className="py-3 px-2 text-end font-bold text-gray-900 w-16">{t.crConsumedQty}</th>
                        <th className="py-3 px-2 text-end font-bold text-gray-900 w-16">{t.crRemainingQty}</th>
                        <th className="py-3 px-2 text-end font-bold text-gray-900 w-24">{t.crConsumption}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mAggregated.map((item, idx) => {
                        const rate = item.totalDelivered > 0 ? Math.round((item.totalConsumed / item.totalDelivered) * 100) : 0;
                        return (
                          <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 print:even:bg-gray-50">
                            <td className="py-2 px-2 text-gray-600 font-medium">{idx + 1}</td>
                            <td className="py-1 px-2 text-center">{renderMaterialImage(item.imageUrl, item.material)}</td>
                            <td className="py-2 px-2 font-semibold text-gray-900 text-xs overflow-hidden text-ellipsis whitespace-nowrap" title={item.material}>{item.material}</td>
                            <td className="py-2 px-2 text-gray-700 text-xs">{item.unit}</td>
                            <td className="py-2 px-2 text-end text-gray-800 font-medium text-xs">{item.sellingPrice > 0 ? `${item.sellingPrice.toLocaleString()}` : "—"}</td>
                            <td className="py-2 px-2 text-end text-gray-800 font-medium">{item.totalDelivered}</td>
                            <td className="py-2 px-2 text-end font-bold text-orange-700">{item.totalConsumed}</td>
                            <td className="py-2 px-2 text-end font-bold text-blue-700">{item.totalRemaining}</td>
                            <td className="py-2 px-2 text-end">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${rate >= 80 ? "bg-red-600" : rate >= 50 ? "bg-orange-600" : "bg-green-600"}`} style={{ width: `${Math.min(100, rate)}%` }} />
                                </div>
                                <span className="text-xs font-bold text-gray-800 min-w-[32px] text-end">{rate}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {mAggregated.length > 0 && (
                        <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                          <td colSpan={4} className="py-3 px-4 text-gray-900">{t.crTotalLabel}</td>
                          <td className="py-3 px-4 text-end text-gray-900">{mAggregated.reduce((s, i) => s + (i.sellingPrice * i.totalDelivered), 0) > 0 ? cur(mAggregated.reduce((s, i) => s + (i.sellingPrice * i.totalDelivered), 0)) : ""}</td>
                          <td className="py-3 px-4 text-end text-gray-900">{mTotalDelivered}</td>
                          <td className="py-3 px-4 text-end text-orange-700">{mTotalConsumed}</td>
                          <td className="py-3 px-4 text-end text-blue-700">{mAggregated.reduce((s, i) => s + i.totalRemaining, 0)}</td>
                          <td className="py-3 px-4 text-end text-gray-900">{mConsumptionRate}%</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {mOrders.length > 0 && (
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-card mb-8 print:break-inside-avoid">
                <h3 className="text-base font-bold p-5 border-b-2 border-gray-200 flex items-center gap-2 text-gray-900 bg-gray-50">
                  <ShoppingCart className="h-5 w-5 text-primary" /> {t.crOrdersLog} — {toFullMonthLabel(selectedMonth)}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 border-b-2 border-gray-300">
                        <th className="py-3 px-4 text-start font-bold text-gray-900">{t.crOrderId}</th>
                        <th className="py-3 px-4 text-start font-bold text-gray-900">{t.crDate}</th>
                        <th className="py-3 px-4 text-center font-bold text-gray-900">{t.crMaterials}</th>
                        <th className="py-3 px-4 text-end font-bold text-gray-900">{t.crValue}</th>
                        <th className="py-3 px-4 text-start font-bold text-gray-900">{t.crStatusLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mOrders.map(o => (
                        <tr key={o.id} className="border-b border-gray-200 print:even:bg-gray-50">
                          <td className="py-3 px-4 font-mono text-xs text-gray-700">{o.id}</td>
                          <td className="py-3 px-4 text-gray-800 font-medium">{o.date}</td>
                          <td className="py-3 px-4 text-center text-gray-700 font-medium">{o.lines}</td>
                          <td className="py-3 px-4 text-end font-semibold text-gray-900">{o.totalSelling > 0 ? cur(o.totalSelling) : "—"}</td>
                          <td className="py-3 px-4"><StatusBadge status={o.status} label={statusLabel(o.status)} /></td>
                        </tr>
                      ))}
                      <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                        <td colSpan={3} className="py-3 px-4 text-gray-900">{t.crTotalCount} {mOrders.length} {t.crOrderUnit}</td>
                        <td className="py-3 px-4 text-end text-gray-900">{cur(mStats.totalValue)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {mDeliveries.length > 0 && (
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-card mb-8 print:break-inside-avoid">
                <h3 className="text-base font-bold p-5 border-b-2 border-gray-200 flex items-center gap-2 text-gray-900 bg-gray-50">
                  <Truck className="h-5 w-5 text-primary" /> {t.crDeliveriesLog} — {toFullMonthLabel(selectedMonth)}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 border-b-2 border-gray-300">
                        <th className="py-3 px-4 text-start font-bold text-gray-900">{t.crDeliveryId}</th>
                        <th className="py-3 px-4 text-start font-bold text-gray-900">{t.crOrderRef}</th>
                        <th className="py-3 px-4 text-start font-bold text-gray-900">{t.crDate}</th>
                        <th className="py-3 px-4 text-start font-bold text-gray-900">{t.crStatusLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mDeliveries.map(d => (
                        <tr key={d.id} className="border-b border-gray-200 print:even:bg-gray-50">
                          <td className="py-3 px-4 font-mono text-xs text-gray-700">{d.id}</td>
                          <td className="py-3 px-4 font-mono text-xs text-gray-700">{d.orderId || "—"}</td>
                          <td className="py-3 px-4 text-gray-800 font-medium">{d.date}</td>
                          <td className="py-3 px-4"><StatusBadge status={d.status} label={statusLabel(d.status)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {mOrders.length === 0 && mDeliveries.length === 0 && mCollections.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">{t.crNoData} {toYMLabel(selectedMonth)}</p>
                <p className="text-xs mt-1">{t.crTryAnother}</p>
              </div>
            )}
          </>
        )}

        {tab === "full" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              <StatBox label={t.crMaterialCount} value={stats.materialCount} icon={Package} color="bg-blue-100 text-blue-700" />
              <StatBox label={t.crTotalOrders} value={orders.length} icon={ShoppingCart} color="bg-orange-100 text-orange-700" />
              <StatBox label={t.crDeliveryOps} value={confirmedDeliveries.length} icon={Truck} color="bg-green-100 text-green-700" />
              <StatBox label={t.crQtySupplied} value={stats.totalDelivered.toLocaleString()} icon={BarChart3} color="bg-teal-100 text-teal-700" />
              <StatBox label={t.crConsRate} value={`${stats.consumptionRate}%`} icon={PieChartIcon} color="bg-purple-100 text-purple-700" />
            </div>

            {lastAudit && (
              <div className="mb-8 border-2 border-gray-200 rounded-xl p-5 bg-card flex items-center gap-4 print:break-inside-avoid">
                <div className="h-10 w-10 rounded-lg bg-pink-100 flex items-center justify-center shrink-0">
                  <ClipboardCheck className="h-5 w-5 text-pink-700" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-gray-900">{t.crLastAudit}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {lastAuditDate ? new Date(lastAuditDate).toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" }) : "—"}
                    {" · "}{t.crAuditCount}: {audits.length}
                    {" · "}{t.crStatusLabel}: <span className={lastAudit.status === "Completed" ? "text-green-700 font-semibold" : "text-amber-700 font-semibold"}>{lastAudit.status === "Completed" ? t.crCompleted : lastAudit.status === "In Progress" ? t.crInProgress : lastAudit.status}</span>
                  </p>
                </div>
              </div>
            )}

            {monthlyOverviewData.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
                <div className="border-2 border-gray-200 rounded-xl p-6 bg-card print:break-inside-avoid">
                  <h3 className="text-base font-bold mb-2 flex items-center gap-2 text-gray-900">
                    <CalendarDays className="h-5 w-5 text-primary" /> {t.crMonthlyActivity}
                  </h3>
                  <p className="hidden print:block text-xs text-gray-500 mb-3">{t.crPrintMonthlyDesc}</p>
                  <div className="h-[260px] print:h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={monthlyOverviewData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                        <XAxis dataKey="label" tick={AXIS_TICK} stroke="currentColor" />
                        <YAxis tick={AXIS_TICK} stroke="currentColor" />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: "12px", fontWeight: 600 }} />
                        <Bar dataKey="orders" fill="#f97316" name={t.crOrdersChart} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="deliveries" fill="#22c55e" name={t.crDeliveriesChart} radius={[4, 4, 0, 0]} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 border-t border-gray-200 pt-3">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-gray-50 border-b border-gray-200"><th className="py-2 px-3 text-start font-bold text-gray-700">{t.crMonthLabel}</th><th className="py-2 px-3 text-end font-bold text-gray-700">{t.crOrdersChart}</th><th className="py-2 px-3 text-end font-bold text-gray-700">{t.crDeliveriesChart}</th></tr></thead>
                      <tbody>{monthlyOverviewData.map((d, i) => <tr key={i} className="border-b border-gray-100 print:even:bg-gray-50"><td className="py-1.5 px-3 font-medium text-gray-800">{d.label}</td><td className="py-1.5 px-3 text-end font-semibold text-orange-600">{d.orders}</td><td className="py-1.5 px-3 text-end font-semibold text-green-600">{d.deliveries}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>

                <div className="border-2 border-gray-200 rounded-xl p-6 bg-card print:break-inside-avoid">
                  <h3 className="text-base font-bold mb-2 flex items-center gap-2 text-gray-900">
                    <DollarSign className="h-5 w-5 text-primary" /> {t.crMonthlyOrderVal}
                  </h3>
                  <p className="hidden print:block text-xs text-gray-500 mb-3">{t.crPrintMonthlyValDesc}</p>
                  <div className="h-[260px] print:h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyOverviewData}>
                        <defs>
                          <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                        <XAxis dataKey="label" tick={AXIS_TICK} stroke="currentColor" />
                        <YAxis tick={AXIS_TICK} stroke="currentColor" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [cur(Number(v)), t.crValueOnly]} />
                        <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={3} fill="url(#valueGrad)" name={t.crValueOnly} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 border-t border-gray-200 pt-3">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-gray-50 border-b border-gray-200"><th className="py-2 px-3 text-start font-bold text-gray-700">{t.crMonthLabel}</th><th className="py-2 px-3 text-end font-bold text-gray-700">{t.crValueEgp}</th></tr></thead>
                      <tbody>{monthlyOverviewData.map((d, i) => <tr key={i} className="border-b border-gray-100 print:even:bg-gray-50"><td className="py-1.5 px-3 font-medium text-gray-800">{d.label}</td><td className="py-1.5 px-3 text-end font-semibold text-orange-600">{cur(d.value)}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {pieData.length > 0 && (
              <div className="mb-8 border-2 border-gray-200 rounded-xl p-5 bg-card print:break-inside-avoid">
                <h3 className="text-base font-bold mb-2 flex items-center gap-2 text-gray-900">
                  <PieChartIcon className="h-5 w-5 text-primary" /> {t.crConsDist}
                </h3>
                <p className="hidden print:block text-xs text-gray-500 mb-3">{t.crPrintConsDistDesc}</p>
                <div className="h-[260px] print:h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={95} paddingAngle={2} dataKey="value" strokeWidth={2} stroke="#fff">
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v} ${t.crUnits}`, t.crConsumed]} />
                      <Legend wrapperStyle={{ fontSize: "11px", fontWeight: 600 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 border-t border-gray-200 pt-2 space-y-1">
                  {pieData.map((d, i) => <div key={i} className="flex justify-between text-xs"><span className="font-medium text-gray-700 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>{d.name}</span><span className="font-bold text-gray-900">{d.value} {t.crUnits}</span></div>)}
                </div>
              </div>
            )}

            {barData.length > 0 && (
              <div className="mb-8 border-2 border-gray-200 rounded-xl overflow-hidden bg-card print:break-inside-avoid">
                <h3 className="text-base font-bold p-5 border-b-2 border-gray-200 flex items-center gap-2 text-gray-900 bg-gray-50">
                  <BarChart3 className="h-5 w-5 text-primary" /> {t.crConsVsRemain}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-200 text-xs">
                        <th className="py-2.5 px-3 text-start font-bold text-gray-600 w-[30px]">#</th>
                        <th className="py-2.5 px-3 text-start font-bold text-gray-600">{t.crMaterial}</th>
                        <th className="py-2.5 px-3 text-end font-bold text-gray-600 w-[60px]">{t.crSupplied}</th>
                        <th className="py-2.5 px-3 text-end font-bold text-gray-600 w-[60px]">{t.crConsumed}</th>
                        <th className="py-2.5 px-3 text-end font-bold text-gray-600 w-[60px]">{t.crRemainingCol}</th>
                        <th className="py-2.5 px-3 text-center font-bold text-gray-600 w-[200px]">{t.crConsRate}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {barData.map((d, idx) => renderProgressBar(d, idx))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-card mb-8 print:break-inside-avoid">
              <h3 className="text-base font-bold p-5 border-b-2 border-gray-200 flex items-center gap-2 text-gray-900 bg-gray-50">
                <Package className="h-5 w-5 text-primary" /> {t.crMaterialDetails}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-[30px]" />
                    <col className="w-[45px]" />
                    <col />
                    <col className="w-[50px]" />
                    <col className="w-[70px]" />
                    <col className="w-[55px]" />
                    <col className="w-[55px]" />
                    <col className="w-[55px]" />
                    <col className="w-[55px]" />
                    <col className="w-[90px]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                      <th className="py-3 px-2 text-start font-bold text-gray-900">#</th>
                      <th className="py-3 px-2 text-center font-bold text-gray-900">{t.crImage}</th>
                      <th className="py-3 px-2 text-start font-bold text-gray-900">{t.crMaterial}</th>
                      <th className="py-3 px-2 text-start font-bold text-gray-900 w-14">{t.crUnit}</th>
                      <th className="py-3 px-2 text-end font-bold text-gray-900 w-20">{t.crSellingPrice}</th>
                      <th className="py-3 px-2 text-end font-bold text-gray-900 w-16">{t.crDelivered}</th>
                      <th className="py-3 px-2 text-end font-bold text-gray-900 w-16">{t.crConsumedQty}</th>
                      <th className="py-3 px-2 text-end font-bold text-gray-900 w-16">{t.crRemainingQty}</th>
                      <th className="py-3 px-2 text-end font-bold text-gray-900 w-16">{t.crWeekly}</th>
                      <th className="py-3 px-2 text-end font-bold text-gray-900 w-24">{t.crConsumption}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregated.map((item, idx) => {
                      const rate = item.totalDelivered > 0 ? Math.round((item.totalConsumed / item.totalDelivered) * 100) : 0;
                      return (
                        <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 print:even:bg-gray-50">
                          <td className="py-2 px-2 text-gray-600 font-medium">{idx + 1}</td>
                          <td className="py-1 px-2 text-center">{renderMaterialImage(item.imageUrl, item.material)}</td>
                          <td className="py-2 px-2 font-semibold text-gray-900 text-xs overflow-hidden text-ellipsis whitespace-nowrap" title={item.material}>{item.material}</td>
                          <td className="py-2 px-2 text-gray-700 text-xs">{item.unit}</td>
                          <td className="py-2 px-2 text-end text-gray-800 font-medium text-xs">{item.sellingPrice > 0 ? `${item.sellingPrice.toLocaleString()}` : "—"}</td>
                          <td className="py-2 px-2 text-end text-gray-800 font-medium">{item.totalDelivered}</td>
                          <td className="py-2 px-2 text-end font-bold text-orange-700">{item.totalConsumed}</td>
                          <td className="py-2 px-2 text-end font-bold text-blue-700">{item.totalRemaining}</td>
                          <td className="py-2 px-2 text-end text-gray-700 font-medium">{item.avgWeekly > 0 ? item.avgWeekly.toFixed(1) : "—"}</td>
                          <td className="py-2 px-2 text-end">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${rate >= 80 ? "bg-red-600" : rate >= 50 ? "bg-orange-600" : "bg-green-600"}`} style={{ width: `${Math.min(100, rate)}%` }} />
                              </div>
                              <span className="text-xs font-bold text-gray-800 min-w-[32px] text-end">{rate}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {aggregated.length > 0 && (
                      <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                        <td colSpan={4} className="py-3 px-4 text-gray-900">{t.crTotalLabel}</td>
                        <td className="py-3 px-4 text-end text-gray-900">{stats.totalSellingValue > 0 ? cur(stats.totalSellingValue) : ""}</td>
                        <td className="py-3 px-4 text-end text-gray-900">{stats.totalDelivered}</td>
                        <td className="py-3 px-4 text-end text-orange-700">{stats.totalConsumed}</td>
                        <td className="py-3 px-4 text-end text-blue-700">{stats.totalRemaining}</td>
                        <td className="py-3 px-4 text-end text-gray-900">{stats.avgWeeklyTotal > 0 ? stats.avgWeeklyTotal.toFixed(1) : "—"}</td>
                        <td className="py-3 px-4 text-end text-gray-900">{stats.consumptionRate}%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {orders.length > 0 && (
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-card mb-8 print:break-inside-avoid">
                <h3 className="text-base font-bold p-5 border-b-2 border-gray-200 flex items-center gap-2 text-gray-900 bg-gray-50">
                  <ShoppingCart className="h-5 w-5 text-primary" /> {t.crOrdersLog} ({t.crLast15})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 border-b-2 border-gray-300">
                        <th className="py-3 px-4 text-start font-bold text-gray-900">{t.crOrderId}</th>
                        <th className="py-3 px-4 text-start font-bold text-gray-900">{t.crDate}</th>
                        <th className="py-3 px-4 text-center font-bold text-gray-900">{t.crMaterials}</th>
                        <th className="py-3 px-4 text-end font-bold text-gray-900">{t.crValue}</th>
                        <th className="py-3 px-4 text-start font-bold text-gray-900">{t.crStatusLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 15).map(o => (
                        <tr key={o.id} className="border-b border-gray-200 print:even:bg-gray-50">
                          <td className="py-3 px-4 font-mono text-xs text-gray-700">{o.id}</td>
                          <td className="py-3 px-4 text-gray-800 font-medium">{o.date}</td>
                          <td className="py-3 px-4 text-center text-gray-700 font-medium">{o.lines}</td>
                          <td className="py-3 px-4 text-end font-semibold text-gray-900">{o.totalSelling > 0 ? cur(o.totalSelling) : "—"}</td>
                          <td className="py-3 px-4"><StatusBadge status={o.status} label={statusLabel(o.status)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {deliveries.length > 0 && (
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-card mb-8 print:break-inside-avoid">
                <h3 className="text-base font-bold p-5 border-b-2 border-gray-200 flex items-center gap-2 text-gray-900 bg-gray-50">
                  <Truck className="h-5 w-5 text-primary" /> {t.crDeliveriesLog} ({t.crLast15})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 border-b-2 border-gray-300">
                        <th className="py-3 px-4 text-start font-bold text-gray-900">{t.crDeliveryId}</th>
                        <th className="py-3 px-4 text-start font-bold text-gray-900">{t.crOrderRef}</th>
                        <th className="py-3 px-4 text-start font-bold text-gray-900">{t.crDate}</th>
                        <th className="py-3 px-4 text-start font-bold text-gray-900">{t.crStatusLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.slice(0, 15).map(d => (
                        <tr key={d.id} className="border-b border-gray-200 print:even:bg-gray-50">
                          <td className="py-3 px-4 font-mono text-xs text-gray-700">{d.id}</td>
                          <td className="py-3 px-4 font-mono text-xs text-gray-700">{d.orderId || "—"}</td>
                          <td className="py-3 px-4 text-gray-800 font-medium">{d.date}</td>
                          <td className="py-3 px-4"><StatusBadge status={d.status} label={statusLabel(d.status)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* === SECTION DIVIDER before footer === */}
        <div className="print-section-divider hidden print:block my-6">
          <div className="border-t-2 border-orange-200"></div>
        </div>

        {/* === OFFICIAL STAMP & QR (Print Only) === */}
        <div className="hidden print:block mb-6 print-stamp-block print:break-inside-avoid">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="border-2 border-gray-300 rounded-lg p-4 text-center inline-block">
                <Award className="h-8 w-8 mx-auto text-orange-500 mb-1" />
                <p className="text-[11px] font-bold text-gray-800">{t.crOfficialReport}</p>
                <p className="text-[9px] text-gray-500 mt-0.5">{t.crIssuedBy} DSB</p>
                <p className="text-[9px] text-gray-400 mt-0.5">{reportDate}</p>
              </div>
            </div>
            <div className="text-center">
              <img src={QR_URL} alt="QR" className="w-16 h-16 mx-auto mb-1" />
              <p className="text-[8px] text-gray-400">{t.crScanToContact}</p>
            </div>
          </div>
        </div>

        {/* === FOOTER === */}
        <div className="text-center text-sm text-gray-500 font-medium border-t-2 border-gray-300 pt-5 mt-8 print:mt-4">
          <p className="font-bold text-gray-700">DSB — Dental Smart Box</p>
          <p className="mt-1">{t.crDentalMgmt} &nbsp;|&nbsp; <span dir="ltr">+20 11 0229 7174</span> &nbsp;|&nbsp; <span dir="ltr">dsbs.store</span></p>
          <p className="mt-1 text-xs text-gray-400">{t.crReportGenBy} — {reportDate}</p>
          <p className="mt-1 text-xs text-gray-400">{t.crPreparedFor} {client.name} — {t.crAllRights}</p>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-card print:break-inside-avoid stat-box-print shadow-sm hover:shadow-md transition-shadow">
      <div className={`h-9 w-9 rounded-full ${color} flex items-center justify-center mb-2.5`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-gray-500 font-semibold">{label}</p>
      <p className="text-lg font-bold mt-0.5 text-gray-900">{value}</p>
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const color = ["Delivered", "Closed", "Completed"].includes(status) || status === "مُسلَّم"
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : status === "Cancelled"
    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>{label}</span>;
}
