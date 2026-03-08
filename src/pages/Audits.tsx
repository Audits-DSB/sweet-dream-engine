import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Plus, Eye, MoreHorizontal, ClipboardCheck, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const mockAudits = [
  { id: "AUD-012", client: "Al Salam Cafe", date: "2025-03-05", auditor: "Ahmed Al-Rashid", totalItems: 8, matched: 6, shortage: 1, surplus: 1, notes: "Sugar Syrup bottle damaged", status: "Completed" },
  { id: "AUD-011", client: "Noor Restaurant", date: "2025-02-28", auditor: "Sara Al-Mansour", totalItems: 12, matched: 12, shortage: 0, surplus: 0, notes: "", status: "Completed" },
  { id: "AUD-010", client: "Green Valley Lounge", date: "2025-02-25", auditor: "Ahmed Al-Rashid", totalItems: 6, matched: 5, shortage: 1, surplus: 0, notes: "1kg Arabica missing — staff unable to explain", status: "Discrepancy" },
  { id: "AUD-009", client: "Royal Kitchen", date: "2025-02-20", auditor: "Omar Khalil", totalItems: 10, matched: 9, shortage: 0, surplus: 1, notes: "Extra vanilla found from previous delivery", status: "Completed" },
  { id: "AUD-008", client: "Blue Moon Cafe", date: "2025-02-15", auditor: "Sara Al-Mansour", totalItems: 7, matched: 7, shortage: 0, surplus: 0, notes: "", status: "Completed" },
  { id: "AUD-007", client: "Taste House", date: "2025-02-10", auditor: "Ahmed Al-Rashid", totalItems: 5, matched: 3, shortage: 2, surplus: 0, notes: "Missing items: Green Tea 2kg, Milk Powder 1kg", status: "Discrepancy" },
  { id: "AUD-006", client: "Spice Garden", date: "2025-02-05", auditor: "Omar Khalil", totalItems: 4, matched: 4, shortage: 0, surplus: 0, notes: "", status: "Completed" },
  { id: "AUD-005", client: "Al Salam Cafe", date: "2025-01-30", auditor: "Ahmed Al-Rashid", totalItems: 8, matched: 8, shortage: 0, surplus: 0, notes: "", status: "Completed" },
  { id: "AUD-DRAFT", client: "Royal Kitchen", date: "2025-03-08", auditor: "Sara Al-Mansour", totalItems: 0, matched: 0, shortage: 0, surplus: 0, notes: "", status: "Scheduled" },
  { id: "AUD-PROG", client: "Noor Restaurant", date: "2025-03-07", auditor: "Omar Khalil", totalItems: 12, matched: 8, shortage: 0, surplus: 0, notes: "In progress...", status: "In Progress" },
];

const auditDetails = [
  { material: "Arabica Coffee Beans", expected: 45, actual: 45, unit: "kg", result: "Match" },
  { material: "Green Tea Leaves", expected: 8, actual: 7, unit: "kg", result: "Shortage" },
  { material: "Sugar Syrup", expected: 30, actual: 30, unit: "L", result: "Match" },
  { material: "Milk Powder", expected: 2, actual: 2, unit: "kg", result: "Match" },
  { material: "Vanilla Extract", expected: 1.5, actual: 1.5, unit: "L", result: "Match" },
  { material: "Cinnamon Sticks", expected: 3, actual: 3, unit: "kg", result: "Match" },
  { material: "Paper Cups", expected: 200, actual: 215, unit: "pcs", result: "Surplus" },
  { material: "Napkins Pack", expected: 50, actual: 49, unit: "pcs", result: "Shortage" },
];

