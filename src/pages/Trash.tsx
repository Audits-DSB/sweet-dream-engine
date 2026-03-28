import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, RotateCcw, Search, AlertTriangle, Package, Users, ShoppingCart, Truck, Receipt, Boxes, Factory, UserCog, Wallet, ClipboardCheck, FileText, ChevronDown, ChevronUp, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

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

const ENTITY_LABELS: Record<string, { label: string; icon: any; color: string }> = {
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
  "external-material": { label: "مادة (كاتالوج)", icon: Boxes, color: "bg-emerald-500/10 text-emerald-600" },
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

export default function TrashPage() {
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeletedItem | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await api.get<DeletedItem[]>("/trash");
      setItems(data || []);
    } catch { setItems([]); }
    setLoading(false);
  };

  useEffect(() => { loadItems(); }, []);

  const entityTypes = useMemo(() => {
    const types = new Set(items.map(i => i.entity_type));
    return Array.from(types).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (typeFilter !== "all" && item.entity_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return item.entity_name.toLowerCase().includes(q) || item.entity_id.toLowerCase().includes(q) || item.entity_type.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, search, typeFilter]);

  const handleRestore = async (item: DeletedItem) => {
    setRestoring(item.id);
    try {
      await api.post(`/trash/${item.id}/restore`, {});
      toast.success(`تم استعادة "${item.entity_name}" بنجاح`);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (e: any) {
      toast.error(`فشل الاستعادة: ${e.message || "خطأ غير معروف"}`);
    }
    setRestoring(null);
  };

  const handlePermanentDelete = async (item: DeletedItem) => {
    try {
      await api.delete(`/trash/${item.id}`);
      toast.success("تم الحذف نهائياً");
      setItems(prev => prev.filter(i => i.id !== item.id));
      setDeleteConfirm(null);
    } catch (e: any) {
      toast.error(`فشل الحذف: ${e.message}`);
    }
  };

  const handleClearAll = async () => {
    try {
      await api.delete("/trash");
      toast.success("تم تفريغ سلة المحذوفات");
      setItems([]);
      setClearAllConfirm(false);
    } catch (e: any) {
      toast.error(`فشل التفريغ: ${e.message}`);
    }
  };

  const grouped = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(i => { map[i.entity_type] = (map[i.entity_type] || 0) + 1; });
    return map;
  }, [items]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <Trash2 className="h-6 w-6 text-muted-foreground" />
            سلة المحذوفات
          </h1>
          <p className="page-description">
            {items.length > 0 ? `${items.length} عنصر محذوف — يمكنك استعادتهم أو حذفهم نهائياً` : "سلة المحذوفات فارغة"}
          </p>
        </div>
        {items.length > 0 && (
          <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setClearAllConfirm(true)}>
            <Trash2 className="h-3.5 w-3.5" />
            تفريغ الكل
          </Button>
        )}
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(grouped).map(([type, count]) => {
            const info = ENTITY_LABELS[type] || { label: type, icon: Package, color: "bg-muted text-muted-foreground" };
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(prev => prev === type ? "all" : type)}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${typeFilter === type ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted/50"}`}
              >
                <info.icon className="h-3 w-3" />
                {info.label}
                <Badge variant="secondary" className="h-4 text-[10px] px-1">{count}</Badge>
              </button>
            );
          })}
          {typeFilter !== "all" && (
            <button onClick={() => setTypeFilter("all")} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-border hover:bg-muted/50 text-muted-foreground">
              <X className="h-3 w-3" /> الكل
            </button>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث في المحذوفات..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="كل الأنواع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              {entityTypes.map(type => (
                <SelectItem key={type} value={type}>{ENTITY_LABELS[type]?.label || type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {filtered.length === 0 && items.length > 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>لا توجد نتائج مطابقة</p>
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">سلة المحذوفات فارغة</p>
          <p className="text-sm mt-1">أي عنصر تحذفه من الموقع سيظهر هنا ويمكنك استعادته</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(item => {
          const info = ENTITY_LABELS[item.entity_type] || { label: item.entity_type, icon: Package, color: "bg-muted text-muted-foreground" };
          const Icon = info.icon;
          const isExpanded = expandedId === item.id;
          const snapshot = typeof item.snapshot === "string" ? JSON.parse(item.snapshot) : item.snapshot;
          const relatedData = typeof item.related_data === "string" ? JSON.parse(item.related_data) : item.related_data;
          const hasRelated = Object.values(relatedData).some((v: any) => Array.isArray(v) && v.length > 0);

          return (
            <div key={item.id} className="stat-card hover:border-primary/20 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${info.color} flex items-center justify-center shrink-0`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{item.entity_name}</span>
                    <Badge variant="outline" className="text-[10px] h-5">{info.label}</Badge>
                    {hasRelated && (
                      <Badge variant="secondary" className="text-[10px] h-5">
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
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline" size="sm" className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                    disabled={restoring === item.id}
                    onClick={() => handleRestore(item)}
                  >
                    {restoring === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    استعادة
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm(item)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(prev => prev === item.id ? null : item.id)}>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">البيانات المحفوظة</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(snapshot).filter(([k]) => !["created_at", "updated_at"].includes(k)).slice(0, 12).map(([key, val]) => (
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

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              حذف نهائي
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف "{deleteConfirm?.entity_name}" نهائياً؟
              <br />
              <strong>هذا الإجراء لا يمكن التراجع عنه.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handlePermanentDelete(deleteConfirm)}>حذف نهائي</Button>
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
              هل أنت متأكد من حذف جميع العناصر ({items.length}) نهائياً؟
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
