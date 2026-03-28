import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { api } from "@/lib/api";
import {
  Bell, CheckCheck, AlertTriangle, Clock, Info, CheckCircle2, Package, Truck, Wallet,
  ShoppingCart, Users, Factory, UserCog, Boxes, Receipt, ClipboardCheck, FileText,
  Plus, Edit, Trash2, X, User, Filter, Volume2, VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const DISMISSED_KEY = "dsb_dismissed_alerts";
const SOUND_KEY = "dsb_notif_sound";
function getDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]")); } catch { return new Set(); }
}
function getSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_KEY) !== "off";
}

type Alert = {
  id: string; type: string; severity: string;
  title: string; description: string; date: string; link?: string;
};

const alertTypeConfig: Record<string, { icon: typeof Bell; label: string; color: string }> = {
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

const entityIcons: Record<string, typeof Bell> = {
  client: Users, order: ShoppingCart, delivery: Truck, supplier: Factory,
  material: Boxes, collection: Receipt, request: FileText, founder: UserCog,
  "founder-transaction": UserCog, "treasury-account": Wallet, "treasury-transaction": Wallet,
  audits: ClipboardCheck, "client-inventory": Package, "external-material": Boxes,
  "company-inventory": Package,
};

const entityLabels: Record<string, string> = {
  client: "عميل", order: "طلب", delivery: "توصيل", supplier: "مورّد",
  material: "مادة", collection: "تحصيل", request: "طلب عميل",
  founder: "مؤسس", "founder-transaction": "معاملة مؤسس",
  "treasury-account": "حساب خزينة", "treasury-transaction": "معاملة خزينة",
  audits: "جرد", "client-inventory": "مخزون عميل", "external-material": "مادة (كاتالوج)",
  "company-inventory": "مخزون شركة",
};

const actionConfig: Record<string, { icon: typeof Plus; label: string; color: string; bgColor: string }> = {
  create: { icon: Plus, label: "إنشاء", color: "text-green-600", bgColor: "bg-green-500/10" },
  update: { icon: Edit, label: "تعديل", color: "text-blue-600", bgColor: "bg-blue-500/10" },
  delete: { icon: Trash2, label: "حذف", color: "text-destructive", bgColor: "bg-destructive/10" },
};

function getEntityRoute(entity: string, entityId: string): string | null {
  if (!entity || !entityId) return null;
  switch (entity) {
    case "order": return `/orders/${entityId}`;
    case "client": return `/clients/${entityId}`;
    case "delivery": return `/deliveries`;
    case "supplier": return `/suppliers`;
    case "material": return `/materials`;
    case "collection": return `/collections`;
    case "founder": return `/founders`;
    case "founder-transaction": return `/founder-funding`;
    case "treasury-account": return `/treasury/accounts`;
    case "treasury-transaction": return `/treasury/transactions`;
    case "audits": return `/audits`;
    case "client-inventory": return `/inventory`;
    case "external-material": return `/materials`;
    case "company-inventory": return `/company-inventory`;
    case "request": return `/requests`;
    default: return null;
  }
}

function timeSince(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return dateStr;
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "أمس";
  if (days < 7) return `منذ ${days} يوم`;
  if (days < 30) return `منذ ${Math.floor(days / 7)} أسبوع`;
  return `منذ ${Math.floor(days / 30)} شهر`;
}

function getTimeGroup(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "أقدم";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  if (d >= today) return "اليوم";
  if (d >= yesterday) return "أمس";
  return "أقدم";
}

type ParsedNotif = {
  entity?: string; entityId?: string; entityName?: string;
  action?: string; performedBy?: string; changes?: string[];
  snapshot?: any;
};

function parseNotifMessage(msg: string | undefined): ParsedNotif | null {
  if (!msg) return null;
  try { return JSON.parse(msg); } catch { return null; }
}

function playNotifSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

type EntityFilter = "all" | "order" | "client" | "delivery" | "collection" | "founder" | "other";
const filterOptions: { value: EntityFilter; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "order", label: "طلبات" },
  { value: "client", label: "عملاء" },
  { value: "delivery", label: "توصيل" },
  { value: "collection", label: "تحصيل" },
  { value: "founder", label: "مؤسسين" },
  { value: "other", label: "أخرى" },
];
const filterEntities: Record<EntityFilter, string[]> = {
  all: [],
  order: ["order"],
  client: ["client", "client-inventory"],
  delivery: ["delivery"],
  collection: ["collection"],
  founder: ["founder", "founder-transaction"],
  other: ["supplier", "material", "treasury-account", "treasury-transaction", "audits", "external-material", "company-inventory", "request"],
};

