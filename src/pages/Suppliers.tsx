import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Globe, Mail, Phone, Package, Loader2, Trash2, Pencil, X, Search, Check, ImageOff, ShoppingCart, Wallet, Calendar, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { logAudit } from "@/lib/auditLog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

type Supplier = {
  id: string;
  name: string;
  country: string;
  email: string;
  phone: string;
  paymentTerms: string;
  active: boolean;
};

type SupplierMaterial = {
  supplierId: string;
  materialCode: string;
  materialName: string;
};

type CatalogMaterial = {
  code: string;
  name: string;
  category: string;
  imageUrl: string | null;
  sellingPrice: number;
};

function normalizeSupplier(raw: any): Supplier {
  return {
    id: raw.id,
    name: raw.name,
    country: raw.country || "",
    email: raw.email || "",
    phone: raw.phone || "",
    paymentTerms: raw.paymentTerms ?? raw.payment_terms ?? "Net 30",
    active: raw.active ?? true,
  };
}

export default function SuppliersPage() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const _userName = profile?.full_name || "مستخدم";
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Add dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", country: "", email: "", phone: "", paymentTerms: "Net 30" });

  // Detail & edit
  const [detailItem, setDetailItem] = useState<Supplier | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Supplier | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Supplier materials (from DB)
  const [supMaterials, setSupMaterials] = useState<SupplierMaterial[]>([]);
  const [matsLoading, setMatsLoading] = useState(false);

  // Material counts per supplier (loaded once)
  const [matCounts, setMatCounts] = useState<Record<string, number>>({});

  // Catalog for picker
  const [catalog, setCatalog] = useState<CatalogMaterial[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSaving, setPickerSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [supStats, setSupStats] = useState<Record<string, any>>({});

  const [matDetail, setMatDetail] = useState<CatalogMaterial | null>(null);
  const [matImgErrors, setMatImgErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSuppliers();
    loadCatalog();
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.get<Record<string, any>>("/suppliers-stats");
      setSupStats(data || {});
    } catch { /* ignore */ }
  };

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>("/suppliers");
      setSuppliers((data || []).map(normalizeSupplier));
    } catch {
      toast.error(t.failedToLoadSuppliers);
    }
    setLoading(false);
  };

  const loadCatalog = async () => {
    try {
      const json = await api.get<{ products: any[] }>("/external-materials");
      if (json?.products && Array.isArray(json.products)) {
        setCatalog(json.products.map((p: any) => ({
          code: p.sku || p.id?.slice(0, 8) || "",
          name: p.name || "",
          category: p.category || "General",
          imageUrl: p.image_url || null,
          sellingPrice: p.price_retail || 0,
        })));
        setCatalogLoaded(true);
      }
    } catch { /* ignore */ }
  };

  const openDetail = async (sup: Supplier) => {
    setDetailItem(sup);
    setEditMode(false);
    setEditForm({ ...sup });
    setMatsLoading(true);
    try {
      const data = await api.get<SupplierMaterial[]>(`/suppliers/${sup.id}/materials`);
      setSupMaterials(data || []);
    } catch { setSupMaterials([]); }
    finally { setMatsLoading(false); }
  };

  // Load counts for all suppliers (summary)
  const loadAllCounts = useCallback(async (sups: Supplier[]) => {
    const counts: Record<string, number> = {};
    await Promise.all(sups.map(async (s) => {
      try {
        const data = await api.get<SupplierMaterial[]>(`/suppliers/${s.id}/materials`);
        counts[s.id] = (data || []).length;
      } catch { counts[s.id] = 0; }
    }));
    setMatCounts(counts);
  }, []);

  useEffect(() => {
    if (suppliers.length > 0) loadAllCounts(suppliers);
  }, [suppliers, loadAllCounts]);

  const filtered = suppliers.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.country.toLowerCase().includes(search.toLowerCase()) ||
    s.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!form.name) { toast.error(t.enterSupplierName); return; }
    setSaving(true);
    const num = suppliers.length + 1;
    const newId = `SUP-${String(num).padStart(3, "0")}`;
    try {
      const saved = await api.post<any>("/suppliers", { ...form, id: newId, active: true });
      await logAudit({ entity: "supplier", entityId: saved.id || newId, entityName: form.name, action: "create", snapshot: saved, endpoint: "/suppliers" , performedBy: _userName });
      setSuppliers(prev => [...prev, normalizeSupplier(saved)]);
      setForm({ name: "", country: "", email: "", phone: "", paymentTerms: "Net 30" });
      setDialogOpen(false);
      toast.success(t.supplierAdded);
    } catch {
      toast.error(t.failedToAddSupplier);
    }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editForm || !detailItem) return;
    setEditSaving(true);
    try {
      const saved = await api.patch<any>(`/suppliers/${detailItem.id}`, {
        name: editForm.name, country: editForm.country,
        email: editForm.email, phone: editForm.phone, paymentTerms: editForm.paymentTerms,
      });
      const updated = normalizeSupplier(saved);
      await logAudit({ entity: "supplier", entityId: detailItem.id, entityName: editForm.name || detailItem.name, action: "update", snapshot: { ...detailItem, ...editForm }, endpoint: "/suppliers", performedBy: _userName });
      setSuppliers(prev => prev.map(s => s.id === detailItem.id ? updated : s));
      setDetailItem(updated);
      setEditMode(false);
      toast.success(t.saveChanges);
    } catch {
      toast.error(t.failedToLoadData);
    }
    setEditSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/suppliers/${deleteTarget.id}`);
      await logAudit({ entity: "supplier", entityId: deleteTarget.id, entityName: deleteTarget.name, action: "delete", snapshot: deleteTarget as any, endpoint: "/suppliers" , performedBy: _userName });
      setSuppliers(prev => prev.filter(s => s.id !== deleteTarget.id));
      setDetailItem(null);
      setDeleteTarget(null);
      toast.success(`تم حذف المورّد: ${deleteTarget.name}`);
    } catch (err: any) {
      toast.error(err?.message || "فشل حذف المورّد");
    } finally {
      setDeleting(false);
    }
  };

  const addMaterialToSupplier = async (mat: CatalogMaterial) => {
    if (!detailItem) return;
    if (supMaterials.find(m => m.materialCode === mat.code)) {
      toast.info("هذه المادة مضافة بالفعل");
      return;
    }
    setPickerSaving(true);
    try {
      await api.post(`/suppliers/${detailItem.id}/materials`, { materialCode: mat.code, materialName: mat.name });
      const newMat: SupplierMaterial = { supplierId: detailItem.id, materialCode: mat.code, materialName: mat.name };
      setSupMaterials(prev => [...prev, newMat]);
      setMatCounts(prev => ({ ...prev, [detailItem.id]: (prev[detailItem.id] || 0) + 1 }));
    } catch {
      toast.error(t.failedToLoadData);
    }
    setPickerSaving(false);
  };

  const removeMaterialFromSupplier = async (mat: SupplierMaterial) => {
    if (!detailItem) return;
    try {
      await api.delete(`/suppliers/${detailItem.id}/materials/${mat.materialCode}`);
      setSupMaterials(prev => prev.filter(m => m.materialCode !== mat.materialCode));
      setMatCounts(prev => ({ ...prev, [detailItem.id]: Math.max(0, (prev[detailItem.id] || 1) - 1) }));
    } catch {
      toast.error(t.failedToLoadData);
    }
  };

  const catalogFiltered = catalog.filter(m =>
    !pickerSearch ||
    m.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    m.code.toLowerCase().includes(pickerSearch.toLowerCase())
  ).slice(0, 50);

  const matDetailFromCatalog = (code: string) =>
    catalog.find(m => m.code === code) || null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.suppliersTitle}</h1>
        <p className="page-description">
          {loading ? "..." : `${suppliers.length} ${t.supplier} · ${suppliers.filter(s => s.active).length} ${t.active}`}
        </p>
      </div>

      <DataToolbar
        searchPlaceholder={t.searchSuppliers}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[]}
        filterValues={{}}
        onFilterChange={() => {}}
        onExport={() => exportToCsv("suppliers", [t.code, t.name, t.country, t.email, t.phone, t.paymentTerms], filtered.map(s => [s.id, s.name, s.country, s.email, s.phone, s.paymentTerms]))}
        actions={<Button size="sm" className="h-9" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.addSupplier}</Button>}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t.loadingMaterials}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 && (
            <p className="col-span-full text-center py-12 text-muted-foreground text-sm">{t.noResults}</p>
          )}
          {filtered.map((sup) => {
            const st = supStats[sup.id];
            return (
            <div key={sup.id} className="stat-card space-y-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/suppliers/${sup.id}`)}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Link to={`/suppliers/${sup.id}`} onClick={e => e.stopPropagation()} className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
                    <span className="text-sm font-bold text-primary">{sup.name.charAt(0)}</span>
                  </Link>
                  <div>
                    <Link to={`/suppliers/${sup.id}`} onClick={e => e.stopPropagation()} className="font-semibold text-sm hover:text-primary hover:underline transition-colors">
                      {sup.name}
                    </Link>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" />{sup.country || "—"}</p>
                  </div>
                </div>
                <Badge variant={sup.active ? "default" : "secondary"} className={sup.active ? "bg-success/10 text-success border-0" : ""}>
                  {sup.active ? t.active : t.inactive}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {sup.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{sup.email}</span>}
                {sup.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{sup.phone}</span>}
              </div>
              {st && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-1.5 rounded-md bg-muted/40 text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                      <ShoppingCart className="h-3 w-3" />
                    </div>
                    <span className="font-semibold">{st.totalOrders}</span>
                    <span className="text-muted-foreground text-[10px] block">طلب</span>
                  </div>
                  <div className="p-1.5 rounded-md bg-muted/40 text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                      <Wallet className="h-3 w-3" />
                    </div>
                    <span className="font-semibold">{(st.totalPurchases || 0).toLocaleString()}</span>
                    <span className="text-muted-foreground text-[10px] block">ج.م</span>
                  </div>
                  <div className="p-1.5 rounded-md bg-muted/40 text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                      <Calendar className="h-3 w-3" />
                    </div>
                    <span className="font-semibold text-[11px]">{st.lastOrderDate ? st.lastOrderDate.slice(0, 10) : "—"}</span>
                    <span className="text-muted-foreground text-[10px] block">آخر طلب</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {matCounts[sup.id] ?? 0} {t.materialsCount}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{sup.paymentTerms}</span>
                  <Link to={`/suppliers/${sup.id}`} onClick={e => e.stopPropagation()} className="text-primary hover:underline text-[11px] flex items-center gap-0.5">
                    <ExternalLink className="h-3 w-3" />
                    الملف
                  </Link>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="حذف المورّد"
        description={`هل تريد حذف المورّد "${deleteTarget?.name}"؟`}
        onConfirm={handleDelete}
        loading={deleting}
      />

      {/* ── Detail / Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!detailItem} onOpenChange={(open) => { if (!open) { setDetailItem(null); setEditMode(false); setPickerOpen(false); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-base">
                {editMode ? "تعديل المورّد" : `${detailItem?.name}`}
              </DialogTitle>
              <div className="flex items-center gap-1">
                {!editMode && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditMode(true)} data-testid={`button-edit-supplier-${detailItem?.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(detailItem)} data-testid={`button-delete-supplier-${detailItem?.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {detailItem && (
            <div className="space-y-5">
              {/* ── View mode ── */}
              {!editMode ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.country}</p><p className="font-semibold">{detailItem.country || "—"}</p></div>
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.paymentTerms}</p><p className="font-semibold">{detailItem.paymentTerms}</p></div>
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.email}</p><p className="font-semibold text-xs">{detailItem.email || "—"}</p></div>
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.phone}</p><p className="font-semibold">{detailItem.phone || "—"}</p></div>
                </div>
              ) : (
                /* ── Edit mode ── */
                <div className="space-y-3">
                  <div><Label className="text-xs">{t.supplierName} *</Label><Input className="h-9 mt-1" value={editForm?.name || ""} onChange={e => setEditForm(f => f ? { ...f, name: e.target.value } : f)} /></div>
                  <div><Label className="text-xs">{t.country}</Label><Input className="h-9 mt-1" value={editForm?.country || ""} onChange={e => setEditForm(f => f ? { ...f, country: e.target.value } : f)} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">{t.email}</Label><Input className="h-9 mt-1" type="email" value={editForm?.email || ""} onChange={e => setEditForm(f => f ? { ...f, email: e.target.value } : f)} /></div>
                    <div><Label className="text-xs">{t.phone}</Label><Input className="h-9 mt-1" value={editForm?.phone || ""} onChange={e => setEditForm(f => f ? { ...f, phone: e.target.value } : f)} /></div>
                  </div>
                  <div><Label className="text-xs">{t.paymentTerms}</Label><Input className="h-9 mt-1" value={editForm?.paymentTerms || ""} onChange={e => setEditForm(f => f ? { ...f, paymentTerms: e.target.value } : f)} /></div>
                  <div className="flex gap-2 pt-1">
                    <Button className="flex-1" onClick={handleEdit} disabled={editSaving}>
                      {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.saveChanges}
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setEditMode(false)}>إلغاء</Button>
                  </div>
                </div>
              )}

              {/* ── Supplied Materials ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">{t.suppliedMaterials}</h4>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setPickerSearch(""); setPickerOpen(true); }} disabled={!catalogLoaded}>
                    <Plus className="h-3 w-3" />إضافة مادة
                  </Button>
                </div>

                {matsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.loadingMaterials}
                  </div>
                ) : supMaterials.length === 0 ? (
                  <div className="py-6 text-center rounded-lg border border-dashed border-border">
                    <Package className="h-7 w-7 mx-auto mb-2 text-muted-foreground opacity-40" />
                    <p className="text-sm text-muted-foreground">{t.noMaterials}</p>
                    <p className="text-xs text-muted-foreground mt-1">اضغط "إضافة مادة" لتحديد ما يوفره هذا المورّد</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {supMaterials.map(m => {
                      const cat = matDetailFromCatalog(m.materialCode);
                      return (
                        <div
                          key={m.materialCode}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                        >
                          <div
                            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                            onClick={() => {
                              if (cat) {
                                setMatDetail(cat);
                              } else {
                                navigate(`/materials?search=${encodeURIComponent(m.materialCode)}`);
                                setDetailItem(null);
                              }
                            }}
                          >
                            {cat?.imageUrl && !matImgErrors.has(m.materialCode) ? (
                              <img src={cat.imageUrl} alt={m.materialName} className="h-8 w-8 rounded-md object-cover border border-border shrink-0" onError={() => setMatImgErrors(prev => new Set(prev).add(m.materialCode))} />
                            ) : (
                              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border">
                                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{m.materialName}</p>
                              <p className="text-xs text-muted-foreground font-mono">{m.materialCode}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {cat && <span className="text-xs text-muted-foreground hidden group-hover:inline">{cat.sellingPrice.toLocaleString()} {t.currency}</span>}
                            <Button
                              variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeMaterialFromSupplier(m)}
                              title="إزالة"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Material Picker Dialog ──────────────────────────────────────────── */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>اختر مادة من الكتالوج</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-9 ps-9"
              placeholder="ابحث بالاسم أو الكود..."
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0 mt-1">
            {catalogFiltered.length === 0 && (
              <p className="text-center py-8 text-sm text-muted-foreground">لا نتائج</p>
            )}
            {catalogFiltered.map(mat => {
              const already = supMaterials.some(m => m.materialCode === mat.code);
              return (
                <div
                  key={mat.code}
                  className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${already ? "bg-success/5 border border-success/20" : "hover:bg-muted/50"}`}
                  onClick={() => !already && addMaterialToSupplier(mat)}
                >
                  {mat.imageUrl && !matImgErrors.has("picker-" + mat.code) ? (
                    <img src={mat.imageUrl} alt={mat.name} className="h-9 w-9 rounded-md object-cover border border-border shrink-0" onError={() => setMatImgErrors(prev => new Set(prev).add("picker-" + mat.code))} />
                  ) : (
                    <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border">
                      <ImageOff className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{mat.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{mat.code} · {mat.category}</p>
                  </div>
                  {already ? (
                    <Check className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    pickerSaving ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
          {!catalogLoaded && (
            <p className="text-xs text-center text-muted-foreground py-2">جاري تحميل الكتالوج...</p>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Material Detail Mini Dialog ──────────────────────────────────────── */}
      <Dialog open={!!matDetail} onOpenChange={() => setMatDetail(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="sr-only">{matDetail?.name}</DialogTitle></DialogHeader>
          {matDetail && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                {matDetail.imageUrl && !matImgErrors.has(matDetail.code + "-detail") ? (
                  <img src={matDetail.imageUrl} alt={matDetail.name} className="h-16 w-16 rounded-xl object-cover border border-border shrink-0" onError={() => setMatImgErrors(prev => new Set(prev).add(matDetail.code + "-detail"))} />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border">
                    <Package className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold leading-tight">{matDetail.name}</h2>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{matDetail.code}</p>
                  <Badge variant="outline" className="text-xs mt-1">{matDetail.category}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 text-center p-3 rounded-xl bg-muted/40 border border-border/50">
                  <p className="text-[11px] text-muted-foreground mb-1">{t.sellingPrice}</p>
                  <p className="text-base font-bold">{matDetail.sellingPrice.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{t.currency}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => { setMatDetail(null); setDetailItem(null); navigate(`/materials?search=${encodeURIComponent(matDetail.code)}`); }}>
                عرض في صفحة المواد
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add Supplier Dialog ──────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.addNewSupplier}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t.supplierName} *</Label><Input className="h-9 mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label className="text-xs">{t.country}</Label><Input className="h-9 mt-1" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t.email}</Label><Input className="h-9 mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label className="text-xs">{t.phone}</Label><Input className="h-9 mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">{t.paymentTerms}</Label><Input className="h-9 mt-1" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} /></div>
            <Button className="w-full" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.addSupplier}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
