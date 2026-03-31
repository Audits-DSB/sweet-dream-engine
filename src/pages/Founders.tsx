import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { quickProfit, founderSplit } from "@/lib/orderProfit";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Users, TrendingUp, Wallet, Pencil, Plus, Loader2, Trash2, ChevronDown, ChevronUp,
  ExternalLink, ShoppingBag, Clock, AlertTriangle, Building2, ArrowDownLeft,
  ArrowUpRight, Coins, Receipt, CheckCircle2, XCircle, Truck,
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
  sourceOrders: string[];
};
type Order = { id: string; totalSelling: any; totalCost: any; splitMode: string; founderContributions?: any[]; deliveryFee?: any; deliveryFeeBearer?: string; deliveryFeePaidByFounder?: string };

function toNum(v: any): number {
  if (!v) return 0;
  return typeof v === "number" ? v : Number(String(v).replace(/,/g, "")) || 0;
}
function mapCol(raw: any): Collection {
  let notesMeta: any = {};
  try {
    const n = raw.notes || raw._notesObj;
    notesMeta = typeof n === "object" ? (n || {}) : JSON.parse(n || "{}");
  } catch {}
  const primaryOrder = raw.orderId || raw.order_id || "";
  const srcOrders: string[] = notesMeta.sourceOrders?.length > 0
    ? notesMeta.sourceOrders
    : (primaryOrder ? [primaryOrder] : []);
  return {
    id: raw.id, orderId: primaryOrder,
    clientId: raw.clientId || raw.client_id || "",
    client: raw.client || raw.clientName || raw.client_name || "",
    invoiceDate: raw.invoiceDate || raw.invoice_date || raw.createdAt || "",
    status: raw.status || "Pending",
    totalAmount: toNum(raw.totalAmount ?? raw.total_amount),
    paidAmount: toNum(raw.paidAmount ?? raw.paid_amount),
    outstanding: toNum(raw.outstanding),
    sourceOrders: srcOrders,
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

type ExpandedSection = "ledger" | "order_funding" | "profits" | "capital";

type OrderFundingEntry = {
  orderId: string;
  clientName: string;
  amount: number;
  percentage: number;
  totalCost: number;
  totalSelling: number;
  status: string;
  date: string;
  paid: boolean;
  paidAt?: string;
  founderName: string;
  founderId: string;
};

export default function FoundersPage() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const _userName = profile?.full_name || "مستخدم";
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
  const [withdrawMode, setWithdrawMode] = useState<"personal" | "fund_order">("personal");
  const [withdrawOrderId, setWithdrawOrderId] = useState("");
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
  const { profitsByFounder, capitalByFounder, deliveryReimbursementByFounder } = useMemo(() => {
    const profitMap: Record<string, Array<{
      collectionId: string; orderIds: string[]; clientName: string; date: string;
      paidAmount: number; founderShare: number; paidRatio: number; alreadyRegistered: boolean;
    }>> = {};
    const capitalMap: Record<string, Array<{
      collectionId: string; orderIds: string[]; clientName: string; date: string;
      paidAmount: number; capitalShare: number;
    }>> = {};
    const reimbursementMap: Record<string, Array<{
      collectionId: string; orderId: string; clientName: string; date: string;
      amount: number; deliveryFee: number; paidRatio: number;
    }>> = {};

    collections.forEach(col => {
      if (col.paidAmount <= 0) return;
      const srcOrders = col.sourceOrders.filter(oid => orders[oid]);
      if (srcOrders.length === 0) return;

      const companyPct = rules.companyProfitPercentage ?? 40;

      let allSelling = 0;
      srcOrders.forEach(oid => { allSelling += toNum(orders[oid].totalSelling ?? (orders[oid] as any).total_selling); });
      if (allSelling <= 0) return;

      let totalFoundersProfit = 0;
      let totalCapitalReturn = 0;
      const allSplits: Array<{ id: string; name: string; profit: number; capitalShare: number }> = [];

      srcOrders.forEach(oid => {
        const order = orders[oid];
        const oSelling = toNum(order.totalSelling ?? (order as any).total_selling);
        const oCost = toNum(order.totalCost ?? (order as any).total_cost);
        const share = allSelling > 0 ? oSelling / allSelling : 1 / srcOrders.length;
        const oPaid = col.paidAmount * share;

        const contribs = Array.isArray(order.founderContributions) ? order.founderContributions : [];
        const splitMode = ((order as any).splitMode || (order as any).split_mode || "equal");
        const isWeighted = splitMode.includes("مساهمة") || splitMode.toLowerCase().includes("contribution");

        const delFeeDeduction = (order.deliveryFeeBearer || (order as any).delivery_fee_bearer) === "company" ? toNum(order.deliveryFee ?? (order as any).delivery_fee) : 0;
        const qp = quickProfit({ orderTotal: oSelling, totalCost: oCost, paidValue: oPaid, companyProfitPct: companyPct, deliveryFeeDeduction: delFeeDeduction });
        const capitalReturn = Math.round(qp.recoveredCapital);
        totalFoundersProfit += qp.foundersProfit;
        totalCapitalReturn += capitalReturn;

        const paidByFounder = order.deliveryFeePaidByFounder || (order as any).delivery_fee_paid_by_founder || "";
        if (paidByFounder && delFeeDeduction > 0 && qp.deliveryFeeReimbursement > 0) {
          if (!reimbursementMap[paidByFounder]) reimbursementMap[paidByFounder] = [];
          reimbursementMap[paidByFounder].push({
            collectionId: col.id, orderId: oid, clientName: col.client,
            date: col.invoiceDate.split("T")[0],
            amount: Math.round(qp.deliveryFeeReimbursement),
            deliveryFee: delFeeDeduction,
            paidRatio: Math.min(oPaid / oSelling, 1),
          });
        }

        const splits = founderSplit(qp.foundersProfit, capitalReturn, contribs, isWeighted ? "weighted" : "equal");
        splits.forEach(s => {
          const existing = allSplits.find(e => e.id === s.id);
          if (existing) { existing.profit += s.profit; existing.capitalShare += s.capitalShare; }
          else allSplits.push({ ...s });
        });
      });

      const paidRatio = Math.min(col.paidAmount / allSelling, 1);

      founders.forEach(f => {
        if (!profitMap[f.id]) profitMap[f.id] = [];
        if (!capitalMap[f.id]) capitalMap[f.id] = [];

        if (totalFoundersProfit > 0) {
          let founderShare = 0;
          const match = allSplits.find(s => s.id === f.id || s.name === f.name);
          if (match) founderShare = match.profit;
          else if (allSplits.length === 0) founderShare = totalFoundersProfit / (founders.length || 1);
          if (founderShare > 0) {
            const alreadyRegistered = founderTxs.some(
              tx => tx.type === "capital_return" && tx.founderId === f.id && tx.collectionId === col.id
            );
            profitMap[f.id].push({
              collectionId: col.id, orderIds: srcOrders, clientName: col.client,
              date: col.invoiceDate.split("T")[0],
              paidAmount: col.paidAmount, founderShare: Math.round(founderShare),
              paidRatio, alreadyRegistered,
            });
          }
        }

        if (totalCapitalReturn > 0) {
          let founderCapShare = 0;
          const match = allSplits.find(s => s.id === f.id || s.name === f.name);
          if (match) founderCapShare = match.capitalShare;
          else if (allSplits.length === 0) founderCapShare = totalCapitalReturn / (founders.length || 1);
          if (founderCapShare > 0) {
            capitalMap[f.id].push({
              collectionId: col.id, orderIds: srcOrders, clientName: col.client,
              date: col.invoiceDate.split("T")[0],
              paidAmount: col.paidAmount, capitalShare: Math.round(founderCapShare),
            });
          }
        }
      });
    });
    return { profitsByFounder: profitMap, capitalByFounder: capitalMap, deliveryReimbursementByFounder: reimbursementMap };
  }, [collections, orders, founders, founderTxs, rules.companyProfitPercentage]);

  const orderFundingByFounder = useMemo(() => {
    const map: Record<string, OrderFundingEntry[]> = {};
    founders.forEach(f => { map[f.id] = []; });

    Object.values(orders).forEach((order: any) => {
      const contribs = Array.isArray(order.founderContributions) ? order.founderContributions : [];
      if (contribs.length === 0) return;

      const orderId = order.id;
      const clientName = order.client || order.clientName || order.client_name || "";
      const totalCost = toNum(order.totalCost ?? order.total_cost);
      const totalSelling = toNum(order.totalSelling ?? order.total_selling);
      const status = order.status || "";
      const date = order.date || order.createdAt || "";

      contribs.forEach((c: any) => {
        const fId = c.founderId || c.founder_id;
        if (!fId) return;
        if (!map[fId]) map[fId] = [];
        map[fId].push({
          orderId,
          clientName,
          amount: toNum(c.amount),
          percentage: toNum(c.percentage),
          totalCost,
          totalSelling,
          status,
          date: typeof date === "string" ? date.split("T")[0] : "",
          paid: !!c.paid,
          paidAt: c.paidAt || undefined,
          founderName: c.founder || "",
          founderId: fId,
        });
      });
    });
    return map;
  }, [orders, founders]);

  const totalContributed = founders.reduce((s, f) => s + f.totalContributed, 0);

  // Available capital per founder = auto capital (recovered) + auto profits + manual capital_returns - withdrawals
  // Profits are ALWAYS included automatically — no manual "تسجيل كرأس مال" step needed
  function founderDeliveryReimbursementTotal(founderId: string): number {
    return (deliveryReimbursementByFounder[founderId] || []).reduce((s, e) => s + e.amount, 0);
  }

  function founderCapitalBalance(founderId: string): number {
    const myTxs = founderTxs.filter(tx => tx.founderId === founderId);
    const autoCapital = (capitalByFounder[founderId] || []).reduce((s, e) => s + e.capitalShare, 0);
    const autoProfit = (profitsByFounder[founderId] || []).reduce((s, e) => s + e.founderShare, 0);
    const autoDeliveryReimbursement = founderDeliveryReimbursementTotal(founderId);
    const manualReturn = myTxs.filter(tx => tx.type === "capital_return").reduce((s, tx) => s + tx.amount, 0);
    const withdrawn = myTxs.filter(tx => tx.type === "capital_withdrawal").reduce((s, tx) => s + tx.amount, 0);
    return autoCapital + autoProfit + autoDeliveryReimbursement + manualReturn - withdrawn;
  }

  const totalAvailableCapital = founders.reduce((s, f) => s + Math.max(0, founderCapitalBalance(f.id)), 0);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error("أدخل اسم المؤسس"); return; }
    setSaving(true);
    try {
      const newId = `F${Date.now().toString().slice(-6)}`;
      const saved = await api.post<any>("/founders", { id: newId, name: form.name.trim(), alias: form.alias.trim(), email: form.email.trim(), phone: form.phone.trim() });
      await logAudit({ entity: "founder", entityId: saved.id || newId, entityName: form.name.trim(), action: "create", snapshot: saved, endpoint: "/founders" , performedBy: _userName });
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
      await logAudit({ entity: "founder", entityId: editingFounder.id, entityName: editForm.name, action: "update", snapshot: { ...editingFounder, ...editForm }, endpoint: "/founders", performedBy: _userName });
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
      await logAudit({ entity: "founder", entityId: editingFounder.id, entityName: editingFounder.name, action: "delete", snapshot: editingFounder as any, endpoint: "/founders" , performedBy: _userName });
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
    if (withdrawMode === "fund_order" && !withdrawOrderId.trim()) {
      toast.error("اختر الطلب المراد تمويله"); return;
    }
    setSaving(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      if (withdrawMode === "fund_order") {
        // 1. Deduct from founder's capital balance
        const withdrawTx = await api.post<FounderTx>("/founder-transactions", {
          founderId: founder.id, founderName: founder.name,
          type: "capital_withdrawal", amount: amt,
          orderId: withdrawOrderId.trim(),
          notes: `سحب من الرصيد لتمويل طلب ${withdrawOrderId.trim()}`,
          date: today,
        });
        // 2. Record as order_funding for the selected order
        const fundingTx = await api.post<FounderTx>("/founder-transactions", {
          founderId: founder.id, founderName: founder.name,
          type: "order_funding",
          amount: amt,
          orderId: withdrawOrderId.trim(),
          notes: `تمويل طلب ${withdrawOrderId.trim()} من رصيد ${founder.name}`,
          date: today,
        });
        setFounderTxs(prev => [fundingTx, withdrawTx, ...prev]);
        setWithdrawOpen(false); setWithdrawAmount(""); setWithdrawOrderId(""); setWithdrawMode("personal");
        toast.success(`تم تمويل طلب ${withdrawOrderId.trim()} بمبلغ ${amt.toLocaleString()} ج.م من رصيد ${founder.name}`);
      } else {
        // Personal withdrawal
        const tx = await api.post<FounderTx>("/founder-transactions", {
          founderId: founder.id, founderName: founder.name,
          type: "capital_withdrawal", amount: amt,
          notes: "سحب رأس مال", date: today,
        });
        setFounderTxs(prev => [tx, ...prev]);
        setWithdrawOpen(false); setWithdrawAmount(""); setWithdrawMode("personal");
        toast.success(`تم تسجيل سحب ${amt.toLocaleString()} ج.م`);
      }
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

  const [payingEntry, setPayingEntry] = useState<string | null>(null);

  const handlePayOrderFunding = async (entry: OrderFundingEntry) => {
    const founder = founders.find(f => f.id === entry.founderId);
    if (!founder) return;
    const key = `${entry.orderId}-${entry.founderId}`;
    setPayingEntry(key);
    try {
      const today = new Date().toISOString().split("T")[0];
      await api.post("/founder-transactions", {
        founderId: entry.founderId,
        founderName: entry.founderName || founder.name,
        type: "funding",
        amount: entry.amount,
        method: "transfer",
        orderId: entry.orderId,
        notes: `حصة تمويل طلب ${entry.orderId}`,
        date: today,
      });
      const order = orders[entry.orderId];
      if (order) {
        const contribs = Array.isArray(order.founderContributions) ? order.founderContributions : [];
        const updatedContribs = contribs.map((c: any) =>
          (c.founderId || c.founder_id) === entry.founderId
            ? { ...c, paid: true, paidAt: new Date().toISOString() }
            : c
        );
        await api.patch(`/orders/${entry.orderId}`, { founderContributions: updatedContribs });
      }
      await logAudit({
        entity: "founder", entityId: founder.id, entityName: founder.name,
        action: "update", snapshot: { type: "order_funding_paid", orderId: entry.orderId, amount: entry.amount },
        endpoint: `/orders/${entry.orderId}`, performedBy: _userName });
      await loadData();
      toast.success(`تم تسجيل دفع ${founder.name} لطلب ${entry.orderId} — ${entry.amount.toLocaleString()} ${t.currency}`);
    } catch (err: any) {
      toast.error(err?.message || "فشل تسجيل الدفع");
    } finally {
      setPayingEntry(null);
    }
  };

  const globalStats = useMemo(() => {
    const allEntries = founders.flatMap(f => orderFundingByFounder[f.id] || []);
    return {
      totalOwed: allEntries.filter(e => !e.paid).reduce((s, e) => s + e.amount, 0),
      totalPaid: allEntries.filter(e => e.paid).reduce((s, e) => s + e.amount, 0),
      unpaidCount: allEntries.filter(e => !e.paid).length,
      paidCount: allEntries.filter(e => e.paid).length,
      totalEntries: allEntries.length,
    };
  }, [founders, orderFundingByFounder]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="page-header">{t.foundersTitle}</h1>
            <p className="page-description">{t.foundersDesc}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />{t.addFounder}
        </Button>
      </div>

      {/* ── Top Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${globalStats.totalOwed > 0 ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
              <AlertTriangle className={`h-4 w-4 ${globalStats.totalOwed > 0 ? "text-red-600" : "text-emerald-600"}`} />
            </div>
            {globalStats.unpaidCount > 0 && <Badge variant="destructive" className="text-[10px] h-5">{globalStats.unpaidCount}</Badge>}
          </div>
          <p className="text-[10px] text-muted-foreground">عليهم فلوس</p>
          <p className={`text-lg font-bold ${globalStats.totalOwed > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {globalStats.totalOwed > 0 ? `${globalStats.totalOwed.toLocaleString()} ${t.currency}` : "✓ الكل مدفوع"}
          </p>
        </div>
        <div className="stat-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <Badge variant="secondary" className="text-[10px] h-5">{globalStats.paidCount}</Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">تم الدفع (مساهمات)</p>
          <p className="text-lg font-bold text-emerald-600">{globalStats.totalPaid > 0 ? `${globalStats.totalPaid.toLocaleString()} ${t.currency}` : "—"}</p>
        </div>
        <div className="stat-card p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/company-profit")}>
          <div className="flex items-center justify-between mb-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </div>
          <p className="text-[10px] text-muted-foreground">{t.totalProfits}</p>
          <p className="text-lg font-bold text-blue-600">عرض التفاصيل</p>
        </div>
        <div className="stat-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${totalAvailableCapital > 0 ? "bg-indigo-500/10" : "bg-muted"}`}>
              <Coins className={`h-4 w-4 ${totalAvailableCapital > 0 ? "text-indigo-600" : "text-muted-foreground"}`} />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">رأس المال المتاح</p>
          <p className={`text-lg font-bold ${totalAvailableCapital > 0 ? "text-indigo-600" : "text-muted-foreground"}`}>
            {totalAvailableCapital > 0 ? `${totalAvailableCapital.toLocaleString()} ${t.currency}` : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">جاهز للاستخدام</p>
        </div>
      </div>

      {founders.length === 0 ? (
        <div className="stat-card py-20 text-center">
          <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm mb-4">لا يوجد مؤسسون مسجّلون بعد</p>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" />{t.addFounder}</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {founders.map((f, fIdx) => {
            const myTxs = founderTxs.filter(tx => tx.founderId === f.id || tx.founderName === f.name)
              .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

            const contributions = myTxs.filter(tx => tx.type === "contribution");
            const fundings = myTxs.filter(tx => tx.type === "funding");
            const capitalReturns = myTxs.filter(tx => tx.type === "capital_return");
            const capitalWithdrawals = myTxs.filter(tx => tx.type === "capital_withdrawal");
            const withdrawals = myTxs.filter(tx => tx.type === "withdrawal");

            const myProfits = profitsByFounder[f.id] || [];
            const myCapital = capitalByFounder[f.id] || [];
            const myOrderFunding = orderFundingByFounder[f.id] || [];
            const totalOrderFunding = myOrderFunding.reduce((s, e) => s + e.amount, 0);
            const unpaidFunding = myOrderFunding.filter(e => !e.paid);
            const paidFunding = myOrderFunding.filter(e => e.paid);
            const totalOwed = unpaidFunding.reduce((s, e) => s + e.amount, 0);
            const totalPaidFunding = paidFunding.reduce((s, e) => s + e.amount, 0);
            const isExpanded = expandedFounder === f.id;
            const section = activeSection[f.id] || "ledger";

            const capitalBalance = founderCapitalBalance(f.id);
            const autoCapitalTotal = myCapital.reduce((s, e) => s + e.capitalShare, 0);
            const autoProfitTotal = (profitsByFounder[f.id] || []).reduce((s, e) => s + e.founderShare, 0);
            const autoDeliveryReimbursement = founderDeliveryReimbursementTotal(f.id);
            const manualCapitalTotal = capitalReturns.reduce((s, tx) => s + tx.amount, 0);
            const capitalWithdrawnTotal = capitalWithdrawals.reduce((s, tx) => s + tx.amount, 0);

            const txContribTotal = [...contributions, ...fundings].reduce((s, tx) => s + tx.amount, 0);
            const displayTotal = txContribTotal > 0 ? txContribTotal : f.totalContributed;
            const paymentPct = totalOrderFunding > 0 ? (totalPaidFunding / totalOrderFunding) * 100 : 0;

            const avatarColors = [
              "from-blue-500 to-indigo-600", "from-emerald-500 to-teal-600",
              "from-orange-500 to-red-600", "from-purple-500 to-violet-600",
              "from-cyan-500 to-blue-600", "from-rose-500 to-pink-600",
            ];

            return (
              <div key={f.id} className="stat-card p-0 overflow-hidden">
                {/* ── Header ── */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3.5">
                      <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${avatarColors[fIdx % avatarColors.length]} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <span className="text-lg font-bold text-white">{f.name.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-base">{f.name}</p>
                          <Badge variant="secondary" className={`text-[10px] h-5 ${f.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                            {f.active ? t.active : t.inactive}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          {f.alias && <span>{f.alias}</span>}
                          {f.alias && (f.email || f.phone) && <span>·</span>}
                          {f.email && <span>{f.email}</span>}
                          {f.email && f.phone && <span>·</span>}
                          {f.phone && <span>{f.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => { setEditingFounder(f); setEditForm({ name: f.name, alias: f.alias, email: f.email, phone: f.phone }); setEditOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* ── Stats Mini Cards ── */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className={`rounded-xl p-3 ${totalOwed > 0 ? "bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30" : "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30"}`}>
                      <p className="text-[10px] text-muted-foreground mb-1">عليه فلوس</p>
                      <p className={`text-sm font-bold ${totalOwed > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {totalOwed > 0 ? totalOwed.toLocaleString() : "✓ مدفوع"}
                      </p>
                      {unpaidFunding.length > 0 && <p className="text-[10px] text-red-500 mt-0.5">{unpaidFunding.length} أوردر</p>}
                    </div>
                    <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
                      <p className="text-[10px] text-muted-foreground mb-1">مساهمات مدفوعة</p>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{totalPaidFunding > 0 ? totalPaidFunding.toLocaleString() : "—"}</p>
                      {paidFunding.length > 0 && <p className="text-[10px] text-emerald-500 mt-0.5">{paidFunding.length} أوردر</p>}
                    </div>
                    <div className="rounded-xl p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
                      <p className="text-[10px] text-muted-foreground mb-1">أرباح محصّلة</p>
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{autoProfitTotal > 0 ? autoProfitTotal.toLocaleString() : "—"}</p>
                      {myProfits.length > 0 && <p className="text-[10px] text-blue-500 mt-0.5">{myProfits.length} عملية</p>}
                    </div>
                    <div className={`rounded-xl p-3 ${capitalBalance > 0 ? "bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/30" : "bg-muted/50 border border-border/50"}`}>
                      <p className="text-[10px] text-muted-foreground mb-1">رأس مال متاح</p>
                      <p className={`text-sm font-bold ${capitalBalance > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground"}`}>
                        {capitalBalance > 0 ? capitalBalance.toLocaleString() : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t.currency}</p>
                    </div>
                  </div>

                  {/* ── Payment Progress Bar ── */}
                  {totalOrderFunding > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>نسبة السداد</span>
                        <span className="font-medium">{paymentPct.toFixed(0)}% · {totalPaidFunding.toLocaleString()} / {totalOrderFunding.toLocaleString()} {t.currency}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${paymentPct >= 100 ? "bg-emerald-500" : paymentPct >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                          style={{ width: `${Math.min(paymentPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Expand Toggle ── */}
                <div className="border-t border-border">
                  <button
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedFounder(isExpanded ? null : f.id)}
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {isExpanded ? "إخفاء التفاصيل" : "عرض السجل التفصيلي"}
                  </button>
                </div>

                {/* ── Expanded Content ── */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Section Selector */}
                    <div className="flex border-b border-border bg-muted/20">
                      {(["order_funding", "ledger", "profits", "capital"] as ExpandedSection[]).map(s => {
                        const tabIcons: Record<ExpandedSection, typeof ShoppingBag> = { order_funding: ShoppingBag, ledger: Receipt, profits: TrendingUp, capital: Coins };
                        const TabIcon = tabIcons[s];
                        const labels: Record<ExpandedSection, string> = {
                          order_funding: `الأوردرات (${myOrderFunding.length})`,
                          ledger: "السجل",
                          profits: `الأرباح (${myProfits.length})`,
                          capital: `رأس المال`,
                        };
                        const hasAlert = s === "order_funding" && unpaidFunding.length > 0;
                        return (
                          <button key={s} className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 flex items-center justify-center gap-1.5 relative ${section === s ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                            onClick={() => setActiveSection(prev => ({ ...prev, [f.id]: s }))}>
                            <TabIcon className="h-3 w-3" />
                            {labels[s]}
                            {hasAlert && <span className="absolute top-1.5 end-2 h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
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
                          <div className="max-h-[500px] overflow-y-auto">
                            <div className="divide-y divide-border/50">
                              {[...contributions, ...fundings, ...withdrawals]
                                .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
                                .map(tx => (
                                  <div key={tx.id} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                                    <div className={`mt-0.5 flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${(tx.type === "withdrawal" || tx.type === "funding") ? "bg-destructive/10" : "bg-success/10"}`}>
                                      {(tx.type === "withdrawal" || tx.type === "funding")
                                        ? <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
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
                                    <div className={`text-sm font-bold flex-shrink-0 ${(tx.type === "withdrawal" || tx.type === "funding") ? "text-destructive" : "text-success"}`}>
                                      {(tx.type === "withdrawal" || tx.type === "funding") ? "-" : "+"}{tx.amount.toLocaleString()}
                                      <span className="text-xs font-normal text-muted-foreground mr-0.5">{t.currency}</span>
                                    </div>
                                    <button className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => { setDeletingTx(tx); setDeleteTxOpen(true); }}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-5 py-2.5 bg-muted/20 border-t border-border text-xs text-muted-foreground">
                          <span>إجمالي المساهمات والتمويل</span>
                          <span className="font-bold text-foreground">{[...contributions, ...fundings].reduce((s, tx) => s + tx.amount, 0).toLocaleString()} {t.currency}</span>
                        </div>
                      </>
                    )}

                    {/* ── ORDER FUNDING: aggregated from order contributions ── */}
                    {section === "order_funding" && (
                      <>
                        {myOrderFunding.length === 0 ? (
                          <div className="py-10 text-center text-sm text-muted-foreground">
                            <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p>لا يوجد تمويل مرتبط بأوردرات لهذا المؤسس</p>
                            <p className="text-xs mt-1">يظهر التمويل تلقائياً عند تعيين المؤسس في الأوردرات</p>
                          </div>
                        ) : (
                          <div className="max-h-[500px] overflow-y-auto">
                            {unpaidFunding.length > 0 && (
                              <div className="px-5 py-2 bg-destructive/5 border-b border-destructive/20">
                                <span className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  عليه {totalOwed.toLocaleString()} {t.currency} — {unpaidFunding.length} حصة في انتظار الدفع
                                </span>
                              </div>
                            )}
                            <div className="divide-y divide-border/50">
                              {myOrderFunding
                                .sort((a, b) => {
                                  if (a.paid !== b.paid) return a.paid ? 1 : -1;
                                  return (b.date || "").localeCompare(a.date || "");
                                })
                                .map((entry, idx) => {
                                  const entryKey = `${entry.orderId}-${entry.founderId}`;
                                  const isPaying = payingEntry === entryKey;
                                  return (
                                    <div key={`of-${entry.orderId}-${idx}`}
                                      className={`flex items-start gap-3 px-5 py-3 hover:bg-muted/20 transition-colors ${
                                        entry.paid
                                          ? "bg-emerald-50/50 dark:bg-emerald-950/10"
                                          : "bg-red-50/30 dark:bg-red-950/10"
                                      }`}>
                                      <div className={`mt-0.5 flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${
                                        entry.paid ? "bg-success/10" : "bg-destructive/10"
                                      }`}>
                                        {entry.paid
                                          ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                          : <XCircle className="h-3.5 w-3.5 text-destructive" />}
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
                                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                                          <span><Clock className="h-3 w-3 inline ml-0.5" />{entry.date}</span>
                                          <span>نسبة: <span className="text-foreground font-medium">{entry.percentage.toFixed(1)}%</span></span>
                                          <span>تكلفة الأوردر: <span className="text-foreground font-medium">{entry.totalCost.toLocaleString()} {t.currency}</span></span>
                                          {entry.paid && entry.paidAt && (
                                            <span className="text-success">دفع في {new Date(entry.paidAt).toLocaleDateString("ar-SA")}</span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <div className="flex flex-col items-end gap-0.5">
                                          <span className={`text-sm font-bold ${entry.paid ? "text-success" : "text-destructive"}`}>
                                            {entry.amount.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{t.currency}</span>
                                          </span>
                                        </div>
                                        {!entry.paid && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground gap-1"
                                            disabled={isPaying}
                                            onClick={() => handlePayOrderFunding(entry)}
                                          >
                                            {isPaying
                                              ? <Loader2 className="h-3 w-3 animate-spin" />
                                              : <><Wallet className="h-3 w-3" />تسديد</>}
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                        {myOrderFunding.length > 0 && (
                          <div className="flex items-center justify-between px-5 py-2.5 bg-muted/20 border-t border-border text-xs text-muted-foreground">
                            <div className="flex gap-4">
                              {totalOwed > 0 && <span>عليه: <span className="font-bold text-destructive">{totalOwed.toLocaleString()} {t.currency}</span></span>}
                              {totalPaidFunding > 0 && <span>دفع: <span className="font-bold text-success">{totalPaidFunding.toLocaleString()} {t.currency}</span></span>}
                            </div>
                            <span className="font-bold text-foreground">الإجمالي: {totalOrderFunding.toLocaleString()} {t.currency}</span>
                          </div>
                        )}
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
                          <div className="max-h-[500px] overflow-y-auto">
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
                                        {p.orderIds.map(oid => (
                                          <button key={oid} className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20"
                                            onClick={() => navigate(`/orders/${oid}`)}>
                                            {oid} <ExternalLink className="h-2.5 w-2.5" />
                                          </button>
                                        ))}
                                      </div>
                                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                                        <span><Clock className="h-3 w-3 inline ml-0.5" />{p.date}</span>
                                        {p.clientName && <button className="hover:text-primary hover:underline" onClick={() => navigate(`/clients?search=${p.clientName}`)}>{p.clientName}</button>}
                                        <span>نسبة التحصيل: {(p.paidRatio * 100).toFixed(0)}%</span>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="text-sm font-bold text-success">+{p.founderShare.toLocaleString()} {t.currency}</span>
                                      <span className="inline-flex items-center gap-1 text-xs text-success bg-success/10 px-1.5 py-0.5 rounded">
                                        <CheckCircle2 className="h-3 w-3" /> مضاف تلقائياً لرأس المال
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
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
                            <span>رأس مال عائد: <span className="text-foreground font-medium">{autoCapitalTotal.toLocaleString()}</span></span>
                            {autoProfitTotal > 0 && <span>أرباح تلقائية: <span className="text-success font-medium">+{autoProfitTotal.toLocaleString()}</span></span>}
                            {autoDeliveryReimbursement > 0 && <span>استرداد توصيل: <span className="text-amber-600 dark:text-amber-400 font-medium">+{autoDeliveryReimbursement.toLocaleString()}</span></span>}
                            {manualCapitalTotal > 0 && <span>يدوي: <span className="text-foreground font-medium">{manualCapitalTotal.toLocaleString()}</span></span>}
                            <span>مسحوب: <span className="text-destructive font-medium">−{capitalWithdrawnTotal.toLocaleString()}</span></span>
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
                          <div className="max-h-[500px] overflow-y-auto">
                            <div className="divide-y divide-border/50">
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
                                        {entry.orderIds.map(oid => (
                                          <button key={oid} className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20"
                                            onClick={() => navigate(`/orders/${oid}`)}>
                                            {oid} <ExternalLink className="h-2.5 w-2.5" />
                                          </button>
                                        ))}
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
                              {(deliveryReimbursementByFounder[f.id] || [])
                                .sort((a, b) => b.date.localeCompare(a.date))
                                .map(entry => (
                                  <div key={`reimb-${entry.collectionId}-${entry.orderId}`} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                                    <div className="mt-0.5 flex-shrink-0 h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                      <Truck className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium">استرداد مصروفات توصيل</span>
                                        <button className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20"
                                          onClick={() => navigate(`/orders/${entry.orderId}`)}>
                                          {entry.orderId} <ExternalLink className="h-2.5 w-2.5" />
                                        </button>
                                        {entry.clientName && <span className="text-xs text-muted-foreground">{entry.clientName}</span>}
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3 flex-shrink-0" />
                                        <span>{entry.date}</span>
                                        <span>· توصيل: {entry.deliveryFee.toLocaleString()} {t.currency}</span>
                                        <span>· نسبة السداد: {Math.round(entry.paidRatio * 100)}%</span>
                                      </div>
                                    </div>
                                    <div className="text-sm font-bold flex-shrink-0 text-amber-600 dark:text-amber-400">
                                      +{entry.amount.toLocaleString()}
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
                          </div>
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
      <Dialog open={withdrawOpen} onOpenChange={(v) => { setWithdrawOpen(v); if (!v) { setWithdrawMode("personal"); setWithdrawOrderId(""); setWithdrawAmount(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-amber-500" />
              سحب من الرصيد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Available balance */}
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-sm">
              <p className="text-muted-foreground text-xs mb-0.5">الرصيد المتاح</p>
              <p className="font-bold text-amber-700 dark:text-amber-400 text-lg">
                {founderCapitalBalance(withdrawFounderId).toLocaleString()} {t.currency}
              </p>
            </div>

            {/* Mode selection */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWithdrawMode("personal")}
                className={`rounded-lg border p-3 text-xs font-medium transition-colors text-center ${
                  withdrawMode === "personal"
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <ArrowUpRight className="h-4 w-4 mx-auto mb-1" />
                سحب شخصي
              </button>
              <button
                type="button"
                onClick={() => setWithdrawMode("fund_order")}
                className={`rounded-lg border p-3 text-xs font-medium transition-colors text-center ${
                  withdrawMode === "fund_order"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <Coins className="h-4 w-4 mx-auto mb-1" />
                تمويل عملية
              </button>
            </div>

            {/* Order selector (only in fund_order mode) */}
            {withdrawMode === "fund_order" && (
              <div className="space-y-1.5">
                <Label className="text-xs">اختر الطلب المراد تمويله *</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={withdrawOrderId}
                  onChange={(e) => setWithdrawOrderId(e.target.value)}
                >
                  <option value="">— اختر طلباً —</option>
                  {Object.values(orders)
                    .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""))
                    .slice(0, 50)
                    .map((o: any) => (
                      <option key={o.id} value={o.id}>
                        {o.id} — {o.client || "بدون عميل"} ({o.status || ""})
                      </option>
                    ))}
                </select>
                {withdrawOrderId && orders[withdrawOrderId] && (
                  <p className="text-xs text-muted-foreground">
                    التكلفة الكلية: <span className="font-medium text-foreground">{Number(orders[withdrawOrderId].totalCost || 0).toLocaleString()} {t.currency}</span>
                    {" · "}العميل: <span className="font-medium text-foreground">{(orders[withdrawOrderId] as any).client || "—"}</span>
                  </p>
                )}
              </div>
            )}

            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs">المبلغ ({t.currency}) *</Label>
              <Input
                className="h-9"
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Summary for fund_order mode */}
            {withdrawMode === "fund_order" && withdrawOrderId && parseFloat(withdrawAmount) > 0 && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs space-y-1">
                <p className="font-semibold text-primary text-sm">ملخص العملية</p>
                <p>• سيُخصم <strong>{parseFloat(withdrawAmount).toLocaleString()} {t.currency}</strong> من رصيد المؤسس</p>
                <p>• سيُسجَّل كـ <strong>تمويل</strong> لطلب <span className="font-mono">{withdrawOrderId}</span></p>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>إلغاء</Button>
            <Button
              variant={withdrawMode === "fund_order" ? "default" : "destructive"}
              onClick={handleWithdrawCapital}
              disabled={saving}
            >
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : withdrawMode === "fund_order" ? "تمويل العملية" : "تسجيل السحب"}
            </Button>
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
