import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Trash2, Plus, Edit, RotateCcw, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

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

export default function ActivityPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuditNotification | null>(null);
  const [deletingLog, setDeletingLog] = useState(false);

  const load = async () => {
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

  useEffect(() => { load(); }, []);

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

  // Fields allowed per entity when restoring — strips computed/auto-generated columns
  const restoreAllowedFields: Record<string, string[]> = {
    client: ["id", "name", "contact", "email", "phone", "city", "status", "outstanding"],
    supplier: ["id", "name", "country", "email", "phone", "paymentTerms", "active"],
    order: ["id", "clientId", "date", "totalSelling", "totalCost", "splitMode", "deliveryFee", "status", "source"],
    delivery: ["id", "orderId", "clientId", "date", "scheduledDate", "deliveredBy", "deliveryFee", "items", "notes", "status"],
    collection: ["id", "orderId", "clientId", "client", "invoiceDate", "dueDate", "totalAmount", "paidAmount", "outstanding", "status", "paymentMethod", "notes"],
    material: ["code", "name", "category", "unit", "sellingPrice", "storeCost", "supplier", "supplierId", "manufacturer", "hasExpiry", "active"],
    founder: ["id", "name", "alias", "email", "phone", "active"],
    "founder-transaction": ["id", "founderId", "type", "amount", "date", "note"],
    "treasury-account": ["id", "name", "type", "balance", "currency"],
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
      const payload = cleanSnapshot(data.entity, data.snapshot);
      await api.post(data.endpoint, payload);
      toast.success(`✅ تمت استعادة ${entityLabels[data.entity] || data.entity}: ${data.entityName}`);
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
      // Revert order header fields
      if (before.order && Object.keys(before.order).length > 0) {
        await api.patch(data.endpoint, before.order);
      }
      // Revert individual order lines
      if (Array.isArray(before.lines) && before.lines.length > 0) {
        await Promise.all(before.lines.map((line: any) =>
          api.patch(`/order-lines/${line.id}`, {
            quantity: line.quantity,
            sellingPrice: line.sellingPrice,
            costPrice: line.costPrice,
          })
        ));
      }
      toast.success(`↩️ تم الرجوع عن التعديل: ${data.entityName}`);
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

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <History className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="page-header">سجل الأنشطة</h1>
            <p className="page-description">تاريخ جميع عمليات الإنشاء والتعديل والحذف — يمكنك استعادة أي عنصر محذوف</p>
          </div>
        </div>
      </div>

      {/* Filters */}
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

      {/* Activity List */}
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

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="حذف سجل النشاط"
        description="هل تريد حذف هذا السجل من قائمة الأنشطة؟ لن تتأثر البيانات الأصلية."
        onConfirm={handleDeleteLog}
        loading={deletingLog}
      />
    </div>
  );
}
