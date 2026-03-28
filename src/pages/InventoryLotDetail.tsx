import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Package, Warehouse, Calendar, Hash, DollarSign, Loader2, ExternalLink, TrendingUp, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

type LotDetail = {
  id: string;
  materialCode: string;
  materialName: string;
  unit: string;
  lotNumber: string;
  quantity: number;
  remaining: number;
  costPrice: number;
  sourceOrder: string;
  dateAdded: string;
  status: string;
};

export default function InventoryLotDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isArabic } = useLanguage();
  const [lot, setLot] = useState<LotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    Promise.all([
      api.get<LotDetail>(`/company-inventory/${encodeURIComponent(id)}`),
      api.get<{ products: any[] }>("/external-materials").catch(() => ({ products: [] })),
    ]).then(([lotData, extData]) => {
      setLot(lotData);
      const products = extData?.products || [];
      const match = products.find((p: any) => p.sku === lotData.materialCode);
      if (match) {
        const img = match.image_url || match.image || "";
        if (img.startsWith("http")) setImageUrl(img);
      }
    }).catch(() => {
      setLot(null);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="p-8 text-center">
        <Warehouse className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">لم يتم العثور على هذه الدُفعة</h2>
        <p className="text-muted-foreground mb-4">قد تكون الدُفعة محذوفة أو الرابط غير صحيح</p>
        <Button variant="outline" onClick={() => navigate("/company-inventory")}>
          <ArrowLeft className="h-4 w-4 me-2" />
          العودة للمخزون
        </Button>
      </div>
    );
  }

  const usedQty = lot.quantity - lot.remaining;
  const usagePct = lot.quantity > 0 ? Math.round((usedQty / lot.quantity) * 100) : 0;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5 rotate-180" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{lot.materialName}</h1>
          <p className="text-sm text-muted-foreground font-mono">{lot.materialCode}</p>
        </div>
        <StatusBadge status={lot.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={lot.materialName}
                className="w-40 h-40 object-contain rounded-lg border border-border mb-3"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="w-40 h-40 rounded-lg border border-border bg-muted/30 flex items-center justify-center mb-3">
                <Package className="h-16 w-16 text-muted-foreground" />
              </div>
            )}
            <div className="text-center">
              <div className="font-bold text-lg">{lot.materialName}</div>
              <div className="text-sm text-muted-foreground font-mono">{lot.materialCode}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardContent className="p-6 space-y-4">
            <h2 className="font-bold text-lg border-b pb-2">تفاصيل الدُفعة</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <Hash className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">رقم الدُفعة</div>
                  <div className="font-mono text-sm font-medium">{lot.lotNumber || lot.id}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                  <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">الوحدة</div>
                  <div className="font-medium text-sm">{lot.unit}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">الكمية الأصلية</div>
                  <div className="font-bold text-lg">{lot.quantity}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <Warehouse className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">المتبقي</div>
                  <div className="font-bold text-lg">{lot.remaining}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                  <DollarSign className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">سعر الشراء (الوحدة)</div>
                  <div className="font-bold text-lg">{lot.costPrice.toLocaleString()} ج.م</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center shrink-0">
                  <DollarSign className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">القيمة الإجمالية</div>
                  <div className="font-bold text-lg">{(lot.costPrice * lot.quantity).toLocaleString()} ج.م</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">تاريخ الإضافة</div>
                  <div className="font-medium text-sm">{lot.dateAdded ? new Date(lot.dateAdded).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }) : "—"}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                  <ExternalLink className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">أوردر المصدر</div>
                  <Link to={`/orders/${lot.sourceOrder}`} className="font-mono text-sm font-medium text-primary hover:underline">
                    {lot.sourceOrder}
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            الاستهلاك
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usagePct >= 80 ? "bg-red-500" : usagePct >= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>
            <div className="text-sm font-medium shrink-0 w-28 text-start">
              {usedQty} / {lot.quantity} مستخدم
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {usagePct}% مستهلك · {lot.remaining} متبقي
          </div>
        </CardContent>
      </Card>
    </div>
  );
}