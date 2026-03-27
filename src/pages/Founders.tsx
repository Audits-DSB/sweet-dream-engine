import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users, TrendingUp, Wallet, Pencil, Plus, Loader2, Trash2, ChevronDown, ChevronUp,
  ExternalLink, ShoppingBag, Clock, AlertTriangle, Building2, ArrowDownLeft,
  ArrowUpRight, Coins, Receipt, CheckCircle2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { logAudit } from "@/lib/auditLog";
import { useBusinessRules } from "@/lib/useBusinessRules";

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
type Collection = {
  id: string; orderId: string; clientId: string; client: string; invoiceDate: string;
  status: string; totalAmount: number; paidAmount: number; outstanding: number;
};
type Order = { id: string; totalSelling: any; totalCost: any; splitMode: string; founderContributions?: any[] };

function toNum(v: any): number {
  if (!v) return 0;
  return typeof v === "number" ? v : Number(String(v).replace(/,/g, "")) || 0;
}
function mapCol(raw: any): Collection {
  return {
    id: raw.id, orderId: raw.orderId || raw.order_id || "",
    clientId: raw.clientId || raw.client_id || "",
    client: raw.client || raw.clientName || raw.client_name || "",
    invoiceDate: raw.invoiceDate || raw.invoice_date || raw.createdAt || "",
    status: raw.status || "Pending",
    totalAmount: toNum(raw.totalAmount ?? raw.total_amount),
    paidAmount: toNum(raw.paidAmount ?? raw.paid_amount),
    outstanding: toNum(raw.outstanding),
  };
}

const emptyForm = { name: "", alias: "", email: "", phone: "", totalContributed: "" };

function typeLabel(type: string) {
  if (type === "funding") return "تمويل طلب";
  if (type === "contribution") return "مساهمة رأس مال";
  if (type === "withdrawal") return "سحب";
  if (type === "capital_return") return "رأس مال عائد";
  if (type === "capital_withdrawal") return "سحب رأس مال";
  return type;
}

type ExpandedSection = "ledger" | "profits" | "capital";

