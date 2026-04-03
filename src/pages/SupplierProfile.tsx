import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { logAudit } from "@/lib/auditLog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Factory, Globe, Mail, Phone, Package, ShoppingCart,
  Boxes, TrendingUp, Calendar, ExternalLink, Search, BarChart3,
  Wallet, Layers, Clock, Pencil, Trash2, Loader2, Save,
} from "lucide-react";
import { toast } from "sonner";

type SupplierData = {
  id: string; name: string; country: string; email: string; phone: string;
  paymentTerms: string; active: boolean; website?: string;
};
type SupplierOrder = {
  id: string; client: string; clientId: string; date: string; status: string;
  totalSelling: string; totalCost: string; orderType: string;
  supplierCost: number; supplierItems: number;
};
type SupplierLot = {
  id: string; materialCode: string; materialName: string; unit: string;
  lotNumber: string; quantity: number; remaining: number; costPrice: number;
  sourceOrder: string; dateAdded: string; status: string;
};
type SupplierMaterial = {
  supplierId: string; materialCode: string; materialName: string;
  auto?: boolean;
};
type Stats = {
  totalPurchases: number; totalOrders: number; lastOrderDate: string | null;
  totalLots: number; totalUnitsSupplied: number; totalRemainingUnits: number;
  materialsCount: number;
};

function norm(raw: any): SupplierData {
  return {
    id: raw.id, name: raw.name || "", country: raw.country || "",
    email: raw.email || "", phone: raw.phone || "",
    paymentTerms: raw.paymentTerms ?? raw.payment_terms ?? "Net 30",
    active: raw.active ?? true, website: raw.website || "",
  };
}
function normOrder(r: any): SupplierOrder {
  return {
    id: r.id, client: r.client || "", clientId: r.clientId || r.client_id || "",
    date: r.date || "", status: r.status || "",
    totalSelling: r.totalSelling ?? r.total_selling ?? "0",
    totalCost: r.totalCost ?? r.total_cost ?? "0",
    orderType: r.orderType ?? r.order_type ?? "client",
    supplierCost: parseFloat(r.supplierCost ?? r.supplier_cost ?? 0) || 0,
    supplierItems: parseInt(r.supplierItems ?? r.supplier_items ?? 0) || 0,
  };
}
function normLot(r: any): SupplierLot {
  return {
    id: r.id, materialCode: r.materialCode ?? r.material_code ?? "",
    materialName: r.materialName ?? r.material_name ?? "",
    unit: r.unit || "", lotNumber: r.lotNumber ?? r.lot_number ?? "",
    quantity: parseFloat(r.quantity) || 0, remaining: parseFloat(r.remaining) || 0,
    costPrice: parseFloat(r.costPrice ?? r.cost_price) || 0,
    sourceOrder: r.sourceOrder ?? r.source_order ?? "",
    dateAdded: r.dateAdded ?? r.date_added ?? "",
    status: r.status || "In Stock",
  };
}

const statusColors: Record<string, string> = {
  Processing: "bg-blue-500/10 text-blue-600", Delivered: "bg-success/10 text-success",
  Completed: "bg-success/10 text-success", "Partially Delivered": "bg-amber-500/10 text-amber-600",
  Pending: "bg-yellow-500/10 text-yellow-700", Cancelled: "bg-destructive/10 text-destructive",
  "In Stock": "bg-success/10 text-success", "Low Stock": "bg-amber-500/10 text-amber-600",
  Depleted: "bg-destructive/10 text-destructive",
};
const statusLabels: Record<string, string> = {
  Processing: "قيد المعالجة", Delivered: "تم التسليم", Completed: "مكتمل",
  "Partially Delivered": "تسليم جزئي", Pending: "معلق", Cancelled: "ملغي",
  "In Stock": "في المخزون", "Low Stock": "مخزون منخفض", Depleted: "نفد",
};

