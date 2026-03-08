import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Eye, MoreHorizontal, Truck, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mockDeliveries = [
  { id: "DEL-035", order: "ORD-048", client: "عيادة د. أحمد", requestedDate: "2025-03-08", actualDate: "—", actor: "أحمد (مؤسس)", items: 4, type: "كامل", status: "Pending" },
  { id: "DEL-034", order: "ORD-047", client: "مركز نور لطب الأسنان", requestedDate: "2025-03-07", actualDate: "—", actor: "DHL Express", items: 7, type: "كامل", status: "In Transit" },
  { id: "DEL-033", order: "ORD-046", client: "عيادة جرين فالي", requestedDate: "2025-03-06", actualDate: "2025-03-06", actor: "شركة توصيل سريع", items: 3, type: "كامل", status: "Delivered" },
  { id: "DEL-032", order: "ORD-044", client: "عيادة بلو مون", requestedDate: "2025-03-03", actualDate: "2025-03-03", actor: "سارة (مؤسس)", items: 4, type: "جزئي", status: "Delivered" },
  { id: "DEL-031", order: "ORD-044", client: "عيادة بلو مون", requestedDate: "2025-03-05", actualDate: "—", actor: "أحمد (مؤسس)", items: 2, type: "جزئي", status: "Pending" },
  { id: "DEL-030", order: "ORD-045", client: "المركز الملكي للأسنان", requestedDate: "2025-03-02", actualDate: "2025-03-02", actor: "DHL Express", items: 5, type: "كامل", status: "Delivered" },
  { id: "DEL-029", order: "ORD-043", client: "عيادة سمايل هاوس", requestedDate: "2025-02-28", actualDate: "2025-03-01", actor: "أحمد (مؤسس)", items: 2, type: "كامل", status: "Delivered" },
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

  const filtered = mockDeliveries.filter((d) => {
    const matchSearch = !search || d.client.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase()) || d.order.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || d.status === filters.status;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.deliveriesTitle}</h1>
        <p className="page-description">{mockDeliveries.length} {t.deliveryCount} · {mockDeliveries.filter(d => d.status === "Pending").length} {t.pendingCount}</p>
      </div>

      <DataToolbar
        searchPlaceholder={t.searchDeliveries}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: t.status, value: "status", options: [
            { label: t.pending, value: "Pending" },
            { label: t.inTransit, value: "In Transit" },
            { label: t.delivered, value: "Delivered" },
          ]},
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("deliveries", [t.code, t.order, t.client, t.requestedDate, t.actualDate, t.executor, t.items, t.type, t.status], filtered.map(d => [d.id, d.order, d.client, d.requestedDate, d.actualDate, d.actor, d.items, d.type, d.status]))}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.code}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.order}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.requestedDate}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.actualDate}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.executor}</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">{t.items}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.type}</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>
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
                      <DropdownMenuItem><Eye className="h-3.5 w-3.5 mr-2" />{t.view}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        toast.success(`${t.deliveryConfirmed}: ${del.id}`);
                        sendNotification(t.deliveryConfirmed, `${del.id} - ${del.client}`, "success");
                      }}><Truck className="h-3.5 w-3.5 mr-2" />{t.confirmDelivery}</DropdownMenuItem>
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
