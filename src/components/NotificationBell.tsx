import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { api } from "@/lib/api";
import { Bell, CheckCheck, AlertTriangle, Clock, Info, CheckCircle2, Package, Truck, Wallet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const DISMISSED_KEY = "dsb_dismissed_alerts";
function getDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]")); } catch { return new Set(); }
}

type Alert = {
  id: string; type: string; severity: string;
  title: string; description: string; date: string; link?: string;
};

const typeConfig: Record<string, { icon: typeof Bell; label: string; color: string }> = {
  refill:    { icon: Package, label: "إعادة طلب", color: "text-violet-600" },
  low_stock: { icon: AlertTriangle, label: "مخزون منخفض", color: "text-destructive" },
  overdue:   { icon: Wallet, label: "فاتورة متأخرة", color: "text-red-600" },
  expiry:    { icon: Clock, label: "انتهاء صلاحية", color: "text-orange-600" },
  delivery:  { icon: Truck, label: "توصيل معلق", color: "text-yellow-600" },
  audit:     { icon: Info, label: "مراجعة", color: "text-primary" },
};

const sevBg: Record<string, string> = {
  critical: "bg-destructive/8 border-r-2 border-r-destructive",
  warning: "bg-yellow-500/8 border-r-2 border-r-yellow-500",
  info: "bg-primary/5",
};

