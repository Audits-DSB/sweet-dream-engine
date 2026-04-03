import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  RotateCcw, Package, Truck, CheckCircle, XCircle, Clock,
  ExternalLink, Warehouse, DollarSign, Loader2, ArrowRight,
  Calendar, User, FileText, Hash, AlertTriangle, ChevronRight,
  BadgeCheck, ShieldAlert, CircleDollarSign
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

export default function ReturnDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [ret, setRet] = useState<ReturnRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [disposition, setDisposition] = useState<string>("");
  const [refundStatus, setRefundStatus] = useState<string>("none");
  const [itemConditions, setItemConditions] = useState<Record<number, string>>({});

  const [confirmRefundOpen, setConfirmRefundOpen] = useState(false);
  const [refundProcessing, setRefundProcessing] = useState(false);

  const loadReturn = async () => {
    setLoading(true);
    try {
      const data = await api.get<ReturnRecord>(`/returns/${id}`);
      setRet(data);
    } catch {
      setRet(null);
    }
    setLoading(false);
  };

  useEffect(() => { loadReturn(); }, [id]);

  const handleAccept = async () => {
    if (!ret || !disposition) return;
    setProcessing(true);
    try {
      const updatedItems = ret.items.map((item, i) => ({
        ...item,
        condition: disposition === "company_inventory" ? (itemConditions[i] || "good") : "good",
      }));
      await api.patch(`/returns/${ret.id}`, { items: updatedItems });
      await api.post(`/returns/${ret.id}/accept`, {
        disposition,
        refundStatus: disposition === "return_to_supplier" ? refundStatus : "none",
      });
      setAcceptDialogOpen(false);
      toast.success("تم قبول المرتجع بنجاح");
      await loadReturn();
    } catch (e: any) {
      toast.error(e.message || "خطأ في قبول المرتجع");
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!ret) return;
    if (!confirm("هل أنت متأكد من رفض هذا المرتجع؟")) return;
    try {
      await api.post(`/returns/${ret.id}/reject`, { notes: "مرفوض" });
      toast.success("تم رفض المرتجع");
      await loadReturn();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  };

  const handleConfirmRefund = async () => {
    if (!ret) return;
    setRefundProcessing(true);
    try {
      const result = await api.post<any>(`/returns/${ret.id}/confirm-refund`, {});
      setConfirmRefundOpen(false);
      toast.success("تم تأكيد استرداد الأموال بنجاح");
      if (result.founderRefunds && result.founderRefunds.length > 0) {
        const names = result.founderRefunds.map((r: any) => `${r.founderName}: ${fmtNum(r.amount)} ${t.currency}`).join("، ");
        toast.info(`تم إرجاع التكلفة للمؤسسين: ${names}`, { duration: 6000 });
      }
      await loadReturn();
    } catch (e: any) {
      toast.error(e.message || "خطأ في تأكيد الاسترداد");
    }
    setRefundProcessing(false);
  };

  const reasonLabels: Record<string, string> = {
    defective: "عيب تصنيع", wrong_item: "خطأ في الطلب",
    expired: "انتهاء صلاحية", excess: "كمية زائدة",
    client_request: "طلب العميل", other: "أخرى",
  };

  const dispositionLabels: Record<string, string> = {
    company_inventory: "نُقل لمخزون الشركة", return_to_supplier: "أُعيد للمورد",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!ret) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <p className="text-lg font-medium">لم يتم العثور على المرتجع</p>
        <Button variant="outline" onClick={() => navigate("/returns")}>العودة للمرتجعات</Button>
      </div>
    );
  }

  const returnNumber = `RET-${ret.id.slice(0, 8).toUpperCase()}`;
  const totalItems = (ret.items || []).reduce((s, it) => s + it.quantity, 0);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/returns" className="hover:text-primary transition-colors">المرتجعات</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{returnNumber}</span>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              ret.status === "accepted" ? "bg-green-100 dark:bg-green-900/30" :
              ret.status === "rejected" ? "bg-red-100 dark:bg-red-900/30" :
              "bg-amber-100 dark:bg-amber-900/30"
            }`}>
              <RotateCcw className={`h-5 w-5 ${
                ret.status === "accepted" ? "text-green-600" :
                ret.status === "rejected" ? "text-red-600" :
                "text-amber-600"
              }`} />
            </div>
            {returnNumber}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{ret.returnDate}</span>
            <span>•</span>
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{ret.clientName}</span>
            <span>•</span>
            <span>{totalItems} صنف</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {ret.status === "pending" && (
            <>
              <Button size="sm" className="gap-1.5" onClick={() => {
                setDisposition("");
                setRefundStatus("none");
                const conditions: Record<number, string> = {};
                ret.items.forEach((_, i) => { conditions[i] = "good"; });
                setItemConditions(conditions);
                setAcceptDialogOpen(true);
              }}>
                <CheckCircle className="h-4 w-4" />
                قبول
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={handleReject}>
                <XCircle className="h-4 w-4" />
                رفض
              </Button>
            </>
          )}
          {ret.status === "accepted" && ret.disposition === "return_to_supplier" && ret.refundStatus === "pending_refund" && (
            <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => setConfirmRefundOpen(true)}>
              <CircleDollarSign className="h-4 w-4" />
              تأكيد استرداد الأموال
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            {ret.status === "accepted" ? <BadgeCheck className="h-3.5 w-3.5 text-green-600" /> :
             ret.status === "rejected" ? <ShieldAlert className="h-3.5 w-3.5 text-red-600" /> :
             <Clock className="h-3.5 w-3.5 text-amber-600" />}
            الحالة
          </div>
          <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
            ret.status === "accepted" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
            ret.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
            "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          }`}>
            {ret.status === "accepted" ? "مقبول" : ret.status === "rejected" ? "مرفوض" : "قيد المراجعة"}
          </span>
        </div>

        <div className="stat-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <DollarSign className="h-3.5 w-3.5 text-red-500" />
            قيمة المرتجع (بيع)
          </div>
          <p className="text-lg font-bold text-red-600">-{fmtNum(Number(ret.totalValue))}</p>
          <p className="text-[10px] text-muted-foreground">{t.currency}</p>
        </div>

        <div className="stat-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Package className="h-3.5 w-3.5 text-blue-500" />
            التكلفة (شراء)
          </div>
          <p className="text-lg font-bold text-blue-600">{fmtNum(Number(ret.totalCost))}</p>
          <p className="text-[10px] text-muted-foreground">{t.currency}</p>
        </div>

        <div className="stat-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Hash className="h-3.5 w-3.5" />
            الأوردر
          </div>
          <Link to={`/orders/${ret.orderId}`} className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
            {ret.orderId}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <div className="stat-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            تفاصيل المرتجع
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">سبب الإرجاع</p>
              <p className="font-medium">{reasonLabels[ret.reason] || ret.reason}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">المصير</p>
              {ret.disposition ? (
                <p className="font-medium flex items-center gap-1.5">
                  {ret.disposition === "company_inventory" ? <Warehouse className="h-3.5 w-3.5 text-blue-600" /> : <Truck className="h-3.5 w-3.5 text-orange-600" />}
                  {dispositionLabels[ret.disposition] || ret.disposition}
                </p>
              ) : <p className="text-muted-foreground">—</p>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">استرداد الأموال</p>
              {ret.disposition === "return_to_supplier" ? (
                <p className={`font-medium ${ret.refundStatus === "refunded" ? "text-green-600" : ret.refundStatus === "pending_refund" ? "text-amber-600" : "text-muted-foreground"}`}>
                  {ret.refundStatus === "refunded" ? "✅ تم الاسترداد" :
                   ret.refundStatus === "pending_refund" ? "⏳ بانتظار الاسترداد" : "—"}
                </p>
              ) : <p className="text-muted-foreground">—</p>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">مبلغ الاسترداد</p>
              {Number(ret.refundAmount || 0) > 0 ? (
                <p className="font-bold text-green-600">{fmtNum(Number(ret.refundAmount))} {t.currency}</p>
              ) : <p className="text-muted-foreground">—</p>}
            </div>
          </div>

          {ret.notes && (
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
              <p className="text-sm">{ret.notes}</p>
            </div>
          )}

          {ret.status === "accepted" && ret.disposition === "return_to_supplier" && ret.refundStatus === "pending_refund" && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">بانتظار استرداد الأموال من المورد</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  المبلغ المتوقع: {fmtNum(Number(ret.totalCost))} {t.currency} (سعر الشراء)
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  بعد التأكيد سيتم إرجاع المبلغ للمؤسسين حسب نسبة مساهمتهم
                </p>
                <Button size="sm" className="mt-3 gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => setConfirmRefundOpen(true)}>
                  <CircleDollarSign className="h-3.5 w-3.5" />
                  تأكيد استلام الأموال من المورد
                </Button>
              </div>
            </div>
          )}

          {ret.status === "accepted" && ret.refundStatus === "refunded" && Number(ret.refundAmount || 0) > 0 && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">تم استرداد الأموال بنجاح</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  المبلغ المسترد: {fmtNum(Number(ret.refundAmount))} {t.currency} — تم توزيعه على المؤسسين
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="stat-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            الأصناف المرتجعة ({ret.items?.length || 0})
          </h2>
        </div>
        <div className="divide-y divide-border/50">
          {(ret.items || []).map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.materialName} className="w-14 h-14 rounded-lg border object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 border">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.materialName}</p>
                <p className="text-xs text-muted-foreground">{item.materialCode} · {item.unit || "قطعة"}</p>
                {ret.disposition === "company_inventory" && item.condition && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block ${
                    item.condition === "damaged" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  }`}>{item.condition === "damaged" ? "تالف" : "صالح"}</span>
                )}
              </div>
              <div className="text-center shrink-0">
                <p className="text-lg font-bold text-red-600">×{item.quantity}</p>
                <p className="text-[10px] text-muted-foreground">{item.unit || "قطعة"}</p>
              </div>
              <div className="text-end shrink-0 space-y-0.5">
                <p className="text-sm">
                  <span className="text-muted-foreground text-xs">بيع: </span>
                  <span className="font-medium">{fmtNum(Number(item.sellingPrice))}</span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground text-xs">شراء: </span>
                  <span className="font-medium">{fmtNum(Number(item.costPrice))}</span>
                </p>
                <p className="text-xs font-bold text-red-600 border-t border-border/50 pt-0.5">
                  {fmtNum(Number(item.sellingPrice) * Number(item.quantity))} {t.currency}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">الإجمالي</span>
          <div className="text-end">
            <p className="font-bold text-red-600">-{fmtNum(Number(ret.totalValue))} {t.currency}</p>
            <p className="text-xs text-muted-foreground">تكلفة: {fmtNum(Number(ret.totalCost))} {t.currency}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate("/returns")} className="gap-1.5">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة للمرتجعات
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate(`/orders/${ret.orderId}`)} className="gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" />
          فتح الأوردر
        </Button>
      </div>

      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              قبول المرتجع
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-3 text-sm">
              <p><strong>العميل:</strong> {ret.clientName}</p>
              <p><strong>الأوردر:</strong> {ret.orderId}</p>
              <p><strong>القيمة:</strong> {fmtNum(Number(ret.totalValue))} {t.currency}</p>
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
                  {ret.items.map((item, i) => (
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
                    سيتم إرجاع تكلفة الشراء ({fmtNum(Number(ret.totalCost))} {t.currency}) للمؤسسين حسب نسبة مساهمتهم
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAcceptDialogOpen(false)} disabled={processing}>إلغاء</Button>
            <Button onClick={handleAccept} disabled={!disposition || processing}>
              {processing && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              تأكيد القبول
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmRefundOpen} onOpenChange={setConfirmRefundOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-green-600" />
              تأكيد استرداد الأموال
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                هل تم استلام أموال المرتجع من المورد؟
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                المبلغ: <span className="font-bold">{fmtNum(Number(ret.totalCost))} {t.currency}</span> (سعر الشراء)
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                سيتم تقسيم هذا المبلغ على المؤسسين حسب نسبة مساهمتهم في الأوردر
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmRefundOpen(false)} disabled={refundProcessing}>إلغاء</Button>
            <Button className="bg-green-600 hover:bg-green-700 gap-1.5" onClick={handleConfirmRefund} disabled={refundProcessing}>
              {refundProcessing && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              <CheckCircle className="h-4 w-4" />
              تأكيد الاستلام
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
