import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  History, Trash2, Plus, Edit, RotateCcw, Search, Filter, Package, Users, ShoppingCart, Truck,
  Receipt, Boxes, Factory, UserCog, Wallet, ClipboardCheck, FileText, ChevronDown, ChevronUp,
  X, AlertTriangle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type AuditNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  date: string;
  time: string;
  read: boolean;
  userId?: string;
  createdAt?: string;
};

type AuditData = {
  entity: string;
  entityId: string;
  entityName: string;
  action: "create" | "update" | "delete";
  snapshot: Record<string, any>;
  endpoint: string;
  idField?: string;
};

type DeletedItem = {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  snapshot: any;
  related_data: any;
  deleted_at: string;
  deleted_by: string;
};

const entityLabels: Record<string, string> = {
  client: "عميل",
  order: "طلب",
  delivery: "توصيل",
  supplier: "مورّد",
  material: "مادة",
  collection: "تحصيل",
  request: "طلب عميل",
  founder: "مؤسس",
  "founder-transaction": "معاملة مؤسس",
  "treasury-account": "حساب خزينة",
  "treasury-transaction": "معاملة خزينة",
};

const actionConfig = {
  create: { label: "إنشاء", icon: Plus, color: "text-success", badge: "default" as const },
  update: { label: "تعديل", icon: Edit, color: "text-info", badge: "secondary" as const },
  delete: { label: "حذف", icon: Trash2, color: "text-destructive", badge: "destructive" as const },
};

const TRASH_ENTITY_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  client: { label: "عميل", icon: Users, color: "bg-blue-500/10 text-blue-600" },
  supplier: { label: "مورّد", icon: Factory, color: "bg-violet-500/10 text-violet-600" },
  material: { label: "مادة", icon: Boxes, color: "bg-emerald-500/10 text-emerald-600" },
  founder: { label: "مؤسس", icon: UserCog, color: "bg-amber-500/10 text-amber-600" },
  "delivery-actor": { label: "مندوب توصيل", icon: Truck, color: "bg-orange-500/10 text-orange-600" },
  order: { label: "طلب", icon: ShoppingCart, color: "bg-primary/10 text-primary" },
  request: { label: "طلب عميل", icon: FileText, color: "bg-sky-500/10 text-sky-600" },
  delivery: { label: "توصيل", icon: Truck, color: "bg-teal-500/10 text-teal-600" },
  collection: { label: "تحصيل", icon: Receipt, color: "bg-green-500/10 text-green-600" },
  "client-inventory": { label: "مخزون عميل", icon: Package, color: "bg-indigo-500/10 text-indigo-600" },
  audit: { label: "جرد", icon: ClipboardCheck, color: "bg-rose-500/10 text-rose-600" },
  "treasury-account": { label: "حساب خزينة", icon: Wallet, color: "bg-yellow-500/10 text-yellow-600" },
  "treasury-transaction": { label: "معاملة خزينة", icon: Wallet, color: "bg-lime-500/10 text-lime-600" },
  "founder-transaction": { label: "معاملة مؤسس", icon: UserCog, color: "bg-cyan-500/10 text-cyan-600" },
};

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return dateStr; }
}

function timeSince(dateStr: string) {
  const now = new Date().getTime();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return formatDate(dateStr);
}

