import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, ImageOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";

type ExternalProduct = {
  id: string; sku: string; name: string; image_url: string | null;
  price_retail: number; price_wholesale: number; stock_quantity: number;
  barcode: string | null; category: string; description: string | null;
  images: string[] | null; features: any[] | null; variants: any[] | null;
};

type Material = {
  code: string; name: string; category: string; unit: string;
  sellingPrice: number; storeCost: number; supplier: string;
  supplierId: string; manufacturer: string; hasExpiry: boolean; active: boolean;
  image_url?: string | null; stock_quantity?: number;
  variants?: any[] | null; barcode?: string | null; description?: string | null;
};

function mapExternal(p: ExternalProduct): Material {
  const companyVariant = p.variants?.find((v: any) => v.name === "Company" || v.name === "Company()");
  return {
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
  const [form, setForm] = useState({ name: "", category: "", unit: "unit", sellingPrice: "", storeCost: "", supplier: "", supplierId: "", manufacturer: "", hasExpiry: false, active: true });
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  useEffect(() => { fetchMaterials(); }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    let loaded = false;

    // 1. Try via backend proxy (no CORS issues) — has 306 products with images & stock
    try {
      const json = await api.get<{ products: ExternalProduct[] }>("/external-materials");
      if (json?.products && Array.isArray(json.products) && json.products.length > 0) {
        setMaterials(json.products.map(mapExternal));
        loaded = true;
      }
    } catch (err) {
      console.error("External materials failed, falling back to DB:", err);
    }

    // 2. Fallback → load from local database
    if (!loaded) {
      try {
        const dbData = await api.get<any[]>("/materials");
        setMaterials((dbData || []).map(mapDb));
      } catch {
        toast.error("تعذّر تحميل المواد");
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
    if (!form.name || !form.sellingPrice) { toast.error(t.enterMaterialAndPrice); return; }
    const num = materials.length + 1;
    const newCode = `MAT-${String(num).padStart(3, "0")}`;
    try {
      await api.post("/materials", {
        code: newCode, name: form.name, category: form.category || "General",
        unit: form.unit, sellingPrice: String(form.sellingPrice),
        storeCost: String(form.storeCost), supplier: form.supplier,
        supplierId: form.supplierId, manufacturer: form.manufacturer,
        hasExpiry: form.hasExpiry, active: form.active,
      });
      setMaterials(prev => [...prev, { ...form, code: newCode, sellingPrice: Number(form.sellingPrice), storeCost: Number(form.storeCost) }]);
      setForm({ name: "", category: "", unit: "unit", sellingPrice: "", storeCost: "", supplier: "", supplierId: "", manufacturer: "", hasExpiry: false, active: true });
      setDialogOpen(false);
      toast.success(t.materialAdded);
    } catch {
      toast.error("تعذّر إضافة المادة");
    }
  };

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

      <DataToolbar
        searchPlaceholder={t.searchMaterials}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[{ label: t.category, value: "category", options: categories.map(c => ({ label: c, value: c })) }]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("materials", [t.materialCode, t.materialName, t.category, t.sellingPrice, t.storeCost, "Stock", t.manufacturer], filtered.map(m => [m.code, m.name, m.category, m.sellingPrice, m.storeCost, m.stock_quantity ?? 0, m.manufacturer]))}
        actions={<Button size="sm" className="h-9" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.addMaterial}</Button>}
      />

      <div className="stat-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>جاري تحميل المواد...</span>
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
                <tr key={mat.code} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetailItem(mat)}>
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

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="sr-only"><DialogTitle>{detailItem?.name}</DialogTitle></DialogHeader>
          {detailItem && (
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
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.addNewMaterial}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t.materialName} *</Label><Input className="h-9 mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t.category}</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">{t.unit}</Label><Input className="h-9 mt-1" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t.sellingPrice} *</Label><Input className="h-9 mt-1" type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} /></div>
              <div><Label className="text-xs">{t.storeCost}</Label><Input className="h-9 mt-1" type="number" value={form.storeCost} onChange={(e) => setForm({ ...form, storeCost: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">{t.manufacturer}</Label><Input className="h-9 mt-1" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.hasExpiry} onCheckedChange={(v) => setForm({ ...form, hasExpiry: v })} />
              <Label className="text-xs">{t.hasExpiry || "له تاريخ انتهاء"}</Label>
            </div>
            <Button className="w-full" onClick={handleAdd}>{t.addMaterial}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
