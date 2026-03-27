import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useBusinessRules, getCompanyShareRatio, getFounderShareRatio } from "@/lib/useBusinessRules";
import { StatCard } from "@/components/StatCard";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Download, Wallet,
  Plus, ArrowUpRight, ArrowDownRight, Minus, Receipt, Trash2, Loader2,
  Users, Building2, ChevronDown, ChevronUp, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/exportCsv";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, PieChart, Pie, Cell
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
  client: string;
  date: string;
  totalCollection: number;
  paidAmount: number;
  paidRatio: number;
  grossProfit: number;
  realizedProfit: number;
  companyProfitPct: number;
  companyProfit: number;
  foundersProfit: number;
  founderShares: Array<{ id: string; name: string; amount: number; pct: number }>;
  status: string;
  lastPaymentDate: string;
};

export default function CompanyProfitPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [monthsFilter, setMonthsFilter] = useState("6");
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: "", category: "operations" as typeof EXPENSE_CATEGORIES[number], description: "", accountId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTxTarget, setDeleteTxTarget] = useState<any | null>(null);
  const [deletingTx, setDeletingTx] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [selectedProfitEntry, setSelectedProfitEntry] = useState<ProfitEntry | null>(null);
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
    (rawOrders || []).forEach((o: any) => { map[o.id] = o; });
    return map;
  }, [rawOrders]);

  // Build founder map: founderId → name
  const founderMap = useMemo(() => {
    const map: Record<string, string> = {};
    (founders || []).forEach((f: any) => { map[f.id] = f.name || f.alias || f.id; });
    return map;
  }, [founders]);

  // Build profit ledger from collections × orders (only where order still exists)
  const profitLedger = useMemo((): ProfitEntry[] => {
    if (!collections || !rawOrders) return [];
    const cutoff = subMonths(new Date(), parseInt(monthsFilter));
    const foundersList = founders || [];

    return (collections as any[])
      .filter((col: any) => {
        const orderId = col.order || col.orderId || col.order_id || "";
        return orderId && orderMap[orderId]; // only show if linked order still exists
      })
      .map((col: any): ProfitEntry | null => {
        const orderId = col.order || col.orderId || col.order_id || "";
        const order = orderMap[orderId];
        if (!order) return null;

        // Support both issueDate and invoiceDate field names
        const issueDate = col.invoiceDate || col.invoice_date || col.issueDate || col.issue_date || col.createdAt || col.created_at || "";
        let d: Date;
        try { d = parseISO(issueDate); } catch { return null; }
        if (d < cutoff) return null;

        const totalCollection = parseAmount(col.totalAmount ?? col.total_amount ?? col.total);
        const paidAmount = parseAmount(col.paidAmount ?? col.paid_amount ?? col.paid);
        const paidRatio = totalCollection > 0 ? paidAmount / totalCollection : 0;

        const totalSelling = parseAmount(order.totalSelling ?? order.total_selling);
        const totalCost = parseAmount(order.totalCost ?? order.total_cost);
        const grossProfit = totalSelling - totalCost;
        const realizedProfit = grossProfit * paidRatio;

        // Company profit % — from order snapshot or business rules
        const contribs = parseJsonField(order.founderContributions ?? order.founder_contributions);
        const contribArray = Array.isArray(contribs) ? contribs : [];
        const snappedPct = contribArray[0]?.companyProfitPercentage ?? rules.companyProfitPercentage ?? 40;
        const companyProfit = Math.round(realizedProfit * snappedPct / 100);
        const foundersProfit = Math.round(realizedProfit * (1 - snappedPct / 100));

        // Split mode from order
        const splitMode = order.splitMode || order.split_mode || "equal";

        // Founder shares — use order contributions if available, otherwise equal split
        let founderShares: Array<{ id: string; name: string; amount: number; pct: number }>;

        if (contribArray.length > 0 && splitMode !== "equal") {
          // Contribution-based split from order snapshot
          founderShares = contribArray.map((fc: any) => {
            const founderName = fc.founder || founderMap[fc.founderId] || fc.founderId || "مؤسس";
            const founderPct = fc.percentage || 0;
            const founderAmount = Math.round(realizedProfit * founderPct / 100);
            return { id: fc.founderId || founderName, name: founderName, amount: founderAmount, pct: founderPct };
          });
        } else {
          // Equal split among all founders
          const numFounders = foundersList.length || 1;
          const equalPct = Math.round(((100 - snappedPct) / numFounders) * 10) / 10;
          const equalAmount = Math.round(foundersProfit / numFounders);
          founderShares = foundersList.map((f: any) => ({
            id: f.id,
            name: f.name || f.alias || f.id,
            amount: equalAmount,
            pct: equalPct,
          }));
        }

        // Last payment date from history
        const paymentHistory = parsePaymentsHistory(col.payments);
        const sortedPayments = [...paymentHistory].sort((a, b) => a.date > b.date ? -1 : 1);
        const lastPaymentDate = sortedPayments[0]?.date || issueDate;

        return {
          collectionId: col.id,
          orderId,
          client: col.client || col.clientName || col.client_name || order.client || "",
          date: issueDate.split("T")[0],
          totalCollection,
          paidAmount,
          paidRatio,
          grossProfit,
          realizedProfit,
          companyProfitPct: snappedPct,
          companyProfit,
          foundersProfit,
          founderShares,
          status: col.status || "Pending",
          lastPaymentDate: lastPaymentDate.split("T")[0],
        };
      })
      .filter(Boolean) as ProfitEntry[];
  }, [collections, rawOrders, orderMap, founderMap, founders, monthsFilter, rules.companyProfitPercentage]);

  // Monthly chart data from profit ledger
  const { monthlyPnL, totals, expenseBreakdown, comparison } = useMemo(() => {
    const cutoff = subMonths(new Date(), parseInt(monthsFilter));
    const monthlyData: Record<string, { revenue: number; cost: number; companyProfit: number; foundersProfit: number }> = {};

    const ensureMonth = (key: string) => {
      if (!monthlyData[key]) monthlyData[key] = { revenue: 0, cost: 0, companyProfit: 0, foundersProfit: 0 };
    };

    // Revenue from collections
    profitLedger.forEach((entry) => {
      const key = entry.date.substring(0, 7); // yyyy-MM
      ensureMonth(key);
      monthlyData[key].revenue += entry.paidAmount;
      monthlyData[key].companyProfit += entry.companyProfit;
      monthlyData[key].foundersProfit += entry.foundersProfit;
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
      profit: d.companyProfit + d.foundersProfit,
      companyShare: d.companyProfit,
      founderShare: d.foundersProfit,
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

    return {
      monthlyPnL: pnl,
      totals: { revenue: tRev, cost: tCost, profit: tProfit, companyShare: tCompany, margin: tRev > 0 ? ((tProfit / tRev) * 100).toFixed(1) : "0" },
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

  const fmtNum = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");

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
    if (!expenseForm.amount || !expenseForm.accountId) {
      toast({ title: t.error, description: t.fillRequiredFields, variant: "destructive" });
      return;
    }
    const amount = parseFloat(expenseForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: t.error, description: t.invalidAmount, variant: "destructive" });
      return;
    }
    const account = accounts?.find(a => a.id === expenseForm.accountId);
    if (!account) return;
    setSubmitting(true);
    try {
      const newBalance = account.balance - amount;
      await api.post("/treasury/transactions", {
        id: `TX-${Date.now()}`, accountId: expenseForm.accountId, amount: -amount,
        txType: "expense", category: expenseForm.category, description: expenseForm.description || null,
        balanceAfter: newBalance, performedBy: user?.id || null, date: new Date().toISOString().split("T")[0], newBalance,
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
        action: "delete", snapshot: deleteTxTarget, endpoint: "/treasury/transactions",
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
                  <Label>{t.treasurySelectAccount} *</Label>
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
        <StatCard title="إجمالي الأرباح المحققة" value={`${fmtNum(totals.profit)} ${t.currency}`} change={`هامش ${totals.margin}%`} changeType="positive" icon={TrendingUp} />
        <StatCard title={t.companyShare} value={`${fmtNum(totals.companyShare)} ${t.currency}`} change={`${profitLedger.length} تحصيل`} changeType="positive" icon={Percent} />
        <StatCard title={t.totalCostCompany} value={`${fmtNum(totals.cost)} ${t.currency}`} change={`${totals.revenue > 0 ? ((totals.cost / totals.revenue) * 100).toFixed(0) : 0}% من المُحصَّل`} changeType="negative" icon={TrendingDown} />
      </div>

      {/* ===== PROFIT LEDGER ===== */}
      <div className="stat-card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            سجل الأرباح من التحصيلات
          </h3>
          <span className="text-xs text-muted-foreground">{profitLedger.length} سجل · انقر لعرض التوزيع</span>
        </div>
        {profitLedger.length === 0 ? (
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
              {profitLedger.map((entry) => (
                <>
                  <tr
                    key={entry.collectionId}
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
                    <td className="py-2.5 px-3 font-medium text-sm">{entry.client}</td>
                    <td className="py-2.5 px-3 text-end">
                      <span className="font-medium">{fmtNum(entry.paidAmount)}</span>
                      <span className="text-muted-foreground text-xs"> / {fmtNum(entry.totalCollection)}</span>
                    </td>
                    <td className="py-2.5 px-3 text-end font-semibold text-success">{fmtNum(entry.realizedProfit)} {t.currency}</td>
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
                          <div className="sm:col-span-2 flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
                            <span>رقم التحصيل: <span className="font-mono text-foreground">{entry.collectionId}</span></span>
                            <span>تاريخ آخر دفعة: <span className="text-foreground">{entry.lastPaymentDate}</span></span>
                            <span>نسبة التحصيل: <span className="text-foreground">{(entry.paidRatio * 100).toFixed(0)}%</span></span>
                            <span>الربح الإجمالي للطلب: <span className="text-foreground">{fmtNum(entry.grossProfit)} {t.currency}</span></span>
                            <button
                              className="text-primary hover:underline flex items-center gap-1"
                              onClick={() => navigate(`/collections?orderId=${entry.orderId}`)}
                            >
                              <ExternalLink className="h-3 w-3" /> فتح التحصيل
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
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
                  <td className="py-2.5 px-3 text-end font-medium text-success">{fmtNum(m.profit)} {t.currency}</td>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">اتجاه التحصيل والأرباح</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyPnL}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <ReTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name="المُحصَّل" dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="profit" stroke="hsl(var(--chart-2))" strokeWidth={2} name="الربح" dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="cost" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="5 5" name={t.cost} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">{t.expenseBreakdown}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                {expenseBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <ReTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {expenseBreakdown.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">{categoryLabel(item.name)} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Profit Distribution Bar */}
      <div className="stat-card">
        <h3 className="font-semibold text-sm mb-4">{t.profitDistribution}</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyPnL}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <ReTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            <Bar dataKey="companyShare" stackId="a" fill="hsl(var(--primary))" name="الشركة" />
            <Bar dataKey="founderShare" stackId="a" fill="hsl(var(--chart-2))" name="المؤسسون" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

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
