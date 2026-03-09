import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/StatCard";
import { Bell, AlertTriangle, Clock, CheckCircle2, X } from "lucide-react";

type Alert = {
  id: string; type: "low_stock" | "expiry" | "overdue" | "audit" | "delivery";
  severity: "critical" | "warning" | "info"; title: string; description: string;
  client?: string; clientId?: string; date: string; dismissed: boolean; link?: string;
};

const mockAlerts: Alert[] = [
  { id: "ALT-001", type: "low_stock", severity: "critical", title: "lowStockCritical1", description: "descLowStock1", client: "عيادة د. أحمد", clientId: "C001", date: "2025-03-08", dismissed: false, link: "/inventory" },
  { id: "ALT-002", type: "low_stock", severity: "critical", title: "lowStockCritical2", description: "descLowStock2", client: "مركز نور", clientId: "C002", date: "2025-03-08", dismissed: false, link: "/inventory" },
  { id: "ALT-003", type: "expiry", severity: "warning", title: "expirySoon1", description: "descExpiry1", client: "عيادة د. أحمد", clientId: "C001", date: "2025-03-08", dismissed: false, link: "/inventory" },
  { id: "ALT-004", type: "expiry", severity: "critical", title: "expiryCritical1", description: "descExpiry2", client: "عيادة د. أحمد", clientId: "C001", date: "2025-03-08", dismissed: false, link: "/inventory" },
  { id: "ALT-005", type: "overdue", severity: "critical", title: "overdueInvoice1", description: "descOverdue1", client: "عيادة بلو مون", clientId: "C006", date: "2025-03-08", dismissed: false, link: "/collections" },
  { id: "ALT-006", type: "overdue", severity: "warning", title: "overdueInvoice2", description: "descOverdue2", client: "مركز سبايس جاردن", clientId: "C007", date: "2025-03-08", dismissed: false, link: "/collections" },
  { id: "ALT-007", type: "audit", severity: "info", title: "auditScheduled1", description: "descAudit1", client: "المركز الملكي", clientId: "C004", date: "2025-03-08", dismissed: false, link: "/audits" },
  { id: "ALT-008", type: "delivery", severity: "warning", title: "deliveryPending1", description: "descDelivery1", client: "عيادة جرين فالي", clientId: "C003", date: "2025-03-07", dismissed: false, link: "/deliveries" },
  { id: "ALT-009", type: "low_stock", severity: "warning", title: "lowStockWarning1", description: "descLowStockW1", client: "عيادة د. أحمد", clientId: "C001", date: "2025-03-07", dismissed: true, link: "/inventory" },
  { id: "ALT-010", type: "expiry", severity: "critical", title: "expiredItem1", description: "descExpired1", client: "مركز سبايس جاردن", clientId: "C007", date: "2025-03-06", dismissed: true, link: "/inventory" },
];

// Use static Arabic titles/desc since these are domain-specific
const alertTitles: Record<string, { ar: string; en: string }> = {
  lowStockCritical1: { ar: "حليب بودرة - مخزون حرج", en: "Latex Gloves - Critical Stock" },
  lowStockCritical2: { ar: "مبيض أسنان - مخزون حرج", en: "Teeth Whitener - Critical Stock" },
  expirySoon1: { ar: "إبر تخدير قاربت على الانتهاء", en: "Anesthesia Needles Expiring Soon" },
  expiryCritical1: { ar: "قفازات لاتكس قاربت على الانتهاء", en: "Latex Gloves Near Expiry" },
  overdueInvoice1: { ar: "فاتورة متأخرة — عيادة بلو مون", en: "Overdue Invoice — Blue Moon Clinic" },
  overdueInvoice2: { ar: "فاتورة متأخرة — سبايس جاردن", en: "Overdue Invoice — Spice Garden" },
  auditScheduled1: { ar: "جرد مجدول للمركز الملكي", en: "Scheduled Audit for Royal Center" },
  deliveryPending1: { ar: "توصيل معلق +3 أيام", en: "Delivery Pending 3+ Days" },
  lowStockWarning1: { ar: "إبر تخدير - مخزون منخفض", en: "Anesthesia Needles - Low Stock" },
  expiredItem1: { ar: "مادة تلميع منتهية الصلاحية", en: "Polishing Material Expired" },
};

