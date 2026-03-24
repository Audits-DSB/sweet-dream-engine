import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { api } from "@/lib/api";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export function NotificationBell() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { notifications, refreshData } = useWorkflow();
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    await api.patch(`/notifications/${id}`, { read: true });
    refreshData();
  };

  const markAllAsRead = async () => {
    if (!user) return;
    for (const n of notifications.filter(n => !n.read)) {
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

  const typeLabel: Record<string, string> = {
    info: t.info, warning: t.warning, error: t.error, success: t.success,
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" data-testid="button-notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] bg-destructive text-destructive-foreground border-0">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h4 className="font-semibold text-sm">{t.notifications}</h4>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="text-xs text-primary hover:underline flex items-center gap-1">
              <CheckCheck className="h-3 w-3" />
              {t.readAll}
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{t.noNotifications}</div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.slice(0, 30).map((n) => (
                <div
                  key={n.id}
                  className={`p-3 flex gap-3 cursor-pointer hover:bg-accent/50 transition-colors ${!n.read ? "bg-accent/20" : ""}`}
                  onClick={() => !n.read && markAsRead(n.id)}
                >
                  <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-primary"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeColor[n.type] ?? typeColor.info}`}>
                        {typeLabel[n.type] ?? t.info}
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-1 truncate">{n.title}</p>
                    {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{n.date} {n.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
