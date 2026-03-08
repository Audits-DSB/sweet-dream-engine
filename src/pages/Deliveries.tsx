import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Eye, MoreHorizontal, Truck, Plus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mockDeliveries = [
  { id: "DEL-035", order: "ORD-048", client: "Al Salam Cafe", requestedDate: "2025-03-08", actualDate: "—", actor: "Ahmed (Founder)", items: 4, type: "Full", status: "Pending" },
  { id: "DEL-034", order: "ORD-047", client: "Noor Restaurant", requestedDate: "2025-03-07", actualDate: "—", actor: "DHL Express", items: 7, type: "Full", status: "In Transit" },
  { id: "DEL-033", order: "ORD-046", client: "Green Valley Lounge", requestedDate: "2025-03-06", actualDate: "2025-03-06", actor: "Fast Delivery Co.", items: 3, type: "Full", status: "Delivered" },
  { id: "DEL-032", order: "ORD-044", client: "Blue Moon Cafe", requestedDate: "2025-03-03", actualDate: "2025-03-03", actor: "Sara (Founder)", items: 4, type: "Partial", status: "Delivered" },
  { id: "DEL-031", order: "ORD-044", client: "Blue Moon Cafe", requestedDate: "2025-03-05", actualDate: "—", actor: "Ahmed (Founder)", items: 2, type: "Partial", status: "Pending" },
  { id: "DEL-030", order: "ORD-045", client: "Royal Kitchen", requestedDate: "2025-03-02", actualDate: "2025-03-02", actor: "DHL Express", items: 5, type: "Full", status: "Delivered" },
  { id: "DEL-029", order: "ORD-043", client: "Taste House", requestedDate: "2025-02-28", actualDate: "2025-03-01", actor: "Ahmed (Founder)", items: 2, type: "Full", status: "Delivered" },
];

const deliveryStatusMap: Record<string, string> = {
  "Pending": "warning",
  "In Transit": "info",
  "Delivered": "success",
  "Failed": "destructive",
};

export default function DeliveriesPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filtered = mockDeliveries.filter((d) => {
    const matchSearch = !search || d.client.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase()) || d.order.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || d.status === filters.status;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Deliveries</h1>
        <p className="page-description">{mockDeliveries.length} deliveries · {mockDeliveries.filter(d => d.status === "Pending").length} pending</p>
      </div>

      <DataToolbar
        searchPlaceholder="Search deliveries..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "Status", value: "status", options: [
            { label: "Pending", value: "Pending" },
            { label: "In Transit", value: "In Transit" },
            { label: "Delivered", value: "Delivered" },
          ]},
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => {}}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">ID</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Order</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Client</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Requested</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Actual</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Actor</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Items</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Type</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((del) => (
              <tr key={del.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{del.id}</td>
                <td className="py-3 px-3 font-mono text-xs">{del.order}</td>
                <td className="py-3 px-3 font-medium">{del.client}</td>
                <td className="py-3 px-3 text-muted-foreground text-xs">{del.requestedDate}</td>
                <td className="py-3 px-3 text-xs">{del.actualDate}</td>
                <td className="py-3 px-3 text-muted-foreground">{del.actor}</td>
                <td className="py-3 px-3 text-right">{del.items}</td>
                <td className="py-3 px-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{del.type}</span></td>
                <td className="py-3 px-3"><StatusBadge status={del.status} variant={deliveryStatusMap[del.status] as any} /></td>
                <td className="py-3 px-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem><Eye className="h-3.5 w-3.5 mr-2" />View</DropdownMenuItem>
                      <DropdownMenuItem><Truck className="h-3.5 w-3.5 mr-2" />Mark Delivered</DropdownMenuItem>
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
