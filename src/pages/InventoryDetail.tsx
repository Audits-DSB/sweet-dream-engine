import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Package, User, FileText, Calendar, AlertTriangle, Download } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { toast } from "sonner";

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

export default function InventoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const lot = mockInventory.find(l => l.id === id);
  if (!lot) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/inventory")}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="page-header">{t.noResults}</h1>
        </div>
      </div>
    );
  }

  const daysToExpiry = lot.expiry ? Math.ceil((new Date(lot.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const isNearExpiry = daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 30;
  const consumed = lot.delivered - lot.remaining;
  const consumptionPercent = lot.delivered > 0 ? ((consumed / lot.delivered) * 100).toFixed(1) : "0";
  const inventoryValue = lot.remaining * lot.sellingPrice;
  const costValue = lot.remaining * lot.storeCost;

  // Find related lots (same client)
  const relatedLots = mockInventory.filter(l => l.clientId === lot.clientId && l.id !== lot.id);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/inventory")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-header">{lot.id}</h1>
            <StatusBadge status={lot.status} />
          </div>
          <p className="page-description">{lot.material} — {lot.code}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => exportToCsv(`batch_${lot.id}`, [t.batchNumber, t.client, t.material, t.code, t.unit, t.deliveredQty, t.remainingQty, t.sellingPrice, t.storeCost, t.deliveryDate, t.expiryDate, t.sourceOrder, t.status], [[lot.id, lot.client, lot.material, lot.code, lot.unit, lot.delivered, lot.remaining, lot.sellingPrice, lot.storeCost, lot.deliveryDate, lot.expiry, lot.sourceOrder, lot.status]])}>
          <Download className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.export}
        </Button>
      </div>

      {/* Warning banners */}
      {isNearExpiry && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-warning/10 text-warning text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t.expiringIn30} — {daysToExpiry} {t.daysRemaining}
        </div>
      )}
      {lot.status === "Expired" && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t.expired}
        </div>
      )}

      {/* Key info grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/20" onClick={() => navigate(`/clients/${lot.clientId}`)}>
          <div className="flex items-center gap-2 mb-2"><User className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">{t.client}</span></div>
          <p className="font-semibold text-primary">{lot.client}</p>
        </div>
        <div className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/20" onClick={() => navigate(`/orders/${lot.sourceOrder}`)}>
          <div className="flex items-center gap-2 mb-2"><FileText className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">{t.sourceOrder}</span></div>
          <p className="font-semibold text-primary">{lot.sourceOrder}</p>
        </div>
        <div className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/20" onClick={() => navigate("/materials")}>
          <div className="flex items-center gap-2 mb-2"><Package className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">{t.material}</span></div>
          <p className="font-semibold text-primary">{lot.material}</p>
          <p className="text-xs text-muted-foreground">{lot.code}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2"><Calendar className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">{t.deliveryDate}</span></div>
          <p className="font-semibold">{lot.deliveryDate}</p>
        </div>
      </div>

      {/* Quantities & Financials */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="stat-card space-y-4">
          <h3 className="font-semibold text-sm">{t.quantity}</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t.deliveredQty}</span><span className="font-medium">{lot.delivered} {lot.unit}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t.remainingQty}</span><span className="font-semibold">{lot.remaining} {lot.unit}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t.quantityUsed}</span><span className="font-medium">{consumed} {lot.unit}</span></div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{t.quantityUsed}</span>
                <span className="font-medium">{consumptionPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${consumptionPercent}%` }} />
              </div>
            </div>
          </div>
        </div>
        <div className="stat-card space-y-4">
          <h3 className="font-semibold text-sm">{t.financials}</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t.sellingPrice}</span><span className="font-medium">{lot.sellingPrice} {t.currency}/{lot.unit}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t.storeCost}</span><span className="font-medium">{lot.storeCost} {t.currency}/{lot.unit}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t.margin}</span><span className="font-medium text-success">{((1 - lot.storeCost / lot.sellingPrice) * 100).toFixed(1)}%</span></div>
            <div className="border-t border-border pt-2 flex justify-between font-semibold"><span>{t.inventoryValue}</span><span>{inventoryValue.toLocaleString()} {t.currency}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{t.totalCost}</span><span>{costValue.toLocaleString()} {t.currency}</span></div>
          </div>
        </div>
      </div>

      {/* Expiry */}
      <div className="stat-card">
        <h3 className="font-semibold text-sm mb-3">{t.expiryDate}</h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">{t.expiryDate}</p>
            <p className={`font-semibold ${isNearExpiry ? "text-warning" : lot.status === "Expired" ? "text-destructive" : ""}`}>{lot.expiry}</p>
          </div>
          {daysToExpiry !== null && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">{t.daysRemaining}</p>
              <p className={`font-semibold ${daysToExpiry <= 0 ? "text-destructive" : daysToExpiry <= 30 ? "text-warning" : "text-success"}`}>
                {daysToExpiry <= 0 ? t.expired : `${daysToExpiry} ${t.daysRemaining}`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Related lots from same client */}
      {relatedLots.length > 0 && (
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-3">{t.inventoryTab} — {lot.client}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.batchNumber}</th>
                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>
                  <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.remainingQty}</th>
                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.expiryDate}</th>
                  <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {relatedLots.map(rl => (
                  <tr key={rl.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/inventory/${rl.id}`)}>
                    <td className="py-2 px-3 font-mono text-xs text-primary">{rl.id}</td>
                    <td className="py-2 px-3">{rl.material}</td>
                    <td className="py-2 px-3 text-end font-medium">{rl.remaining} {rl.unit}</td>
                    <td className="py-2 px-3 text-muted-foreground text-xs">{rl.expiry}</td>
                    <td className="py-2 px-3"><StatusBadge status={rl.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
