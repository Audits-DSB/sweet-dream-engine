import { useParams, useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Truck, Upload, Printer, FileCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ordersList } from "@/data/store";
import { printInvoice } from "@/lib/printInvoice";

const orderData = {
  id: "ORD-047", client: "مركز نور لطب الأسنان", clientId: "C002",
  date: "2025-03-05", status: "Confirmed", source: "REQ-002",
  splitMode: "بالمساهمة", deliveryFee: 750,
  subscription: { type: "percentage", value: 5 },
  cashback: { type: "none", value: 0 },
  lines: [
    { material: "حشو كمبوزيت ضوئي", code: "MAT-001", unit: "عبوة", qty: 50, sellingPrice: 1200, storeCost: 800, lineTotal: 60000, lineCost: 40000 },
    { material: "إبر تخدير", code: "MAT-002", unit: "علبة", qty: 20, sellingPrice: 950, storeCost: 600, lineTotal: 19000, lineCost: 12000 },
    { material: "قفازات لاتكس", code: "MAT-005", unit: "كرتونة", qty: 15, sellingPrice: 400, storeCost: 280, lineTotal: 6000, lineCost: 4200 },
  ],
  founderContributions: [
    { founder: "أحمد الراشد", amount: 28000, percentage: 49.8 },
    { founder: "سارة المنصور", amount: 17000, percentage: 30.2 },
    { founder: "عمر خليل", amount: 11200, percentage: 19.9 },
  ],
  deliveries: [{ id: "DEL-031", date: "2025-03-07", actor: "أحمد (مؤسس)", status: "Pending", items: "الطلب كامل" }],
};

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const order = orderData;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes("pdf") && !file.type.includes("image")) {
      toast.error("PDF أو صورة فقط");
      return;
    }
    setUploadedFile(file.name);
    toast.success(`${t.uploadInvoice}: ${file.name}`);
    e.target.value = "";
  };

  const found = ordersList.find(o => o.id === id);

  const totalSelling = order.lines.reduce((s, l) => s + l.lineTotal, 0);
  const totalCost = order.lines.reduce((s, l) => s + l.lineCost, 0);
  const subscriptionAmt = order.subscription.type === "percentage" ? totalSelling * order.subscription.value / 100 : order.subscription.value;
  const operatingRevenue = totalSelling + subscriptionAmt;
  const grossProfit = operatingRevenue - totalCost;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/orders")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3"><h1 className="page-header">{id || order.id}</h1><StatusBadge status={found?.status || order.status} /></div>
          <p className="page-description">
            <span className="cursor-pointer hover:text-primary" onClick={() => navigate(`/clients/${order.clientId}`)}>{found?.client || order.client}</span>
            {" · "}{found?.date || order.date} · {t.orderDetailsSource}: {found?.source || order.source}
          </p>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            {uploadedFile ? <FileCheck className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5 text-success" /> : <Upload className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />}
            {uploadedFile || t.uploadInvoice}
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            printInvoice({
              title: t.printInvoice,
              companyName: "OpsHub",
              subtitle: t.ordersTitle,
              clientName: found?.client || order.client,
              invoiceNumber: id || order.id,
              date: found?.date || order.date,
              columns: [t.materialCol, t.codeCol, t.unitCol, t.qtyCol, `${t.sellingPerUnit} (${t.currency})`, `${t.lineTotalSelling} (${t.currency})`],
              rows: order.lines.map(l => [l.material, l.code, l.unit, l.qty, l.sellingPrice, l.lineTotal.toLocaleString()]),
              totals: [
                { label: t.totalSelling, value: `${totalSelling.toLocaleString()} ${t.currency}` },
                { label: `${t.subscriptionLabel} (${order.subscription.value}%)`, value: `${subscriptionAmt.toLocaleString()} ${t.currency}` },
                { label: t.operatingRevenue, value: `${operatingRevenue.toLocaleString()} ${t.currency}` },
              ],
              footer: `${t.deliveryFeeDisplay}: ${order.deliveryFee} ${t.currency}`,
            });
          }}><Printer className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.print}</Button>
          <Button size="sm" onClick={() => navigate("/deliveries")}><Truck className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.registerDelivery}</Button>
        </div>
      </div>

      <Tabs defaultValue="lines" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="lines">{t.orderLines}</TabsTrigger>
          <TabsTrigger value="financials">{t.financials}</TabsTrigger>
          <TabsTrigger value="deliveries">{t.deliveriesTab}</TabsTrigger>
          <TabsTrigger value="funding">{t.fundingTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="lines">
          <div className="stat-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.materialCol}</th>
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.codeCol}</th>
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.unitCol}</th>
                  <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.qtyCol}</th>
                  <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.sellingPerUnit}</th>
                  <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.costPerUnit}</th>
                  <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.lineTotalSelling}</th>
                  <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.lineTotalCost}</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line, idx) => (
                  <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/materials?search=${encodeURIComponent(line.code)}`)}>
                    <td className="py-2.5 px-3 font-medium">{line.material}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{line.code}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{line.unit}</td>
                    <td className="py-2.5 px-3 text-end">{line.qty}</td>
                    <td className="py-2.5 px-3 text-end">{line.sellingPrice} {t.currency}</td>
                    <td className="py-2.5 px-3 text-end text-muted-foreground">{line.storeCost} {t.currency}</td>
                    <td className="py-2.5 px-3 text-end font-medium">{line.lineTotal.toLocaleString()} {t.currency}</td>
                    <td className="py-2.5 px-3 text-end text-muted-foreground">{line.lineCost.toLocaleString()} {t.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="financials">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="stat-card space-y-3">
              <h3 className="font-semibold text-sm">{t.expectedRevenue}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t.totalSelling}</span><span className="font-medium">{totalSelling.toLocaleString()} {t.currency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t.subscriptionLabel} ({order.subscription.value}%)</span><span className="font-medium">{subscriptionAmt.toLocaleString()} {t.currency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t.cashback}</span><span className="font-medium">0 {t.currency}</span></div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold"><span>{t.operatingRevenue}</span><span>{operatingRevenue.toLocaleString()} {t.currency}</span></div>
              </div>
            </div>
            <div className="stat-card space-y-3">
              <h3 className="font-semibold text-sm">{t.expectedProfit}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t.operatingRevenue}</span><span className="font-medium">{operatingRevenue.toLocaleString()} {t.currency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t.totalCost}</span><span className="font-medium text-destructive">- {totalCost.toLocaleString()} {t.currency}</span></div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold"><span>{t.grossProfit}</span><span className="text-success">{grossProfit.toLocaleString()} {t.currency}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>{t.deliveryFeeDisplay}</span><span>{order.deliveryFee} {t.currency}</span></div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="deliveries">
          <div className="stat-card overflow-x-auto">
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
                    <td className="py-2.5 px-3"><StatusBadge status={del.status} variant="warning" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="funding">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">{t.founderContributions} ({order.splitMode})</h3>
              <span className="text-xs text-muted-foreground">{t.totalCost}: {totalCost.toLocaleString()} {t.currency}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {order.founderContributions.map((fc) => (
                <div key={fc.founder} className="p-4 rounded-lg bg-muted/50 space-y-1 cursor-pointer hover:bg-muted/70" onClick={() => navigate("/founders")}>
                  <p className="font-medium text-sm">{fc.founder}</p>
                  <p className="text-xl font-bold">{fc.amount.toLocaleString()} {t.currency}</p>
                  <p className="text-xs text-muted-foreground">{fc.percentage}% {t.sharePercent}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
