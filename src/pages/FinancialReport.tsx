import { useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBusinessRules, getCompanyShareRatio, getFounderShareRatio } from "@/lib/useBusinessRules";
import {
  FileBarChart, DollarSign, TrendingUp, Wallet, Users, Download,
  Printer, Activity, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle2, Clock, ShoppingBag, CreditCard, Building2,
  CalendarDays, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/lib/exportCsv";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, AreaChart, Area, Legend, Line,
  ComposedChart, RadialBarChart, RadialBar
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { subMonths, format, parseISO } from "date-fns";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#6366f1", "#f43f5e", "#14b8a6", "#f59e0b", "#8b5cf6",
];

type Order = {
  id: string; totalSelling?: any; total_selling?: any; totalCost?: any; total_cost?: any;
  createdAt?: string; created_at?: string; status?: string; client?: string; clientId?: string;
  founderContributions?: any[];
};
type TreasuryTx = {
  id: string; txType?: string; tx_type?: string; amount: number; category?: string;
  description?: string; createdAt?: string; created_at?: string; performedBy?: string;
};
type TreasuryAccount = { id: string; name: string; accountType?: string; custodianName?: string; balance: number; isActive?: boolean };
type Founder = { id: string; name: string; alias: string; share?: number };
type Collection = {
  id: string; total?: any; totalAmount?: any; total_amount?: any;
  paid?: any; paidAmount?: any; paid_amount?: any;
  dueDate?: string; due_date?: string; status?: string;
  createdAt?: string; created_at?: string;
};

