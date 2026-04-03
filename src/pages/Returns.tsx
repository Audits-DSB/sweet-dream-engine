import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  RotateCcw, Package, Truck, Search, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Clock, AlertTriangle, ExternalLink,
  Warehouse, ArrowRight, DollarSign, Loader2, TrendingDown, BarChart3
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
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(highlightId);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRecord | null>(null);
  const [disposition, setDisposition] = useState<string>("");
  const [refundStatus, setRefundStatus] = useState<string>("none");
  const [itemConditions, setItemConditions] = useState<Record<number, string>>({});
  const [processing, setProcessing] = useState(false);

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

  const openAcceptDialog = (ret: ReturnRecord) => {
    setSelectedReturn(ret);
    setDisposition("");
    setRefundStatus("none");
    const conditions: Record<number, string> = {};
    ret.items.forEach((_, i) => { conditions[i] = "good"; });
    setItemConditions(conditions);
    setAcceptDialogOpen(true);
  };

  const handleAccept = async () => {
    if (!selectedReturn || !disposition) return;
    setProcessing(true);
    try {
      const updatedItems = selectedReturn.items.map((item, i) => ({
        ...item,
        condition: disposition === "company_inventory" ? (itemConditions[i] || "good") : "good",
      }));
      await api.patch(`/returns/${selectedReturn.id}`, { items: updatedItems });

      await api.post(`/returns/${selectedReturn.id}/accept`, {
        disposition,
        refundStatus: disposition === "return_to_supplier" ? refundStatus : "none",
      });
      setAcceptDialogOpen(false);
      await loadReturns();
    } catch (e: any) {
      alert(e.message || "خطأ");
    }
    setProcessing(false);
  };

  const handleReject = async (ret: ReturnRecord) => {
    if (!confirm("هل أنت متأكد من رفض هذا المرتجع؟")) return;
    try {
      await api.post(`/returns/${ret.id}/reject`, { notes: "مرفوض" });
      await loadReturns();
    } catch (e: any) { alert(e.message || "خطأ"); }
  };

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
              <div key={ret.id} className={`border rounded-lg transition-colors ${expandedId === ret.id ? "border-primary/30 bg-primary/5" : "border-border hover:border-primary/20"}`}>
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === ret.id ? null : ret.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{ret.id}</span>
                      {statusBadge(ret.status)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm">
                      <span className="font-medium">{ret.clientName}</span>
                      <span className="text-muted-foreground">•</span>
                      <button className="text-primary hover:underline text-xs" onClick={e => { e.stopPropagation(); navigate(`/orders/${ret.orderId}`); }}>
                        {ret.orderId}
                      </button>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{ret.returnDate}</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-destructive">-{fmtNum(Number(ret.totalValue))} {t.currency}</p>
                    <p className="text-xs text-muted-foreground">{ret.items?.length || 0} صنف</p>
                  </div>
                  {expandedId === ret.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>

                {expandedId === ret.id && (
                  <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div><span className="text-muted-foreground">سبب الإرجاع</span><br /><span className="font-medium">{reasonLabel(ret.reason)}</span></div>
                      <div><span className="text-muted-foreground">المصير</span><br />{dispositionLabel(ret.disposition)}</div>
                      <div><span className="text-muted-foreground">استرداد الأموال</span><br />{refundLabel(ret.refundStatus)}</div>
                      <div><span className="text-muted-foreground">التكلفة</span><br /><span className="font-medium">{fmtNum(Number(ret.totalCost))} {t.currency}</span></div>
                    </div>

                    {ret.notes && (
                      <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2">{ret.notes}</p>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/50 text-muted-foreground">
                            <th className="py-1.5 px-2 text-right">الصنف</th>
                            <th className="py-1.5 px-2 text-center">الكمية</th>
                            <th className="py-1.5 px-2 text-center">سعر البيع</th>
                            <th className="py-1.5 px-2 text-center">التكلفة</th>
                            <th className="py-1.5 px-2 text-center">الإجمالي</th>
                            {ret.disposition === "company_inventory" && <th className="py-1.5 px-2 text-center">الحالة</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {(ret.items || []).map((item, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1.5 px-2">
                                <div className="flex items-center gap-2">
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.materialName} className="w-8 h-8 rounded object-cover shrink-0 border" />
                                  ) : (
                                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0 border">
                                      <Package className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-medium">{item.materialName}</span>
                                    <span className="text-muted-foreground mr-1">({item.materialCode})</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-1.5 px-2 text-center">{item.quantity} {item.unit}</td>
                              <td className="py-1.5 px-2 text-center">{fmtNum(Number(item.sellingPrice))}</td>
                              <td className="py-1.5 px-2 text-center">{fmtNum(Number(item.costPrice))}</td>
                              <td className="py-1.5 px-2 text-center font-medium">{fmtNum(Number(item.sellingPrice) * Number(item.quantity))}</td>
                              {ret.disposition === "company_inventory" && (
                                <td className="py-1.5 px-2 text-center">
                                  {item.condition === "damaged"
                                    ? <span className="text-red-600">تالف</span>
                                    : <span className="text-green-600">صالح</span>}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {ret.status === "pending" && (
                      <div className="flex items-center gap-2 pt-2">
                        <Button size="sm" className="gap-1.5" onClick={() => openAcceptDialog(ret)}>
                          <CheckCircle className="h-3.5 w-3.5" />
                          قبول المرتجع
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => handleReject(ret)}>
                          <XCircle className="h-3.5 w-3.5" />
                          رفض
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button className="text-primary hover:underline flex items-center gap-1 text-xs" onClick={() => navigate(`/orders/${ret.orderId}`)}>
                        <ExternalLink className="h-3 w-3" /> فتح الأوردر
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              قبول المرتجع
            </DialogTitle>
          </DialogHeader>

          {selectedReturn && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3 text-sm">
                <p><strong>العميل:</strong> {selectedReturn.clientName}</p>
                <p><strong>الأوردر:</strong> {selectedReturn.orderId}</p>
                <p><strong>القيمة:</strong> {fmtNum(Number(selectedReturn.totalValue))} {t.currency}</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">مصير البضاعة المرتجعة</label>
                <Select value={disposition} onValueChange={setDisposition}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company_inventory">
                      <span className="flex items-center gap-2"><Warehouse className="h-4 w-4" />نقل لمخزون الشركة</span>
                    </SelectItem>
                    <SelectItem value="return_to_supplier">
                      <span className="flex items-center gap-2"><Truck className="h-4 w-4" />إعادة للمورد</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {disposition === "company_inventory" && (
                <div>
                  <label className="text-sm font-medium mb-2 block">حالة كل صنف</label>
                  <div className="space-y-2">
                    {selectedReturn.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted/20 rounded p-2">
                        <div className="flex items-center gap-2">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.materialName} className="w-7 h-7 rounded object-cover shrink-0 border" />
                          ) : (
                            <div className="w-7 h-7 rounded bg-muted flex items-center justify-center shrink-0 border">
                              <Package className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-sm">{item.materialName} ({item.quantity})</span>
                        </div>
                        <Select value={itemConditions[i] || "good"} onValueChange={v => setItemConditions(prev => ({ ...prev, [i]: v }))}>
                          <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="good">صالح</SelectItem>
                            <SelectItem value="damaged">تالف</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {disposition === "return_to_supplier" && (
                <div>
                  <label className="text-sm font-medium mb-2 block">حالة استرداد الأموال</label>
                  <Select value={refundStatus} onValueChange={setRefundStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="refunded">تم استرداد الأموال</SelectItem>
                      <SelectItem value="pending_refund">بانتظار الاسترداد</SelectItem>
                      <SelectItem value="none">لم يتم الاسترداد</SelectItem>
                    </SelectContent>
                  </Select>
                  {refundStatus === "refunded" && (
                    <div className="mt-2 bg-green-50 border border-green-200 rounded p-2 text-xs text-green-700">
                      <DollarSign className="h-3.5 w-3.5 inline ml-1" />
                      سيتم إرجاع تكلفة المواد ({fmtNum(Number(selectedReturn.totalCost))} {t.currency}) للمؤسسين حسب نسبة مساهمتهم
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAcceptDialogOpen(false)} disabled={processing}>إلغاء</Button>
            <Button onClick={handleAccept} disabled={!disposition || processing}>
              {processing && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              تأكيد القبول
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
