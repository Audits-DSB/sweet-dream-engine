import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Eye, MoreHorizontal, Truck, FileText, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mockOrders = [
  { id: "ORD-048", client: "Al Salam Cafe", date: "2025-03-06", lines: 4, totalSelling: "SAR 3,200", totalCost: "SAR 2,100", splitMode: "Equal", deliveryFee: 50, status: "Draft", source: "REQ-001" },
  { id: "ORD-047", client: "Noor Restaurant", date: "2025-03-05", lines: 7, totalSelling: "SAR 8,500", totalCost: "SAR 5,800", splitMode: "Contribution", deliveryFee: 75, status: "Confirmed", source: "REQ-002" },
  { id: "ORD-046", client: "Green Valley Lounge", date: "2025-03-04", lines: 3, totalSelling: "SAR 2,100", totalCost: "SAR 1,400", splitMode: "Equal", deliveryFee: 50, status: "Ready for Delivery", source: "REQ-003" },
  { id: "ORD-045", client: "Royal Kitchen", date: "2025-03-03", lines: 5, totalSelling: "SAR 4,800", totalCost: "SAR 3,200", splitMode: "Equal", deliveryFee: 0, status: "Delivered", source: "Manual" },
  { id: "ORD-044", client: "Blue Moon Cafe", date: "2025-03-01", lines: 6, totalSelling: "SAR 5,600", totalCost: "SAR 3,800", splitMode: "Contribution", deliveryFee: 50, status: "Partially Delivered", source: "REQ-006" },
  { id: "ORD-043", client: "Taste House", date: "2025-02-28", lines: 2, totalSelling: "SAR 1,200", totalCost: "SAR 800", splitMode: "Equal", deliveryFee: 50, status: "Invoiced", source: "Manual" },
  { id: "ORD-042", client: "Al Salam Cafe", date: "2025-02-25", lines: 5, totalSelling: "SAR 4,100", totalCost: "SAR 2,700", splitMode: "Equal", deliveryFee: 50, status: "Closed", source: "REQ-008" },
  { id: "ORD-041", client: "Spice Garden", date: "2025-02-22", lines: 3, totalSelling: "SAR 2,400", totalCost: "SAR 1,600", splitMode: "Equal", deliveryFee: 0, status: "Awaiting Purchase", source: "REQ-007" },
  { id: "ORD-040", client: "Royal Kitchen", date: "2025-02-20", lines: 4, totalSelling: "SAR 3,600", totalCost: "SAR 2,400", splitMode: "Contribution", deliveryFee: 75, status: "Cancelled", source: "Manual" },
];

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const filtered = mockOrders.filter((o) => {
    const matchSearch = !search || o.client.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || o.status === filters.status;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Orders</h1>
        <p className="page-description">{mockOrders.length} orders · {mockOrders.filter(o => ["Draft", "Confirmed", "Ready for Delivery"].includes(o.status)).length} active</p>
      </div>

      <DataToolbar
        searchPlaceholder="Search orders..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "Status", value: "status", options: [
            { label: "Draft", value: "Draft" },
            { label: "Confirmed", value: "Confirmed" },
            { label: "Awaiting Purchase", value: "Awaiting Purchase" },
            { label: "Ready for Delivery", value: "Ready for Delivery" },
            { label: "Partially Delivered", value: "Partially Delivered" },
            { label: "Delivered", value: "Delivered" },
            { label: "Invoiced", value: "Invoiced" },
            { label: "Closed", value: "Closed" },
            { label: "Cancelled", value: "Cancelled" },
          ]},
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("orders", ["Order ID","Client","Date","Lines","Selling","Cost","Split","Source","Status"], filtered.map(o => [o.id, o.client, o.date, o.lines, o.totalSelling, o.totalCost, o.splitMode, o.source, o.status]))}
        actions={<Button size="sm" className="h-9" onClick={() => toast.info("New order form coming soon")}><Plus className="h-3.5 w-3.5 mr-1.5" />New Order</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Order ID</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Client</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Lines</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Selling</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Cost</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Split</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Source</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                <td className="py-3 px-3 font-mono text-xs font-medium">{order.id}</td>
                <td className="py-3 px-3 font-medium">{order.client}</td>
                <td className="py-3 px-3 text-muted-foreground">{order.date}</td>
                <td className="py-3 px-3 text-right">{order.lines}</td>
                <td className="py-3 px-3 text-right font-medium">{order.totalSelling}</td>
                <td className="py-3 px-3 text-right text-muted-foreground">{order.totalCost}</td>
                <td className="py-3 px-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{order.splitMode}</span></td>
                <td className="py-3 px-3 text-xs text-muted-foreground">{order.source}</td>
                <td className="py-3 px-3"><StatusBadge status={order.status} /></td>
                <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/orders/${order.id}`)}><Eye className="h-3.5 w-3.5 mr-2" />View Details</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(`Delivery recorded for ${order.id}`)}><Truck className="h-3.5 w-3.5 mr-2" />Record Delivery</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(`Invoice generated for ${order.id}`)}><FileText className="h-3.5 w-3.5 mr-2" />Generate Invoice</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(`${order.id} duplicated`)}><Copy className="h-3.5 w-3.5 mr-2" />Duplicate</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
