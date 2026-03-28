import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  History, Trash2, Plus, Edit, RotateCcw, Search, Filter, Package, Users, ShoppingCart, Truck,
  Receipt, Boxes, Factory, UserCog, Wallet, ClipboardCheck, FileText, ChevronUp,
  X, AlertTriangle, Loader2, Eye, User, Lock, Download, Calendar, RefreshCw, Sparkles,
  TrendingUp, ChevronLeft, ChevronRight, ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { exportToCsv } from "@/lib/exportCsv";

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
  performedBy?: string;
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
  "external-material": "مادة (كاتالوج)",
};

const entityIcons: Record<string, any> = {
  client: Users,
  order: ShoppingCart,
  delivery: Truck,
  supplier: Factory,
  material: Boxes,
  collection: Receipt,
  request: FileText,
  founder: UserCog,
  "founder-transaction": UserCog,
  "treasury-account": Wallet,
  "treasury-transaction": Wallet,
  "external-material": Boxes,
  audit: ClipboardCheck,
  "client-inventory": Package,
  "delivery-actor": Truck,
};

const fieldLabels: Record<string, string> = {
  name: "الاسم", sku: "الكود", code: "الكود", category: "الفئة", description: "الوصف",
  price_retail: "سعر البيع", price_wholesale: "سعر الجملة", sellingPrice: "سعر البيع",
  storeCost: "سعر التكلفة", stock_quantity: "الكمية", quantity: "الكمية", barcode: "الباركود",
  image_url: "رابط الصورة", manufacturer: "الشركة المصنعة", supplier: "المورّد",
  supplierId: "كود المورّد", unit: "الوحدة", hasExpiry: "له تاريخ صلاحية", active: "نشط",
  phone: "الهاتف", email: "البريد", city: "المدينة", contact: "جهة الاتصال", status: "الحالة",
  outstanding: "المتبقي", country: "الدولة", paymentTerms: "شروط الدفع", alias: "الاسم المستعار",
  totalContributed: "إجمالي المساهمة", totalWithdrawn: "إجمالي السحب", amount: "المبلغ",
  method: "الطريقة", notes: "ملاحظات", date: "التاريخ", totalSelling: "إجمالي البيع",
  totalCost: "إجمالي التكلفة", deliveryFee: "رسوم التوصيل", splitMode: "نمط التقسيم",
  clientId: "كود العميل", orderId: "كود الطلب", client: "العميل", invoiceDate: "تاريخ الفاتورة",
  dueDate: "تاريخ الاستحقاق", totalAmount: "المبلغ الإجمالي", paidAmount: "المبلغ المدفوع",
  paymentMethod: "طريقة الدفع", accountType: "نوع الحساب", custodianName: "اسم الأمين",
  bankName: "اسم البنك", accountNumber: "رقم الحساب", lines: "البنود", items: "العناصر",
  order: "الطلب", changes: "التعديلات", before: "القيم السابقة", after: "القيم الجديدة",
  materialCode: "كود المادة", materialName: "اسم المادة", material_code: "كود المادة",
  material_name: "اسم المادة", costPrice: "سعر التكلفة", lineTotal: "إجمالي السطر",
  lineCost: "تكلفة السطر", total_selling: "إجمالي البيع", total_cost: "إجمالي التكلفة",
  delivery_fee: "رسوم التوصيل", delivery_fee_bearer: "تحمل رسوم التوصيل",
  order_type: "نوع الطلب", orderType: "نوع الطلب", split_mode: "نمط التقسيم",
  subscription: "الاشتراك", founder: "المؤسس", percentage: "النسبة", paid: "مدفوع",
  balance: "الرصيد", txType: "نوع المعاملة", performedBy: "بواسطة", referenceId: "المرجع",
  linkedAccountId: "الحساب المرتبط", scheduledDate: "تاريخ مجدول", deliveredBy: "المندوب",
  remaining: "المتبقي", lot_number: "رقم الدُفعة", source_order: "طلب المصدر",
  cost_price: "سعر التكلفة", address: "العنوان", type: "النوع",
};

const actionConfig = {
  create: { label: "إنشاء", icon: Plus, color: "text-success", badge: "default" as const, bgColor: "bg-success/10" },
  update: { label: "تعديل", icon: Edit, color: "text-info", badge: "secondary" as const, bgColor: "bg-info/10" },
  delete: { label: "حذف", icon: Trash2, color: "text-destructive", badge: "destructive" as const, bgColor: "bg-destructive/10" },
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
  "external-material": { label: "مادة (كاتالوج)", icon: Boxes, color: "bg-emerald-500/10 text-emerald-600" },
};

