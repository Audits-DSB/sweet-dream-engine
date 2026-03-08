import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Eye, MoreHorizontal, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mockRequests = [
  { id: "REQ-001", client: "عيادة د. أحمد", date: "2025-03-06", items: 4, expectedTotal: "32,000 ج.م", status: "Client Requested", notes: "عاجل - المخزون ينفذ" },
  { id: "REQ-002", client: "مركز نور لطب الأسنان", date: "2025-03-05", items: 7, expectedTotal: "85,000 ج.م", status: "Pending Review", notes: "" },
  { id: "REQ-003", client: "عيادة جرين فالي", date: "2025-03-04", items: 3, expectedTotal: "21,000 ج.م", status: "Approved", notes: "إعادة تخزين شهرية" },
  { id: "REQ-004", client: "المركز الملكي للأسنان", date: "2025-03-03", items: 5, expectedTotal: "48,000 ج.م", status: "Converted to Order", notes: "" },
  { id: "REQ-005", client: "عيادة سمايل هاوس", date: "2025-03-02", items: 2, expectedTotal: "12,000 ج.م", status: "Rejected", notes: "العميل غير نشط" },
  { id: "REQ-006", client: "عيادة بلو مون", date: "2025-03-01", items: 6, expectedTotal: "56,000 ج.م", status: "Pending Review", notes: "أصناف جديدة مطلوبة" },
  { id: "REQ-007", client: "مركز سبايس جاردن", date: "2025-02-28", items: 3, expectedTotal: "24,000 ج.م", status: "Approved", notes: "" },
  { id: "REQ-008", client: "عيادة د. أحمد", date: "2025-02-25", items: 5, expectedTotal: "41,000 ج.م", status: "Converted to Order", notes: "" },
  { id: "REQ-009", client: "المركز الملكي للأسنان", date: "2025-02-22", items: 2, expectedTotal: "18,000 ج.م", status: "Cancelled", notes: "العميل ألغى" },
];

export default function RequestsPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { user } = useAuth();
  const { t } = useLanguage();

  const sendNotification = async (title: string, body: string, type: string = "info") => {
    if (!user) return;
    await supabase.from("notifications").insert({
      user_id: user.id,
      title,
      body,
      type,
    });
  };

  const filtered = mockRequests.filter((r) => {
    const matchSearch = !search || r.client.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || r.status === filters.status;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.requestsTitle}</h1>
        <p className="page-description">{mockRequests.length} {t.requestCount} · {mockRequests.filter(r => r.status === "Pending Review").length} {t.awaitingReview}</p>
      </div>

      <DataToolbar
        searchPlaceholder={t.searchRequests}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: t.status, value: "status", options: [
            { label: t.clientRequested, value: "Client Requested" },
            { label: t.pendingReview, value: "Pending Review" },
            { label: t.approved, value: "Approved" },
            { label: t.rejected, value: "Rejected" },
            { label: t.convertedToOrder, value: "Converted to Order" },
            { label: t.cancelled, value: "Cancelled" },
          ]},
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("requests", [t.code, t.client, t.date, t.items, t.expectedTotal, t.status, t.notes], filtered.map(r => [r.id, r.client, r.date, r.items, r.expectedTotal, r.status, r.notes]))}
        actions={<Button size="sm" className="h-9" onClick={() => toast.info(t.newRequestFormSoon)}><Plus className="h-3.5 w-3.5 mr-1.5" />{t.newRequest}</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.code}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.date}</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">{t.items}</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">{t.expectedTotal}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.notes}</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>
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
                      <DropdownMenuItem onClick={() => toast.info(`${t.viewDetails}: ${req.id}`)}><Eye className="h-3.5 w-3.5 mr-2" />{t.viewDetails}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        toast.success(`${t.requestApproved}: ${req.id}`);
                        sendNotification(t.requestApproved, `${req.id} - ${req.client}`, "success");
                      }}><CheckCircle className="h-3.5 w-3.5 mr-2" />{t.approve}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        toast.error(`${t.requestRejected}: ${req.id}`);
                        sendNotification(t.requestRejected, `${req.id} - ${req.client}`, "warning");
                      }}><XCircle className="h-3.5 w-3.5 mr-2" />{t.reject}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        toast.success(`${t.requestConverted}: ${req.id}`);
                        sendNotification(t.requestConverted, `${req.id} - ${req.client}`, "info");
                      }}><ArrowRight className="h-3.5 w-3.5 mr-2" />{t.convertToOrder}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">{t.noMatchingRequests}</div>
        )}
      </div>
    </div>
  );
}
