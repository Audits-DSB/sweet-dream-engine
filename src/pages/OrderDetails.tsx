import { useParams, useNavigate } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Truck, Upload, Printer, FileCheck, Loader2, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { printInvoice } from "@/lib/printInvoice";

type OrderLine = {
  id: number; orderId: string; materialCode: string; materialName: string;
  imageUrl: string; unit: string; quantity: number;
  sellingPrice: number; costPrice: number; lineTotal: number; lineCost: number;
};
type OrderDelivery = { id: string; date: string; actor: string; status: string; items: string };
type FounderContrib = { founder: string; amount: number; percentage: number };

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
  };
}

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any[]>("/orders"),
      api.get<OrderLine[]>(`/orders/${id}/lines`).catch(() => []),
    ]).then(([all, fetchedLines]) => {
      const found = (all || []).find((o: any) => o.id === id);
      if (found) setOrder(mapOrder(found));
      setLines(fetchedLines || []);
    }).catch(() => toast.error("تعذّر تحميل بيانات الطلب"))
      .finally(() => setLoading(false));
  }, [id]);

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
              ? lines.map(l => [l.materialName, l.materialCode, l.unit, l.quantity, toNum(l.sellingPrice).toLocaleString(), toNum(l.lineTotal).toLocaleString()])
              : [];
            printInvoice({
              title: t.printInvoice, companyName: "DSB", subtitle: t.ordersTitle,
              clientName: order.client, invoiceNumber: order.id, date: order.date,
              columns: invoiceLines.length > 0
                ? [t.materialCol, t.codeCol, t.unitCol, t.qtyCol, `${t.sellingPerUnit} (${t.currency})`, `${t.lineTotalSelling} (${t.currency})`]
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
          <Button size="sm" onClick={() => navigate("/deliveries")}><Truck className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.registerDelivery}</Button>
        </div>
      </div>

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

                    {/* Unit price */}
                    <div className="text-center flex-shrink-0 hidden sm:block">
                      <div className="text-xs text-muted-foreground">السعر</div>
                      <div className="font-medium text-sm">{toNum(line.sellingPrice).toLocaleString()}</div>
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
              <div className="py-16 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">لا توجد بنود تفصيلية لهذا الطلب</p>
                <p className="text-xs mt-1">الطلبات الجديدة ستظهر تفاصيلها هنا</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="stat-card space-y-3">
              <h3 className="font-semibold text-sm">{t.expectedRevenue}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t.totalSelling}</span><span className="font-medium">{linesTotal.toLocaleString()} {t.currency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t.subscriptionLabel} ({subVal}%)</span><span className="font-medium">{subscriptionAmt.toLocaleString()} {t.currency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t.cashback}</span><span className="font-medium">0 {t.currency}</span></div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold"><span>{t.operatingRevenue}</span><span>{operatingRevenue.toLocaleString()} {t.currency}</span></div>
              </div>
            </div>
            <div className="stat-card space-y-3">
              <h3 className="font-semibold text-sm">{t.expectedProfit}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t.operatingRevenue}</span><span className="font-medium">{operatingRevenue.toLocaleString()} {t.currency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t.totalCost}</span><span className="font-medium text-destructive">- {costTotal.toLocaleString()} {t.currency}</span></div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold"><span>{t.grossProfit}</span><span className="text-success">{grossProfit.toLocaleString()} {t.currency}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>{t.deliveryFeeDisplay}</span><span>{order.deliveryFee} {t.currency}</span></div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── DELIVERIES TAB ───────────────────────────────────────────── */}
        <TabsContent value="deliveries">
          <div className="stat-card overflow-x-auto">
            {order.deliveries.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.deliveryId}</th>
                    <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.date}</th>
                    <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.executor}</th>
                    <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.deliveryItems}</th>
                    <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.deliveries.map((del) => (
                    <tr key={del.id} className="border-b border-border/50 cursor-pointer hover:bg-muted/30" onClick={() => navigate("/deliveries")}>
                      <td className="py-2.5 px-3 font-mono text-xs text-primary">{del.id}</td>
                      <td className="py-2.5 px-3">{del.date}</td>
                      <td className="py-2.5 px-3">{del.actor}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{del.items}</td>
                      <td className="py-2.5 px-3"><StatusBadge status={del.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="py-10 text-center text-muted-foreground text-sm">لا توجد تسليمات مسجّلة لهذا الطلب</p>
            )}
          </div>
        </TabsContent>

        {/* ── FUNDING TAB ──────────────────────────────────────────────── */}
        <TabsContent value="funding">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">{t.founderContributions} ({order.splitMode})</h3>
              <span className="text-xs text-muted-foreground">{t.totalCost}: {costTotal.toLocaleString()} {t.currency}</span>
            </div>
            {order.founderContributions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {order.founderContributions.map((fc) => (
                  <div key={fc.founder} className="p-4 rounded-lg bg-muted/50 space-y-1 cursor-pointer hover:bg-muted/70" onClick={() => navigate("/founders")}>
                    <p className="font-medium text-sm">{fc.founder}</p>
                    <p className="text-xl font-bold">{toNum(fc.amount).toLocaleString()} {t.currency}</p>
                    <p className="text-xs text-muted-foreground">{fc.percentage}% {t.sharePercent}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-muted-foreground text-sm">لا توجد مساهمات مسجّلة لهذا الطلب</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
