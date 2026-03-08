import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock, Receipt, Eye, MoreHorizontal, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clientsList } from "@/data/store";

const mockCollections = [
  { id: "INV-001", order: "ORD-048", client: "عيادة د. أحمد", clientId: "C001", issueDate: "2025-03-06", dueDate: "2025-03-20", total: 32000, paid: 0, remaining: 32000, payments: [] as { date: string; amount: number; method: string }[], status: "Awaiting Confirmation" },
  { id: "INV-002", order: "ORD-047", client: "مركز نور لطب الأسنان", clientId: "C002", issueDate: "2025-03-05", dueDate: "2025-03-19", total: 85000, paid: 40000, remaining: 45000, payments: [{ date: "2025-03-10", amount: 40000, method: "Bank Transfer" }], status: "Partially Paid" },
  { id: "INV-003", order: "ORD-046", client: "عيادة جرين فالي", clientId: "C003", issueDate: "2025-03-04", dueDate: "2025-03-18", total: 21000, paid: 21000, remaining: 0, payments: [{ date: "2025-03-12", amount: 21000, method: "Cash" }], status: "Paid" },
  { id: "INV-004", order: "ORD-045", client: "المركز الملكي للأسنان", clientId: "C004", issueDate: "2025-03-03", dueDate: "2025-03-17", total: 48000, paid: 16000, remaining: 32000, payments: [{ date: "2025-03-05", amount: 16000, method: "Cash" }], status: "Installment Active" },
  { id: "INV-005", order: "ORD-044", client: "عيادة بلو مون", clientId: "C006", issueDate: "2025-03-01", dueDate: "2025-03-15", total: 56000, paid: 0, remaining: 56000, payments: [], status: "Overdue" },
  { id: "INV-006", order: "ORD-043", client: "عيادة سمايل هاوس", clientId: "C005", issueDate: "2025-02-28", dueDate: "2025-03-14", total: 12000, paid: 12000, remaining: 0, payments: [{ date: "2025-03-01", amount: 6000, method: "Cash" }, { date: "2025-03-10", amount: 6000, method: "Bank Transfer" }], status: "Paid" },
  { id: "INV-007", order: "ORD-042", client: "عيادة د. أحمد", clientId: "C001", issueDate: "2025-02-25", dueDate: "2025-03-11", total: 41000, paid: 41000, remaining: 0, payments: [{ date: "2025-03-01", amount: 41000, method: "Bank Transfer" }], status: "Paid" },
  { id: "INV-008", order: "ORD-041", client: "مركز سبايس جاردن", clientId: "C007", issueDate: "2025-02-22", dueDate: "2025-03-08", total: 24000, paid: 8000, remaining: 16000, payments: [{ date: "2025-02-28", amount: 8000, method: "Cash" }], status: "Overdue" },
];

export default function CollectionsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
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
        <h1 className="page-header">{t.collectionsTitle}</h1>
        <p className="page-description">{t.collectionsDesc}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t.totalCollected} value={`${totalCollected.toLocaleString()} ${t.currency}`} change={`${paidCount} ${t.fullyPaid}`} changeType="positive" icon={CheckCircle2} />
        <StatCard title={t.outstandingAmount} value={`${totalOutstanding.toLocaleString()} ${t.currency}`} change={`${mockCollections.filter(c => c.remaining > 0).length} ${t.invoiceCount}`} changeType="neutral" icon={Clock} />
        <StatCard title={t.overdueAmount} value={`${overdueAmount.toLocaleString()} ${t.currency}`} change={`${mockCollections.filter(c => c.status === "Overdue").length} ${t.invoiceCount}`} changeType="negative" icon={AlertTriangle} />
        <StatCard title={t.invoicesLabel} value={mockCollections.length} change={t.totalIssued} changeType="neutral" icon={Receipt} />
      </div>

      <DataToolbar
        searchPlaceholder={t.searchInvoices}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[{ label: t.status, value: "status", options: [
          { label: t.awaitingConfirmation, value: "Awaiting Confirmation" },
          { label: t.partiallyPaid, value: "Partially Paid" },
          { label: t.installmentActive, value: "Installment Active" },
          { label: t.paid, value: "Paid" },
          { label: t.overdue, value: "Overdue" },
        ]}]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("collections", [t.invoice, t.order, t.client, t.issueDate, t.dueDate, t.totalAmount, t.paidAmount, t.remaining, t.status], filtered.map(c => [c.id, c.order, c.client, c.issueDate, c.dueDate, c.total, c.paid, c.remaining, c.status]))}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.invoice}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.order}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.issueDate}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.dueDate}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.totalAmount}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.paidAmount}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.remaining}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedInvoice(inv)}>
                <td className="py-3 px-3 font-mono text-xs font-medium">{inv.id}</td>
                <td className="py-3 px-3 font-mono text-xs text-muted-foreground hover:text-primary cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/orders/${inv.order}`); }}>{inv.order}</td>
                <td className="py-3 px-3 font-medium hover:text-primary cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${inv.clientId}`); }}>{inv.client}</td>
                <td className="py-3 px-3 text-muted-foreground">{inv.issueDate}</td>
                <td className="py-3 px-3 text-muted-foreground">{inv.dueDate}</td>
                <td className="py-3 px-3 text-end font-medium">{inv.total.toLocaleString()} {t.currency}</td>
                <td className="py-3 px-3 text-end text-success font-medium">{inv.paid.toLocaleString()} {t.currency}</td>
                <td className="py-3 px-3 text-end">{inv.remaining > 0 ? <span className="text-destructive font-medium">{inv.remaining.toLocaleString()} {t.currency}</span> : "—"}</td>
                <td className="py-3 px-3"><StatusBadge status={inv.status} /></td>
                <td className="py-3 px-3 text-end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedInvoice(inv)}><Eye className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.viewDetails}</DropdownMenuItem>
                      {inv.remaining > 0 && <DropdownMenuItem onClick={() => toast.success(`${t.recordPayment}: ${inv.id}`)}><DollarSign className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.recordPayment}</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedInvoice?.id} — {selectedInvoice?.client}</DialogTitle></DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.totalAmount}</p><p className="font-semibold">{selectedInvoice.total.toLocaleString()} {t.currency}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.remaining}</p><p className="font-semibold text-destructive">{selectedInvoice.remaining.toLocaleString()} {t.currency}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70" onClick={() => { setSelectedInvoice(null); navigate(`/orders/${selectedInvoice.order}`); }}><p className="text-xs text-muted-foreground">{t.order}</p><p className="font-semibold text-primary">{selectedInvoice.order}</p></div>
                <div className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70" onClick={() => { setSelectedInvoice(null); navigate(`/clients/${selectedInvoice.clientId}`); }}><p className="text-xs text-muted-foreground">{t.client}</p><p className="font-semibold text-primary">{selectedInvoice.client}</p></div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">{t.paymentHistory}</h4>
                {selectedInvoice.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.noPayments}</p>
                ) : (
                  <div className="space-y-2">
                    {selectedInvoice.payments.map((p, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 rounded-lg bg-success/5 border border-success/20 text-sm">
                        <div>
                          <span className="font-medium">{p.amount.toLocaleString()} {t.currency}</span>
                          <span className="text-muted-foreground ltr:ml-2 rtl:mr-2">{t.via} {p.method}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{p.date}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{t.paymentProgress}</span>
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
