import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, TrendingUp, Wallet, Pencil, Loader2, Trash2,
  ExternalLink, ShoppingBag, Clock, AlertTriangle, RotateCcw,
  ArrowDownLeft, ArrowUpRight, Coins, Receipt, CheckCircle2, XCircle, Truck,
  PieChart as PieChartIcon, BarChart3,
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area,
} from "recharts";

type Founder = {
  id: string; name: string; alias: string; email: string; phone: string;
  active: boolean; totalContributed: number; totalWithdrawn: number;
};
type FounderTx = {
  id: string; founderId: string; founderName: string;
  type: "contribution" | "withdrawal" | "funding" | "capital_return" | "capital_withdrawal";
  amount: number; method: string; orderId: string; collectionId: string; clientName: string;
  notes: string; date: string; createdAt: string;
};
type OrderFundingEntry = {
  orderId: string; clientName: string; amount: number; originalAmount: number;
  percentage: number; totalCost: number; totalSelling: number;
  status: string; date: string; paid: boolean; autoFunded: boolean;
  paidAmount?: number; paidAt?: string; founderName: string; founderId: string;
};
type ProfitEntry = {
  collectionId: string; orderIds: string[]; clientName: string; date: string;
  paidAmount: number; founderShare: number; paidRatio: number; alreadyRegistered: boolean;
};
type CapitalEntry = {
  collectionId: string; orderIds: string[]; clientName: string; date: string;
  paidAmount: number; capitalShare: number;
};
type DeliveryPayment = { orderId: string; clientName: string; date: string; amount: number };
type DeliveryReimbursement = {
  collectionId: string; orderId: string; clientName: string; date: string;
  amount: number; deliveryFee: number; paidRatio: number;
};
type DeliverySubsidy = {
  collectionId: string; orderId: string; clientName: string; date: string;
  amount: number; deliveryFee: number; orderProfit: number;
  source: "company_balance" | "company_debt";
};
type CostPayment = { orderId: string; clientName: string; date: string; paidAmount: number; share: number; diff: number };
type Settlement = {
  orderId: string; clientName: string; date: string; paidAt: string;
  from: string; fromId: string; to: string; toId: string;
  amount: number; toPaidTotal: number; toShare: number; settled: boolean;
};

function typeLabel(type: string) {
  if (type === "funding") return "تمويل طلب";
  if (type === "contribution") return "مساهمة رأس مال";
  if (type === "withdrawal") return "سحب";
  if (type === "capital_return") return "استرداد رأس مال";
  if (type === "capital_withdrawal") return "سحب رأس مال";
  return type;
}

interface FounderProfileProps {
  founder: Founder;
  founderTxs: FounderTx[];
  orderFunding: OrderFundingEntry[];
  profits: ProfitEntry[];
  capital: CapitalEntry[];
  deliveryPayments: DeliveryPayment[];
  deliveryReimbursements: DeliveryReimbursement[];
  deliverySubsidies: DeliverySubsidy[];
  costPayments: CostPayment[];
  settlementsOwed: Settlement[];
  settlementsOwing: Settlement[];
  capitalBalance: number;
  autoCapitalTotal: number;
  autoProfitTotal: number;
  autoDeliveryReimbursement: number;
  onBack: () => void;
  onEdit: () => void;
  onWithdraw: () => void;
  onPayFunding: (entry: OrderFundingEntry) => void;
  onDeleteTx: (tx: FounderTx) => void;
  payingEntry: string | null;
}

type TabKey = "overview" | "orders" | "profits" | "capital" | "returns" | "delivery" | "ledger";

