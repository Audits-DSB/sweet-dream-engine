import {
  Users,
  ShoppingCart,
  FileText,
  Truck,
  Receipt,
  AlertTriangle,
  TrendingUp,
  Building2,
  Clock,
  Package,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const revenueData = [
  { month: "Jan", revenue: 12400, cost: 8200 },
  { month: "Feb", revenue: 15800, cost: 9600 },
  { month: "Mar", revenue: 18200, cost: 11200 },
  { month: "Apr", revenue: 14600, cost: 9800 },
  { month: "May", revenue: 21000, cost: 12400 },
  { month: "Jun", revenue: 19200, cost: 11800 },
];

const collectionData = [
  { name: "Paid", value: 68, color: "hsl(152, 60%, 40%)" },
  { name: "Partial", value: 18, color: "hsl(38, 92%, 50%)" },
  { name: "Overdue", value: 14, color: "hsl(0, 72%, 51%)" },
];

const consumptionTrend = [
  { week: "W1", consumption: 320 },
  { week: "W2", consumption: 450 },
  { week: "W3", consumption: 380 },
  { week: "W4", consumption: 520 },
  { week: "W5", consumption: 490 },
  { week: "W6", consumption: 610 },
];

const recentOrders = [
  { id: "ORD-001", client: "Al Salam Cafe", status: "Delivered", total: "SAR 3,200" },
  { id: "ORD-002", client: "Noor Restaurant", status: "Awaiting Delivery", total: "SAR 5,800" },
  { id: "ORD-003", client: "Green Valley", status: "Draft", total: "SAR 2,100" },
  { id: "ORD-004", client: "Royal Kitchen", status: "Confirmed", total: "SAR 4,500" },
  { id: "ORD-005", client: "Taste House", status: "Partially Delivered", total: "SAR 1,900" },
];

const statusColors: Record<string, string> = {
  "Delivered": "bg-success/10 text-success",
  "Awaiting Delivery": "bg-warning/10 text-warning",
  "Draft": "bg-muted text-muted-foreground",
  "Confirmed": "bg-info/10 text-info",
  "Partially Delivered": "bg-primary/10 text-primary",
};

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Dashboard</h1>
        <p className="page-description">Overview of your operations and financials</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <StatCard title="Active Clients" value={24} change="+3 this month" changeType="positive" icon={Users} />
        <StatCard title="Pending Requests" value={8} change="5 need review" changeType="neutral" icon={FileText} />
        <StatCard title="Active Orders" value={12} change="+2 today" changeType="positive" icon={ShoppingCart} />
        <StatCard title="Overdue Collections" value={3} change="SAR 8,400 total" changeType="negative" icon={Receipt} />
        <StatCard title="Realized Profit" value="SAR 42.5K" change="+12% vs last month" changeType="positive" icon={TrendingUp} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <div className="stat-card lg:col-span-2">
          <h3 className="font-semibold text-sm mb-4">Revenue vs Cost (6 Months)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="cost" fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} name="Cost" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Collection Status */}
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">Collection Status</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={collectionData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
              >
                {collectionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
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

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Orders */}
        <div className="stat-card lg:col-span-2">
          <h3 className="font-semibold text-sm mb-4">Recent Orders</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Order ID</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Client</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium">{order.id}</td>
                    <td className="py-2.5 px-3">{order.client}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">{order.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Consumption Trend */}
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">Weekly Consumption Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={consumptionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line type="monotone" dataKey="consumption" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerts Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-sm font-semibold">5 Deliveries Pending</p>
            <p className="text-xs text-muted-foreground">2 overdue by 3+ days</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold">7 Items Near Expiry</p>
            <p className="text-xs text-muted-foreground">Within next 14 days</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">12 Refill Needed</p>
            <p className="text-xs text-muted-foreground">Below safety stock</p>
          </div>
        </div>
      </div>
    </div>
  );
}
