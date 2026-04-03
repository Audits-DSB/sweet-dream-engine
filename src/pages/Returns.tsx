import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatCard } from "@/components/StatCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RotateCcw, Package, Truck, Search, ChevronDown,
  CheckCircle, XCircle, Clock,
  Warehouse, DollarSign, Loader2, TrendingDown, BarChart3
} from "lucide-react";
import { api } from "@/lib/api";

type ReturnItem = {
  materialCode: string;
  materialName: string;
  quantity: number;
  sellingPrice: number;
  costPrice: number;
  unit: string;
  condition: "good" | "damaged";
  imageUrl?: string;
};

type ReturnRecord = {
  id: string;
  orderId: string;
  clientId: string;
  clientName: string;
  returnDate: string;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  totalValue: number;
  totalCost: number;
  disposition: string;
  refundStatus: string;
  refundAmount: number;
  items: ReturnItem[];
  notes: string;
  processedBy: string;
  createdAt: string;
};

const fmtNum = (n: number) => Math.round(n).toLocaleString("en-US");

export default function ReturnsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const loadReturns = async () => {
    setLoading(true);
    try {
      const data = await api.get<ReturnRecord[]>("/returns");
      setReturns(data);
    } catch { setReturns([]); }
    setLoading(false);
  };

  useEffect(() => { loadReturns(); }, []);

  const filtered = useMemo(() => {
    let list = returns;
    if (filterStatus !== "all") list = list.filter(r => r.status === filterStatus);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(r =>
        r.clientName.toLowerCase().includes(s) ||
        r.orderId.toLowerCase().includes(s) ||
        r.id.toLowerCase().includes(s) ||
        r.reason.toLowerCase().includes(s)
      );
    }
    return list;
  }, [returns, filterStatus, searchTerm]);

  const stats = useMemo(() => {
    const total = returns.length;
    const pending = returns.filter(r => r.status === "pending").length;
    const accepted = returns.filter(r => r.status === "accepted").length;
    const totalValue = returns.filter(r => r.status === "accepted").reduce((s, r) => s + Number(r.totalValue || 0), 0);
    const toInventory = returns.filter(r => r.disposition === "company_inventory").length;
    const toSupplier = returns.filter(r => r.disposition === "return_to_supplier").length;
    return { total, pending, accepted, totalValue, toInventory, toSupplier };
  }, [returns]);

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1"><Clock className="h-3 w-3" />قيد المراجعة</span>;
      case "accepted": return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="h-3 w-3" />مقبول</span>;
      case "rejected": return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1"><XCircle className="h-3 w-3" />مرفوض</span>;
      default: return null;
    }
  };

  const dispositionLabel = (d: string) => {
    switch (d) {
      case "company_inventory": return <span className="text-blue-600 flex items-center gap-1"><Warehouse className="h-3 w-3" />نُقل لمخزون الشركة</span>;
      case "return_to_supplier": return <span className="text-orange-600 flex items-center gap-1"><Truck className="h-3 w-3" />أُعيد للمورد</span>;
      default: return <span className="text-muted-foreground">—</span>;
    }
  };

  const refundLabel = (s: string) => {
    switch (s) {
      case "refunded": return <span className="text-green-600">تم استرداد الأموال</span>;
      case "pending_refund": return <span className="text-amber-600">بانتظار الاسترداد</span>;
      case "none": return <span className="text-muted-foreground">—</span>;
      default: return <span className="text-muted-foreground">—</span>;
    }
  };

  const reasonLabel = (r: string) => {
    const map: Record<string, string> = {
      "defective": "عيب تصنيع",
      "wrong_item": "خطأ في الطلب",
      "expired": "انتهاء صلاحية",
      "excess": "كمية زائدة",
      "other": "أخرى",
    };
    return map[r] || r;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-primary" />
            المرتجعات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة مرتجعات الأوردرات المُسلَّمة</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="إجمالي المرتجعات" value={stats.total.toString()} icon={RotateCcw} />
        <StatCard title="قيد المراجعة" value={stats.pending.toString()} icon={Clock} changeType={stats.pending > 0 ? "negative" : "neutral"} />
        <StatCard title="مقبولة" value={stats.accepted.toString()} icon={CheckCircle} changeType="positive" />
        <StatCard title="قيمة المرتجعات" value={`${fmtNum(stats.totalValue)} ${t.currency}`} icon={TrendingDown} changeType="negative" />
        <StatCard title="نُقل للمخزون" value={stats.toInventory.toString()} icon={Warehouse} />
        <StatCard title="أُعيد للمورد" value={stats.toSupplier.toString()} icon={Truck} />
      </div>

      <div className="stat-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            سجل المرتجعات
          </h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                className="w-full h-8 pr-8 pl-3 text-xs border border-border rounded-md bg-background"
                placeholder="بحث..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="pending">قيد المراجعة</SelectItem>
                <SelectItem value="accepted">مقبول</SelectItem>
                <SelectItem value="rejected">مرفوض</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <RotateCcw className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">لا توجد مرتجعات</p>
            <p className="text-xs mt-1">يمكنك إنشاء مرتجع من صفحة تفاصيل الأوردر</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(ret => (
              <div
                key={ret.id}
                className="border rounded-lg transition-colors border-border hover:border-primary/30 hover:bg-primary/5 cursor-pointer"
                onClick={() => navigate(`/returns/${ret.id}`)}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    ret.status === "accepted" ? "bg-green-100 dark:bg-green-900/30" :
                    ret.status === "rejected" ? "bg-red-100 dark:bg-red-900/30" :
                    "bg-amber-100 dark:bg-amber-900/30"
                  }`}>
                    <RotateCcw className={`h-4 w-4 ${
                      ret.status === "accepted" ? "text-green-600" :
                      ret.status === "rejected" ? "text-red-600" :
                      "text-amber-600"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold">RET-{ret.id.slice(0, 8).toUpperCase()}</span>
                      {statusBadge(ret.status)}
                      {ret.status === "accepted" && ret.disposition === "return_to_supplier" && ret.refundStatus === "pending_refund" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                          <DollarSign className="h-2.5 w-2.5" />بانتظار الاسترداد
                        </span>
                      )}
                      {ret.refundStatus === "refunded" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 flex items-center gap-1">
                          <DollarSign className="h-2.5 w-2.5" />تم الاسترداد
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm">
                      <span className="font-medium">{ret.clientName}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{ret.orderId}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{ret.returnDate}</span>
                      {ret.disposition && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          {dispositionLabel(ret.disposition)}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-sm font-semibold text-destructive">-{fmtNum(Number(ret.totalValue))} {t.currency}</p>
                    <p className="text-xs text-muted-foreground">{ret.items?.length || 0} صنف</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
