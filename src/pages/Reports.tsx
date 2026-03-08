import { useState } from "react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, FileText, TrendingUp, Users, Package } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line,
} from "recharts";

const clientRevenue = [
  { client: "Noor Restaurant", revenue: 28400, orders: 12 },
  { client: "Al Salam Cafe", revenue: 22600, orders: 15 },
  { client: "Royal Kitchen", revenue: 18200, orders: 8 },
  { client: "Blue Moon Cafe", revenue: 14800, orders: 6 },
  { client: "Green Valley", revenue: 11200, orders: 7 },
  { client: "Taste House", revenue: 8400, orders: 5 },
  { client: "Spice Garden", revenue: 6200, orders: 4 },
];

const materialUsage = [
  { material: "Arabica Coffee", totalUsed: 480, unit: "kg", revenue: 57600 },
  { material: "Green Tea", totalUsed: 210, unit: "kg", revenue: 19950 },
  { material: "Sugar Syrup", totalUsed: 320, unit: "L", revenue: 14400 },
  { material: "Milk Powder", totalUsed: 150, unit: "kg", revenue: 6000 },
  { material: "Vanilla Extract", totalUsed: 25, unit: "L", revenue: 7000 },
  { material: "Cinnamon", totalUsed: 18, unit: "kg", revenue: 3600 },
];

const monthlyOrders = [
  { month: "Oct", orders: 18, revenue: 38000 },
  { month: "Nov", orders: 22, revenue: 42000 },
  { month: "Dec", orders: 19, revenue: 39000 },
  { month: "Jan", orders: 25, revenue: 48000 },
  { month: "Feb", orders: 28, revenue: 52000 },
  { month: "Mar", orders: 23, revenue: 46000 },
];

const reports = [
  { name: "Client Revenue Report", desc: "Revenue breakdown by client with order counts", icon: Users },
  { name: "Material Usage Report", desc: "Consumption and revenue by material type", icon: Package },
  { name: "Monthly P&L Summary", desc: "Revenue, cost, and profit for each month", icon: TrendingUp },
  { name: "Inventory Status Report", desc: "Current stock levels, expiry dates, and alerts", icon: Package },
  { name: "Collection Aging Report", desc: "Outstanding invoices grouped by age bracket", icon: FileText },
  { name: "Audit Compliance Report", desc: "Audit completion rates and discrepancy trends", icon: FileText },
];

export default function ReportsPage() {
  const totalRevenue = clientRevenue.reduce((s, c) => s + c.revenue, 0);
  const totalOrders = monthlyOrders.reduce((s, m) => s + m.orders, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Reports & Analytics</h1>
        <p className="page-description">Comprehensive reporting and data export</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Revenue" value={`SAR ${(totalRevenue / 1000).toFixed(0)}K`} change="All clients" changeType="positive" icon={TrendingUp} />
        <StatCard title="Total Orders" value={totalOrders} change="Last 6 months" changeType="neutral" icon={BarChart3} />
        <StatCard title="Active Clients" value={clientRevenue.length} change="With orders" changeType="neutral" icon={Users} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">Revenue by Client</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={clientRevenue} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis dataKey="client" type="category" width={110} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Revenue (SAR)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">Monthly Order Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyOrders}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Line type="monotone" dataKey="orders" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} name="Orders" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Materials Table */}
      <div className="stat-card overflow-x-auto">
        <h3 className="font-semibold text-sm mb-4">Material Usage Summary</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Material</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Total Used</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Unit</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {materialUsage.map((m) => (
              <tr key={m.material} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2.5 px-3 font-medium">{m.material}</td>
                <td className="py-2.5 px-3 text-right">{m.totalUsed}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{m.unit}</td>
                <td className="py-2.5 px-3 text-right font-medium">SAR {m.revenue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Downloadable Reports */}
      <div>
        <h3 className="font-semibold text-sm mb-3">Available Reports</h3>
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
