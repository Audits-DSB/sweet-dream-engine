import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

type ExternalProduct = {
  id: string;
  sku: string;
  name: string;
  image_url: string | null;
  price_retail: number;
  price_wholesale: number;
  stock_quantity: number;
  barcode: string | null;
  category: string;
  description: string | null;
  created_at: string;
  images: string[] | null;
  features: any[] | null;
  variants: any[] | null;
};

// Map external product to internal material shape
type Material = {
  code: string;
  name: string;
  category: string;
  unit: string;
  sellingPrice: number;
  storeCost: number;
  supplier: string;
  supplierId: string;
  manufacturer: string;
  hasExpiry: boolean;
  active: boolean;
  image_url?: string | null;
  stock_quantity?: number;
  variants?: any[] | null;
  barcode?: string | null;
  description?: string | null;
};

function mapProduct(p: ExternalProduct): Material {
  // Extract manufacturer from variants if available
  const companyVariant = p.variants?.find((v: any) => v.name === "Company" || v.name === "Company()");
  const manufacturer = companyVariant?.options?.[0]?.value || "";

  return {
    code: p.sku || p.id.slice(0, 8),
    name: p.name,
    category: p.category || "General",
    unit: "unit",
    sellingPrice: p.price_retail || 0,
    storeCost: p.price_wholesale || 0,
    supplier: "",
    supplierId: "",
    manufacturer,
    hasExpiry: false,
    active: true,
    image_url: p.image_url,
    stock_quantity: p.stock_quantity,
    variants: p.variants,
    barcode: p.barcode,
    description: p.description,
  };
}

export default function MaterialsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Material | null>(null);
  const [form, setForm] = useState({ name: "", category: "", unit: "unit", sellingPrice: "", storeCost: "", supplier: "", supplierId: "", manufacturer: "", hasExpiry: false, active: true });
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-external-materials`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
          },
        }
      );
      const json = await res.json();
      if (json.products) {
        setMaterials(json.products.map(mapProduct));
      }
    } catch (err) {
      console.error("Failed to fetch materials:", err);
      toast.error("Failed to load materials from external database");
    }
    setLoading(false);
  };

  const categories = [...new Set(materials.map(m => m.category))].sort();

  const filtered = materials.filter((m) => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.code.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filters.category || filters.category === "all" || m.category === filters.category;
    return matchSearch && matchCategory;
  });

  const handleAdd = () => {
    if (!form.name || !form.sellingPrice) { toast.error(t.enterMaterialAndPrice); return; }
    const num = materials.length + 1;
    const newCode = `MAT-${String(num).padStart(3, "0")}`;
    setMaterials([...materials, { ...form, code: newCode, sellingPrice: Number(form.sellingPrice), storeCost: Number(form.storeCost) }]);
    setForm({ name: "", category: "", unit: "unit", sellingPrice: "", storeCost: "", supplier: "", supplierId: "", manufacturer: "", hasExpiry: false, active: true });
    setDialogOpen(false);
    toast.success(t.materialAdded);
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
          <div className="text-center py-12 text-muted-foreground text-sm">{t.loadingUsers || "Loading..."}</div>
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
                      <img
                        src={mat.image_url}
                        alt={mat.name}
                        className="h-9 w-9 rounded-md object-cover border border-border"
                        onError={() => setImgErrors(prev => new Set(prev).add(mat.code))}
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                        <ImageOff className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{mat.code}</td>
                  <td className="py-3 px-3 font-medium">{mat.name}</td>
                  <td className="py-3 px-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{mat.category}</span></td>
                  <td className="py-3 px-3 text-end font-medium">{mat.sellingPrice} {t.currency}</td>
                  <td className="py-3 px-3 text-end text-muted-foreground">{mat.storeCost > 0 ? `${mat.storeCost} ${t.currency}` : "—"}</td>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{detailItem?.code} — {detailItem?.name}</DialogTitle></DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              {detailItem.image_url && !imgErrors.has(detailItem.code + "-detail") && (
                <div className="w-full flex justify-center">
                  <img
                    src={detailItem.image_url}
                    alt={detailItem.name}
                    className="h-40 w-40 rounded-xl object-cover border border-border shadow-sm"
                    onError={() => setImgErrors(prev => new Set(prev).add(detailItem.code + "-detail"))}
                  />
                </div>
              )}
              {detailItem.description && (
                <p className="text-sm text-muted-foreground">{detailItem.description}</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.category}</p><p className="font-semibold">{detailItem.category}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Stock</p><p className="font-semibold">{detailItem.stock_quantity ?? 0}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.sellingPrice}</p><p className="font-semibold">{detailItem.sellingPrice} {t.currency}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.storeCost}</p><p className="font-semibold">{detailItem.storeCost > 0 ? `${detailItem.storeCost} ${t.currency}` : "—"}</p></div>
                {detailItem.manufacturer && <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.manufacturer}</p><p className="font-semibold">{detailItem.manufacturer}</p></div>}
                {detailItem.barcode && detailItem.barcode !== "1E+12" && <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Barcode</p><p className="font-semibold font-mono text-xs">{detailItem.barcode}</p></div>}
              </div>
              {/* Variants */}
              {detailItem.variants && detailItem.variants.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Variants</p>
                  {detailItem.variants.map((v: any, i: number) => (
                    <div key={i} className="p-2 rounded-lg bg-muted/30 text-xs">
                      <span className="font-medium">{v.name?.replace("()", "")}: </span>
                      {v.options?.map((o: any, j: number) => (
                        <Badge key={j} variant="outline" className="ms-1 text-xs">{o.value}</Badge>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">{t.unit}</Label><Input className="h-9 mt-1" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t.sellingPrice} *</Label><Input className="h-9 mt-1" type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} /></div>
              <div><Label className="text-xs">{t.storeCost}</Label><Input className="h-9 mt-1" type="number" value={form.storeCost} onChange={(e) => setForm({ ...form, storeCost: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">{t.manufacturer}</Label><Input className="h-9 mt-1" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div>
            <Button className="w-full" onClick={handleAdd}>{t.addMaterial}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
