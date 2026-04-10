import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, FileText, TrendingUp, Users, Package, Loader2, Truck, Wallet, DollarSign, ArrowUpDown, CheckCircle2, Factory, RotateCcw, ClipboardCheck, Boxes, UserCog, AlertTriangle } from "lucide-react";
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
  const [founders, setFounders] = useState<any[]>([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState<any[]>([]);
  const [treasuryTxns, setTreasuryTxns] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [companyInventory, setCompanyInventory] = useState<any[]>([]);
  const [orderLines, setOrderLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any[]>("/orders").catch(() => []),
      api.get<any[]>("/clients").catch(() => []),
      api.get<any[]>("/deliveries").catch(() => []),
      api.get<any[]>("/collections").catch(() => []),
      api.get<any[]>("/client-inventory").catch(() => []),
      api.get<any[]>("/founders").catch(() => []),
      api.get<any[]>("/treasury/accounts").catch(() => []),
      api.get<any[]>("/treasury/transactions").catch(() => []),
      api.get<any[]>("/suppliers").catch(() => []),
      api.get<any[]>("/returns").catch(() => []),
      api.get<any[]>("/audits").catch(() => []),
      api.get<any[]>("/company-inventory").catch(() => []),
      api.get<any[]>("/order-lines").catch(() => []),
    ]).then(([o, c, d, col, inv, f, ta, tt, sup, ret, aud, ci, ol]) => {
      setOrders(o || []);
      setClients(c || []);
      setDeliveries(d || []);
      setCollections(col || []);
      setInventory(inv || []);
      setFounders(f || []);
      setTreasuryAccounts(ta || []);
      setTreasuryTxns(tt || []);
      setSuppliers(sup || []);
      setReturns(ret || []);
      setAudits(aud || []);
      setCompanyInventory(ci || []);
      setOrderLines(ol || []);
    }).finally(() => setLoading(false));
  }, []);

  const clientMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clients || []).forEach((c: any) => { m[c.id] = c.name || c.id; });
    return m;
  }, [clients]);

  const deliveredStatuses = ["Delivered", "Closed", "Completed"];
  const clientRevenue = useMemo(() => {
    const map: Record<string, { client: string; clientId: string; revenue: number; cost: number; orders: number }> = {};
    for (const o of orders) {
      const cid = o.client_id || o.clientId || "";
      if (cid === "company-inventory") continue;
      const name = o.client || clientMap[cid] || cid || "غير محدد";
      if (!map[cid]) map[cid] = { client: name, clientId: cid, revenue: 0, cost: 0, orders: 0 };
      map[cid].orders += 1;
      if (deliveredStatuses.includes(o.status)) {
        const rev = parseFloat(String(o.total_selling || o.totalSelling || "0").replace(/,/g, "")) || 0;
        const cost = parseFloat(String(o.total_cost || o.totalCost || "0").replace(/,/g, "")) || 0;
        map[cid].revenue += rev;
        map[cid].cost += cost;
      }
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [orders, clientMap]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; label: string; orders: number; revenue: number; cost: number; profit: number }> = {};
    for (const o of orders) {
      const cid = o.client_id || o.clientId || "";
      if (cid === "company-inventory") continue;
      const date = o.date || o.created_at || "";
      const ym = date.slice(0, 7);
      if (!ym) continue;
      if (!map[ym]) map[ym] = { month: ym, label: MONTH_LABELS[ym.slice(5)] || ym.slice(5), orders: 0, revenue: 0, cost: 0, profit: 0 };
      map[ym].orders += 1;
      if (deliveredStatuses.includes(o.status)) {
        const rev = parseFloat(String(o.total_selling || o.totalSelling || "0").replace(/,/g, "")) || 0;
        const cost = parseFloat(String(o.total_cost || o.totalCost || "0").replace(/,/g, "")) || 0;
        map[ym].revenue += rev;
        map[ym].cost += cost;
        map[ym].profit += (rev - cost);
      }
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12).map(m => ({ ...m, month: m.label }));
  }, [orders]);

  const clientOnlyOrders = useMemo(() => orders.filter(o => (o.client_id || o.clientId) !== "company-inventory"), [orders]);
  const orderStatusDist = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of clientOnlyOrders) {
      const s = o.status || "Draft";
      map[s] = (map[s] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] || "#94a3b8" }));
  }, [clientOnlyOrders]);

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

  const founderStats = useMemo(() => {
    return (founders || []).map((f: any) => {
      let totalFunding = 0;
      let owedFromSettlements = 0;
      (orders || []).forEach((o: any) => {
        const contribs = Array.isArray(o.founderContributions) ? o.founderContributions : [];
        const myContrib = contribs.find((c: any) => (c.founderId || c.founder_id) === f.id);
        if (!myContrib) return;
        totalFunding += Number(myContrib.amount || 0);

        let costPaidMap: Record<string, number> = {};
        try {
          const raw = o.orderCostPaidByFounder ?? o.order_cost_paid_by_founder;
          costPaidMap = typeof raw === "object" && raw !== null ? raw : JSON.parse(raw || "{}");
        } catch {}
        const entries = contribs.map((c: any) => {
          const fId = c.founderId || c.founder_id || "";
          const initialPaid = costPaidMap[fId] || 0;
          const share = Number(c.amount || 0);
          const paidAmt = Number(c.paidAmount ?? c.paid_amount ?? 0);
          return { id: fId, share, diff: initialPaid - share, paidAmt };
        }).filter((e: any) => e.id);
        const overpayers = entries.filter((e: any) => e.diff > 0);
        const underpayers = entries.filter((e: any) => e.diff < 0);
        if (overpayers.length === 0 || underpayers.length === 0) return;
        const oRemain = overpayers.map((e: any) => e.diff);
        const uRemain = underpayers.map((e: any) => Math.abs(e.diff));
        let oi = 0, ui = 0;
        while (oi < overpayers.length && ui < underpayers.length) {
          const transfer = Math.min(oRemain[oi], uRemain[ui]);
          if (transfer > 0) {
            const fromSettled = underpayers[ui].paidAmt >= underpayers[ui].share;
            if (!fromSettled && underpayers[ui].id === f.id) {
              owedFromSettlements += Math.round(transfer);
            }
          }
          oRemain[oi] -= transfer;
          uRemain[ui] -= transfer;
          if (oRemain[oi] <= 0) oi++;
          if (uRemain[ui] <= 0) ui++;
        }
      });
      const withdrawn = Number(f.totalWithdrawn || f.total_withdrawn || 0);
      return {
        name: f.name || f.id,
        contributed: Math.max(0, totalFunding - owedFromSettlements),
        withdrawn,
        balance: Math.max(0, totalFunding - owedFromSettlements) - withdrawn,
      };
    });
  }, [founders, orders]);

  const treasuryStats = useMemo(() => {
    let totalBalance = 0;
    (treasuryAccounts || []).forEach((a: any) => { totalBalance += Number(a.balance || 0); });
    let deposits = 0, withdrawals = 0;
    (treasuryTxns || []).forEach((tx: any) => {
      const amt = Number(tx.amount || 0);
      const type = tx.type || tx.txType || tx.tx_type || "";
      if (type === "deposit" || type === "إيداع") deposits += amt;
      else if (type === "withdrawal" || type === "سحب") withdrawals += amt;
    });
    return { accountCount: treasuryAccounts.length, totalBalance, deposits, withdrawals, txCount: treasuryTxns.length };
  }, [treasuryAccounts, treasuryTxns]);

  const supplierStats = useMemo(() => {
    const map: Record<string, { name: string; orders: number; totalCost: number }> = {};
    for (const line of orderLines) {
      const sid = line.supplierId || line.supplier_id || "";
      if (!sid) continue;
      if (!map[sid]) {
        const sup = suppliers.find((s: any) => s.id === sid);
        map[sid] = { name: sup?.name || sid, orders: 0, totalCost: 0 };
      }
      map[sid].orders += 1;
      map[sid].totalCost += Number(line.lineCost || line.line_cost || 0);
    }
    return Object.values(map).sort((a, b) => b.totalCost - a.totalCost);
  }, [orderLines, suppliers]);

  const returnsStats = useMemo(() => {
    let totalItems = 0, accepted = 0, pending = 0;
    for (const r of returns) {
      const items = Array.isArray(r.items) ? r.items : [];
      const count = items.length || Number(r.itemsCount || r.items_count || 1);
      totalItems += count;
      if (r.status === "Accepted" || r.status === "مقبول") accepted += count;
      else pending += count;
    }
    return { total: returns.length, totalItems, accepted, pending };
  }, [returns]);

  const auditStats = useMemo(() => {
    let matched = 0, shortage = 0, surplus = 0;
    for (const a of audits) {
      matched += Number(a.matched || 0);
      shortage += Number(a.shortage || 0);
      surplus += Number(a.surplus || 0);
    }
    return { total: audits.length, matched, shortage, surplus };
  }, [audits]);

  const companyInvStats = useMemo(() => {
    let totalValue = 0, inStock = 0;
    for (const ci of companyInventory) {
      const remaining = Number(ci.remaining || 0);
      const cost = Number(ci.costPrice || ci.cost_price || 0);
      totalValue += remaining * cost;
      if (remaining > 0) inStock++;
    }
    return { total: companyInventory.length, totalValue, inStock };
  }, [companyInventory]);

  const deliveryBearerDist = useMemo(() => {
    let clientBearer = 0, companyBearer = 0, companyDeliveryCost = 0;
    for (const o of clientOnlyOrders) {
      const bearer = o.deliveryFeeBearer || o.delivery_fee_bearer || "client";
      const fee = Number(o.deliveryFee || o.delivery_fee || 0);
      if (bearer === "company") { companyBearer++; companyDeliveryCost += fee; }
      else clientBearer++;
    }
    return [
      { name: "على العميل", value: clientBearer, color: "#3b82f6" },
      { name: "على الشركة", value: companyBearer, color: "#f97316" },
    ].filter(d => d.value > 0);
  }, [clientOnlyOrders]);

  const profitMarginByClient = useMemo(() => {
    return clientRevenue.filter(c => c.revenue > 0).map(c => ({
      client: c.client,
      margin: Number(((c.revenue - c.cost) / c.revenue * 100).toFixed(1)),
      profit: c.revenue - c.cost,
    })).sort((a, b) => b.margin - a.margin).slice(0, 10);
  }, [clientRevenue]);

  const treasuryMonthly = useMemo(() => {
    const map: Record<string, { month: string; deposits: number; withdrawals: number }> = {};
    for (const tx of treasuryTxns) {
      const date = tx.date || tx.created_at || "";
      const ym = date.slice(0, 7);
      if (!ym) continue;
      if (!map[ym]) map[ym] = { month: MONTH_LABELS[ym.slice(5)] || ym.slice(5), deposits: 0, withdrawals: 0 };
      const amt = Number(tx.amount || 0);
      const type = tx.type || tx.txType || tx.tx_type || "";
      if (type === "deposit" || type === "إيداع") map[ym].deposits += amt;
      else if (type === "withdrawal" || type === "سحب") map[ym].withdrawals += amt;
    }
    return Object.values(map).slice(-8);
  }, [treasuryTxns]);

  const orderSourceDist = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of clientOnlyOrders) {
      const src = o.source || "يدوي";
      map[src] = (map[src] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [clientOnlyOrders]);

  const totalRevenue = clientRevenue.reduce((s, c) => s + c.revenue, 0);
  const totalCost = clientRevenue.reduce((s, c) => s + c.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const totalOrdersCount = clientOnlyOrders.length;
  const activeClients = new Set(clientOnlyOrders.map(o => o.client_id || o.clientId).filter(Boolean)).size;

  const reports = [
    { name: t.clientRevenueReport, desc: t.clientRevenueDesc, icon: Users, action: () => exportToCsv("client_revenue", [t.client, t.revenue, t.totalOrders], clientRevenue.map(c => [c.client, c.revenue, c.orders])) },
    { name: t.pnlSummary, desc: t.pnlDesc, icon: TrendingUp, action: () => navigate("/company-profit") },
    { name: "التقرير المالي", desc: "تقرير مالي شامل للشركة", icon: DollarSign, action: () => navigate("/financial-report") },
    { name: "تقرير الأوردرات الشهري", desc: "ملخص الأوردرات والإيرادات شهرياً", icon: BarChart3, action: () => exportToCsv("monthly_orders", ["الشهر", "الأوردرات", "الإيرادات", "التكلفة", "الربح"], monthlyData.map(m => [m.month, m.orders, m.revenue, m.cost, m.profit])) },
    { name: t.inventoryStatusReport, desc: t.inventoryStatusDesc, icon: Package, action: () => navigate("/inventory") },
    { name: "تقرير مخزون الشركة", desc: `${companyInvStats.total} دفعة — قيمة ${companyInvStats.totalValue.toLocaleString()} ج.م`, icon: Boxes, action: () => exportToCsv("company_inventory", ["المادة", "رقم الدفعة", "الكمية المتبقية", "سعر التكلفة", "القيمة"], companyInventory.map(ci => [ci.materialName || ci.material_name || ci.material_code || "", ci.lotNumber || ci.lot_number || "", Number(ci.remaining || 0), Number(ci.costPrice || ci.cost_price || 0), Number(ci.remaining || 0) * Number(ci.costPrice || ci.cost_price || 0)])) },
    { name: t.agingReport, desc: t.agingDesc, icon: FileText, action: () => navigate("/collections") },
    { name: "تقرير الموردين", desc: `${suppliers.length} مورّد — مشتريات بقيمة ${supplierStats.reduce((s, x) => s + x.totalCost, 0).toLocaleString()} ج.م`, icon: Factory, action: () => exportToCsv("supplier_report", ["المورّد", "عدد البنود", "إجمالي التكلفة"], supplierStats.map(s => [s.name, s.orders, s.totalCost])) },
    { name: "تقرير المؤسسين", desc: `${founders.length} مؤسس — مساهمات وسحوبات`, icon: UserCog, action: () => exportToCsv("founders_report", ["المؤسس", "إجمالي المساهمات", "إجمالي السحوبات", "الرصيد"], founderStats.map(f => [f.name, f.contributed, f.withdrawn, f.balance])) },
    { name: "تقرير الخزينة", desc: `${treasuryStats.accountCount} حساب — رصيد ${treasuryStats.totalBalance.toLocaleString()} ج.م`, icon: Wallet, action: () => navigate("/treasury") },
    { name: "تقرير المرتجعات", desc: `${returnsStats.total} مرتجع — ${returnsStats.totalItems} عنصر`, icon: RotateCcw, action: () => exportToCsv("returns_report", ["الحالة", "العدد"], [["مقبول", returnsStats.accepted], ["معلق", returnsStats.pending], ["الإجمالي", returnsStats.totalItems]]) },
    { name: t.auditReport, desc: `${auditStats.total} جرد — ${auditStats.shortage} عجز، ${auditStats.surplus} زيادة`, icon: ClipboardCheck, action: () => navigate("/audits") },
    { name: "تقرير التوصيلات", desc: `${deliveryStats.total} توصيل — ${deliveryStats.confirmed} مؤكدة`, icon: Truck, action: () => exportToCsv("deliveries_report", ["الشهر", "مؤكدة", "معلقة"], deliveryStats.monthly.map(m => [m.month, m.confirmed, m.pending])) },
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
            ["مخزون العملاء", "إجمالي الدفعات", inventoryStats.total],
            ["مخزون العملاء", "قيمة المخزون", inventoryStats.totalValue],
            ["مخزون الشركة", "إجمالي الدفعات", companyInvStats.total],
            ["مخزون الشركة", "في المخزن", companyInvStats.inStock],
            ["مخزون الشركة", "قيمة المخزون", companyInvStats.totalValue],
            ["المؤسسين", "عدد المؤسسين", founders.length],
            ...founderStats.map(f => ["المؤسسين", `${f.name} — رصيد`, f.balance]),
            ["الخزينة", "عدد الحسابات", treasuryStats.accountCount],
            ["الخزينة", "إجمالي الرصيد", treasuryStats.totalBalance],
            ["الخزينة", "إجمالي الإيداعات", treasuryStats.deposits],
            ["الخزينة", "إجمالي السحوبات", treasuryStats.withdrawals],
            ["الموردين", "عدد الموردين", suppliers.length],
            ...supplierStats.slice(0, 10).map(s => ["الموردين", `${s.name} — تكلفة`, s.totalCost]),
            ["المرتجعات", "إجمالي المرتجعات", returnsStats.total],
            ["المرتجعات", "عناصر مقبولة", returnsStats.accepted],
            ["المرتجعات", "عناصر معلقة", returnsStats.pending],
            ["الجرد", "إجمالي عمليات الجرد", auditStats.total],
            ["الجرد", "مطابق", auditStats.matched],
            ["الجرد", "عجز", auditStats.shortage],
            ["الجرد", "زيادة", auditStats.surplus],
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
        {supplierStats.length > 0 && (
          <div className="stat-card">
            <h3 className="font-semibold text-sm mb-4">مشتريات الموردين</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={supplierStats.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${Number(v).toLocaleString()} ${t.currency}`, "التكلفة"]} />
                <Bar dataKey="totalCost" fill="#f59e0b" radius={[0, 4, 4, 0]} name="إجمالي التكلفة" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {profitMarginByClient.length > 0 && (
          <div className="stat-card">
            <h3 className="font-semibold text-sm mb-4">هامش الربح حسب العميل</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={profitMarginByClient} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
                <YAxis dataKey="client" type="category" width={90} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) => [name === "هامش الربح" ? `${v}%` : `${Number(v).toLocaleString()} ${t.currency}`, name]} />
                <Bar dataKey="margin" fill="#22c55e" radius={[0, 4, 4, 0]} name="هامش الربح">
                  {profitMarginByClient.map((entry, i) => (
                    <Cell key={i} fill={entry.margin >= 20 ? "#22c55e" : entry.margin >= 10 ? "#f59e0b" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {founderStats.length > 0 && (
          <div className="stat-card cursor-pointer" onClick={() => navigate("/founders")}>
            <h3 className="font-semibold text-sm mb-4">أرصدة المؤسسين</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={founderStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) => [`${Number(v).toLocaleString()} ${t.currency}`, name]} />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                <Bar dataKey="contributed" fill="#3b82f6" radius={[4, 4, 0, 0]} name="المساهمات" />
                <Bar dataKey="withdrawn" fill="#ef4444" radius={[4, 4, 0, 0]} name="السحوبات" />
                <Bar dataKey="balance" fill="#22c55e" radius={[4, 4, 0, 0]} name="الرصيد" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {deliveryBearerDist.length > 0 && (
          <div className="stat-card">
            <h3 className="font-semibold text-sm mb-4">تحمّل رسوم التوصيل</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={deliveryBearerDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 1 }} style={{ fontSize: "11px" }}>
                  {deliveryBearerDist.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) => [`${v} أوردر`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs">
              {deliveryBearerDist.map(d => (
                <span key={d.name} style={{ color: d.color }}>{d.name}: {d.value}</span>
              ))}
            </div>
          </div>
        )}

        {orderSourceDist.length > 0 && (
          <div className="stat-card">
            <h3 className="font-semibold text-sm mb-4">مصادر الأوردرات</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={orderSourceDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 1 }} style={{ fontSize: "10px" }}>
                  {orderSourceDist.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) => [`${v} أوردر`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {treasuryMonthly.length > 0 && (
          <div className="stat-card cursor-pointer" onClick={() => navigate("/treasury")}>
            <h3 className="font-semibold text-sm mb-4">حركة الخزينة الشهرية</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={treasuryMonthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) => [`${Number(v).toLocaleString()} ${t.currency}`, name]} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="deposits" fill="#22c55e" radius={[4, 4, 0, 0]} name="إيداعات" />
                <Bar dataKey="withdrawals" fill="#ef4444" radius={[4, 4, 0, 0]} name="سحوبات" />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs">
              <span className="text-muted-foreground">{treasuryStats.accountCount} حساب</span>
              <span className="text-green-600">إيداعات: {treasuryStats.deposits.toLocaleString()}</span>
              <span className="text-red-600">سحوبات: {treasuryStats.withdrawals.toLocaleString()}</span>
              <span className="font-medium text-primary">الرصيد: {treasuryStats.totalBalance.toLocaleString()}</span>
            </div>
          </div>
        )}

        {(auditStats.total > 0 || returnsStats.total > 0) && (
          <div className="stat-card">
            <h3 className="font-semibold text-sm mb-4">الجرد والمرتجعات</h3>
            <div className="grid grid-cols-2 gap-4">
              {auditStats.total > 0 && (
                <div className="cursor-pointer" onClick={() => navigate("/audits")}>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">نتائج الجرد</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={[
                        { name: "مطابق", value: auditStats.matched, color: "#22c55e" },
                        { name: "عجز", value: auditStats.shortage, color: "#ef4444" },
                        { name: "زيادة", value: auditStats.surplus, color: "#3b82f6" },
                      ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 1 }} style={{ fontSize: "9px" }}>
                        {[
                          { name: "مطابق", value: auditStats.matched, color: "#22c55e" },
                          { name: "عجز", value: auditStats.shortage, color: "#ef4444" },
                          { name: "زيادة", value: auditStats.surplus, color: "#3b82f6" },
                        ].filter(d => d.value > 0).map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-3 text-[10px] mt-1">
                    <span className="text-green-600">مطابق: {auditStats.matched}</span>
                    <span className="text-red-600">عجز: {auditStats.shortage}</span>
                    <span className="text-blue-600">زيادة: {auditStats.surplus}</span>
                  </div>
                </div>
              )}
              {returnsStats.total > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">المرتجعات</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={[
                        { name: "مقبول", value: returnsStats.accepted, color: "#22c55e" },
                        { name: "معلق", value: returnsStats.pending, color: "#f59e0b" },
                      ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 1 }} style={{ fontSize: "9px" }}>
                        {[
                          { name: "مقبول", value: returnsStats.accepted, color: "#22c55e" },
                          { name: "معلق", value: returnsStats.pending, color: "#f59e0b" },
                        ].filter(d => d.value > 0).map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-3 text-[10px] mt-1">
                    <span className="text-green-600">مقبول: {returnsStats.accepted}</span>
                    <span className="text-yellow-600">معلق: {returnsStats.pending}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