const FINANCIAL_ENTITIES = ["treasury-transaction", "treasury_transaction", "treasury-account", "collection"];

function isFinancialEntry(data: AuditData | null): boolean {
  if (!data) return false;
  if (FINANCIAL_ENTITIES.includes(data.entity)) return true;
  if (data.entity === "order" && data.snapshot && (data.snapshot.founderPaid || data.snapshot.type === "funding_undo" || data.snapshot.type === "split_edit" || data.snapshot.newPaymentEntry)) return true;
  if (data.entity === "founder" && data.snapshot?.type === "order_funding_paid") return true;
  return false;
}

function parseAuditData(message: string): AuditData | null {
  try { return JSON.parse(message); } catch { return null; }
}

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

function isRecentEntry(createdAt?: string): boolean {
  if (!createdAt) return false;
  const diff = Date.now() - new Date(createdAt).getTime();
  return diff < 3600000;
}

const statusLabels: Record<string, string> = {
  Processing: "قيد المعالجة", Delivered: "تم التسليم", Completed: "مكتمل",
  "Partially Delivered": "تسليم جزئي", Pending: "معلق", Cancelled: "ملغي",
  paid: "مدفوع", unpaid: "غير مدفوع", active: "نشط", inactive: "غير نشط",
};

function formatValue(val: any): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "نعم" : "لا";
  if (typeof val === "number") return val.toLocaleString();
  if (typeof val === "string") {
    if (statusLabels[val]) return statusLabels[val];
    return val.length > 120 ? val.slice(0, 120) + "…" : val;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return "—";
    return `${val.length} عنصر`;
  }
  if (typeof val === "object") {
    const keys = Object.keys(val);
    if (keys.length === 0) return "—";
    const readable = keys.slice(0, 3).map(k => {
      const label = fieldLabels[k] || k;
      const v = val[k];
      const display = v === null || v === undefined ? "—" : typeof v === "number" ? v.toLocaleString() : typeof v === "boolean" ? (v ? "نعم" : "لا") : String(v).slice(0, 30);
      return `${label}: ${display}`;
    }).join(" · ");
    return keys.length > 3 ? readable + ` (+${keys.length - 3})` : readable;
  }
  return String(val).slice(0, 100);
}

function ArrayDetails({ items, label }: { items: any[]; label: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2">
      <span className="text-[10px] font-semibold text-muted-foreground block mb-1.5">{label} ({items.length})</span>
      <div className="space-y-1.5">
        {items.slice(0, 5).map((item, i) => {
          if (typeof item !== "object" || item === null) return <span key={i} className="text-xs block">{String(item)}</span>;
          const name = item.materialName || item.name || item.material_name || "";
          const code = item.materialCode || item.code || item.material_code || item.sku || "";
          const qty = item.quantity ?? item.qty;
          const price = item.sellingPrice ?? item.selling_price ?? item.price ?? item.unitPrice;
          const cost = item.costPrice ?? item.cost_price;
          return (
            <div key={i} className="flex items-center gap-2 text-xs rounded-md bg-muted/40 px-2.5 py-1.5 border border-border/20">
              <span className="text-muted-foreground font-mono text-[10px] shrink-0">{code || `#${i + 1}`}</span>
              {name && <span className="font-medium truncate">{name}</span>}
              {qty !== undefined && <span className="text-muted-foreground shrink-0">×{Number(qty).toLocaleString()}</span>}
              {price !== undefined && <span className="text-muted-foreground shrink-0">{Number(price).toLocaleString()} ج.م</span>}
              {cost !== undefined && <span className="text-[10px] text-muted-foreground shrink-0">(تكلفة: {Number(cost).toLocaleString()})</span>}
            </div>
          );
        })}
        {items.length > 5 && <span className="text-[10px] text-muted-foreground block text-center">+{items.length - 5} عنصر إضافي</span>}
      </div>
    </div>
  );
}

