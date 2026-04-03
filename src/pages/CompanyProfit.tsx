import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useBusinessRules, getCompanyShareRatio, getFounderShareRatio } from "@/lib/useBusinessRules";
import { quickProfit, founderSplit } from "@/lib/orderProfit";
import { StatCard } from "@/components/StatCard";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Download, Wallet,
  Plus, ArrowUpRight, ArrowDownRight, Minus, Receipt, Trash2, Loader2,
  Users, Building2, ChevronDown, ChevronUp, ExternalLink, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/exportCsv";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, PieChart, Pie, Cell,
  Legend, ReferenceLine
} from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMemo, useState } from "react";
import { subMonths, format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { logAudit } from "@/lib/auditLog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

const EXPENSE_CATEGORIES = ["marketing", "operations", "salaries", "supplies", "rent", "utilities", "logistics", "maintenance", "other"] as const;

type ProfitEntry = {
  collectionId: string;
  orderId: string;
  clientId: string;
  client: string;
  date: string;
  totalCollection: number;  // قيمة الفاتورة / ما تم استهلاكه
  orderTotal: number;       // إجمالي الأوردر الكامل
  paidAmount: number;
  paidRatio: number;        // paidAmount / orderTotal
  grossProfit: number;
  realizedProfit: number;
  companyProfitPct: number;
  companyProfit: number;
  foundersProfit: number;
  deliveryFeeDeficit: number;
  founderShares: Array<{ id: string; name: string; amount: number; pct: number }>;
  status: string;
  lastPaymentDate: string;
};

export default function CompanyProfitPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const _userName = profile?.full_name || "مستخدم";
  const queryClient = useQueryClient();
  const [monthsFilter, setMonthsFilter] = useState("6");
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: "", category: "operations" as typeof EXPENSE_CATEGORIES[number], description: "", accountId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTxTarget, setDeleteTxTarget] = useState<any | null>(null);
  const [deletingTx, setDeletingTx] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [selectedProfitEntry, setSelectedProfitEntry] = useState<ProfitEntry | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const { rules } = useBusinessRules();

  const parseAmount = (val: unknown): number => {
    if (!val) return 0;
    if (typeof val === "number") return val;
    const cleaned = String(val).replace(/[^\d.-]/g, "");
    return parseFloat(cleaned) || 0;
  };

  const parseJsonField = (v: unknown) => {
    if (!v) return [];
    if (typeof v === "object") return v as any;
    try { return JSON.parse(v as string); } catch { return []; }
  };

  const parsePaymentsHistory = (raw: any): { date: string; amount: number; method: string }[] => {
    if (!raw) return [];
    let parsed = raw;
    if (typeof raw === "string") { try { parsed = JSON.parse(raw); } catch { return []; } }
    if (Array.isArray(parsed)) return parsed;
    if (parsed?.history && Array.isArray(parsed.history)) return parsed.history;
    return [];
  };

  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ["treasury_accounts"],
    queryFn: () => api.get<any[]>("/treasury/accounts").then(d => d.filter((a: any) => a.isActive)),
  });

  const { data: transactions, isLoading: loadingTx } = useQuery({
    queryKey: ["treasury_transactions"],
    queryFn: () => api.get<any[]>("/treasury/transactions"),
  });

  const { data: rawOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ["orders_full"],
    queryFn: () => api.get<any[]>("/orders"),
  });

  const { data: collections, isLoading: loadingCollections } = useQuery({
    queryKey: ["collections"],
    queryFn: () => api.get<any[]>("/collections"),
  });

  const { data: founders, isLoading: loadingFounders } = useQuery({
    queryKey: ["founders"],
    queryFn: () => api.get<any[]>("/founders"),
  });

  const totalBalance = useMemo(() => {
    if (!accounts) return 0;
    return accounts.reduce((sum, a) => sum + parseAmount(a.balance), 0);
  }, [accounts]);

  // Build order map: orderId → full order data
  const orderMap = useMemo(() => {
    const map: Record<string, any> = {};
    (rawOrders || []).forEach((o: any) => {
      const cid = o.clientId || o.client_id || "";
      if (cid === "company-inventory") return;
      map[o.id] = o;
    });
    return map;
  }, [rawOrders]);

  // Build founder map: founderId → name
  const founderMap = useMemo(() => {
    const map: Record<string, string> = {};
    (founders || []).forEach((f: any) => { map[f.id] = f.name || f.alias || f.id; });
    return map;
  }, [founders]);

  // Build profit ledger from collections × orders (only where order still exists)
  // Multi-order collections are split proportionally per order with each order's own companyProfitPercentage
  const profitLedger = useMemo((): ProfitEntry[] => {
    if (!collections || !rawOrders) return [];
    const cutoff = subMonths(new Date(), parseInt(monthsFilter));
    const foundersList = founders || [];

    const entries: ProfitEntry[] = [];

    const getOrderPct = (oid: string): number => {
      const order = orderMap[oid];
      if (!order) return rules.companyProfitPercentage;
      const contribs = parseJsonField(order.founderContributions ?? order.founder_contributions);
      const contribArray = Array.isArray(contribs) ? contribs : [];
      return contribArray[0]?.companyProfitPercentage ?? rules.companyProfitPercentage;
    };

    const getOrderContribs = (oid: string) => {
      const order = orderMap[oid];
      if (!order) return [];
      const contribs = parseJsonField(order.founderContributions ?? order.founder_contributions);
      return Array.isArray(contribs) ? contribs : [];
    };

    const globalOrderDeliveryApplied: Record<string, boolean> = {};
    (collections as any[]).forEach((col: any) => {
      const issueDate = col.invoiceDate || col.invoice_date || col.issueDate || col.issue_date || col.createdAt || col.created_at || "";
      let d: Date;
      try { d = parseISO(issueDate); } catch { return; }
      if (d < cutoff) return;

      const totalCollection = parseAmount(col.totalAmount ?? col.total_amount ?? col.total);
      const totalPaid = parseAmount(col.paidAmount ?? col.paid_amount ?? col.paid);
      const paymentHistory = parsePaymentsHistory(col.payments);
      const sortedPayments = [...paymentHistory].sort((a, b) => a.date > b.date ? -1 : 1);
      const lastPaymentDate = sortedPayments[0]?.date || issueDate;

      const notesMeta = (() => {
        const raw = col.notes || col._notesObj;
        if (!raw) return {} as any;
        if (typeof raw === "object") return raw;
        try { return JSON.parse(raw); } catch { return {}; }
      })();

      const lineItems: any[] = notesMeta.lineItems || [];
      const primaryOrderId = col.order || col.orderId || col.order_id || "";

      let totalGrossProfit = 0;
      let totalCompanyProfit = 0;
      let totalFoundersProfit = 0;
      let totalRealizedProfit = 0;
      let totalDeliveryDeficit = 0;
      let totalItemsSelling = 0;
      let weightedPctSum = 0;
      const founderAmounts: Record<string, { name: string; amount: number; pct: number }> = {};

      if (lineItems.length > 0 && lineItems.some((li: any) => li.sourceOrderId)) {
        lineItems.forEach((li: any) => {
          const oid = li.sourceOrderId || primaryOrderId;
          if (!orderMap[oid]) return;
          const itemSelling = parseAmount(li.sellingPrice ?? li.selling_price ?? 0);
          const itemCost = parseAmount(li.costPrice ?? li.cost_price ?? li.cost ?? 0);
          const qty = parseAmount(li.quantity ?? 1);
          const lineSelling = itemSelling * qty;
          const lineCost = itemCost * qty;
          totalItemsSelling += lineSelling;
        });

        const payRatio = totalItemsSelling > 0 ? Math.min(totalPaid / totalItemsSelling, 1) : 0;

        lineItems.forEach((li: any) => {
          const oid = li.sourceOrderId || primaryOrderId;
          const order = orderMap[oid];
          if (!order) return;
          const itemSelling = parseAmount(li.sellingPrice ?? li.selling_price ?? 0);
          const itemCost = parseAmount(li.costPrice ?? li.cost_price ?? li.cost ?? 0);
          const qty = parseAmount(li.quantity ?? 1);
          const lineSelling = itemSelling * qty;
          const lineCost = itemCost * qty;
          const pct = getOrderPct(oid);
          const normPct = pct >= 2 ? pct / 100 : pct;

          let lineDeliveryDeduction = 0;
          if (!globalOrderDeliveryApplied[oid] && (order.deliveryFeeBearer || (order as any).delivery_fee_bearer) === "company") {
            const delFee = parseAmount(order.deliveryFee ?? (order as any).delivery_fee);
            lineDeliveryDeduction = delFee * payRatio;
            globalOrderDeliveryApplied[oid] = true;
          }

          const lineGross = lineSelling - lineCost;
          const grossRealized = lineGross * payRatio;
          const reimbursable = Math.max(grossRealized, 0);
          const reimbursement = Math.min(lineDeliveryDeduction, reimbursable);
          const lineDeficit = Math.max(lineDeliveryDeduction - reimbursement, 0);
          const lineRealized = Math.max(grossRealized - reimbursement, 0);
          const lineCompany = lineRealized * normPct;
          const lineFounders = lineRealized - lineCompany;

          totalGrossProfit += lineGross;
          totalRealizedProfit += lineRealized;
          totalCompanyProfit += lineCompany;
          totalFoundersProfit += lineFounders;
          totalDeliveryDeficit += lineDeficit;
          weightedPctSum += normPct * lineSelling;

          const contribArray = getOrderContribs(oid);
          if (contribArray.length > 0) {
            const totalFPct = contribArray.reduce((s: number, fc: any) => s + (fc.percentage || 0), 0) || 100;
            contribArray.forEach((fc: any) => {
              const fid = fc.founderId || fc.founder || "unknown";
              const fName = fc.founder || founderMap[fc.founderId] || fc.founderId || "مؤسس";
              const fPct = fc.percentage || 0;
              const fAmount = lineFounders * fPct / totalFPct;
              if (!founderAmounts[fid]) founderAmounts[fid] = { name: fName, amount: 0, pct: fPct };
              founderAmounts[fid].amount += fAmount;
            });
          } else {
            const numFounders = foundersList.length || 1;
            foundersList.forEach((f: any) => {
              const fid = f.id;
              if (!founderAmounts[fid]) founderAmounts[fid] = { name: f.name || f.alias || f.id, amount: 0, pct: 100 / numFounders };
              founderAmounts[fid].amount += lineFounders / numFounders;
            });
          }
        });
      } else {
        const srcOrders = notesMeta.sourceOrders?.length > 0
          ? notesMeta.sourceOrders.filter((oid: string) => orderMap[oid])
          : (primaryOrderId && orderMap[primaryOrderId] ? [primaryOrderId] : []);
        if (srcOrders.length === 0) return;

        let allSelling = 0;
        const orderSelling: Record<string, number> = {};
        srcOrders.forEach((oid: string) => {
          const ts = parseAmount(orderMap[oid].totalSelling ?? orderMap[oid].total_selling);
          orderSelling[oid] = ts;
          allSelling += ts;
        });

        srcOrders.forEach((oid: string) => {
          const order = orderMap[oid];
          const oSelling = parseAmount(order.totalSelling ?? order.total_selling);
          const oCost = parseAmount(order.totalCost ?? order.total_cost);
          const share = allSelling > 0 ? oSelling / allSelling : 1 / srcOrders.length;
          const oPaid = totalPaid * share;
          const pct = getOrderPct(oid);
          const normPct = pct >= 2 ? pct / 100 : pct;

          let delFeeDeduction = 0;
          if (!globalOrderDeliveryApplied[oid] && (order.deliveryFeeBearer || (order as any).delivery_fee_bearer) === "company") {
            delFeeDeduction = parseAmount(order.deliveryFee ?? (order as any).delivery_fee);
            globalOrderDeliveryApplied[oid] = true;
          }
          const qp = quickProfit({ orderTotal: oSelling, totalCost: oCost, paidValue: oPaid, companyProfitPct: pct, deliveryFeeDeduction: delFeeDeduction });
          totalGrossProfit += qp.expectedProfit;
          totalRealizedProfit += qp.realizedProfit;
          totalCompanyProfit += qp.companyProfit;
          totalFoundersProfit += qp.foundersProfit;
          totalDeliveryDeficit += qp.deliveryFeeDeficit;
          totalItemsSelling += oSelling;
          weightedPctSum += normPct * oSelling;

          const contribArray = getOrderContribs(oid);
          if (contribArray.length > 0) {
            const totalFPct = contribArray.reduce((s: number, fc: any) => s + (fc.percentage || 0), 0) || 100;
            contribArray.forEach((fc: any) => {
              const fid = fc.founderId || fc.founder || "unknown";
              const fName = fc.founder || founderMap[fc.founderId] || fc.founderId || "مؤسس";
              const fAmount = qp.foundersProfit * (fc.percentage || 0) / totalFPct;
              if (!founderAmounts[fid]) founderAmounts[fid] = { name: fName, amount: 0, pct: 0 };
              founderAmounts[fid].amount += fAmount;
            });
          } else {
            const numFounders = foundersList.length || 1;
            foundersList.forEach((f: any) => {
              const fid = f.id;
              if (!founderAmounts[fid]) founderAmounts[fid] = { name: f.name || f.alias || f.id, amount: 0, pct: 0 };
              founderAmounts[fid].amount += qp.foundersProfit / numFounders;
            });
          }
        });
      }

      const blendedPct = totalItemsSelling > 0 ? Math.round(weightedPctSum / totalItemsSelling * 100 * 10) / 10 : rules.companyProfitPercentage;
      const paidRatio = totalItemsSelling > 0 ? Math.min(totalPaid / totalItemsSelling, 1) : 0;

      const totalFounderAmount = Object.values(founderAmounts).reduce((s, v) => s + v.amount, 0) || 1;
      const founderShares = Object.entries(founderAmounts).map(([fid, v]) => ({
        id: fid,
        name: v.name,
        amount: Math.round(v.amount),
        pct: Math.round(v.amount / totalFounderAmount * 100 * 10) / 10,
      }));

      const order0 = orderMap[primaryOrderId];

      entries.push({
        collectionId: col.id,
        orderId: primaryOrderId,
        clientId: order0?.clientId || order0?.client_id || col.clientId || col.client_id || "",
        client: col.client || col.clientName || col.client_name || order0?.client || "",
        date: issueDate.split("T")[0],
        totalCollection,
        orderTotal: totalItemsSelling,
        paidAmount: totalPaid,
        paidRatio,
        grossProfit: totalGrossProfit,
        realizedProfit: totalRealizedProfit,
        companyProfitPct: blendedPct,
        companyProfit: Math.round(totalCompanyProfit),
        foundersProfit: Math.round(totalFoundersProfit),
        deliveryFeeDeficit: Math.round(totalDeliveryDeficit),
        founderShares,
        status: col.status || "Pending",
        lastPaymentDate: lastPaymentDate.split("T")[0],
      });
    });

    return entries;
  }, [collections, rawOrders, orderMap, founderMap, founders, monthsFilter, rules.companyProfitPercentage]);

  // Filtered ledger — respects selectedMonth click from bar chart
  const filteredLedger = useMemo(() => {
    if (!selectedMonth) return profitLedger;
    return profitLedger.filter(e => e.date.startsWith(selectedMonth));
  }, [profitLedger, selectedMonth]);

  // Monthly chart data from profit ledger
  const { monthlyPnL, totals, expenseBreakdown, comparison } = useMemo(() => {
    const cutoff = subMonths(new Date(), parseInt(monthsFilter));
    const monthlyData: Record<string, { revenue: number; cost: number; companyProfit: number; foundersProfit: number; deliveryDeficit: number }> = {};

    const ensureMonth = (key: string) => {
      if (!monthlyData[key]) monthlyData[key] = { revenue: 0, cost: 0, companyProfit: 0, foundersProfit: 0, deliveryDeficit: 0 };
    };

    // Revenue from collections
    profitLedger.forEach((entry) => {
      const key = entry.date.substring(0, 7); // yyyy-MM
      ensureMonth(key);
      monthlyData[key].revenue += entry.paidAmount;
      monthlyData[key].companyProfit += entry.companyProfit;
      monthlyData[key].foundersProfit += entry.foundersProfit;
      monthlyData[key].deliveryDeficit += entry.deliveryFeeDeficit;
    });

    // Expenses from treasury transactions
    (transactions || []).forEach((tx: any) => {
      const d = parseISO(tx.createdAt || tx.created_at);
      if (d < cutoff) return;
      const key = format(d, "yyyy-MM");
      ensureMonth(key);
      const txType = tx.txType || tx.tx_type;
      if (txType === "expense" || txType === "withdrawal") {
        monthlyData[key].cost += Math.abs(parseAmount(tx.amount));
      }
    });

    const sorted = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b));
    const pnl = sorted.map(([key, d]) => ({
      month: format(parseISO(key + "-01"), "MMM yyyy"),
      monthKey: key,
      revenue: d.revenue,
      cost: d.cost,
      profit: d.companyProfit + d.foundersProfit - d.deliveryDeficit,
      companyShare: d.companyProfit - d.deliveryDeficit,
      founderShare: d.foundersProfit,
      deliveryDeficit: d.deliveryDeficit,
    }));

    const comparisonData = pnl.map((m, i) => {
      const prev = i > 0 ? pnl[i - 1] : null;
      return {
        ...m,
        revenueChange: prev ? m.revenue - prev.revenue : 0,
        revenueChangePercent: prev && prev.revenue > 0 ? ((m.revenue - prev.revenue) / prev.revenue) * 100 : 0,
        costChange: prev ? m.cost - prev.cost : 0,
        costChangePercent: prev && prev.cost > 0 ? ((m.cost - prev.cost) / prev.cost) * 100 : 0,
        profitChange: prev ? m.profit - prev.profit : 0,
        profitChangePercent: prev && prev.profit !== 0 ? ((m.profit - prev.profit) / Math.abs(prev.profit)) * 100 : 0,
      };
    });

    // Expense breakdown by category
    const expAgg: Record<string, number> = {};
    (transactions || []).forEach((tx: any) => {
      const d = parseISO(tx.createdAt || tx.created_at);
      if (d < cutoff) return;
      const txType = tx.txType || tx.tx_type;
      if (txType === "expense" || txType === "withdrawal") {
        const cat = tx.category || "other";
        expAgg[cat] = (expAgg[cat] || 0) + Math.abs(parseAmount(tx.amount));
      }
    });
    const totalExp = Object.values(expAgg).reduce((s, v) => s + v, 0) || 1;
    const colors = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
    const breakdown = Object.entries(expAgg).map(([name, value], i) => ({
      name, value: Math.round((value / totalExp) * 100), color: colors[i % colors.length],
    }));

    const tRev = pnl.reduce((s, m) => s + m.revenue, 0);
    const tCost = pnl.reduce((s, m) => s + m.cost, 0);
    const tProfit = pnl.reduce((s, m) => s + m.profit, 0);
    const tCompany = pnl.reduce((s, m) => s + m.companyShare, 0);
    const tFounders = pnl.reduce((s, m) => s + m.founderShare, 0);
    const tDeficit = pnl.reduce((s, m) => s + m.deliveryDeficit, 0);

    // Weighted-average company profit percentage across all entries in period
    const avgCompanyPct = profitLedger.length > 0
      ? Math.round(profitLedger.reduce((s, e) => s + e.companyProfitPct, 0) / profitLedger.length * 10) / 10
      : rules.companyProfitPercentage;
    const companyMargin = tRev > 0 ? ((tCompany / tRev) * 100).toFixed(1) : "0";

    return {
      monthlyPnL: pnl,
      totals: { revenue: tRev, cost: tCost, profit: tProfit, companyShare: tCompany, foundersShare: tFounders, deliveryDeficit: tDeficit, avgCompanyPct, companyMargin, margin: tRev > 0 ? ((tProfit / tRev) * 100).toFixed(1) : "0" },
      expenseBreakdown: breakdown.length > 0 ? breakdown : [{ name: "other", value: 100, color: colors[0] }],
      comparison: comparisonData,
    };
  }, [profitLedger, transactions, monthsFilter]);

  const isLoading = loadingAccounts || loadingTx || loadingOrders || loadingCollections || loadingFounders;

  const categoryLabel = (key: string | null) => {
    if (!key) return t.other;
    const map: Record<string, string> = {
      marketing: t.treasury_cat_marketing, operations: t.operations, salaries: t.treasury_cat_salaries,
      supplies: t.treasury_cat_supplies, rent: t.treasury_cat_rent, utilities: t.treasury_cat_utilities,
      logistics: t.deliveryCost, maintenance: t.treasury_cat_maintenance, other: t.other,
    };
    return map[key] || key;
  };

  const fmtNum = (n: number) => n.toLocaleString("en-US");

  const statusColor = (s: string) => {
    if (s === "Paid") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (s === "Partial") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-muted text-muted-foreground";
  };
  const statusLabel = (s: string) => {
    if (s === "Paid") return "مكتمل";
    if (s === "Partial") return "جزئي";
    return "معلّق";
  };

  const handleAddExpense = async () => {
    if (!expenseForm.amount) {
      toast({ title: t.error, description: t.fillRequiredFields, variant: "destructive" });
      return;
    }
    const amount = parseFloat(expenseForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: t.error, description: t.invalidAmount, variant: "destructive" });
      return;
    }
    const account = expenseForm.accountId ? accounts?.find(a => a.id === expenseForm.accountId) : null;
    setSubmitting(true);
    try {
      const newBalance = account ? account.balance - amount : 0;
      await api.post("/treasury/transactions", {
        id: `TX-${Date.now()}`, accountId: expenseForm.accountId || null, amount: -amount,
        txType: "expense", category: expenseForm.category, description: expenseForm.description || null,
        balanceAfter: newBalance, performedBy: user?.id || null, date: new Date().toISOString().split("T")[0],
        ...(account ? { newBalance } : {}),
      });
      toast({ title: t.success, description: t.expenseAdded });
      setExpenseDialogOpen(false);
      setExpenseForm({ amount: "", category: "operations", description: "", accountId: "" });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_accounts"] });
    } catch (err) {
      toast({ title: t.error, description: String(err), variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const handleDeleteExpense = async () => {
    if (!deleteTxTarget) return;
    setDeletingTx(true);
    try {
      await api.delete(`/treasury/transactions/${deleteTxTarget.id}`);
      await logAudit({
        entity: "treasury_transaction", entityId: deleteTxTarget.id,
        entityName: `${categoryLabel(deleteTxTarget.category)} — ${Math.abs(deleteTxTarget.amount).toLocaleString()} ${t.currency}`,
        action: "delete", snapshot: deleteTxTarget, endpoint: "/treasury/transactions", performedBy: _userName,
      });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_accounts"] });
      toast({ title: t.success, description: "تم حذف العملية بنجاح" });
      setDeleteTxTarget(null);
    } catch (err) {
      toast({ title: t.error, description: String(err), variant: "destructive" });
    } finally { setDeletingTx(false); }
  };

  const ChangeIndicator = ({ value, percent }: { value: number; percent: number }) => {
    if (value === 0) return <span className="text-muted-foreground"><Minus className="h-3 w-3 inline" /></span>;
    const isPositive = value > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
        {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {Math.abs(percent).toFixed(1)}%
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">{t.companyProfitTitle}</h1>
          <p className="page-description">{t.companyProfitDesc}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={monthsFilter} onValueChange={setMonthsFilter}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 {t.monthsLabel}</SelectItem>
              <SelectItem value="6">6 {t.monthsLabel}</SelectItem>
              <SelectItem value="12">12 {t.monthsLabel}</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9"><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.addExpense}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t.addExpense}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>{t.treasurySelectAccount} {(accounts?.length ?? 0) > 0 ? "" : "(اختياري)"}</Label>
                  <Select value={expenseForm.accountId} onValueChange={(v) => setExpenseForm(f => ({ ...f, accountId: v }))}>
                    <SelectTrigger><SelectValue placeholder={t.selectAccount} /></SelectTrigger>
                    <SelectContent>
                      {accounts?.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name} ({fmtNum(a.balance)} {t.currency})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.amount} *</Label>
                  <Input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>{t.category}</Label>
                  <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm(f => ({ ...f, category: v as typeof EXPENSE_CATEGORIES[number] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.description}</Label>
                  <Textarea value={expenseForm.description} onChange={(e) => setExpenseForm(f => ({ ...f, description: e.target.value }))} placeholder={t.optionalDesc} />
                </div>
                <Button onClick={handleAddExpense} disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t.addExpense}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" className="h-9"
            onClick={() => exportToCsv("company_profit", ["التاريخ", "رقم التحصيل", "الطلب", "العميل", "المُحصَّل", "الربح الإجمالي", "ربح الشركة", "ربح المؤسسين", "الحالة"],
              profitLedger.map(e => [e.date, e.collectionId, e.orderId, e.client, e.paidAmount, e.realizedProfit, e.companyProfit, e.foundersProfit, statusLabel(e.status)]))}>
            <Download className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.export}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title={t.totalBalance} value={`${fmtNum(totalBalance)} ${t.currency}`} change={`${accounts?.length || 0} ${t.accountsCount}`} changeType="neutral" icon={Wallet} />
        <StatCard title="إجمالي المُحصَّل" value={`${fmtNum(totals.revenue)} ${t.currency}`} change={`${monthsFilter} ${t.monthsLabel}`} changeType="neutral" icon={DollarSign} />
        <StatCard title="أرباح الشركة المحققة" value={`${fmtNum(totals.companyShare)} ${t.currency}`} change={totals.deliveryDeficit > 0 ? `بعد خصم عجز ${fmtNum(totals.deliveryDeficit)}` : `هامش ${totals.companyMargin}%`} changeType={totals.companyShare < 0 ? "negative" : "positive"} icon={TrendingUp} />
        <StatCard title="حصة الشركة من الأرباح" value={`${totals.avgCompanyPct}%`} change={`متوسط · ${profitLedger.length} تحصيل`} changeType="positive" icon={Percent} />
        <StatCard title={t.totalCostCompany} value={`${fmtNum(totals.cost)} ${t.currency}`} change={`${totals.revenue > 0 ? ((totals.cost / totals.revenue) * 100).toFixed(0) : 0}% من المُحصَّل`} changeType="negative" icon={TrendingDown} />
      </div>
      {totals.deliveryDeficit > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>عجز توصيل غير مغطى: <strong>{fmtNum(totals.deliveryDeficit)} {t.currency}</strong> — رسوم التوصيل أعلى من الربح المحقق في بعض الأوردرات</span>
        </div>
      )}

      {/* ===== PROFIT LEDGER ===== */}
      <div className="stat-card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            سجل الأرباح من التحصيلات
            {selectedMonth && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {selectedMonth}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {selectedMonth && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => setSelectedMonth(null)}
              >
                عرض الكل
              </button>
            )}
            <span className="text-xs text-muted-foreground">{filteredLedger.length} سجل · انقر لعرض التوزيع</span>
          </div>
        </div>
        {filteredLedger.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>لا توجد أرباح مسجّلة من التحصيلات في هذه الفترة</p>
            <p className="text-xs mt-1">تظهر الأرباح تلقائياً عند تسجيل مدفوعات في صفحة التحصيلات</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">التاريخ</th>
                <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">الطلب</th>
                <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">العميل</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">المُحصَّل</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">الربح المحقق</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">حصة الشركة</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">حصة المؤسسين</th>
                <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">الحالة</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.map((entry) => (
                <React.Fragment key={entry.collectionId}>
                  <tr
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedEntry(expandedEntry === entry.collectionId ? null : entry.collectionId)}
                  >
                    <td className="py-2.5 px-3 text-muted-foreground text-xs">{entry.lastPaymentDate}</td>
                    <td className="py-2.5 px-3">
                      <button
                        className="font-mono text-xs text-primary hover:underline"
                        onClick={(e) => { e.stopPropagation(); navigate(`/orders/${entry.orderId}`); }}
                        data-testid={`link-profit-order-${entry.orderId}`}
                      >
                        {entry.orderId}
                      </button>
                    </td>
                    <td className="py-2.5 px-3">
                      {entry.clientId ? (
                        <button
                          className="font-medium text-sm hover:text-primary hover:underline transition-colors text-start"
                          onClick={(e) => { e.stopPropagation(); navigate(`/clients/${entry.clientId}`); }}
                        >
                          {entry.client}
                        </button>
                      ) : (
                        <span className="font-medium text-sm">{entry.client}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-end">
                      <span className="font-medium">{fmtNum(entry.paidAmount)}</span>
                      <span className="text-muted-foreground text-xs"> / {fmtNum(entry.totalCollection)}</span>
                    </td>
                    <td className={`py-2.5 px-3 text-end font-semibold ${entry.realizedProfit >= 0 ? "text-success" : "text-destructive"}`}>{fmtNum(entry.realizedProfit)} {t.currency}</td>
                    <td className="py-2.5 px-3 text-end">
                      <span className="text-primary font-medium">{fmtNum(entry.companyProfit)}</span>
                      <span className="text-muted-foreground text-xs"> ({entry.companyProfitPct}%)</span>
                    </td>
                    <td className="py-2.5 px-3 text-end">{fmtNum(entry.foundersProfit)} {t.currency}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(entry.status)}`}>
                        {statusLabel(entry.status)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {expandedEntry === entry.collectionId
                        ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground inline" />
                        : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground inline" />}
                    </td>
                  </tr>
                  {expandedEntry === entry.collectionId && (
                    <tr key={`${entry.collectionId}-expanded`} className="bg-muted/20 border-b border-border/50">
                      <td colSpan={9} className="px-4 py-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Company share box */}
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Building2 className="h-4 w-4 text-primary" />
                              <span className="text-xs font-semibold text-primary">حصة الشركة</span>
                            </div>
                            <p className="text-lg font-bold text-primary">{fmtNum(entry.companyProfit)} {t.currency}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {entry.companyProfitPct}% من الربح المحقق · محفوظة في <span className="font-medium">حسابات الشركة</span>
                            </p>
                          </div>
                          {/* Founders shares */}
                          <div className="rounded-lg border border-border bg-muted/30 p-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-semibold">توزيع المؤسسين</span>
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                {(() => {
                                  const order = orderMap[entry.orderId];
                                  const sm = order?.splitMode || order?.split_mode || "equal";
                                  return sm === "equal" ? "تقسيم متساوي" : "حسب المساهمة";
                                })()}
                              </span>
                            </div>
                            <div className="mb-2 text-xs text-muted-foreground">
                              إجمالي حصة المؤسسين: <span className="font-semibold text-foreground">{fmtNum(entry.foundersProfit)} {t.currency}</span>
                              <span className="mr-1">({(100 - entry.companyProfitPct)}%)</span>
                            </div>
                            {entry.founderShares.length === 0 ? (
                              <p className="text-xs text-muted-foreground">لا يوجد مؤسسون مسجّلون</p>
                            ) : (
                              <div className="space-y-2">
                                {entry.founderShares.map((fs) => (
                                  <div key={fs.id} className="flex items-center justify-between text-xs">
                                    <span className="font-medium">{fs.name}</span>
                                    <div className="flex items-center gap-2">
                                      <div className="h-1.5 rounded-full bg-muted overflow-hidden w-16">
                                        <div className="h-full bg-primary rounded-full" style={{ width: `${fs.pct}%` }} />
                                      </div>
                                      <span className="text-muted-foreground">{fs.pct}%</span>
                                      <span className="font-semibold text-foreground w-20 text-end">{fmtNum(fs.amount)} {t.currency}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Meta info */}
                          <div className="sm:col-span-2 rounded-lg border border-border/50 bg-muted/10 p-3">
                            <p className="text-xs font-semibold mb-2 text-muted-foreground">تفاصيل الحساب</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-xs">
                              <div><span className="text-muted-foreground">إجمالي الأوردر (O)</span><br/><span className="font-semibold text-foreground">{fmtNum(entry.orderTotal)} {t.currency}</span></div>
                              <div><span className="text-muted-foreground">قيمة الاستهلاك (C)</span><br/><span className="font-semibold text-foreground">{fmtNum(entry.totalCollection)} {t.currency}</span></div>
                              <div><span className="text-muted-foreground">المدفوع فعلياً (D)</span><br/><span className="font-semibold text-success">{fmtNum(entry.paidAmount)} {t.currency}</span></div>
                              <div>
                                <span className="text-muted-foreground">نسبة ربح الأوردر (r = P÷O)</span><br/>
                                <span className="font-semibold text-foreground">
                                  {entry.orderTotal > 0 ? ((entry.grossProfit / entry.orderTotal) * 100).toFixed(1) : "0"}%
                                  <span className="font-normal text-muted-foreground"> ({fmtNum(entry.grossProfit)} ÷ {fmtNum(entry.orderTotal)})</span>
                                </span>
                              </div>
                              <div><span className="text-muted-foreground">الربح الكلي للأوردر (P)</span><br/><span className="font-semibold text-foreground">{fmtNum(entry.grossProfit)} {t.currency}</span></div>
                              <div>
                                <span className="text-muted-foreground">الربح المحقق = D × r</span><br/>
                                <span className={`font-semibold ${entry.realizedProfit >= 0 ? "text-success" : "text-destructive"}`}>{fmtNum(entry.realizedProfit)} {t.currency}
                                  <span className="font-normal text-muted-foreground"> ({fmtNum(entry.paidAmount)} × {entry.orderTotal > 0 ? ((entry.grossProfit / entry.orderTotal) * 100).toFixed(1) : "0"}%)</span>
                                </span>
                              </div>
                              <div><span className="text-muted-foreground">رقم التحصيل</span><br/><span className="font-mono text-foreground">{entry.collectionId}</span></div>
                              <div><span className="text-muted-foreground">آخر دفعة</span><br/><span className="text-foreground">{entry.lastPaymentDate}</span></div>
                              {entry.deliveryFeeDeficit > 0 && (
                                <div className="sm:col-span-2"><span className="text-amber-600">عجز توصيل (رسوم التوصيل أعلى من الربح)</span><br/><span className="font-semibold text-amber-700">-{fmtNum(entry.deliveryFeeDeficit)} {t.currency}</span></div>
                              )}
                            </div>
                            <div className="mt-2 pt-2 border-t border-border/30">
                              <button
                                className="text-primary hover:underline flex items-center gap-1 text-xs"
                                onClick={() => navigate(`/collections?orderId=${entry.orderId}`)}
                              >
                                <ExternalLink className="h-3 w-3" /> فتح التحصيل
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Monthly Comparison */}
      <div className="stat-card overflow-x-auto">
        <h3 className="font-semibold text-sm mb-4">{t.monthlyComparison}</h3>
        {comparison.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">{t.noDataPeriod}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.month}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">المُحصَّل</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.change}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.cost}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.change}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">الربح</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.change}</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">الشركة</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">المؤسسون</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((m, i) => (
                <tr key={m.month} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2.5 px-3 font-medium">{m.month}</td>
                  <td className="py-2.5 px-3 text-end">{fmtNum(m.revenue)} {t.currency}</td>
                  <td className="py-2.5 px-3 text-end">{i > 0 ? <ChangeIndicator value={m.revenueChange} percent={m.revenueChangePercent} /> : "-"}</td>
                  <td className="py-2.5 px-3 text-end text-muted-foreground">{fmtNum(m.cost)} {t.currency}</td>
                  <td className="py-2.5 px-3 text-end">{i > 0 ? <ChangeIndicator value={-m.costChange} percent={-m.costChangePercent} /> : "-"}</td>
                  <td className={`py-2.5 px-3 text-end font-medium ${m.profit >= 0 ? "text-success" : "text-destructive"}`}>{fmtNum(m.profit)} {t.currency}</td>
                  <td className="py-2.5 px-3 text-end">{i > 0 ? <ChangeIndicator value={m.profitChange} percent={m.profitChangePercent} /> : "-"}</td>
                  <td className="py-2.5 px-3 text-end text-primary font-medium">{fmtNum(m.companyShare)} {t.currency}</td>
                  <td className="py-2.5 px-3 text-end">{fmtNum(m.founderShare)} {t.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Charts */}
      {(() => {
        const tooltipStyle = {
          backgroundColor: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "8px",
          fontSize: "12px",
          direction: "rtl" as const,
        };
        const yAxisFmt = (v: number) =>
          v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
          : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K`
          : String(v);
        const amountFmt = (v: number, name: string) => [`${fmtNum(v)} ${t.currency}`, name];
        const avgProfit = monthlyPnL.length > 0
          ? monthlyPnL.reduce((s, m) => s + m.profit, 0) / monthlyPnL.length
          : 0;

        return (
          <>
            {/* Line chart: collection & profit trend */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="stat-card lg:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-sm">اتجاه التحصيل والأرباح</h3>
                  <span className="text-xs text-muted-foreground">اضغط على شهر في الرسم لفلترة الجدول</span>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={monthlyPnL} onClick={(e) => {
                    if (e?.activePayload?.[0]?.payload?.monthKey) {
                      const mk = e.activePayload[0].payload.monthKey;
                      setSelectedMonth(prev => prev === mk ? null : mk);
                    }
                  }} style={{ cursor: "pointer" }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={yAxisFmt} width={52} />
                    <ReTooltip contentStyle={tooltipStyle} formatter={amountFmt} />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <ReferenceLine y={avgProfit} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4"
                      label={{ value: `متوسط الربح`, position: "insideTopRight", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name="المُحصَّل" dot={{ r: 4 }} activeDot={{ r: 7, strokeWidth: 2 }} />
                    <Line type="monotone" dataKey="profit" stroke="#94a3b8" strokeWidth={2} name="الربح الإجمالي" dot={(props: any) => { const c = props.payload.profit >= 0 ? "#22c55e" : "#ef4444"; return <circle key={props.key} cx={props.cx} cy={props.cy} r={4} fill={c} stroke={c} />; }} activeDot={{ r: 7, strokeWidth: 2 }} />
                    <Line type="monotone" dataKey="companyShare" stroke="hsl(var(--chart-2))" strokeWidth={2} name="حصة الشركة" dot={{ r: 3 }} activeDot={{ r: 6 }} strokeDasharray="6 2" />
                    <Line type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 5" name={t.cost} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Pie chart: expense breakdown */}
              <div className="stat-card">
                <h3 className="font-semibold text-sm mb-3">{t.expenseBreakdown}</h3>
                {expenseBreakdown.length === 1 && expenseBreakdown[0].name === "other" && expenseBreakdown[0].value === 100 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-xs gap-2">
                    <TrendingDown className="h-8 w-8 opacity-30" />
                    <p>لا توجد مصروفات مسجّلة</p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={expenseBreakdown}
                          cx="50%" cy="50%"
                          innerRadius={45} outerRadius={72}
                          paddingAngle={3} dataKey="value"
                          label={({ name, value }: any) => `${value}%`}
                          labelLine={false}
                        >
                          {expenseBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <ReTooltip
                          contentStyle={tooltipStyle}
                          formatter={(v: any, name: any) => [`${v}%`, categoryLabel(name)]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-2 mt-1">
                      {expenseBreakdown.map((item) => (
                        <div key={item.name} className="flex items-center gap-1.5 text-xs">
                          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{categoryLabel(item.name)}</span>
                          <span className="font-medium">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Stacked bar: profit distribution per month — clickable to filter ledger */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm">{t.profitDistribution}</h3>
                {selectedMonth
                  ? <button className="text-xs text-primary hover:underline" onClick={() => setSelectedMonth(null)}>← إلغاء الفلتر ({selectedMonth})</button>
                  : <span className="text-xs text-muted-foreground">انقر على شهر لفلترة سجل الأرباح</span>}
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={monthlyPnL}
                  onClick={(e) => {
                    if (e?.activePayload?.[0]?.payload?.monthKey) {
                      const mk = e.activePayload[0].payload.monthKey;
                      setSelectedMonth(prev => prev === mk ? null : mk);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={yAxisFmt} width={52} />
                  <ReTooltip contentStyle={tooltipStyle} formatter={amountFmt} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Bar
                    dataKey="companyShare" stackId="profit" fill="hsl(var(--primary))" name="حصة الشركة"
                    radius={[0, 0, 0, 0]}
                  >
                    {monthlyPnL.map((m) => (
                      <Cell
                        key={m.monthKey}
                        fill={selectedMonth === m.monthKey ? "hsl(var(--primary))" : selectedMonth ? "hsl(var(--primary) / 0.4)" : "hsl(var(--primary))"}
                      />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="founderShare" stackId="profit" fill="#22c55e" name="حصة المؤسسين"
                    radius={[4, 4, 0, 0]}
                  >
                    {monthlyPnL.map((m) => (
                      <Cell
                        key={m.monthKey}
                        fill={selectedMonth === m.monthKey ? "#22c55e" : selectedMonth ? "#22c55e66" : "#22c55e"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        );
      })()}

      {/* Expenses from Treasury */}
      <div className="stat-card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4 text-destructive" />
            سجل المصروفات
          </h3>
        </div>
        {(transactions || []).filter((tx: any) => ["expense", "withdrawal"].includes(tx.txType || tx.tx_type)).length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">لا توجد مصروفات مسجّلة</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">التاريخ</th>
                <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">الفئة</th>
                <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">الوصف</th>
                <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">المبلغ</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {(transactions || [])
                .filter((tx: any) => ["expense", "withdrawal"].includes(tx.txType || tx.tx_type))
                .sort((a: any, b: any) => (b.createdAt || b.created_at || "").localeCompare(a.createdAt || a.created_at || ""))
                .map((tx: any) => (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30 group">
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">{(tx.date || tx.createdAt || tx.created_at || "").split("T")[0]}</td>
                    <td className="py-2.5 px-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{categoryLabel(tx.category)}</span></td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs">{tx.description || "—"}</td>
                    <td className="py-2.5 px-3 text-end font-medium text-destructive">{fmtNum(Math.abs(parseAmount(tx.amount)))} {t.currency}</td>
                    <td className="py-2.5 px-3 text-end">
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                        onClick={() => setDeleteTxTarget(tx)}
                        data-testid={`button-delete-expense-${tx.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDeleteDialog
        open={!!deleteTxTarget}
        onOpenChange={(o) => !o && setDeleteTxTarget(null)}
        title="حذف المصروف"
        description={`هل تريد حذف هذا المصروف؟ سيتم إعادة المبلغ إلى رصيد الحساب.`}
        onConfirm={handleDeleteExpense}
        loading={deletingTx}
      />
    </div>
  );
}
