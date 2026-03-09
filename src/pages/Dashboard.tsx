import {
  Users, ShoppingCart, FileText, Truck, Receipt, AlertTriangle, TrendingUp, Building2, Clock, Package,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { clientsList, ordersList } from "@/data/store";

export default function Dashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const revenueData = [
    { month: t.jan, revenue: 124000, cost: 82000 },
    { month: t.feb, revenue: 158000, cost: 96000 },
    { month: t.mar, revenue: 182000, cost: 112000 },
    { month: t.apr, revenue: 146000, cost: 98000 },
    { month: t.may, revenue: 210000, cost: 124000 },
    { month: t.jun, revenue: 192000, cost: 118000 },
  ];

  const collectionData = [
    { name: t.paid, value: 68, color: "hsl(152, 60%, 40%)" },
    { name: t.partial, value: 18, color: "hsl(38, 92%, 50%)" },
    { name: t.overdue, value: 14, color: "hsl(0, 72%, 51%)" },
  ];

  const consumptionTrend = [
    { week: "W1", consumption: 320 },
    { week: "W2", consumption: 450 },
    { week: "W3", consumption: 380 },
    { week: "W4", consumption: 520 },
    { week: "W5", consumption: 490 },
    { week: "W6", consumption: 610 },
  ];

  const recentOrders = ordersList.slice(0, 5).map(o => {
    const statusMap: Record<string, string> = {
      "Delivered": t.delivered,
      "Confirmed": t.confirmed,
      "Draft": t.draft,
      "Ready for Delivery": t.readyForDelivery,
      "Partially Delivered": t.partialDelivery,
      "Awaiting Purchase": t.awaitingPurchase,
      "Invoiced": t.invoiced,
      "Closed": t.closed,
      "Cancelled": t.cancelled,
    };
    return { id: o.id, client: o.client, clientId: o.clientId, status: statusMap[o.status] || o.status, statusKey: o.status, total: o.totalSelling };
  });

  const statusColors: Record<string, string> = {
    [t.delivered]: "bg-success/10 text-success",
    [t.awaitingDelivery]: "bg-warning/10 text-warning",
    [t.draft]: "bg-muted text-muted-foreground",
    [t.confirmed]: "bg-info/10 text-info",
    [t.partialDelivery]: "bg-primary/10 text-primary",
    [t.readyForDelivery]: "bg-info/10 text-info",
    [t.awaitingPurchase]: "bg-warning/10 text-warning",
    [t.invoiced]: "bg-primary/10 text-primary",
    [t.closed]: "bg-muted text-muted-foreground",
    [t.cancelled]: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.dashboardTitle}</h1>
        <p className="page-description">{t.dashboardDesc}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <div className="cursor-pointer" onClick={() => navigate("/clients?status=Active")}><StatCard title={t.activeClients} value={clientsList.filter(c => c.status === "Active").length} change={`+3 ${t.thisMonth}`} changeType="positive" icon={Users} /></div>
        <div className="cursor-pointer" onClick={() => navigate("/requests?status=Pending")}><StatCard title={t.pendingRequests} value={8} change={`5 ${t.needsReview}`} changeType="neutral" icon={FileText} /></div>
        <div className="cursor-pointer" onClick={() => navigate("/orders?status=active")}><StatCard title={t.activeOrders} value={ordersList.filter(o => ["Draft","Confirmed","Ready for Delivery"].includes(o.status)).length} change={`+2 ${t.today}`} changeType="positive" icon={ShoppingCart} /></div>
        <div className="cursor-pointer" onClick={() => navigate("/collections?status=Overdue")}><StatCard title={t.overdueCollections} value={3} change={`84,000 ${t.currency} ${t.total}`} changeType="negative" icon={Receipt} /></div>
        <div className="cursor-pointer" onClick={() => navigate("/company-profit")}><StatCard title={t.profitRealized} value={`425${t.thousand}`} change={`+12% ${t.vsLastMonth}`} changeType="positive" icon={TrendingUp} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card lg:col-span-2 cursor-pointer" onClick={() => navigate("/company-profit")}>
          <h3 className="font-semibold text-sm mb-4">{t.revenueVsCost}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }} 
                stroke="hsl(var(--muted-foreground))" 
                style={{ cursor: "pointer" }}
                onClick={(data) => {
                  if (data && data.payload && data.payload.month) {
                    navigate(`/financial-report?month=${data.payload.month}`);
                  }
                }}
              />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Bar 
                dataKey="revenue" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]} 
                name={t.revenue}
                style={{ cursor: "pointer" }}
                onClick={(data) => {
                  if (data && data.month) {
                    navigate(`/financial-report?month=${data.month}`);
                  }
                }}
              />
              <Bar 
                dataKey="cost" 
                fill="hsl(var(--muted-foreground) / 0.3)" 
                radius={[4, 4, 0, 0]} 
                name={t.cost}
                style={{ cursor: "pointer" }}
                onClick={(data) => {
                  if (data && data.month) {
                    navigate(`/financial-report?month=${data.month}`);
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card cursor-pointer" onClick={() => navigate("/collections")}>
          <h3 className="font-semibold text-sm mb-4">{t.collectionStatus}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={collectionData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                {collectionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {collectionData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">{item.name} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card lg:col-span-2">
          <h3 className="font-semibold text-sm mb-4">{t.recentOrders}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.orderNumber}</th>
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
                  <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.totalAmount}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                    <td className="py-2.5 px-3 font-medium">{order.id}</td>
                    <td className="py-2.5 px-3 cursor-pointer hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${order.clientId}`); }}>{order.client}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || "bg-muted text-muted-foreground"}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-end font-medium">{order.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stat-card cursor-pointer" onClick={() => navigate("/inventory")}>
          <h3 className="font-semibold text-sm mb-4">{t.weeklyConsumption}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={consumptionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Line type="monotone" dataKey="consumption" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card flex items-center gap-3 cursor-pointer" onClick={() => navigate("/deliveries?status=Pending")}>
          <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-sm font-semibold">5 {t.pendingDeliveries}</p>
            <p className="text-xs text-muted-foreground">2 {t.delayedMore3Days}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3 cursor-pointer" onClick={() => navigate("/alerts?type=expiring")}>
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold">7 {t.itemsExpiringSoon}</p>
            <p className="text-xs text-muted-foreground">{t.within14Days}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3 cursor-pointer" onClick={() => navigate("/refill?filter=low_stock")}>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">12 {t.itemsNeedRefill}</p>
            <p className="text-xs text-muted-foreground">{t.belowSafety}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
