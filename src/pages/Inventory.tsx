import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const mockInventory = [
  { id: "LOT-001", client: "عيادة د. أحمد", clientId: "C001", material: "حشو كمبوزيت ضوئي", code: "MAT-001", unit: "عبوة", delivered: 50, remaining: 45, sellingPrice: 1200, storeCost: 800, deliveryDate: "2025-02-20", expiry: "2025-06-15", sourceOrder: "ORD-042", status: "In Stock" },
  { id: "LOT-002", client: "عيادة د. أحمد", clientId: "C001", material: "إبر تخدير", code: "MAT-002", unit: "علبة", delivered: 20, remaining: 8, sellingPrice: 950, storeCost: 600, deliveryDate: "2025-02-20", expiry: "2025-04-20", sourceOrder: "ORD-042", status: "Low Stock" },
  { id: "LOT-003", client: "عيادة د. أحمد", clientId: "C001", material: "مادة طبع سيليكون", code: "MAT-003", unit: "عبوة", delivered: 40, remaining: 30, sellingPrice: 450, storeCost: 280, deliveryDate: "2025-01-15", expiry: "2025-12-01", sourceOrder: "ORD-038", status: "In Stock" },
  { id: "LOT-004", client: "عيادة د. أحمد", clientId: "C001", material: "قفازات لاتكس", code: "MAT-005", unit: "كرتونة", delivered: 10, remaining: 2, sellingPrice: 400, storeCost: 280, deliveryDate: "2025-01-15", expiry: "2025-03-25", sourceOrder: "ORD-038", status: "Low Stock" },
  { id: "LOT-005", client: "مركز نور لطب الأسنان", clientId: "C002", material: "حشو كمبوزيت ضوئي", code: "MAT-001", unit: "عبوة", delivered: 80, remaining: 65, sellingPrice: 1200, storeCost: 800, deliveryDate: "2025-03-01", expiry: "2025-07-20", sourceOrder: "ORD-045", status: "In Stock" },
  { id: "LOT-006", client: "مركز نور لطب الأسنان", clientId: "C002", material: "مبيض أسنان", code: "MAT-008", unit: "عبوة", delivered: 5, remaining: 0.5, sellingPrice: 2800, storeCost: 1800, deliveryDate: "2025-02-10", expiry: "2025-04-01", sourceOrder: "ORD-040", status: "Low Stock" },
  { id: "LOT-007", client: "عيادة جرين فالي", clientId: "C003", material: "إبر تخدير", code: "MAT-002", unit: "علبة", delivered: 30, remaining: 22, sellingPrice: 950, storeCost: 600, deliveryDate: "2025-02-25", expiry: "2025-05-30", sourceOrder: "ORD-043", status: "In Stock" },
  { id: "LOT-008", client: "المركز الملكي للأسنان", clientId: "C004", material: "حشو كمبوزيت ضوئي", code: "MAT-001", unit: "عبوة", delivered: 100, remaining: 0, sellingPrice: 1200, storeCost: 800, deliveryDate: "2024-12-15", expiry: "2025-03-10", sourceOrder: "ORD-035", status: "Depleted" },
  { id: "LOT-009", client: "المركز الملكي للأسنان", clientId: "C004", material: "فرز دوارة", code: "MAT-010", unit: "عبوة", delivered: 5, remaining: 4, sellingPrice: 2000, storeCost: 1300, deliveryDate: "2025-03-01", expiry: "2026-01-01", sourceOrder: "ORD-045", status: "In Stock" },
  { id: "LOT-010", client: "عيادة بلو مون", clientId: "C006", material: "قفازات لاتكس", code: "MAT-005", unit: "كرتونة", delivered: 15, remaining: 12, sellingPrice: 400, storeCost: 280, deliveryDate: "2025-03-03", expiry: "2025-09-15", sourceOrder: "ORD-044", status: "In Stock" },
  { id: "LOT-011", client: "مركز سبايس جاردن", clientId: "C007", material: "مادة تلميع", code: "MAT-012", unit: "عبوة", delivered: 8, remaining: 0, sellingPrice: 1500, storeCost: 950, deliveryDate: "2025-01-10", expiry: "2025-03-01", sourceOrder: "ORD-036", status: "Expired" },
];

