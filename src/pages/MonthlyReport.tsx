import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, TrendingUp, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { ordersList, clientsList } from "@/data/store";

export default function MonthlyReport() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const selectedMonth = searchParams.get("month") || "";

  // تصفية الطلبات حسب الشهر المحدد (محاكاة البيانات)
  const monthlyOrders = ordersList.filter(order => {
    // في التطبيق الحقيقي ستكون المقارنة مع تاريخ فعلي
    return order.date.includes("2025-03"); // مثال للشهر الحالي
  });

  // حساب أكثر العملاء طلباً
  const clientOrderCounts = monthlyOrders.reduce((acc, order) => {
    acc[order.clientId] = (acc[order.clientId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topClients = Object.entries(clientOrderCounts)
    .map(([clientId, orderCount]) => {
      const client = clientsList.find(c => c.id === clientId);
      return {
        name: client?.name || "غير معروف",
        orders: orderCount,
        id: clientId
      };
    })
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 5);

  // إحصائيات حالات الطلبات
  const statusCounts = monthlyOrders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status,
    value: count,
    color: status === "Delivered" ? "hsl(152, 60%, 40%)" : 
           status === "Confirmed" ? "hsl(215, 70%, 50%)" : 
           status === "Draft" ? "hsl(210, 15%, 70%)" : 
           "hsl(38, 92%, 50%)"
  }));

  // إحصائيات يومية للشهر
  const dailyData = [
    { day: "1", orders: 3, revenue: 85000 },
    { day: "5", orders: 2, revenue: 53000 },
    { day: "10", orders: 4, revenue: 112000 },
    { day: "15", orders: 1, revenue: 32000 },
    { day: "20", orders: 3, revenue: 97000 },
    { day: "25", orders: 2, revenue: 61000 }
  ];

  const totalRevenue = monthlyOrders.reduce((sum, order) => {
    return sum + parseInt(order.totalSelling.replace(/[^\d]/g, ""));
  }, 0);

  const totalOrders = monthlyOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t.back}
        </Button>
        <div>
          <h1 className="page-header">تقرير شهر {selectedMonth}</h1>
          <p className="page-description">ملخص شامل لأداء الأعمال خلال الشهر المحدد</p>
        </div>
      </div>

      {/* بطاقات الإحصائيات الرئيسية */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي الطلبات"
          value={totalOrders}
          change={`${totalOrders} ${t.orders}`}
          changeType="positive"
          icon={Calendar}
        />
        <StatCard
          title="إجمالي المبيعات"
          value={`${Math.round(totalRevenue / 1000)}${t.thousand}`}
          change={`${t.currency} ${totalRevenue.toLocaleString()}`}
          changeType="positive"
          icon={DollarSign}
        />
        <StatCard
          title="متوسط قيمة الطلب"
          value={`${Math.round(avgOrderValue / 1000)}${t.thousand}`}
          change={`${t.currency} ${avgOrderValue.toLocaleString()}`}
          changeType="neutral"
          icon={TrendingUp}
        />
        <StatCard
          title="عدد العملاء النشطين"
          value={topClients.length}
          change={`${topClients.length} ${t.activeClients}`}
          changeType="positive"
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* الرسم البياني اليومي */}
        <Card>
          <CardHeader>
            <CardTitle>الأداء اليومي</CardTitle>
            <CardDescription>الطلبات والمبيعات على مدار الشهر</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))", 
                    borderRadius: "8px", 
                    fontSize: "12px" 
                  }}
                />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="الطلبات" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* حالات الطلبات */}
        <Card>
          <CardHeader>
            <CardTitle>حالات الطلبات</CardTitle>
            <CardDescription>توزيع الطلبات حسب الحالة</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie 
                  data={statusData} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={50} 
                  outerRadius={80} 
                  paddingAngle={4} 
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))", 
                    borderRadius: "8px", 
                    fontSize: "12px" 
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name} ({item.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* أكثر العملاء طلباً */}
      <Card>
        <CardHeader>
          <CardTitle>أكثر العملاء طلباً</CardTitle>
          <CardDescription>قائمة بأكثر 5 عملاء نشاطاً خلال الشهر</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topClients.map((client, index) => (
              <div key={client.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{client.name}</p>
                    <p className="text-sm text-muted-foreground">{client.orders} طلب</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  عرض التفاصيل
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* قائمة الطلبات التفصيلية */}
      <Card>
        <CardHeader>
          <CardTitle>طلبات الشهر</CardTitle>
          <CardDescription>جميع الطلبات المسجلة خلال الشهر</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">رقم الطلب</th>
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">العميل</th>
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">التاريخ</th>
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">الحالة</th>
                  <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {monthlyOrders.map((order) => (
                  <tr 
                    key={order.id} 
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <td className="py-2.5 px-3 font-medium">{order.id}</td>
                    <td className="py-2.5 px-3">{order.client}</td>
                    <td className="py-2.5 px-3">{order.date}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        order.status === "Delivered" ? "bg-success/10 text-success" :
                        order.status === "Confirmed" ? "bg-info/10 text-info" :
                        order.status === "Draft" ? "bg-muted text-muted-foreground" :
                        "bg-warning/10 text-warning"
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-end font-medium">{order.totalSelling}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}