import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Truck, FileText, Upload, Printer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const orderData = {
  id: "ORD-047", client: "Noor Restaurant", clientId: "C002",
  date: "2025-03-05", status: "Confirmed", source: "REQ-002",
  splitMode: "Contribution", deliveryFee: 75,
  subscription: { type: "percentage", value: 5 },
  cashback: { type: "none", value: 0 },
  lines: [
    { material: "Arabica Coffee Beans", code: "MAT-001", unit: "kg", qty: 50, sellingPrice: 120, storeCost: 80, lineTotal: 6000, lineCost: 4000 },
    { material: "Green Tea Leaves", code: "MAT-002", unit: "kg", qty: 20, sellingPrice: 95, storeCost: 60, lineTotal: 1900, lineCost: 1200 },
    { material: "Milk Powder", code: "MAT-005", unit: "kg", qty: 15, sellingPrice: 40, storeCost: 28, lineTotal: 600, lineCost: 420 },
  ],
  founderContributions: [
    { founder: "Ahmed Al-Rashid", amount: 2800, percentage: 49.8 },
    { founder: "Sara Al-Mansour", amount: 1700, percentage: 30.2 },
    { founder: "Omar Khalil", amount: 1120, percentage: 19.9 },
  ],
  deliveries: [
    { id: "DEL-031", date: "2025-03-07", actor: "Ahmed (Founder)", status: "Pending", items: "Full order" },
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
          <p className="page-description">{order.client} · {order.date} · Source: {order.source}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Upload className="h-3.5 w-3.5 mr-1.5" />Upload Invoice</Button>
          <Button variant="outline" size="sm"><Printer className="h-3.5 w-3.5 mr-1.5" />Print</Button>
          <Button size="sm"><Truck className="h-3.5 w-3.5 mr-1.5" />Record Delivery</Button>
        </div>
      </div>

      <Tabs defaultValue="lines" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="lines">Order Lines</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
          <TabsTrigger value="funding">Founder Funding</TabsTrigger>
        </TabsList>

        <TabsContent value="lines">
          <div className="stat-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Material</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Code</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Unit</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Qty</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Selling/Unit</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Cost/Unit</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Line Total</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Line Cost</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line, idx) => (
                  <tr key={idx} className="border-b border-border/50">
                    <td className="py-2.5 px-3 font-medium">{line.material}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{line.code}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{line.unit}</td>
                    <td className="py-2.5 px-3 text-right">{line.qty}</td>
                    <td className="py-2.5 px-3 text-right">SAR {line.sellingPrice}</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">SAR {line.storeCost}</td>
                    <td className="py-2.5 px-3 text-right font-medium">SAR {line.lineTotal.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">SAR {line.lineCost.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="financials">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="stat-card space-y-3">
              <h3 className="font-semibold text-sm">Expected Revenue</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Selling</span><span className="font-medium">SAR {totalSelling.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Subscription ({order.subscription.value}%)</span><span className="font-medium">SAR {subscriptionAmt.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cashback</span><span className="font-medium">SAR 0</span></div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold"><span>Operating Revenue</span><span>SAR {operatingRevenue.toLocaleString()}</span></div>
              </div>
            </div>
            <div className="stat-card space-y-3">
              <h3 className="font-semibold text-sm">Expected Profit</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Operating Revenue</span><span className="font-medium">SAR {operatingRevenue.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Cost</span><span className="font-medium text-destructive">- SAR {totalCost.toLocaleString()}</span></div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold"><span>Gross Profit (Expected)</span><span className="text-success">SAR {grossProfit.toLocaleString()}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Delivery Fee (display only)</span><span>SAR {order.deliveryFee}</span></div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="deliveries">
          <div className="stat-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Delivery ID</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Actor</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Items</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Status</th>
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
              <h3 className="font-semibold text-sm">Founder Contributions ({order.splitMode} Split)</h3>
              <span className="text-xs text-muted-foreground">Total Cost: SAR {totalCost.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {order.founderContributions.map((fc) => (
                <div key={fc.founder} className="p-4 rounded-lg bg-muted/50 space-y-1">
                  <p className="font-medium text-sm">{fc.founder}</p>
                  <p className="text-xl font-bold">SAR {fc.amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{fc.percentage}% share</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
