import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/StatCard";
import { Bell, AlertTriangle, Clock, CheckCircle2, Package, Receipt, ClipboardCheck, X } from "lucide-react";

type Alert = {
  id: string;
  type: "low_stock" | "expiry" | "overdue" | "audit" | "delivery";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  client?: string;
  date: string;
  dismissed: boolean;
};

const mockAlerts: Alert[] = [
  { id: "ALT-001", type: "low_stock", severity: "critical", title: "Milk Powder critically low", description: "Al Salam Cafe — 2kg remaining, 0.67 weeks coverage", client: "Al Salam Cafe", date: "2025-03-08", dismissed: false },
  { id: "ALT-002", type: "low_stock", severity: "critical", title: "Vanilla Extract critically low", description: "Noor Restaurant — 0.5L remaining, < 1 week coverage", client: "Noor Restaurant", date: "2025-03-08", dismissed: false },
  { id: "ALT-003", type: "expiry", severity: "warning", title: "Green Tea expiring soon", description: "Al Salam Cafe — LOT-002 expires 2025-04-20 (43 days)", client: "Al Salam Cafe", date: "2025-03-08", dismissed: false },
  { id: "ALT-004", type: "expiry", severity: "critical", title: "Milk Powder near expiry", description: "Al Salam Cafe — LOT-004 expires 2025-03-25 (17 days)", client: "Al Salam Cafe", date: "2025-03-08", dismissed: false },
  { id: "ALT-005", type: "overdue", severity: "critical", title: "Invoice overdue", description: "Blue Moon Cafe — INV-005 SAR 5,600 past due 2025-03-15", client: "Blue Moon Cafe", date: "2025-03-08", dismissed: false },
  { id: "ALT-006", type: "overdue", severity: "warning", title: "Invoice overdue", description: "Spice Garden — INV-008 SAR 1,600 remaining, past due 2025-03-08", client: "Spice Garden", date: "2025-03-08", dismissed: false },
  { id: "ALT-007", type: "audit", severity: "info", title: "Audit scheduled", description: "Royal Kitchen — audit scheduled for today", client: "Royal Kitchen", date: "2025-03-08", dismissed: false },
  { id: "ALT-008", type: "delivery", severity: "warning", title: "Delivery pending 3+ days", description: "ORD-046 Green Valley Lounge — Ready for Delivery since Mar 4", client: "Green Valley Lounge", date: "2025-03-07", dismissed: false },
  { id: "ALT-009", type: "low_stock", severity: "warning", title: "Green Tea running low", description: "Al Salam Cafe — 8kg remaining, 1.6 weeks coverage", client: "Al Salam Cafe", date: "2025-03-07", dismissed: true },
  { id: "ALT-010", type: "expiry", severity: "critical", title: "Turmeric expired", description: "Spice Garden — LOT-011 expired 2025-03-01", client: "Spice Garden", date: "2025-03-06", dismissed: true },
];

const severityStyles: Record<string, { bg: string; icon: typeof AlertTriangle }> = {
  critical: { bg: "bg-destructive/10 border-destructive/30 text-destructive", icon: AlertTriangle },
  warning: { bg: "bg-warning/10 border-warning/30 text-warning", icon: Clock },
  info: { bg: "bg-info/10 border-info/30 text-info", icon: Bell },
};

const typeIcons: Record<string, typeof Package> = {
  low_stock: Package,
  expiry: Clock,
  overdue: Receipt,
  audit: ClipboardCheck,
  delivery: Package,
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(mockAlerts);
  const [filter, setFilter] = useState<"all" | "active" | "dismissed">("active");

  const active = alerts.filter(a => !a.dismissed);
  const criticalCount = active.filter(a => a.severity === "critical").length;
  const warningCount = active.filter(a => a.severity === "warning").length;

  const dismiss = (id: string) => setAlerts(alerts.map(a => a.id === id ? { ...a, dismissed: true } : a));
  const dismissAll = () => setAlerts(alerts.map(a => ({ ...a, dismissed: true })));

  const shown = filter === "all" ? alerts : filter === "active" ? alerts.filter(a => !a.dismissed) : alerts.filter(a => a.dismissed);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Alerts</h1>
          <p className="page-description">System alerts, notifications, and action items</p>
        </div>
        {active.length > 0 && (
          <Button variant="outline" size="sm" onClick={dismissAll}>Dismiss All</Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Critical" value={criticalCount} change="Needs immediate action" changeType="negative" icon={AlertTriangle} />
        <StatCard title="Warnings" value={warningCount} change="Attention needed" changeType="neutral" icon={Clock} />
        <StatCard title="Total Active" value={active.length} change={`${alerts.filter(a => a.dismissed).length} dismissed`} changeType="neutral" icon={Bell} />
      </div>

      <div className="flex gap-2">
        {(["active", "all", "dismissed"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize h-8">
            {f} {f === "active" && active.length > 0 && <Badge className="ml-1.5 bg-destructive text-destructive-foreground border-0 h-5 min-w-5 text-[10px]">{active.length}</Badge>}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {shown.map((alert) => {
          const sev = severityStyles[alert.severity];
          const SevIcon = sev.icon;
          const TypeIcon = typeIcons[alert.type] || Bell;
          return (
            <div key={alert.id} className={`flex items-start gap-3 p-4 rounded-xl border ${alert.dismissed ? "opacity-50 bg-muted/30 border-border" : sev.bg}`}>
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${alert.dismissed ? "bg-muted" : ""}`}>
                <SevIcon className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-sm">{alert.title}</p>
                  <Badge variant="secondary" className="text-[10px] h-5">{alert.type.replace("_", " ")}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{alert.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{alert.date}</p>
              </div>
              {!alert.dismissed && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => dismiss(alert.id)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
              {alert.dismissed && (
                <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              )}
            </div>
          );
        })}
        {shown.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No alerts to show.
          </div>
        )}
      </div>
    </div>
  );
}