export default function AuditsPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedAudit, setSelectedAudit] = useState<typeof mockAudits[0] | null>(null);

  const clients = [...new Set(mockAudits.map(a => a.client))];

  const filtered = mockAudits.filter((a) => {
    const matchSearch = !search || a.client.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase()) || a.auditor.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || a.status === filters.status;
    const matchClient = !filters.client || filters.client === "all" || a.client === filters.client;
    return matchSearch && matchStatus && matchClient;
  });

  const completedCount = mockAudits.filter(a => a.status === "Completed").length;
  const discrepancyCount = mockAudits.filter(a => a.status === "Discrepancy").length;
  const scheduledCount = mockAudits.filter(a => a.status === "Scheduled" || a.status === "In Progress").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Audits</h1>
        <p className="page-description">Weekly audit sessions and consumption tracking</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Completed Audits" value={completedCount} change="This quarter" changeType="neutral" icon={CheckCircle2} />
        <StatCard title="Discrepancies Found" value={discrepancyCount} change={`${((discrepancyCount / mockAudits.length) * 100).toFixed(0)}% of audits`} changeType="negative" icon={AlertTriangle} />
        <StatCard title="Scheduled / In Progress" value={scheduledCount} change="Upcoming" changeType="neutral" icon={ClipboardCheck} />
      </div>

      <DataToolbar
        searchPlaceholder="Search audits..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "Status", value: "status", options: [
            { label: "Completed", value: "Completed" },
            { label: "Discrepancy", value: "Discrepancy" },
            { label: "Scheduled", value: "Scheduled" },
            { label: "In Progress", value: "In Progress" },
          ]},
          { label: "Client", value: "client", options: clients.map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("audits", ["Audit ID","Client","Date","Auditor","Total Items","Matched","Shortage","Surplus","Status","Notes"], filtered.map(a => [a.id, a.client, a.date, a.auditor, a.totalItems, a.matched, a.shortage, a.surplus, a.status, a.notes]))}
        actions={<Button size="sm" className="h-9"><Plus className="h-3.5 w-3.5 mr-1.5" />New Audit</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Audit ID</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Client</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Auditor</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Items</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Matched</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Short</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Surplus</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((audit) => (
              <tr key={audit.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-3 font-mono text-xs font-medium">{audit.id}</td>
                <td className="py-3 px-3 font-medium">{audit.client}</td>
                <td className="py-3 px-3 text-muted-foreground">{audit.date}</td>
                <td className="py-3 px-3">{audit.auditor}</td>
                <td className="py-3 px-3 text-right">{audit.totalItems}</td>
                <td className="py-3 px-3 text-right text-success font-medium">{audit.matched}</td>
                <td className="py-3 px-3 text-right">{audit.shortage > 0 ? <span className="text-destructive font-medium">{audit.shortage}</span> : "—"}</td>
                <td className="py-3 px-3 text-right">{audit.surplus > 0 ? <span className="text-warning font-medium">{audit.surplus}</span> : "—"}</td>
                <td className="py-3 px-3"><StatusBadge status={audit.status} /></td>
                <td className="py-3 px-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedAudit(audit)}><Eye className="h-3.5 w-3.5 mr-2" />View Details</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No audits match your search.</div>
        )}
      </div>

      {/* Audit Detail Dialog */}
      <Dialog open={!!selectedAudit} onOpenChange={() => setSelectedAudit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit {selectedAudit?.id} — {selectedAudit?.client}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{selectedAudit?.date}</span></div>
              <div><span className="text-muted-foreground">Auditor:</span> <span className="font-medium">{selectedAudit?.auditor}</span></div>
              <div><StatusBadge status={selectedAudit?.status || ""} /></div>
            </div>
            {selectedAudit?.notes && (
              <div className="p-3 rounded-lg bg-warning/10 text-warning text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {selectedAudit.notes}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Material</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Expected</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Actual</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Unit</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {auditDetails.map((d, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium">{d.material}</td>
                      <td className="py-2 px-3 text-right">{d.expected}</td>
                      <td className="py-2 px-3 text-right font-medium">{d.actual}</td>
                      <td className="py-2 px-3 text-muted-foreground">{d.unit}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${d.result === "Match" ? "text-success" : d.result === "Shortage" ? "text-destructive" : "text-warning"}`}>
                          {d.result === "Match" ? <CheckCircle2 className="h-3 w-3" /> : d.result === "Shortage" ? <XCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          {d.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
