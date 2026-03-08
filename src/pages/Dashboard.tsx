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
  { month: "يناير", revenue: 124000, cost: 82000 },
  { month: "فبراير", revenue: 158000, cost: 96000 },
  { month: "مارس", revenue: 182000, cost: 112000 },
  { month: "أبريل", revenue: 146000, cost: 98000 },
  { month: "مايو", revenue: 210000, cost: 124000 },
  { month: "يونيو", revenue: 192000, cost: 118000 },
];

const collectionData = [
  { name: "مدفوع", value: 68, color: "hsl(152, 60%, 40%)" },
  { name: "جزئي", value: 18, color: "hsl(38, 92%, 50%)" },
  { name: "متأخر", value: 14, color: "hsl(0, 72%, 51%)" },
];

const consumptionTrend = [
  { week: "أ1", consumption: 320 },
  { week: "أ2", consumption: 450 },
  { week: "أ3", consumption: 380 },
  { week: "أ4", consumption: 520 },
  { week: "أ5", consumption: 490 },
  { week: "أ6", consumption: 610 },
];

const recentOrders = [
  { id: "ORD-001", client: "عيادة د. أحمد", status: "تم التسليم", total: "32,000 ج.م" },
  { id: "ORD-002", client: "مركز نور لطب الأسنان", status: "في انتظار التسليم", total: "58,000 ج.م" },
  { id: "ORD-003", client: "عيادة جرين فالي", status: "مسودة", total: "21,000 ج.م" },
  { id: "ORD-004", client: "المركز الملكي للأسنان", status: "مؤكد", total: "45,000 ج.م" },
  { id: "ORD-005", client: "عيادة سمايل هاوس", status: "تسليم جزئي", total: "19,000 ج.م" },
];

const statusColors: Record<string, string> = {
  "تم التسليم": "bg-success/10 text-success",
  "في انتظار التسليم": "bg-warning/10 text-warning",
  "مسودة": "bg-muted text-muted-foreground",
  "مؤكد": "bg-info/10 text-info",
  "تسليم جزئي": "bg-primary/10 text-primary",
};

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">لوحة التحكم</h1>
        <p className="page-description">نظرة عامة على العمليات والماليات</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <StatCard title="العملاء النشطين" value={24} change="+3 هذا الشهر" changeType="positive" icon={Users} />
        <StatCard title="طلبات معلقة" value={8} change="5 بحاجة مراجعة" changeType="neutral" icon={FileText} />
        <StatCard title="أوامر نشطة" value={12} change="+2 اليوم" changeType="positive" icon={ShoppingCart} />
        <StatCard title="تحصيلات متأخرة" value={3} change="84,000 ج.م إجمالي" changeType="negative" icon={Receipt} />
        <StatCard title="الأرباح المحققة" value="425 ألف ج.م" change="+12% مقارنة بالشهر الماضي" changeType="positive" icon={TrendingUp} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <div className="stat-card lg:col-span-2">
          <h3 className="font-semibold text-sm mb-4">الإيرادات مقابل التكلفة (6 أشهر)</h3>
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
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="الإيرادات" />
              <Bar dataKey="cost" fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} name="التكلفة" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Collection Status */}
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">حالة التحصيل</h3>
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
          <h3 className="font-semibold text-sm mb-4">أحدث الطلبات</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">رقم الطلب</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">العميل</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">الحالة</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">الإجمالي</th>
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
          <h3 className="font-semibold text-sm mb-4">معدل الاستهلاك الأسبوعي</h3>
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
            <p className="text-sm font-semibold">5 توصيلات معلقة</p>
            <p className="text-xs text-muted-foreground">2 متأخرة بأكثر من 3 أيام</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold">7 أصناف قاربت على الانتهاء</p>
            <p className="text-xs text-muted-foreground">خلال الـ 14 يوم القادمة</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">12 صنف يحتاج إعادة تعبئة</p>
            <p className="text-xs text-muted-foreground">أقل من حد الأمان</p>
          </div>
        </div>
      </div>
    </div>
  );
}