export default function FounderProfile({
  founder: f, founderTxs: allTxs, orderFunding, profits, capital,
  deliveryPayments, deliveryReimbursements, deliverySubsidies,
  costPayments, settlementsOwed, settlementsOwing,
  capitalBalance, autoCapitalTotal, autoProfitTotal, autoDeliveryReimbursement,
  onBack, onEdit, onWithdraw, onPayFunding, onDeleteTx, payingEntry,
}: FounderProfileProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const myTxs = allTxs.filter(tx => tx.founderId === f.id || tx.founderName === f.name)
    .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  const contributions = myTxs.filter(tx => tx.type === "contribution");
  const fundings = myTxs.filter(tx => tx.type === "funding");
  const capitalReturns = myTxs.filter(tx => tx.type === "capital_return");
  const returnRefunds = capitalReturns.filter(tx => tx.method === "return_refund");
  const capitalWithdrawals = myTxs.filter(tx => tx.type === "capital_withdrawal");
  const withdrawals = myTxs.filter(tx => tx.type === "withdrawal");

  const unpaidFunding = orderFunding.filter(e => !e.paid);
  const paidFunding = orderFunding.filter(e => e.paid);
  const totalOwed = unpaidFunding.reduce((s, e) => s + e.amount, 0);
  const totalPaidFunding = paidFunding.reduce((s, e) => s + e.amount, 0);
  const totalOrderFunding = orderFunding.reduce((s, e) => s + e.amount, 0);
  const txContribTotal = [...contributions, ...fundings].reduce((s, tx) => s + tx.amount, 0);
  const displayTotal = txContribTotal > 0 ? txContribTotal : f.totalContributed;
  const manualCapitalTotal = capitalReturns.reduce((s, tx) => s + tx.amount, 0);
  const returnRefundsTotal = returnRefunds.reduce((s, tx) => s + tx.amount, 0);
  const capitalWithdrawnTotal = capitalWithdrawals.reduce((s, tx) => s + tx.amount, 0);

  const delPaidTotal = deliveryPayments.reduce((s, e) => s + e.amount, 0);
  const delReimbTotal = deliveryReimbursements.reduce((s, e) => s + e.amount, 0);
  const delSubPaid = deliverySubsidies.filter(e => e.source === "company_balance").reduce((s, e) => s + e.amount, 0);
  const delPendingDebt = deliverySubsidies.filter(e => e.source === "company_debt").reduce((s, e) => s + e.amount, 0);
  const delNet = delPaidTotal - delReimbTotal - delSubPaid;

  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const profitChartData = useMemo(() => {
    const byMonth: Record<string, number> = {};
    profits.forEach(p => {
      const m = (p.date || "").substring(0, 7);
      if (m) byMonth[m] = (byMonth[m] || 0) + p.founderShare;
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount: Math.round(amount) }));
  }, [profits]);

  const capitalFlowData = useMemo(() => {
    const byMonth: Record<string, { in: number; out: number }> = {};
    capital.forEach(c => {
      const m = (c.date || "").substring(0, 7);
      if (m) {
        if (!byMonth[m]) byMonth[m] = { in: 0, out: 0 };
        byMonth[m].in += c.capitalShare;
      }
    });
    profits.forEach(p => {
      const m = (p.date || "").substring(0, 7);
      if (m) {
        if (!byMonth[m]) byMonth[m] = { in: 0, out: 0 };
        byMonth[m].in += p.founderShare;
      }
    });
    capitalWithdrawals.forEach(tx => {
      const m = (tx.date || "").substring(0, 7);
      if (m) {
        if (!byMonth[m]) byMonth[m] = { in: 0, out: 0 };
        byMonth[m].out += tx.amount;
      }
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, in: Math.round(v.in), out: Math.round(v.out) }));
  }, [capital, profits, capitalWithdrawals]);

  const fundingPieData = useMemo(() => {
    const paid = paidFunding.reduce((s, e) => s + e.originalAmount, 0);
    const unpaid = unpaidFunding.reduce((s, e) => s + e.amount, 0);
    if (paid === 0 && unpaid === 0) return [];
    const result = [];
    if (paid > 0) result.push({ name: "ممول", value: Math.round(paid) });
    if (unpaid > 0) result.push({ name: "متبقي", value: Math.round(unpaid) });
    return result;
  }, [paidFunding, unpaidFunding]);

  const capitalBreakdownData = useMemo(() => {
    const items = [];
    if (autoCapitalTotal > 0) items.push({ name: "رأس مال عائد", value: Math.round(autoCapitalTotal), color: "#3b82f6" });
    if (autoProfitTotal > 0) items.push({ name: "أرباح", value: Math.round(autoProfitTotal), color: "#10b981" });
    if (autoDeliveryReimbursement > 0) items.push({ name: "استرداد توصيل", value: Math.round(autoDeliveryReimbursement), color: "#f59e0b" });
    if (manualCapitalTotal > 0) items.push({ name: "يدوي", value: Math.round(manualCapitalTotal), color: "#8b5cf6" });
    return items;
  }, [autoCapitalTotal, autoProfitTotal, autoDeliveryReimbursement, manualCapitalTotal]);

  const tabs: { key: TabKey; label: string; icon: typeof ShoppingBag; count?: number; alert?: boolean }[] = [
    { key: "overview", label: "نظرة عامة", icon: BarChart3 },
    { key: "orders", label: "الأوردرات", icon: ShoppingBag, count: orderFunding.length, alert: unpaidFunding.length > 0 },
    { key: "profits", label: "الأرباح", icon: TrendingUp, count: profits.length },
    { key: "capital", label: "رأس المال", icon: Coins },
    { key: "returns", label: "المرتجعات", icon: RotateCcw, count: returnRefunds.length },
    { key: "delivery", label: "التوصيل", icon: Truck, count: deliveryPayments.length + deliveryReimbursements.length },
    { key: "ledger", label: "السجل", icon: Receipt },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground" onClick={onBack}>
          <ArrowRight className="h-4 w-4" />
          المؤسسون
        </Button>
      </div>

      <div className="stat-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-white">{f.name.charAt(0)}</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold">{f.name}</h1>
                <Badge variant="secondary" className={`text-xs ${f.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                  {f.active ? t.active : t.inactive}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                {f.alias && <span>{f.alias}</span>}
                {f.email && <span>{f.email}</span>}
                {f.phone && <span>{f.phone}</span>}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> تعديل
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          <StatMini label="إجمالي المساهمات" value={displayTotal} color="blue" currency={t.currency} />
          <StatMini label="عليه فلوس" value={totalOwed} color={totalOwed > 0 ? "red" : "green"} currency={t.currency} suffix={totalOwed <= 0 ? "✓" : undefined} />
          <StatMini label="مساهمات مدفوعة" value={totalPaidFunding} color="green" currency={t.currency} />
          <StatMini label="أرباح محصّلة" value={autoProfitTotal} color="blue" currency={t.currency} />
          <StatMini label="رأس مال متاح" value={capitalBalance} color={capitalBalance > 0 ? "indigo" : "gray"} currency={t.currency} />
          <StatMini label="مصاريف توصيل" value={delPaidTotal} color={delPaidTotal > 0 ? "orange" : "gray"} currency={t.currency} />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="stat-card p-0 overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors relative ${
                  activeTab === tab.key
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="text-[10px] bg-muted rounded-full px-1.5">{tab.count}</span>
                )}
                {tab.alert && <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {/* ──── OVERVIEW ──── */}
          {activeTab === "overview" && (
            <div className="p-5 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Profit Chart */}
                {profitChartData.length > 0 && (
                  <div className="rounded-xl border border-border p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      الأرباح الشهرية
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={profitChartData}>
                        <defs>
                          <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, direction: "rtl" }}
                          formatter={(v: number) => [`${v.toLocaleString()} ${t.currency}`, "الربح"]}
                        />
                        <Area type="monotone" dataKey="amount" stroke="#10b981" fill="url(#profitGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Funding Pie */}
                {fundingPieData.length > 0 && (
                  <div className="rounded-xl border border-border p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <PieChartIcon className="h-4 w-4 text-blue-500" />
                      حالة تمويل الأوردرات
                    </h3>
                    <div className="flex items-center justify-center gap-6">
                      <ResponsiveContainer width={180} height={180}>
                        <PieChart>
                          <Pie data={fundingPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                            <Cell fill="#10b981" />
                            {fundingPieData.length > 1 && <Cell fill="#ef4444" />}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, direction: "rtl" }}
                            formatter={(v: number) => [`${v.toLocaleString()} ${t.currency}`]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {fundingPieData.map((d, i) => (
                          <div key={d.name} className="flex items-center gap-2 text-sm">
                            <div className="h-3 w-3 rounded-sm" style={{ background: i === 0 ? "#10b981" : "#ef4444" }} />
                            <span className="text-muted-foreground">{d.name}:</span>
                            <span className="font-bold">{d.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Capital Flow */}
                {capitalFlowData.length > 0 && (
                  <div className="rounded-xl border border-border p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Coins className="h-4 w-4 text-indigo-500" />
                      تدفق رأس المال
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={capitalFlowData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, direction: "rtl" }}
                          formatter={(v: number, name: string) => [`${v.toLocaleString()} ${t.currency}`, name === "in" ? "وارد" : "صادر"]}
                        />
                        <Bar dataKey="in" fill="#3b82f6" radius={[4, 4, 0, 0]} name="وارد" />
                        <Bar dataKey="out" fill="#ef4444" radius={[4, 4, 0, 0]} name="صادر" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Capital Breakdown Pie */}
                {capitalBreakdownData.length > 0 && (
                  <div className="rounded-xl border border-border p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-indigo-500" />
                      تركيبة رأس المال المتاح
                    </h3>
                    <div className="flex items-center justify-center gap-6">
                      <ResponsiveContainer width={180} height={180}>
                        <PieChart>
                          <Pie data={capitalBreakdownData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                            {capitalBreakdownData.map((d, i) => (
                              <Cell key={i} fill={d.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, direction: "rtl" }}
                            formatter={(v: number) => [`${v.toLocaleString()} ${t.currency}`]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {capitalBreakdownData.map(d => (
                          <div key={d.name} className="flex items-center gap-2 text-sm">
                            <div className="h-3 w-3 rounded-sm" style={{ background: d.color }} />
                            <span className="text-muted-foreground">{d.name}:</span>
                            <span className="font-bold">{d.value.toLocaleString()}</span>
                          </div>
                        ))}
                        {capitalWithdrawnTotal > 0 && (
                          <div className="flex items-center gap-2 text-sm pt-1 border-t border-border/50">
                            <div className="h-3 w-3 rounded-sm bg-red-500" />
                            <span className="text-muted-foreground">مسحوب:</span>
                            <span className="font-bold text-red-500">-{capitalWithdrawnTotal.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {profitChartData.length === 0 && fundingPieData.length === 0 && capitalFlowData.length === 0 && (
                <div className="py-16 text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-muted-foreground text-sm">لا توجد بيانات كافية لعرض الرسوم البيانية</p>
                  <p className="text-xs text-muted-foreground mt-1">ستظهر الرسوم البيانية تلقائياً عند تسجيل تحصيلات وأوردرات</p>
                </div>
              )}

              {(settlementsOwed.length > 0 || settlementsOwing.length > 0) && (() => {
                const unsettledOwed = settlementsOwed.filter(s => !s.settled);
                const unsettledOwing = settlementsOwing.filter(s => !s.settled);
                const totalOwedToOthers = unsettledOwed.reduce((s, e) => s + e.amount, 0);
                const totalOwedFromOthers = unsettledOwing.reduce((s, e) => s + e.amount, 0);
                const netSettlement = totalOwedFromOthers - totalOwedToOthers;

                const owedByPerson: Record<string, { name: string; total: number; entries: typeof settlementsOwed }> = {};
                unsettledOwed.forEach(s => {
                  if (!owedByPerson[s.toId]) owedByPerson[s.toId] = { name: s.to, total: 0, entries: [] };
                  owedByPerson[s.toId].total += s.amount;
                  owedByPerson[s.toId].entries.push(s);
                });

                const owingByPerson: Record<string, { name: string; total: number; entries: typeof settlementsOwing }> = {};
                unsettledOwing.forEach(s => {
                  if (!owingByPerson[s.fromId]) owingByPerson[s.fromId] = { name: s.from, total: 0, entries: [] };
                  owingByPerson[s.fromId].total += s.amount;
                  owingByPerson[s.fromId].entries.push(s);
                });

                const allPersonIds = [...new Set([...Object.keys(owedByPerson), ...Object.keys(owingByPerson)])];
                const netByPerson = allPersonIds.map(pid => {
                  const owingTotal = owingByPerson[pid]?.total || 0;
                  const owedTotal = owedByPerson[pid]?.total || 0;
                  const net = owingTotal - owedTotal;
                  const name = owingByPerson[pid]?.name || owedByPerson[pid]?.name || pid;
                  const owingEntries = owingByPerson[pid]?.entries || [];
                  const owedEntries = owedByPerson[pid]?.entries || [];
                  return { id: pid, name, owingTotal, owedTotal, net, owingEntries, owedEntries };
                });

                return (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-amber-500" />
                      التسويات بين المؤسسين
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      <div className={`rounded-xl border p-4 ${totalOwedFromOthers > 0 ? "border-emerald-200/50 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-950/10" : "border-border bg-muted/30"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                          <span className="text-xs font-semibold text-muted-foreground">ليه عند غيره</span>
                        </div>
                        <p className={`text-lg font-bold ${totalOwedFromOthers > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                          {totalOwedFromOthers > 0 ? `${totalOwedFromOthers.toLocaleString()} ${t.currency}` : "—"}
                        </p>
                        {Object.entries(owingByPerson).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {Object.entries(owingByPerson).map(([pid, p]) => (
                              <div key={pid} className="flex justify-between text-xs items-center">
                                <span className="text-muted-foreground">عليه ليه: <bdi className="font-semibold text-foreground">{p.name}</bdi></span>
                                <span className="font-semibold text-emerald-600">{p.total.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className={`rounded-xl border p-4 ${totalOwedToOthers > 0 ? "border-red-200/50 dark:border-red-800/30 bg-red-50/50 dark:bg-red-950/10" : "border-border bg-muted/30"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowUpRight className="h-4 w-4 text-red-600" />
                          <span className="text-xs font-semibold text-muted-foreground">عليه لغيره</span>
                        </div>
                        <p className={`text-lg font-bold ${totalOwedToOthers > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                          {totalOwedToOthers > 0 ? `${totalOwedToOthers.toLocaleString()} ${t.currency}` : "—"}
                        </p>
                        {Object.entries(owedByPerson).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {Object.entries(owedByPerson).map(([pid, p]) => (
                              <div key={pid} className="flex justify-between text-xs items-center">
                                <span className="text-muted-foreground">عليه لـ: <bdi className="font-semibold text-foreground">{p.name}</bdi></span>
                                <span className="font-semibold text-red-600">{p.total.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className={`rounded-xl border p-4 ${netSettlement !== 0 ? (netSettlement > 0 ? "border-emerald-200/50 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-950/10" : "border-red-200/50 dark:border-red-800/30 bg-red-50/50 dark:bg-red-950/10") : "border-border bg-muted/30"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Coins className="h-4 w-4 text-amber-600" />
                          <span className="text-xs font-semibold text-muted-foreground">المقاصة النهائية</span>
                        </div>
                        <p className={`text-lg font-bold ${netSettlement > 0 ? "text-emerald-600 dark:text-emerald-400" : netSettlement < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                          {netSettlement !== 0 ? (
                            <>
                              {Math.abs(netSettlement).toLocaleString()} {t.currency}
                              <span className="text-xs font-normal text-muted-foreground mr-1">
                                {netSettlement > 0 ? "(ليه)" : "(عليه)"}
                              </span>
                            </>
                          ) : "متساوي ✓"}
                        </p>
                        {netByPerson.filter(p => p.net !== 0).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {netByPerson.filter(p => p.net !== 0).map(p => (
                              <div key={p.id} className="flex justify-between text-xs items-center">
                                <span className="text-muted-foreground">
                                  {p.net > 0 ? <>يحول ليه من: <bdi className="font-semibold text-foreground">{p.name}</bdi></> : <>يحول لـ: <bdi className="font-semibold text-foreground">{p.name}</bdi></>}
                                </span>
                                <span className={`font-semibold ${p.net > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                  {Math.abs(p.net).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {netByPerson.filter(p => p.net !== 0).length > 0 && (
                      <div className="rounded-xl border border-amber-200/50 dark:border-amber-800/30 overflow-hidden">
                        <div className="px-4 py-2.5 bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-200/30 dark:border-amber-800/20">
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                            <Coins className="h-3.5 w-3.5" />
                            تفاصيل المقاصة
                          </span>
                        </div>
                        {netByPerson.filter(p => p.net !== 0).map(person => {
                          const isPositive = person.net > 0;
                          return (
                            <div key={person.id} className="border-b border-border/30 last:border-b-0">
                              <div dir="rtl" className={`px-4 py-2.5 flex items-center justify-between ${isPositive ? "bg-emerald-50/30 dark:bg-emerald-950/10" : "bg-red-50/30 dark:bg-red-950/10"}`}>
                                <span className={`text-xs font-bold ${isPositive ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                                  {isPositive
                                    ? <><bdi>{person.name}</bdi>{" ← يحول لـ ← "}<bdi>{f.name}</bdi></>
                                    : <><bdi>{f.name}</bdi>{" ← يحول لـ ← "}<bdi>{person.name}</bdi></>
                                  }
                                </span>
                                <span className={`text-sm font-bold ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
                                  {Math.abs(person.net).toLocaleString()} {t.currency}
                                </span>
                              </div>

                              <div dir="rtl" className="px-4 py-2 bg-muted/10">
                                <p className="text-[10px] text-muted-foreground font-semibold mb-1 tracking-wide">
                                  {isPositive
                                    ? <>أوردرات <bdi>{person.name}</bdi> عليه فيها لـ <bdi>{f.name}</bdi></>
                                    : <>أوردرات <bdi>{f.name}</bdi> عليه فيها لـ <bdi>{person.name}</bdi></>
                                  }
                                </p>
                                {(isPositive ? person.owingEntries : person.owedEntries).length > 0 ? (
                                  <div className="divide-y divide-border/20">
                                    {(isPositive ? person.owingEntries : person.owedEntries)
                                      .sort((a, b) => (b.paidAt || b.date).localeCompare(a.paidAt || a.date))
                                      .map((entry, i) => (
                                        <div key={`net-a-${entry.orderId}-${i}`} className="flex items-center justify-between py-1.5 text-xs">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <button className="font-mono text-primary hover:underline flex-shrink-0" onClick={() => navigate(`/orders/${entry.orderId}`)}>
                                              {entry.orderId}
                                            </button>
                                            <span className="text-muted-foreground truncate">{entry.clientName}</span>
                                            <span className="text-muted-foreground flex-shrink-0">{entry.paidAt || entry.date}</span>
                                            {entry.settled && <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />}
                                          </div>
                                          <span className={`font-semibold flex-shrink-0 ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
                                            {entry.amount.toLocaleString()}
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-muted-foreground">لا توجد تفاصيل</p>
                                )}
                              </div>

                              {(isPositive ? person.owedEntries : person.owingEntries).length > 0 && (
                                <div dir="rtl" className="px-4 py-2 bg-muted/10 border-t border-border/20">
                                  <p className="text-[10px] text-muted-foreground font-semibold mb-1 tracking-wide">
                                    {isPositive
                                      ? <>يُخصم منها — أوردرات <bdi>{f.name}</bdi> عليه فيها لـ <bdi>{person.name}</bdi></>
                                      : <>يُخصم منها — أوردرات <bdi>{person.name}</bdi> عليه فيها لـ <bdi>{f.name}</bdi></>
                                    }
                                  </p>
                                  <div className="divide-y divide-border/20">
                                    {(isPositive ? person.owedEntries : person.owingEntries)
                                      .sort((a, b) => (b.paidAt || b.date).localeCompare(a.paidAt || a.date))
                                      .map((entry, i) => (
                                        <div key={`net-b-${entry.orderId}-${i}`} className="flex items-center justify-between py-1.5 text-xs">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <button className="font-mono text-primary hover:underline flex-shrink-0" onClick={() => navigate(`/orders/${entry.orderId}`)}>
                                              {entry.orderId}
                                            </button>
                                            <span className="text-muted-foreground truncate">{entry.clientName}</span>
                                            <span className="text-muted-foreground flex-shrink-0">{entry.paidAt || entry.date}</span>
                                            {entry.settled && <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />}
                                          </div>
                                          <span className="font-semibold text-muted-foreground flex-shrink-0">
                                            -{entry.amount.toLocaleString()}
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}

                              <div dir="rtl" className={`px-4 py-2 border-t border-border/30 flex items-center justify-between ${isPositive ? "bg-emerald-50/20 dark:bg-emerald-950/5" : "bg-red-50/20 dark:bg-red-950/5"}`}>
                                <span className="text-xs font-semibold text-muted-foreground">الصافي بعد المقاصة</span>
                                <span className={`text-xs font-bold ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
                                  {isPositive
                                    ? <><bdi>{person.name}</bdi> يحول {Math.abs(person.net).toLocaleString()} {t.currency}</>
                                    : <>يحول لـ <bdi>{person.name}</bdi> {Math.abs(person.net).toLocaleString()} {t.currency}</>
                                  }
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ──── ORDERS ──── */}
          {activeTab === "orders" && (
            <>
              {orderFunding.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>لا يوجد تمويل مرتبط بأوردرات</p>
                  <p className="text-xs mt-1">يظهر التمويل تلقائياً عند تعيين المؤسس في الأوردرات</p>
                </div>
              ) : (
                <div>
                  {unpaidFunding.length > 0 && (
                    <div className="px-5 py-2.5 bg-destructive/5 border-b border-destructive/20 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="text-xs font-semibold text-destructive">
                        عليه {totalOwed.toLocaleString()} {t.currency} — {unpaidFunding.length} حصة في انتظار الدفع
                      </span>
                    </div>
                  )}
                  <div className="divide-y divide-border/50">
                    {orderFunding
                      .sort((a, b) => {
                        if (a.paid !== b.paid) return a.paid ? 1 : -1;
                        return (b.date || "").localeCompare(a.date || "");
                      })
                      .map((entry, idx) => {
                        const entryKey = `${entry.orderId}-${entry.founderId}`;
                        const isPaying = payingEntry === entryKey;
                        return (
                          <div key={`of-${entry.orderId}-${idx}`}
                            className={`flex items-start gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors ${
                              entry.paid ? "bg-emerald-50/50 dark:bg-emerald-950/10" : "bg-red-50/30 dark:bg-red-950/10"
                            }`}>
                            <div className={`mt-0.5 flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${entry.paid ? "bg-success/10" : "bg-destructive/10"}`}>
                              {entry.paid ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">
                                  {entry.paid ? "مساهمة (تم الدفع)" : "عليه فلوس"}
                                </span>
                                <button className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20"
                                  onClick={() => navigate(`/orders/${entry.orderId}`)}>
                                  {entry.orderId} <ExternalLink className="h-2.5 w-2.5" />
                                </button>
                                {entry.clientName && <span className="text-xs text-muted-foreground">· {entry.clientName}</span>}
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{entry.status}</Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                <span><Clock className="h-3 w-3 inline ml-0.5" />{entry.date}</span>
                                <span>نسبة: <span className="text-foreground font-medium">{entry.percentage.toFixed(1)}%</span></span>
                                <span>تكلفة: <span className="text-foreground font-medium">{entry.totalCost.toLocaleString()} {t.currency}</span></span>
                                {entry.paid && entry.paidAt && <span className="text-success">دفع في {new Date(entry.paidAt).toLocaleDateString("ar-SA")}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className={`text-sm font-bold ${entry.paid ? "text-success" : "text-destructive"}`}>
                                  {entry.amount.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{t.currency}</span>
                                </span>
                              </div>
                              {!entry.paid && (
                                <Button size="sm" variant="outline" className="h-7 text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground gap-1" disabled={isPaying} onClick={() => onPayFunding(entry)}>
                                  {isPaying ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Wallet className="h-3 w-3" />تسديد</>}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  <div className="flex items-center justify-between px-5 py-3 bg-muted/20 border-t border-border text-xs text-muted-foreground">
                    <div className="flex gap-4">
                      {totalOwed > 0 && <span>عليه: <span className="font-bold text-destructive">{totalOwed.toLocaleString()} {t.currency}</span></span>}
                      {totalPaidFunding > 0 && <span>دفع: <span className="font-bold text-success">{totalPaidFunding.toLocaleString()} {t.currency}</span></span>}
                    </div>
                    <span className="font-bold text-foreground">الإجمالي: {totalOrderFunding.toLocaleString()} {t.currency}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ──── PROFITS ──── */}
          {activeTab === "profits" && (
            <>
              {profits.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>لا توجد أرباح محصّلة</p>
                  <p className="text-xs mt-1">تظهر الأرباح تلقائياً من بيانات التحصيلات</p>
                </div>
              ) : (
                <div>
                  <div className="divide-y divide-border/50">
                    {profits.map((p, idx) => (
                      <div key={idx} className="px-5 py-3.5 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-success" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">ربح تحصيل</span>
                              <button className="inline-flex items-center gap-1 font-mono text-xs bg-success/10 text-success px-1.5 py-0.5 rounded hover:bg-success/20"
                                onClick={() => navigate(`/collections?search=${p.collectionId}`)}>
                                {p.collectionId} <ExternalLink className="h-2.5 w-2.5" />
                              </button>
                              {p.orderIds.map(oid => (
                                <button key={oid} className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20"
                                  onClick={() => navigate(`/orders/${oid}`)}>
                                  {oid} <ExternalLink className="h-2.5 w-2.5" />
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                              <span><Clock className="h-3 w-3 inline ml-0.5" />{p.date}</span>
                              {p.clientName && <button className="hover:text-primary hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/clients?search=${p.clientName}`); }}>{p.clientName}</button>}
                              <span>نسبة التحصيل: {(p.paidRatio * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-bold text-success">+{p.founderShare.toLocaleString()} {t.currency}</span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded">
                              <CheckCircle2 className="h-2.5 w-2.5" /> مضاف لرأس المال
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-5 py-3 bg-muted/20 border-t border-border text-xs text-muted-foreground">
                    <span>إجمالي الأرباح المحصّلة</span>
                    <span className="font-bold text-success">{profits.reduce((s, p) => s + p.founderShare, 0).toLocaleString()} {t.currency}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ──── CAPITAL ──── */}
          {activeTab === "capital" && (
            <>
              <div className="mx-5 my-4 rounded-xl border-2 p-5 text-center" style={{ borderColor: capitalBalance > 0 ? "hsl(var(--primary))" : "hsl(var(--border))" }}>
                <p className="text-xs text-muted-foreground mb-1">رأس المال المتاح في الحساب</p>
                <p className={`text-3xl font-bold ${capitalBalance > 0 ? "text-primary" : "text-muted-foreground"}`}>
                  {capitalBalance.toLocaleString()} <span className="text-lg font-normal">{t.currency}</span>
                </p>
                <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                  <span>رأس مال عائد: <span className="text-foreground font-medium">{autoCapitalTotal.toLocaleString()}</span></span>
                  {autoProfitTotal > 0 && <span>أرباح: <span className="text-success font-medium">+{autoProfitTotal.toLocaleString()}</span></span>}
                  {autoDeliveryReimbursement > 0 && <span>استرداد توصيل: <span className="text-amber-600 font-medium">+{autoDeliveryReimbursement.toLocaleString()}</span></span>}
                  {manualCapitalTotal > 0 && <span>يدوي: <span className="font-medium">{manualCapitalTotal.toLocaleString()}</span></span>}
                  <span>مسحوب: <span className="text-destructive font-medium">-{capitalWithdrawnTotal.toLocaleString()}</span></span>
                </div>
                {capitalBalance > 0 && (
                  <div className="mt-3">
                    <button className="text-xs px-4 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors" onClick={onWithdraw}>
                      <ArrowUpRight className="h-3 w-3 inline ml-1" />سحب رأس المال
                    </button>
                  </div>
                )}
              </div>

              {capital.length === 0 && capitalReturns.length === 0 && capitalWithdrawals.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <Coins className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>لا توجد تحصيلات مرتبطة بأوردرات بعد</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {capital.sort((a, b) => b.date.localeCompare(a.date)).map(entry => (
                    <div key={`cap-${entry.collectionId}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                      <div className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <ArrowDownLeft className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">رأس مال عائد من تحصيل</span>
                          <button className="inline-flex items-center gap-1 font-mono text-xs bg-success/10 text-success px-1.5 py-0.5 rounded hover:bg-success/20"
                            onClick={() => navigate(`/collections?search=${entry.collectionId}`)}>
                            {entry.collectionId} <ExternalLink className="h-2.5 w-2.5" />
                          </button>
                          {entry.orderIds.map(oid => (
                            <button key={oid} className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20"
                              onClick={() => navigate(`/orders/${oid}`)}>
                              {oid} <ExternalLink className="h-2.5 w-2.5" />
                            </button>
                          ))}
                          {entry.clientName && <span className="text-xs text-muted-foreground">{entry.clientName}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /><span>{entry.date}</span>
                          <span>· محصّل: {entry.paidAmount.toLocaleString()} {t.currency}</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-primary flex-shrink-0">+{entry.capitalShare.toLocaleString()} {t.currency}</span>
                    </div>
                  ))}
                  {costPayments.sort((a, b) => b.date.localeCompare(a.date)).map(entry => (
                    <div key={`costpay-${entry.orderId}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                      <div className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                        <Wallet className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">دفع التكلفة المبدأية</span>
                          <button className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20"
                            onClick={() => navigate(`/orders/${entry.orderId}`)}>
                            {entry.orderId} <ExternalLink className="h-2.5 w-2.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /><span>{entry.date}</span>
                          <span>· حصته: {entry.share.toLocaleString()} — دفع: {entry.paidAmount.toLocaleString()}</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-violet-600 flex-shrink-0">-{entry.paidAmount.toLocaleString()} {t.currency}</span>
                    </div>
                  ))}
                  {[...capitalReturns, ...capitalWithdrawals]
                    .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
                    .map(tx => (
                      <div key={tx.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                        <div className={`mt-0.5 flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${tx.type === "capital_return" ? "bg-primary/10" : "bg-destructive/10"}`}>
                          {tx.type === "capital_return" ? <ArrowDownLeft className="h-4 w-4 text-primary" /> : <ArrowUpRight className="h-4 w-4 text-destructive" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{tx.method === "return_refund" ? "استرداد مرتجع" : typeLabel(tx.type)}</span>
                            {tx.method === "return_refund" && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">مرتجع</span>}
                            {tx.orderId && <button className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20" onClick={() => navigate(`/orders/${tx.orderId}`)}>{tx.orderId} <ExternalLink className="h-2.5 w-2.5" /></button>}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /><span>{tx.date}</span>
                            {tx.notes && <span>· {tx.notes}</span>}
                          </div>
                        </div>
                        <span className={`text-sm font-bold flex-shrink-0 ${tx.type === "capital_return" ? "text-primary" : "text-destructive"}`}>
                          {tx.type === "capital_return" ? "+" : "-"}{tx.amount.toLocaleString()} {t.currency}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}

          {/* ──── RETURNS ──── */}
          {activeTab === "returns" && (
            <>
              {returnRefunds.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  <RotateCcw className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>لا توجد مرتجعات</p>
                </div>
              ) : (
                <div>
                  <div className="px-5 py-3 bg-emerald-50/50 dark:bg-emerald-950/10 border-b border-emerald-200/50 dark:border-emerald-800/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        إجمالي دخل المرتجعات: {returnRefundsTotal.toLocaleString()} {t.currency}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{returnRefunds.length} مرتجع</Badge>
                  </div>
                  <div className="divide-y divide-border/50">
                    {returnRefunds
                      .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
                      .map(tx => {
                        const returnIdMatch = (tx.notes || "").match(/استرداد مرتجع\s+(RET-\S+|[A-Za-z0-9_-]+)/);
                        const returnId = returnIdMatch ? returnIdMatch[1] : "";
                        return (
                          <div key={tx.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                            <div className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                              <RotateCcw className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">استرداد مرتجع</span>
                                {returnId && (
                                  <button
                                    className="inline-flex items-center gap-1 font-mono text-xs bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 px-1.5 py-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40"
                                    onClick={() => navigate(`/returns/${returnId}`)}
                                  >
                                    {returnId} <ExternalLink className="h-2.5 w-2.5" />
                                  </button>
                                )}
                                {tx.orderId && (
                                  <button
                                    className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20"
                                    onClick={() => navigate(`/orders/${tx.orderId}`)}
                                  >
                                    {tx.orderId} <ExternalLink className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" /><span>{tx.date}</span>
                                {tx.clientName && <span>· {tx.clientName}</span>}
                              </div>
                            </div>
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                              +{tx.amount.toLocaleString()} {t.currency}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ──── DELIVERY ──── */}
          {activeTab === "delivery" && (
            <>
              {deliveryPayments.length === 0 && deliveryReimbursements.length === 0 && deliverySubsidies.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  <Truck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>لا توجد مصاريف توصيل</p>
                </div>
              ) : (
                <div>
                  <div className="divide-y divide-border/50">
                    {deliveryPayments.sort((a, b) => b.date.localeCompare(a.date)).map(entry => (
                      <div key={`del-${entry.orderId}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                        <div className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                          <Truck className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">دفع مصاريف توصيل</span>
                            <button className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20" onClick={() => navigate(`/orders/${entry.orderId}`)}>
                              {entry.orderId} <ExternalLink className="h-2.5 w-2.5" />
                            </button>
                            {entry.clientName && <span className="text-xs text-muted-foreground">{entry.clientName}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /><span>{entry.date}</span></div>
                        </div>
                        <span className="text-sm font-bold text-orange-600 flex-shrink-0">-{entry.amount.toLocaleString()} {t.currency}</span>
                      </div>
                    ))}
                    {deliveryReimbursements.sort((a, b) => b.date.localeCompare(a.date)).map(entry => (
                      <div key={`reimb-${entry.collectionId}-${entry.orderId}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                        <div className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                          <Truck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">استرداد مصروفات توصيل</span>
                            <button className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20" onClick={() => navigate(`/orders/${entry.orderId}`)}>
                              {entry.orderId} <ExternalLink className="h-2.5 w-2.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /><span>{entry.date}</span>
                            <span>· نسبة السداد: {Math.round(entry.paidRatio * 100)}%</span>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-emerald-600 flex-shrink-0">+{entry.amount.toLocaleString()} {t.currency}</span>
                      </div>
                    ))}
                    {deliverySubsidies.sort((a, b) => b.date.localeCompare(a.date)).map((entry, idx) => (
                      <div key={`sub-${entry.collectionId}-${idx}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                        <div className={`mt-0.5 flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${entry.source === "company_debt" ? "bg-amber-100 dark:bg-amber-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}>
                          <Wallet className={`h-4 w-4 ${entry.source === "company_debt" ? "text-amber-600" : "text-blue-600"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">
                              {entry.orderId === "سداد-دين" ? "سداد دين توصيل" : entry.source === "company_debt" ? "تعويض توصيل (دين)" : "تعويض توصيل من الشركة"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /><span>{entry.date}</span></div>
                        </div>
                        <span className={`text-sm font-bold flex-shrink-0 ${entry.source === "company_debt" ? "text-amber-600" : "text-blue-600"}`}>+{entry.amount.toLocaleString()} {t.currency}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border bg-muted/30 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">إجمالي مدفوع للتوصيل</span>
                      <span className="font-bold text-orange-600">-{delPaidTotal.toLocaleString()} {t.currency}</span>
                    </div>
                    {delReimbTotal > 0 && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">مسترد</span><span className="font-bold text-emerald-600">+{delReimbTotal.toLocaleString()} {t.currency}</span></div>}
                    {delSubPaid > 0 && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">تعويض من الشركة</span><span className="font-bold text-blue-600">+{delSubPaid.toLocaleString()} {t.currency}</span></div>}
                    {delPendingDebt > 0 && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">دين معلق</span><span className="font-bold text-amber-600">{delPendingDebt.toLocaleString()} {t.currency}</span></div>}
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-border/50">
                      <span className="font-medium">الصافي</span>
                      <span className={`font-bold ${delNet > 0 ? "text-red-600" : delNet < 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {delNet > 0 ? `-${delNet.toLocaleString()}` : delNet < 0 ? `+${Math.abs(delNet).toLocaleString()}` : "0"} {t.currency}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ──── LEDGER ──── */}
          {activeTab === "ledger" && (() => {
            const allLedgerItems = [...contributions, ...fundings, ...withdrawals];
            const hasEntries = allLedgerItems.length > 0 || costPayments.length > 0 || settlementsOwed.length > 0 || settlementsOwing.length > 0;
            return (
              <>
                {!hasEntries ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    <Receipt className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p>لا توجد معاملات بعد</p>
                  </div>
                ) : (
                  <div>
                    <div className="divide-y divide-border/50">
                      {costPayments.sort((a, b) => b.date.localeCompare(a.date)).map(entry => (
                        <div key={`cp-${entry.orderId}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                          <div className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                            <Wallet className="h-4 w-4 text-violet-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">دفع التكلفة المبدأية</span>
                              <button className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20" onClick={() => navigate(`/orders/${entry.orderId}`)}>
                                {entry.orderId} <ExternalLink className="h-2.5 w-2.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /><span>{entry.date}</span></div>
                          </div>
                          <span className="text-sm font-bold text-violet-600 flex-shrink-0">-{entry.paidAmount.toLocaleString()} {t.currency}</span>
                        </div>
                      ))}
                      {settlementsOwed.sort((a, b) => (b.paidAt || b.date).localeCompare(a.paidAt || a.date)).map((entry, i) => (
                        <div key={`so-${entry.orderId}-${i}`} className={`flex items-start gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors ${entry.settled ? "opacity-60" : ""}`}>
                          <div className={`mt-0.5 flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${entry.settled ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                            {entry.settled ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <ArrowUpRight className="h-4 w-4 text-red-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium ${entry.settled ? "text-emerald-600" : "text-red-600"}`}>
                              {entry.settled ? `تم التسوية مع ${entry.to}` : `مطلوب منك لـ ${entry.to}`}
                            </span>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /><span>{entry.paidAt || entry.date}</span></div>
                          </div>
                          <span className={`text-sm font-bold flex-shrink-0 ${entry.settled ? "text-emerald-600" : "text-red-600"}`}>-{entry.amount.toLocaleString()} {t.currency}</span>
                        </div>
                      ))}
                      {settlementsOwing.sort((a, b) => (b.paidAt || b.date).localeCompare(a.paidAt || a.date)).map((entry, i) => (
                        <div key={`si-${entry.orderId}-${i}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                          <div className={`mt-0.5 flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${entry.settled ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
                            {entry.settled ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <ArrowDownLeft className="h-4 w-4 text-amber-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-emerald-600">{entry.settled ? `تم التسوية مع ${entry.from}` : `استرداد من ${entry.from}`}</span>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /><span>{entry.paidAt || entry.date}</span></div>
                          </div>
                          <span className="text-sm font-bold text-emerald-600 flex-shrink-0">+{entry.amount.toLocaleString()} {t.currency}</span>
                        </div>
                      ))}
                      {allLedgerItems.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()).map(tx => (
                        <div key={tx.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                          <div className={`mt-0.5 flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${(tx.type === "withdrawal" || tx.type === "funding") ? "bg-destructive/10" : "bg-success/10"}`}>
                            {(tx.type === "withdrawal" || tx.type === "funding") ? <ArrowUpRight className="h-4 w-4 text-destructive" /> : <Wallet className="h-4 w-4 text-success" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{typeLabel(tx.type)}</span>
                              {tx.orderId && <button className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20" onClick={() => navigate(`/orders/${tx.orderId}`)}>{tx.orderId} <ExternalLink className="h-2.5 w-2.5" /></button>}
                              {tx.clientName && <span className="text-xs text-muted-foreground">· {tx.clientName}</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" /><span>{tx.date}</span>
                              {tx.notes && <span className="truncate">· {tx.notes}</span>}
                            </div>
                          </div>
                          <span className={`text-sm font-bold flex-shrink-0 ${(tx.type === "withdrawal" || tx.type === "funding") ? "text-destructive" : "text-success"}`}>
                            {(tx.type === "withdrawal" || tx.type === "funding") ? "-" : "+"}{tx.amount.toLocaleString()} {t.currency}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between px-5 py-3 bg-muted/20 border-t border-border text-xs text-muted-foreground">
                      <span>إجمالي المساهمات والتمويل</span>
                      <span className="font-bold text-foreground">{[...contributions, ...fundings].reduce((s, tx) => s + tx.amount, 0).toLocaleString()} {t.currency}</span>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function StatMini({ label, value, color, currency, suffix }: { label: string; value: number; color: string; currency: string; suffix?: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/30 text-blue-600 dark:text-blue-400",
    green: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30 text-emerald-600 dark:text-emerald-400",
    red: "bg-red-50 dark:bg-red-950/20 border-red-200/50 dark:border-red-800/30 text-red-600 dark:text-red-400",
    orange: "bg-orange-50 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-800/30 text-orange-600 dark:text-orange-400",
    indigo: "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200/50 dark:border-indigo-800/30 text-indigo-600 dark:text-indigo-400",
    gray: "bg-muted/50 border-border/50 text-muted-foreground",
  };
  return (
    <div className={`rounded-xl p-3 border ${colorMap[color] || colorMap.gray}`}>
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-bold">
        {value > 0 ? value.toLocaleString() : (suffix || "—")}
        {value > 0 && <span className="text-[10px] font-normal text-muted-foreground mr-0.5"> {currency}</span>}
      </p>
    </div>
  );
}
