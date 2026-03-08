import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Package, Receipt, ClipboardCheck, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const clientData: Record<string, any> = {
  "C001": {
    id: "C001", name: "Al Salam Cafe", contact: "Khalid Ahmad", email: "khalid@alsalam.sa",
    phone: "+966 50 111 2233", city: "Riyadh", address: "King Fahd Road, Riyadh 12345",
    status: "Active", joinDate: "2024-03-15", totalOrders: 18, totalDelivered: 16,
    outstanding: 3200, totalPaid: 28500, currentInventoryValue: 12400,
    consumptionData: [
      { week: "W1", value: 1200 }, { week: "W2", value: 1500 }, { week: "W3", value: 1100 },
      { week: "W4", value: 1800 }, { week: "W5", value: 1400 }, { week: "W6", value: 2100 },
    ],
    recentOrders: [
      { id: "ORD-042", date: "2025-03-01", total: "SAR 3,200", status: "Delivered" },
      { id: "ORD-038", date: "2025-02-20", total: "SAR 2,800", status: "Delivered" },
      { id: "ORD-035", date: "2025-02-12", total: "SAR 1,600", status: "Closed" },
    ],
    inventoryItems: [
      { material: "Arabica Coffee Beans", qty: 45, unit: "kg", expiry: "2025-06-15", status: "In Stock" },
      { material: "Green Tea Leaves", qty: 8, unit: "kg", expiry: "2025-04-20", status: "Low Stock" },
      { material: "Sugar Syrup", qty: 30, unit: "L", expiry: "2025-12-01", status: "In Stock" },
      { material: "Milk Powder", qty: 2, unit: "kg", expiry: "2025-03-25", status: "Low Stock" },
    ],
  },
};

// Default fallback
const defaultClient = {
  id: "C001", name: "Al Salam Cafe", contact: "Khalid Ahmad", email: "khalid@alsalam.sa",
  phone: "+966 50 111 2233", city: "Riyadh", address: "King Fahd Road, Riyadh 12345",
  status: "Active", joinDate: "2024-03-15", totalOrders: 18, totalDelivered: 16,
  outstanding: 3200, totalPaid: 28500, currentInventoryValue: 12400,
  consumptionData: [
    { week: "W1", value: 1200 }, { week: "W2", value: 1500 }, { week: "W3", value: 1100 },
    { week: "W4", value: 1800 }, { week: "W5", value: 1400 }, { week: "W6", value: 2100 },
  ],
  recentOrders: [
    { id: "ORD-042", date: "2025-03-01", total: "SAR 3,200", status: "Delivered" },
    { id: "ORD-038", date: "2025-02-20", total: "SAR 2,800", status: "Delivered" },
  ],
  inventoryItems: [
    { material: "Arabica Coffee Beans", qty: 45, unit: "kg", expiry: "2025-06-15", status: "In Stock" },
    { material: "Green Tea Leaves", qty: 8, unit: "kg", expiry: "2025-04-20", status: "Low Stock" },
  ],
};

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = clientData[id || ""] || defaultClient;

  const stats = [
    { label: "Total Orders", value: client.totalOrders, icon: Package },
    { label: "Total Paid", value: `SAR ${client.totalPaid.toLocaleString()}`, icon: Receipt },
    { label: "Outstanding", value: `SAR ${client.outstanding.toLocaleString()}`, icon: TrendingUp },
    { label: "Inventory Value", value: `SAR ${client.currentInventoryValue.toLocaleString()}`, icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/clients")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-header">{client.name}</h1>
            <StatusBadge status={client.status} />
          </div>
          <p className="page-description">{client.id} · Joined {client.joinDate}</p>
        </div>
        <Button variant="outline" size="sm">Edit Client</Button>
      </div>

      {/* Contact Info */}
      <div className="stat-card">
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />{client.email}</div>
          <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />{client.phone}</div>
          <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" />{client.address}</div>
          <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" />Joined {client.joinDate}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="stat-card">
            <h3 className="font-semibold text-sm mb-4">Consumption Trend (Last 6 Weeks)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={client.consumptionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <div className="stat-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Order ID</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {client.recentOrders.map((order: any) => (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium">{order.id}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{order.date}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={order.status} /></td>
                    <td className="py-2.5 px-3 text-right font-medium">{order.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="inventory">
          <div className="stat-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Material</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Qty</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Unit</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Expiry</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {client.inventoryItems.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium">{item.material}</td>
                    <td className="py-2.5 px-3 text-right">{item.qty}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{item.unit}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{item.expiry}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
