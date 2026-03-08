import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const mockMaterials = [
  { code: "MAT-001", name: "Arabica Coffee Beans", category: "Coffee", unit: "kg", sellingPrice: 120, storeCost: 80, supplier: "Bean Masters", hasExpiry: true, active: true },
  { code: "MAT-002", name: "Green Tea Leaves", category: "Tea", unit: "kg", sellingPrice: 95, storeCost: 60, supplier: "Tea Traders", hasExpiry: true, active: true },
  { code: "MAT-003", name: "Sugar Syrup", category: "Sweeteners", unit: "L", sellingPrice: 45, storeCost: 28, supplier: "Sweet Co.", hasExpiry: true, active: true },
  { code: "MAT-004", name: "Robusta Coffee Beans", category: "Coffee", unit: "kg", sellingPrice: 85, storeCost: 55, supplier: "Bean Masters", hasExpiry: true, active: true },
  { code: "MAT-005", name: "Milk Powder", category: "Dairy", unit: "kg", sellingPrice: 40, storeCost: 28, supplier: "Dairy Plus", hasExpiry: true, active: true },
  { code: "MAT-006", name: "Cocoa Powder", category: "Chocolate", unit: "kg", sellingPrice: 180, storeCost: 120, supplier: "Choco World", hasExpiry: true, active: true },
  { code: "MAT-007", name: "Honey", category: "Sweeteners", unit: "L", sellingPrice: 220, storeCost: 150, supplier: "Honey Farm", hasExpiry: true, active: true },
  { code: "MAT-008", name: "Vanilla Extract", category: "Flavoring", unit: "L", sellingPrice: 280, storeCost: 180, supplier: "Flavor Co.", hasExpiry: true, active: true },
  { code: "MAT-009", name: "Cardamom Pods", category: "Spices", unit: "kg", sellingPrice: 350, storeCost: 240, supplier: "Spice Land", hasExpiry: false, active: true },
  { code: "MAT-010", name: "Cinnamon Sticks", category: "Spices", unit: "kg", sellingPrice: 200, storeCost: 130, supplier: "Spice Land", hasExpiry: false, active: true },
  { code: "MAT-011", name: "Matcha Powder", category: "Tea", unit: "kg", sellingPrice: 420, storeCost: 290, supplier: "Tea Traders", hasExpiry: true, active: true },
  { code: "MAT-012", name: "Turmeric Powder", category: "Spices", unit: "kg", sellingPrice: 150, storeCost: 95, supplier: "Spice Land", hasExpiry: true, active: false },
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
        <h1 className="page-header">Materials</h1>
        <p className="page-description">{mockMaterials.length} materials from external database · {mockMaterials.filter(m => m.active).length} active</p>
      </div>

      <DataToolbar
        searchPlaceholder="Search materials..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "Category", value: "category", options: categories.map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => {}}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Code</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Material</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Category</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Unit</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Selling Price</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Store Cost</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Margin</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Supplier</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Expiry</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
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
                  <td className="py-3 px-3 text-right font-medium">SAR {mat.sellingPrice}</td>
                  <td className="py-3 px-3 text-right text-muted-foreground">SAR {mat.storeCost}</td>
                  <td className="py-3 px-3 text-right"><span className="text-success font-medium">{margin}%</span></td>
                  <td className="py-3 px-3 text-muted-foreground">{mat.supplier}</td>
                  <td className="py-3 px-3">{mat.hasExpiry ? <Badge variant="secondary" className="text-xs">Tracked</Badge> : <span className="text-xs text-muted-foreground">N/A</span>}</td>
                  <td className="py-3 px-3">
                    <Badge variant={mat.active ? "default" : "secondary"} className={mat.active ? "bg-success/10 text-success border-0" : ""}>
                      {mat.active ? "Active" : "Inactive"}
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