export function NotificationBell() {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const { notifications, refreshData } = useWorkflow();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed] = useState<Set<string>>(getDismissed);
  const [tab, setTab] = useState<"alerts" | "notifs">("alerts");

  useEffect(() => {
    api.get<Alert[]>("/alerts").then(data => setAlerts(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      api.get<Alert[]>("/alerts").then(data => setAlerts(data || [])).catch(() => {});
    }
  }, [open]);

  const unreadNotifs = notifications.filter((n) => !n.read);
  const activeAlerts = alerts.filter(a => !dismissed.has(a.id));
  const criticalAlerts = activeAlerts.filter(a => a.severity === "critical");
  const warningAlerts = activeAlerts.filter(a => a.severity === "warning");
  const infoAlerts = activeAlerts.filter(a => a.severity === "info");
  const totalUnread = unreadNotifs.length + activeAlerts.length;

  const groupedAlerts = useMemo(() => {
    const groups: Record<string, Alert[]> = {};
    for (const a of activeAlerts) {
      if (!groups[a.type]) groups[a.type] = [];
      groups[a.type].push(a);
    }
    const typeOrder = ["refill", "low_stock", "overdue", "expiry", "delivery", "audit"];
    const sorted: [string, Alert[]][] = [];
    for (const t of typeOrder) {
      if (groups[t]) sorted.push([t, groups[t]]);
    }
    for (const [k, v] of Object.entries(groups)) {
      if (!typeOrder.includes(k)) sorted.push([k, v]);
    }
    return sorted;
  }, [activeAlerts]);

  const markAsRead = async (id: string) => {
    await api.patch(`/notifications/${id}`, { read: true });
    refreshData();
  };

  const markAllAsRead = async () => {
    for (const n of unreadNotifs) {
      await api.patch(`/notifications/${n.id}`, { read: true });
    }
    refreshData();
  };

  const typeColor: Record<string, string> = {
    info: "bg-primary/10 text-primary",
    warning: "bg-yellow-500/10 text-yellow-600",
    error: "bg-destructive/10 text-destructive",
    success: "bg-green-500/10 text-green-600",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" data-testid="button-notifications">
          <Bell className="h-4 w-4" />
          {totalUnread > 0 && (
            <Badge className={`absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] border-0 ${criticalAlerts.length > 0 ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-destructive text-destructive-foreground"}`}>
              {totalUnread > 99 ? "99+" : totalUnread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h4 className="font-semibold text-sm">{t.notifications}</h4>
          <div className="flex items-center gap-1">
            {criticalAlerts.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium animate-pulse">
                {criticalAlerts.length} حرج
              </span>
            )}
            {warningAlerts.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 font-medium">
                {warningAlerts.length} تحذير
              </span>
            )}
          </div>
        </div>

        <div className="flex border-b border-border">
          <button
            className={`flex-1 py-2 text-xs font-medium transition-colors relative ${tab === "alerts" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("alerts")}
          >
            التنبيهات
            {activeAlerts.length > 0 && (
              <Badge className="mr-1 bg-destructive text-destructive-foreground border-0 h-4 min-w-4 px-1 text-[10px]">{activeAlerts.length}</Badge>
            )}
            {tab === "alerts" && <div className="absolute bottom-0 inset-x-4 h-0.5 bg-primary rounded-full" />}
          </button>
          <button
            className={`flex-1 py-2 text-xs font-medium transition-colors relative ${tab === "notifs" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("notifs")}
          >
            الإشعارات
            {unreadNotifs.length > 0 && (
              <Badge className="mr-1 bg-primary text-primary-foreground border-0 h-4 min-w-4 px-1 text-[10px]">{unreadNotifs.length}</Badge>
            )}
            {tab === "notifs" && <div className="absolute bottom-0 inset-x-4 h-0.5 bg-primary rounded-full" />}
          </button>
        </div>

        <ScrollArea className="max-h-[420px]">
          {tab === "alerts" ? (
            activeAlerts.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-6 w-6 mx-auto mb-2 opacity-40" />
                لا توجد تنبيهات نشطة
              </div>
            ) : (
              <div>
                {groupedAlerts.map(([type, items]) => {
                  const cfg = typeConfig[type] || { icon: Bell, label: type, color: "text-muted-foreground" };
                  const TypeIcon = cfg.icon;
                  return (
                    <div key={type}>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 border-b border-border/50 sticky top-0">
                        <TypeIcon className={`h-3.5 w-3.5 ${cfg.color}`} />
                        <span className={`text-[11px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                        <Badge className="bg-muted text-muted-foreground border-0 h-4 min-w-4 px-1 text-[10px]">{items.length}</Badge>
                      </div>
                      {items.slice(0, 4).map((alert) => (
                        <div
                          key={alert.id}
                          className={`px-3 py-2.5 flex gap-2.5 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/30 ${sevBg[alert.severity] || ""}`}
                          onClick={() => { setOpen(false); if (alert.link) navigate(alert.link); else navigate("/alerts"); }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium leading-tight">{alert.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 h-fit rounded-full font-medium shrink-0 ${
                            alert.severity === "critical" ? "bg-destructive/10 text-destructive" :
                            alert.severity === "warning" ? "bg-yellow-500/10 text-yellow-600" : "bg-primary/10 text-primary"
                          }`}>
                            {alert.severity === "critical" ? "حرج" : alert.severity === "warning" ? "تحذير" : "معلومة"}
                          </span>
                        </div>
                      ))}
                      {items.length > 4 && (
                        <button
                          className="w-full py-1.5 text-[11px] text-primary hover:bg-accent/30 transition-colors text-center border-b border-border/30"
                          onClick={() => { setOpen(false); navigate(`/alerts?type=${type}`); }}
                        >
                          عرض الكل ({items.length})
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">{t.noNotifications}</div>
            ) : (
              <div>
                {unreadNotifs.length > 0 && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border/50">
                    <span className="text-[11px] font-semibold text-muted-foreground">غير مقروء ({unreadNotifs.length})</span>
                    <button onClick={markAllAsRead} className="text-[11px] text-primary hover:underline flex items-center gap-1">
                      <CheckCheck className="h-3 w-3" /> قراءة الكل
                    </button>
                  </div>
                )}
                {notifications.slice(0, 20).map((n) => (
                  <div
                    key={n.id}
                    className={`px-3 py-2.5 flex gap-2.5 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/30 ${!n.read ? "bg-primary/5" : ""}`}
                    onClick={() => !n.read && markAsRead(n.id)}
                  >
                    <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                      <div className={`h-2 w-2 rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeColor[n.type] ?? typeColor.info}`}>
                          {n.type === "info" ? t.info : n.type === "warning" ? t.warning : n.type === "error" ? t.error : t.success}
                        </span>
                      </div>
                      <p className="text-xs font-medium">{n.title}</p>
                      {n.message && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{n.date} {n.time}</p>
                    </div>
                    {!n.read && (
                      <button onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }} className="shrink-0 p-1 text-muted-foreground hover:text-primary" title="تحديد كمقروء">
                        <CheckCheck className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </ScrollArea>

        <div className="p-2 border-t border-border flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setOpen(false); navigate("/alerts"); }}>
            <AlertTriangle className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
            كل التنبيهات
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setOpen(false); navigate("/refill"); }}>
            <Package className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
            إعادة الطلب
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
