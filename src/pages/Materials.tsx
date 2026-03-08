import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const mockMaterials = [
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

export default function MaterialsPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const categories = [...new Set(mockMaterials.map(m => m.category))];

  const filtered = mockMaterials.filter((m) => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.code.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filters.category || filters.category === "all" || m.category === filters.category;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">المواد والمستلزمات</h1>
        <p className="page-description">{mockMaterials.length} مادة · {mockMaterials.filter(m => m.active).length} نشطة</p>
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
    </div>
  );
}
