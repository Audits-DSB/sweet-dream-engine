import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/StatCard";
import { Bell, AlertTriangle, Clock, CheckCircle2, X, Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Alert = {
  id: string;
  type: "low_stock" | "expiry" | "overdue" | "audit" | "delivery";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  clientId?: string;
  date: string;
  link?: string;
};

const DISMISSED_KEY = "dsb_dismissed_alerts";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

const severityStyles: Record<string, { bg: string; icon: typeof AlertTriangle }> = {
  critical: { bg: "bg-destructive/10 border-destructive/30 text-destructive", icon: AlertTriangle },
  warning:  { bg: "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400", icon: Clock },
  info:     { bg: "bg-primary/10 border-primary/30 text-primary", icon: Bell },
};

const typeColors: Record<string, string> = {
  low_stock: "bg-destructive/10 text-destructive",
  expiry:    "bg-orange-500/10 text-orange-600",
  overdue:   "bg-red-500/10 text-red-600",
  delivery:  "bg-yellow-500/10 text-yellow-600",
  audit:     "bg-primary/10 text-primary",
};

export default function AlertsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rawAlerts, setRawAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);
  const [filter, setFilter] = useState<"all" | "active" | "dismissed">("active");
  const [typeFilter, setTypeFilter] = useState<string>(() => {
    const t = searchParams.get("type") || "";
    return t === "expiring" ? "expiry" : t || "all";
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const type = searchParams.get("type");
    if (type) setTypeFilter(type === "expiring" ? "expiry" : type);
  }, [searchParams]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.get<Alert[]>("/alerts");
      setRawAlerts(data || []);
    } catch {
      toast.error("تعذّر تحميل التنبيهات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAlerts(); }, []);

  const alerts = useMemo(() =>
    rawAlerts.map(a => ({ ...a, dismissed: dismissed.has(a.id) })),
    [rawAlerts, dismissed]
  );

  const typeLabels: Record<string, string> = {
    low_stock: t.stockAlert, expiry: t.expiryAlert,
    overdue: t.overdueAlert, audit: t.auditAlert, delivery: t.deliveryAlert,
  };

  const active = alerts.filter(a => !a.dismissed);
  const criticalCount = active.filter(a => a.severity === "critical").length;
  const warningCount  = active.filter(a => a.severity === "warning").length;

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    saveDismissed(next);
  };

  const undismiss = (id: string) => {
    const next = new Set(dismissed);
    next.delete(id);
    setDismissed(next);
    saveDismissed(next);
  };

  const dismissAll = () => {
    const next = new Set([...dismissed, ...active.map(a => a.id)]);
    setDismissed(next);
    saveDismissed(next);
  };

  let shown = filter === "all" ? alerts
    : filter === "active" ? alerts.filter(a => !a.dismissed)
    : alerts.filter(a => a.dismissed);

  if (typeFilter && typeFilter !== "all") {
    shown = shown.filter(a => a.type === typeFilter);
  }

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    active.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
    return counts;
  }, [active]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">{t.alertsTitle}</h1>
          <p className="page-description">{t.alertsDesc}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadAlerts} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          {active.length > 0 && (
            <Button variant="outline" size="sm" onClick={dismissAll}>{t.dismissAll}</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title={t.criticalAlerts} value={criticalCount} change={t.needsImmediateAction} changeType="negative" icon={AlertTriangle} />
        <StatCard title={t.warnings} value={warningCount} change={t.needsAttention} changeType="neutral" icon={Clock} />
        <StatCard title={t.totalActive} value={active.length} change={`${dismissed.size} ${t.dismissed}`} changeType="neutral" icon={Bell} />
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={typeFilter === "all" ? "default" : "outline"} className="h-8" onClick={() => setTypeFilter("all")}>
          الكل {active.length > 0 && <Badge className="ltr:ml-1.5 rtl:mr-1.5 bg-muted text-muted-foreground border-0 h-5 min-w-5 text-[10px]">{active.length}</Badge>}
        </Button>
        {Object.entries(typeLabels).map(([key, label]) =>
          typeCounts[key] ? (
            <Button key={key} size="sm" variant={typeFilter === key ? "default" : "outline"} className="h-8" onClick={() => setTypeFilter(key)}>
              {label}
              <Badge className="ltr:ml-1.5 rtl:mr-1.5 bg-muted text-muted-foreground border-0 h-5 min-w-5 text-[10px]">{typeCounts[key]}</Badge>
            </Button>
          ) : null
        )}
      </div>

      <div className="flex gap-2">
        {(["active", "all", "dismissed"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "secondary" : "ghost"} onClick={() => setFilter(f)} className="h-8 text-xs">
            {f === "active" ? t.activeAlerts : f === "all" ? t.allAlerts : t.dismissedAlerts}
            {f === "active" && active.length > 0 && (
              <Badge className="ltr:ml-1.5 rtl:mr-1.5 bg-destructive text-destructive-foreground border-0 h-5 min-w-5 text-[10px]">{active.length}</Badge>
            )}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((alert) => {
            const sev = severityStyles[alert.severity] || severityStyles.info;
            const SevIcon = sev.icon;
            const isDismissed = dismissed.has(alert.id);
            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-opacity ${
                  isDismissed ? "opacity-50 bg-muted/30 border-border" : sev.bg
                }`}
                onClick={() => alert.link && navigate(alert.link)}
              >
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isDismissed ? "bg-muted" : ""}`}>
                  <SevIcon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-semibold text-sm">{alert.title}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeColors[alert.type] || "bg-muted text-muted-foreground"}`}>
                      {typeLabels[alert.type] || alert.type}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
                      alert.severity === "critical" ? "border-destructive/40 text-destructive" :
                      alert.severity === "warning"  ? "border-yellow-500/40 text-yellow-600" :
                      "border-primary/40 text-primary"
                    }`}>
                      {alert.severity === "critical" ? "حرج" : alert.severity === "warning" ? "تحذير" : "معلومة"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{alert.date}</p>
                </div>
                {!isDismissed ? (
                  <Button
                    variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0"
                    onClick={(e) => { e.stopPropagation(); dismiss(alert.id); }}
                    title="إخفاء"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 text-muted-foreground"
                    onClick={(e) => { e.stopPropagation(); undismiss(alert.id); }}
                    title="إظهار مجدداً"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
          {shown.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {t.noAlerts}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