export default function ActivityPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [tab, setTab] = useState<"activity" | "trash">("activity");

  const [entries, setEntries] = useState<AuditNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuditNotification | null>(null);
  const [deletingLog, setDeletingLog] = useState(false);

  const [trashItems, setTrashItems] = useState<DeletedItem[]>([]);
  const [trashLoading, setTrashLoading] = useState(true);
  const [trashSearch, setTrashSearch] = useState("");
  const [trashTypeFilter, setTrashTypeFilter] = useState("all");
  const [trashRestoring, setTrashRestoring] = useState<string | null>(null);
  const [trashExpandedId, setTrashExpandedId] = useState<string | null>(null);
  const [trashDeleteConfirm, setTrashDeleteConfirm] = useState<DeletedItem | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);

  const loadActivity = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>("/notifications");
      const auditEntries = (data || []).filter((n: any) =>
        (n.type || "").startsWith("audit_")
      );
      setEntries(auditEntries.map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        date: n.date || n.createdAt?.split("T")[0] || "",
        time: n.time || n.createdAt?.split("T")[1]?.slice(0, 5) || "",
        read: n.read,
        userId: n.userId || n.user_id,
        createdAt: n.createdAt || n.created_at,
      })));
    } catch {
      toast.error("فشل تحميل سجل الأنشطة");
    } finally {
      setLoading(false);
    }
  };

  const loadTrash = async () => {
    setTrashLoading(true);
    try {
      const data = await api.get<DeletedItem[]>("/trash");
      setTrashItems(data || []);
    } catch { setTrashItems([]); }
    setTrashLoading(false);
  };

  useEffect(() => { loadActivity(); loadTrash(); }, []);

  const parseAuditData = (message: string): AuditData | null => {
    try { return JSON.parse(message); } catch { return null; }
  };

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const data = parseAuditData(e.message);
      const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || (data?.entityName || "").toLowerCase().includes(search.toLowerCase());
      const matchAction = filterAction === "all" || e.type === `audit_${filterAction}`;
      const matchEntity = filterEntity === "all" || data?.entity === filterEntity;
      return matchSearch && matchAction && matchEntity;
    });
  }, [entries, search, filterAction, filterEntity]);

  const grouped = useMemo(() => {
    const groups: Record<string, AuditNotification[]> = {};
    filtered.forEach((e) => {
      const key = e.date || "—";
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const restoreAllowedFields: Record<string, string[]> = {
    client: ["id", "name", "contact", "email", "phone", "city", "status", "outstanding"],
    supplier: ["id", "name", "country", "email", "phone", "paymentTerms", "active"],
    order: ["id", "clientId", "date", "totalSelling", "totalCost", "splitMode", "deliveryFee", "status", "source"],
    delivery: ["id", "orderId", "clientId", "date", "scheduledDate", "deliveredBy", "deliveryFee", "items", "notes", "status"],
    collection: ["id", "orderId", "clientId", "client", "invoiceDate", "dueDate", "totalAmount", "paidAmount", "outstanding", "status", "paymentMethod", "notes"],
    material: ["code", "name", "category", "unit", "sellingPrice", "storeCost", "supplier", "supplierId", "manufacturer", "hasExpiry", "active"],
    founder: ["id", "name", "alias", "email", "phone", "active"],
    "founder-transaction": ["id", "founderId", "founderName", "type", "amount", "method", "orderId", "date", "notes"],
    "treasury-account": ["name", "accountType", "custodianName", "bankName", "accountNumber", "description"],
    "treasury-transaction": ["id", "accountId", "type", "amount", "date", "description"],
  };

  const cleanSnapshot = (entity: string, snapshot: Record<string, any>): Record<string, any> => {
    const allowed = restoreAllowedFields[entity];
    if (!allowed) return snapshot;
    return Object.fromEntries(Object.entries(snapshot).filter(([k]) => allowed.includes(k)));
  };

  const handleRestore = async (entry: AuditNotification) => {
    const data = parseAuditData(entry.message);
    if (!data || data.action !== "delete") return;
    if (!data.snapshot || !data.endpoint) {
      toast.error("لا تتوفر بيانات الاستعادة");
      return;
    }

    setRestoring(entry.id);
    try {
      if (data.entity === "order" && data.snapshot._related) {
        const related = data.snapshot._related;
        const { _related, collectionPaid, collectionTotal, client, founderContributions, ...orderFields } = data.snapshot;
        const cleanedOrder = cleanSnapshot("order", orderFields);
        const snakify = (obj: Record<string, any>) => {
          const out: Record<string, any> = {};
          for (const [k, v] of Object.entries(obj)) {
            out[k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)] = v;
          }
          return out;
        };
        const restoreResult: any = await api.post(`/orders/${data.snapshot.id}/cascade-restore`, {
          order: snakify(cleanedOrder),
          orderLines: related.orderLines || [],
          founderContributions: related.founderContributions || [],
          deliveries: related.deliveries || [],
          collections: related.collections || [],
          clientInventory: related.clientInventory || [],
          audits: related.audits || [],
        });
        if (restoreResult?.errors?.length > 0) {
          toast.error(`استعادة جزئية — بعض البيانات لم تُستعاد: ${restoreResult.errors.join(", ")}`);
        } else {
          toast.success(`تمت استعادة الطلب وجميع البيانات المرتبطة: ${data.entityName}`);
        }
      } else {
        const payload = cleanSnapshot(data.entity, data.snapshot);
        await api.post(data.endpoint, payload);
        toast.success(`تمت استعادة ${entityLabels[data.entity] || data.entity}: ${data.entityName}`);
      }
      await api.patch(`/notifications/${entry.id}`, { title: `[مُستعاد] ${entry.title}`, read: true }).catch(() => {});
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, title: `[مُستعاد] ${e.title}`, read: true } : e));
    } catch (err: any) {
      toast.error(`فشلت الاستعادة: ${err?.message || String(err)}`);
    } finally {
      setRestoring(null);
    }
  };

  const handleRevert = async (entry: AuditNotification) => {
    const data = parseAuditData(entry.message);
    if (!data || data.action !== "update") return;
    const before = data.snapshot?.before;
    if (!before || !data.endpoint) {
      toast.error("لا تتوفر بيانات الرجوع");
      return;
    }

    setRestoring(entry.id);
    try {
      if (before.order && Object.keys(before.order).length > 0) {
        await api.patch(data.endpoint, before.order);
      }
      if (Array.isArray(before.lines) && before.lines.length > 0) {
        await Promise.all(before.lines.map((line: any) =>
          api.patch(`/order-lines/${line.id}`, {
            quantity: line.quantity,
            sellingPrice: line.sellingPrice,
            costPrice: line.costPrice,
          })
        ));
      }
      toast.success(`تم الرجوع عن التعديل: ${data.entityName}`);
      await api.patch(`/notifications/${entry.id}`, { title: `[مُرجَع] ${entry.title}`, read: true }).catch(() => {});
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, title: `[مُرجَع] ${e.title}`, read: true } : e));
    } catch (err: any) {
      toast.error(`فشل الرجوع عن التعديل: ${err?.message || String(err)}`);
    } finally {
      setRestoring(null);
    }
  };

  const handleDeleteLog = async () => {
    if (!deleteTarget) return;
    setDeletingLog(true);
    try {
      await api.delete(`/notifications/${deleteTarget.id}`);
      setEntries(prev => prev.filter(e => e.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("تم حذف سجل النشاط");
    } catch {
      toast.error("فشل حذف سجل النشاط");
    } finally {
      setDeletingLog(false);
    }
  };

  const uniqueEntities = [...new Set(entries.map(e => parseAuditData(e.message)?.entity).filter(Boolean))];

  const trashEntityTypes = useMemo(() => {
    const types = new Set(trashItems.map(i => i.entity_type));
    return Array.from(types).sort();
  }, [trashItems]);

  const filteredTrash = useMemo(() => {
    return trashItems.filter(item => {
      if (trashTypeFilter !== "all" && item.entity_type !== trashTypeFilter) return false;
      if (trashSearch) {
        const q = trashSearch.toLowerCase();
        return item.entity_name.toLowerCase().includes(q) || item.entity_id.toLowerCase().includes(q) || item.entity_type.toLowerCase().includes(q);
      }
      return true;
    });
  }, [trashItems, trashSearch, trashTypeFilter]);

  const trashGroupedCounts = useMemo(() => {
    const map: Record<string, number> = {};
    trashItems.forEach(i => { map[i.entity_type] = (map[i.entity_type] || 0) + 1; });
    return map;
  }, [trashItems]);

  const handleTrashRestore = async (item: DeletedItem) => {
    setTrashRestoring(item.id);
    try {
      await api.post(`/trash/${item.id}/restore`, {});
      toast.success(`تم استعادة "${item.entity_name}" بنجاح`);
      setTrashItems(prev => prev.filter(i => i.id !== item.id));
    } catch (e: any) {
      toast.error(`فشل الاستعادة: ${e.message || "خطأ غير معروف"}`);
    }
    setTrashRestoring(null);
  };

  const handleTrashPermanentDelete = async (item: DeletedItem) => {
    try {
      await api.delete(`/trash/${item.id}`);
      toast.success("تم الحذف نهائياً");
      setTrashItems(prev => prev.filter(i => i.id !== item.id));
      setTrashDeleteConfirm(null);
    } catch (e: any) {
      toast.error(`فشل الحذف: ${e.message}`);
    }
  };

  const handleClearAll = async () => {
    try {
      await api.delete("/trash");
      toast.success("تم تفريغ سلة المحذوفات");
      setTrashItems([]);
      setClearAllConfirm(false);
    } catch (e: any) {
      toast.error(`فشل التفريغ: ${e.message}`);
    }
  };

  if (loading && trashLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <History className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="page-header">سجل الأنشطة</h1>
            <p className="page-description">تاريخ جميع العمليات وسلة المحذوفات — يمكنك استعادة أي عنصر محذوف أو الرجوع عن أي تعديل</p>
          </div>
        </div>
      </div>

      <div className="flex border-b border-border">
        <button
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative ${tab === "activity" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("activity")}
        >
          <History className="h-4 w-4" />
          سجل الأنشطة
          <Badge variant="secondary" className="h-5 text-[10px] px-1.5">{entries.length}</Badge>
          {tab === "activity" && <div className="absolute bottom-0 inset-x-2 h-0.5 bg-primary rounded-full" />}
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative ${tab === "trash" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("trash")}
        >
          <Trash2 className="h-4 w-4" />
          سلة المحذوفات
          {trashItems.length > 0 && (
            <Badge variant="destructive" className="h-5 text-[10px] px-1.5 border-0">{trashItems.length}</Badge>
          )}
          {tab === "trash" && <div className="absolute bottom-0 inset-x-2 h-0.5 bg-primary rounded-full" />}
        </button>
      </div>

      {tab === "activity" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="ps-9 h-9"
                placeholder="بحث في الأنشطة..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-activity"
              />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[140px] h-9" data-testid="select-filter-action">
                <Filter className="h-3.5 w-3.5 me-1.5" />
                <SelectValue placeholder="الإجراء" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الإجراءات</SelectItem>
                <SelectItem value="create">إنشاء</SelectItem>
                <SelectItem value="update">تعديل</SelectItem>
                <SelectItem value="delete">حذف</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="w-[150px] h-9" data-testid="select-filter-entity">
                <SelectValue placeholder="النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {uniqueEntities.map((e) => (
                  <SelectItem key={e!} value={e!}>{entityLabels[e!] || e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ms-auto">
              {filtered.length} نشاط
            </span>
          </div>

          {grouped.length === 0 ? (
            <div className="stat-card text-center py-16">
              <History className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">لا توجد أنشطة مسجّلة بعد</p>
              <p className="text-xs text-muted-foreground mt-1">سيظهر هنا تاريخ العمليات التي تقوم بها</p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(([date, dayEntries]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-medium text-muted-foreground px-2">{date}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="space-y-2">
                    {dayEntries.map((entry) => {
                      const data = parseAuditData(entry.message);
                      const action = data?.action || "create";
                      const cfg = actionConfig[action] || actionConfig.create;
                      const Icon = cfg.icon;
                      const isDelete = action === "delete";
                      const isRestored = entry.title.startsWith("[مُستعاد]");

                      return (
                        <div
                          key={entry.id}
                          className={`stat-card flex items-start gap-3 py-3 px-4 ${isDelete && !isRestored ? "border-destructive/20" : ""}`}
                          data-testid={`activity-entry-${entry.id}`}
                        >
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isDelete ? "bg-destructive/10" : action === "create" ? "bg-success/10" : "bg-info/10"}`}>
                            <Icon className={`h-4 w-4 ${cfg.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{entry.title}</span>
                              <Badge variant={cfg.badge} className="text-[10px] h-4 px-1.5 shrink-0">
                                {cfg.label}
                              </Badge>
                              {isRestored && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-success border-success/50 shrink-0">
                                  مُستعاد
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              {data && (
                                <span className="text-xs text-muted-foreground">
                                  {entityLabels[data.entity] || data.entity}
                                  {data.entityId && ` · ${data.entityId}`}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">{entry.time}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isDelete && !isRestored && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5 text-success border-success/50 hover:bg-success/10"
                                onClick={() => handleRestore(entry)}
                                disabled={restoring === entry.id}
                                data-testid={`button-restore-${entry.id}`}
                              >
                                <RotateCcw className={`h-3 w-3 ${restoring === entry.id ? "animate-spin" : ""}`} />
                                {restoring === entry.id ? "..." : "استعادة"}
                              </Button>
                            )}
                            {action === "update" && data?.snapshot?.before && !entry.title.startsWith("[مُرجَع]") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5 text-amber-600 border-amber-400/50 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                onClick={() => handleRevert(entry)}
                                disabled={restoring === entry.id}
                                data-testid={`button-revert-${entry.id}`}
                              >
                                <RotateCcw className={`h-3 w-3 ${restoring === entry.id ? "animate-spin" : ""}`} />
                                {restoring === entry.id ? "..." : "رجوع"}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteTarget(entry)}
                              data-testid={`button-delete-log-${entry.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "trash" && (
        <>
          {trashItems.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-2">
                {Object.entries(trashGroupedCounts).map(([type, count]) => {
                  const info = TRASH_ENTITY_LABELS[type] || { label: type, icon: Package, color: "bg-muted text-muted-foreground" };
                  return (
                    <button
                      key={type}
                      onClick={() => setTrashTypeFilter(prev => prev === type ? "all" : type)}
                      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${trashTypeFilter === type ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted/50"}`}
                    >
                      <info.icon className="h-3 w-3" />
                      {info.label}
                      <Badge variant="secondary" className="h-4 text-[10px] px-1">{count}</Badge>
                    </button>
                  );
                })}
                {trashTypeFilter !== "all" && (
                  <button onClick={() => setTrashTypeFilter("all")} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-border hover:bg-muted/50 text-muted-foreground">
                    <X className="h-3 w-3" /> الكل
                  </button>
                )}
              </div>
              <Button variant="destructive" size="sm" className="gap-1.5 shrink-0" onClick={() => setClearAllConfirm(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                تفريغ الكل
              </Button>
            </div>
          )}

          {trashItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="بحث في المحذوفات..." value={trashSearch} onChange={e => setTrashSearch(e.target.value)} className="ps-9 h-9" />
              </div>
              <Select value={trashTypeFilter} onValueChange={setTrashTypeFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="كل الأنواع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  {trashEntityTypes.map(type => (
                    <SelectItem key={type} value={type}>{TRASH_ENTITY_LABELS[type]?.label || type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ms-auto">
                {filteredTrash.length} عنصر
              </span>
            </div>
          )}

          {trashLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : trashItems.length === 0 ? (
            <div className="stat-card text-center py-16">
              <Trash2 className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">سلة المحذوفات فارغة</p>
              <p className="text-xs text-muted-foreground mt-1">أي عنصر تحذفه سيظهر هنا ويمكنك استعادته</p>
            </div>
          ) : filteredTrash.length === 0 ? (
            <div className="stat-card text-center py-12">
              <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-40" />
              <p className="text-muted-foreground text-sm">لا توجد نتائج مطابقة</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTrash.map(item => {
                const info = TRASH_ENTITY_LABELS[item.entity_type] || { label: item.entity_type, icon: Package, color: "bg-muted text-muted-foreground" };
                const Icon = info.icon;
                const isExpanded = trashExpandedId === item.id;
                const snapshot = typeof item.snapshot === "string" ? JSON.parse(item.snapshot) : item.snapshot;
                const relatedData = typeof item.related_data === "string" ? JSON.parse(item.related_data) : item.related_data;
                const hasRelated = relatedData && Object.values(relatedData).some((v: any) => Array.isArray(v) && v.length > 0);

                return (
                  <div key={item.id} className="stat-card hover:border-primary/20 transition-colors">
                    <div className="flex items-start gap-3 py-1">
                      <div className={`h-9 w-9 rounded-lg ${info.color} flex items-center justify-center shrink-0`}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{item.entity_name}</span>
                          <Badge variant="destructive" className="text-[10px] h-4 px-1.5 shrink-0 border-0">
                            محذوف
                          </Badge>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">{info.label}</Badge>
                          {hasRelated && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                              + بيانات مرتبطة
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground font-mono">{item.entity_id}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{timeSince(item.deleted_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5 text-success border-success/50 hover:bg-success/10"
                          disabled={trashRestoring === item.id}
                          onClick={() => handleTrashRestore(item)}
                        >
                          {trashRestoring === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                          {trashRestoring === item.id ? "..." : "استعادة"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setTrashDeleteConfirm(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTrashExpandedId(prev => prev === item.id ? null : item.id)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <h4 className="text-xs font-semibold text-muted-foreground mb-2">البيانات المحفوظة</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(snapshot || {}).filter(([k]) => !["created_at", "updated_at"].includes(k)).slice(0, 12).map(([key, val]) => (
                            <div key={key} className="rounded bg-muted/50 px-2.5 py-1.5">
                              <span className="text-[10px] text-muted-foreground block">{key}</span>
                              <span className="text-xs font-medium truncate block">{val === null || val === undefined ? "—" : typeof val === "object" ? JSON.stringify(val).slice(0, 50) : String(val).slice(0, 60)}</span>
                            </div>
                          ))}
                        </div>
                        {hasRelated && (
                          <div className="mt-3">
                            <h4 className="text-xs font-semibold text-muted-foreground mb-1">بيانات مرتبطة (ستُستعاد معها)</h4>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(relatedData).filter(([, v]: any) => Array.isArray(v) && v.length > 0).map(([key, val]: any) => (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {key}: {val.length} سجل
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="mt-2 text-[10px] text-muted-foreground">
                          حُذف في: {formatDate(item.deleted_at)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="حذف سجل النشاط"
        description="هل تريد حذف هذا السجل من قائمة الأنشطة؟ لن تتأثر البيانات الأصلية."
        onConfirm={handleDeleteLog}
        loading={deletingLog}
      />

      <Dialog open={!!trashDeleteConfirm} onOpenChange={() => setTrashDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              حذف نهائي
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف "{trashDeleteConfirm?.entity_name}" نهائياً؟
              <br />
              <strong>هذا الإجراء لا يمكن التراجع عنه.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTrashDeleteConfirm(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => trashDeleteConfirm && handleTrashPermanentDelete(trashDeleteConfirm)}>حذف نهائي</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearAllConfirm} onOpenChange={setClearAllConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تفريغ سلة المحذوفات
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف جميع العناصر ({trashItems.length}) نهائياً؟
              <br />
              <strong>هذا الإجراء لا يمكن التراجع عنه وسيتم فقدان جميع البيانات.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setClearAllConfirm(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleClearAll}>تفريغ الكل نهائياً</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
