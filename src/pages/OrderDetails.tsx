import { useParams, useNavigate } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Truck, Upload, Printer, FileCheck, Loader2, Package, TrendingUp, Building2, Users2, CheckCircle2, Circle, DollarSign, Pencil, CalendarDays, User, Hash, StickyNote, ExternalLink, PackageCheck, Wallet, Banknote } from "lucide-react";
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

type ExtMaterial = { sku: string; name: string; imageUrl: string };

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { rules } = useBusinessRules();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingFounder, setPayingFounder] = useState<string | null>(null);
  const [orderDeliveries, setOrderDeliveries] = useState<OrderDelivery[]>([]);
  const [founderBalances, setFounderBalances] = useState<Record<string, number>>({});
  const [balanceDialog, setBalanceDialog] = useState<{ open: boolean; fp: any | null; available: number }>({ open: false, fp: null, available: 0 });
  const [useBalance, setUseBalance] = useState(false);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ status: "", date: "", source: "", deliveryFee: "" });
  const [editLines, setEditLines] = useState<Array<OrderLine & { _qty: string; _sell: string; _cost: string }>>([]);
  const [editSaving, setEditSaving] = useState(false);

  const loadOrder = () =>
    Promise.all([
      api.get<any[]>("/orders"),
      api.get<OrderLine[]>(`/orders/${id}/lines`).catch(() => []),
      api.get<{ products: any[] }>("/external-materials").catch(() => ({ products: [] })),
      api.get<OrderDelivery[]>(`/deliveries?orderId=${id}`).catch(() => []),
      api.get<{ founderId: string; founderName: string; balance: number }[]>("/founder-balances").catch(() => []),
    ]).then(([all, fetchedLines, extData, deliveries, balances]) => {
      const found = (all || []).find((o: any) => o.id === id);
      if (found) setOrder(mapOrder(found));
      const map: Record<string, ExtMaterial> = {};
      (extData?.products || []).forEach((p: any) => {
        const key = p.sku || "";
        if (key) map[key] = { sku: key, name: p.name || "", imageUrl: p.image_url || "" };
      });
      const enriched = (fetchedLines || []).map((l: any) => ({
        ...l,
        materialName: l.materialName || map[l.materialCode]?.name || l.materialCode,
        imageUrl: l.imageUrl || map[l.materialCode]?.imageUrl || "",
      }));
      setLines(enriched);
      setOrderDeliveries(deliveries || []);
      // Build balances keyed by founder name for dialog lookup
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
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!order) return;
    setEditSaving(true);
    try {
      // Snapshot before
      const beforeOrder = { status: order.status, date: order.date, source: order.source, deliveryFee: order.deliveryFee };
      const beforeLines = lines.map(l => ({ id: l.id, quantity: l.quantity, sellingPrice: l.sellingPrice, costPrice: l.costPrice, lineTotal: l.lineTotal, lineCost: l.lineCost }));

      // PATCH order header
      const orderPatch: Record<string, any> = {};
      if (editForm.status !== order.status) orderPatch.status = editForm.status;
      if (editForm.date !== order.date) orderPatch.date = editForm.date;
      if (editForm.source !== (order.source || "")) orderPatch.source = editForm.source;
      const newFee = Number(editForm.deliveryFee) || 0;
      if (newFee !== (order.deliveryFee || 0)) orderPatch.deliveryFee = newFee;

      // PATCH changed lines + recalc totals
      let newTotalSelling = 0;
      let newTotalCost = 0;
      const linePatches: Promise<any>[] = [];
      const afterLines: typeof beforeLines = [];

      for (const el of editLines) {
        const qty = Number(el._qty) || 0;
        const sell = Number(el._sell) || 0;
        const cost = Number(el._cost) || 0;
        newTotalSelling += qty * sell;
        newTotalCost += qty * cost;
        afterLines.push({ id: el.id, quantity: qty, sellingPrice: sell, costPrice: cost, lineTotal: qty * sell, lineCost: qty * cost });
        const orig = lines.find(l => l.id === el.id);
        if (orig && (orig.quantity !== qty || orig.sellingPrice !== sell || orig.costPrice !== cost)) {
          linePatches.push(api.patch(`/order-lines/${el.id}`, { quantity: qty, sellingPrice: sell, costPrice: cost }));
        }
      }

      // If we have lines, also update totalSelling/totalCost on the order
      if (editLines.length > 0) {
        orderPatch.totalSelling = newTotalSelling;
        orderPatch.totalCost = newTotalCost;
      }

      // Apply changes
      await Promise.all(linePatches);
      let refreshedOrder = order;
      if (Object.keys(orderPatch).length > 0) {
        const updated = await api.patch<any>(`/orders/${order.id}`, orderPatch);
        refreshedOrder = mapOrder(updated);
      }

      // Detect changes for summary
      const changedFields = Object.keys(orderPatch);
      if (linePatches.length > 0) changedFields.push("سطور الطلب");

      // Log audit with before/after
      if (changedFields.length > 0) {
        await logAudit({
          entity: "order",
          entityId: order.id,
          entityName: `${order.id} - ${order.client}`,
          action: "update",
          snapshot: {
            before: { order: beforeOrder, lines: beforeLines },
            after: { order: orderPatch, lines: afterLines },
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
      if (linePatches.length > 0) {
        // Reload lines from server
        const freshLines = await api.get<any[]>(`/orders/${order.id}/lines`);
        setLines(freshLines || []);
      }
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "فشل حفظ التعديلات");
    } finally {
      setEditSaving(false);
    }
  };

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
  const grossProfit = operatingRevenue - costTotal;

  // Profit distribution (available after collection)
  // companyProfitPercentage is snapshotted inside each founderContributions entry at order creation
  const snappedPct = (order.founderContributions[0] as any)?.companyProfitPercentage;
  const companyPct = snappedPct ?? order.companyProfitPercentage ?? rules.companyProfitPercentage ?? 15;
  const companyProfit = grossProfit * companyPct / 100;
  const foundersProfit = grossProfit - companyProfit;
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
          <Button size="sm" onClick={() => navigate("/deliveries")}><Truck className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.registerDelivery}</Button>
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
              {editLines.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-4 text-muted-foreground">سطور الطلب</h3>
                  <div className="space-y-3">
                    {editLines.map((el, idx) => (
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
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">الكمية</Label>
                            <Input type="number" min="0" value={el._qty} onChange={(e) => setEditLines(prev => prev.map((p, i) => i === idx ? { ...p, _qty: e.target.value } : p))} className="h-8 text-sm" data-testid={`input-qty-${el.id}`} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">سعر البيع</Label>
                            <Input type="number" min="0" value={el._sell} onChange={(e) => setEditLines(prev => prev.map((p, i) => i === idx ? { ...p, _sell: e.target.value } : p))} className="h-8 text-sm" data-testid={`input-sell-${el.id}`} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">سعر الشراء</Label>
                            <Input type="number" min="0" value={el._cost} onChange={(e) => setEditLines(prev => prev.map((p, i) => i === idx ? { ...p, _cost: e.target.value } : p))} className="h-8 text-sm" data-testid={`input-cost-${el.id}`} />
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                          <span>إجمالي البيع: <span className="font-semibold text-foreground">{((Number(el._qty) || 0) * (Number(el._sell) || 0)).toLocaleString()}</span></span>
                          <span>إجمالي التكلفة: <span className="font-semibold text-foreground">{((Number(el._qty) || 0) * (Number(el._cost) || 0)).toLocaleString()}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

      <Tabs defaultValue="invoice" className="space-y-4">
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

            {/* Items */}
            {hasDetailedLines ? (
              <div className="divide-y divide-border/50">
                {lines.map((line) => (
                  <div key={line.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors">
                    {/* Product image */}
                    <div className="w-14 h-14 rounded-lg border border-border overflow-hidden bg-muted/50 flex-shrink-0 flex items-center justify-center">
                      {line.imageUrl ? (
                        <img
                          src={line.imageUrl}
                          alt={line.materialName}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }}
                        />
                      ) : null}
                      <Package className={`h-6 w-6 text-muted-foreground ${line.imageUrl ? "hidden" : ""}`} />
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
                ))}
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
              <Button variant="outline" size="sm" onClick={() => navigate("/deliveries")} data-testid="button-go-deliveries">
                <ExternalLink className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
                إدارة التوصيلات
              </Button>
            </div>

            {orderDeliveries.length === 0 ? (
              <div className="stat-card flex flex-col items-center justify-center py-14 gap-3 text-center">
                <Truck className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">لا توجد توصيلات مرتبطة بهذا الطلب</p>
                <Button size="sm" onClick={() => navigate("/deliveries")} data-testid="button-add-delivery">
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
                    onClick={() => navigate("/deliveries")}
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

                    {/* Notes row (if any) */}
                    {del.notes && (
                      <div className="flex items-start gap-2.5 px-5 py-3 border-t border-border/50 bg-muted/10">
                        <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">ملاحظات</div>
                          <div className="text-sm text-foreground" data-testid={`text-notes-${del.id}`}>{del.notes}</div>
                        </div>
                      </div>
                    )}
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
                        {!fp.paid && (
                          <p className="text-xs text-muted-foreground">في انتظار الدفع</p>
                        )}
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
                          onClick={() => {
                            const bal = founderBalances[fp.founder] || founderBalances[fp.founderId] || 0;
                            setUseBalance(bal > 0);
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
                    {hasBalance
                      ? <p className="font-bold text-amber-700 dark:text-amber-300">{balanceDialog.available.toLocaleString("en-US")} ج.م</p>
                      : <p className="font-medium text-muted-foreground">لا يوجد رصيد</p>
                    }
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-0.5">الحصة المطلوبة</p>
                    <p className="font-bold">{required.toLocaleString("en-US")} ج.م</p>
                  </div>
                </div>

                {/* Checkbox: deduct from balance */}
                {hasBalance && (
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${useBalance ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-border"}`}>
                    <Checkbox
                      checked={useBalance}
                      onCheckedChange={(v) => setUseBalance(!!v)}
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium">السحب من الرصيد</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        سيُخصم {Math.min(balanceDialog.available, required).toLocaleString("en-US")} ج.م من رصيده المتاح
                        {cashPortion > 0 && useBalance && ` — الباقي ${cashPortion.toLocaleString("en-US")} ج.م تمويل مالي`}
                      </p>
                    </div>
                  </label>
                )}

                {/* Breakdown */}
                <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
                  {hasBalance && useBalance && (
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Wallet className="h-3.5 w-3.5" />من الرصيد
                      </span>
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        {walletUsed.toLocaleString("en-US")} ج.م
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
