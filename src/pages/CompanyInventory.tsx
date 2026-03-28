import { useState, useEffect, useMemo } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Loader2, Package, Warehouse, Search, Trash2, MoreHorizontal, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CompanyLot = {
  id: string;
  materialCode: string;
  materialName: string;
  unit: string;
  lotNumber: string;
  quantity: number;
  remaining: number;
  costPrice: number;
  sourceOrder: string;
  dateAdded: string;
  status: string;
  supplierId: string;
  imageUrl?: string;
};

type Supplier = { id: string; name: string };

function mapLot(raw: any): CompanyLot {
  return {
    id: raw.id,
    materialCode: raw.materialCode || raw.material_code || "",
    materialName: raw.materialName || raw.material_name || "",
    unit: raw.unit || "",
    lotNumber: raw.lotNumber || raw.lot_number || "",
    quantity: Number(raw.quantity ?? 0),
    remaining: Number(raw.remaining ?? 0),
    costPrice: Number(raw.costPrice ?? raw.cost_price ?? 0),
    sourceOrder: raw.sourceOrder || raw.source_order || "",
    dateAdded: raw.dateAdded || raw.date_added || "",
    status: raw.status || "In Stock",
    supplierId: raw.supplierId || raw.supplier_id || "",
  };
}

export default function CompanyInventoryPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [lots, setLots] = useState<CompanyLot[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<CompanyLot | null>(null);
  const [deleting, setDeleting] = useState(false);

  const supplierMap = useMemo(() => {
    const map: Record<string, string> = {};
    suppliers.forEach(s => { map[s.id] = s.name; });
    return map;
  }, [suppliers]);

  useEffect(() => {
    Promise.all([
      api.get<any[]>("/company-inventory"),
      api.get<{ products: any[] }>("/external-materials").catch(() => ({ products: [] })),
      api.get<any[]>("/suppliers").catch(() => []),
    ]).then(([data, extData, supData]) => {
      const imgBySku: Record<string, string> = {};
      const imgByName: Record<string, string> = {};
      (extData?.products || []).forEach((p: any) => {
        const img = p.image_url || "";
        if (!img.startsWith("http")) return;
        if (p.sku) imgBySku[p.sku] = img;
        if (p.name) imgByName[p.name.toLowerCase().trim()] = img;
      });
      setLots((data || []).map(raw => {
        const lot = mapLot(raw);
        lot.imageUrl = imgBySku[lot.materialCode] || imgByName[lot.materialName.toLowerCase().trim()] || "";
        return lot;
      }));
      setSuppliers((supData || []).map((s: any) => ({ id: s.id, name: s.name })));
    }).catch(() => toast.error("فشل تحميل مخزون الشركة"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => lots.filter(l => {
    const q = search.toLowerCase().trim();
    const supName = supplierMap[l.supplierId] || "";
    const matchSearch = !q || l.materialName.toLowerCase().includes(q) || l.materialCode.toLowerCase().includes(q) || l.lotNumber.toLowerCase().includes(q) || l.sourceOrder.toLowerCase().includes(q) || supName.toLowerCase().includes(q);
    const matchStatus = !filters.status || filters.status === "all" || l.status === filters.status;
    const matchSupplier = !filters.supplier || filters.supplier === "all" || l.supplierId === filters.supplier;
    return matchSearch && matchStatus && matchSupplier;
  }), [lots, search, filters, supplierMap]);

  const materialGroups = useMemo(() => {
    const map: Record<string, { name: string; code: string; unit: string; imageUrl: string; totalRemaining: number; totalValue: number; lots: CompanyLot[] }> = {};
    filtered.forEach(l => {
      if (!map[l.materialCode]) map[l.materialCode] = { name: l.materialName, code: l.materialCode, unit: l.unit, imageUrl: l.imageUrl || "", totalRemaining: 0, totalValue: 0, lots: [] };
      if (l.imageUrl && !map[l.materialCode].imageUrl) map[l.materialCode].imageUrl = l.imageUrl;
      map[l.materialCode].totalRemaining += l.remaining;
      map[l.materialCode].totalValue += l.remaining * l.costPrice;
      map[l.materialCode].lots.push(l);
    });
    return Object.values(map);
  }, [filtered]);

  const totalValue = lots.reduce((s, l) => s + l.remaining * l.costPrice, 0);
  const totalItems = lots.reduce((s, l) => s + l.remaining, 0);
  const totalConsumed = lots.reduce((s, l) => s + (l.quantity - l.remaining), 0);
  const totalConsumedValue = lots.reduce((s, l) => s + (l.quantity - l.remaining) * l.costPrice, 0);
  const inStockCount = lots.filter(l => l.status === "In Stock").length;
  const lowStockCount = lots.filter(l => l.status === "Low Stock").length;
  const depletedCount = lots.filter(l => l.status === "Depleted").length;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/company-inventory/${deleteTarget.id}`);
      setLots(prev => prev.filter(l => l.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("تم الحذف");
    } catch (err: any) {
      toast.error(err?.message || "فشل الحذف");
    } finally {
      setDeleting(false);
    }
  };

  const statusOptions = [
    { label: "متوفر", value: "In Stock" },
    { label: "منخفض", value: "Low Stock" },
    { label: "نفد", value: "Depleted" },
  ];

  const statusLabel = (s: string) => s === "In Stock" ? "متوفر" : s === "Low Stock" ? "منخفض" : s === "Depleted" ? "نفد" : s;
  const statusColor = (s: string) => s === "In Stock" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : s === "Low Stock" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">مخزون الشركة</h1>
        <p className="page-description">{lots.length} دُفعة · {materialGroups.length} مادة</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="stat-card p-4 text-center">
          <p className="text-xs text-muted-foreground">إجمالي القيمة المتبقية</p>
          <p className="text-lg font-bold text-primary">{totalValue.toLocaleString()} {t.currency}</p>
        </div>
        <div className="stat-card p-4 text-center">
          <p className="text-xs text-muted-foreground">إجمالي المستهلك</p>
          <p className="text-lg font-bold text-amber-600">{totalConsumed.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{totalConsumedValue.toLocaleString()} {t.currency}</p>
        </div>
        <div className="stat-card p-4 text-center">
          <p className="text-xs text-muted-foreground">الوحدات المتبقية</p>
          <p className="text-lg font-bold">{totalItems.toLocaleString()}</p>
        </div>
        <div className="stat-card p-4 text-center">
          <p className="text-xs text-muted-foreground">متوفر / منخفض / نفد</p>
          <p className="text-lg font-bold">
            <span className="text-green-600">{inStockCount}</span>
            {" / "}
            <span className="text-amber-600">{lowStockCount}</span>
            {" / "}
            <span className="text-red-600">{depletedCount}</span>
          </p>
        </div>
        <div className="stat-card p-4 text-center">
          <p className="text-xs text-muted-foreground">عدد المواد</p>
          <p className="text-lg font-bold">{materialGroups.length}</p>
        </div>
      </div>

      <DataToolbar
        searchPlaceholder="بحث في مخزون الشركة..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "الحالة", value: "status", options: statusOptions },
          { label: "المورد", value: "supplier", options: suppliers.map(s => ({ label: s.name, value: s.id })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("company-inventory", ["المادة", "الكود", "الدُفعة", "الكمية", "المتبقي", "سعر الشراء", "المورد", "الأوردر", "التاريخ", "الحالة"], filtered.map(l => [l.materialName, l.materialCode, l.lotNumber, l.quantity, l.remaining, l.costPrice, supplierMap[l.supplierId] || "—", l.sourceOrder, l.dateAdded, statusLabel(l.status)]))}
      />

      <div className="stat-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Warehouse className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">لا يوجد مخزون بعد</p>
            <p className="text-muted-foreground text-xs mt-1">أنشئ طلب من نوع "للمخزون" وقم بتوصيله لإضافة مواد هنا</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground w-12">صورة</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">المادة</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">الكود</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">الدُفعة</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">الكمية</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">المتبقي</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">سعر الشراء</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">القيمة</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">المورد</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">الأوردر</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">التاريخ</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">الحالة</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lot => (
                <tr key={lot.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/company-inventory/${encodeURIComponent(lot.id)}`)}>
                  <td className="py-2 px-3 text-center">
                    {lot.imageUrl ? (
                      <div className="relative w-9 h-9 mx-auto">
                        <img src={lot.imageUrl} alt={lot.materialName} className="w-9 h-9 rounded-md object-cover border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }} />
                        <div className="hidden w-9 h-9 rounded-md bg-muted flex items-center justify-center absolute inset-0"><Package className="h-4 w-4 text-muted-foreground/50" /></div>
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center mx-auto"><Package className="h-4 w-4 text-muted-foreground/50" /></div>
                    )}
                  </td>
                  <td className="py-3 px-3 font-medium">{lot.materialName}</td>
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{lot.materialCode}</td>
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{lot.lotNumber.slice(0, 15)}</td>
                  <td className="py-3 px-3 text-end">{lot.quantity} {lot.unit}</td>
                  <td className="py-3 px-3 text-end font-medium">{lot.remaining} {lot.unit}</td>
                  <td className="py-3 px-3 text-end">{lot.costPrice.toLocaleString()} {t.currency}</td>
                  <td className="py-3 px-3 text-end font-medium text-primary">{(lot.remaining * lot.costPrice).toLocaleString()} {t.currency}</td>
                  <td className="py-3 px-3 text-xs">
                    {lot.supplierId && supplierMap[lot.supplierId] ? (
                      <button className="text-primary hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/suppliers`); }}>{supplierMap[lot.supplierId]}</button>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-3 px-3">
                    <button className="text-xs text-primary hover:underline font-mono" onClick={(e) => { e.stopPropagation(); navigate(`/orders/${lot.sourceOrder}`); }}>{lot.sourceOrder}</button>
                  </td>
                  <td className="py-3 px-3 text-xs text-muted-foreground">{lot.dateAdded}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor(lot.status)}`}>{statusLabel(lot.status)}</span>
                  </td>
                  <td className="py-3 px-3 text-end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/company-inventory/${encodeURIComponent(lot.id)}`)}><Package className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />تفاصيل الدُفعة</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/orders/${lot.sourceOrder}`)}><Eye className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />عرض الأوردر</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(lot)}>
                          <Trash2 className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="حذف دُفعة"
        description={`هل تريد حذف الدُفعة "${deleteTarget?.lotNumber}" من "${deleteTarget?.materialName}"؟`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
