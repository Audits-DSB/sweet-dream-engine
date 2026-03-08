import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Eye, MoreHorizontal, AlertTriangle } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mockInventory = [
  { id: "LOT-001", client: "Al Salam Cafe", material: "Arabica Coffee Beans", code: "MAT-001", unit: "kg", delivered: 50, remaining: 45, sellingPrice: 120, storeCost: 80, deliveryDate: "2025-02-20", expiry: "2025-06-15", sourceOrder: "ORD-042", status: "In Stock" },
  { id: "LOT-002", client: "Al Salam Cafe", material: "Green Tea Leaves", code: "MAT-002", unit: "kg", delivered: 20, remaining: 8, sellingPrice: 95, storeCost: 60, deliveryDate: "2025-02-20", expiry: "2025-04-20", sourceOrder: "ORD-042", status: "Low Stock" },
  { id: "LOT-003", client: "Al Salam Cafe", material: "Sugar Syrup", code: "MAT-003", unit: "L", delivered: 40, remaining: 30, sellingPrice: 45, storeCost: 28, deliveryDate: "2025-01-15", expiry: "2025-12-01", sourceOrder: "ORD-038", status: "In Stock" },
  { id: "LOT-004", client: "Al Salam Cafe", material: "Milk Powder", code: "MAT-005", unit: "kg", delivered: 10, remaining: 2, sellingPrice: 40, storeCost: 28, deliveryDate: "2025-01-15", expiry: "2025-03-25", sourceOrder: "ORD-038", status: "Low Stock" },
  { id: "LOT-005", client: "Noor Restaurant", material: "Arabica Coffee Beans", code: "MAT-001", unit: "kg", delivered: 80, remaining: 65, sellingPrice: 120, storeCost: 80, deliveryDate: "2025-03-01", expiry: "2025-07-20", sourceOrder: "ORD-045", status: "In Stock" },
  { id: "LOT-006", client: "Noor Restaurant", material: "Vanilla Extract", code: "MAT-008", unit: "L", delivered: 5, remaining: 0.5, sellingPrice: 280, storeCost: 180, deliveryDate: "2025-02-10", expiry: "2025-04-01", sourceOrder: "ORD-040", status: "Low Stock" },
  { id: "LOT-007", client: "Green Valley Lounge", material: "Green Tea Leaves", code: "MAT-002", unit: "kg", delivered: 30, remaining: 22, sellingPrice: 95, storeCost: 60, deliveryDate: "2025-02-25", expiry: "2025-05-30", sourceOrder: "ORD-043", status: "In Stock" },
  { id: "LOT-008", client: "Royal Kitchen", material: "Arabica Coffee Beans", code: "MAT-001", unit: "kg", delivered: 100, remaining: 0, sellingPrice: 120, storeCost: 80, deliveryDate: "2024-12-15", expiry: "2025-03-10", sourceOrder: "ORD-035", status: "Depleted" },
  { id: "LOT-009", client: "Royal Kitchen", material: "Cinnamon Sticks", code: "MAT-010", unit: "kg", delivered: 5, remaining: 4, sellingPrice: 200, storeCost: 130, deliveryDate: "2025-03-01", expiry: "2026-01-01", sourceOrder: "ORD-045", status: "In Stock" },
  { id: "LOT-010", client: "Blue Moon Cafe", material: "Milk Powder", code: "MAT-005", unit: "kg", delivered: 15, remaining: 12, sellingPrice: 40, storeCost: 28, deliveryDate: "2025-03-03", expiry: "2025-09-15", sourceOrder: "ORD-044", status: "In Stock" },
  { id: "LOT-011", client: "Spice Garden", material: "Turmeric Powder", code: "MAT-012", unit: "kg", delivered: 8, remaining: 0, sellingPrice: 150, storeCost: 95, deliveryDate: "2025-01-10", expiry: "2025-03-01", sourceOrder: "ORD-036", status: "Expired" },
];

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const clients = [...new Set(mockInventory.map(i => i.client))];
  const materials = [...new Set(mockInventory.map(i => i.material))];

  const filtered = mockInventory.filter((i) => {
    const matchSearch = !search || i.material.toLowerCase().includes(search.toLowerCase()) || i.client.toLowerCase().includes(search.toLowerCase()) || i.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || i.status === filters.status;
    const matchClient = !filters.client || filters.client === "all" || i.client === filters.client;
    return matchSearch && matchStatus && matchClient;
  });

  const lowStockCount = mockInventory.filter(i => i.status === "Low Stock").length;
  const expiredCount = mockInventory.filter(i => i.status === "Expired").length;
  const nearExpiryCount = mockInventory.filter(i => {
    if (!i.expiry) return false;
    const days = (new Date(i.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days > 0 && days <= 30 && i.status !== "Depleted" && i.status !== "Expired";
  }).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Client Inventory</h1>
        <p className="page-description">{mockInventory.length} lots across {clients.length} clients</p>
      </div>

      {/* Alert cards */}
      {(lowStockCount > 0 || expiredCount > 0 || nearExpiryCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {lowStockCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning text-sm">
              <AlertTriangle className="h-4 w-4" />{lowStockCount} low stock items
            </div>
          )}
          {expiredCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />{expiredCount} expired
            </div>
          )}
          {nearExpiryCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning text-sm">
              <AlertTriangle className="h-4 w-4" />{nearExpiryCount} expiring within 30 days
            </div>
          )}
        </div>
      )}

      <DataToolbar
        searchPlaceholder="Search inventory..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "Status", value: "status", options: [
            { label: "In Stock", value: "In Stock" },
            { label: "Low Stock", value: "Low Stock" },
            { label: "Depleted", value: "Depleted" },
            { label: "Expired", value: "Expired" },
          ]},
          { label: "Client", value: "client", options: clients.map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("inventory", ["Lot ID","Client","Material","Code","Unit","Delivered","Remaining","Selling Price","Store Cost","Delivery Date","Expiry","Source Order","Status"], filtered.map(i => [i.id, i.client, i.material, i.code, i.unit, i.delivered, i.remaining, i.sellingPrice, i.storeCost, i.deliveryDate, i.expiry, i.sourceOrder, i.status]))}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Lot ID</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Client</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Material</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Delivered</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Remaining</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Unit</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Sell Price</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Delivery</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Expiry</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Order</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lot) => {
              const daysToExpiry = lot.expiry ? Math.ceil((new Date(lot.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
              const isNearExpiry = daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 30;
              return (
                <tr key={lot.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{lot.id}</td>
                  <td className="py-3 px-3 font-medium">{lot.client}</td>
                  <td className="py-3 px-3">{lot.material}</td>
                  <td className="py-3 px-3 text-right">{lot.delivered}</td>
                  <td className="py-3 px-3 text-right font-medium">{lot.remaining}</td>
                  <td className="py-3 px-3 text-muted-foreground">{lot.unit}</td>
                  <td className="py-3 px-3 text-right">SAR {lot.sellingPrice}</td>
                  <td className="py-3 px-3 text-muted-foreground text-xs">{lot.deliveryDate}</td>
                  <td className="py-3 px-3 text-xs">
                    <span className={isNearExpiry ? "text-warning font-medium" : "text-muted-foreground"}>
                      {lot.expiry}{isNearExpiry && ` (${daysToExpiry}d)`}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{lot.sourceOrder}</td>
                  <td className="py-3 px-3"><StatusBadge status={lot.status} /></td>
                  <td className="py-3 px-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="h-3.5 w-3.5 mr-2" />View Details</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No inventory items match your search.</div>
        )}
      </div>
    </div>
  );
}