function DiffView({ before, after, skipKeys = [] }: { before: Record<string, any>; after: Record<string, any>; skipKeys?: string[] }) {
  const hiddenKeys = ["created_at", "updated_at", "createdAt", "updatedAt", "id", "_related", "images", "features", "variants", "before", ...skipKeys];
  const allKeys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].filter(k => !hiddenKeys.includes(k));
  const changedKeys = allKeys.filter(k => {
    const bv = before?.[k];
    const av = after?.[k];
    if (Array.isArray(bv) || Array.isArray(av)) return false;
    if (typeof bv === "object" && bv !== null && typeof av === "object" && av !== null) return JSON.stringify(bv) !== JSON.stringify(av);
    return String(bv ?? "") !== String(av ?? "");
  });
  if (changedKeys.length === 0) return null;

  return (
    <div className="space-y-1.5 mt-2">
      {changedKeys.slice(0, 12).map(key => {
        const bv = before?.[key];
        const av = after?.[key];
        if (typeof bv === "object" && bv !== null && typeof av === "object" && av !== null) {
          return (
            <div key={key} className="rounded-lg border border-border/40 px-3 py-1.5 text-xs">
              <span className="text-muted-foreground font-medium block mb-1">{fieldLabels[key] || key}</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-red-50 dark:bg-red-950/30 rounded px-2 py-1">
                  {Object.entries(bv).slice(0, 4).map(([k2, v2]) => (
                    <div key={k2}><span className="text-muted-foreground">{fieldLabels[k2] || k2}:</span> <span className="text-red-700 dark:text-red-400">{formatValue(v2)}</span></div>
                  ))}
                </div>
                <div className="bg-green-50 dark:bg-green-950/30 rounded px-2 py-1">
                  {Object.entries(av).slice(0, 4).map(([k2, v2]) => (
                    <div key={k2}><span className="text-muted-foreground">{fieldLabels[k2] || k2}:</span> <span className="text-green-700 dark:text-green-400">{formatValue(v2)}</span></div>
                  ))}
                </div>
              </div>
            </div>
          );
        }
        return (
          <div key={key} className="rounded-lg border border-border/40 px-3 py-1.5 flex items-center gap-3 text-xs">
            <span className="text-muted-foreground font-medium min-w-[80px] shrink-0">{fieldLabels[key] || key}</span>
            <span className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded line-through text-[11px]">
              {formatValue(bv)}
            </span>
            <span className="text-muted-foreground">←</span>
            <span className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded font-medium text-[11px]">
              {formatValue(av)}
            </span>
          </div>
        );
      })}
      {changedKeys.length > 12 && (
        <span className="text-[10px] text-muted-foreground block text-center">+{changedKeys.length - 12} حقل آخر</span>
      )}
    </div>
  );
}

