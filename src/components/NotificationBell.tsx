import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { api } from "@/lib/api";
import { Bell, CheckCheck, AlertTriangle, Clock, Info, CheckCircle2, Package } from "lucide-react";
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

export function NotificationBell() {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const { notifications, refreshData } = useWorkflow();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed] = useState<Set<string>>(getDismissed);

  useEffect(() => {
    api.get<Alert[]>("/alerts").then(data => setAlerts(data || [])).catch(() => {});
  }, []);

  const unreadNotifs = notifications.filter((n) => !n.read);
  const activeAlerts = alerts.filter(a => !dismissed.has(a.id));
  const totalUnread = unreadNotifs.length + activeAlerts.length;

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
  const TypeIcon: Record<string, typeof Bell> = {
    info: Info, warning: Clock, error: AlertTriangle, success: CheckCircle2,
  };
  const severityIcon: Record<string, typeof Bell> = {
    critical: AlertTriangle, warning: Clock, info: Info,
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" data-testid="button-notifications">
          <Bell className="h-4 w-4" />
          {totalUnread > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] bg-destructive text-destructive-foreground border-0">
              {totalUnread > 99 ? "99+" : totalUnread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h4 className="font-semibold text-sm">{t.notifications}</h4>
          <div className="flex items-center gap-2">
            {activeAlerts.length > 0 && (
              <button
                onClick={() => { setOpen(false); navigate("/alerts"); }}
                className="text-xs text-destructive hover:underline flex items-center gap-1"
              >
                <AlertTriangle className="h-3 w-3" />
                {activeAlerts.length} تنبيه
              </button>
            )}
            {unreadNotifs.length > 0 && (
              <button onClick={markAllAsRead} className="text-xs text-primary hover:underline flex items-center gap-1">
                <CheckCheck className="h-3 w-3" />
                {t.readAll}
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-96">
          {totalUnread === 0 && notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{t.noNotifications}</div>
          ) : (
            <div className="divide-y divide-border">

              {/* Dynamic alerts section */}
              {activeAlerts.slice(0, 5).map((alert) => {
                const SevIcon = severityIcon[alert.severity] || Info;
                return (
                  <div
                    key={alert.id}
                    className="p-3 flex gap-3 cursor-pointer hover:bg-accent/50 transition-colors bg-destructive/5"
                    onClick={() => { setOpen(false); if (alert.link) navigate(alert.link); else navigate("/alerts"); }}
                  >
                    <SevIcon className={`h-4 w-4 mt-0.5 shrink-0 ${
                      alert.severity === "critical" ? "text-destructive" :
                      alert.severity === "warning" ? "text-yellow-500" : "text-primary"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{alert.title}</p>
                      {alert.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {activeAlerts.length > 5 && (
                <button
                  className="w-full p-2 text-xs text-primary hover:bg-accent/30 transition-colors text-center"
                  onClick={() => { setOpen(false); navigate("/alerts"); }}
                >
                  عرض كل التنبيهات ({activeAlerts.length})
                </button>
              )}

              {/* Regular notifications */}
              {notifications.slice(0, 20).map((n) => {
                const NIcon = TypeIcon[n.type] || Info;
                return (
                  <div
                    key={n.id}
                    className={`p-3 flex gap-3 cursor-pointer hover:bg-accent/50 transition-colors ${!n.read ? "bg-accent/20" : ""}`}
                    onClick={() => !n.read && markAsRead(n.id)}
                  >
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className={`h-2 w-2 rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeColor[n.type] ?? typeColor.info}`}>
                          {n.type === "info" ? t.info : n.type === "warning" ? t.warning : n.type === "error" ? t.error : t.success}
                        </span>
                        {!n.read && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                            className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                            title="تحديد كمقروء"
                          >
                            <CheckCheck className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm font-medium mt-1 truncate">{n.title}</p>
                      {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{n.date} {n.time}</p>
                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-2 border-t border-border">
          <Button
            variant="ghost" size="sm" className="w-full h-8 text-xs"
            onClick={() => { setOpen(false); navigate("/alerts"); }}
          >
            <Bell className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
            عرض كل التنبيهات والإشعارات
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
