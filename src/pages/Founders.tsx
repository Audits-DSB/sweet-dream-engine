import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { quickProfit, founderSplit } from "@/lib/orderProfit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users, TrendingUp, Wallet, Pencil, Plus, Loader2, Trash2,
  ExternalLink, AlertTriangle, Banknote,
  ArrowUpRight, Coins, CheckCircle2,
} from "lucide-react";
import FounderProfile from "@/components/FounderProfile";
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
  if (type === "capital_return") return "استرداد رأس مال";
  if (type === "capital_withdrawal") return "سحب رأس مال";
  return type;
}


type OrderFundingEntry = {
  orderId: string;
  clientName: string;
  amount: number;
  originalAmount: number;
  percentage: number;
  totalCost: number;
  totalSelling: number;
  status: string;
  date: string;
  paid: boolean;
  autoFunded: boolean;
  paidAmount?: number;
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

  const [selectedFounder, setSelectedFounder] = useState<string | null>(null);

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

  const [returnsData, setReturnsData] = useState<any[]>([]);

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

  const loadData = async () => {
    const [f, txs, cols, ords, rets] = await Promise.all([
      api.get<any[]>("/founders"),
      api.get<FounderTx[]>("/founder-transactions").catch(() => [] as FounderTx[]),
      api.get<any[]>("/collections").catch(() => [] as any[]),
      api.get<any[]>("/orders").catch(() => [] as any[]),
      api.get<any[]>("/returns").catch(() => [] as any[]),
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
    (ords || []).forEach((o: any) => {
      om[o.id] = o;
    });
    setOrders(om);
    setReturnsData(rets || []);
  };

  useEffect(() => {
    loadData().catch(() => toast.error("تعذّر تحميل بيانات المؤسسين")).finally(() => setLoading(false));
  }, []);

  const fullReturnOrderIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(orders).forEach((o: any) => {
      const s = (o.status || "").trim();
      if (s === "مرتجع كلي") ids.add(o.id);
    });
    returnsData.forEach((ret: any) => {
      if (ret.status === "accepted" && (ret.returnType === "full" || ret.return_type === "full")) {
        const oid = ret.orderId || ret.order_id;
        if (oid) ids.add(oid);
      }
    });
    return ids;
  }, [orders, returnsData]);

  // ── Calculate profit AND capital distributions per founder from collections ──
  const { profitsByFounder, capitalByFounder, deliveryReimbursementByFounder, companyDeliverySubsidies } = useMemo(() => {
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
    const subsidyMap: Record<string, Array<{
      collectionId: string; orderId: string; clientName: string; date: string;
      amount: number; deliveryFee: number; orderProfit: number;
      source: "company_balance" | "company_debt";
    }>> = {};

    let companyRunningBalance = 0;
    const founderDebts: Record<string, number> = {};

    const sortedCollections = [...collections].sort((a, b) =>
      (a.invoiceDate || "").localeCompare(b.invoiceDate || "")
    );

    sortedCollections.forEach(col => {
      if (col.paidAmount <= 0) return;
      const srcOrders = col.sourceOrders.filter(oid => orders[oid] && !fullReturnOrderIds.has(oid));
      if (srcOrders.length === 0) return;

      const companyPct = rules.companyProfitPercentage ?? 40;

      let allSelling = 0;
      srcOrders.forEach(oid => {
        const ded = returnDeductions[oid];
        allSelling += Math.max(toNum(orders[oid].totalSelling ?? (orders[oid] as any).total_selling) - (ded?.returnedSelling || 0), 0);
      });
      if (allSelling <= 0) return;

      let totalFoundersProfit = 0;
      let totalCapitalReturn = 0;
      let totalCompanyProfit = 0;
      const allSplits: Array<{ id: string; name: string; profit: number; capitalShare: number }> = [];
      const orderDeficits: Array<{ orderId: string; paidByFounder: string; deficit: number; deliveryFee: number; orderProfit: number; clientName: string; date: string }> = [];

      srcOrders.forEach(oid => {
        const order = orders[oid];
        const ded = returnDeductions[oid];
        const oSelling = Math.max(toNum(order.totalSelling ?? (order as any).total_selling) - (ded?.returnedSelling || 0), 0);
        const oCost = Math.max(toNum(order.totalCost ?? (order as any).total_cost) - (ded?.returnedCost || 0), 0);
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
        totalCompanyProfit += qp.companyProfit;

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

        if (paidByFounder && qp.deliveryFeeDeficit > 0) {
          const grossProfit = oSelling > 0 ? oPaid * ((oSelling - oCost) / oSelling) : 0;
          orderDeficits.push({
            orderId: oid,
            paidByFounder,
            deficit: qp.deliveryFeeDeficit,
            deliveryFee: delFeeDeduction,
            orderProfit: Math.round(grossProfit),
            clientName: col.client,
            date: col.invoiceDate.split("T")[0],
          });
        }

        const splits = founderSplit(qp.foundersProfit, capitalReturn, contribs, isWeighted ? "weighted" : "equal");
        splits.forEach(s => {
          const existing = allSplits.find(e => e.id === s.id);
          if (existing) { existing.profit += s.profit; existing.capitalShare += s.capitalShare; }
          else allSplits.push({ ...s });
        });
      });

      companyRunningBalance += totalCompanyProfit;

      for (const fId of Object.keys(founderDebts)) {
        if (founderDebts[fId] <= 0) continue;
        if (companyRunningBalance <= 0) break;
        const repay = Math.min(founderDebts[fId], companyRunningBalance);
        founderDebts[fId] -= repay;
        companyRunningBalance -= repay;
        if (!subsidyMap[fId]) subsidyMap[fId] = [];
        subsidyMap[fId].push({
          collectionId: col.id, orderId: "سداد-دين", clientName: col.client,
          date: col.invoiceDate.split("T")[0],
          amount: Math.round(repay), deliveryFee: 0, orderProfit: 0,
          source: "company_balance",
        });
      }

      orderDeficits.forEach(d => {
        const fId = d.paidByFounder;
        if (!subsidyMap[fId]) subsidyMap[fId] = [];

        if (companyRunningBalance >= d.deficit) {
          companyRunningBalance -= d.deficit;
          subsidyMap[fId].push({
            collectionId: col.id, orderId: d.orderId, clientName: d.clientName,
            date: d.date, amount: Math.round(d.deficit),
            deliveryFee: d.deliveryFee, orderProfit: d.orderProfit,
            source: "company_balance",
          });
        } else {
          const fromBalance = Math.max(companyRunningBalance, 0);
          const asDebt = d.deficit - fromBalance;
          companyRunningBalance -= fromBalance;
          if (fromBalance > 0) {
            subsidyMap[fId].push({
              collectionId: col.id, orderId: d.orderId, clientName: d.clientName,
              date: d.date, amount: Math.round(fromBalance),
              deliveryFee: d.deliveryFee, orderProfit: d.orderProfit,
              source: "company_balance",
            });
          }
          if (asDebt > 0) {
            if (!founderDebts[fId]) founderDebts[fId] = 0;
            founderDebts[fId] += asDebt;
            subsidyMap[fId].push({
              collectionId: col.id, orderId: d.orderId, clientName: d.clientName,
              date: d.date, amount: Math.round(asDebt),
              deliveryFee: d.deliveryFee, orderProfit: d.orderProfit,
              source: "company_debt",
            });
          }
        }
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
    return { profitsByFounder: profitMap, capitalByFounder: capitalMap, deliveryReimbursementByFounder: reimbursementMap, companyDeliverySubsidies: subsidyMap };
  }, [collections, orders, founders, founderTxs, rules.companyProfitPercentage, returnDeductions, fullReturnOrderIds]);

  const deliveryPaymentsByFounder = useMemo(() => {
    const map: Record<string, Array<{ orderId: string; clientName: string; date: string; amount: number }>> = {};
    Object.values(orders).forEach((order: any) => {
      const paidBy = order.deliveryFeePaidByFounder || (order as any).delivery_fee_paid_by_founder || "";
      if (!paidBy) return;
      const bearer = order.deliveryFeeBearer || (order as any).delivery_fee_bearer;
      if (bearer !== "company") return;
      const fee = toNum(order.deliveryFee ?? (order as any).delivery_fee);
      if (fee <= 0) return;
      if (!map[paidBy]) map[paidBy] = [];
      map[paidBy].push({
        orderId: order.id,
        clientName: order.client || order.clientName || order.client_name || "",
        date: (order.date || "").split("T")[0],
        amount: fee,
      });
    });
    return map;
  }, [orders]);

  const orderCostPaymentsByFounder = useMemo(() => {
    const map: Record<string, Array<{ orderId: string; clientName: string; date: string; paidAmount: number; share: number; diff: number }>> = {};
    Object.values(orders).forEach((order: any) => {
      const contribs = Array.isArray(order.founderContributions) ? order.founderContributions : [];
      if (contribs.length === 0) return;
      let costPaidMap: Record<string, number> = {};
      try {
        const raw = order.orderCostPaidByFounder ?? order.order_cost_paid_by_founder;
        costPaidMap = typeof raw === "object" && raw !== null ? raw : JSON.parse(raw || "{}");
      } catch {}
      if (Object.keys(costPaidMap).length === 0) return;
      const clientName = order.client || order.clientName || order.client_name || "";
      const date = (order.date || "").split("T")[0];
      Object.entries(costPaidMap).forEach(([fId, paidAmt]) => {
        if (paidAmt <= 0) return;
        const contrib = contribs.find((c: any) => (c.founderId || c.founder_id) === fId);
        const share = contrib ? toNum(contrib.amount) : 0;
        if (!map[fId]) map[fId] = [];
        map[fId].push({ orderId: order.id, clientName, date, paidAmount: paidAmt, share, diff: paidAmt - share });
      });
    });
    return map;
  }, [orders]);

  const orderCostSettlements = useMemo(() => {
    const settlements: Array<{ orderId: string; clientName: string; date: string; paidAt: string; from: string; fromId: string; to: string; toId: string; amount: number; toPaidTotal: number; toShare: number; settled: boolean }> = [];
    Object.values(orders).forEach((order: any) => {
      const contribs = Array.isArray(order.founderContributions) ? order.founderContributions : [];
      if (contribs.length === 0) return;
      let costPaidMap: Record<string, number> = {};
      try {
        const raw = order.orderCostPaidByFounder ?? order.order_cost_paid_by_founder;
        costPaidMap = typeof raw === "object" && raw !== null ? raw : JSON.parse(raw || "{}");
      } catch {}
      const entries = contribs.map((c: any) => {
        const fId = c.founderId || c.founder_id || "";
        const initialPaid = costPaidMap[fId] || 0;
        const share = toNum(c.amount);
        const paidAmt = toNum(c.paidAmount ?? c.paid_amount);
        const paidAt = c.paidAt || c.paid_at || "";
        return { id: fId, name: c.founder || "", paidAmt, share, diff: initialPaid - share, paidAt };
      }).filter(e => e.id);
      const allPaid = entries.every(e => e.paidAmt >= e.share);
      const overpayers = entries.filter(e => e.diff > 0);
      const underpayers = entries.filter(e => e.diff < 0);
      if (overpayers.length === 0 || underpayers.length === 0) return;
      const oRemain = overpayers.map(e => e.diff);
      const uRemain = underpayers.map(e => Math.abs(e.diff));
      let oi = 0, ui = 0;
      while (oi < overpayers.length && ui < underpayers.length) {
        const transfer = Math.min(oRemain[oi], uRemain[ui]);
        if (transfer > 0) {
          const paymentDate = overpayers[oi].paidAt ? overpayers[oi].paidAt.split("T")[0] : (order.date || "").split("T")[0];
          settlements.push({
            orderId: order.id,
            clientName: order.client || order.clientName || order.client_name || "",
            date: (order.date || "").split("T")[0],
            paidAt: paymentDate,
            from: underpayers[ui].name, fromId: underpayers[ui].id,
            to: overpayers[oi].name, toId: overpayers[oi].id,
            amount: Math.round(transfer),
            toPaidTotal: overpayers[oi].paidAmt,
            toShare: overpayers[oi].share,
            settled: allPaid,
          });
        }
        oRemain[oi] -= transfer;
        uRemain[ui] -= transfer;
        if (oRemain[oi] <= 0) oi++;
        if (uRemain[ui] <= 0) ui++;
      }
    });
    return settlements;
  }, [orders]);

  const orderFundingByFounder = useMemo(() => {
    const map: Record<string, OrderFundingEntry[]> = {};
    founders.forEach(f => { map[f.id] = []; });

    Object.values(orders).forEach((order: any) => {
      if (fullReturnOrderIds.has(order.id)) return;
      const contribs = Array.isArray(order.founderContributions) ? order.founderContributions : [];
      if (contribs.length === 0) return;

      const orderId = order.id;
      const clientName = order.client || order.clientName || order.client_name || "";
      const totalCost = toNum(order.totalCost ?? order.total_cost);
      const totalSelling = toNum(order.totalSelling ?? order.total_selling);
      const status = order.status || "";
      const date = order.date || order.createdAt || "";

      let costPaidMap: Record<string, number> = {};
      try {
        const raw = order.orderCostPaidByFounder ?? order.order_cost_paid_by_founder;
        costPaidMap = typeof raw === "object" && raw !== null ? raw : JSON.parse(raw || "{}");
      } catch {}

      contribs.forEach((c: any) => {
        const fId = c.founderId || c.founder_id;
        if (!fId) return;
        if (!map[fId]) map[fId] = [];
        const amt = toNum(c.amount);
        const initialPaid = toNum(costPaidMap[fId]);
        const isPaid = !!c.paid || (initialPaid >= amt && amt > 0);
        map[fId].push({
          orderId,
          clientName,
          amount: amt,
          originalAmount: amt,
          percentage: toNum(c.percentage),
          totalCost,
          totalSelling,
          status,
          date: typeof date === "string" ? date.split("T")[0] : "",
          paid: isPaid,
          autoFunded: false,
          paidAmount: toNum(c.paidAmount ?? c.paid_amount) || (isPaid ? initialPaid : 0),
          paidAt: c.paidAt || undefined,
          founderName: c.founder || "",
          founderId: fId,
        });
      });
    });

    return map;
  }, [orders, founders, founderTxs, fullReturnOrderIds]);

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
  const [fundingDialog, setFundingDialog] = useState<{ open: boolean; entry: OrderFundingEntry | null; available: number }>({ open: false, entry: null, available: 0 });
  const [useBalance, setUseBalance] = useState(false);

  const handlePayOrderFunding = (entry: OrderFundingEntry) => {
    const available = Math.max(0, founderCapitalBalance(entry.founderId));
    setUseBalance(false);
    setFundingDialog({ open: true, entry, available });
  };

  const handlePayWithBalance = async () => {
    const { entry, available } = fundingDialog;
    if (!entry) return;
    const founder = founders.find(f => f.id === entry.founderId);
    if (!founder) return;
    const required = entry.amount;
    const walletUsed = useBalance ? Math.min(available, required) : 0;
    const cashPortion = required - walletUsed;
    const key = `${entry.orderId}-${entry.founderId}`;
    setPayingEntry(key);
    try {
      const today = new Date().toISOString().split("T")[0];
      if (walletUsed > 0) {
        await api.post("/founder-transactions", {
          founderId: entry.founderId,
          founderName: entry.founderName || founder.name,
          type: "capital_withdrawal",
          amount: walletUsed,
          method: "balance",
          orderId: entry.orderId,
          notes: `سحب من الرصيد لتمويل طلب ${entry.orderId}`,
          date: today,
        });
      }
      await api.post("/founder-transactions", {
        founderId: entry.founderId,
        founderName: entry.founderName || founder.name,
        type: "funding",
        amount: required,
        method: walletUsed > 0 && cashPortion > 0 ? "mixed" : walletUsed > 0 ? "balance" : "transfer",
        orderId: entry.orderId,
        notes: walletUsed > 0 && cashPortion > 0
          ? `تمويل طلب ${entry.orderId}: ${walletUsed.toLocaleString()} رصيد + ${cashPortion.toLocaleString()} تمويل مالي`
          : walletUsed > 0
          ? `تمويل طلب ${entry.orderId} من الرصيد`
          : `حصة تمويل طلب ${entry.orderId}`,
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
        action: "update", snapshot: { type: "order_funding_paid", orderId: entry.orderId, amount: required, walletUsed, cashPortion },
        endpoint: `/orders/${entry.orderId}`, performedBy: _userName });
      await loadData();
      setFundingDialog({ open: false, entry: null, available: 0 });
      const msg = walletUsed > 0 && cashPortion > 0
        ? `تم تسجيل دفع ${founder.name} — ${walletUsed.toLocaleString()} رصيد + ${cashPortion.toLocaleString()} تمويل مالي`
        : walletUsed > 0
        ? `تم تسجيل دفع ${founder.name} — ${walletUsed.toLocaleString()} من الرصيد`
        : `تم تسجيل تمويل ${founder.name} — ${required.toLocaleString()} تمويل مالي`;
      toast.success(msg);
    } catch (err: any) {
      toast.error(err?.message || "فشل تسجيل الدفع");
    } finally {
      setPayingEntry(null);
    }
  };

  const globalStats = useMemo(() => {
    const allEntries = founders.flatMap(f => orderFundingByFounder[f.id] || []);
    const totalPaidAmt = allEntries.reduce((s, e) => {
      const pa = e.paidAmount || 0;
      return s + (pa > 0 ? pa : (e.paid ? e.amount : 0));
    }, 0);
    const totalAmount = allEntries.reduce((s, e) => s + e.amount, 0);
    return {
      totalOwed: Math.max(0, totalAmount - totalPaidAmt),
      totalPaid: totalPaidAmt,
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

      {selectedFounder && (() => {
        const f = founders.find(x => x.id === selectedFounder);
        if (!f) return null;
        const myCapital = capitalByFounder[f.id] || [];
        const autoCapitalTotal = myCapital.reduce((s, e) => s + e.capitalShare, 0);
        const autoProfitTotal = (profitsByFounder[f.id] || []).reduce((s, e) => s + e.founderShare, 0);
        const autoDeliveryReimbursement = founderDeliveryReimbursementTotal(f.id);
        return (
          <FounderProfile
            founder={f}
            founderTxs={founderTxs}
            orderFunding={orderFundingByFounder[f.id] || []}
            profits={profitsByFounder[f.id] || []}
            capital={capitalByFounder[f.id] || []}
            deliveryPayments={deliveryPaymentsByFounder[f.id] || []}
            deliveryReimbursements={deliveryReimbursementByFounder[f.id] || []}
            deliverySubsidies={companyDeliverySubsidies[f.id] || []}
            costPayments={orderCostPaymentsByFounder[f.id] || []}
            settlementsOwed={orderCostSettlements.filter(s => s.fromId === f.id)}
            settlementsOwing={orderCostSettlements.filter(s => s.toId === f.id)}
            capitalBalance={founderCapitalBalance(f.id)}
            autoCapitalTotal={autoCapitalTotal}
            autoProfitTotal={autoProfitTotal}
            autoDeliveryReimbursement={autoDeliveryReimbursement}
            onBack={() => setSelectedFounder(null)}
            onEdit={() => { setEditingFounder(f); setEditForm({ name: f.name, alias: f.alias, email: f.email, phone: f.phone }); setEditOpen(true); }}
            onWithdraw={() => { setWithdrawFounderId(f.id); setWithdrawAmount(""); setWithdrawOpen(true); }}
            onPayFunding={handlePayOrderFunding}
            onDeleteTx={() => {}}
            payingEntry={payingEntry}
          />
        );
      })()}

      {!selectedFounder && founders.length === 0 ? (
        <div className="stat-card py-20 text-center">
          <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm mb-4">لا يوجد مؤسسون مسجّلون بعد</p>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" />{t.addFounder}</Button>
        </div>
      ) : !selectedFounder && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {founders.map((f, fIdx) => {
            const myOrderFunding = orderFundingByFounder[f.id] || [];
            const unpaidFunding = myOrderFunding.filter(e => !e.paid);
            const paidFunding = myOrderFunding.filter(e => e.paid);
            const totalOwed = unpaidFunding.reduce((s, e) => s + e.amount, 0);
            const totalPaidFunding = paidFunding.reduce((s, e) => s + e.amount, 0);
            const totalOrderFunding = myOrderFunding.reduce((s, e) => s + e.amount, 0);
            const capitalBalance = founderCapitalBalance(f.id);
            const paymentPct = totalOrderFunding > 0 ? (totalPaidFunding / totalOrderFunding) * 100 : 0;

            const avatarColors = [
              "from-blue-500 to-indigo-600", "from-emerald-500 to-teal-600",
              "from-orange-500 to-red-600", "from-purple-500 to-violet-600",
              "from-cyan-500 to-blue-600", "from-rose-500 to-pink-600",
            ];

            return (
              <div key={f.id} className="stat-card p-0 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => setSelectedFounder(f.id)}>
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
                        </div>
                      </div>
                    </div>
                    {unpaidFunding.length > 0 && (
                      <Badge variant="destructive" className="text-[10px] h-5">{unpaidFunding.length}</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className={`rounded-xl p-3 ${totalOwed > 0 ? "bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30" : "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30"}`}>
                      <p className="text-[10px] text-muted-foreground mb-1">عليه فلوس</p>
                      <p className={`text-sm font-bold ${totalOwed > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {totalOwed > 0 ? totalOwed.toLocaleString() : "✓ مدفوع"}
                      </p>
                    </div>
                    <div className={`rounded-xl p-3 ${capitalBalance > 0 ? "bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/30" : "bg-muted/50 border border-border/50"}`}>
                      <p className="text-[10px] text-muted-foreground mb-1">رأس مال متاح</p>
                      <p className={`text-sm font-bold ${capitalBalance > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground"}`}>
                        {capitalBalance > 0 ? capitalBalance.toLocaleString() : "—"}
                      </p>
                    </div>
                  </div>

                  {totalOrderFunding > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>نسبة السداد</span>
                        <span className="font-medium">{paymentPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${paymentPct >= 100 ? "bg-emerald-500" : paymentPct >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                          style={{ width: `${Math.min(paymentPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

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
            {withdrawMode === "fund_order" && (() => {
              const fId = withdrawFounderId;
              const fundingEntries = orderFundingByFounder[fId] || [];
              const unpaidEntries = fundingEntries.filter(e => !e.paid);

              return (
                <div className="space-y-1.5">
                  <Label className="text-xs">اختر الطلب المراد تمويله * <span className="text-muted-foreground">({unpaidEntries.length} طلب بانتظار التمويل)</span></Label>
                  {unpaidEntries.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                      لا توجد طلبات تحتاج تمويل من هذا المؤسس
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
                      {unpaidEntries.map((entry) => {
                        const remaining = Math.max(entry.amount - entry.paidAmount, 0);
                        return (
                          <button
                            key={entry.orderId}
                            type="button"
                            onClick={() => { setWithdrawOrderId(entry.orderId); setWithdrawAmount(String(remaining)); }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-xs text-start transition-colors hover:bg-muted/40 ${withdrawOrderId === entry.orderId ? "bg-primary/5 border-r-2 border-r-primary" : ""}`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-semibold">{entry.orderId}</span>
                                <span className="text-muted-foreground truncate">{entry.clientName || ""}</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                التكلفة: {entry.totalCost.toLocaleString()} · حصتك: {entry.amount.toLocaleString()} · دفعت: {entry.paidAmount.toLocaleString()}
                              </div>
                            </div>
                            <div className="text-left shrink-0 ms-2">
                              <span className="font-bold text-destructive">{remaining.toLocaleString()}</span>
                              <span className="text-[10px] text-muted-foreground block">متبقي</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {withdrawOrderId && orders[withdrawOrderId] && (
                    <p className="text-xs text-muted-foreground">
                      الطلب المحدد: <span className="font-medium text-foreground">{withdrawOrderId}</span>
                      {" · "}العميل: <span className="font-medium text-foreground">{(orders[withdrawOrderId] as any).client || "—"}</span>
                    </p>
                  )}
                </div>
              );
            })()}

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

      {/* ── Pay Funding Dialog (Cash vs Balance) ── */}
      <Dialog open={fundingDialog.open} onOpenChange={(o) => { if (!o) { setFundingDialog({ open: false, entry: null, available: 0 }); setUseBalance(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              تسديد حصة التمويل
            </DialogTitle>
          </DialogHeader>
          {fundingDialog.entry && (() => {
            const entry = fundingDialog.entry!;
            const required = entry.amount;
            const hasBalance = fundingDialog.available > 0;
            const walletUsed = (hasBalance && useBalance) ? Math.min(fundingDialog.available, required) : 0;
            const cashPortion = Math.max(required - walletUsed, 0);
            return (
              <div className="space-y-4 py-1">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className={`p-2.5 rounded-lg border ${hasBalance ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : "bg-muted/30 border-border"}`}>
                    <p className={`text-xs mb-0.5 ${hasBalance ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>رصيد متاح</p>
                    <p className={`font-bold ${hasBalance ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>{fundingDialog.available.toLocaleString()} {t.currency}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-0.5">الحصة المطلوبة</p>
                    <p className="font-bold">{required.toLocaleString()} {t.currency}</p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/30 border border-border p-2.5 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">الطلب</span><span className="font-mono">{entry.orderId}</span></div>
                  {entry.clientName && <div className="flex justify-between"><span className="text-muted-foreground">العميل</span><span>{entry.clientName}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">النسبة</span><span>{entry.percentage.toFixed(1)}%</span></div>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
                  {useBalance && walletUsed > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Wallet className="h-3.5 w-3.5" />من الرصيد
                      </span>
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        −{walletUsed.toLocaleString()} {t.currency}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-primary">
                      <Banknote className="h-3.5 w-3.5" />تمويل مالي (كاش)
                    </span>
                    <span className={`font-semibold ${cashPortion > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                      {cashPortion.toLocaleString()} {t.currency}
                    </span>
                  </div>
                  <div className="border-t border-border pt-1.5 flex justify-between text-xs text-muted-foreground">
                    <span>الإجمالي</span>
                    <span className="font-medium text-success">{required.toLocaleString()} {t.currency}</span>
                  </div>

                  <label className={`flex items-center gap-3 p-3 mt-1 rounded-lg border transition-colors ${!hasBalance ? "opacity-50 cursor-not-allowed bg-muted/10 border-border" : useBalance ? "cursor-pointer bg-primary/5 border-primary/30" : "cursor-pointer bg-muted/20 border-border"}`}>
                    <Checkbox
                      checked={useBalance}
                      disabled={!hasBalance}
                      onCheckedChange={(v) => setUseBalance(!!v)}
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium">السحب من الرصيد</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {!hasBalance
                          ? "لا يوجد رصيد متاح للسحب"
                          : useBalance
                            ? `سيُخصم ${walletUsed.toLocaleString()} ${t.currency} من رصيده${cashPortion > 0 ? ` — الباقي ${cashPortion.toLocaleString()} ${t.currency} تمويل مالي` : " — لا حاجة لتمويل إضافي"}`
                            : `رصيد متاح: ${fundingDialog.available.toLocaleString()} ${t.currency} — اضغط للخصم`
                        }
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setFundingDialog({ open: false, entry: null, available: 0 })}>إلغاء</Button>
            <Button
              size="sm"
              disabled={payingEntry !== null}
              onClick={handlePayWithBalance}
            >
              {payingEntry !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Banknote className="h-3.5 w-3.5 me-1" />تأكيد التسديد</>}
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