export default function InventoryPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [detailItem, setDetailItem] = useState<typeof mockInventory[0] | null>(null);

  const clients = [...new Set(mockInventory.map(i => i.client))];

  const filtered = mockInventory.filter((i) => {
    const matchSearch = !search || i.material.toLowerCase().includes(search.toLowerCase()) || i.client.toLowerCase().includes(search.toLowerCase()) || i.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || i.status === filters.status;
    const matchClient = !filters.client || filters.client === "all" || i.client === filters.client;
    return matchSearch && matchStatus && matchClient;
  });

  const lowStockCount = mockInventory.filter(i => i.status === "Low Stock").length;
  const expiredCount = mockInventory.filter(i => i.status === "Expired").length;
  const nearExpiryCount = mockInventory.filter(i => {
    if (!i.expiry) return false;
    const days = (new Date(i.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days > 0 && days <= 30 && i.status !== "Depleted" && i.status !== "Expired";
  }).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.inventoryTitle}</h1>
        <p className="page-description">{mockInventory.length} {t.batchCount} {t.acrossClients} {clients.length} {t.clientsLabel}</p>
      </div>

      {(lowStockCount > 0 || expiredCount > 0 || nearExpiryCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {lowStockCount > 0 && <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning text-sm cursor-pointer" onClick={() => setFilters({ ...filters, status: "Low Stock" })}><AlertTriangle className="h-4 w-4" />{lowStockCount} {t.lowStockItems}</div>}
          {expiredCount > 0 && <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm cursor-pointer" onClick={() => setFilters({ ...filters, status: "Expired" })}><AlertTriangle className="h-4 w-4" />{expiredCount} {t.expiredItems}</div>}
          {nearExpiryCount > 0 && <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning text-sm"><AlertTriangle className="h-4 w-4" />{nearExpiryCount} {t.expiringIn30}</div>}
        </div>
      )}

      <DataToolbar
        searchPlaceholder={t.searchInventory}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: t.status, value: "status", options: [
            { label: t.inStock, value: "In Stock" }, { label: t.lowStock, value: "Low Stock" },
            { label: t.depleted, value: "Depleted" }, { label: t.expired, value: "Expired" },
          ]},
          { label: t.client, value: "client", options: clients.map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("inventory", [t.batchNumber, t.client, t.material, t.code, t.unit, t.deliveredQty, t.remainingQty, t.sellingPrice, t.storeCost, t.deliveryDate, t.expiryDate, t.sourceOrder, t.status], filtered.map(i => [i.id, i.client, i.material, i.code, i.unit, i.delivered, i.remaining, i.sellingPrice, i.storeCost, i.deliveryDate, i.expiry, i.sourceOrder, i.status]))}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.batchNumber}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.deliveredQty}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.remainingQty}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.unit}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.deliveryDate}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.expiryDate}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.sourceOrder}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lot) => {
              const daysToExpiry = lot.expiry ? Math.ceil((new Date(lot.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
              const isNearExpiry = daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 30;
              return (
                <tr key={lot.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/inventory/${lot.id}`)}>
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{lot.id}</td>
                  <td className="py-3 px-3 font-medium hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${lot.clientId}`); }}>{lot.client}</td>
                  <td className="py-3 px-3 hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate("/materials"); }}>{lot.material}</td>
                  <td className="py-3 px-3 text-end">{lot.delivered}</td>
                  <td className="py-3 px-3 text-end font-medium">{lot.remaining}</td>
                  <td className="py-3 px-3 text-muted-foreground">{lot.unit}</td>
                  <td className="py-3 px-3 text-muted-foreground text-xs">{lot.deliveryDate}</td>
                  <td className="py-3 px-3 text-xs">
                    <span className={isNearExpiry ? "text-warning font-medium" : "text-muted-foreground"}>
                      {lot.expiry}{isNearExpiry && ` (${daysToExpiry} ${t.daysRemaining})`}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground hover:text-primary cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/orders/${lot.sourceOrder}`); }}>{lot.sourceOrder}</td>
                  <td className="py-3 px-3"><StatusBadge status={lot.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">{t.noResults}</div>}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detailItem?.id} — {detailItem?.material}</DialogTitle></DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70" onClick={() => { setDetailItem(null); navigate(`/clients/${detailItem.clientId}`); }}><p className="text-xs text-muted-foreground">{t.client}</p><p className="font-semibold text-primary">{detailItem.client}</p></div>
                <div className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70" onClick={() => { setDetailItem(null); navigate(`/orders/${detailItem.sourceOrder}`); }}><p className="text-xs text-muted-foreground">{t.sourceOrder}</p><p className="font-semibold text-primary">{detailItem.sourceOrder}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.deliveredQty}</p><p className="font-semibold">{detailItem.delivered} {detailItem.unit}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.remainingQty}</p><p className="font-semibold">{detailItem.remaining} {detailItem.unit}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.sellingPrice}</p><p className="font-semibold">{detailItem.sellingPrice} {t.currency}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.storeCost}</p><p className="font-semibold">{detailItem.storeCost} {t.currency}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.deliveryDate}</p><p className="font-semibold">{detailItem.deliveryDate}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t.expiryDate}</p><p className="font-semibold">{detailItem.expiry}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t.status}:</span>
                <StatusBadge status={detailItem.status} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
