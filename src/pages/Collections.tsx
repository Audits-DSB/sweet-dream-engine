import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Receipt, AlertTriangle, CheckCircle2, Clock, Plus, Eye, MoreHorizontal, DollarSign } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const mockCollections = [
  { id: "INV-001", order: "ORD-048", client: "Al Salam Cafe", issueDate: "2025-03-06", dueDate: "2025-03-20", total: 3200, paid: 0, remaining: 3200, payments: [], status: "Awaiting Confirmation" },
  { id: "INV-002", order: "ORD-047", client: "Noor Restaurant", issueDate: "2025-03-05", dueDate: "2025-03-19", total: 8500, paid: 4000, remaining: 4500, payments: [{ date: "2025-03-10", amount: 4000, method: "Bank Transfer" }], status: "Partially Paid" },
  { id: "INV-003", order: "ORD-046", client: "Green Valley Lounge", issueDate: "2025-03-04", dueDate: "2025-03-18", total: 2100, paid: 2100, remaining: 0, payments: [{ date: "2025-03-12", amount: 2100, method: "Cash" }], status: "Paid" },
  { id: "INV-004", order: "ORD-045", client: "Royal Kitchen", issueDate: "2025-03-03", dueDate: "2025-03-17", total: 4800, paid: 1600, remaining: 3200, payments: [{ date: "2025-03-05", amount: 1600, method: "Cash" }], status: "Installment Active" },
  { id: "INV-005", order: "ORD-044", client: "Blue Moon Cafe", issueDate: "2025-03-01", dueDate: "2025-03-15", total: 5600, paid: 0, remaining: 5600, payments: [], status: "Overdue" },
  { id: "INV-006", order: "ORD-043", client: "Taste House", issueDate: "2025-02-28", dueDate: "2025-03-14", total: 1200, paid: 1200, remaining: 0, payments: [{ date: "2025-03-01", amount: 600, method: "Cash" }, { date: "2025-03-10", amount: 600, method: "Bank Transfer" }], status: "Paid" },
  { id: "INV-007", order: "ORD-042", client: "Al Salam Cafe", issueDate: "2025-02-25", dueDate: "2025-03-11", total: 4100, paid: 4100, remaining: 0, payments: [{ date: "2025-03-01", amount: 4100, method: "Bank Transfer" }], status: "Paid" },
  { id: "INV-008", order: "ORD-041", client: "Spice Garden", issueDate: "2025-02-22", dueDate: "2025-03-08", total: 2400, paid: 800, remaining: 1600, payments: [{ date: "2025-02-28", amount: 800, method: "Cash" }], status: "Overdue" },
];

export default function CollectionsPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedInvoice, setSelectedInvoice] = useState<typeof mockCollections[0] | null>(null);

  const filtered = mockCollections.filter((c) => {
    const matchSearch = !search || c.client.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase()) || c.order.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || c.status === filters.status;
    return matchSearch && matchStatus;
  });

  const totalOutstanding = mockCollections.reduce((sum, c) => sum + c.remaining, 0);
  const overdueAmount = mockCollections.filter(c => c.status === "Overdue").reduce((sum, c) => sum + c.remaining, 0);
  const paidCount = mockCollections.filter(c => c.status === "Paid").length;
  const totalCollected = mockCollections.reduce((sum, c) => sum + c.paid, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Collections</h1>
        <p className="page-description">Manage billing, payments, and installments</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Collected" value={`SAR ${totalCollected.toLocaleString()}`} change={`${paidCount} fully paid`} changeType="positive" icon={CheckCircle2} />
        <StatCard title="Outstanding" value={`SAR ${totalOutstanding.toLocaleString()}`} change={`${mockCollections.filter(c => c.remaining > 0).length} invoices`} changeType="neutral" icon={Clock} />
        <StatCard title="Overdue" value={`SAR ${overdueAmount.toLocaleString()}`} change={`${mockCollections.filter(c => c.status === "Overdue").length} invoices`} changeType="negative" icon={AlertTriangle} />
        <StatCard title="Invoices" value={mockCollections.length} change="Total issued" changeType="neutral" icon={Receipt} />
      </div>

      <DataToolbar
        searchPlaceholder="Search invoices..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "Status", value: "status", options: [
            { label: "Awaiting Confirmation", value: "Awaiting Confirmation" },
            { label: "Partially Paid", value: "Partially Paid" },
            { label: "Installment Active", value: "Installment Active" },
            { label: "Paid", value: "Paid" },
            { label: "Overdue", value: "Overdue" },
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
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Invoice</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Order</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Client</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Issue Date</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Due Date</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Total</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Paid</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Remaining</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-3 font-mono text-xs font-medium">{inv.id}</td>
                <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{inv.order}</td>
                <td className="py-3 px-3 font-medium">{inv.client}</td>
                <td className="py-3 px-3 text-muted-foreground">{inv.issueDate}</td>
                <td className="py-3 px-3 text-muted-foreground">{inv.dueDate}</td>
                <td className="py-3 px-3 text-right font-medium">SAR {inv.total.toLocaleString()}</td>
                <td className="py-3 px-3 text-right text-success font-medium">SAR {inv.paid.toLocaleString()}</td>
                <td className="py-3 px-3 text-right">{inv.remaining > 0 ? <span className="text-destructive font-medium">SAR {inv.remaining.toLocaleString()}</span> : "—"}</td>
                <td className="py-3 px-3"><StatusBadge status={inv.status} /></td>
                <td className="py-3 px-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedInvoice(inv)}><Eye className="h-3.5 w-3.5 mr-2" />View Details</DropdownMenuItem>
                      {inv.remaining > 0 && <DropdownMenuItem><DollarSign className="h-3.5 w-3.5 mr-2" />Record Payment</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedInvoice?.id} — {selectedInvoice?.client}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Total</p><p className="font-semibold">SAR {selectedInvoice.total.toLocaleString()}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Remaining</p><p className="font-semibold text-destructive">SAR {selectedInvoice.remaining.toLocaleString()}</p></div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Payment History</h4>
                {selectedInvoice.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedInvoice.payments.map((p, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 rounded-lg bg-success/5 border border-success/20 text-sm">
                        <div>
                          <span className="font-medium">SAR {p.amount.toLocaleString()}</span>
                          <span className="text-muted-foreground ml-2">via {p.method}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{p.date}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Payment Progress</span>
                  <span className="font-medium">{((selectedInvoice.paid / selectedInvoice.total) * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(selectedInvoice.paid / selectedInvoice.total) * 100}%` }} />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
