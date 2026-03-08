import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Eye, MoreHorizontal, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mockClients = [
  { id: "C001", name: "Al Salam Cafe", contact: "Khalid Ahmad", email: "khalid@alsalam.sa", phone: "+966 50 111 2233", city: "Riyadh", status: "Active", joinDate: "2024-03-15", totalOrders: 18, outstanding: 3200, lastAudit: "2025-02-28" },
  { id: "C002", name: "Noor Restaurant", contact: "Fatima Hassan", email: "fatima@noor.sa", phone: "+966 55 222 3344", city: "Jeddah", status: "Active", joinDate: "2024-01-20", totalOrders: 24, outstanding: 5800, lastAudit: "2025-03-01" },
  { id: "C003", name: "Green Valley Lounge", contact: "Omar Saeed", email: "omar@greenvalley.sa", phone: "+966 54 333 4455", city: "Riyadh", status: "Active", joinDate: "2024-06-10", totalOrders: 12, outstanding: 0, lastAudit: "2025-02-20" },
  { id: "C004", name: "Royal Kitchen", contact: "Layla Nasser", email: "layla@royalkitchen.sa", phone: "+966 56 444 5566", city: "Dammam", status: "Active", joinDate: "2024-02-05", totalOrders: 31, outstanding: 4500, lastAudit: "2025-03-03" },
  { id: "C005", name: "Taste House", contact: "Youssef Ali", email: "youssef@tastehouse.sa", phone: "+966 59 555 6677", city: "Riyadh", status: "Inactive", joinDate: "2024-08-22", totalOrders: 6, outstanding: 1900, lastAudit: "2025-01-15" },
  { id: "C006", name: "Blue Moon Cafe", contact: "Huda Ibrahim", email: "huda@bluemoon.sa", phone: "+966 50 666 7788", city: "Jeddah", status: "Active", joinDate: "2024-04-18", totalOrders: 15, outstanding: 0, lastAudit: "2025-03-05" },
  { id: "C007", name: "Spice Garden", contact: "Tariq Mohammed", email: "tariq@spicegarden.sa", phone: "+966 55 777 8899", city: "Medina", status: "Active", joinDate: "2024-09-01", totalOrders: 9, outstanding: 2100, lastAudit: "2025-02-25" },
  { id: "C008", name: "Cloud Nine Bakery", contact: "Mona Saleh", email: "mona@cloudnine.sa", phone: "+966 54 888 9900", city: "Riyadh", status: "Inactive", joinDate: "2024-05-30", totalOrders: 4, outstanding: 0, lastAudit: "2024-12-10" },
];

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const filtered = mockClients.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.contact.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || c.status === filters.status;
    const matchCity = !filters.city || filters.city === "all" || c.city === filters.city;
    return matchSearch && matchStatus && matchCity;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Clients</h1>
          <p className="page-description">{mockClients.length} clients · {mockClients.filter(c => c.status === "Active").length} active</p>
        </div>
      </div>

      <DataToolbar
        searchPlaceholder="Search clients..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "Status", value: "status", options: [{ label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }] },
          { label: "City", value: "city", options: [...new Set(mockClients.map(c => c.city))].map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("clients", ["ID","Name","Contact","Email","Phone","City","Status","Join Date","Total Orders","Outstanding"], filtered.map(c => [c.id, c.name, c.contact, c.email, c.phone, c.city, c.status, c.joinDate, c.totalOrders, c.outstanding]))}
        actions={<Button size="sm" className="h-9"><Plus className="h-3.5 w-3.5 mr-1.5" />Add Client</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">ID</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Client</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Contact</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">City</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Orders</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Outstanding</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Last Audit</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => (
              <tr key={client.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{client.id}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{client.name.charAt(0)}</span>
                    </div>
                    <span className="font-medium">{client.name}</span>
                  </div>
                </td>
                <td className="py-3 px-3 text-muted-foreground">{client.contact}</td>
                <td className="py-3 px-3 text-muted-foreground">{client.city}</td>
                <td className="py-3 px-3"><StatusBadge status={client.status} /></td>
                <td className="py-3 px-3 text-right font-medium">{client.totalOrders}</td>
                <td className="py-3 px-3 text-right font-medium">
                  {client.outstanding > 0 ? (
                    <span className="text-warning">SAR {client.outstanding.toLocaleString()}</span>
                  ) : (
                    <span className="text-success">Settled</span>
                  )}
                </td>
                <td className="py-3 px-3 text-muted-foreground text-xs">{client.lastAudit}</td>
                <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/clients/${client.id}`)}><Eye className="h-3.5 w-3.5 mr-2" />View Profile</DropdownMenuItem>
                      <DropdownMenuItem><Mail className="h-3.5 w-3.5 mr-2" />Send Email</DropdownMenuItem>
                      <DropdownMenuItem><Phone className="h-3.5 w-3.5 mr-2" />Call</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No clients match your search.</div>
        )}
      </div>
    </div>
  );
}
