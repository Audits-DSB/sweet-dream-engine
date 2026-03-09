import { useState } from "react";
import {
  Users, ShoppingCart, FileText, Truck, Receipt, AlertTriangle, TrendingUp, Building2, Clock, Package,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Sector,
} from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { WorkflowBanner } from "@/components/WorkflowBanner";
import { clientsList, ordersList } from "@/data/store";

export default function Dashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeSlice, setActiveSlice] = useState<number | null>(null);
  const [activeWeek, setActiveWeek] = useState<number | null>(null);

  const revenueData = [
    { month: t.jan, revenue: 124000, cost: 82000 },
    { month: t.feb, revenue: 158000, cost: 96000 },
    { month: t.mar, revenue: 182000, cost: 112000 },
    { month: t.apr, revenue: 146000, cost: 98000 },
    { month: t.may, revenue: 210000, cost: 124000 },
    { month: t.jun, revenue: 192000, cost: 118000 },
  ];

  const collectionData = [
    { name: t.paid, value: 68, color: "hsl(152, 60%, 40%)", amount: "523,400 EGP", clients: 12, statusFilter: "Paid",
      details: [
        { client: "عيادة جرين فالي", clientId: "C003", order: "ORD-046", amount: "21,000 EGP" },
        { client: "عيادة سمايل هاوس", clientId: "C005", order: "ORD-043", amount: "12,000 EGP" },
        { client: "عيادة د. أحمد", clientId: "C001", order: "ORD-042", amount: "41,000 EGP" },
      ]
    },
    { name: t.partial, value: 18, color: "hsl(38, 92%, 50%)", amount: "138,600 EGP", clients: 4, statusFilter: "Partially Paid",
      details: [
        { client: "مركز نور لطب الأسنان", clientId: "C002", order: "ORD-047", amount: "45,000 EGP متبقي" },
        { client: "المركز الملكي للأسنان", clientId: "C004", order: "ORD-045", amount: "32,000 EGP متبقي" },
      ]
    },
    { name: t.overdue, value: 14, color: "hsl(0, 72%, 51%)", amount: "107,800 EGP", clients: 3, statusFilter: "Overdue",
      details: [
        { client: "عيادة بلو مون", clientId: "C006", order: "ORD-044", amount: "56,000 EGP" },
        { client: "مركز سبايس جاردن", clientId: "C007", order: "ORD-041", amount: "16,000 EGP متبقي" },
        { client: "عيادة د. أحمد", clientId: "C001", order: "ORD-048", amount: "32,000 EGP" },
      ]
    },
  ];

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.9} />
        <Sector cx={cx} cy={cy} innerRadius={outerRadius + 10} outerRadius={outerRadius + 14} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      </g>
    );
  };

  const consumptionTrend = [
    { week: "W1", consumption: 320, topMaterials: [{ name: "حشو كمبوزيت", qty: 45 }, { name: "إبر تخدير", qty: 30 }], totalOrders: 4 },
    { week: "W2", consumption: 450, topMaterials: [{ name: "قفازات لاتكس", qty: 60 }, { name: "حشو كمبوزيت", qty: 38 }], totalOrders: 6 },
    { week: "W3", consumption: 380, topMaterials: [{ name: "إبر تخدير", qty: 42 }, { name: "مواد تعقيم", qty: 35 }], totalOrders: 5 },
    { week: "W4", consumption: 520, topMaterials: [{ name: "حشو كمبوزيت", qty: 55 }, { name: "قفازات لاتكس", qty: 48 }], totalOrders: 7 },
    { week: "W5", consumption: 490, topMaterials: [{ name: "مواد تعقيم", qty: 50 }, { name: "إبر تخدير", qty: 40 }], totalOrders: 6 },
    { week: "W6", consumption: 610, topMaterials: [{ name: "حشو كمبوزيت", qty: 70 }, { name: "قفازات لاتكس", qty: 55 }], totalOrders: 8 },
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
      <WorkflowBanner />
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
        <div className="stat-card lg:col-span-2">
          <h3 className="font-semibold text-sm mb-4">{t.revenueVsCost}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart 
              data={revenueData}
              onClick={(data) => {
                if (data && data.activeLabel) {
                  navigate(`/monthly-report?month=${encodeURIComponent(data.activeLabel)}`);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                cursor={{ fill: "hsl(var(--muted) / 0.1)" }}
              />
              <Bar 
                dataKey="revenue" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]} 
                name={t.revenue}
                className="cursor-pointer"
              />
              <Bar 
                dataKey="cost" 
                fill="hsl(var(--muted-foreground) / 0.3)" 
                radius={[4, 4, 0, 0]} 
                name={t.cost}
                className="cursor-pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">{t.collectionStatus}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie 
                data={collectionData} 
                cx="50%" cy="50%" 
                innerRadius={50} outerRadius={75} 
                paddingAngle={4} dataKey="value"
                activeIndex={activeSlice !== null ? activeSlice : undefined}
                activeShape={renderActiveShape}
                onMouseEnter={(_, index) => setActiveSlice(index)}
                onClick={(_, index) => setActiveSlice(prev => prev === index ? null : index)}
                className="cursor-pointer outline-none"
              >
                {collectionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} opacity={activeSlice !== null && activeSlice !== index ? 0.4 : 1} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>

          {activeSlice !== null && (
            <div className="mx-auto max-w-[280px] rounded-lg border border-border p-3 mb-2 transition-all animate-fade-in" style={{ borderColor: collectionData[activeSlice].color }}>
              <div className="text-center">
                <div className="text-sm font-bold" style={{ color: collectionData[activeSlice].color }}>{collectionData[activeSlice].name}</div>
                <div className="text-lg font-extrabold mt-0.5">{collectionData[activeSlice].value}%</div>
                <div className="text-xs text-muted-foreground">{collectionData[activeSlice].amount} · {collectionData[activeSlice].clients} {t.client}</div>
              </div>
              <div className="mt-2 pt-2 border-t border-border space-y-1.5">
                {collectionData[activeSlice].details.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs gap-2">
                    <span 
                      className="font-medium text-primary cursor-pointer hover:underline truncate"
                      onClick={() => navigate(`/clients/${d.clientId}`)}
                    >{d.client}</span>
                    <span className="text-muted-foreground whitespace-nowrap">{d.amount}</span>
                  </div>
                ))}
              </div>
              <button 
                className="w-full mt-2 text-xs font-semibold py-1.5 rounded-md transition-colors hover:opacity-80 text-white"
                style={{ backgroundColor: collectionData[activeSlice].color }}
                onClick={() => navigate(`/collections?status=${collectionData[activeSlice].statusFilter}`)}
              >
                عرض الكل ←
              </button>
            </div>
          )}

          <div className="flex justify-center gap-4 mt-2">
            {collectionData.map((item, idx) => (
              <div 
                key={item.name} 
                className="flex items-center gap-1.5 text-xs cursor-pointer transition-opacity"
                style={{ opacity: activeSlice !== null && activeSlice !== idx ? 0.4 : 1 }}
                onClick={() => setActiveSlice(prev => prev === idx ? null : idx)}
              >
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

        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">{t.weeklyConsumption}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={consumptionTrend} onClick={(e) => {
              if (e && e.activeTooltipIndex !== undefined) {
                setActiveWeek(prev => prev === e.activeTooltipIndex ? null : e.activeTooltipIndex!);
              }
            }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Line 
                type="monotone" dataKey="consumption" stroke="hsl(var(--primary))" strokeWidth={2} 
                dot={(props: any) => {
                  const isActive = activeWeek === props.index;
                  return (
                    <circle 
                      cx={props.cx} cy={props.cy} 
                      r={isActive ? 7 : 4} 
                      fill={isActive ? "hsl(var(--primary))" : "hsl(var(--background))"}
                      stroke="hsl(var(--primary))" strokeWidth={2}
                      className="cursor-pointer"
                    />
                  );
                }}
                activeDot={{ r: 7, fill: "hsl(var(--primary))", stroke: "hsl(var(--primary-foreground))", strokeWidth: 2, className: "cursor-pointer" }}
              />
            </LineChart>
          </ResponsiveContainer>

          {activeWeek !== null && consumptionTrend[activeWeek] && (
            <div className="mx-auto max-w-[280px] rounded-lg border border-primary p-3 mt-2 transition-all animate-fade-in">
              <div className="text-center">
                <div className="text-sm font-bold text-primary">الأسبوع {consumptionTrend[activeWeek].week}</div>
                <div className="text-lg font-extrabold mt-0.5">{consumptionTrend[activeWeek].consumption} {t.unit}</div>
                <div className="text-xs text-muted-foreground">{consumptionTrend[activeWeek].totalOrders} {t.orders}</div>
              </div>
              <div className="mt-2 pt-2 border-t border-border space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground mb-1">الأكثر استهلاكاً:</div>
                {consumptionTrend[activeWeek].topMaterials.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs gap-2">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-muted-foreground">{m.qty} {t.unit}</span>
                  </div>
                ))}
              </div>
              <button 
                className="w-full mt-2 text-xs font-semibold py-1.5 rounded-md transition-colors bg-primary text-primary-foreground hover:opacity-90"
                onClick={() => navigate("/inventory")}
              >
                عرض المخزون ←
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: Clock,
            iconClass: "text-warning",
            bgClass: "bg-warning/10",
            title: `5 ${t.pendingDeliveries}`,
            sub: `2 ${t.delayedMore3Days}`,
            href: "/deliveries?status=Pending",
          },
          {
            icon: AlertTriangle,
            iconClass: "text-destructive",
            bgClass: "bg-destructive/10",
            title: `7 ${t.itemsExpiringSoon}`,
            sub: t.within14Days,
            href: "/alerts?type=expiring",
          },
          {
            icon: Package,
            iconClass: "text-primary",
            bgClass: "bg-primary/10",
            title: `12 ${t.itemsNeedRefill}`,
            sub: t.belowSafety,
            href: "/refill?filter=low_stock",
          },
        ].map((card) => (
          <div
            key={card.href}
            className="stat-card flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors group"
            onClick={() => navigate(card.href)}
          >
            <div className={`h-10 w-10 rounded-lg ${card.bgClass} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
              <card.icon className={`h-5 w-5 ${card.iconClass}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{card.title}</p>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </div>
            <div className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors text-lg ltr:ml-auto rtl:mr-auto">›</div>
          </div>
        ))}
      </div>
    </div>
  );
}
