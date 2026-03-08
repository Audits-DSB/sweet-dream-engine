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
  { id: "ALT-001", type: "low_stock", severity: "critical", title: "حليب بودرة - مخزون حرج", description: "عيادة د. أحمد — 2 كجم متبقي، تغطية 0.67 أسبوع", client: "عيادة د. أحمد", date: "2025-03-08", dismissed: false },
  { id: "ALT-002", type: "low_stock", severity: "critical", title: "مبيض أسنان - مخزون حرج", description: "مركز نور — 0.5 عبوة متبقية، أقل من أسبوع", client: "مركز نور", date: "2025-03-08", dismissed: false },
  { id: "ALT-003", type: "expiry", severity: "warning", title: "إبر تخدير قاربت على الانتهاء", description: "عيادة د. أحمد — LOT-002 ينتهي 2025-04-20 (43 يوم)", client: "عيادة د. أحمد", date: "2025-03-08", dismissed: false },
  { id: "ALT-004", type: "expiry", severity: "critical", title: "قفازات لاتكس قاربت على الانتهاء", description: "عيادة د. أحمد — LOT-004 ينتهي 2025-03-25 (17 يوم)", client: "عيادة د. أحمد", date: "2025-03-08", dismissed: false },
  { id: "ALT-005", type: "overdue", severity: "critical", title: "فاتورة متأخرة", description: "عيادة بلو مون — INV-005 بقيمة 56,000 ج.م متأخرة", client: "عيادة بلو مون", date: "2025-03-08", dismissed: false },
  { id: "ALT-006", type: "overdue", severity: "warning", title: "فاتورة متأخرة", description: "مركز سبايس جاردن — INV-008 بقيمة 16,000 ج.م متأخرة", client: "مركز سبايس جاردن", date: "2025-03-08", dismissed: false },
  { id: "ALT-007", type: "audit", severity: "info", title: "جرد مجدول", description: "المركز الملكي — جرد مجدول لهذا اليوم", client: "المركز الملكي", date: "2025-03-08", dismissed: false },
  { id: "ALT-008", type: "delivery", severity: "warning", title: "توصيل معلق +3 أيام", description: "ORD-046 عيادة جرين فالي — جاهز للتسليم منذ 4 مارس", client: "عيادة جرين فالي", date: "2025-03-07", dismissed: false },
  { id: "ALT-009", type: "low_stock", severity: "warning", title: "إبر تخدير - مخزون منخفض", description: "عيادة د. أحمد — 8 علب متبقية، تغطية 1.6 أسبوع", client: "عيادة د. أحمد", date: "2025-03-07", dismissed: true },
  { id: "ALT-010", type: "expiry", severity: "critical", title: "مادة تلميع منتهية الصلاحية", description: "مركز سبايس جاردن — LOT-011 انتهى 2025-03-01", client: "مركز سبايس جاردن", date: "2025-03-06", dismissed: true },
];

const severityStyles: Record<string, { bg: string; icon: typeof AlertTriangle }> = {
  critical: { bg: "bg-destructive/10 border-destructive/30 text-destructive", icon: AlertTriangle },
  warning: { bg: "bg-warning/10 border-warning/30 text-warning", icon: Clock },
  info: { bg: "bg-info/10 border-info/30 text-info", icon: Bell },
};

const typeLabels: Record<string, string> = {
  low_stock: "مخزون", expiry: "صلاحية", overdue: "متأخر", audit: "جرد", delivery: "توصيل",
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
          <h1 className="page-header">التنبيهات</h1>
          <p className="page-description">تنبيهات النظام والإشعارات والإجراءات المطلوبة</p>
        </div>
        {active.length > 0 && (
          <Button variant="outline" size="sm" onClick={dismissAll}>تجاهل الكل</Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="حرج" value={criticalCount} change="يحتاج إجراء فوري" changeType="negative" icon={AlertTriangle} />
        <StatCard title="تحذيرات" value={warningCount} change="يحتاج انتباه" changeType="neutral" icon={Clock} />
        <StatCard title="إجمالي النشط" value={active.length} change={`${alerts.filter(a => a.dismissed).length} تم تجاهلها`} changeType="neutral" icon={Bell} />
      </div>

      <div className="flex gap-2">
        {(["active", "all", "dismissed"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="h-8">
            {f === "active" ? "نشط" : f === "all" ? "الكل" : "تم تجاهلها"} {f === "active" && active.length > 0 && <Badge className="ml-1.5 bg-destructive text-destructive-foreground border-0 h-5 min-w-5 text-[10px]">{active.length}</Badge>}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {shown.map((alert) => {
          const sev = severityStyles[alert.severity];
          const SevIcon = sev.icon;
          return (
            <div key={alert.id} className={`flex items-start gap-3 p-4 rounded-xl border ${alert.dismissed ? "opacity-50 bg-muted/30 border-border" : sev.bg}`}>
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${alert.dismissed ? "bg-muted" : ""}`}>
                <SevIcon className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-sm">{alert.title}</p>
                  <Badge variant="secondary" className="text-[10px] h-5">{typeLabels[alert.type]}</Badge>
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
            لا توجد تنبيهات للعرض.
          </div>
        )}
      </div>
    </div>
  );
}
