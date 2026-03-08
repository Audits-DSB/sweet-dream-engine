import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { materialsList as initialMaterialsData } from "@/data/store";

export default function MaterialsPage() {
  const [materials, setMaterials] = useState(initialMaterialsData);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<typeof initialMaterialsData[0] | null>(null);
  const [form, setForm] = useState({ name: "", category: "حشوات", unit: "عبوة", sellingPrice: "", storeCost: "", supplier: "", hasExpiry: true, active: true });

  const categories = [...new Set(materials.map(m => m.category))];

  const filtered = materials.filter((m) => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.code.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filters.category || filters.category === "all" || m.category === filters.category;
    return matchSearch && matchCategory;
  });

  const handleAdd = () => {
    if (!form.name || !form.sellingPrice) { toast.error("يرجى إدخال اسم المادة وسعر البيع"); return; }
    const num = materials.length + 1;
    const newCode = `MAT-${String(num).padStart(3, "0")}`;
    setMaterials([...materials, { ...form, code: newCode, sellingPrice: Number(form.sellingPrice), storeCost: Number(form.storeCost) }]);
    setForm({ name: "", category: "حشوات", unit: "عبوة", sellingPrice: "", storeCost: "", supplier: "", hasExpiry: true, active: true });
    setDialogOpen(false);
    toast.success("تم إضافة المادة بنجاح");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">المواد والمستلزمات</h1>
        <p className="page-description">{materials.length} مادة · {materials.filter(m => m.active).length} نشطة</p>
      </div>

      <DataToolbar
        searchPlaceholder="بحث في المواد..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[{ label: "التصنيف", value: "category", options: categories.map(c => ({ label: c, value: c })) }]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("materials", ["الكود","الاسم","التصنيف","الوحدة","سعر البيع","التكلفة","الهامش %","المورد","صلاحية","نشط"], filtered.map(m => [m.code, m.name, m.category, m.unit, m.sellingPrice, m.storeCost, ((m.sellingPrice - m.storeCost) / m.sellingPrice * 100).toFixed(1), m.supplier, m.hasExpiry ? "نعم" : "لا", m.active ? "نشط" : "غير نشط"]))}
        actions={<Button size="sm" className="h-9" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />إضافة مادة</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">الكود</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">المادة</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">التصنيف</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">الوحدة</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">سعر البيع</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">التكلفة</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">الهامش</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">المورد</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">صلاحية</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((mat) => {
              const margin = ((mat.sellingPrice - mat.storeCost) / mat.sellingPrice * 100).toFixed(1);
              return (
                <tr key={mat.code} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetailItem(mat)}>
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{mat.code}</td>
                  <td className="py-3 px-3 font-medium">{mat.name}</td>
                  <td className="py-3 px-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{mat.category}</span></td>
                  <td className="py-3 px-3 text-muted-foreground">{mat.unit}</td>
                  <td className="py-3 px-3 text-right font-medium">{mat.sellingPrice} ج.م</td>
                  <td className="py-3 px-3 text-right text-muted-foreground">{mat.storeCost} ج.م</td>
                  <td className="py-3 px-3 text-right"><span className="text-success font-medium">{margin}%</span></td>
                  <td className="py-3 px-3 text-muted-foreground">{mat.supplier}</td>
                  <td className="py-3 px-3">{mat.hasExpiry ? <Badge variant="secondary" className="text-xs">متتبع</Badge> : <span className="text-xs text-muted-foreground">لا ينطبق</span>}</td>
                  <td className="py-3 px-3">
                    <Badge variant={mat.active ? "default" : "secondary"} className={mat.active ? "bg-success/10 text-success border-0" : ""}>
                      {mat.active ? "نشط" : "غير نشط"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{detailItem?.code} — {detailItem?.name}</DialogTitle></DialogHeader>
          {detailItem && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">التصنيف</p><p className="font-semibold">{detailItem.category}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">الوحدة</p><p className="font-semibold">{detailItem.unit}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">سعر البيع</p><p className="font-semibold">{detailItem.sellingPrice} ج.م</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">التكلفة</p><p className="font-semibold">{detailItem.storeCost} ج.م</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">المورد</p><p className="font-semibold">{detailItem.supplier}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">الهامش</p><p className="font-semibold text-success">{((detailItem.sellingPrice - detailItem.storeCost) / detailItem.sellingPrice * 100).toFixed(1)}%</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>إضافة مادة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">اسم المادة *</Label><Input className="h-9 mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">التصنيف</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["حشوات","تخدير","طبعات","مستهلكات","جراحة","تجميل","تقويم","أدوات"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">الوحدة</Label><Input className="h-9 mt-1" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">سعر البيع *</Label><Input className="h-9 mt-1" type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} /></div>
              <div><Label className="text-xs">التكلفة</Label><Input className="h-9 mt-1" type="number" value={form.storeCost} onChange={(e) => setForm({ ...form, storeCost: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">المورد</Label><Input className="h-9 mt-1" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">تتبع الصلاحية</Label>
              <Switch checked={form.hasExpiry} onCheckedChange={(v) => setForm({ ...form, hasExpiry: v })} />
            </div>
            <Button className="w-full" onClick={handleAdd}>إضافة المادة</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
