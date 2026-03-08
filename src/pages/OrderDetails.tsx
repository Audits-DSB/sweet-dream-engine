import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Truck, FileText, Upload, Printer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  deliveries: [
    { id: "DEL-031", date: "2025-03-07", actor: "أحمد (مؤسس)", status: "Pending", items: "الطلب كامل" },
  ],
};

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const order = orderData;

  const totalSelling = order.lines.reduce((s, l) => s + l.lineTotal, 0);
  const totalCost = order.lines.reduce((s, l) => s + l.lineCost, 0);
  const subscriptionAmt = order.subscription.type === "percentage" ? totalSelling * order.subscription.value / 100 : order.subscription.value;
  const operatingRevenue = totalSelling + subscriptionAmt;
  const grossProfit = operatingRevenue - totalCost;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/orders")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-header">{id || order.id}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="page-description">{order.client} · {order.date} · المصدر: {order.source}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Upload className="h-3.5 w-3.5 mr-1.5" />رفع فاتورة</Button>
          <Button variant="outline" size="sm"><Printer className="h-3.5 w-3.5 mr-1.5" />طباعة</Button>
          <Button size="sm"><Truck className="h-3.5 w-3.5 mr-1.5" />تسجيل تسليم</Button>
        </div>
      </div>

      <Tabs defaultValue="lines" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="lines">بنود الطلب</TabsTrigger>
          <TabsTrigger value="financials">الماليات</TabsTrigger>
          <TabsTrigger value="deliveries">التسليمات</TabsTrigger>
          <TabsTrigger value="funding">تمويل المؤسسين</TabsTrigger>
        </TabsList>

        <TabsContent value="lines">
          <div className="stat-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">المادة</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">الكود</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">الوحدة</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">الكمية</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">سعر البيع/وحدة</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">التكلفة/وحدة</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">إجمالي البيع</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">إجمالي التكلفة</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line, idx) => (
                  <tr key={idx} className="border-b border-border/50">
                    <td className="py-2.5 px-3 font-medium">{line.material}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{line.code}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{line.unit}</td>
                    <td className="py-2.5 px-3 text-right">{line.qty}</td>
                    <td className="py-2.5 px-3 text-right">{line.sellingPrice} ج.م</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{line.storeCost} ج.م</td>
                    <td className="py-2.5 px-3 text-right font-medium">{line.lineTotal.toLocaleString()} ج.م</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{line.lineCost.toLocaleString()} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="financials">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="stat-card space-y-3">
              <h3 className="font-semibold text-sm">الإيرادات المتوقعة</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">إجمالي البيع</span><span className="font-medium">{totalSelling.toLocaleString()} ج.م</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">الاشتراك ({order.subscription.value}%)</span><span className="font-medium">{subscriptionAmt.toLocaleString()} ج.م</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">كاش باك</span><span className="font-medium">0 ج.م</span></div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold"><span>إيرادات التشغيل</span><span>{operatingRevenue.toLocaleString()} ج.م</span></div>
              </div>
            </div>
            <div className="stat-card space-y-3">
              <h3 className="font-semibold text-sm">الربح المتوقع</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">إيرادات التشغيل</span><span className="font-medium">{operatingRevenue.toLocaleString()} ج.م</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">إجمالي التكلفة</span><span className="font-medium text-destructive">- {totalCost.toLocaleString()} ج.م</span></div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold"><span>الربح الإجمالي (متوقع)</span><span className="text-success">{grossProfit.toLocaleString()} ج.م</span></div>
                <div className="flex justify-between text-muted-foreground"><span>رسوم التوصيل (عرض فقط)</span><span>{order.deliveryFee} ج.م</span></div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="deliveries">
          <div className="stat-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">رقم التسليم</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">التاريخ</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">المنفذ</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">البنود</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {order.deliveries.map((del) => (
                  <tr key={del.id} className="border-b border-border/50">
                    <td className="py-2.5 px-3 font-mono text-xs">{del.id}</td>
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
              <h3 className="font-semibold text-sm">مساهمات المؤسسين (تقسيم {order.splitMode})</h3>
              <span className="text-xs text-muted-foreground">إجمالي التكلفة: {totalCost.toLocaleString()} ج.م</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {order.founderContributions.map((fc) => (
                <div key={fc.founder} className="p-4 rounded-lg bg-muted/50 space-y-1">
                  <p className="font-medium text-sm">{fc.founder}</p>
                  <p className="text-xl font-bold">{fc.amount.toLocaleString()} ج.م</p>
                  <p className="text-xs text-muted-foreground">{fc.percentage}% حصة</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
