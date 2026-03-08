import { useState } from "react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, FileText, TrendingUp, Users, Package } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line,
} from "recharts";

const clientRevenue = [
  { client: "مركز نور", revenue: 284000, orders: 12 },
  { client: "عيادة د. أحمد", revenue: 226000, orders: 15 },
  { client: "المركز الملكي", revenue: 182000, orders: 8 },
  { client: "عيادة بلو مون", revenue: 148000, orders: 6 },
  { client: "جرين فالي", revenue: 112000, orders: 7 },
  { client: "سمايل هاوس", revenue: 84000, orders: 5 },
  { client: "سبايس جاردن", revenue: 62000, orders: 4 },
];

const materialUsage = [
  { material: "حشو كمبوزيت ضوئي", totalUsed: 480, unit: "عبوة", revenue: 576000 },
  { material: "إبر تخدير", totalUsed: 210, unit: "علبة", revenue: 199500 },
  { material: "مادة طبع سيليكون", totalUsed: 320, unit: "عبوة", revenue: 144000 },
  { material: "قفازات لاتكس", totalUsed: 150, unit: "كرتونة", revenue: 60000 },
  { material: "مبيض أسنان", totalUsed: 25, unit: "عبوة", revenue: 70000 },
  { material: "فرز دوارة", totalUsed: 18, unit: "عبوة", revenue: 36000 },
];

const monthlyOrders = [
  { month: "أكتوبر", orders: 18, revenue: 380000 },
  { month: "نوفمبر", orders: 22, revenue: 420000 },
  { month: "ديسمبر", orders: 19, revenue: 390000 },
  { month: "يناير", orders: 25, revenue: 480000 },
  { month: "فبراير", orders: 28, revenue: 520000 },
  { month: "مارس", orders: 23, revenue: 460000 },
];

const reports = [
  { name: "تقرير إيرادات العملاء", desc: "تفصيل الإيرادات حسب العميل مع عدد الطلبات", icon: Users },
  { name: "تقرير استهلاك المواد", desc: "الاستهلاك والإيرادات حسب نوع المادة", icon: Package },
  { name: "ملخص الأرباح والخسائر", desc: "الإيرادات والتكلفة والربح لكل شهر", icon: TrendingUp },
  { name: "تقرير حالة المخزون", desc: "مستويات المخزون الحالية وتواريخ الانتهاء والتنبيهات", icon: Package },
  { name: "تقرير أعمار الديون", desc: "الفواتير المعلقة مجمعة حسب فترة التأخير", icon: FileText },
  { name: "تقرير المراجعات", desc: "معدلات إتمام المراجعة واتجاهات التباين", icon: FileText },
];

export default function ReportsPage() {
  const totalRevenue = clientRevenue.reduce((s, c) => s + c.revenue, 0);
  const totalOrders = monthlyOrders.reduce((s, m) => s + m.orders, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">التقارير والتحليلات</h1>
        <p className="page-description">تقارير شاملة وتصدير البيانات</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="إجمالي الإيرادات" value={`${(totalRevenue / 1000).toFixed(0)} ألف ج.م`} change="جميع العملاء" changeType="positive" icon={TrendingUp} />
        <StatCard title="إجمالي الطلبات" value={totalOrders} change="آخر 6 أشهر" changeType="neutral" icon={BarChart3} />
        <StatCard title="العملاء النشطين" value={clientRevenue.length} change="لديهم طلبات" changeType="neutral" icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">الإيرادات حسب العميل</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={clientRevenue} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis dataKey="client" type="category" width={110} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="الإيرادات (ج.م)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">اتجاه الطلبات الشهرية</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyOrders}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Line type="monotone" dataKey="orders" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} name="الطلبات" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="stat-card overflow-x-auto">
        <h3 className="font-semibold text-sm mb-4">ملخص استهلاك المواد</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">المادة</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">الكمية المستخدمة</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">الوحدة</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">الإيرادات</th>
            </tr>
          </thead>
          <tbody>
            {materialUsage.map((m) => (
              <tr key={m.material} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2.5 px-3 font-medium">{m.material}</td>
                <td className="py-2.5 px-3 text-right">{m.totalUsed}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{m.unit}</td>
                <td className="py-2.5 px-3 text-right font-medium">{m.revenue.toLocaleString()} ج.م</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-3">التقارير المتاحة</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reports.map((r) => (
            <div key={r.name} className="stat-card flex items-start gap-3 !p-4">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <r.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
