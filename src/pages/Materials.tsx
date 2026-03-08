import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const initialMaterials = [
  { code: "MAT-001", name: "حشو كمبوزيت ضوئي", category: "حشوات", unit: "عبوة", sellingPrice: 1200, storeCost: 800, supplier: "3M ESPE", hasExpiry: true, active: true },
  { code: "MAT-002", name: "إبر تخدير", category: "تخدير", unit: "علبة", sellingPrice: 950, storeCost: 600, supplier: "Septodont", hasExpiry: true, active: true },
  { code: "MAT-003", name: "مادة طبع سيليكون", category: "طبعات", unit: "عبوة", sellingPrice: 450, storeCost: 280, supplier: "Zhermack", hasExpiry: true, active: true },
  { code: "MAT-004", name: "جلاس أيونومر", category: "حشوات", unit: "عبوة", sellingPrice: 850, storeCost: 550, supplier: "GC Corporation", hasExpiry: true, active: true },
  { code: "MAT-005", name: "قفازات لاتكس", category: "مستهلكات", unit: "كرتونة", sellingPrice: 400, storeCost: 280, supplier: "Supermax", hasExpiry: true, active: true },
  { code: "MAT-006", name: "بوند لاصق", category: "حشوات", unit: "زجاجة", sellingPrice: 1800, storeCost: 1200, supplier: "Kerr Dental", hasExpiry: true, active: true },
  { code: "MAT-007", name: "خيط خياطة جراحي", category: "جراحة", unit: "علبة", sellingPrice: 2200, storeCost: 1500, supplier: "Ethicon", hasExpiry: true, active: true },
  { code: "MAT-008", name: "مبيض أسنان", category: "تجميل", unit: "عبوة", sellingPrice: 2800, storeCost: 1800, supplier: "Opalescence", hasExpiry: true, active: true },
  { code: "MAT-009", name: "سلك تقويم", category: "تقويم", unit: "عبوة", sellingPrice: 3500, storeCost: 2400, supplier: "Ormco", hasExpiry: false, active: true },
  { code: "MAT-010", name: "فرز دوارة", category: "أدوات", unit: "عبوة", sellingPrice: 2000, storeCost: 1300, supplier: "Mani", hasExpiry: false, active: true },
  { code: "MAT-011", name: "مادة ضوئية UV", category: "حشوات", unit: "عبوة", sellingPrice: 4200, storeCost: 2900, supplier: "Ivoclar", hasExpiry: true, active: true },
  { code: "MAT-012", name: "مادة تلميع", category: "تجميل", unit: "عبوة", sellingPrice: 1500, storeCost: 950, supplier: "Shofu", hasExpiry: true, active: false },
];

const emptyMaterial = { name: "", category: "حشوات", unit: "عبوة", sellingPrice: "", storeCost: "", supplier: "", hasExpiry: true, active: true };

export default function MaterialsPage() {
  const [materials, setMaterials] = useState(initialMaterials);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyMaterial);

  const categories = [...new Set(materials.map(m => m.category))];

  const filtered = materials.filter((m) => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.code.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filters.category || filters.category === "all" || m.category === filters.category;
    return matchSearch && matchCategory;
  });

  const handleAdd = () => {
    if (!form.name || !form.sellingPrice) {
      toast.error("يرجى إدخال اسم المادة وسعر البيع");
      return;
    }
    const num = materials.length + 1;
    const newCode = `MAT-${String(num).padStart(3, "0")}`;
    setMaterials([...materials, { ...form, code: newCode, sellingPrice: Number(form.sellingPrice), storeCost: Number(form.storeCost) }]);
    setForm(emptyMaterial);
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
        filters={[
          { label: "التصنيف", value: "category", options: categories.map(c => ({ label: c, value: c })) },
        ]}
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
                <tr key={mat.code} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
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