export default function SupplierProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useLanguage();
  const { profile } = useAuth();
  const _userName = profile?.full_name || "مستخدم";

  const [supplier, setSupplier] = useState<SupplierData | null>(null);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [inventory, setInventory] = useState<SupplierLot[]>([]);
  const [materials, setMaterials] = useState<SupplierMaterial[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderSearch, setOrderSearch] = useState("");
  const [invSearch, setInvSearch] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<SupplierData | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadProfile = () => {
    if (!id) return;
    setLoading(true);
    api.get<any>(`/suppliers/${id}/profile`)
      .then(data => {
        setSupplier(norm(data.supplier));
        setOrders((data.orders || []).map(normOrder));
        setInventory((data.inventory || []).map(normLot));
        setMaterials(data.materials || []);
        setStats(data.stats || null);
      })
      .catch(() => toast.error("فشل تحميل بيانات المورد"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProfile(); }, [id]);

  const handleOpenEdit = () => {
    if (!supplier) return;
    setEditForm({ ...supplier });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm || !supplier || !id) return;
    setEditSaving(true);
    try {
      const beforeSnapshot = { ...supplier };
      await api.patch<any>(`/suppliers/${id}`, {
        name: editForm.name, country: editForm.country,
        email: editForm.email, phone: editForm.phone,
        paymentTerms: editForm.paymentTerms, active: editForm.active,
      });
      await logAudit({
        entity: "supplier", entityId: id,
        entityName: editForm.name || supplier.name,
        action: "update",
        snapshot: { before: beforeSnapshot, after: editForm },
        endpoint: "/suppliers",
        performedBy: _userName,
      });
      setSupplier(editForm);
      setEditOpen(false);
      toast.success("تم تحديث بيانات المورد");
    } catch {
      toast.error("فشل حفظ التعديلات");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!supplier || !id) return;
    setDeleting(true);
    try {
      await api.delete(`/suppliers/${id}`);
      await logAudit({
        entity: "supplier", entityId: id,
        entityName: supplier.name,
        action: "delete",
        snapshot: supplier as any,
        endpoint: "/suppliers",
        performedBy: _userName,
      });
      toast.success(`تم حذف المورد: ${supplier.name}`);
      navigate("/suppliers");
    } catch (err: any) {
      toast.error(err?.message || "فشل حذف المورد");
    } finally {
      setDeleting(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!orderSearch) return orders;
    const q = orderSearch.toLowerCase();
    return orders.filter(o => o.id.toLowerCase().includes(q) || o.client.toLowerCase().includes(q) || o.date.includes(q));
  }, [orders, orderSearch]);

  const filteredInv = useMemo(() => {
    if (!invSearch) return inventory;
    const q = invSearch.toLowerCase();
    return inventory.filter(l => l.materialName.toLowerCase().includes(q) || l.materialCode.toLowerCase().includes(q) || l.lotNumber.toLowerCase().includes(q));
  }, [inventory, invSearch]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    orders.forEach(o => {
      const month = o.date?.slice(0, 7) || "N/A";
      if (!map[month]) map[month] = { count: 0, total: 0 };
      map[month].count++;
      map[month].total += o.supplierCost || 0;
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a)).slice(0, 12);
  }, [orders]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center py-20">
        <Factory className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-40" />
        <p className="text-muted-foreground">لم يتم العثور على المورد</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/suppliers")}>العودة للموردين</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate("/suppliers")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Factory className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{supplier.name}</h1>
            <Badge variant={supplier.active ? "default" : "secondary"} className={supplier.active ? "bg-success/10 text-success border-0" : ""}>
              {supplier.active ? "نشط" : "غير نشط"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono">{supplier.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleOpenEdit}>
            <Pencil className="h-3.5 w-3.5" />
            تعديل
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" />
            حذف
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {supplier.country && (
          <div className="stat-card p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Globe className="h-3.5 w-3.5" />
              <span className="text-[11px]">البلد</span>
            </div>
            <p className="font-semibold text-sm">{supplier.country}</p>
          </div>
        )}
        {supplier.email && (
          <div className="stat-card p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Mail className="h-3.5 w-3.5" />
              <span className="text-[11px]">البريد</span>
            </div>
            <p className="font-semibold text-sm truncate">{supplier.email}</p>
          </div>
        )}
        {supplier.phone && (
          <div className="stat-card p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Phone className="h-3.5 w-3.5" />
              <span className="text-[11px]">الهاتف</span>
            </div>
            <p className="font-semibold text-sm">{supplier.phone}</p>
          </div>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                <ShoppingCart className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[11px] text-muted-foreground">إجمالي الطلبات</span>
            </div>
            <p className="text-xl font-bold">{stats.totalOrders}</p>
          </div>
          <div className="stat-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-md bg-success/10 flex items-center justify-center">
                <Wallet className="h-3.5 w-3.5 text-success" />
              </div>
              <span className="text-[11px] text-muted-foreground">إجمالي المشتريات</span>
            </div>
            <p className="text-xl font-bold">{stats.totalPurchases.toLocaleString()}</p>
            <span className="text-[10px] text-muted-foreground">ج.م</span>
          </div>
          <div className="stat-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                <Package className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <span className="text-[11px] text-muted-foreground">المواد</span>
            </div>
            <p className="text-xl font-bold">{stats.materialsCount}</p>
          </div>
          <div className="stat-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-md bg-violet-500/10 flex items-center justify-center">
                <Layers className="h-3.5 w-3.5 text-violet-600" />
              </div>
              <span className="text-[11px] text-muted-foreground">دُفعات المخزون</span>
            </div>
            <p className="text-xl font-bold">{stats.totalLots}</p>
            <span className="text-[10px] text-muted-foreground">{stats.totalRemainingUnits.toLocaleString()} وحدة متبقية</span>
          </div>
        </div>
      )}

      <Tabs defaultValue="orders" dir="rtl">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="orders" className="gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" />
            الطلبات
            <Badge variant="secondary" className="h-4 text-[10px] px-1">{orders.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1.5">
            <Boxes className="h-3.5 w-3.5" />
            المخزون
            <Badge variant="secondary" className="h-4 text-[10px] px-1">{inventory.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="materials" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            المواد
            <Badge variant="secondary" className="h-4 text-[10px] px-1">{materials.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            التحليلات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-3 mt-4">
          {orders.length > 0 && (
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="ps-9 h-9" placeholder="بحث في الطلبات..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
            </div>
          )}
          {filteredOrders.length === 0 ? (
            <div className="stat-card text-center py-12">
              <ShoppingCart className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">لا توجد طلبات من هذا المورد</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOrders.map(order => (
                <div key={order.id} className="stat-card hover:border-primary/20 transition-colors">
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/orders/${order.id}`} className="text-sm font-semibold text-primary hover:underline">
                          {order.id}
                        </Link>
                        <Badge className={`text-[10px] h-4 px-1.5 border-0 ${statusColors[order.status] || "bg-muted"}`}>
                          {statusLabels[order.status] || order.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {order.orderType === "inventory" ? "مخزون" : "عميل"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{order.date}</span>
                        {order.orderType !== "inventory" && order.client && (
                          <Link to={`/clients/${order.clientId}`} className="text-primary hover:underline">{order.client}</Link>
                        )}
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="text-sm font-bold">{order.supplierCost.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">{order.supplierItems} مواد · ج.م</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inventory" className="space-y-3 mt-4">
          {inventory.length > 0 && (
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="ps-9 h-9" placeholder="بحث في المخزون..." value={invSearch} onChange={e => setInvSearch(e.target.value)} />
            </div>
          )}
          {filteredInv.length === 0 ? (
            <div className="stat-card text-center py-12">
              <Boxes className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">لا توجد دُفعات مخزون من هذا المورد</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredInv.map(lot => (
                <div key={lot.id} className="stat-card hover:border-primary/20 transition-colors">
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{lot.materialName}</span>
                        <span className="text-xs font-mono text-muted-foreground">{lot.materialCode}</span>
                        <Badge className={`text-[10px] h-4 px-1.5 border-0 ${statusColors[lot.status] || "bg-muted"}`}>
                          {statusLabels[lot.status] || lot.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>دُفعة: {lot.lotNumber}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{lot.dateAdded}</span>
                        {lot.sourceOrder && (
                          <Link to={`/orders/${lot.sourceOrder}`} className="text-primary hover:underline flex items-center gap-0.5">
                            <ExternalLink className="h-3 w-3" />
                            {lot.sourceOrder}
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="text-sm font-bold">{lot.remaining.toLocaleString()} / {lot.quantity.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">{lot.unit} · {lot.costPrice.toLocaleString()} ج.م</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="materials" className="space-y-3 mt-4">
          {materials.length === 0 ? (
            <div className="stat-card text-center py-12">
              <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">لا توجد مواد مرتبطة بهذا المورد</p>
              <p className="text-xs text-muted-foreground mt-1">يمكنك إضافة مواد من صفحة الموردين</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {materials.map(mat => (
                <div key={mat.materialCode} className="stat-card p-3 hover:border-primary/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${mat.auto ? "bg-blue-500/10" : "bg-muted"}`}>
                      <Package className={`h-5 w-5 ${mat.auto ? "text-blue-500" : "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold truncate">{mat.materialName}</p>
                        {mat.auto && <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-blue-300 text-blue-600 shrink-0">من الطلبات</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{mat.materialCode}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 mt-4">
          {orders.length === 0 ? (
            <div className="stat-card text-center py-12">
              <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">لا توجد بيانات كافية للتحليل</p>
            </div>
          ) : (
            <>
              <div className="stat-card p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  المشتريات الشهرية
                </h3>
                <div className="space-y-2">
                  {monthlyData.map(([month, data]) => {
                    const maxTotal = Math.max(...monthlyData.map(([, d]) => d.total), 1);
                    const pct = (data.total / maxTotal) * 100;
                    return (
                      <div key={month} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground font-mono w-20 shrink-0">{month}</span>
                        <div className="flex-1 h-6 bg-muted/50 rounded-full overflow-hidden relative">
                          <div className="h-full bg-primary/20 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          <span className="absolute inset-0 flex items-center px-3 text-[11px] font-medium">
                            {data.total.toLocaleString()} ج.م
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{data.count} طلب</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="stat-card p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  كشف حساب المورد
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-right py-2 px-2 font-medium">التاريخ</th>
                        <th className="text-right py-2 px-2 font-medium">الطلب</th>
                        <th className="text-right py-2 px-2 font-medium">النوع</th>
                        <th className="text-right py-2 px-2 font-medium">المبلغ</th>
                        <th className="text-right py-2 px-2 font-medium">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 50).map((order, i) => (
                        <tr key={order.id} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-muted/20" : ""}`}>
                          <td className="py-2 px-2 text-xs text-muted-foreground">{order.date}</td>
                          <td className="py-2 px-2">
                            <Link to={`/orders/${order.id}`} className="text-xs text-primary hover:underline font-mono">{order.id}</Link>
                          </td>
                          <td className="py-2 px-2 text-xs">{order.orderType === "inventory" ? "مخزون" : "عميل"}</td>
                          <td className="py-2 px-2 text-xs font-semibold">{order.supplierCost.toLocaleString()} ج.م <span className="text-muted-foreground font-normal">({order.supplierItems} مواد)</span></td>
                          <td className="py-2 px-2">
                            <Badge className={`text-[10px] h-4 px-1.5 border-0 ${statusColors[order.status] || "bg-muted"}`}>
                              {statusLabels[order.status] || order.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border font-semibold">
                        <td colSpan={3} className="py-2 px-2 text-xs">الإجمالي</td>
                        <td className="py-2 px-2 text-xs">{stats?.totalPurchases.toLocaleString()} ج.م</td>
                        <td className="py-2 px-2 text-xs">{orders.length} طلب</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {stats && stats.lastOrderDate && (
                <div className="stat-card p-4">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    ملخص
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-2 rounded-lg bg-muted/40">
                      <span className="text-muted-foreground block mb-0.5">آخر طلب</span>
                      <span className="font-semibold">{stats.lastOrderDate}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40">
                      <span className="text-muted-foreground block mb-0.5">متوسط قيمة الطلب</span>
                      <span className="font-semibold">{stats.totalOrders > 0 ? Math.round(stats.totalPurchases / stats.totalOrders).toLocaleString() : 0} ج.م</span>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40">
                      <span className="text-muted-foreground block mb-0.5">إجمالي الوحدات الموردة</span>
                      <span className="font-semibold">{stats.totalUnitsSupplied.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات المورد</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">اسم المورد *</Label>
                <Input className="h-9" value={editForm.name} onChange={e => setEditForm(f => f ? { ...f, name: e.target.value } : f)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">البلد</Label>
                  <Input className="h-9" value={editForm.country} onChange={e => setEditForm(f => f ? { ...f, country: e.target.value } : f)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">البريد الإلكتروني</Label>
                  <Input className="h-9" type="email" value={editForm.email} onChange={e => setEditForm(f => f ? { ...f, email: e.target.value } : f)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">الهاتف</Label>
                  <Input className="h-9" value={editForm.phone} onChange={e => setEditForm(f => f ? { ...f, phone: e.target.value } : f)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">الحالة</Label>
                <Select value={editForm.active ? "active" : "inactive"} onValueChange={v => setEditForm(f => f ? { ...f, active: v === "active" } : f)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button size="sm" className="gap-1.5" onClick={handleSaveEdit} disabled={editSaving || !editForm?.name?.trim()}>
              {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="حذف المورد"
        description={`هل تريد حذف المورد "${supplier.name}"؟ سيتم نقله إلى سلة المهملات.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
