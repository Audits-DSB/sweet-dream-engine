import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Package, ImageOff, Loader2, Trash2, Pencil, Upload, Download, X, Check, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { logAudit } from "@/lib/auditLog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import Papa from "papaparse";

type ExternalProduct = {
  id: string; sku: string; name: string; image_url: string | null;
  price_retail: number; price_wholesale: number; stock_quantity: number;
  barcode: string | null; category: string; description: string | null;
  images: string[] | null; features: any[] | null; variants: any[] | null;
};

type Material = {
  id?: string;
  code: string; name: string; category: string; unit: string;
  sellingPrice: number; storeCost: number; supplier: string;
  supplierId: string; manufacturer: string; hasExpiry: boolean; active: boolean;
  image_url?: string | null; stock_quantity?: number;
  variants?: any[] | null; barcode?: string | null; description?: string | null;
};

const emptyForm = {
  sku: "", name: "", category: "", description: "",
  price_retail: "", price_wholesale: "", stock_quantity: "",
  barcode: "", image_url: "",
};

function mapExternal(p: ExternalProduct): Material {
  const companyVariant = p.variants?.find((v: any) => v.name === "Company" || v.name === "Company()");
  return {
    id: p.id,
    code: p.sku || p.id.slice(0, 8),
    name: p.name,
    category: p.category || "General",
    unit: "unit",
    sellingPrice: p.price_retail || 0,
    storeCost: p.price_wholesale || 0,
    supplier: "", supplierId: "",
    manufacturer: companyVariant?.options?.[0]?.value || "",
    hasExpiry: false, active: true,
    image_url: p.image_url,
    stock_quantity: p.stock_quantity,
    variants: p.variants,
    barcode: p.barcode,
    description: p.description,
  };
}

function mapDb(raw: any): Material {
  return {
    code: raw.code, name: raw.name,
    category: raw.category || "General",
    unit: raw.unit || "unit",
    sellingPrice: Number(raw.sellingPrice ?? raw.selling_price ?? 0),
    storeCost: Number(raw.storeCost ?? raw.store_cost ?? 0),
    supplier: raw.supplier || "", supplierId: raw.supplierId || raw.supplier_id || "",
    manufacturer: raw.manufacturer || "",
    hasExpiry: raw.hasExpiry ?? raw.has_expiry ?? false,
    active: raw.active ?? true,
    image_url: null, stock_quantity: 0, variants: null, barcode: null, description: null,
  };
}

