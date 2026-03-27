import { useParams, useNavigate } from "react-router-dom";
import { useRef, useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { quickProfit } from "@/lib/orderProfit";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Truck, Upload, Printer, FileCheck, Loader2, Package, TrendingUp, Building2, Users2, CheckCircle2, Circle, DollarSign, Pencil, CalendarDays, User, Hash, StickyNote, ExternalLink, PackageCheck, Wallet, Banknote, AlertCircle, ClipboardList, ClipboardCheck, CreditCard, ChevronLeft, Plus, Trash2, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { logAudit } from "@/lib/auditLog";
import { useBusinessRules } from "@/lib/useBusinessRules";
import { printInvoice } from "@/lib/printInvoice";

type OrderLine = {
  id: number; orderId: string; materialCode: string; materialName: string;
  imageUrl: string; unit: string; quantity: number;
  sellingPrice: number; costPrice: number; lineTotal: number; lineCost: number;
};
type OrderDelivery = {
  id: string; orderId: string; client: string; clientId: string;
  date: string; scheduledDate: string; status: string;
  deliveredBy: string; deliveryFee: number; items: number; notes: string;
};
type FounderContrib = {
  founder: string; founderId?: string; amount: number; percentage: number;
  paid?: boolean; paidAt?: string;
};

type Order = {
  id: string; client: string; clientId: string; date: string; status: string;
  source: string; splitMode: string; deliveryFee: number;
  subscription: { type: string; value: number };
  cashback: { type: string; value: number };
  legacyLines: any[];
  deliveries: OrderDelivery[];
  founderContributions: FounderContrib[];
  totalSelling: string | number;
  totalCost: string | number;
  companyProfitPercentage?: number;
};

function toNum(v: any): number {
  if (!v) return 0;
  return typeof v === "number" ? v : Number(String(v).replace(/,/g, "")) || 0;
}

function parseJsonField(v: any): any[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return []; }
  }
  return [];
}

function mapOrder(raw: any): Order {
  return {
    id: raw.id,
    client: raw.client || "",
    clientId: raw.clientId || raw.client_id || "",
    date: raw.date || "",
    status: raw.status || "",
    source: raw.source || "—",
    splitMode: raw.splitMode || raw.split_mode || "—",
    deliveryFee: toNum(raw.deliveryFee ?? raw.delivery_fee),
    subscription: raw.subscription || { type: "none", value: 0 },
    cashback: raw.cashback || { type: "none", value: 0 },
    legacyLines: parseJsonField(raw.lines),
    deliveries: parseJsonField(raw.deliveries),
    founderContributions: parseJsonField(raw.founderContributions ?? raw.founder_contributions),
    totalSelling: raw.totalSelling ?? raw.total_selling ?? 0,
    totalCost: raw.totalCost ?? raw.total_cost ?? 0,
    companyProfitPercentage: raw.companyProfitPercentage ?? raw.company_profit_percentage,
  };
}

type ExtMaterial = { sku: string; name: string; imageUrl: string; unit: string; sellingPrice: number; costPrice: number };

