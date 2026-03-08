import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Eye, MoreHorizontal, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mockRequests = [
  { id: "REQ-001", client: "Al Salam Cafe", date: "2025-03-06", items: 4, expectedTotal: "SAR 3,200", status: "Client Requested", notes: "Urgent - running low on coffee" },
  { id: "REQ-002", client: "Noor Restaurant", date: "2025-03-05", items: 7, expectedTotal: "SAR 8,500", status: "Pending Review", notes: "" },
  { id: "REQ-003", client: "Green Valley Lounge", date: "2025-03-04", items: 3, expectedTotal: "SAR 2,100", status: "Approved", notes: "Monthly restock" },
  { id: "REQ-004", client: "Royal Kitchen", date: "2025-03-03", items: 5, expectedTotal: "SAR 4,800", status: "Converted to Order", notes: "" },
  { id: "REQ-005", client: "Taste House", date: "2025-03-02", items: 2, expectedTotal: "SAR 1,200", status: "Rejected", notes: "Client inactive" },
  { id: "REQ-006", client: "Blue Moon Cafe", date: "2025-03-01", items: 6, expectedTotal: "SAR 5,600", status: "Pending Review", notes: "New items requested" },
  { id: "REQ-007", client: "Spice Garden", date: "2025-02-28", items: 3, expectedTotal: "SAR 2,400", status: "Approved", notes: "" },
  { id: "REQ-008", client: "Al Salam Cafe", date: "2025-02-25", items: 5, expectedTotal: "SAR 4,100", status: "Converted to Order", notes: "" },
  { id: "REQ-009", client: "Royal Kitchen", date: "2025-02-22", items: 2, expectedTotal: "SAR 1,800", status: "Cancelled", notes: "Client cancelled" },
];

export default function RequestsPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filtered = mockRequests.filter((r) => {
    const matchSearch = !search || r.client.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || r.status === filters.status;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Client Requests</h1>
        <p className="page-description">{mockRequests.length} requests · {mockRequests.filter(r => r.status === "Pending Review").length} pending review</p>
      </div>

      <DataToolbar
        searchPlaceholder="Search requests..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "Status", value: "status", options: [
            { label: "Client Requested", value: "Client Requested" },
            { label: "Pending Review", value: "Pending Review" },
            { label: "Approved", value: "Approved" },
            { label: "Rejected", value: "Rejected" },
            { label: "Converted to Order", value: "Converted to Order" },
            { label: "Cancelled", value: "Cancelled" },
          ]},
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("requests", ["ID","Client","Date","Items","Expected Total","Status","Notes"], filtered.map(r => [r.id, r.client, r.date, r.items, r.expectedTotal, r.status, r.notes]))}
        actions={<Button size="sm" className="h-9"><Plus className="h-3.5 w-3.5 mr-1.5" />New Request</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">ID</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Client</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Items</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Expected Total</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Notes</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((req) => (
              <tr key={req.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{req.id}</td>
                <td className="py-3 px-3 font-medium">{req.client}</td>
                <td className="py-3 px-3 text-muted-foreground">{req.date}</td>
                <td className="py-3 px-3 text-right">{req.items}</td>
                <td className="py-3 px-3 text-right font-medium">{req.expectedTotal}</td>
                <td className="py-3 px-3"><StatusBadge status={req.status} /></td>
                <td className="py-3 px-3 text-xs text-muted-foreground max-w-[200px] truncate">{req.notes || "—"}</td>
                <td className="py-3 px-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem><Eye className="h-3.5 w-3.5 mr-2" />View Details</DropdownMenuItem>
                      <DropdownMenuItem><CheckCircle className="h-3.5 w-3.5 mr-2" />Approve</DropdownMenuItem>
                      <DropdownMenuItem><XCircle className="h-3.5 w-3.5 mr-2" />Reject</DropdownMenuItem>
                      <DropdownMenuItem><ArrowRight className="h-3.5 w-3.5 mr-2" />Convert to Order</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No requests match your search.</div>
        )}
      </div>
    </div>
  );
}