export function NotificationBell() {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const { notifications, refreshData } = useWorkflow();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed] = useState<Set<string>>(getDismissed);
  const [tab, setTab] = useState<"alerts" | "notifs">("alerts");
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");
  const [soundEnabled, setSoundEnabled] = useState(getSoundEnabled);
  const prevCountRef = useRef(0);

  useEffect(() => {
    api.get<Alert[]>("/alerts").then(data => setAlerts(data || [])).catch(() => {});
    const interval = setInterval(() => {
      api.get<Alert[]>("/alerts").then(data => setAlerts(data || [])).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) {
      api.get<Alert[]>("/alerts").then(data => setAlerts(data || [])).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    const unreadCount = notifications.filter(n => !n.read).length;
    if (unreadCount > prevCountRef.current && prevCountRef.current > 0 && soundEnabled) {
      playNotifSound();
    }
    prevCountRef.current = unreadCount;
  }, [notifications, soundEnabled]);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      return next;
    });
  }, []);

  const unreadNotifs = notifications.filter((n) => !n.read);
  const activeAlerts = alerts.filter(a => !dismissed.has(a.id));
  const criticalAlerts = activeAlerts.filter(a => a.severity === "critical");
  const warningAlerts = activeAlerts.filter(a => a.severity === "warning");
  const totalUnread = unreadNotifs.length + activeAlerts.length;

  const groupedAlerts = useMemo(() => {
    const groups: Record<string, Alert[]> = {};
    for (const a of activeAlerts) {
      if (!groups[a.type]) groups[a.type] = [];
      groups[a.type].push(a);
    }
    const typeOrder = ["refill", "low_stock", "overdue", "expiry", "delivery", "audit"];
    const sorted: [string, Alert[]][] = [];
    for (const tp of typeOrder) { if (groups[tp]) sorted.push([tp, groups[tp]]); }
    for (const [k, v] of Object.entries(groups)) { if (!typeOrder.includes(k)) sorted.push([k, v]); }
    return sorted;
  }, [activeAlerts]);

  const filteredNotifications = useMemo(() => {
    if (entityFilter === "all") return notifications;
    const allowed = filterEntities[entityFilter];
    return notifications.filter(n => {
      const parsed = parseNotifMessage(n.message);
      if (!parsed?.entity) return entityFilter === "other";
      return allowed.includes(parsed.entity);
    });
  }, [notifications, entityFilter]);

  const groupedNotifications = useMemo(() => {
    const groups: Record<string, typeof notifications> = { "اليوم": [], "أمس": [], "أقدم": [] };
    for (const n of filteredNotifications) {
      const g = getTimeGroup(n.createdAt || n.date || "");
      if (!groups[g]) groups[g] = [];
      groups[g].push(n);
    }
    return Object.entries(groups).filter(([, items]) => items.length > 0);
  }, [filteredNotifications]);

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

  const deleteNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      refreshData();
    } catch { toast.error("فشل الحذف"); }
  };

  const clearAllRead = async () => {
    const readNotifs = notifications.filter(n => n.read);
    for (const n of readNotifs) {
      try { await api.delete(`/notifications/${n.id}`); } catch {}
    }
    refreshData();
    toast.success(`تم حذف ${readNotifs.length} إشعار`);
  };

  const handleNotifClick = (n: any) => {
    if (!n.read) markAsRead(n.id);
    const parsed = parseNotifMessage(n.message);
    if (parsed?.entity && parsed?.entityId) {
      const route = getEntityRoute(parsed.entity, parsed.entityId);
      if (route) { setOpen(false); navigate(route); return; }
    }
    setOpen(false);
    navigate("/activity");
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
      <PopoverContent className="w-[420px] p-0" align="end" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h4 className="font-semibold text-sm">{t.notifications}</h4>
          <div className="flex items-center gap-1.5">
            <button onClick={toggleSound} className="p-1 rounded hover:bg-muted transition-colors" title={soundEnabled ? "كتم الصوت" : "تشغيل الصوت"}>
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-muted-foreground" /> : <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
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

        <ScrollArea className="h-[440px]">
          {tab === "alerts" ? (
            activeAlerts.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-6 w-6 mx-auto mb-2 opacity-40" />
                لا توجد تنبيهات نشطة
              </div>
            ) : (
              <div>
                {groupedAlerts.map(([type, items]) => {
                  const cfg = alertTypeConfig[type] || { icon: Bell, label: type, color: "text-muted-foreground" };
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
            filteredNotifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">{t.noNotifications}</div>
            ) : (
              <div>
                {/* Filter chips */}
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/50 overflow-x-auto">
                  <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
                  {filterOptions.map(opt => (
                    <button
                      key={opt.value}
                      className={`text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${
                        entityFilter === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted"
                      }`}
                      onClick={() => setEntityFilter(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Actions bar */}
                {unreadNotifs.length > 0 && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/50">
                    <span className="text-[11px] font-semibold text-muted-foreground">غير مقروء ({unreadNotifs.length})</span>
                    <div className="flex items-center gap-2">
                      <button onClick={markAllAsRead} className="text-[11px] text-primary hover:underline flex items-center gap-1">
                        <CheckCheck className="h-3 w-3" /> قراءة الكل
                      </button>
                      {notifications.filter(n => n.read).length > 0 && (
                        <button onClick={clearAllRead} className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1">
                          <Trash2 className="h-3 w-3" /> مسح المقروء
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Grouped notifications */}
                {groupedNotifications.map(([group, items]) => (
                  <div key={group}>
                    <div className="px-3 py-1.5 bg-muted/20 border-b border-border/40">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{group}</span>
                    </div>
                    {items.map((n) => {
                      const parsed = parseNotifMessage(n.message);
                      const action = parsed?.action || "create";
                      const aCfg = actionConfig[action] || actionConfig.create;
                      const ActionIcon = aCfg.icon;
                      const entity = parsed?.entity || "";
                      const EntityIcon = entityIcons[entity] || Bell;
                      const eLabel = entityLabels[entity] || "";

                      return (
                        <div
                          key={n.id}
                          className={`group px-3 py-2.5 flex gap-2.5 cursor-pointer hover:bg-accent/50 transition-all border-b border-border/20 ${!n.read ? "bg-primary/5" : ""}`}
                          onClick={() => handleNotifClick(n)}
                        >
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${aCfg.bgColor}`}>
                            <ActionIcon className={`h-3.5 w-3.5 ${aCfg.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${aCfg.bgColor} ${aCfg.color}`}>
                                {aCfg.label}
                              </span>
                              {eLabel && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium flex items-center gap-0.5">
                                  <EntityIcon className="h-2.5 w-2.5" />{eLabel}
                                </span>
                              )}
                              {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                            </div>
                            <p className="text-xs font-medium leading-snug">{n.title}</p>
                            {parsed?.performedBy && (
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                                <User className="h-2.5 w-2.5" />{parsed.performedBy}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {timeSince(n.createdAt || `${n.date}T${n.time || "00:00"}`)}
                            </p>
                          </div>
                          <div className="flex items-start gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!n.read && (
                              <button onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }} className="p-1 text-muted-foreground hover:text-primary rounded" title="تحديد كمقروء">
                                <CheckCheck className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button onClick={(e) => deleteNotif(n.id, e)} className="p-1 text-muted-foreground hover:text-destructive rounded" title="حذف">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
          <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setOpen(false); navigate("/activity"); }}>
            <Clock className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
            سجل الأنشطة
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