type NewOrderItem = {
  materialCode: string; materialName: string; quantity: number;
  sellingPrice: number; costPrice: number; imageUrl: string; unit: string;
};

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { rules } = useBusinessRules();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState("invoice");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingFounder, setPayingFounder] = useState<string | null>(null);
  const [orderDeliveries, setOrderDeliveries] = useState<OrderDelivery[]>([]);
  const [founderBalances, setFounderBalances] = useState<Record<string, number>>({});
  const [orderInventory, setOrderInventory] = useState<any[]>([]);
  const [orderAudits, setOrderAudits] = useState<any[]>([]);
  const [orderCollections, setOrderCollections] = useState<any[]>([]);
  const [balanceDialog, setBalanceDialog] = useState<{ open: boolean; fp: any | null; available: number }>({ open: false, fp: null, available: 0 });
  const [useBalance, setUseBalance] = useState(false);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ status: "", date: "", source: "", deliveryFee: "" });
  const [editLines, setEditLines] = useState<Array<OrderLine & { _qty: string; _sell: string; _cost: string }>>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editNewItems, setEditNewItems] = useState<NewOrderItem[]>([]);
  const [editDeletedLineIds, setEditDeletedLineIds] = useState<number[]>([]);
  const [editMatSearch, setEditMatSearch] = useState("");
  const [extMaterials, setExtMaterials] = useState<ExtMaterial[]>([]);

  const loadOrder = () =>
    Promise.all([
      api.get<any[]>("/orders"),
      api.get<OrderLine[]>(`/orders/${id}/lines`).catch(() => []),
      api.get<{ products: any[] }>("/external-materials").catch(() => ({ products: [] })),
      api.get<OrderDelivery[]>(`/deliveries?orderId=${id}`).catch(() => []),
      api.get<{ founderId: string; founderName: string; balance: number }[]>("/founder-balances").catch(() => []),
      api.get<any[]>(`/client-inventory?sourceOrder=${id}`).catch(() => []),
      api.get<any[]>("/collections").catch(() => []),
      api.get<any[]>("/audits").catch(() => []),
    ]).then(([all, fetchedLines, extData, deliveries, balances, inventory, collections, audits]) => {
      const found = (all || []).find((o: any) => o.id === id);
      if (found) setOrder(mapOrder(found));
      const map: Record<string, ExtMaterial> = {};
      const allMats: ExtMaterial[] = [];
      (extData?.products || []).forEach((p: any) => {
        const key = p.sku || "";
        const mat: ExtMaterial = { sku: key, name: p.name || "", imageUrl: p.image_url || "", unit: p.unit || "unit", sellingPrice: p.price_retail || 0, costPrice: p.price_wholesale || 0 };
        if (key) map[key] = mat;
        allMats.push(mat);
      });
      setExtMaterials(allMats);
      const enriched = (fetchedLines || []).map((l: any) => ({
        ...l,
        materialName: l.materialName || map[l.materialCode]?.name || l.materialCode,
        imageUrl: l.imageUrl || map[l.materialCode]?.imageUrl || "",
      }));
      setLines(enriched);
      setOrderDeliveries(deliveries || []);
      setOrderInventory(inventory || []);
      const matchedAudits = (audits || []).filter((a: any) => {
        const aOrderId = a.orderId || a.order_id || "";
        return aOrderId === id;
      });
      setOrderAudits(matchedAudits);
      const orderCollections = (collections || []).filter((c: any) => {
        const cOrderId = c.order || c.orderId || c.order_id || "";
        return cOrderId === id;
      });
      setOrderCollections(orderCollections);
      const balMap: Record<string, number> = {};
      (balances || []).forEach(b => {
        if (b.founderName) balMap[b.founderName] = b.balance;
        if (b.founderId) balMap[b.founderId] = b.balance;
      });
      setFounderBalances(balMap);
    });

  useEffect(() => {
    loadOrder()
      .catch(() => toast.error("تعذّر تحميل بيانات الطلب"))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePayFounder = async (fc: FounderContrib) => {
    if (!order) return;
    setPayingFounder(fc.founder);
    try {
      const today = new Date().toISOString().split("T")[0];
      await api.post("/founder-transactions", {
        founderId: fc.founderId || undefined,
        founderName: fc.founder,
        type: "funding",
        amount: toNum(fc.amount),
        method: "transfer",
        orderId: order.id,
        notes: `حصة تمويل طلب ${order.id}`,
        date: today,
      });
      const updatedContribs = order.founderContributions.map(f =>
        f.founder === fc.founder ? { ...f, paid: true, paidAt: new Date().toISOString() } : f
      );
      const patchedOrder = await api.patch<any>(`/orders/${order.id}`, {
        founderContributions: updatedContribs,
      });
      setOrder(mapOrder(patchedOrder));
      await logAudit({
        entity: "order", entityId: order.id, entityName: `${order.id} - ${order.client}`,
        action: "update", snapshot: { founderPaid: fc.founder, amount: fc.amount },
        endpoint: `/orders/${order.id}`,
      });
      toast.success(`تم تسجيل دفع ${fc.founder}`);
    } catch (err: any) {
      toast.error(err?.message || "فشل تسجيل الدفع");
    } finally {
      setPayingFounder(null);
    }
  };

  const handlePayWithBalance = async () => {
    const { fp } = balanceDialog;
    if (!order || !fp) return;
    const required = toNum(fp.amount);
    const walletUsed = useBalance ? Math.min(balanceDialog.available, required) : 0;
    const cashPortion = required - walletUsed;
    setPayingFounder(fp.founder);
    try {
      const today = new Date().toISOString().split("T")[0];
      // 1. Deduct from wallet if any (capital_withdrawal)
      if (walletUsed > 0) {
        await api.post("/founder-transactions", {
          founderId: fp.founderId || undefined,
          founderName: fp.founder,
          type: "capital_withdrawal",
          amount: walletUsed,
          method: "balance",
          orderId: order.id,
          notes: `سحب من الرصيد لتمويل طلب ${order.id}`,
          date: today,
        });
      }
      // 2. Record funding transaction
      await api.post("/founder-transactions", {
        founderId: fp.founderId || undefined,
        founderName: fp.founder,
        type: "funding",
        amount: required,
        method: walletUsed > 0 && cashPortion > 0 ? "mixed" : walletUsed > 0 ? "balance" : "transfer",
        orderId: order.id,
        notes: walletUsed > 0 && cashPortion > 0
          ? `تمويل طلب ${order.id}: ${walletUsed.toLocaleString()} رصيد + ${cashPortion.toLocaleString()} تمويل مالي`
          : walletUsed > 0
          ? `تمويل طلب ${order.id} من الرصيد`
          : `تمويل طلب ${order.id}`,
        date: today,
      });
      // 3. Mark as paid in founderContributions
      const updatedContribs = order.founderContributions.map(f =>
        f.founder === fp.founder ? { ...f, paid: true, paidAt: new Date().toISOString() } : f
      );
      const patchedOrder = await api.patch<any>(`/orders/${order.id}`, { founderContributions: updatedContribs });
      setOrder(mapOrder(patchedOrder));
      if (walletUsed > 0) setFounderBalances(prev => ({ ...prev, [fp.founder]: (prev[fp.founder] || 0) - walletUsed }));
      setBalanceDialog({ open: false, fp: null, available: 0 });
      const msg = walletUsed > 0 && cashPortion > 0
        ? `تم تسجيل دفع ${fp.founder} — ${walletUsed.toLocaleString()} رصيد + ${cashPortion.toLocaleString()} تمويل مالي`
        : walletUsed > 0
        ? `تم تسجيل دفع ${fp.founder} — ${walletUsed.toLocaleString()} من الرصيد`
        : `تم تسجيل تمويل ${fp.founder} — ${required.toLocaleString()} تمويل مالي`;
      toast.success(msg);
    } catch (err: any) {
      toast.error(err?.message || "فشل تسجيل الدفع");
    } finally {
      setPayingFounder(null);
    }
  };

  const handleOpenEdit = () => {
    if (!order) return;
    setEditForm({
      status: order.status || "",
      date: order.date || "",
      source: order.source || "",
      deliveryFee: String(order.deliveryFee ?? ""),
    });
    setEditLines(lines.map(l => ({ ...l, _qty: String(l.quantity), _sell: String(l.sellingPrice), _cost: String(l.costPrice) })));
    setEditNewItems([]);
    setEditDeletedLineIds([]);
    setEditMatSearch("");
    setEditOpen(true);
  };

  const usedCodesInEdit = useMemo(() => {
    const existing = editLines.filter(l => !editDeletedLineIds.includes(l.id)).map(l => l.materialCode);
    const newCodes = editNewItems.map(i => i.materialCode);
    return [...existing, ...newCodes];
  }, [editLines, editDeletedLineIds, editNewItems]);

  const filteredEditMaterials = useMemo(() => extMaterials.filter(m => {
    if (usedCodesInEdit.includes(m.sku)) return false;
    if (!editMatSearch) return false;
    return m.name.toLowerCase().includes(editMatSearch.toLowerCase()) || m.sku.toLowerCase().includes(editMatSearch.toLowerCase());
  }), [editMatSearch, usedCodesInEdit, extMaterials]);

  const handleSaveEdit = async () => {
    if (!order) return;
    setEditSaving(true);
    try {
      const beforeOrder = { status: order.status, date: order.date, source: order.source, deliveryFee: order.deliveryFee };
      const beforeLines = lines.map(l => ({ id: l.id, quantity: l.quantity, sellingPrice: l.sellingPrice, costPrice: l.costPrice, lineTotal: l.lineTotal, lineCost: l.lineCost }));

      const orderPatch: Record<string, any> = {};
      if (editForm.status !== order.status) orderPatch.status = editForm.status;
      if (editForm.date !== order.date) orderPatch.date = editForm.date;
      if (editForm.source !== (order.source || "")) orderPatch.source = editForm.source;
      const newFee = Number(editForm.deliveryFee) || 0;
      if (newFee !== (order.deliveryFee || 0)) orderPatch.deliveryFee = newFee;

      let newTotalSelling = 0;
      let newTotalCost = 0;
      const linePatches: Promise<any>[] = [];

      const activeEditLines = editLines.filter(l => !editDeletedLineIds.includes(l.id));
      for (const el of activeEditLines) {
        const qty = Number(el._qty) || 0;
        const sell = Number(el._sell) || 0;
        const cost = Number(el._cost) || 0;
        newTotalSelling += qty * sell;
        newTotalCost += qty * cost;
        const orig = lines.find(l => l.id === el.id);
        if (orig && (orig.quantity !== qty || orig.sellingPrice !== sell || orig.costPrice !== cost)) {
          linePatches.push(api.patch(`/order-lines/${el.id}`, { quantity: qty, sellingPrice: sell, costPrice: cost }));
        }
      }

      for (const ni of editNewItems) {
        newTotalSelling += ni.sellingPrice * ni.quantity;
        newTotalCost += ni.costPrice * ni.quantity;
      }

      const deleteOps: Promise<any>[] = editDeletedLineIds.map(lid => api.delete(`/order-lines/${lid}`));

      let addOp: Promise<any> | null = null;
      if (editNewItems.length > 0) {
        addOp = api.post(`/orders/${order.id}/lines`, { items: editNewItems });
      }

      const linesChanged = linePatches.length > 0 || editDeletedLineIds.length > 0 || editNewItems.length > 0;

      if (linesChanged) {
        orderPatch.totalSelling = newTotalSelling;
        orderPatch.totalCost = newTotalCost;
        orderPatch.lines = activeEditLines.length + editNewItems.length;
      }

      await Promise.all([...linePatches, ...deleteOps]);
      if (addOp) await addOp;

      let refreshedOrder = order;
      if (Object.keys(orderPatch).length > 0) {
        const updated = await api.patch<any>(`/orders/${order.id}`, orderPatch);
        refreshedOrder = mapOrder(updated);
      }

      const changedFields = Object.keys(orderPatch);
      if (linePatches.length > 0) changedFields.push("تعديل سطور");
      if (editNewItems.length > 0) changedFields.push(`إضافة ${editNewItems.length} مادة`);
      if (editDeletedLineIds.length > 0) changedFields.push(`حذف ${editDeletedLineIds.length} مادة`);

      if (changedFields.length > 0) {
        await logAudit({
          entity: "order",
          entityId: order.id,
          entityName: `${order.id} - ${order.client}`,
          action: "update",
          snapshot: {
            before: { order: beforeOrder, lines: beforeLines },
            after: { order: orderPatch },
            changes: changedFields,
            orderId: order.id,
          },
          endpoint: `/orders/${order.id}`,
        });
        toast.success("تم حفظ التعديلات بنجاح");
      } else {
        toast.info("لا توجد تغييرات للحفظ");
      }

      setOrder(refreshedOrder);
      const freshLines = await api.get<any[]>(`/orders/${order.id}/lines`);
      setLines(freshLines || []);
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "فشل حفظ التعديلات");
    } finally {
      setEditSaving(false);
    }
  };

  type LineDeliveryInfo = {
    lineId: number;
    materialCode: string;
    ordered: number;
    delivered: number;
    remaining: number;
    pct: number;
    deliveryDetails: { deliveryId: string; qty: number; date: string; status: string }[];
  };

  const lineDeliveryMap = useMemo<Record<number, LineDeliveryInfo>>(() => {
    const map: Record<number, LineDeliveryInfo> = {};
    if (lines.length === 0) return map;

    lines.forEach(line => {
      map[line.id] = {
        lineId: line.id,
        materialCode: line.materialCode,
        ordered: line.quantity,
        delivered: 0,
        remaining: line.quantity,
        pct: 0,
        deliveryDetails: [],
      };
    });

    const confirmedDeliveries = orderDeliveries.filter(d =>
      d.status === "Delivered" || d.status === "In Transit" || d.status === "Pending"
    );

    for (const del of confirmedDeliveries) {
      let parsedNotes: any = null;
      try { parsedNotes = typeof del.notes === "string" ? JSON.parse(del.notes) : null; } catch {}

      if (parsedNotes && parsedNotes.items && Array.isArray(parsedNotes.items)) {
        for (const item of parsedNotes.items) {
          const lineId = Number(item.lineId);
          if (map[lineId]) {
            const qty = Number(item.qty) || 0;
            if (del.status === "Delivered") {
              map[lineId].delivered += qty;
            }
            map[lineId].deliveryDetails.push({
              deliveryId: del.id,
              qty,
              date: del.date || del.scheduledDate || "",
              status: del.status,
            });
          }
        }
      } else {
        const noteStr = typeof del.notes === "string" ? del.notes.trim() : "";
        const isFull = !noteStr || noteStr === "كامل" || noteStr.toLowerCase() === "full";
        if (isFull && del.status === "Delivered") {
          lines.forEach(line => {
            if (map[line.id]) {
              map[line.id].delivered = line.quantity;
              map[line.id].deliveryDetails.push({
                deliveryId: del.id,
                qty: line.quantity,
                date: del.date || del.scheduledDate || "",
                status: del.status,
              });
            }
          });
        }
      }
    }

    Object.values(map).forEach(info => {
      info.delivered = Math.min(info.delivered, info.ordered);
      info.remaining = Math.max(0, info.ordered - info.delivered);
      info.pct = info.ordered > 0 ? (info.delivered / info.ordered) * 100 : 0;
    });

    return map;
  }, [lines, orderDeliveries]);

  const orderDeliveryStats = useMemo(() => {
    const infos = Object.values(lineDeliveryMap);
    if (infos.length === 0) return { totalOrdered: 0, totalDelivered: 0, totalRemaining: 0, pct: 0, status: "none" as const };
    const totalOrdered = infos.reduce((s, i) => s + i.ordered, 0);
    const totalDelivered = infos.reduce((s, i) => s + i.delivered, 0);
    const totalRemaining = infos.reduce((s, i) => s + i.remaining, 0);
    const pct = totalOrdered > 0 ? (totalDelivered / totalOrdered) * 100 : 0;
    const status = pct >= 100 ? "full" as const : pct > 0 ? "partial" as const : "none" as const;
    return { totalOrdered, totalDelivered, totalRemaining, pct, status };
  }, [lineDeliveryMap]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes("pdf") && !file.type.includes("image")) { toast.error("PDF أو صورة فقط"); return; }
    setUploadedFile(file.name);
    toast.success(`${t.uploadInvoice}: ${file.name}`);
    e.target.value = "";
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/orders")}><ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t.back || "رجوع"}</Button>
        <div className="text-center py-16 text-muted-foreground">لم يتم العثور على الطلب</div>
      </div>
    );
  }

  const hasDetailedLines = lines.length > 0;
  const hasLegacyLines = !hasDetailedLines && order.legacyLines.length > 0 && typeof order.legacyLines[0] === "object";

  const linesTotal = hasDetailedLines
    ? lines.reduce((s, l) => s + toNum(l.lineTotal), 0)
    : hasLegacyLines
      ? order.legacyLines.reduce((s: number, l: any) => s + toNum(l.lineTotal), 0)
      : toNum(order.totalSelling);
  const costTotal = hasDetailedLines
    ? lines.reduce((s, l) => s + toNum(l.lineCost), 0)
    : hasLegacyLines
      ? order.legacyLines.reduce((s: number, l: any) => s + toNum(l.lineCost), 0)
      : toNum(order.totalCost);

  const subVal = order.subscription?.value || 0;
  const subscriptionAmt = order.subscription?.type === "percentage" ? linesTotal * subVal / 100 : subVal;
  const operatingRevenue = linesTotal + subscriptionAmt;

  const snappedPct = (order.founderContributions[0] as any)?.companyProfitPercentage;
  const companyPct = snappedPct ?? order.companyProfitPercentage ?? rules.companyProfitPercentage ?? 15;
  const qpFull = quickProfit({ orderTotal: operatingRevenue, totalCost: costTotal, paidValue: operatingRevenue, companyProfitPct: companyPct });
  const grossProfit = qpFull.expectedProfit;
  const companyProfit = Math.round(qpFull.companyProfit);
  const foundersProfit = Math.round(qpFull.foundersProfit);
  const isCollected = ["Delivered", "Completed", "مُسلَّم", "مكتمل"].includes(order.status);

  // Per-founder cost + profit share
  const totalPct = order.founderContributions.reduce((s, f) => s + (f.percentage || 0), 0) || 100;
  const isEqualSplit = !order.splitMode?.includes("مساهمة") && !order.splitMode?.toLowerCase().includes("contribution");
  const founderPayments = order.founderContributions.map(fc => {
    const profitShare = isEqualSplit
      ? (order.founderContributions.length > 0 ? foundersProfit / order.founderContributions.length : 0)
      : foundersProfit * (fc.percentage || 0) / totalPct;
    return { ...fc, profitShare };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/orders")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3"><h1 className="page-header">{order.id}</h1><StatusBadge status={order.status} /></div>
          <p className="page-description">
            <span className="cursor-pointer hover:text-primary" onClick={() => navigate(`/clients/${order.clientId}`)}>{order.client}</span>
            {" · "}{order.date}
            {order.source && order.source !== "—" ? ` · ${t.orderDetailsSource || "المصدر"}: ${order.source}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            {uploadedFile ? <FileCheck className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5 text-success" /> : <Upload className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />}
            {uploadedFile || t.uploadInvoice}
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            const invoiceLines = hasDetailedLines
              ? lines.map(l => [
                  l.imageUrl ? `<img class="item-img" src="${l.imageUrl}" alt="" />` : '',
                  l.materialName,
                  l.materialCode,
                  l.unit,
                  l.quantity,
                  toNum(l.sellingPrice).toLocaleString(),
                  toNum(l.lineTotal).toLocaleString(),
                ])
              : [];
            printInvoice({
              title: t.printInvoice, companyName: "DSB", subtitle: t.ordersTitle,
              clientName: order.client || order.clientId, invoiceNumber: order.id, date: order.date,
              columns: invoiceLines.length > 0
                ? ['', t.materialCol, t.codeCol, t.unitCol, t.qtyCol, `${t.sellingPerUnit} (${t.currency})`, `${t.lineTotalSelling} (${t.currency})`]
                : [t.totalAmount],
              rows: invoiceLines.length > 0 ? invoiceLines : [[`${linesTotal.toLocaleString()} ${t.currency}`]],
              totals: [
                { label: t.totalSelling, value: `${linesTotal.toLocaleString()} ${t.currency}` },
                { label: `${t.subscriptionLabel} (${subVal}%)`, value: `${subscriptionAmt.toLocaleString()} ${t.currency}` },
                { label: t.operatingRevenue, value: `${operatingRevenue.toLocaleString()} ${t.currency}` },
              ],
              footer: `${t.deliveryFeeDisplay}: ${order.deliveryFee} ${t.currency}`,
            });
          }}><Printer className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.print}</Button>
          <Button variant="outline" size="sm" onClick={handleOpenEdit} data-testid="button-edit-order">
            <Pencil className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />تعديل
          </Button>
          <Button size="sm" onClick={() => navigate(`/deliveries?new=${id}`)}><Truck className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.registerDelivery}</Button>
        </div>
      </div>

      {/* ── EDIT SHEET ─────────────────────────────────────────────────── */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="left" className="w-full sm:max-w-2xl p-0 flex flex-col" dir="rtl">
          <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
            <SheetTitle className="text-start">تعديل الطلب: {order.id}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Order metadata */}
              <div>
                <h3 className="text-sm font-semibold mb-4 text-muted-foreground">بيانات الطلب</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-status">الحالة</Label>
                    <Select value={editForm.status} onValueChange={(v) => setEditForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger id="edit-status" data-testid="select-edit-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">مسودة</SelectItem>
                        <SelectItem value="Processing">قيد المعالجة</SelectItem>
                        <SelectItem value="Ready for Delivery">جاهز للتسليم</SelectItem>
                        <SelectItem value="Partially Delivered">تسليم جزئي</SelectItem>
                        <SelectItem value="Delivered">تم التسليم</SelectItem>
                        <SelectItem value="Cancelled">ملغي</SelectItem>
                        <SelectItem value="Pending">معلق</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-date">التاريخ</Label>
                    <Input id="edit-date" type="date" value={editForm.date} onChange={(e) => setEditForm(f => ({ ...f, date: e.target.value }))} data-testid="input-edit-date" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-source">المصدر</Label>
                    <Input id="edit-source" value={editForm.source} onChange={(e) => setEditForm(f => ({ ...f, source: e.target.value }))} placeholder="مثال: واتساب، موقع..." data-testid="input-edit-source" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-fee">رسوم التوصيل</Label>
                    <Input id="edit-fee" type="number" min="0" value={editForm.deliveryFee} onChange={(e) => setEditForm(f => ({ ...f, deliveryFee: e.target.value }))} data-testid="input-edit-deliveryfee" />
                  </div>
                </div>
              </div>

              {/* Order lines */}
              <div>
                <h3 className="text-sm font-semibold mb-4 text-muted-foreground">سطور الطلب</h3>
                <div className="space-y-3">
                  {editLines.filter(l => !editDeletedLineIds.includes(l.id)).map((el, idx) => (
                    <div key={el.id} className="rounded-lg border border-border p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md border border-border overflow-hidden bg-muted/50 flex-shrink-0 flex items-center justify-center">
                          {el.imageUrl
                            ? <img src={el.imageUrl} alt={el.materialName} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            : <Package className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{el.materialName}</div>
                          <div className="text-xs text-muted-foreground font-mono">{el.materialCode} · {el.unit}</div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setEditDeletedLineIds(prev => [...prev, el.id])}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">الكمية</Label>
                          <Input type="number" min="0" value={el._qty} onChange={(e) => { const realIdx = editLines.findIndex(p => p.id === el.id); setEditLines(prev => prev.map((p, i) => i === realIdx ? { ...p, _qty: e.target.value } : p)); }} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">سعر البيع</Label>
                          <Input type="number" min="0" value={el._sell} onChange={(e) => { const realIdx = editLines.findIndex(p => p.id === el.id); setEditLines(prev => prev.map((p, i) => i === realIdx ? { ...p, _sell: e.target.value } : p)); }} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">سعر الشراء</Label>
                          <Input type="number" min="0" value={el._cost} onChange={(e) => { const realIdx = editLines.findIndex(p => p.id === el.id); setEditLines(prev => prev.map((p, i) => i === realIdx ? { ...p, _cost: e.target.value } : p)); }} className="h-8 text-sm" />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                        <span>إجمالي البيع: <span className="font-semibold text-foreground">{((Number(el._qty) || 0) * (Number(el._sell) || 0)).toLocaleString()}</span></span>
                        <span>إجمالي التكلفة: <span className="font-semibold text-foreground">{((Number(el._qty) || 0) * (Number(el._cost) || 0)).toLocaleString()}</span></span>
                      </div>
                    </div>
                  ))}

                  {/* New items added during edit */}
                  {editNewItems.map((ni, idx) => (
                    <div key={`new-${idx}`} className="rounded-lg border-2 border-dashed border-green-400/50 bg-green-50/30 dark:bg-green-950/10 p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md border border-border overflow-hidden bg-muted/50 flex-shrink-0 flex items-center justify-center">
                          {ni.imageUrl
                            ? <img src={ni.imageUrl} alt={ni.materialName} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            : <Package className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{ni.materialName} <span className="text-[10px] text-green-600 font-bold">(جديد)</span></div>
                          <div className="text-xs text-muted-foreground font-mono">{ni.materialCode} · {ni.unit}</div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setEditNewItems(prev => prev.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">الكمية</Label>
                          <Input type="number" min="1" value={ni.quantity} onChange={(e) => setEditNewItems(prev => prev.map((p, i) => i === idx ? { ...p, quantity: Number(e.target.value) || 1 } : p))} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">سعر البيع</Label>
                          <Input type="number" min="0" value={ni.sellingPrice} onChange={(e) => setEditNewItems(prev => prev.map((p, i) => i === idx ? { ...p, sellingPrice: Number(e.target.value) || 0 } : p))} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">سعر الشراء</Label>
                          <Input type="number" min="0" value={ni.costPrice} onChange={(e) => setEditNewItems(prev => prev.map((p, i) => i === idx ? { ...p, costPrice: Number(e.target.value) || 0 } : p))} className="h-8 text-sm" />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                        <span>إجمالي البيع: <span className="font-semibold text-foreground">{(ni.sellingPrice * ni.quantity).toLocaleString()}</span></span>
                        <span>إجمالي التكلفة: <span className="font-semibold text-foreground">{(ni.costPrice * ni.quantity).toLocaleString()}</span></span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add material search */}
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <Plus className="h-4 w-4" /> إضافة مادة جديدة
                  </h4>
                  <div className="relative">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input className="h-9 ps-9 text-sm" placeholder="ابحث عن مادة بالاسم أو الكود..." value={editMatSearch} onChange={(e) => setEditMatSearch(e.target.value)} />
                  </div>
                  {editMatSearch && filteredEditMaterials.length > 0 && (
                    <div className="rounded-lg border border-border max-h-48 overflow-y-auto">
                      {filteredEditMaterials.slice(0, 15).map(mat => (
                        <button key={mat.sku} className="w-full flex items-center gap-3 px-3 py-2 text-start hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0" onClick={() => {
                          setEditNewItems(prev => [...prev, { materialCode: mat.sku, materialName: mat.name, quantity: 1, sellingPrice: mat.sellingPrice, costPrice: mat.costPrice, imageUrl: mat.imageUrl, unit: mat.unit }]);
                          setEditMatSearch("");
                        }}>
                          <div className="w-8 h-8 rounded border border-border overflow-hidden bg-muted/50 flex-shrink-0 flex items-center justify-center">
                            {mat.imageUrl ? <img src={mat.imageUrl} alt={mat.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <Package className="h-3 w-3 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{mat.name}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">{mat.sku} · {mat.unit}</div>
                          </div>
                          <div className="text-[11px] text-muted-foreground text-left whitespace-nowrap">
                            <div>بيع: {mat.sellingPrice}</div>
                            <div>شراء: {mat.costPrice}</div>
                          </div>
                          <Plus className="h-4 w-4 text-green-600 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                  {editMatSearch && filteredEditMaterials.length === 0 && (
                    <div className="text-center py-2 text-muted-foreground text-xs">لا توجد نتائج</div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
          <div className="px-6 py-4 border-t border-border flex justify-end gap-3 shrink-0">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving} data-testid="button-edit-cancel">إلغاء</Button>
            <Button onClick={handleSaveEdit} disabled={editSaving} data-testid="button-edit-save">
              {editSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5" />جاري الحفظ...</> : "حفظ التعديلات"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── ORDER LIFECYCLE PIPELINE ─────────────────────────────────── */}
      {(() => {
        const confirmedDeliveries = orderDeliveries.filter(d => d.status === "Delivered");
        const pendingDeliveries = orderDeliveries.filter(d => d.status !== "Delivered");
        const hasDeliveries = orderDeliveries.length > 0;
        const allDelivered = confirmedDeliveries.length > 0 && pendingDeliveries.length === 0 && orderDeliveryStats.pct >= 100;
        const hasInventory = orderInventory.length > 0;
        const hasCompletedAudit = orderAudits.some((a: any) => a.status === "Completed");
        const hasCollections = orderCollections.length > 0;
        const totalCollected = orderCollections.reduce((s: number, c: any) => s + Number(c.paid ?? c.paidAmount ?? 0), 0);
        const totalDue = orderCollections.reduce((s: number, c: any) => s + Number(c.total ?? c.totalAmount ?? 0), 0);
        const fullyCollected = hasCollections && totalDue > 0 && totalCollected >= totalDue;

        const steps = [
          {
            key: "processing", label: "معالجة الطلب", icon: ClipboardList,
            done: true,
            active: !hasDeliveries,
            detail: order.date,
          },
          {
            key: "delivery", label: "التوصيل", icon: Truck,
            done: allDelivered,
            active: hasDeliveries && !allDelivered,
            detail: hasDeliveries
              ? `${confirmedDeliveries.length} مؤكدة${pendingDeliveries.length > 0 ? ` · ${pendingDeliveries.length} معلقة` : ""}`
              : "لم يبدأ",
            items: orderDeliveries.slice(0, 3).map(d => ({
              id: d.id, date: d.scheduledDate || d.date, status: d.status,
              onClick: () => setActiveTab("deliveries"),
            })),
          },
          {
            key: "inventory", label: "الجرد", icon: Package,
            done: hasCompletedAudit,
            active: hasInventory && !hasCompletedAudit,
            detail: hasCompletedAudit
              ? `${orderAudits.filter((a: any) => a.status === "Completed").length} جرد مكتمل`
              : hasInventory ? "في انتظار الجرد" : "لم يتم بعد",
            items: orderInventory.slice(0, 5).map((inv: any) => ({
              id: inv.id, name: inv.material || inv.code, date: inv.deliveryDate, remaining: inv.remaining, delivered: inv.delivered,
            })),
          },
          {
            key: "collection", label: "التحصيل", icon: CreditCard,
            done: fullyCollected,
            active: hasCollections && !fullyCollected,
            detail: hasCollections
              ? `${totalCollected.toLocaleString()} / ${totalDue.toLocaleString()}`
              : "لم يبدأ",
            items: orderCollections.map((c: any) => ({
              id: c.id, date: c.invoiceDate || c.invoice_date || "", paid: Number(c.paid ?? c.paidAmount ?? 0), total: Number(c.total ?? c.totalAmount ?? 0), status: c.status,
            })),
          },
        ];

        return (
          <div className="stat-card p-4 overflow-hidden">
            <div className="flex items-center gap-0">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isLast = idx === steps.length - 1;
                const colorClass = step.done
                  ? "bg-green-500 text-white border-green-500"
                  : step.active
                    ? "bg-primary text-white border-primary animate-pulse"
                    : "bg-muted text-muted-foreground border-border";
                const lineColor = step.done ? "bg-green-400" : "bg-border";
                return (
                  <div key={step.key} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center gap-1.5 min-w-0 flex-shrink-0">
                      <div className={`h-10 w-10 rounded-full border-2 flex items-center justify-center transition-all ${colorClass}`}>
                        {step.done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </div>
                      <span className={`text-[11px] font-medium text-center leading-tight ${step.done ? "text-green-600" : step.active ? "text-primary" : "text-muted-foreground"}`}>{step.label}</span>
                      <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[100px] truncate">{step.detail}</span>
                    </div>
                    {!isLast && <div className={`h-0.5 flex-1 mx-2 mt-[-24px] rounded-full ${lineColor}`} />}
                  </div>
                );
              })}
            </div>

            {/* Expandable detail rows */}
            <div className="mt-4 space-y-2">
              {/* Delivery records */}
              {orderDeliveries.length > 0 && (
                <div className="rounded-lg border bg-muted/20 overflow-hidden">
                  <div className="px-3 py-2 bg-muted/40 border-b flex items-center gap-2 text-xs font-medium">
                    <Truck className="h-3.5 w-3.5 text-primary" /> التوصيلات ({orderDeliveries.length})
                  </div>
                  <div className="divide-y">
                    {orderDeliveries.map(d => (
                      <button key={d.id} className="flex items-center gap-3 px-3 py-2 text-xs w-full text-start hover:bg-muted/30 transition-colors" onClick={() => setActiveTab("deliveries")}>
                        <span className="font-mono text-muted-foreground">{d.id}</span>
                        <StatusBadge status={d.status} />
                        <span className="text-muted-foreground">{d.scheduledDate || d.date}</span>
                        <span className="text-muted-foreground mr-auto">{d.deliveredBy}</span>
                        <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Inventory records */}
              {orderInventory.length > 0 && (
                <div className="rounded-lg border bg-muted/20 overflow-hidden">
                  <div className="px-3 py-2 bg-muted/40 border-b flex items-center gap-2 text-xs font-medium">
                    <Package className="h-3.5 w-3.5 text-emerald-600" /> مخزون العميل ({orderInventory.length})
                  </div>
                  <div className="divide-y">
                    {orderInventory.map((inv: any) => (
                      <button key={inv.id} className="flex items-center gap-3 px-3 py-2 text-xs w-full text-start hover:bg-muted/30 transition-colors" onClick={() => navigate(`/inventory?sourceOrder=${order.id}`)}>
                        <span className="font-medium">{inv.material || inv.code}</span>
                        <span className="text-muted-foreground">{inv.deliveryDate}</span>
                        <span className="text-primary font-medium">متبقي: {inv.remaining}/{inv.delivered}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${inv.status === "Depleted" ? "bg-red-100 text-red-700" : inv.status === "Low Stock" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>{inv.status === "Depleted" ? "نفد" : inv.status === "Low Stock" ? "منخفض" : "متوفر"}</span>
                        <span className="mr-auto" />
                        <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit records */}
              {(() => {
                const completedAudits = orderAudits.filter((a: any) => a.status === "Completed");
                const pendingAudits = orderAudits.filter((a: any) => a.status !== "Completed");
                const hasAnyAudit = orderAudits.length > 0;

                return (
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: hasAnyAudit ? (completedAudits.length > 0 ? 'var(--color-green-200)' : 'var(--color-blue-200)') : 'var(--color-border)' }}>
                    <div className={`px-3 py-2 border-b flex items-center gap-2 text-xs font-medium ${completedAudits.length > 0 ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : hasAnyAudit ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : 'bg-muted/40 border-border'}`}>
                      <ClipboardCheck className={`h-3.5 w-3.5 ${completedAudits.length > 0 ? 'text-green-600' : hasAnyAudit ? 'text-blue-600' : 'text-muted-foreground'}`} />
                      سجلات الجرد
                      {hasAnyAudit && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${completedAudits.length > 0 ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'}`}>
                          {completedAudits.length > 0 ? `${completedAudits.length} مكتمل` : `${pendingAudits.length} قيد التنفيذ`}
                        </span>
                      )}
                    </div>
                    {hasAnyAudit ? (
                      <div className="divide-y">
                        {orderAudits.map((a: any) => (
                          <button key={a.id} className="flex items-center gap-3 px-3 py-2.5 text-xs w-full text-start hover:bg-muted/30 transition-colors" onClick={() => navigate("/audits")}>
                            <span className="font-mono text-muted-foreground">{a.id}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${a.status === "Completed" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : a.status === "Discrepancy" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" : a.status === "In Progress" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}>
                              {a.status === "Completed" ? "مكتمل" : a.status === "Discrepancy" ? "تباين" : a.status === "In Progress" ? "جاري" : "مجدول"}
                            </span>
                            <span className="text-muted-foreground">{a.date || a.createdAt || a.created_at || ""}</span>
                            <span className="text-muted-foreground">{a.auditor || ""}</span>
                            <span className="mr-auto" />
                            <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-3 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">لم يتم إجراء جرد لهذا الطلب بعد</span>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => navigate("/audits")}>
                          <ClipboardCheck className="h-3 w-3" /> جدولة جرد
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Collection records */}
              {orderCollections.length > 0 && (
                <div className="rounded-lg border bg-muted/20 overflow-hidden">
                  <div className="px-3 py-2 bg-muted/40 border-b flex items-center gap-2 text-xs font-medium">
                    <CreditCard className="h-3.5 w-3.5 text-blue-600" /> سجلات التحصيل ({orderCollections.length})
                  </div>
                  <div className="divide-y">
                    {orderCollections.map((c: any) => {
                      const paid = Number(c.paid ?? c.paidAmount ?? 0);
                      const total = Number(c.total ?? c.totalAmount ?? 0);
                      const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                      return (
                        <button key={c.id} className="flex items-center gap-3 px-3 py-2 text-xs w-full text-start hover:bg-muted/30 transition-colors" onClick={() => navigate(`/collections?orderId=${order.id}`)}>
                          <span className="font-mono text-muted-foreground">{c.id}</span>
                          <StatusBadge status={c.status} />
                          <span className="text-muted-foreground">{c.invoiceDate || c.invoice_date || ""}</span>
                          <span className="text-primary font-medium">{paid.toLocaleString()} / {total.toLocaleString()}</span>
                          <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden"><div className={`h-full rounded-full ${pct >= 100 ? "bg-green-500" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div>
                          <span className="mr-auto" />
                          <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="invoice">الفاتورة</TabsTrigger>
          <TabsTrigger value="financials">{t.financials}</TabsTrigger>
          <TabsTrigger value="deliveries">{t.deliveriesTab}</TabsTrigger>
          <TabsTrigger value="funding">{t.fundingTab}</TabsTrigger>
        </TabsList>

        {/* ── MINI INVOICE TAB ─────────────────────────────────────────── */}
        <TabsContent value="invoice">
          <div className="stat-card space-y-0 overflow-hidden">
            {/* Invoice header */}
            <div className="flex items-start justify-between p-6 border-b border-border bg-muted/30">
              <div>
                <div className="text-2xl font-bold text-primary">DSB</div>
                <div className="text-xs text-muted-foreground mt-0.5">Dental Supply Business</div>
              </div>
              <div className="text-end space-y-1">
                <div className="font-mono text-lg font-bold">{order.id}</div>
                <div className="text-sm text-muted-foreground">{order.date}</div>
                <StatusBadge status={order.status} />
              </div>
            </div>

            {/* Client info */}
            <div className="px-6 py-4 border-b border-border/50 bg-muted/10">
              <div className="text-xs text-muted-foreground mb-0.5">العميل</div>
              <div
                className="font-semibold cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate(`/clients/${order.clientId}`)}
              >
                {order.client}
              </div>
              {order.splitMode && order.splitMode !== "—" && (
                <div className="text-xs text-muted-foreground mt-0.5">نمط التقسيم: {order.splitMode}</div>
              )}
            </div>

            {/* Delivery Progress Banner */}
            {hasDetailedLines && orderDeliveries.length > 0 && (
              <div className={`px-6 py-3 border-b border-border flex items-center justify-between gap-4 ${
                orderDeliveryStats.status === "full" ? "bg-emerald-50 dark:bg-emerald-950/20" :
                orderDeliveryStats.status === "partial" ? "bg-amber-50 dark:bg-amber-950/20" :
                "bg-muted/30"
              }`}>
                <div className="flex items-center gap-2.5">
                  <Truck className={`h-4 w-4 ${
                    orderDeliveryStats.status === "full" ? "text-emerald-600" :
                    orderDeliveryStats.status === "partial" ? "text-amber-600" : "text-muted-foreground"
                  }`} />
                  <div>
                    <span className={`text-sm font-semibold ${
                      orderDeliveryStats.status === "full" ? "text-emerald-700 dark:text-emerald-400" :
                      orderDeliveryStats.status === "partial" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
                    }`}>
                      {orderDeliveryStats.status === "full" ? "تم تسليم الطلب بالكامل" :
                       orderDeliveryStats.status === "partial" ? "تسليم جزئي — بعض المواد لم تُسلَّم بعد" :
                       "لم يتم التسليم بعد"}
                    </span>
                    <span className="text-xs text-muted-foreground mr-2">
                      ({orderDeliveryStats.totalDelivered} / {orderDeliveryStats.totalOrdered} وحدة)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        orderDeliveryStats.pct >= 100 ? "bg-emerald-500" :
                        orderDeliveryStats.pct > 0 ? "bg-amber-500" : "bg-muted-foreground"
                      }`}
                      style={{ width: `${Math.min(orderDeliveryStats.pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold min-w-[36px] text-end">{orderDeliveryStats.pct.toFixed(0)}%</span>
                </div>
              </div>
            )}

            {/* Items */}
            {hasDetailedLines ? (
              <div className="divide-y divide-border/50">
                {lines.map((line) => {
                  const delInfo = lineDeliveryMap[line.id];
                  const hasDelivery = delInfo && delInfo.deliveryDetails.length > 0;
                  const isFullyDelivered = delInfo && delInfo.pct >= 100;
                  const isPartial = delInfo && delInfo.pct > 0 && delInfo.pct < 100;

                  return (
                  <div key={line.id} className={`px-6 py-4 hover:bg-muted/20 transition-colors ${isFullyDelivered ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""}`}>
                    <div className="flex items-center gap-4">
                    {/* Product image */}
                    <div className="w-14 h-14 rounded-lg border border-border overflow-hidden bg-muted/50 flex-shrink-0 flex items-center justify-center relative">
                      {line.imageUrl ? (
                        <img
                          src={line.imageUrl}
                          alt={line.materialName}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }}
                        />
                      ) : null}
                      <Package className={`h-6 w-6 text-muted-foreground ${line.imageUrl ? "hidden" : ""}`} />
                      {isFullyDelivered && (
                        <div className="absolute -top-1 -end-1 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Name + code */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{line.materialName}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{line.materialCode}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{line.unit}</div>
                    </div>

                    {/* Quantity badge */}
                    <div className="text-center flex-shrink-0">
                      <div className="text-xs text-muted-foreground">الكمية</div>
                      <div className="text-lg font-bold text-primary">×{line.quantity}</div>
                    </div>

                    {/* Unit sell price */}
                    <div className="text-center flex-shrink-0 hidden sm:block">
                      <div className="text-xs text-muted-foreground">سعر البيع</div>
                      <div className="font-medium text-sm">{toNum(line.sellingPrice).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{t.currency}</div>
                    </div>

                    {/* Unit cost price */}
                    <div className="text-center flex-shrink-0 hidden md:block">
                      <div className="text-xs text-muted-foreground">سعر الشراء</div>
                      <div className="font-medium text-sm text-muted-foreground">{toNum(line.costPrice).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{t.currency}</div>
                    </div>

                    {/* Line profit */}
                    <div className="text-center flex-shrink-0 hidden md:block">
                      <div className="text-xs text-muted-foreground">الربح</div>
                      <div className={`font-medium text-sm ${toNum(line.lineTotal) - toNum(line.lineCost) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                        {(toNum(line.lineTotal) - toNum(line.lineCost)).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">{t.currency}</div>
                    </div>

                    {/* Line total */}
                    <div className="text-end flex-shrink-0">
                      <div className="text-xs text-muted-foreground">الإجمالي</div>
                      <div className="font-bold">{toNum(line.lineTotal).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{t.currency}</div>
                    </div>
                    </div>

                    {/* Delivery status per line */}
                    {hasDelivery && (
                      <div className="mt-2.5 mr-[4.5rem]">
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Truck className={`h-3 w-3 ${isFullyDelivered ? "text-emerald-600" : isPartial ? "text-amber-600" : "text-muted-foreground"}`} />
                            <span className={`font-semibold ${isFullyDelivered ? "text-emerald-600 dark:text-emerald-400" : isPartial ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                              {isFullyDelivered ? "تم التسليم بالكامل" : isPartial ? `تسليم جزئي: ${delInfo.delivered} / ${delInfo.ordered}` : "في الانتظار"}
                            </span>
                          </div>
                          {isPartial && (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 text-amber-500" />
                              باقي {delInfo.remaining} {line.unit}
                            </span>
                          )}
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isFullyDelivered ? "bg-emerald-500" : "bg-amber-500"}`}
                              style={{ width: `${Math.min(delInfo.pct, 100)}%` }}
                            />
                          </div>
                        </div>
                        {delInfo.deliveryDetails.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {delInfo.deliveryDetails.map((dd, idx) => (
                              <button
                                key={idx}
                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                                  dd.status === "Delivered"
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                                    : dd.status === "In Transit"
                                    ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400"
                                    : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"
                                }`}
                                onClick={() => navigate(`/deliveries?orderId=${id}`)}
                              >
                                <Truck className="h-2.5 w-2.5" />
                                {dd.deliveryId} · {dd.qty} {line.unit}
                                {dd.status === "Delivered" && <CheckCircle2 className="h-2.5 w-2.5" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            ) : hasLegacyLines ? (
              <div className="divide-y divide-border/50">
                {order.legacyLines.map((line: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-4 px-6 py-4">
                    <div className="w-14 h-14 rounded-lg border border-border bg-muted/50 flex-shrink-0 flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{line.material || line.materialName || "—"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{line.code}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">الكمية</div>
                      <div className="text-lg font-bold text-primary">×{line.qty || line.quantity || 1}</div>
                    </div>
                    <div className="text-end">
                      <div className="font-bold">{toNum(line.lineTotal).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{t.currency}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 px-6 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">لا توجد تفاصيل مواد محفوظة لهذا الطلب</p>
                <p className="text-xs mt-1 mb-4">الطلبات المنشأة من الإصدار الجديد ستحفظ تفاصيل المواد تلقائياً</p>
                {toNum(order.totalSelling) > 0 && (
                  <div className="inline-block bg-muted/60 rounded-lg px-6 py-3 text-start">
                    <div className="text-xs text-muted-foreground mb-1">الإجمالي المسجّل</div>
                    <div className="text-xl font-bold text-primary">{toNum(order.totalSelling).toLocaleString()} {t.currency}</div>
                    {order.deliveryFee > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">+ {order.deliveryFee.toLocaleString()} {t.currency} رسوم توصيل</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Invoice totals */}
            {(hasDetailedLines || hasLegacyLines) && (
              <div className="px-6 py-4 border-t border-border bg-muted/20 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المجموع</span>
                  <span className="font-medium">{linesTotal.toLocaleString()} {t.currency}</span>
                </div>
                {order.deliveryFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.deliveryFeeDisplay}</span>
                    <span className="font-medium">{order.deliveryFee.toLocaleString()} {t.currency}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-border pt-2 mt-1">
                  <span>الإجمالي النهائي</span>
                  <span className="text-primary">{(linesTotal + (order.deliveryFee || 0)).toLocaleString()} {t.currency}</span>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── FINANCIALS TAB ───────────────────────────────────────────── */}
        <TabsContent value="financials">
          <div className="space-y-4">
            {/* Revenue + Cost summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="stat-card space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />{t.expectedRevenue}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">إجمالي المبيعات</span><span className="font-medium">{linesTotal.toLocaleString()} {t.currency}</span></div>
                  {subVal > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t.subscriptionLabel} ({subVal}%)</span><span className="font-medium">{subscriptionAmt.toLocaleString()} {t.currency}</span></div>}
                  <div className="border-t border-border pt-2 flex justify-between font-semibold"><span>الإيراد التشغيلي</span><span>{operatingRevenue.toLocaleString()} {t.currency}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>إجمالي التكلفة</span><span className="text-destructive">- {costTotal.toLocaleString()} {t.currency}</span></div>
                  <div className="flex justify-between font-bold text-base"><span>الربح الإجمالي</span><span className={grossProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>{grossProfit.toLocaleString()} {t.currency}</span></div>
                </div>
              </div>

              {/* Profit distribution breakdown */}
              <div className="stat-card space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" />توزيع الربح</h3>
                {grossProfit > 0 ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-muted-foreground"><Building2 className="h-3.5 w-3.5" />نصيب الشركة ({companyPct}%)</span>
                      <span className="font-semibold text-primary">{companyProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t.currency}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-muted-foreground"><Users2 className="h-3.5 w-3.5" />نصيب المؤسسين ({(100 - companyPct).toFixed(0)}%)</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{foundersProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t.currency}</span>
                    </div>
                    <div className="border-t border-border pt-2 text-xs text-muted-foreground">
                      {order.companyProfitPercentage != null ? "النسبة محفوظة من وقت إنشاء الطلب" : "النسبة من الإعدادات الحالية"}
                    </div>
                    {!isCollected && (
                      <div className="mt-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-2 text-xs text-amber-700 dark:text-amber-400">
                        ⚠️ توزيع الأرباح متاح فقط بعد التحصيل من العميل
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">لا يوجد ربح محسوب لهذا الطلب بعد</p>
                )}
              </div>
            </div>

            {/* Per-founder profit share (shown after collection) */}
            {founderPayments.length > 0 && grossProfit > 0 && (
              <div className="stat-card space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Users2 className="h-4 w-4 text-primary" />حصة كل مؤسس من الأرباح</h3>
                {isCollected ? (
                  <div className="space-y-2">
                    {founderPayments.map(fp => (
                      <div key={fp.founder} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 text-sm">
                        <span className="font-medium">{fp.founder}</span>
                        <div className="flex items-center gap-4 text-end">
                          <div>
                            <div className="text-xs text-muted-foreground">نسبته</div>
                            <div className="font-medium">{isEqualSplit ? (100 / founderPayments.length).toFixed(1) : (fp.percentage || 0).toFixed(1)}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">حصته من الربح</div>
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">{fp.profitShare.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t.currency}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    <Users2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>تفاصيل حصص الربح ستظهر بعد اكتمال التحصيل</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── DELIVERIES TAB ───────────────────────────────────────────── */}
        <TabsContent value="deliveries">
          <div className="space-y-4">
            {/* Header bar */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {orderDeliveries.length > 0
                  ? `${orderDeliveries.length} تسليم${orderDeliveries.length > 1 ? "ات" : ""} مسجّلة`
                  : "لا توجد تسليمات مسجّلة لهذا الطلب"}
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate(`/deliveries?new=${id}`)} data-testid="button-go-deliveries">
                <ExternalLink className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
                إدارة التوصيلات
              </Button>
            </div>

            {orderDeliveries.length === 0 ? (
              <div className="stat-card flex flex-col items-center justify-center py-14 gap-3 text-center">
                <Truck className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">لا توجد توصيلات مرتبطة بهذا الطلب</p>
                <Button size="sm" onClick={() => navigate(`/deliveries?new=${id}`)} data-testid="button-add-delivery">
                  <Truck className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
                  تسجيل توصيلة جديدة
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {orderDeliveries.map((del) => (
                  <div
                    key={del.id}
                    className="stat-card p-0 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/deliveries?new=${id}`)}
                    data-testid={`card-delivery-${del.id}`}
                  >
                    {/* Card header */}
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                          <Truck className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <span className="font-mono text-sm font-bold text-primary" data-testid={`text-delivery-id-${del.id}`}>{del.id}</span>
                        </div>
                      </div>
                      <StatusBadge status={del.status} />
                    </div>

                    {/* Card body — 2-col grid */}
                    <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {/* Who delivered */}
                      <div className="flex items-start gap-2.5">
                        <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">المندوب / المسلِّم</div>
                          <div className="text-sm font-semibold" data-testid={`text-deliveredby-${del.id}`}>
                            {del.deliveredBy || "—"}
                          </div>
                        </div>
                      </div>

                      {/* Actual delivery date */}
                      <div className="flex items-start gap-2.5">
                        <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">تاريخ التسليم الفعلي</div>
                          <div className="text-sm font-semibold" data-testid={`text-date-${del.id}`}>
                            {del.date || "—"}
                          </div>
                        </div>
                      </div>

                      {/* Scheduled date */}
                      <div className="flex items-start gap-2.5">
                        <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">الموعد المجدوَل</div>
                          <div className="text-sm font-semibold" data-testid={`text-scheduleddate-${del.id}`}>
                            {del.scheduledDate || "—"}
                          </div>
                        </div>
                      </div>

                      {/* Items count */}
                      <div className="flex items-start gap-2.5">
                        <PackageCheck className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">عدد العناصر</div>
                          <div className="text-sm font-semibold" data-testid={`text-items-${del.id}`}>
                            {del.items ?? 0} صنف
                          </div>
                        </div>
                      </div>

                      {/* Delivery fee */}
                      <div className="flex items-start gap-2.5">
                        <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">رسوم التوصيل</div>
                          <div className="text-sm font-semibold" data-testid={`text-deliveryfee-${del.id}`}>
                            {toNum(del.deliveryFee).toLocaleString()} {t.currency}
                          </div>
                        </div>
                      </div>

                      {/* Delivery number / tracking */}
                      <div className="flex items-start gap-2.5">
                        <Hash className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">رقم التتبع</div>
                          <div className="text-sm font-mono text-muted-foreground" data-testid={`text-tracking-${del.id}`}>
                            {del.id}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Partial delivery items or notes */}
                    {del.notes && (() => {
                      let parsed: any = null;
                      try { parsed = typeof del.notes === "string" ? JSON.parse(del.notes) : null; } catch {}
                      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
                        return (
                          <div className="px-5 py-3 border-t border-border/50 bg-muted/10">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                              <Package className="h-3.5 w-3.5" />
                              <span className="font-medium">المواد المسلّمة ({parsed.type || "جزئي"})</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {parsed.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 bg-background rounded-lg border border-border/50 px-3 py-2">
                                  <PackageCheck className={`h-3.5 w-3.5 flex-shrink-0 ${del.status === "Delivered" ? "text-emerald-600" : "text-amber-500"}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{item.materialName}</p>
                                    <p className="text-[10px] text-muted-foreground">{item.materialCode}</p>
                                  </div>
                                  <span className="text-xs font-bold text-primary">{item.qty} {item.unit}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      if (del.notes && !parsed) {
                        return (
                          <div className="flex items-start gap-2.5 px-5 py-3 border-t border-border/50 bg-muted/10">
                            <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-xs text-muted-foreground mb-0.5">نوع التسليم</div>
                              <div className="text-sm text-foreground" data-testid={`text-notes-${del.id}`}>{del.notes}</div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── FUNDING TAB ──────────────────────────────────────────────── */}
        <TabsContent value="funding">
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Users2 className="h-4 w-4 text-primary" />تمويل التكلفة قبل الشراء ({order.splitMode})</h3>
                <span className="text-xs text-muted-foreground">إجمالي التكلفة: <span className="font-semibold text-foreground">{costTotal.toLocaleString()} {t.currency}</span></span>
              </div>

              {founderPayments.length > 0 ? (
                <div className="space-y-3">
                  {/* Progress bar */}
                  {(() => {
                    const paidCount = founderPayments.filter(f => f.paid).length;
                    const paidPct = founderPayments.length > 0 ? (paidCount / founderPayments.length) * 100 : 0;
                    const paidAmount = founderPayments.filter(f => f.paid).reduce((s, f) => s + toNum(f.amount), 0);
                    return (
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>تم الدفع: {paidCount}/{founderPayments.length} مؤسس</span>
                          <span>{paidAmount.toLocaleString()} / {costTotal.toLocaleString()} {t.currency}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${paidPct}%` }} />
                        </div>
                      </div>
                    );
                  })()}

                  {founderPayments.map((fp) => (
                    <div key={fp.founder} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${fp.paid ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-muted/30 border-border"}`}>
                      {/* Status icon */}
                      <div className="flex-shrink-0">
                        {fp.paid
                          ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          : <Circle className="h-5 w-5 text-muted-foreground" />}
                      </div>

                      {/* Founder name */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{fp.founder}</p>
                        {fp.paid && fp.paidAt && (
                          <p className="text-xs text-muted-foreground">دفع في {new Date(fp.paidAt).toLocaleDateString("ar-SA")}</p>
                        )}
                        {!fp.paid && (() => {
                          const bal = founderBalances[fp.founder] || founderBalances[fp.founderId] || 0;
                          return bal > 0
                            ? <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5"><Wallet className="h-3 w-3" />رصيد متاح: {bal.toLocaleString("en-US")} {t.currency}</p>
                            : <p className="text-xs text-muted-foreground">في انتظار الدفع</p>;
                        })()}
                      </div>

                      {/* Amount + percentage */}
                      <div className="text-end flex-shrink-0">
                        <p className="font-bold text-base">{toNum(fp.amount).toLocaleString()} {t.currency}</p>
                        <p className="text-xs text-muted-foreground">{fp.percentage?.toFixed(1)}% {t.sharePercent}</p>
                      </div>

                      {/* Single pay button for all founders */}
                      {!fp.paid && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground gap-1 flex-shrink-0"
                          disabled={payingFounder === fp.founder}
                          onClick={async () => {
                            setUseBalance(false);
                            let bal = 0;
                            try {
                              const freshBalances = await api.get<{ founderId: string; founderName: string; balance: number }[]>("/founder-balances");
                              const newMap: Record<string, number> = {};
                              freshBalances.forEach(b => {
                                if (b.founderName) newMap[b.founderName] = b.balance;
                                if (b.founderName) newMap[b.founderName.trim().toLowerCase()] = b.balance;
                                if (b.founderId) newMap[b.founderId] = b.balance;
                              });
                              setFounderBalances(newMap);
                              const fpId = fp.founderId || "";
                              const fpName = (fp.founder || "").trim().toLowerCase();
                              bal = (fpId && newMap[fpId] != null ? newMap[fpId] : null)
                                ?? newMap[fp.founder]
                                ?? newMap[fpName]
                                ?? 0;
                            } catch {
                              bal = founderBalances[fp.founderId] || founderBalances[fp.founder] || founderBalances[(fp.founder || "").trim().toLowerCase()] || 0;
                            }
                            setBalanceDialog({ open: true, fp, available: bal });
                          }}
                        >
                          {payingFounder === fp.founder
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <><Banknote className="h-3 w-3" />تسديد الحصة</>}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Users2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">لا توجد مساهمات مسجّلة لهذا الطلب</p>
                  <p className="text-xs mt-1 opacity-70">الطلبات الجديدة تحفظ مساهمات المؤسسين تلقائياً عند الإنشاء</p>
                </div>
              )}
            </div>

            {/* Post-collection profit distribution note */}
            {founderPayments.length > 0 && grossProfit > 0 && (
              <div className={`stat-card space-y-3 ${isCollected ? "" : "opacity-60"}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" />توزيع الأرباح بعد التحصيل</h3>
                  {!isCollected && <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">ينتظر التحصيل</span>}
                  {isCollected && <span className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">جاهز للتوزيع</span>}
                </div>
                <div className="space-y-2 text-sm">
                  {founderPayments.map(fp => (
                    <div key={fp.founder} className="flex justify-between items-center">
                      <span className="text-muted-foreground">{fp.founder}</span>
                      <span className={`font-semibold ${isCollected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                        {fp.profitShare.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t.currency}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 flex justify-between text-xs text-muted-foreground">
                    <span>+ نصيب الشركة ({companyPct}%)</span>
                    <span>{companyProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t.currency}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Unified Payment Dialog */}
      <Dialog open={balanceDialog.open} onOpenChange={(o) => { if (!o) { setBalanceDialog({ open: false, fp: null, available: 0 }); setUseBalance(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              تسديد حصة {balanceDialog.fp?.founder}
            </DialogTitle>
          </DialogHeader>
          {balanceDialog.fp && (() => {
            const required = toNum(balanceDialog.fp.amount);
            const hasBalance = balanceDialog.available > 0;
            const walletUsed = (hasBalance && useBalance) ? Math.min(balanceDialog.available, required) : 0;
            const cashPortion = Math.max(required - walletUsed, 0);
            return (
              <div className="space-y-4 py-1">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className={`p-2.5 rounded-lg border ${hasBalance ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : "bg-muted/30 border-border"}`}>
                    <p className={`text-xs mb-0.5 ${hasBalance ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>رصيد متاح</p>
                    <p className={`font-bold ${hasBalance ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>{balanceDialog.available.toLocaleString("en-US")} ج.م</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-0.5">الحصة المطلوبة</p>
                    <p className="font-bold">{required.toLocaleString("en-US")} ج.م</p>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
                  {useBalance && walletUsed > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Wallet className="h-3.5 w-3.5" />من الرصيد
                      </span>
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        −{walletUsed.toLocaleString("en-US")} ج.م
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-primary">
                      <Banknote className="h-3.5 w-3.5" />تمويل مالي
                    </span>
                    <span className={`font-semibold ${cashPortion > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                      {cashPortion.toLocaleString("en-US")} ج.م
                    </span>
                  </div>
                  <div className="border-t border-border pt-1.5 flex justify-between text-xs text-muted-foreground">
                    <span>الإجمالي</span>
                    <span className="font-medium text-success">
                      {required.toLocaleString("en-US")} ج.م
                    </span>
                  </div>

                  {/* Checkbox: deduct from balance — always visible, disabled when no balance */}
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
                            ? `سيُخصم ${walletUsed.toLocaleString("en-US")} ج.م من رصيده${cashPortion > 0 ? ` — الباقي ${cashPortion.toLocaleString("en-US")} ج.م تمويل مالي` : " — لا حاجة لتمويل إضافي"}`
                            : `رصيد متاح: ${balanceDialog.available.toLocaleString("en-US")} ج.م — اضغط للخصم`
                        }
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setBalanceDialog({ open: false, fp: null, available: 0 })}>إلغاء</Button>
            <Button
              size="sm"
              disabled={payingFounder !== null}
              onClick={handlePayWithBalance}
            >
              {payingFounder !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Banknote className="h-3.5 w-3.5 me-1" />تأكيد التسديد</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