function SnapshotDetails({ snapshot, skipKeys = [] }: { snapshot: Record<string, any>; skipKeys?: string[] }) {
  const hiddenKeys = ["created_at", "updated_at", "createdAt", "updatedAt", "id", "_related", "images", "features", "variants", ...skipKeys];
  const allEntries = Object.entries(snapshot || {}).filter(([k]) => !hiddenKeys.includes(k));
  if (allEntries.length === 0) return null;

  const simpleEntries = allEntries.filter(([, v]) => !Array.isArray(v) && (typeof v !== "object" || v === null));
  const arrayEntries = allEntries.filter(([, v]) => Array.isArray(v));
  const objectEntries = allEntries.filter(([, v]) => typeof v === "object" && v !== null && !Array.isArray(v));

  return (
    <div className="space-y-2 mt-2">
      {simpleEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {simpleEntries.slice(0, 15).map(([key, val]) => (
            <div key={key} className="rounded-lg bg-muted/50 px-2.5 py-1.5 border border-border/30">
              <span className="text-[10px] text-muted-foreground block">{fieldLabels[key] || key}</span>
              <span className="text-xs font-medium block" style={{ wordBreak: "break-word" }}>{formatValue(val)}</span>
            </div>
          ))}
          {simpleEntries.length > 15 && (
            <div className="rounded-lg bg-muted/30 px-2.5 py-1.5 flex items-center justify-center text-[10px] text-muted-foreground">
              +{simpleEntries.length - 15} حقل إضافي
            </div>
          )}
        </div>
      )}
      {objectEntries.map(([key, val]) => (
        <div key={key} className="rounded-lg bg-muted/30 px-2.5 py-2 border border-border/20">
          <span className="text-[10px] font-semibold text-muted-foreground block mb-1">{fieldLabels[key] || key}</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {Object.entries(val).filter(([k]) => !hiddenKeys.includes(k)).slice(0, 8).map(([k2, v2]) => (
              <div key={k2} className="text-xs">
                <span className="text-[10px] text-muted-foreground">{fieldLabels[k2] || k2}: </span>
                <span className="font-medium">{formatValue(v2)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {arrayEntries.map(([key, val]) => (
        <ArrayDetails key={key} items={val} label={fieldLabels[key] || key} />
      ))}
    </div>
  );
}

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

const PAGE_SIZE = 50;

export default function ActivityPage() {
  useLanguage();
  useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const highlightRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"activity" | "trash">("activity");

  const [entries, setEntries] = useState<AuditNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuditNotification | null>(null);
  const [deletingLog, setDeletingLog] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(highlightId);

  const [trashItems, setTrashItems] = useState<DeletedItem[]>([]);
  const [trashLoading, setTrashLoading] = useState(true);
  const [trashSearch, setTrashSearch] = useState("");
  const [trashTypeFilter, setTrashTypeFilter] = useState("all");
  const [trashRestoring, setTrashRestoring] = useState<string | null>(null);
  const [trashExpandedId, setTrashExpandedId] = useState<string | null>(null);
  const [trashDeleteConfirm, setTrashDeleteConfirm] = useState<DeletedItem | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);

  const loadActivity = useCallback(async () => {
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
  }, []);

  const loadTrash = async () => {
    setTrashLoading(true);
    try {
      const data = await api.get<DeletedItem[]>("/trash");
      setTrashItems(data || []);
    } catch { setTrashItems([]); }
    setTrashLoading(false);
  };

  useEffect(() => { loadActivity(); loadTrash(); }, [loadActivity]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadActivity();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadActivity]);

  useEffect(() => {
    if (highlightId && !loading && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [highlightId, loading]);

  const uniqueUsers = useMemo(() => {
    const users = new Set<string>();
    entries.forEach(e => {
      const data = parseAuditData(e.message);
      if (data?.performedBy) users.add(data.performedBy);
    });
    return [...users].sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const data = parseAuditData(e.message);
      const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || (data?.entityName || "").toLowerCase().includes(search.toLowerCase());
      const matchAction = filterAction === "all" || e.type === `audit_${filterAction}`;
      const matchEntity = filterEntity === "all" || data?.entity === filterEntity;
      const matchUser = filterUser === "all" || data?.performedBy === filterUser;
      const matchDateFrom = !dateFrom || e.date >= dateFrom;
      const matchDateTo = !dateTo || e.date <= dateTo;
      return matchSearch && matchAction && matchEntity && matchUser && matchDateFrom && matchDateTo;
    });
  }, [entries, search, filterAction, filterEntity, filterUser, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedFiltered = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [search, filterAction, filterEntity, filterUser, dateFrom, dateTo]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
  }, [page, totalPages]);

  const grouped = useMemo(() => {
    const groups: Record<string, AuditNotification[]> = {};
    paginatedFiltered.forEach((e) => {
      const key = e.date || "—";
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [paginatedFiltered]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayEntries = entries.filter(e => e.date === today);
    const creates = entries.filter(e => e.type === "audit_create").length;
    const updates = entries.filter(e => e.type === "audit_update").length;
    const deletes = entries.filter(e => e.type === "audit_delete").length;

    const userCounts: Record<string, number> = {};
    todayEntries.forEach(e => {
      const data = parseAuditData(e.message);
      if (data?.performedBy) userCounts[data.performedBy] = (userCounts[data.performedBy] || 0) + 1;
    });
    const topUser = Object.entries(userCounts).sort(([, a], [, b]) => b - a)[0];

    const entityCounts: Record<string, number> = {};
    entries.forEach(e => {
      const data = parseAuditData(e.message);
      if (data?.entity) entityCounts[data.entity] = (entityCounts[data.entity] || 0) + 1;
    });
    const topEntity = Object.entries(entityCounts).sort(([, a], [, b]) => b - a)[0];

    return { todayCount: todayEntries.length, creates, updates, deletes, topUser, topEntity, total: entries.length };
  }, [entries]);

  const handleExportCsv = () => {
    const headers = ["التاريخ", "الوقت", "الإجراء", "النوع", "الاسم", "الكود", "بواسطة"];
    const rows = filtered.map(e => {
      const data = parseAuditData(e.message);
      return [
        e.date,
        e.time,
        data?.action === "create" ? "إنشاء" : data?.action === "update" ? "تعديل" : data?.action === "delete" ? "حذف" : e.type,
        entityLabels[data?.entity || ""] || data?.entity || "",
        data?.entityName || e.title,
        data?.entityId || "",
        data?.performedBy || "غير معروف",
      ] as (string | number)[];
    });
    exportToCsv(`activity-log`, headers, rows);
    toast.success(`تم تصدير ${rows.length} سجل`);
  };

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
    "external-material": ["sku", "name", "category", "description", "price_retail", "price_wholesale", "stock_quantity", "barcode", "image_url"],
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
      if (data.entity === "external-material") {
        const payload = cleanSnapshot("external-material", data.snapshot);
        await api.post("/external-materials", payload);
        toast.success(`تمت استعادة المادة: ${data.entityName}`);
      } else if (data.entity === "order" && data.snapshot._related) {
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
      if (data.entity === "external-material" && data.entityId) {
        await api.patch(`/external-materials/${data.entityId}`, before);
        toast.success(`تم الرجوع عن التعديل: ${data.entityName}`);
      } else if (before.order && Object.keys(before.order).length > 0) {
        await api.patch(data.endpoint, before.order);
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
      } else {
        await api.patch(data.endpoint, before);
        toast.success(`تم الرجوع عن التعديل: ${data.entityName}`);
      }
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <History className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="page-header">سجل الأنشطة</h1>
            <p className="page-description">تاريخ جميع العمليات وسلة المحذوفات — يمكنك استعادة أي عنصر محذوف أو الرجوع عن أي تعديل</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => loadActivity()}>
              <RefreshCw className="h-3.5 w-3.5" />
              تحديث
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExportCsv} disabled={filtered.length === 0}>
              <Download className="h-3.5 w-3.5" />
              تصدير CSV
            </Button>
          </div>
        </div>
      </div>

      {tab === "activity" && !loading && entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">اليوم</span>
            </div>
            <span className="text-xl font-bold">{stats.todayCount}</span>
            <span className="text-[10px] text-muted-foreground block">عملية</span>
          </div>
          <div className="stat-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-md bg-success/10 flex items-center justify-center">
                <Plus className="h-3.5 w-3.5 text-success" />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">إنشاء / تعديل / حذف</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-success">{stats.creates}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-bold text-info">{stats.updates}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-bold text-destructive">{stats.deletes}</span>
            </div>
          </div>
          <div className="stat-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">الأنشط اليوم</span>
            </div>
            {stats.topUser ? (
              <>
                <span className="text-sm font-bold truncate block">{stats.topUser[0]}</span>
                <span className="text-[10px] text-muted-foreground">{stats.topUser[1]} عملية</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">لا توجد عمليات</span>
            )}
          </div>
          <div className="stat-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-md bg-violet-500/10 flex items-center justify-center">
                <Package className="h-3.5 w-3.5 text-violet-600" />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">أكثر نوع</span>
            </div>
            {stats.topEntity ? (
              <>
                <span className="text-sm font-bold truncate block">{entityLabels[stats.topEntity[0]] || stats.topEntity[0]}</span>
                <span className="text-[10px] text-muted-foreground">{stats.topEntity[1]} سجل</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        </div>
      )}

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
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="ps-9 h-9"
                placeholder="بحث في الأنشطة..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[130px] h-9">
                <Filter className="h-3.5 w-3.5 me-1" />
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
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {uniqueEntities.map((e) => (
                  <SelectItem key={e!} value={e!}>{entityLabels[e!] || e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {uniqueUsers.length > 0 && (
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="w-[140px] h-9">
                  <User className="h-3.5 w-3.5 me-1" />
                  <SelectValue placeholder="المستخدم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المستخدمين</SelectItem>
                  {uniqueUsers.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <Input type="date" className="h-9 w-[130px] text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="من" />
              <span className="text-muted-foreground text-xs">—</span>
              <Input type="date" className="h-9 w-[130px] text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="إلى" />
            </div>
            {(search || filterAction !== "all" || filterEntity !== "all" || filterUser !== "all" || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="h-9 px-2 text-xs text-muted-foreground" onClick={() => { setSearch(""); setFilterAction("all"); setFilterEntity("all"); setFilterUser("all"); setDateFrom(""); setDateTo(""); }}>
                <X className="h-3.5 w-3.5 me-1" />
                مسح الفلاتر
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filtered.length} نشاط
              {filtered.length !== entries.length && ` من ${entries.length}`}
              {totalPages > 1 && ` — صفحة ${page} من ${totalPages}`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">{page}/{totalPages}</span>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {grouped.length === 0 ? (
            <div className="stat-card text-center py-16">
              <History className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">لا توجد أنشطة مسجّلة بعد</p>
              <p className="text-xs text-muted-foreground mt-1">سيظهر هنا تاريخ العمليات التي تقوم بها</p>
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(([date, dayEntries]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-medium text-muted-foreground px-2 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {date}
                      <Badge variant="secondary" className="h-4 text-[10px] px-1">{dayEntries.length}</Badge>
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <div className="relative">
                    <div className="absolute start-[22px] top-0 bottom-0 w-0.5 bg-border/60 rounded-full" />

                    <div className="space-y-2">
                      {dayEntries.map((entry) => {
                        const data = parseAuditData(entry.message);
                        const action = data?.action || "create";
                        const cfg = actionConfig[action] || actionConfig.create;
                        const ActionIcon = cfg.icon;
                        const EntityIcon = entityIcons[data?.entity || ""] || Package;
                        const isDelete = action === "delete";
                        const isRestored = entry.title.startsWith("[مُستعاد]");
                        const isReverted = entry.title.startsWith("[مُرجَع]");
                        const isExpanded = expandedId === entry.id;
                        const hasSnapshot = data?.snapshot && Object.keys(data.snapshot).length > 0;
                        const isHighlighted = highlightId === entry.id;
                        const entityRoute = data?.entity && data?.entityId ? getEntityRoute(data.entity, data.entityId) : null;
                        const isFinancial = isFinancialEntry(data);
                        const isNew = isRecentEntry(entry.createdAt);

                        return (
                          <div
                            key={entry.id}
                            ref={isHighlighted ? highlightRef : undefined}
                            className={`relative ps-10 transition-all duration-500`}
                          >
                            <div className={`absolute start-[14px] top-3 h-4 w-4 rounded-full border-2 border-background z-10 flex items-center justify-center ${
                              action === "create" ? "bg-success" : action === "update" ? "bg-blue-500" : "bg-destructive"
                            }`}>
                              <ActionIcon className="h-2 w-2 text-white" />
                            </div>

                            <div className={`stat-card overflow-hidden ${isDelete && !isRestored ? "border-destructive/20" : ""} ${isExpanded ? "border-primary/30" : ""} ${isHighlighted ? "ring-2 ring-primary/40 shadow-lg shadow-primary/10 border-primary/40" : ""}`}>
                              <div className="flex items-start gap-3 py-1 px-1">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {entityRoute ? (
                                      <button
                                        className="text-sm font-medium truncate text-primary hover:underline cursor-pointer text-start"
                                        onClick={() => navigate(entityRoute)}
                                        title={`فتح ${entityLabels[data?.entity || ""] || data?.entity || ""}: ${data?.entityName || ""}`}
                                      >
                                        {entry.title}
                                      </button>
                                    ) : (
                                      <span className="text-sm font-medium truncate">{entry.title}</span>
                                    )}
                                    <Badge variant={cfg.badge} className="text-[10px] h-4 px-1.5 shrink-0">
                                      {cfg.label}
                                    </Badge>
                                    {data?.entity && (
                                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0 gap-1">
                                        <EntityIcon className="h-2.5 w-2.5" />
                                        {entityLabels[data.entity] || data.entity}
                                      </Badge>
                                    )}
                                    {isRestored && (
                                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-success border-success/50 shrink-0">
                                        مُستعاد
                                      </Badge>
                                    )}
                                    {isReverted && (
                                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-amber-600 border-amber-400/50 shrink-0">
                                        مُرجَع
                                      </Badge>
                                    )}
                                    {isFinancial && (
                                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-amber-600 border-amber-500/40 shrink-0 gap-0.5">
                                        <Lock className="h-2.5 w-2.5" />
                                        سجل مالي
                                      </Badge>
                                    )}
                                    {isNew && (
                                      <Badge className="text-[10px] h-4 px-1.5 shrink-0 gap-0.5 bg-primary/90 border-0 animate-pulse">
                                        <Sparkles className="h-2.5 w-2.5" />
                                        جديد
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                                    {data?.performedBy && (
                                      <span className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-md flex items-center gap-1.5 font-medium border border-blue-200 dark:border-blue-800/50">
                                        <User className="h-3 w-3" />{data.performedBy}
                                      </span>
                                    )}
                                    {!data?.performedBy && (
                                      <span className="text-[10px] bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded flex items-center gap-1">
                                        <User className="h-2.5 w-2.5" />مستخدم غير معروف
                                      </span>
                                    )}
                                    {data?.entityId && (
                                      <span className="text-xs text-muted-foreground font-mono">{data.entityId}</span>
                                    )}
                                    <span className="text-xs text-muted-foreground">{entry.time}</span>
                                    {entry.createdAt && (
                                      <span className="text-xs text-muted-foreground">{timeSince(entry.createdAt)}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {isDelete && !isRestored && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs gap-1 text-success border-success/50 hover:bg-success/10"
                                      onClick={() => handleRestore(entry)}
                                      disabled={restoring === entry.id}
                                    >
                                      <RotateCcw className={`h-3 w-3 ${restoring === entry.id ? "animate-spin" : ""}`} />
                                      {restoring === entry.id ? "..." : "استعادة"}
                                    </Button>
                                  )}
                                  {action === "update" && data?.snapshot?.before && !isReverted && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs gap-1 text-amber-600 border-amber-400/50 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                      onClick={() => handleRevert(entry)}
                                      disabled={restoring === entry.id}
                                    >
                                      <RotateCcw className={`h-3 w-3 ${restoring === entry.id ? "animate-spin" : ""}`} />
                                      {restoring === entry.id ? "..." : "رجوع"}
                                    </Button>
                                  )}
                                  {hasSnapshot && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => setExpandedId(prev => prev === entry.id ? null : entry.id)}
                                    >
                                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                                    </Button>
                                  )}
                                  {isFinancial ? (
                                    <span className="h-7 w-7 flex items-center justify-center text-amber-500" title="سجل مالي — لا يمكن حذفه">
                                      <Lock className="h-3.5 w-3.5" />
                                    </span>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => setDeleteTarget(entry)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {isExpanded && data?.snapshot && (
                                <div className="mt-3 pt-3 border-t border-border/50 px-1 pb-1">
                                  {action === "create" && (
                                    <>
                                      <h4 className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                                        <Plus className="h-3 w-3 text-success" />
                                        البيانات المُنشأة
                                      </h4>
                                      <SnapshotDetails snapshot={data.snapshot} />
                                    </>
                                  )}
                                  {action === "update" && (
                                    <>
                                      <h4 className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                                        <Edit className="h-3 w-3 text-info" />
                                        التعديلات
                                      </h4>
                                      {data.snapshot.before ? (
                                        <DiffView
                                          before={typeof data.snapshot.before === "object" && data.snapshot.before.order ? data.snapshot.before.order : data.snapshot.before}
                                          after={Object.fromEntries(
                                            Object.entries(data.snapshot).filter(([k]) => k !== "before" && k !== "changes" && k !== "orderId")
                                          )}
                                        />
                                      ) : data.snapshot.changes && Array.isArray(data.snapshot.changes) ? (
                                        <div className="space-y-1">
                                          {data.snapshot.changes.map((ch: string, i: number) => (
                                            <div key={i} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2.5 py-1.5 border border-border/20">
                                              <ArrowUpDown className="h-3 w-3 text-info shrink-0" />
                                              <span>{ch}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <SnapshotDetails snapshot={data.snapshot} />
                                      )}
                                    </>
                                  )}
                                  {action === "delete" && (
                                    <>
                                      <h4 className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                        البيانات المحذوفة
                                      </h4>
                                      <SnapshotDetails snapshot={data.snapshot} skipKeys={["_related"]} />
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button variant="outline" size="sm" className="h-8 gap-1" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                    السابق
                  </Button>
                  <span className="text-xs text-muted-foreground px-3">صفحة {page} من {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-8 gap-1" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    التالي
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
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
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <h4 className="text-xs font-semibold text-muted-foreground mb-2">البيانات المحفوظة</h4>
                        <SnapshotDetails snapshot={snapshot} />
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
