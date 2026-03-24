import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, TrendingUp, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

type Order = { id: string; client: string; clientId: string; date: string; status: string; totalSelling: string | number };
type Client = { id: string; name: string };

function toNum(v: any): number {
  if (!v) return 0;
  return typeof v === "number" ? v : Number(String(v).replace(/,/g, "")) || 0;
}

const STATUS_COLORS: Record<string, string> = {
  Delivered: "hsl(152, 60%, 40%)", Confirmed: "hsl(215, 70%, 50%)", Draft: "hsl(210, 15%, 70%)",
  Closed: "hsl(38, 60%, 40%)", Cancelled: "hsl(0, 72%, 51%)", Overdue: "hsl(0, 60%, 55%)",
  "Ready for Delivery": "hsl(180, 60%, 45%)", "Awaiting Purchase": "hsl(38, 92%, 50%)",
};

export default function MonthlyReport() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const selectedMonth = searchParams.get("month") || "";
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any[]>("/orders"),
      api.get<any[]>("/clients"),
    ]).then(([ords, cls]) => {
      setOrders((ords || []).map((o: any) => ({
        id: o.id, client: o.client || "", clientId: o.clientId || o.client_id || "",
        date: o.date || "", status: o.status || "", totalSelling: o.totalSelling ?? o.total_selling ?? 0,
      })));
      setClients((cls || []).map((c: any) => ({ id: c.id, name: c.name })));
    }).finally(() => setLoading(false));
  }, []);

  const monthlyOrders = orders.filter(o => {
    if (!selectedMonth) return true;
    return o.date && o.date.startsWith(
      Object.entries({ يناير: "01", فبراير: "02", مارس: "03", أبريل: "04", مايو: "05", يونيو: "06", يوليو: "07", أغسطس: "08", سبتمبر: "09", أكتوبر: "10", نوفمبر: "11", ديسمبر: "12" }).find(([ar]) => selectedMonth.includes(ar))?.[1] || selectedMonth.slice(0, 7)
    );
  });

  const totalRevenue = monthlyOrders.reduce((s, o) => s + toNum(o.totalSelling), 0);
  const totalOrders = monthlyOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const clientOrderCounts = monthlyOrders.reduce((acc, o) => { acc[o.clientId] = (acc[o.clientId] || 0) + 1; return acc; }, {} as Record<string, number>);
  const topClients = Object.entries(clientOrderCounts)
    .map(([clientId, orderCount]) => {
      const c = clients.find(cl => cl.id === clientId);
      return { name: c?.name || clientId, orders: orderCount, id: clientId };
    })
    .sort((a, b) => b.orders - a.orders).slice(0, 5);

  const statusCounts = monthlyOrders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status, value: count, color: STATUS_COLORS[status] || "hsl(38, 92%, 50%)",
  }));

  const dailyData = monthlyOrders.reduce((acc, o) => {
    const day = (o.date || "").slice(8, 10) || "?";
    if (!acc[day]) acc[day] = { day, orders: 0, revenue: 0 };
    acc[day].orders++;
    acc[day].revenue += toNum(o.totalSelling);
    return acc;
  }, {} as Record<string, { day: string; orders: number; revenue: number }>);
  const dailyChartData = Object.values(dailyData).sort((a, b) => a.day.localeCompare(b.day));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />{t.back}
        </Button>
        <div>
          <h1 className="page-header">تقرير {selectedMonth || "جميع الأشهر"}</h1>
          <p className="page-description">ملخص شامل لأداء الأعمال خلال الفترة المحددة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="إجمالي الطلبات" value={totalOrders} change={`${totalOrders} ${t.orders}`} changeType="positive" icon={Calendar} />
        <StatCard title="إجمالي المبيعات" value={`${Math.round(totalRevenue / 1000)}${t.thousand}`} change={`${t.currency} ${totalRevenue.toLocaleString()}`} changeType="positive" icon={DollarSign} />
        <StatCard title="متوسط قيمة الطلب" value={`${Math.round(avgOrderValue / 1000)}${t.thousand}`} change={`${t.currency} ${Math.round(avgOrderValue).toLocaleString()}`} changeType="neutral" icon={TrendingUp} />
        <StatCard title="عدد العملاء النشطين" value={topClients.length} change={`${topClients.length} ${t.activeClients}`} changeType="positive" icon={Users} />
      </div>

      {totalOrders === 0 ? (
        <div className="stat-card py-20 text-center text-muted-foreground">لا توجد طلبات في هذه الفترة</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>الأداء اليومي</CardTitle><CardDescription>الطلبات والمبيعات على مدار الفترة</CardDescription></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="الطلبات" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>حالات الطلبات</CardTitle><CardDescription>توزيع الطلبات حسب الحالة</CardDescription></CardHeader>
              <CardContent>
                {statusData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                          {statusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
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
                  </>
                ) : <p className="text-center py-10 text-muted-foreground">لا توجد بيانات</p>}
              </CardContent>
            </Card>
          </div>

          {topClients.length > 0 && (
            <Card>
              <CardHeader><CardTitle>أكثر العملاء طلباً</CardTitle><CardDescription>قائمة بأكثر 5 عملاء نشاطاً خلال الفترة</CardDescription></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topClients.map((client, index) => (
                    <div key={client.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">{index + 1}</div>
                        <div>
                          <p className="font-medium">{client.name}</p>
                          <p className="text-sm text-muted-foreground">{client.orders} طلب</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/clients/${client.id}`)}>عرض التفاصيل</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>طلبات الفترة</CardTitle><CardDescription>جميع الطلبات المسجلة خلال الفترة</CardDescription></CardHeader>
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
                      <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                        <td className="py-2.5 px-3 font-medium text-primary">{order.id}</td>
                        <td className="py-2.5 px-3">{order.client}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{order.date}</td>
                        <td className="py-2.5 px-3"><StatusBadge status={order.status} /></td>
                        <td className="py-2.5 px-3 text-end font-medium">{toNum(order.totalSelling).toLocaleString()} {t.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
