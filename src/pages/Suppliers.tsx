import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Globe, Mail, Phone, ExternalLink, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { suppliersList as initialSuppliers } from "@/data/store";
import { supabase } from "@/integrations/supabase/client";

type RealMaterial = {
  code: string;
  name: string;
  category: string;
  sellingPrice: number;
  storeCost: number;
  supplier: string;
  manufacturer: string;
};

export default function SuppliersPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<typeof initialSuppliers[0] | null>(null);
  const [form, setForm] = useState({ name: "", country: "", email: "", phone: "", website: "", paymentTerms: "Net 30" });
  const [realMaterials, setRealMaterials] = useState<RealMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);

  useEffect(() => {
    const fetchMaterials = async () => {
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
          setRealMaterials(json.products.map((p: any) => {
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
      } catch (err) {
        console.error("Failed to fetch materials:", err);
      }
      setMaterialsLoading(false);
    };
    fetchMaterials();
  }, []);

  const filtered = suppliers.filter((s) => {
    return !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.country.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase());
  });

  const getMaterialsForSupplier = (supplierName: string) => {
    return realMaterials.filter(m => 
      m.supplier.toLowerCase().includes(supplierName.toLowerCase()) || 
      m.manufacturer.toLowerCase().includes(supplierName.toLowerCase()) ||
      supplierName.toLowerCase().includes(m.supplier.toLowerCase())
    );
  };

  const handleAdd = () => {
    if (!form.name) { toast.error(t.enterSupplierName); return; }
    const num = suppliers.length + 1;
    const newId = `SUP-${String(num).padStart(3, "0")}`;
    setSuppliers([...suppliers, { ...form, id: newId, active: true }]);
    setForm({ name: "", country: "", email: "", phone: "", website: "", paymentTerms: "Net 30" });
    setDialogOpen(false);
    toast.success(t.supplierAdded);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.suppliersTitle}</h1>
        <p className="page-description">{suppliers.length} {t.supplier} · {suppliers.filter(s => s.active).length} {t.active}</p>
      </div>

      <DataToolbar
        searchPlaceholder={t.searchSuppliers}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[]}
        filterValues={{}}
        onFilterChange={() => {}}
        onExport={() => exportToCsv("suppliers", [t.code, t.name, t.country, t.email, t.phone, t.website, t.paymentTerms], filtered.map(s => [s.id, s.name, s.country, s.email, s.phone, s.website, s.paymentTerms]))}
        actions={<Button size="sm" className="h-9" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.addSupplier}</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" />{sup.country}</p>
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
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" />{mats.length} {t.materialsCount}</span>
                <span className="text-xs text-muted-foreground">{sup.paymentTerms}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detailItem?.name} — {t.supplierDetails}</DialogTitle></DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.country}</p><p className="font-semibold">{detailItem.country}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.paymentTerms}</p><p className="font-semibold">{detailItem.paymentTerms}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.email}</p><p className="font-semibold text-xs">{detailItem.email}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.phone}</p><p className="font-semibold">{detailItem.phone}</p></div>
              </div>
              {detailItem.website && (
                <a href={`https://${detailItem.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" />{detailItem.website}
                </a>
              )}
              <div>
                <h4 className="text-sm font-semibold mb-2">{t.suppliedMaterials}</h4>
                {getMaterialsForSupplier(detailItem.name).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.noMaterials}</p>
                ) : (
                  <div className="space-y-1.5">
                    {getMaterialsForSupplier(detailItem.name).map(m => (
                      <div key={m.code} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => { setDetailItem(null); navigate("/materials"); }}>
                        <div>
                          <span className="text-sm font-medium">{m.name}</span>
                          <span className="text-xs text-muted-foreground ltr:ml-2 rtl:mr-2">{m.code}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{m.sellingPrice} {t.currency}</div>
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
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t.website}</Label><Input className="h-9 mt-1" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
              <div><Label className="text-xs">{t.paymentTerms}</Label><Input className="h-9 mt-1" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} /></div>
            </div>
            <Button className="w-full" onClick={handleAdd}>{t.addSupplier}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