export default function MaterialsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Material | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchMaterials(); }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    let loaded = false;
    try {
      const json = await api.get<{ products: ExternalProduct[] }>("/external-materials");
      if (json?.products && Array.isArray(json.products) && json.products.length > 0) {
        setMaterials(json.products.map(mapExternal));
        loaded = true;
      }
    } catch (err) {
      console.error("External materials failed, falling back to DB:", err);
    }
    if (!loaded) {
      try {
        const dbData = await api.get<any[]>("/materials");
        setMaterials((dbData || []).map(mapDb));
      } catch {
        toast.error(t.failedToLoadMaterials);
      }
    }
    setLoading(false);
  };

  const categories = [...new Set(materials.map(m => m.category))].filter(Boolean).sort();

  const filtered = materials.filter((m) => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.code.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filters.category || filters.category === "all" || m.category === filters.category;
    return matchSearch && matchCategory;
  });

  const handleAdd = async () => {
    if (!form.name || !form.price_retail) { toast.error("يرجى إدخال الاسم وسعر البيع"); return; }
    setSaving(true);
    try {
      const payload = {
        sku: form.sku,
        name: form.name,
        category: form.category || "General",
        description: form.description,
        price_retail: Number(form.price_retail) || 0,
        price_wholesale: Number(form.price_wholesale) || 0,
        stock_quantity: Number(form.stock_quantity) || 0,
        barcode: form.barcode || null,
        image_url: form.image_url || null,
      };
      const res = await api.post<{ products: ExternalProduct[] }>("/external-materials", payload);
      if (res?.products && res.products.length > 0) {
        setMaterials(prev => [...prev, ...res.products.map(mapExternal)]);
      }
      await logAudit({ entity: "material", entityId: form.sku || form.name, entityName: form.name, action: "create", snapshot: payload as any, endpoint: "/external-materials", idField: "sku" });
      setForm({ ...emptyForm });
      setDialogOpen(false);
      toast.success("تمت إضافة المادة بنجاح");
    } catch (err: any) {
      toast.error(err?.message || "فشل إضافة المادة");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!detailItem?.id) { toast.error("لا يمكن تعديل هذا العنصر"); return; }
    if (!editForm.name) { toast.error("يرجى إدخال الاسم"); return; }
    setSaving(true);
    try {
      const payload = {
        sku: editForm.sku,
        name: editForm.name,
        category: editForm.category || "General",
        description: editForm.description,
        price_retail: Number(editForm.price_retail) || 0,
        price_wholesale: Number(editForm.price_wholesale) || 0,
        stock_quantity: Number(editForm.stock_quantity) || 0,
        barcode: editForm.barcode || null,
        image_url: editForm.image_url || null,
      };
      await api.patch(`/external-materials/${detailItem.id}`, payload);
      await logAudit({ entity: "material", entityId: detailItem.id, entityName: editForm.name, action: "update", snapshot: payload as any, endpoint: "/external-materials", idField: "id" });
      setMaterials(prev => prev.map(m => m.id === detailItem.id ? {
        ...m,
        code: editForm.sku || m.code,
        name: editForm.name,
        category: editForm.category || m.category,
        description: editForm.description,
        sellingPrice: Number(editForm.price_retail) || 0,
        storeCost: Number(editForm.price_wholesale) || 0,
        stock_quantity: Number(editForm.stock_quantity) || 0,
        barcode: editForm.barcode || null,
        image_url: editForm.image_url || null,
      } : m));
      setDetailItem(prev => prev ? {
        ...prev,
        code: editForm.sku || prev.code,
        name: editForm.name,
        category: editForm.category || prev.category,
        description: editForm.description,
        sellingPrice: Number(editForm.price_retail) || 0,
        storeCost: Number(editForm.price_wholesale) || 0,
        stock_quantity: Number(editForm.stock_quantity) || 0,
        barcode: editForm.barcode || null,
        image_url: editForm.image_url || null,
      } : null);
      setEditing(false);
      toast.success("تم التعديل بنجاح");
    } catch (err: any) {
      toast.error(err?.message || "فشل التعديل");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    if (!detailItem) return;
    setEditForm({
      sku: detailItem.code || "",
      name: detailItem.name || "",
      category: detailItem.category || "",
      description: detailItem.description || "",
      price_retail: String(detailItem.sellingPrice || ""),
      price_wholesale: String(detailItem.storeCost || ""),
      stock_quantity: String(detailItem.stock_quantity ?? ""),
      barcode: detailItem.barcode || "",
      image_url: detailItem.image_url || "",
    });
    setEditing(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.id) {
        await api.delete(`/external-materials/${deleteTarget.id}`);
        await logAudit({ entity: "material", entityId: deleteTarget.id, entityName: deleteTarget.name, action: "delete", snapshot: deleteTarget as any, endpoint: "/external-materials", idField: "id" });
        setMaterials(prev => prev.filter(m => m.id !== deleteTarget.id));
      } else {
        await api.delete(`/materials/${deleteTarget.code}`);
        await logAudit({ entity: "material", entityId: deleteTarget.code, entityName: deleteTarget.name, action: "delete", snapshot: deleteTarget as any, endpoint: "/materials", idField: "code" });
        setMaterials(prev => prev.filter(m => m.code !== deleteTarget.code));
      }
      setDetailItem(null);
      setDeleteTarget(null);
      toast.success(`تم حذف المادة: ${deleteTarget.name}`);
    } catch (err: any) {
      toast.error(err?.message || "فشل حذف المادة");
    } finally {
      setDeleting(false);
    }
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setCsvData(results.data);
          setCsvDialogOpen(true);
        } else {
          toast.error("الملف فارغ أو غير صالح");
        }
      },
      error: () => toast.error("فشل قراءة الملف"),
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCsvImport = async () => {
    if (csvData.length === 0) return;
    setCsvImporting(true);
    try {
      const items = csvData.map((row: any) => ({
        sku: row.sku || row.SKU || row.code || row["كود"] || "",
        name: row.name || row.Name || row["الاسم"] || row["اسم المنتج"] || "",
        category: row.category || row.Category || row["الفئة"] || "General",
        description: row.description || row.Description || row["الوصف"] || "",
        price_retail: Number(row.price_retail || row["سعر البيع"] || row.price || 0),
        price_wholesale: Number(row.price_wholesale || row["سعر الجملة"] || 0),
        stock_quantity: Number(row.stock_quantity || row["الكمية"] || row.quantity || row.stock || 0),
        barcode: row.barcode || row.Barcode || row["الباركود"] || null,
        image_url: row.image_url || row["رابط الصورة"] || null,
      }));
      const res = await api.post<{ products: ExternalProduct[]; count: number }>("/external-materials", items);
      if (res?.products) {
        setMaterials(prev => [...prev, ...res.products.map(mapExternal)]);
      }
      setCsvDialogOpen(false);
      setCsvData([]);
      toast.success(`تمت إضافة ${res?.count || items.length} مادة بنجاح`);
    } catch (err: any) {
      toast.error(err?.message || "فشل استيراد البيانات");
    } finally {
      setCsvImporting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/external-materials/export");
      if (!response.ok) throw new Error("فشل التنزيل");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "materials_export.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تنزيل الملف بنجاح");
    } catch {
      toast.error("فشل تنزيل الملف");
    } finally {
      setExporting(false);
    }
  };

  const FormFields = ({ values, onChange, isEdit = false }: { values: typeof emptyForm; onChange: (v: typeof emptyForm) => void; isEdit?: boolean }) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">كود المنتج (SKU)</Label><Input className="h-9 mt-1" placeholder="مثال: MAT-001" value={values.sku} onChange={(e) => onChange({ ...values, sku: e.target.value })} /></div>
        <div><Label className="text-xs">الفئة</Label>
          <Select value={values.category} onValueChange={(v) => onChange({ ...values, category: v })}>
            <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              <SelectItem value="General">عام</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">اسم المنتج *</Label><Input className="h-9 mt-1" placeholder="اسم المنتج" value={values.name} onChange={(e) => onChange({ ...values, name: e.target.value })} /></div>
      <div><Label className="text-xs">الوصف</Label><Textarea className="mt-1 min-h-[60px]" placeholder="وصف المنتج" value={values.description} onChange={(e) => onChange({ ...values, description: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">سعر البيع *</Label><Input className="h-9 mt-1" type="number" placeholder="0" value={values.price_retail} onChange={(e) => onChange({ ...values, price_retail: e.target.value })} /></div>
        <div><Label className="text-xs">سعر الجملة</Label><Input className="h-9 mt-1" type="number" placeholder="0" value={values.price_wholesale} onChange={(e) => onChange({ ...values, price_wholesale: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">الكمية المتاحة</Label><Input className="h-9 mt-1" type="number" placeholder="0" value={values.stock_quantity} onChange={(e) => onChange({ ...values, stock_quantity: e.target.value })} /></div>
        <div><Label className="text-xs">الباركود</Label><Input className="h-9 mt-1" placeholder="رقم الباركود" value={values.barcode} onChange={(e) => onChange({ ...values, barcode: e.target.value })} /></div>
      </div>
      <div><Label className="text-xs">رابط الصورة</Label><Input className="h-9 mt-1" placeholder="https://..." value={values.image_url} onChange={(e) => onChange({ ...values, image_url: e.target.value })} /></div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="page-header">{t.materialsTitle}</h1>
          <p className="page-description">{materials.length} {t.materialCount} · {categories.length} {t.category}</p>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />

      <DataToolbar
        searchPlaceholder={t.searchMaterials}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[{ label: t.category, value: "category", options: categories.map(c => ({ label: c, value: c })) }]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("materials", [t.materialCode, t.materialName, t.category, t.sellingPrice, t.storeCost, "Stock", t.manufacturer], filtered.map(m => [m.code, m.name, m.category, m.sellingPrice, m.storeCost, m.stock_quantity ?? 0, m.manufacturer]))}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" className="h-9" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 me-1.5" />إضافة مادة
            </Button>
            <Button size="sm" variant="outline" className="h-9" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 me-1.5" />استيراد CSV
            </Button>
            <Button size="sm" variant="outline" className="h-9" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 me-1.5" />}
              تنزيل الكل
            </Button>
          </div>
        }
      />

      <div className="stat-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t.loadingMaterials}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{t.noResults}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground w-12"></th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.materialCode}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.materialName}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.category}</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.sellingPrice}</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.storeCost}</th>
                <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">Stock</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.manufacturer}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((mat) => (
                <tr key={mat.id || mat.code} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => { setDetailItem(mat); setEditing(false); }}>
                  <td className="py-2 px-3">
                    {mat.image_url && !imgErrors.has(mat.code) ? (
                      <img src={mat.image_url} alt={mat.name} className="h-9 w-9 rounded-md object-cover border border-border" onError={() => setImgErrors(prev => new Set(prev).add(mat.code))} />
                    ) : (
                      <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                        <ImageOff className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{mat.code}</td>
                  <td className="py-3 px-3 font-medium">{mat.name}</td>
                  <td className="py-3 px-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{mat.category}</span></td>
                  <td className="py-3 px-3 text-end font-medium">{mat.sellingPrice.toLocaleString()} {t.currency}</td>
                  <td className="py-3 px-3 text-end text-muted-foreground">{mat.storeCost > 0 ? `${mat.storeCost.toLocaleString()} ${t.currency}` : "—"}</td>
                  <td className="py-3 px-3 text-end">
                    <Badge variant={mat.stock_quantity && mat.stock_quantity > 0 ? "default" : "secondary"} className={mat.stock_quantity && mat.stock_quantity > 0 ? "bg-success/10 text-success border-0" : ""}>
                      {mat.stock_quantity ?? 0}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground text-xs">{mat.manufacturer || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail / Edit Dialog */}
      <Dialog open={!!detailItem} onOpenChange={(open) => { if (!open) { setDetailItem(null); setEditing(false); } }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="sr-only"><DialogTitle>{detailItem?.name}</DialogTitle></DialogHeader>
          {detailItem && !editing && (
            <>
              <div className="relative bg-muted/30 p-6 pb-4 border-b border-border">
                <div className="flex items-start gap-4">
                  {detailItem.image_url && !imgErrors.has(detailItem.code + "-detail") ? (
                    <img src={detailItem.image_url} alt={detailItem.name} className="h-20 w-20 rounded-xl object-cover border border-border shadow-sm shrink-0" onError={() => setImgErrors(prev => new Set(prev).add(detailItem.code + "-detail"))} />
                  ) : (
                    <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border">
                      <Package className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="text-lg font-bold leading-tight text-foreground truncate">{detailItem.name}</h2>
                    <p className="text-xs font-mono text-muted-foreground">{detailItem.code}</p>
                    <Badge variant="outline" className="text-xs mt-1">{detailItem.category}</Badge>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-5">
                {detailItem.description && <p className="text-sm text-muted-foreground leading-relaxed">{detailItem.description}</p>}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-xl bg-muted/40 border border-border/50">
                    <p className="text-[11px] text-muted-foreground mb-1">{t.sellingPrice}</p>
                    <p className="text-base font-bold text-foreground">{detailItem.sellingPrice.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{t.currency}</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/40 border border-border/50">
                    <p className="text-[11px] text-muted-foreground mb-1">{t.storeCost}</p>
                    <p className="text-base font-bold text-foreground">{detailItem.storeCost > 0 ? detailItem.storeCost.toLocaleString() : "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{detailItem.storeCost > 0 ? t.currency : ""}</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/40 border border-border/50">
                    <p className="text-[11px] text-muted-foreground mb-1">Stock</p>
                    <p className={`text-base font-bold ${(detailItem.stock_quantity ?? 0) > 0 ? "text-success" : "text-destructive"}`}>{detailItem.stock_quantity ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground">{detailItem.unit || "unit"}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {detailItem.manufacturer && (
                    <div className="flex items-center justify-between py-2 border-b border-border/50 text-sm">
                      <span className="text-muted-foreground">{t.manufacturer}</span>
                      <span className="font-medium">{detailItem.manufacturer}</span>
                    </div>
                  )}
                  {detailItem.barcode && detailItem.barcode !== "1E+12" && (
                    <div className="flex items-center justify-between py-2 border-b border-border/50 text-sm">
                      <span className="text-muted-foreground">Barcode</span>
                      <span className="font-mono text-xs">{detailItem.barcode}</span>
                    </div>
                  )}
                </div>
                {detailItem.variants && detailItem.variants.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Variants</p>
                    <div className="space-y-2">
                      {detailItem.variants.map((v: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 flex-wrap p-2.5 rounded-lg bg-muted/30 border border-border/40">
                          <span className="text-xs font-medium text-muted-foreground shrink-0">{v.name?.replace("()", "")}:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {v.options?.map((o: any, j: number) => <Badge key={j} variant="secondary" className="text-xs px-2 py-0.5">{o.value}</Badge>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 pt-2 border-t border-border/50 flex gap-2">
                {detailItem.id && (
                  <Button variant="outline" size="sm" className="flex-1" onClick={startEditing}>
                    <Pencil className="h-3.5 w-3.5 me-2" />تعديل
                  </Button>
                )}
                <Button variant="outline" size="sm" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setDeleteTarget(detailItem)}>
                  <Trash2 className="h-3.5 w-3.5 me-2" />حذف
                </Button>
              </div>
            </>
          )}
          {detailItem && editing && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">تعديل المادة</h3>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
              </div>
              <FormFields values={editForm} onChange={setEditForm} isEdit />
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={handleEdit} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Check className="h-4 w-4 me-2" />}
                  حفظ التعديلات
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>إلغاء</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="حذف المادة"
        description={`هل تريد حذف "${deleteTarget?.name}"؟ يمكنك استعادته لاحقاً من سجل الأنشطة.`}
        onConfirm={handleDelete}
        loading={deleting}
      />

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>إضافة مادة جديدة</DialogTitle></DialogHeader>
          <FormFields values={form} onChange={setForm} />
          <Button className="w-full" onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Plus className="h-4 w-4 me-2" />}
            إضافة المادة
          </Button>
        </DialogContent>
      </Dialog>

      {/* CSV Import Preview Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={(open) => { if (!open) { setCsvDialogOpen(false); setCsvData([]); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              معاينة البيانات المستوردة
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">تم العثور على {csvData.length} صف. تأكد من البيانات قبل الاستيراد.</p>
          <div className="flex-1 overflow-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="py-2 px-3 text-start font-medium">#</th>
                  <th className="py-2 px-3 text-start font-medium">الكود</th>
                  <th className="py-2 px-3 text-start font-medium">الاسم</th>
                  <th className="py-2 px-3 text-start font-medium">الفئة</th>
                  <th className="py-2 px-3 text-end font-medium">سعر البيع</th>
                  <th className="py-2 px-3 text-end font-medium">سعر الجملة</th>
                  <th className="py-2 px-3 text-end font-medium">الكمية</th>
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 50).map((row: any, i: number) => (
                  <tr key={i} className="border-t border-border/30">
                    <td className="py-1.5 px-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-1.5 px-3 font-mono">{row.sku || row.SKU || row.code || row["كود"] || "—"}</td>
                    <td className="py-1.5 px-3">{row.name || row.Name || row["الاسم"] || row["اسم المنتج"] || "—"}</td>
                    <td className="py-1.5 px-3">{row.category || row.Category || row["الفئة"] || "—"}</td>
                    <td className="py-1.5 px-3 text-end">{row.price_retail || row["سعر البيع"] || row.price || "—"}</td>
                    <td className="py-1.5 px-3 text-end">{row.price_wholesale || row["سعر الجملة"] || "—"}</td>
                    <td className="py-1.5 px-3 text-end">{row.stock_quantity || row["الكمية"] || row.quantity || row.stock || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {csvData.length > 50 && <p className="text-center text-xs text-muted-foreground py-2">... و{csvData.length - 50} صف إضافي</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleCsvImport} disabled={csvImporting}>
              {csvImporting ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Upload className="h-4 w-4 me-2" />}
              استيراد {csvData.length} مادة
            </Button>
            <Button variant="outline" onClick={() => { setCsvDialogOpen(false); setCsvData([]); }}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