export default function FoundersPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { rules } = useBusinessRules();

  const [founders, setFounders] = useState<Founder[]>([]);
  const [founderTxs, setFounderTxs] = useState<FounderTx[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [expandedFounder, setExpandedFounder] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Record<string, ExpandedSection>>({});

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTxOpen, setDeleteTxOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [registerCapitalOpen, setRegisterCapitalOpen] = useState(false);

  const [deletingTx, setDeletingTx] = useState<FounderTx | null>(null);
  const [deletingTxSaving, setDeletingTxSaving] = useState(false);
  const [editingFounder, setEditingFounder] = useState<Founder | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawFounderId, setWithdrawFounderId] = useState("");
  const [capitalRegForm, setCapitalRegForm] = useState({ founderId: "", founderName: "", amount: "", collectionId: "", orderId: "", clientName: "", notes: "" });
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ name: "", alias: "", email: "", phone: "" });

  const loadData = async () => {
    const [f, txs, cols, ords] = await Promise.all([
      api.get<any[]>("/founders"),
      api.get<FounderTx[]>("/founder-transactions").catch(() => [] as FounderTx[]),
      api.get<any[]>("/collections").catch(() => [] as any[]),
      api.get<any[]>("/orders").catch(() => [] as any[]),
    ]);
    const fm: Record<string, Founder> = {};
    (f || []).forEach((x: any) => {
      const mapped = {
        id: x.id, name: x.name || "", alias: x.alias || "", email: x.email || "",
        phone: x.phone || "", active: x.active !== false,
        totalContributed: toNum(x.totalContributed ?? x.total_contributed),
        totalWithdrawn: toNum(x.totalWithdrawn ?? x.total_withdrawn),
      };
      fm[x.id] = mapped;
    });
    setFounders(Object.values(fm));
    setFounderTxs(txs || []);
    setCollections((cols || []).map(mapCol));
    const om: Record<string, Order> = {};
    (ords || []).forEach((o: any) => { om[o.id] = o; });
    setOrders(om);
  };

  useEffect(() => {
    loadData().catch(() => toast.error("تعذّر تحميل بيانات المؤسسين")).finally(() => setLoading(false));
  }, []);

  // ── Calculate profit AND capital distributions per founder from collections ──
  const { profitsByFounder, capitalByFounder } = useMemo(() => {
    const profitMap: Record<string, Array<{
      collectionId: string; orderId: string; clientName: string; date: string;
      paidAmount: number; founderShare: number; paidRatio: number; alreadyRegistered: boolean;
    }>> = {};
    const capitalMap: Record<string, Array<{
      collectionId: string; orderId: string; clientName: string; date: string;
      paidAmount: number; capitalShare: number;
    }>> = {};

    collections.forEach(col => {
      const order = col.orderId ? orders[col.orderId] : null;
      if (!col.orderId || !order || col.paidAmount <= 0) return;

      const totalSelling = toNum(order.totalSelling ?? (order as any).total_selling);
      const totalCost = toNum(order.totalCost ?? (order as any).total_cost);
      const grossProfit = totalSelling - totalCost;
      if (totalSelling <= 0) return;

      const paidRatio = Math.min(col.paidAmount / totalSelling, 1);
      const realizedProfit = grossProfit > 0 ? grossProfit * paidRatio : 0;
      // Capital return = the non-profit portion of what was collected
      const capitalReturn = Math.max(0, col.paidAmount - realizedProfit);

      const companyPct = rules.companyProfitPercentage ?? 40;
      const foundersProfit = realizedProfit * (1 - companyPct / 100);

      // Determine founder split settings from order
      const contribs = Array.isArray(order.founderContributions) ? order.founderContributions : [];
      const splitMode = (order as any).splitMode || (order as any).split_mode || "equal";
      const totalFounderPct = contribs.length > 0
        ? contribs.reduce((s: number, c: any) => s + (c.percentage || 0), 0) || 100
        : 100;

      founders.forEach(f => {
        if (!profitMap[f.id]) profitMap[f.id] = [];
        if (!capitalMap[f.id]) capitalMap[f.id] = [];

        // ── Profit share ──────────────────────────────────────────────────────
        if (grossProfit > 0) {
          let founderShare = 0;
          if (contribs.length > 0 && splitMode !== "equal") {
            const fc = contribs.find((c: any) => c.founderId === f.id || c.founder === f.name);
            if (fc) founderShare = foundersProfit * (fc.percentage || 0) / totalFounderPct;
          } else {
            founderShare = foundersProfit / (founders.length || 1);
          }
          if (founderShare > 0) {
            const alreadyRegistered = founderTxs.some(
              tx => tx.type === "capital_return" && tx.founderId === f.id && tx.collectionId === col.id
            );
            profitMap[f.id].push({
              collectionId: col.id, orderId: col.orderId, clientName: col.client,
              date: col.invoiceDate.split("T")[0],
              paidAmount: col.paidAmount, founderShare: Math.round(founderShare),
              paidRatio, alreadyRegistered,
            });
          }
        }

        // ── Capital return share ──────────────────────────────────────────────
        if (capitalReturn > 0) {
          let founderCapShare = 0;
          if (contribs.length > 0 && splitMode !== "equal") {
            const fc = contribs.find((c: any) => c.founderId === f.id || c.founder === f.name);
            if (fc) founderCapShare = capitalReturn * (fc.percentage || 0) / totalFounderPct;
          } else {
            founderCapShare = capitalReturn / (founders.length || 1);
          }
          if (founderCapShare > 0) {
            capitalMap[f.id].push({
              collectionId: col.id, orderId: col.orderId, clientName: col.client,
              date: col.invoiceDate.split("T")[0],
              paidAmount: col.paidAmount, capitalShare: Math.round(founderCapShare),
            });
          }
        }
      });
    });
    return { profitsByFounder: profitMap, capitalByFounder: capitalMap };
  }, [collections, orders, founders, founderTxs, rules.companyProfitPercentage]);

  const totalContributed = founders.reduce((s, f) => s + f.totalContributed, 0);

  // Available capital per founder = auto capital from collections + manual capital_returns - withdrawals
  function founderCapitalBalance(founderId: string): number {
    const myTxs = founderTxs.filter(tx => tx.founderId === founderId);
    const autoCapital = (capitalByFounder[founderId] || []).reduce((s, e) => s + e.capitalShare, 0);
    const manualReturn = myTxs.filter(tx => tx.type === "capital_return").reduce((s, tx) => s + tx.amount, 0);
    const withdrawn = myTxs.filter(tx => tx.type === "capital_withdrawal").reduce((s, tx) => s + tx.amount, 0);
    return autoCapital + manualReturn - withdrawn;
  }

  const totalAvailableCapital = founders.reduce((s, f) => s + Math.max(0, founderCapitalBalance(f.id)), 0);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error("أدخل اسم المؤسس"); return; }
    setSaving(true);
    try {
      const newId = `F${Date.now().toString().slice(-6)}`;
      const saved = await api.post<any>("/founders", { id: newId, name: form.name.trim(), alias: form.alias.trim(), email: form.email.trim(), phone: form.phone.trim() });
      await logAudit({ entity: "founder", entityId: saved.id || newId, entityName: form.name.trim(), action: "create", snapshot: saved, endpoint: "/founders" });
      await loadData();
      setForm(emptyForm); setAddOpen(false);
      toast.success("تمت إضافة المؤسس");
    } catch { toast.error("فشل حفظ بيانات المؤسس"); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editingFounder || !editForm.name.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/founders/${editingFounder.id}`, editForm);
      await logAudit({ entity: "founder", entityId: editingFounder.id, entityName: editForm.name, action: "update", snapshot: { ...editingFounder, ...editForm }, endpoint: "/founders" });
      setFounders(founders.map(f => f.id === editingFounder.id ? { ...f, ...editForm } : f));
      setEditOpen(false); toast.success("تم تحديث بيانات المؤسس");
    } catch { toast.error("فشل تحديث بيانات المؤسس"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!editingFounder) return;
    setSaving(true);
    try {
      await api.delete(`/founders/${editingFounder.id}`);
      await logAudit({ entity: "founder", entityId: editingFounder.id, entityName: editingFounder.name, action: "delete", snapshot: editingFounder as any, endpoint: "/founders" });
      setFounders(founders.filter(f => f.id !== editingFounder.id));
      setDeleteOpen(false); setEditOpen(false); toast.success("تم حذف المؤسس");
    } catch { toast.error("فشل حذف المؤسس"); }
    finally { setSaving(false); }
  };

  const handleDeleteTx = async () => {
    if (!deletingTx) return;
    setDeletingTxSaving(true);
    try {
      await api.delete(`/founder-transactions/${deletingTx.id}`);
      setFounderTxs(prev => prev.filter(t => t.id !== deletingTx.id));
      setDeletingTx(null); setDeleteTxOpen(false);
      toast.success("تم حذف المعاملة");
    } catch { toast.error("فشل حذف المعاملة"); }
    finally { setDeletingTxSaving(false); }
  };

  const handleWithdrawCapital = async () => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    const founder = founders.find(f => f.id === withdrawFounderId);
    if (!founder) return;
    const balance = founderCapitalBalance(founder.id);
    if (amt > balance) { toast.error(`الرصيد المتاح ${balance.toLocaleString()} ج.م فقط`); return; }
    setSaving(true);
    try {
      const tx = await api.post<FounderTx>("/founder-transactions", {
        founderId: founder.id, founderName: founder.name,
        type: "capital_withdrawal", amount: amt,
        notes: "سحب رأس مال", date: new Date().toISOString().split("T")[0],
      });
      setFounderTxs(prev => [tx, ...prev]);
      setWithdrawOpen(false); setWithdrawAmount("");
      toast.success(`تم تسجيل سحب ${amt.toLocaleString()} ج.م`);
    } catch { toast.error("فشل تسجيل السحب"); }
    finally { setSaving(false); }
  };

  const handleRegisterCapital = async () => {
    const amt = parseFloat(capitalRegForm.amount);
    if (isNaN(amt) || amt <= 0 || !capitalRegForm.founderId) { toast.error("بيانات ناقصة"); return; }
    setSaving(true);
    try {
      const tx = await api.post<FounderTx>("/founder-transactions", {
        founderId: capitalRegForm.founderId, founderName: capitalRegForm.founderName,
        type: "capital_return", amount: amt,
        collectionId: capitalRegForm.collectionId, orderId: capitalRegForm.orderId,
        clientName: capitalRegForm.clientName, notes: capitalRegForm.notes,
        date: new Date().toISOString().split("T")[0],
      });
      setFounderTxs(prev => [tx, ...prev]);
      setRegisterCapitalOpen(false);
      toast.success(`تم تسجيل رأس مال عائد ${amt.toLocaleString()} ج.م`);
    } catch { toast.error("فشل التسجيل"); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">{t.foundersTitle}</h1>
          <p className="page-description">{t.foundersDesc}</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.addFounder}
        </Button>
      </div>

      {/* ── Top Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title={t.totalContributions}
          value={totalContributed > 0 ? `${(totalContributed / 1000).toFixed(0)}ك ${t.currency}` : "—"}
          change={`${founders.length} ${t.foundersCount}`} changeType="neutral" icon={Wallet} />
        <div className="cursor-pointer" onClick={() => navigate("/company-profit")}>
          <StatCard title={t.totalProfits} value="عرض الأرباح" change="صفحة الأرباح التفصيلية" changeType="positive" icon={TrendingUp} />
        </div>
        <StatCard title="رأس المال المتاح"
          value={totalAvailableCapital > 0 ? `${totalAvailableCapital.toLocaleString()} ${t.currency}` : "—"}
          change="غير مسحوب — جاهز للاستخدام" changeType={totalAvailableCapital > 0 ? "positive" : "neutral"} icon={Coins} />
      </div>

      {founders.length === 0 ? (
        <div className="stat-card py-20 text-center">
          <p className="text-muted-foreground text-sm mb-4">لا يوجد مؤسسون مسجّلون بعد</p>
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.addFounder}</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {founders.map((f) => {
            const myTxs = founderTxs.filter(tx => tx.founderId === f.id || tx.founderName === f.name)
              .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

            const contributions = myTxs.filter(tx => tx.type === "contribution");
            const fundings = myTxs.filter(tx => tx.type === "funding");
            const capitalReturns = myTxs.filter(tx => tx.type === "capital_return");
            const capitalWithdrawals = myTxs.filter(tx => tx.type === "capital_withdrawal");
            const withdrawals = myTxs.filter(tx => tx.type === "withdrawal");

            const myProfits = profitsByFounder[f.id] || [];
            const myCapital = capitalByFounder[f.id] || [];
            const isExpanded = expandedFounder === f.id;
            const section = activeSection[f.id] || "ledger";

            const capitalBalance = founderCapitalBalance(f.id);
            const autoCapitalTotal = myCapital.reduce((s, e) => s + e.capitalShare, 0);
            const manualCapitalTotal = capitalReturns.reduce((s, tx) => s + tx.amount, 0);
            const capitalWithdrawnTotal = capitalWithdrawals.reduce((s, tx) => s + tx.amount, 0);

            const txContribTotal = [...contributions, ...fundings].reduce((s, tx) => s + tx.amount, 0);
            const displayTotal = txContribTotal > 0 ? txContribTotal : f.totalContributed;

            return (
              <div key={f.id} className="stat-card p-0 overflow-hidden">
                {/* ── Header ── */}
                <div className="flex items-start justify-between p-5">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-primary">{f.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-base">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.alias}{f.alias && f.email ? " · " : ""}{f.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className={f.active ? "bg-success/10 text-success border-0" : "bg-muted text-muted-foreground border-0"}>
                      {f.active ? t.active : t.inactive}
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setEditingFounder(f); setEditForm({ name: f.name, alias: f.alias, email: f.email, phone: f.phone }); setEditOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* ── Stats Row ── */}
                <div className="grid grid-cols-4 gap-0 border-t border-border">
                  <div className="p-3 text-center border-l border-border rtl:border-r rtl:border-l-0">
                    <div className="text-xs text-muted-foreground mb-1">إجمالي المساهمات</div>
                    <div className="font-bold text-sm">{displayTotal > 0 ? displayTotal.toLocaleString() : "—"}</div>
                    <div className="text-xs text-muted-foreground">{t.currency}</div>
                  </div>
                  <div className="p-3 text-center border-l border-border rtl:border-r rtl:border-l-0">
                    <div className="text-xs text-muted-foreground mb-1">تمويل أوردرات</div>
                    <div className="font-bold text-sm text-primary">{fundings.length > 0 ? fundings.length : "—"}</div>
                    <div className="text-xs text-muted-foreground">طلب</div>
                  </div>
                  <div className="p-3 text-center border-l border-border rtl:border-r rtl:border-l-0">
                    <div className="text-xs text-muted-foreground mb-1">أرباح محصّلة</div>
                    <div className="font-bold text-sm text-success">{myProfits.length > 0 ? myProfits.length : "—"}</div>
                    <div className="text-xs text-muted-foreground">عملية</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">رأس مال متاح</div>
                    <div className={`font-bold text-sm ${capitalBalance > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {capitalBalance > 0 ? capitalBalance.toLocaleString() : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">{t.currency}</div>
                  </div>
                </div>

                {/* ── Section Tabs ── */}
                <div className="border-t border-border">
                  <button
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedFounder(isExpanded ? null : f.id)}
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    {isExpanded ? "إخفاء التفاصيل" : "عرض السجل التفصيلي"}
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* ── Expanded Content ── */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Section Selector */}
                    <div className="flex border-b border-border">
                      {(["ledger", "profits", "capital"] as ExpandedSection[]).map(s => {
                        const labels: Record<ExpandedSection, string> = { ledger: "التمويلات والمساهمات", profits: `الأرباح (${myProfits.length})`, capital: `رأس المال (${capitalBalance.toLocaleString()})` };
                        return (
                          <button key={s} className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 ${section === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                            onClick={() => setActiveSection(prev => ({ ...prev, [f.id]: s }))}>
                            {labels[s]}
                          </button>
                        );
                      })}
                    </div>

                    {/* ── LEDGER: contributions + fundings + withdrawals ── */}
                    {section === "ledger" && (
                      <>
                        {[...contributions, ...fundings, ...withdrawals].length === 0 ? (
                          <div className="py-10 text-center text-sm text-muted-foreground">لا توجد معاملات بعد</div>
                        ) : (
                          <ScrollArea className="max-h-72">
                            <div className="divide-y divide-border/50">
                              {[...contributions, ...fundings, ...withdrawals]
                                .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
                                .map(tx => (
                                  <div key={tx.id} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                                    <div className={`mt-0.5 flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${tx.type === "withdrawal" ? "bg-destructive/10" : tx.type === "funding" ? "bg-primary/10" : "bg-success/10"}`}>
                                      {tx.type === "withdrawal" ? <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                                        : tx.type === "funding" ? <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                                        : <Wallet className="h-3.5 w-3.5 text-success" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium">{typeLabel(tx.type)}</span>
                                        {tx.orderId && (
                                          <button className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20"
                                            onClick={() => navigate(`/orders/${tx.orderId}`)}>
                                            {tx.orderId} <ExternalLink className="h-2.5 w-2.5" />
                                          </button>
                                        )}
                                        {tx.clientName && <span className="text-xs text-muted-foreground">· {tx.clientName}</span>}
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                        <span className="text-xs text-muted-foreground">{tx.date}</span>
                                        {tx.notes && <span className="text-xs text-muted-foreground truncate">· {tx.notes}</span>}
                                      </div>
                                    </div>
                                    <div className={`text-sm font-bold flex-shrink-0 ${tx.type === "withdrawal" ? "text-destructive" : "text-foreground"}`}>
                                      {tx.type === "withdrawal" ? "-" : "+"}{tx.amount.toLocaleString()}
                                      <span className="text-xs font-normal text-muted-foreground mr-0.5">{t.currency}</span>
                                    </div>
                                    <button className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => { setDeletingTx(tx); setDeleteTxOpen(true); }}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                            </div>
                          </ScrollArea>
                        )}
                        <div className="flex items-center justify-between px-5 py-2.5 bg-muted/20 border-t border-border text-xs text-muted-foreground">
                          <span>إجمالي المساهمات والتمويل</span>
                          <span className="font-bold text-foreground">{[...contributions, ...fundings].reduce((s, tx) => s + tx.amount, 0).toLocaleString()} {t.currency}</span>
                        </div>
                      </>
                    )}

                    {/* ── PROFITS: computed from collections ── */}
                    {section === "profits" && (
                      <>
                        {myProfits.length === 0 ? (
                          <div className="py-10 text-center text-sm text-muted-foreground">
                            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p>لا توجد أرباح محصّلة مرتبطة بهذا المؤسس</p>
                            <p className="text-xs mt-1">تظهر الأرباح تلقائياً من بيانات التحصيلات</p>
                          </div>
                        ) : (
                          <ScrollArea className="max-h-80">
                            <div className="divide-y divide-border/50">
                              {myProfits.map((p, idx) => (
                                <div key={idx} className="px-5 py-3 hover:bg-muted/20 transition-colors">
                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5 flex-shrink-0 h-7 w-7 rounded-full bg-success/10 flex items-center justify-center">
                                      <TrendingUp className="h-3.5 w-3.5 text-success" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium">ربح تحصيل</span>
                                        <button className="inline-flex items-center gap-1 font-mono text-xs bg-success/10 text-success px-1.5 py-0.5 rounded hover:bg-success/20"
                                          onClick={() => navigate(`/collections?search=${p.collectionId}`)}>
                                          {p.collectionId} <ExternalLink className="h-2.5 w-2.5" />
                                        </button>
                                        {p.orderId && (
                                          <button className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20"
                                            onClick={() => navigate(`/orders/${p.orderId}`)}>
                                            {p.orderId} <ExternalLink className="h-2.5 w-2.5" />
                                          </button>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                                        <span><Clock className="h-3 w-3 inline ml-0.5" />{p.date}</span>
                                        {p.clientName && <button className="hover:text-primary hover:underline" onClick={() => navigate(`/clients?search=${p.clientName}`)}>{p.clientName}</button>}
                                        <span>نسبة التحصيل: {(p.paidRatio * 100).toFixed(0)}%</span>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="text-sm font-bold text-success">+{p.founderShare.toLocaleString()} {t.currency}</span>
                                      {p.alreadyRegistered ? (
                                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                          <CheckCircle2 className="h-3 w-3 text-success" /> مسجّل كرأس مال
                                        </span>
                                      ) : (
                                        <button
                                          className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded transition-colors"
                                          onClick={() => {
                                            setCapitalRegForm({ founderId: f.id, founderName: f.name, amount: String(p.founderShare), collectionId: p.collectionId, orderId: p.orderId, clientName: p.clientName, notes: "" });
                                            setRegisterCapitalOpen(true);
                                          }}
                                        >
                                          <Coins className="h-3 w-3" /> تسجيل كرأس مال
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                        <div className="flex items-center justify-between px-5 py-2.5 bg-muted/20 border-t border-border text-xs text-muted-foreground">
                          <span>إجمالي الأرباح المحصّلة</span>
                          <span className="font-bold text-success">{myProfits.reduce((s, p) => s + p.founderShare, 0).toLocaleString()} {t.currency}</span>
                        </div>
                      </>
                    )}

                    {/* ── CAPITAL ACCOUNT: رأس المال المتاح ── */}
                    {section === "capital" && (
                      <>
                        {/* Balance Card */}
                        <div className="mx-4 my-3 rounded-lg border-2 p-4 text-center" style={{ borderColor: capitalBalance > 0 ? "hsl(var(--primary))" : "hsl(var(--border))" }}>
                          <p className="text-xs text-muted-foreground mb-1">رأس المال المتاح في الحساب</p>
                          <p className={`text-2xl font-bold ${capitalBalance > 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {capitalBalance.toLocaleString()} <span className="text-base font-normal">{t.currency}</span>
                          </p>
                          <div className="flex items-center justify-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span>من تحصيلات: <span className="text-foreground font-medium">{autoCapitalTotal.toLocaleString()}</span></span>
                            {manualCapitalTotal > 0 && <span>أرباح مسجّلة: <span className="text-foreground font-medium">{manualCapitalTotal.toLocaleString()}</span></span>}
                            <span>مسحوب: <span className="text-destructive font-medium">{capitalWithdrawnTotal.toLocaleString()}</span></span>
                          </div>
                          {capitalBalance > 0 && (
                            <div className="mt-3 flex gap-2 justify-center">
                              <button
                                className="text-xs px-3 py-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                                onClick={() => { setWithdrawFounderId(f.id); setWithdrawAmount(""); setWithdrawOpen(true); }}
                              >
                                <ArrowUpRight className="h-3 w-3 inline ml-0.5" />سحب رأس المال
                              </button>
                              <p className="text-xs text-muted-foreground flex items-center">
                                <CheckCircle2 className="h-3 w-3 text-success inline ml-1" />
                                يُخصم تلقائياً في الأوردرات الجديدة
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Capital History: auto from collections + manual returns + withdrawals */}
                        {myCapital.length === 0 && capitalReturns.length === 0 && capitalWithdrawals.length === 0 ? (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            <Coins className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p>لا توجد تحصيلات مرتبطة بأوردرات بعد</p>
                            <p className="text-xs mt-1">سيظهر رأس المال تلقائياً عند تسجيل تحصيلات على الأوردرات</p>
                          </div>
                        ) : (
                          <ScrollArea className="max-h-72">
                            <div className="divide-y divide-border/50">
                              {/* Auto capital entries from collections */}
                              {myCapital
                                .sort((a, b) => b.date.localeCompare(a.date))
                                .map(entry => (
                                  <div key={`cap-${entry.collectionId}`} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                                    <div className="mt-0.5 flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                                      <ArrowDownLeft className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium">رأس مال عائد من تحصيل</span>
                                        <button className="inline-flex items-center gap-1 font-mono text-xs bg-success/10 text-success px-1.5 py-0.5 rounded hover:bg-success/20"
                                          onClick={() => navigate(`/collections?search=${entry.collectionId}`)}>
                                          {entry.collectionId} <ExternalLink className="h-2.5 w-2.5" />
                                        </button>
                                        {entry.orderId && (
                                          <button className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20"
                                            onClick={() => navigate(`/orders/${entry.orderId}`)}>
                                            {entry.orderId} <ExternalLink className="h-2.5 w-2.5" />
                                          </button>
                                        )}
                                        {entry.clientName && <span className="text-xs text-muted-foreground">{entry.clientName}</span>}
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3 flex-shrink-0" />
                                        <span>{entry.date}</span>
                                        <span>· محصّل: {entry.paidAmount.toLocaleString()} {t.currency}</span>
                                      </div>
                                    </div>
                                    <div className="text-sm font-bold flex-shrink-0 text-primary">
                                      +{entry.capitalShare.toLocaleString()}
                                      <span className="text-xs font-normal text-muted-foreground mr-0.5">{t.currency}</span>
                                    </div>
                                  </div>
                                ))}
                              {/* Manual capital_return + capital_withdrawal transactions */}
                              {[...capitalReturns, ...capitalWithdrawals]
                                .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
                                .map(tx => (
                                  <div key={tx.id} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                                    <div className={`mt-0.5 flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${tx.type === "capital_return" ? "bg-primary/10" : "bg-destructive/10"}`}>
                                      {tx.type === "capital_return"
                                        ? <ArrowDownLeft className="h-3.5 w-3.5 text-primary" />
                                        : <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium">{typeLabel(tx.type)}</span>
                                        {tx.collectionId && (
                                          <button className="inline-flex items-center gap-1 font-mono text-xs bg-success/10 text-success px-1.5 py-0.5 rounded hover:bg-success/20"
                                            onClick={() => navigate(`/collections?search=${tx.collectionId}`)}>
                                            {tx.collectionId} <ExternalLink className="h-2.5 w-2.5" />
                                          </button>
                                        )}
                                        {tx.orderId && (
                                          <button className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20"
                                            onClick={() => navigate(`/orders/${tx.orderId}`)}>
                                            {tx.orderId} <ExternalLink className="h-2.5 w-2.5" />
                                          </button>
                                        )}
                                        {tx.clientName && (
                                          <span className="text-xs text-muted-foreground">{tx.clientName}</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3 flex-shrink-0" />
                                        <span>{tx.date}</span>
                                        {tx.notes && <span className="truncate">· {tx.notes}</span>}
                                      </div>
                                    </div>
                                    <div className={`text-sm font-bold flex-shrink-0 ${tx.type === "capital_return" ? "text-primary" : "text-destructive"}`}>
                                      {tx.type === "capital_return" ? "+" : "-"}{tx.amount.toLocaleString()}
                                      <span className="text-xs font-normal text-muted-foreground mr-0.5">{t.currency}</span>
                                    </div>
                                    <button className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => { setDeletingTx(tx); setDeleteTxOpen(true); }}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                            </div>
                          </ScrollArea>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Founder Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.addNewFounder}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t.name} *</Label><Input className="h-9 mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label className="text-xs">{t.jobTitle}</Label><Input className="h-9 mt-1" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t.email}</Label><Input className="h-9 mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label className="text-xs">{t.phone}</Label><Input className="h-9 mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.addFounder}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Founder Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.edit} — {editingFounder?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t.name} *</Label><Input className="h-9 mt-1" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div><Label className="text-xs">{t.jobTitle}</Label><Input className="h-9 mt-1" value={editForm.alias} onChange={(e) => setEditForm({ ...editForm, alias: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t.email}</Label><Input className="h-9 mt-1" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
              <div><Label className="text-xs">{t.phone}</Label><Input className="h-9 mt-1" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /></Button>
            <Button className="flex-1" onClick={handleEdit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Founder Confirm ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>حذف المؤسس</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف <strong>{editingFounder?.name}</strong>؟</p>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Transaction Confirm ── */}
      <Dialog open={deleteTxOpen} onOpenChange={(v) => { if (!v) { setDeleteTxOpen(false); setDeletingTx(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" />حذف المعاملة</DialogTitle>
          </DialogHeader>
          {deletingTx && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">سيتم حذف هذه المعاملة:</p>
              <div className="rounded-lg border border-border p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">النوع</span><span className="font-medium">{typeLabel(deletingTx.type)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">المبلغ</span><span className="font-bold">{deletingTx.amount.toLocaleString()} {t.currency}</span></div>
                {deletingTx.orderId && <div className="flex justify-between"><span className="text-muted-foreground">الطلب</span><span className="font-mono text-xs">{deletingTx.orderId}</span></div>}
                {deletingTx.collectionId && <div className="flex justify-between"><span className="text-muted-foreground">التحصيل</span><span className="font-mono text-xs">{deletingTx.collectionId}</span></div>}
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => { setDeleteTxOpen(false); setDeletingTx(null); }}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDeleteTx} disabled={deletingTxSaving}>{deletingTxSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Withdraw Capital Dialog ── */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-destructive" />سحب رأس المال</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              الرصيد المتاح: <strong>{founderCapitalBalance(withdrawFounderId).toLocaleString()} {t.currency}</strong>
            </p>
            <div>
              <Label className="text-xs">المبلغ المراد سحبه ({t.currency}) *</Label>
              <Input className="h-9 mt-1" type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="0" />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleWithdrawCapital} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "تسجيل السحب"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Register Capital Return Dialog ── */}
      <Dialog open={registerCapitalOpen} onOpenChange={setRegisterCapitalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Coins className="h-4 w-4 text-primary" />تسجيل رأس مال عائد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1">
              {capitalRegForm.collectionId && <div><span className="text-muted-foreground">التحصيل: </span><span className="font-mono">{capitalRegForm.collectionId}</span></div>}
              {capitalRegForm.orderId && <div><span className="text-muted-foreground">الطلب: </span><span className="font-mono">{capitalRegForm.orderId}</span></div>}
              {capitalRegForm.clientName && <div><span className="text-muted-foreground">العميل: </span><span>{capitalRegForm.clientName}</span></div>}
            </div>
            <div>
              <Label className="text-xs">المبلغ ({t.currency}) *</Label>
              <Input className="h-9 mt-1" type="number" value={capitalRegForm.amount} onChange={(e) => setCapitalRegForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">ملاحظات</Label>
              <Input className="h-9 mt-1" value={capitalRegForm.notes} onChange={(e) => setCapitalRegForm(f => ({ ...f, notes: e.target.value }))} placeholder="اختياري" />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setRegisterCapitalOpen(false)}>إلغاء</Button>
            <Button onClick={handleRegisterCapital} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "تسجيل كرأس مال"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