const alertDescs: Record<string, { ar: string; en: string }> = {
  descLowStock1: { ar: "عيادة د. أحمد — 2 كجم متبقي، تغطية 0.67 أسبوع", en: "Dr. Ahmed Clinic — 2 remaining, 0.67 weeks coverage" },
  descLowStock2: { ar: "مركز نور — 0.5 عبوة متبقية، أقل من أسبوع", en: "Noor Center — 0.5 remaining, less than 1 week" },
  descExpiry1: { ar: "عيادة د. أحمد — LOT-002 ينتهي 2025-04-20 (43 يوم)", en: "Dr. Ahmed Clinic — LOT-002 expires 2025-04-20 (43 days)" },
  descExpiry2: { ar: "عيادة د. أحمد — LOT-004 ينتهي 2025-03-25 (17 يوم)", en: "Dr. Ahmed Clinic — LOT-004 expires 2025-03-25 (17 days)" },
  descOverdue1: { ar: "عيادة بلو مون — INV-005 بقيمة 56,000 ج.م متأخرة", en: "Blue Moon — INV-005 worth 56,000 EGP overdue" },
  descOverdue2: { ar: "مركز سبايس جاردن — INV-008 بقيمة 16,000 ج.م متأخرة", en: "Spice Garden — INV-008 worth 16,000 EGP overdue" },
  descAudit1: { ar: "المركز الملكي — جرد مجدول لهذا اليوم", en: "Royal Center — audit scheduled for today" },
  descDelivery1: { ar: "ORD-046 عيادة جرين فالي — جاهز للتسليم منذ 4 مارس", en: "ORD-046 Green Valley — ready since March 4" },
  descLowStockW1: { ar: "عيادة د. أحمد — 8 علب متبقية، تغطية 1.6 أسبوع", en: "Dr. Ahmed Clinic — 8 remaining, 1.6 weeks" },
  descExpired1: { ar: "مركز سبايس جاردن — LOT-011 انتهى 2025-03-01", en: "Spice Garden — LOT-011 expired 2025-03-01" },
};

const severityStyles: Record<string, { bg: string; icon: typeof AlertTriangle }> = {
  critical: { bg: "bg-destructive/10 border-destructive/30 text-destructive", icon: AlertTriangle },
  warning: { bg: "bg-warning/10 border-warning/30 text-warning", icon: Clock },
  info: { bg: "bg-info/10 border-info/30 text-info", icon: Bell },
};

export default function AlertsPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState(mockAlerts);
  const [filter, setFilter] = useState<"all" | "active" | "dismissed">("active");

  const typeLabels: Record<string, string> = {
    low_stock: t.stockAlert, expiry: t.expiryAlert, overdue: t.overdueAlert, audit: t.auditAlert, delivery: t.deliveryAlert,
  };

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
          <h1 className="page-header">{t.alertsTitle}</h1>
          <p className="page-description">{t.alertsDesc}</p>
        </div>
        {active.length > 0 && <Button variant="outline" size="sm" onClick={dismissAll}>{t.dismissAll}</Button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title={t.criticalAlerts} value={criticalCount} change={t.needsImmediateAction} changeType="negative" icon={AlertTriangle} />
        <StatCard title={t.warnings} value={warningCount} change={t.needsAttention} changeType="neutral" icon={Clock} />
        <StatCard title={t.totalActive} value={active.length} change={`${alerts.filter(a => a.dismissed).length} ${t.dismissed}`} changeType="neutral" icon={Bell} />
      </div>

      <div className="flex gap-2">
        {(["active", "all", "dismissed"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="h-8">
            {f === "active" ? t.activeAlerts : f === "all" ? t.allAlerts : t.dismissedAlerts}
            {f === "active" && active.length > 0 && <Badge className="ltr:ml-1.5 rtl:mr-1.5 bg-destructive text-destructive-foreground border-0 h-5 min-w-5 text-[10px]">{active.length}</Badge>}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {shown.map((alert) => {
          const sev = severityStyles[alert.severity];
          const SevIcon = sev.icon;
          const title = alertTitles[alert.title]?.[lang] || alert.title;
          const desc = alertDescs[alert.description]?.[lang] || alert.description;
          return (
            <div key={alert.id} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer ${alert.dismissed ? "opacity-50 bg-muted/30 border-border" : sev.bg}`} onClick={() => alert.link && navigate(alert.link)}>
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${alert.dismissed ? "bg-muted" : ""}`}><SevIcon className="h-4.5 w-4.5" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-sm">{title}</p>
                  <Badge variant="secondary" className="text-[10px] h-5">{typeLabels[alert.type]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{desc}</p>
                <p className="text-xs text-muted-foreground mt-1">{alert.date}</p>
              </div>
              {!alert.dismissed && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={(e) => { e.stopPropagation(); dismiss(alert.id); }}><X className="h-3.5 w-3.5" /></Button>
              )}
              {alert.dismissed && <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
            </div>
          );
        })}
        {shown.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />{t.noAlerts}
          </div>
        )}
      </div>
    </div>
  );
}
