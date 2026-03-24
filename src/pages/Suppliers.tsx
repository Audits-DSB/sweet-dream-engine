import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Globe, Mail, Phone, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";

type Supplier = {
  id: string;
  name: string;
  country: string;
  email: string;
  phone: string;
  paymentTerms: string;
  active: boolean;
};

type ExtMaterial = {
  code: string;
  name: string;
  category: string;
  sellingPrice: number;
  storeCost: number;
  supplier: string;
  manufacturer: string;
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
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: "", country: "", email: "", phone: "", paymentTerms: "Net 30" });
  const [extMaterials, setExtMaterials] = useState<ExtMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  useEffect(() => {
    loadSuppliers();
    loadExtMaterials();
  }, []);

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

  const loadExtMaterials = async () => {
    setMaterialsLoading(true);
    try {
      const json = await api.get<{ products: any[] }>("/external-materials");
      if (json?.products && Array.isArray(json.products)) {
        setExtMaterials(json.products.map((p: any) => {
          const companyVariant = p.variants?.find((v: any) => v.name === "Company" || v.name === "Company()");
          const manufacturer = companyVariant?.options?.[0]?.value || "";
          return {
            code: p.sku || p.id?.slice(0, 8) || "",
            name: p.name,
            category: p.category || "General",
            sellingPrice: p.price_retail || 0,
            storeCost: p.price_wholesale || 0,
            supplier: manufacturer,
            manufacturer,
          };
        }));
      }
    } catch (_) {}
    setMaterialsLoading(false);
  };

  const filtered = suppliers.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.country.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase())
  );

  const getMaterialsForSupplier = (supplierName: string) =>
    extMaterials.filter(m =>
      m.supplier.toLowerCase().includes(supplierName.toLowerCase()) ||
      m.manufacturer.toLowerCase().includes(supplierName.toLowerCase()) ||
      supplierName.toLowerCase().includes(m.supplier.toLowerCase())
    );

  const handleAdd = async () => {
    if (!form.name) { toast.error(t.enterSupplierName); return; }
    const num = suppliers.length + 1;
    const newId = `SUP-${String(num).padStart(3, "0")}`;
    try {
      const saved = await api.post<any>("/suppliers", { ...form, id: newId, active: true });
      setSuppliers(prev => [...prev, normalizeSupplier(saved)]);
      setForm({ name: "", country: "", email: "", phone: "", paymentTerms: "Net 30" });
      setDialogOpen(false);
      toast.success(t.supplierAdded);
    } catch {
      toast.error(t.failedToAddSupplier);
    }
  };

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
            const mats = getMaterialsForSupplier(sup.name);
            return (
              <div key={sup.id} className="stat-card space-y-3 cursor-pointer" onClick={() => setDetailItem(sup)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{sup.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{sup.name}</p>
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
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {materialsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : mats.length}
                    {" "}{t.materialsCount}
                  </span>
                  <span className="text-xs text-muted-foreground">{sup.paymentTerms}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detailItem?.name} — {t.supplierDetails}</DialogTitle></DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.country}</p><p className="font-semibold">{detailItem.country || "—"}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.paymentTerms}</p><p className="font-semibold">{detailItem.paymentTerms}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.email}</p><p className="font-semibold text-xs">{detailItem.email || "—"}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.phone}</p><p className="font-semibold">{detailItem.phone || "—"}</p></div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">{t.suppliedMaterials}</h4>
                {materialsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.loadingMaterials}
                  </div>
                ) : getMaterialsForSupplier(detailItem.name).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.noMaterials}</p>
                ) : (
                  <div className="space-y-1.5">
                    {getMaterialsForSupplier(detailItem.name).map(m => (
                      <div key={m.code} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => { setDetailItem(null); navigate("/materials"); }}>
                        <div>
                          <span className="text-sm font-medium">{m.name}</span>
                          <span className="text-xs text-muted-foreground ltr:ml-2 rtl:mr-2">{m.code}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{m.sellingPrice.toLocaleString()} {t.currency}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
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
            <Button className="w-full" onClick={handleAdd}>{t.addSupplier}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