const parseAmount = (val: unknown): number => {
  if (!val) return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[^\d.-]/g, "");
  return parseFloat(cleaned) || 0;
};

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-bold">{title}</h3>
        {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function KPICard({ title, value, subtitle, icon: Icon, color, trend, onClick }: {
  title: string; value: string; subtitle?: string; icon: any; color: string;
  trend?: { value: string; positive: boolean }; onClick?: () => void;
}) {
  return (
    <div
      className={`stat-card p-4 ${onClick ? "cursor-pointer hover:bg-muted/50" : ""} transition-all`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`h-8 w-8 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="h-4 w-4" />
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-[10px] font-medium ${trend.positive ? "text-success" : "text-destructive"}`}>
            {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend.value}
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mb-0.5">{title}</p>
      <p className="text-lg font-bold leading-tight">{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  direction: "rtl" as const,
};

export default function FinancialReportPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [period, setPeriod] = useState("6");
  const { rules } = useBusinessRules();
  const printRef = useRef<HTMLDivElement>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    revenue: true, cashflow: true, orders: true, collections: true, founders: true, treasury: true,
  });

  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const handleChartClick = (data: any) => {
    const mk = data?.activePayload?.[0]?.payload?.monthKey;
    if (mk) {
      const [y, m] = mk.split("-");
      navigate(`/monthly/${y}/${m}`);
    }
  };

  const { data: orders = [], isLoading: loadingOrders } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: () => api.get<Order[]>("/orders"),
  });

  const { data: txs = [], isLoading: loadingTxs } = useQuery<TreasuryTx[]>({
    queryKey: ["treasury_transactions"],
    queryFn: () => api.get<TreasuryTx[]>("/treasury/transactions"),
  });

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery<TreasuryAccount[]>({
    queryKey: ["treasury_accounts"],
    queryFn: () => api.get<TreasuryAccount[]>("/treasury/accounts"),
  });

  const { data: founders = [], isLoading: loadingFounders } = useQuery<Founder[]>({
    queryKey: ["founders"],
    queryFn: () => api.get<Founder[]>("/founders"),
  });

  const { data: collections = [], isLoading: loadingCollections } = useQuery<Collection[]>({
    queryKey: ["collections"],
    queryFn: () => api.get<Collection[]>("/collections"),
  });

  const { data: founderTxs = [] } = useQuery<any[]>({
    queryKey: ["founder_transactions"],
    queryFn: () => api.get<any[]>("/founder-transactions"),
  });

  const { data: returnsData = [] } = useQuery<any[]>({
    queryKey: ["returns"],
    queryFn: () => api.get<any[]>("/returns"),
  });

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

  const isLoading = loadingOrders || loadingTxs || loadingAccounts || loadingFounders || loadingCollections;

  const fmtMoney = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");
  const cur = t.currency;
  const monthCount = parseInt(period) || 6;
  const cutoff = useMemo(() => subMonths(new Date(), monthCount), [monthCount]);

  const activeAccounts = useMemo(() => (accounts || []).filter((a) => a.isActive !== false), [accounts]);
  const treasuryBalance = useMemo(() => activeAccounts.reduce((s, a) => s + parseAmount(a.balance), 0), [activeAccounts]);

  const { monthlyPnL, totals } = useMemo(() => {
    const monthlyData: Record<string, { revenue: number; cost: number; orderCount: number }> = {};
    const ensure = (key: string) => { if (!monthlyData[key]) monthlyData[key] = { revenue: 0, cost: 0, orderCount: 0 }; };

    const deliveredStatuses = ["Delivered", "Closed", "Completed", "مرتجع جزئي"];
    (orders || []).forEach((o) => {
      const cid = o.clientId || o.client_id || "";
      if (cid === "company-inventory") return;
      if (o.status === "مرتجع كلي") return;
      if (!deliveredStatuses.includes(o.status)) return;
      const dateStr = o.date || o.createdAt || o.created_at;
      if (!dateStr) return;
      try {
        const d = parseISO(dateStr);
        if (d < cutoff) return;
        const key = format(d, "yyyy-MM");
        ensure(key);
        const ded = returnDeductions[o.id];
        const selling = parseAmount(o.totalSelling ?? o.total_selling) - (ded?.returnedSelling || 0);
        const cost = parseAmount(o.totalCost ?? o.total_cost) - (ded?.returnedCost || 0);
        monthlyData[key].revenue += Math.max(selling, 0);
        monthlyData[key].cost += Math.max(cost, 0);
        monthlyData[key].orderCount += 1;
      } catch { }
    });

    const sorted = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b));
    const pnl = sorted.map(([key, d]) => {
      const profit = d.revenue - d.cost;
      const margin = d.revenue > 0 ? (profit / d.revenue) * 100 : 0;
      return {
        month: format(parseISO(key + "-01"), "MMM yy"),
        monthKey: key,
        revenue: d.revenue,
        cost: d.cost,
        profit,
        margin: Math.round(margin * 10) / 10,
        orderCount: d.orderCount,
        avgOrderValue: d.orderCount > 0 ? Math.round(d.revenue / d.orderCount) : 0,
        companyShare: profit > 0 ? Math.round(profit * getCompanyShareRatio(rules)) : 0,
        founderShare: profit > 0 ? Math.round(profit * getFounderShareRatio(rules)) : 0,
      };
    });

    const tRev = pnl.reduce((s, m) => s + m.revenue, 0);
    const tCost = pnl.reduce((s, m) => s + m.cost, 0);
    const tProfit = pnl.reduce((s, m) => s + m.profit, 0);
    const tOrders = pnl.reduce((s, m) => s + m.orderCount, 0);
    const tCompany = pnl.reduce((s, m) => s + m.companyShare, 0);
    const tFounder = pnl.reduce((s, m) => s + m.founderShare, 0);
    const margin = tRev > 0 ? (tProfit / tRev) * 100 : 0;

    return {
      monthlyPnL: pnl,
      totals: { revenue: tRev, cost: tCost, profit: tProfit, company: tCompany, founder: tFounder, orders: tOrders, margin },
    };
  }, [orders, cutoff, rules, returnDeductions]);

  const cashFlowData = useMemo(() => {
    const monthly: Record<string, { inflows: number; outflows: number; net: number }> = {};
    const ensure = (key: string) => { if (!monthly[key]) monthly[key] = { inflows: 0, outflows: 0, net: 0 }; };

    (txs || []).forEach((tx) => {
      const dateStr = tx.createdAt || tx.created_at;
      if (!dateStr) return;
      try {
        const d = parseISO(dateStr);
        if (d < cutoff) return;
        const key = format(d, "yyyy-MM");
        ensure(key);
        const tt = tx.txType || tx.tx_type;
        const amt = Math.abs(parseAmount(tx.amount));
        if (tt === "inflow") {
          monthly[key].inflows += amt;
        } else {
          monthly[key].outflows += amt;
        }
      } catch { }
    });

    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, d]) => ({
        month: format(parseISO(key + "-01"), "MMM yy"),
        monthKey: key,
        inflows: d.inflows,
        outflows: d.outflows,
        net: d.inflows - d.outflows,
      }));
  }, [txs, cutoff]);

  const totalInflows = useMemo(() => cashFlowData.reduce((s, d) => s + d.inflows, 0), [cashFlowData]);
  const totalOutflows = useMemo(() => cashFlowData.reduce((s, d) => s + d.outflows, 0), [cashFlowData]);

  const expenseByCat = useMemo(() => {
    const map: Record<string, number> = {};
    (txs || []).forEach((tx) => {
      const tt = tx.txType || tx.tx_type;
      if (tt !== "expense" && tt !== "withdrawal") return;
      const dateStr = tx.createdAt || tx.created_at;
      if (dateStr) {
        try { if (parseISO(dateStr) < cutoff) return; } catch { }
      }
      const cat = tx.category
        ? (t[("treasury_cat_" + tx.category) as keyof typeof t] as string || tx.category)
        : "أخرى";
      map[cat] = (map[cat] || 0) + Math.abs(parseAmount(tx.amount));
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [txs, cutoff, t]);

  const orderStatusData = useMemo(() => {
    const statusMap: Record<string, number> = {};
    (orders || []).forEach((o) => {
      const cid = o.clientId || o.client_id || "";
      if (cid === "company-inventory") return;
      const dateStr = o.createdAt || o.created_at;
      if (dateStr) {
        try { if (parseISO(dateStr) < cutoff) return; } catch { }
      }
      const st = o.status || "unknown";
      statusMap[st] = (statusMap[st] || 0) + 1;
    });
    return Object.entries(statusMap).map(([name, value]) => ({ name, value }));
  }, [orders, cutoff]);

  const topClients = useMemo(() => {
    const clientMap: Record<string, { revenue: number; orders: number; name: string }> = {};
    (orders || []).forEach((o) => {
      const cid = o.clientId || o.client_id || "";
      if (cid === "company-inventory") return;
      if (o.status === "مرتجع كلي") return;
      const deliveredStatuses2 = ["Delivered", "Closed", "Completed", "مرتجع جزئي"];
      if (!deliveredStatuses2.includes(o.status)) return;
      const dateStr = o.createdAt || o.created_at;
      if (dateStr) {
        try { if (parseISO(dateStr) < cutoff) return; } catch { }
      }
      const name = o.client || "غير محدد";
      if (!clientMap[name]) clientMap[name] = { revenue: 0, orders: 0, name };
      const ded = returnDeductions[o.id];
      const rev = parseAmount(o.totalSelling ?? o.total_selling) - (ded?.returnedSelling || 0);
      clientMap[name].revenue += Math.max(rev, 0);
      clientMap[name].orders += 1;
    });
    return Object.values(clientMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [orders, cutoff, returnDeductions]);

  const collectionsSummary = useMemo(() => {
    const today = new Date();
    let totalInvoiced = 0, totalCollected = 0, totalOutstanding = 0, overdueAmount = 0;
    let overdueCount = 0, onTimeCount = 0;

    const monthlyCollections: Record<string, { collected: number; outstanding: number }> = {};

    (collections || []).forEach((c) => {
      const dateStr = c.createdAt || c.created_at;
      if (dateStr) {
        try { if (parseISO(dateStr) < cutoff) return; } catch { }
      }

      const total = parseAmount(c.total ?? c.totalAmount ?? c.total_amount);
      const paid = parseAmount(c.paid ?? c.paidAmount ?? c.paid_amount);
      const remaining = total - paid;
      totalInvoiced += total;
      totalCollected += paid;
      totalOutstanding += remaining;

      if (dateStr) {
        try {
          const d = parseISO(dateStr);
          const key = format(d, "yyyy-MM");
          if (!monthlyCollections[key]) monthlyCollections[key] = { collected: 0, outstanding: 0 };
          monthlyCollections[key].collected += paid;
          monthlyCollections[key].outstanding += remaining;
        } catch { }
      }

      if (remaining > 0) {
        const due = c.dueDate || c.due_date;
        if (due && new Date(due) < today) {
          overdueAmount += remaining;
          overdueCount++;
        }
      }
      if (remaining <= 0) onTimeCount++;
    });

    const allOrdersSelling = orders
      .filter((o: any) => (o.clientId || o.client_id) !== "company-inventory")
      .reduce((s: number, o: any) => s + Number(o.totalSelling ?? o.total_selling ?? 0), 0);
    const rate = allOrdersSelling > 0 ? (totalCollected / allOrdersSelling) * 100 : 0;

    const monthlyData = Object.entries(monthlyCollections)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, d]) => ({
        month: format(parseISO(key + "-01"), "MMM yy"),
        collected: d.collected,
        outstanding: d.outstanding,
      }));

    return { totalInvoiced, totalCollected, totalOutstanding, overdueAmount, overdueCount, onTimeCount, rate, monthlyData };
  }, [collections, orders, cutoff]);

  const founderAnalysis = useMemo(() => {
    const fundingByFounder: Record<string, { paid: number; owed: number; withdrawals: number; contributions: number; name: string }> = {};

    (founders || []).forEach(f => {
      fundingByFounder[f.id] = { paid: 0, owed: 0, withdrawals: 0, contributions: 0, name: f.name };
    });

    (orders || []).forEach((o) => {
      const dateStr = o.createdAt || o.created_at;
      if (dateStr) {
        try { if (parseISO(dateStr) < cutoff) return; } catch { }
      }
      const contribs = o.founderContributions;
      if (!Array.isArray(contribs)) return;
      contribs.forEach((c: any) => {
        const fId = c.founderId || c.founder_id;
        if (!fId || !fundingByFounder[fId]) return;
        const amt = parseAmount(c.amount);
        if (c.paid) {
          fundingByFounder[fId].paid += amt;
        } else {
          fundingByFounder[fId].owed += amt;
        }
      });
    });

    (founderTxs || []).forEach((tx: any) => {
      const dateStr = tx.createdAt || tx.created_at || tx.date;
      if (dateStr) {
        try { if (parseISO(dateStr) < cutoff) return; } catch { }
      }
      const fId = tx.founderId;
      if (!fId || !fundingByFounder[fId]) return;
      if (tx.type === "withdrawal") fundingByFounder[fId].withdrawals += parseAmount(tx.amount);
      if (tx.type === "funding" || tx.type === "contribution") fundingByFounder[fId].contributions += parseAmount(tx.amount);
    });

    const data = Object.entries(fundingByFounder).map(([id, d]) => ({
      id,
      name: d.name,
      paid: d.paid,
      owed: d.owed,
      total: d.paid + d.owed,
      withdrawals: d.withdrawals,
      contributions: d.contributions,
    }));

    const totalOwed = data.reduce((s, d) => s + d.owed, 0);
    const totalPaid = data.reduce((s, d) => s + d.paid, 0);

    return { data, totalOwed, totalPaid };
  }, [founders, orders, founderTxs, cutoff]);

  const founderShares = useMemo(() => {
    return (founders || []).map((f, i) => ({
      name: f.name,
      share: f.share || Math.round(100 / Math.max(founders.length, 1)),
      color: COLORS[i % COLORS.length],
    }));
  }, [founders]);

  const handleExportFull = () => {
    const rows: (string | number)[][] = [];
    const pad = (arr: (string | number)[], len: number) => {
      while (arr.length < len) arr.push("");
      return arr;
    };
    const cols = 4;
    rows.push(pad(["القسم", "المؤشر", "القيمة", "ملاحظات"], cols));
    rows.push(pad(["ملخص عام", "إجمالي الإيرادات", fmtMoney(totals.revenue), cur], cols));
    rows.push(pad(["ملخص عام", "إجمالي التكلفة", fmtMoney(totals.cost), cur], cols));
    rows.push(pad(["ملخص عام", "صافي الربح", fmtMoney(totals.profit), cur], cols));
    rows.push(pad(["ملخص عام", "هامش الربح", `${totals.margin.toFixed(1)}%`, ""], cols));
    rows.push(pad(["ملخص عام", "عدد الأوردرات", String(totals.orders), ""], cols));
    rows.push(pad(["ملخص عام", "حصة الشركة", fmtMoney(totals.company), cur], cols));
    rows.push(pad(["ملخص عام", "حصة المؤسسين", fmtMoney(totals.founder), cur], cols));
    rows.push(pad(["الخزينة", "رصيد الخزينة", fmtMoney(treasuryBalance), cur], cols));
    rows.push(pad(["الخزينة", "إجمالي الواردات", fmtMoney(totalInflows), cur], cols));
    rows.push(pad(["الخزينة", "إجمالي المصروفات", fmtMoney(totalOutflows), cur], cols));
    rows.push(pad(["التحصيلات", "إجمالي المفوتر", fmtMoney(collectionsSummary.totalInvoiced), cur], cols));
    rows.push(pad(["التحصيلات", "إجمالي المحصل", fmtMoney(collectionsSummary.totalCollected), cur], cols));
    rows.push(pad(["التحصيلات", "المتبقي", fmtMoney(collectionsSummary.totalOutstanding), cur], cols));
    rows.push(pad(["التحصيلات", "المتأخر", fmtMoney(collectionsSummary.overdueAmount), cur], cols));
    rows.push(pad(["التحصيلات", "نسبة التحصيل", `${collectionsSummary.rate.toFixed(1)}%`, ""], cols));
    founderAnalysis.data.forEach(f => {
      rows.push(pad(["تمويل المؤسسين", f.name + " — مدفوع", fmtMoney(f.paid), cur], cols));
      rows.push(pad(["تمويل المؤسسين", f.name + " — عليه", fmtMoney(f.owed), cur], cols));
      rows.push(pad(["تمويل المؤسسين", f.name + " — مسحوبات", fmtMoney(f.withdrawals), cur], cols));
    });
    expenseByCat.forEach(e => rows.push(pad(["المصروفات", e.name, fmtMoney(e.value), cur], cols)));
    topClients.forEach(c => rows.push(pad(["العملاء", c.name, fmtMoney(c.revenue), `${c.orders} أوردر`], cols)));

    exportToCsv("تقرير_مالي_شامل", ["القسم", "المؤشر", "القيمة", "ملاحظات"], rows);
  };

  const handleExportMonthly = () => {
    const headers = ["الشهر", "الإيرادات", "التكلفة", "الربح", "الهامش %", "عدد الأوردرات", "متوسط قيمة الأوردر", "حصة الشركة", "حصة المؤسسين"];
    const rows = monthlyPnL.map(m => [
      m.month, m.revenue, m.cost, m.profit, `${m.margin}%`, m.orderCount, m.avgOrderValue, m.companyShare, m.founderShare
    ]);
    exportToCsv("تقرير_أرباح_شهري", headers, rows as any);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      </div>
    );
  }

  const noData = monthlyPnL.length === 0;

  return (
    <div className="space-y-6 animate-fade-in print:space-y-4" ref={printRef}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileBarChart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="page-header">{t.finReportTitle}</h1>
            <p className="page-description">{t.finReportDesc}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px] h-9">
              <CalendarDays className="h-3.5 w-3.5 me-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">{t.finReport3m}</SelectItem>
              <SelectItem value="6">{t.finReport6m}</SelectItem>
              <SelectItem value="12">{t.finReport1y}</SelectItem>
              <SelectItem value="24">سنتين</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportFull} className="gap-1">
            <Download className="h-3.5 w-3.5" />تقرير شامل
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportMonthly} className="gap-1">
            <Download className="h-3.5 w-3.5" />شهري
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1">
            <Printer className="h-3.5 w-3.5" />طباعة
          </Button>
        </div>
      </div>

      {/* ── Print Header ── */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">التقرير المالي الشامل — DSB</h1>
        <p className="text-sm text-muted-foreground">الفترة: آخر {period} أشهر · تاريخ الطباعة: {new Date().toLocaleDateString("ar-SA")}</p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 1: KPI Summary Cards
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          title="إجمالي الإيرادات"
          value={`${fmtMoney(totals.revenue)} ${cur}`}
          subtitle={`${totals.orders} أوردر`}
          icon={DollarSign}
          color="bg-blue-500/10 text-blue-600"
          onClick={() => navigate("/company-profit")}
        />
        <KPICard
          title="إجمالي التكلفة"
          value={`${fmtMoney(totals.cost)} ${cur}`}
          subtitle={`${(totals.cost / Math.max(totals.revenue, 1) * 100).toFixed(0)}% من الإيرادات`}
          icon={CreditCard}
          color="bg-orange-500/10 text-orange-600"
        />
        <KPICard
          title="صافي الربح"
          value={`${fmtMoney(totals.profit)} ${cur}`}
          subtitle={`هامش ${totals.margin.toFixed(1)}%`}
          icon={TrendingUp}
          color={totals.profit > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}
          trend={totals.profit > 0 ? { value: `${totals.margin.toFixed(0)}%`, positive: true } : undefined}
          onClick={() => navigate("/company-profit")}
        />
        <KPICard
          title="رصيد الخزينة"
          value={`${fmtMoney(treasuryBalance)} ${cur}`}
          subtitle={`${activeAccounts.length} حساب نشط`}
          icon={Wallet}
          color="bg-indigo-500/10 text-indigo-600"
          onClick={() => navigate("/treasury")}
        />
        <KPICard
          title="إجمالي التحصيلات"
          value={`${fmtMoney(collectionsSummary.totalCollected)} ${cur}`}
          subtitle={`نسبة ${collectionsSummary.rate.toFixed(0)}%`}
          icon={CheckCircle2}
          color="bg-emerald-500/10 text-emerald-600"
          trend={collectionsSummary.rate > 80 ? { value: `${collectionsSummary.rate.toFixed(0)}%`, positive: true } : undefined}
          onClick={() => navigate("/collections")}
        />
        <KPICard
          title="مستحقات متبقية"
          value={`${fmtMoney(collectionsSummary.totalOutstanding)} ${cur}`}
          subtitle={collectionsSummary.overdueCount > 0 ? `${collectionsSummary.overdueCount} متأخرة` : "لا يوجد متأخر"}
          icon={Clock}
          color="bg-amber-500/10 text-amber-600"
          onClick={() => navigate("/collections")}
        />
        <KPICard
          title="متأخر السداد"
          value={`${fmtMoney(collectionsSummary.overdueAmount)} ${cur}`}
          subtitle={collectionsSummary.overdueCount > 0 ? `${collectionsSummary.overdueCount} تحصيلة` : "ممتاز"}
          icon={AlertTriangle}
          color={collectionsSummary.overdueAmount > 0 ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-600"}
        />
        <KPICard
          title="على المؤسسين (غير مدفوع)"
          value={`${fmtMoney(founderAnalysis.totalOwed)} ${cur}`}
          subtitle={founderAnalysis.totalOwed > 0 ? "مطلوب تسديد" : "الكل مدفوع ✓"}
          icon={Users}
          color={founderAnalysis.totalOwed > 0 ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-600"}
          onClick={() => navigate("/founders")}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 2: Revenue & Profit Analysis
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="stat-card">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection("revenue")}>
          <SectionHeader icon={TrendingUp} title="تحليل الإيرادات والأرباح" subtitle={`آخر ${period} أشهر`} />
          {expandedSections.revenue ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
        {expandedSections.revenue && (
          <div className="space-y-6 mt-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold mb-3 text-muted-foreground">الإيرادات مقابل التكلفة والربح</h4>
                {noData ? (
                  <p className="text-center py-16 text-muted-foreground text-sm">{t.noDataPeriod}</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={monthlyPnL} onClick={handleChartClick} className="cursor-pointer">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => `${fmtMoney(v)} ${cur}`} />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" name="الإيرادات" fill="hsl(var(--primary))" fillOpacity={0.1} stroke="hsl(var(--primary))" strokeWidth={2} />
                      <Bar dataKey="cost" name="التكلفة" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} opacity={0.7} />
                      <Line type="monotone" dataKey="profit" name="الربح" stroke="#94a3b8" strokeWidth={2.5} dot={(props: any) => { const c = props.payload.profit >= 0 ? "#22c55e" : "#ef4444"; return <circle key={props.key} cx={props.cx} cy={props.cy} r={4} fill={c} stroke={c} />; }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold mb-3 text-muted-foreground">اتجاه هامش الربح %</h4>
                {noData ? (
                  <p className="text-center py-16 text-muted-foreground text-sm">{t.noDataPeriod}</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={monthlyPnL} onClick={handleChartClick} className="cursor-pointer">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={[0, 'auto']} />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => `${v}%`} />
                      <defs>
                        <linearGradient id="marginGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="margin" name="هامش الربح" fill="url(#marginGrad)" stroke="hsl(var(--chart-2))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--chart-2))" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold mb-3 text-muted-foreground">تقسيم الأرباح (شركة / مؤسسين)</h4>
                {noData ? (
                  <p className="text-center py-16 text-muted-foreground text-sm">{t.noDataPeriod}</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={monthlyPnL} onClick={handleChartClick} className="cursor-pointer">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => `${fmtMoney(v)} ${cur}`} />
                      <Legend />
                      <Bar dataKey="companyShare" name="حصة الشركة" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="founderShare" name="حصة المؤسسين" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold mb-3 text-muted-foreground">متوسط قيمة الأوردر وعدد الأوردرات</h4>
                {noData ? (
                  <p className="text-center py-16 text-muted-foreground text-sm">{t.noDataPeriod}</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={monthlyPnL} onClick={handleChartClick} className="cursor-pointer">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend />
                      <Bar yAxisId="right" dataKey="orderCount" name="عدد الأوردرات" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} opacity={0.5} />
                      <Line yAxisId="left" type="monotone" dataKey="avgOrderValue" name={`متوسط القيمة (${cur})`} stroke="hsl(var(--chart-5))" strokeWidth={2.5} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 3: Cash Flow & Expenses
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="stat-card">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection("cashflow")}>
          <SectionHeader icon={Activity} title="التدفقات النقدية والمصروفات" subtitle="حركة الخزينة" />
          {expandedSections.cashflow ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
        {expandedSections.cashflow && (
          <div className="space-y-6 mt-2">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
                <p className="text-[10px] text-muted-foreground">الواردات</p>
                <p className="text-lg font-bold text-emerald-600">{fmtMoney(totalInflows)}</p>
                <p className="text-[10px] text-muted-foreground">{cur}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
                <p className="text-[10px] text-muted-foreground">المصروفات</p>
                <p className="text-lg font-bold text-red-600">{fmtMoney(totalOutflows)}</p>
                <p className="text-[10px] text-muted-foreground">{cur}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center">
                <p className="text-[10px] text-muted-foreground">صافي التدفق</p>
                <p className={`text-lg font-bold ${totalInflows - totalOutflows >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {fmtMoney(totalInflows - totalOutflows)}
                </p>
                <p className="text-[10px] text-muted-foreground">{cur}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold mb-3 text-muted-foreground">الواردات مقابل المصروفات (شهرياً)</h4>
                {cashFlowData.length === 0 ? (
                  <p className="text-center py-16 text-muted-foreground text-sm">{t.noDataPeriod}</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={cashFlowData} onClick={handleChartClick} className="cursor-pointer">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => `${fmtMoney(v)} ${cur}`} />
                      <Legend />
                      <Bar dataKey="inflows" name="الواردات" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="outflows" name="المصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold mb-3 text-muted-foreground">توزيع المصروفات حسب التصنيف</h4>
                {expenseByCat.length === 0 ? (
                  <p className="text-center py-16 text-muted-foreground text-sm">{t.treasuryNoTx}</p>
                ) : (
                  <div className="flex items-start gap-4">
                    <ResponsiveContainer width="55%" height={240}>
                      <PieChart>
                        <Pie
                          data={expenseByCat}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={80}
                        >
                          {expenseByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => `${fmtMoney(v)} ${cur}`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5 pt-4">
                      {expenseByCat.slice(0, 7).map((e, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="truncate max-w-[100px]">{e.name}</span>
                          </div>
                          <span className="font-medium">{fmtMoney(e.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 4: Orders Analysis
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="stat-card">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection("orders")}>
          <SectionHeader icon={ShoppingBag} title="تحليل الأوردرات" subtitle={`${totals.orders} أوردر في الفترة`} />
          {expandedSections.orders ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
        {expandedSections.orders && (
          <div className="space-y-6 mt-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold mb-3 text-muted-foreground">حالات الأوردرات</h4>
                {orderStatusData.length === 0 ? (
                  <p className="text-center py-16 text-muted-foreground text-sm">لا يوجد أوردرات</p>
                ) : (
                  <div className="flex items-start gap-4">
                    <ResponsiveContainer width="55%" height={220}>
                      <PieChart>
                        <Pie
                          data={orderStatusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={75}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {orderStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={chartTooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2 pt-4">
                      {orderStatusData.map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                            <span>{s.name}</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">{s.value}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold mb-3 text-muted-foreground">أكبر العملاء (إيرادات)</h4>
                {topClients.length === 0 ? (
                  <p className="text-center py-16 text-muted-foreground text-sm">لا يوجد بيانات</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topClients} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => `${fmtMoney(v)} ${cur}`} />
                      <Bar dataKey="revenue" name="الإيرادات" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 5: Collections Dashboard
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="stat-card">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection("collections")}>
          <SectionHeader icon={CheckCircle2} title="تحليل التحصيلات" subtitle={`نسبة التحصيل ${collectionsSummary.rate.toFixed(0)}%`} />
          {expandedSections.collections ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
        {expandedSections.collections && (
          <div className="space-y-6 mt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <p className="text-[10px] text-muted-foreground">إجمالي المفوتر</p>
                <p className="text-lg font-bold">{fmtMoney(collectionsSummary.totalInvoiced)}</p>
                <p className="text-[10px] text-muted-foreground">{cur}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/5 text-center">
                <p className="text-[10px] text-muted-foreground">تم التحصيل</p>
                <p className="text-lg font-bold text-emerald-600">{fmtMoney(collectionsSummary.totalCollected)}</p>
                <p className="text-[10px] text-muted-foreground">{cur}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/5 text-center">
                <p className="text-[10px] text-muted-foreground">متبقي</p>
                <p className="text-lg font-bold text-amber-600">{fmtMoney(collectionsSummary.totalOutstanding)}</p>
                <p className="text-[10px] text-muted-foreground">{cur}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/5 text-center">
                <p className="text-[10px] text-muted-foreground">متأخر</p>
                <p className="text-lg font-bold text-red-600">{fmtMoney(collectionsSummary.overdueAmount)}</p>
                <p className="text-[10px] text-muted-foreground">{collectionsSummary.overdueCount} تحصيلة</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold mb-3 text-muted-foreground">التحصيلات الشهرية</h4>
                {collectionsSummary.monthlyData.length === 0 ? (
                  <p className="text-center py-16 text-muted-foreground text-sm">لا يوجد بيانات</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={collectionsSummary.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => `${fmtMoney(v)} ${cur}`} />
                      <Legend />
                      <Area type="monotone" dataKey="collected" name="محصّل" fill="#10b981" fillOpacity={0.15} stroke="#10b981" strokeWidth={2} />
                      <Area type="monotone" dataKey="outstanding" name="متبقي" fill="#f59e0b" fillOpacity={0.15} stroke="#f59e0b" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold mb-3 text-muted-foreground">نسبة التحصيل</h4>
                <div className="flex flex-col items-center justify-center h-[250px]">
                  <div className="relative h-40 w-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%" startAngle={180} endAngle={0}
                        data={[{ value: collectionsSummary.rate, fill: collectionsSummary.rate >= 80 ? "#10b981" : collectionsSummary.rate >= 50 ? "#f59e0b" : "#ef4444" }]}
                      >
                        <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "hsl(var(--muted))" }} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: "10px" }}>
                      <div className="text-center">
                        <p className="text-3xl font-bold">{collectionsSummary.rate.toFixed(0)}%</p>
                        <p className="text-[10px] text-muted-foreground">نسبة التحصيل</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-6 mt-4 text-xs">
                    <div className="text-center">
                      <p className="font-bold text-emerald-600">{collectionsSummary.onTimeCount}</p>
                      <p className="text-muted-foreground">مكتمل</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-red-600">{collectionsSummary.overdueCount}</p>
                      <p className="text-muted-foreground">متأخر</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 6: Founders & Funding Analysis
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="stat-card">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection("founders")}>
          <SectionHeader icon={Users} title="تحليل تمويل المؤسسين" subtitle={`${founders.length} مؤسس`} />
          {expandedSections.founders ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
        {expandedSections.founders && (
          <div className="space-y-6 mt-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <h4 className="text-xs font-semibold mb-3 text-muted-foreground">حصص المؤسسين</h4>
                {founderShares.length === 0 ? (
                  <p className="text-center py-12 text-muted-foreground text-sm">لا يوجد مؤسسون</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={founderShares}
                          dataKey="share"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                        >
                          {founderShares.map((f, i) => <Cell key={i} fill={f.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => `${v}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 mt-2">
                      {founderShares.map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full" style={{ background: f.color }} />
                            <span>{f.name}</span>
                          </div>
                          <span className="font-medium">{f.share}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="lg:col-span-2">
                <h4 className="text-xs font-semibold mb-3 text-muted-foreground">تمويل كل مؤسس: مدفوع vs عليه فلوس</h4>
                {founderAnalysis.data.length === 0 ? (
                  <p className="text-center py-12 text-muted-foreground text-sm">لا يوجد بيانات</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={founderAnalysis.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => `${fmtMoney(v)} ${cur}`} />
                        <Legend />
                        <Bar dataKey="paid" name="مدفوع (مساهمة)" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                        <Bar dataKey="owed" name="عليه فلوس" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      {founderAnalysis.data.map((f, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-muted/30 text-center">
                          <p className="text-[10px] text-muted-foreground mb-1">{f.name}</p>
                          {f.owed > 0 ? (
                            <p className="text-sm font-bold text-destructive">{fmtMoney(f.owed)} عليه</p>
                          ) : (
                            <p className="text-sm font-bold text-success">✓ مدفوع الكل</p>
                          )}
                          <p className="text-[10px] text-muted-foreground">مجموع: {fmtMoney(f.total)} {cur}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 7: Treasury Accounts
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="stat-card">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection("treasury")}>
          <SectionHeader icon={Building2} title="حسابات الخزينة" subtitle={`${activeAccounts.length} حساب نشط — رصيد ${fmtMoney(treasuryBalance)} ${cur}`} />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate("/treasury"); }} className="print:hidden">
              {t.viewAll}
            </Button>
            {expandedSections.treasury ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
        {expandedSections.treasury && (
          <div className="mt-2">
            {activeAccounts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">{t.treasuryNoAccounts}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeAccounts.map((a, i) => {
                  const pct = treasuryBalance > 0 ? (parseAmount(a.balance) / treasuryBalance * 100) : 0;
                  return (
                    <div
                      key={a.id}
                      className="p-4 rounded-xl bg-muted/20 border border-border/50 hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => navigate("/treasury/accounts")}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold">{a.name}</p>
                          <p className="text-[10px] text-muted-foreground">{a.custodianName || a.accountType}</p>
                        </div>
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${COLORS[i % COLORS.length]}20` }}>
                          <Wallet className="h-4 w-4" style={{ color: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                      <p className="text-lg font-bold">{fmtMoney(parseAmount(a.balance))} <span className="text-xs font-normal text-muted-foreground">{cur}</span></p>
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{pct.toFixed(0)}% من الإجمالي</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="text-center text-[10px] text-muted-foreground py-2 print:py-4 border-t border-border/30">
        تقرير مُولّد تلقائياً من نظام DSB — البيانات مباشرة من قاعدة البيانات
        <span className="mx-2">·</span>
        آخر تحديث: {new Date().toLocaleString("ar-EG")}
      </div>
    </div>
  );
}
