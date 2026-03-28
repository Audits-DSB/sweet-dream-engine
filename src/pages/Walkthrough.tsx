import { useState } from "react";
import {
  LayoutDashboard, Users, FileText, Boxes, Factory, ShoppingCart, Truck,
  Warehouse, ClipboardCheck, Package, Receipt, Vault, UserCog, Building2,
  Landmark, FileBarChart, Bell, BarChart3, Settings, PlayCircle,
  ArrowRight, ArrowLeft, CheckCircle, Eye, RefreshCw, History,
  TrendingUp, DollarSign, Shield, MousePointerClick
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useWorkflow } from "@/contexts/WorkflowContext";

function StepCard({ icon: Icon, title, desc, color }: { icon: any; title: string; desc: string; color: string }) {
  return (
    <div className={`${color} p-3 rounded-lg`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4" />
        <span className="font-medium text-sm">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-lg text-xs">
      <MousePointerClick className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

export default function Walkthrough() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { requests, orders, deliveries, collections, refreshData } = useWorkflow();
  const [currentStep, setCurrentStep] = useState(0);

  const workflowSteps = [
    {
      id: 0,
      title: "مرحباً بك في DSB",
      subtitle: "دليل شامل لاستخدام النظام من البداية للنهاية",
      icon: PlayCircle,
      color: "text-primary",
      bgColor: "bg-primary/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            نظام DSB هو نظام متكامل لإدارة عمليات الشركة من استقبال الطلبات والتعامل مع الموردين، وصولاً لإدارة المخزون والتحصيل والتقارير المالية. النظام مقسّم لأربعة أقسام رئيسية:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StepCard icon={ShoppingCart} title="العمليات الأساسية" desc="العملاء، الطلبات، المواد، الموردين، الأوردرات، التوصيل" color="bg-blue-500/10" />
            <StepCard icon={Warehouse} title="المخزون والجرد" desc="مخزون الشركة، جرد العملاء، التدقيق، تخطيط إعادة التعبئة" color="bg-green-500/10" />
            <StepCard icon={DollarSign} title="المالية" desc="التحصيل، الخزينة، المؤسسين، أرباح الشركة، التقارير المالية" color="bg-orange-500/10" />
            <StepCard icon={Settings} title="النظام" desc="التنبيهات، التقارير، سجل الأنشطة، إدارة المستخدمين، الإعدادات" color="bg-purple-500/10" />
          </div>
          <Tip text="اضغط 'التالي' عشان تتعرف على كل قسم بالتفصيل. كل خطوة فيها زر يوديك للصفحة مباشرة." />
        </div>
      ),
      action: null,
      route: null,
    },
    {
      id: 1,
      title: "لوحة التحكم (Dashboard)",
      subtitle: "نظرة شاملة على أداء الشركة",
      icon: LayoutDashboard,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            الداشبورد هي أول صفحة تظهر عند الدخول. تعرض ملخص شامل لحالة الشركة:
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-2 bg-muted/50 rounded">
              <TrendingUp className="h-4 w-4 text-blue-500 mt-0.5" />
              <div>
                <span className="text-sm font-medium">كروت الإحصائيات</span>
                <p className="text-xs text-muted-foreground">عدد العملاء، الأوردرات، الإيرادات، التحصيل، الأرباح، التنبيهات</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 bg-muted/50 rounded">
              <BarChart3 className="h-4 w-4 text-green-500 mt-0.5" />
              <div>
                <span className="text-sm font-medium">الرسوم البيانية التفاعلية</span>
                <p className="text-xs text-muted-foreground">الأداء المالي الشهري، توزيع حالات الأوردرات، أداء التوصيلات، التحصيل الشهري</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 bg-muted/50 rounded">
              <Users className="h-4 w-4 text-orange-500 mt-0.5" />
              <div>
                <span className="text-sm font-medium">أعلى العملاء وآخر الأوردرات</span>
                <p className="text-xs text-muted-foreground">ترتيب العملاء حسب الإيرادات وآخر العمليات</p>
              </div>
            </div>
          </div>
          <Tip text="اضغط على أي شهر في الرسوم البيانية عشان تشوف تفاصيل الأوردرات والتوصيلات والتحصيلات لهذا الشهر." />
        </div>
      ),
      action: "فتح الداشبورد",
      route: "/",
    },
    {
      id: 2,
      title: "العملاء (Clients)",
      subtitle: "إدارة بيانات العملاء والتواصل معهم",
      icon: Users,
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            صفحة العملاء تعرض جميع العملاء المسجلين في النظام مع بياناتهم:
          </p>
          <div className="space-y-2">
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">إضافة عميل جديد:</span>
              <span className="text-muted-foreground"> اسم العميل، رقم الهاتف، البريد، العنوان</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">بروفايل العميل:</span>
              <span className="text-muted-foreground"> اضغط على أي عميل لرؤية كل أوردراته، توصيلاته، وتحصيلاته</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">البحث والفلترة:</span>
              <span className="text-muted-foreground"> ابحث بالاسم أو الهاتف أو الكود</span>
            </div>
          </div>
          <Tip text="كل عميل له صفحة بروفايل خاصة تعرض كل تاريخ تعاملاته مع الشركة." />
        </div>
      ),
      action: "فتح العملاء",
      route: "/clients",
    },
    {
      id: 3,
      title: "طلبات العملاء (Requests)",
      subtitle: "نقطة البداية — استقبال طلبات العملاء",
      icon: FileText,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            هنا تبدأ رحلة كل عملية تجارية. العملاء يرسلون طلباتهم لشراء المواد، ونقوم بمراجعتها وتقييم إمكانية تنفيذها.
          </p>
          <div className="space-y-2">
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">إنشاء طلب:</span>
              <span className="text-muted-foreground"> اختيار العميل وإضافة المواد المطلوبة والكميات</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">مراجعة الطلب:</span>
              <span className="text-muted-foreground"> قبول أو رفض الطلب، وتحويله لأوردر عند الموافقة</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">حالات الطلب:</span>
              <span className="text-muted-foreground"> جديد → قيد المراجعة → مقبول / مرفوض</span>
            </div>
          </div>
          {requests.length > 0 && (
            <div>
              <h4 className="font-medium text-xs text-muted-foreground mb-1">آخر الطلبات:</h4>
              {requests.slice(0, 2).map(req => (
                <div key={req.id} className="flex items-center justify-between p-2 bg-muted/30 rounded mb-1">
                  <span className="text-sm">{req.id} — {req.client}</span>
                  <Badge variant="secondary" className="text-[10px]">{req.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
      action: "فتح الطلبات",
      route: "/requests",
    },
    {
      id: 4,
      title: "المواد (Materials)",
      subtitle: "كتالوج المواد والمنتجات المتاحة",
      icon: Boxes,
      color: "text-teal-500",
      bgColor: "bg-teal-500/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            كتالوج شامل لجميع المواد المتاحة للبيع. يمكنك إضافة مواد جديدة أو الاستيراد من الكتالوج الخارجي.
          </p>
          <div className="space-y-2">
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">إضافة مادة:</span>
              <span className="text-muted-foreground"> كود المادة، الاسم، الوحدة، سعر البيع، سعر التكلفة، الصورة</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">الكتالوج الخارجي:</span>
              <span className="text-muted-foreground"> استيراد مواد من كتالوج يحتوي على أكثر من 300 منتج</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">ربط بالأوردرات:</span>
              <span className="text-muted-foreground"> المواد تظهر تلقائياً عند إنشاء أوردر جديد</span>
            </div>
          </div>
        </div>
      ),
      action: "فتح المواد",
      route: "/materials",
    },
    {
      id: 5,
      title: "الموردين (Suppliers)",
      subtitle: "إدارة الموردين ومواد كل مورد",
      icon: Factory,
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            إدارة الموردين اللي بنشتري منهم المواد. كل مورد ممكن يكون مسؤول عن مجموعة معينة من المواد.
          </p>
          <div className="space-y-2">
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">بيانات المورد:</span>
              <span className="text-muted-foreground"> الاسم، البلد، بيانات التواصل</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">مواد المورد:</span>
              <span className="text-muted-foreground"> ربط كل مورد بالمواد اللي بيوفرها</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">ربط بالأوردرات:</span>
              <span className="text-muted-foreground"> لما بتعمل أوردر مخزون، بتختار المورد اللي هتشتري منه</span>
            </div>
          </div>
        </div>
      ),
      action: "فتح الموردين",
      route: "/suppliers",
    },
    {
      id: 6,
      title: "الأوردرات (Orders)",
      subtitle: "قلب النظام — إنشاء وإدارة الأوردرات",
      icon: ShoppingCart,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            الأوردرات هي أهم جزء في النظام. فيه نوعين من الأوردرات:
          </p>
          <div className="space-y-2">
            <div className="p-2 bg-blue-500/10 rounded text-sm border border-blue-500/20">
              <span className="font-medium text-blue-600">أوردر عميل:</span>
              <span className="text-muted-foreground"> بيع مواد لعميل — يشمل سعر بيع وسعر تكلفة وهامش ربح</span>
            </div>
            <div className="p-2 bg-green-500/10 rounded text-sm border border-green-500/20">
              <span className="font-medium text-green-600">أوردر مخزون:</span>
              <span className="text-muted-foreground"> شراء مواد من مورد لتخزينها في مخزون الشركة</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">تمويل المؤسسين:</span>
              <span className="text-muted-foreground"> كل أوردر يتم تقسيم تكلفته على المؤسسين (بالتساوي أو بنسب)</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">استخدام المخزون:</span>
              <span className="text-muted-foreground"> ممكن تسحب مواد من مخزون الشركة بدل ما تشتري جديد</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">حالات الأوردر:</span>
              <span className="text-muted-foreground"> Processing → Delivered → Closed/Completed</span>
            </div>
          </div>
          {orders.length > 0 && (
            <div>
              <h4 className="font-medium text-xs text-muted-foreground mb-1">آخر الأوردرات:</h4>
              {orders.slice(0, 2).map(order => (
                <div key={order.id} className="flex items-center justify-between p-2 bg-muted/30 rounded mb-1">
                  <span className="text-sm">{order.id} — {order.client}</span>
                  <Badge variant="secondary" className="text-[10px]">{order.status}</Badge>
                </div>
              ))}
            </div>
          )}
          <Tip text="اضغط على أي أوردر لرؤية تفاصيله الكاملة: المواد، التكاليف، التوصيلات، وتوزيع المؤسسين." />
        </div>
      ),
      action: "فتح الأوردرات",
      route: "/orders",
    },
    {
      id: 7,
      title: "التوصيل (Deliveries)",
      subtitle: "إدارة توصيل المواد للعملاء",
      icon: Truck,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            بعد تجهيز الأوردر، يتم إنشاء عملية توصيل. التوصيل يقدر يكون كامل أو جزئي.
          </p>
          <div className="space-y-2">
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">إنشاء توصيلة:</span>
              <span className="text-muted-foreground"> تحديد الأوردر، تاريخ التوصيل، المسؤول عن التوصيل</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">توصيل جزئي:</span>
              <span className="text-muted-foreground"> ممكن تسلّم جزء من المواد وتكمّل باقي التوصيل لاحقاً</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">تأكيد التوصيل:</span>
              <span className="text-muted-foreground"> عند التأكيد يتم تحديث المخزون تلقائياً (جرد العميل أو مخزون الشركة)</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">رسوم التوصيل:</span>
              <span className="text-muted-foreground"> يتحملها العميل أو الشركة حسب اختيارك عند إنشاء الأوردر</span>
            </div>
          </div>
          {deliveries.length > 0 && (
            <div>
              <h4 className="font-medium text-xs text-muted-foreground mb-1">آخر التوصيلات:</h4>
              {deliveries.slice(0, 2).map(d => (
                <div key={d.id} className="flex items-center justify-between p-2 bg-muted/30 rounded mb-1">
                  <span className="text-sm">{d.id} — {d.client}</span>
                  <Badge variant="secondary" className="text-[10px]">{d.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
      action: "فتح التوصيل",
      route: "/deliveries",
    },
    {
      id: 8,
      title: "مخزون الشركة (Company Inventory)",
      subtitle: "إدارة المواد المخزنة في الشركة",
      icon: Boxes,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            مخزون الشركة يحتوي على المواد اللي اشتريتها من الموردين وخزنتها عندك. بتستخدمها لما تعمل أوردرات للعملاء.
          </p>
          <div className="space-y-2">
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">إضافة يدوية:</span>
              <span className="text-muted-foreground"> إضافة دفعة (lot) جديدة مباشرة</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">إضافة تلقائية:</span>
              <span className="text-muted-foreground"> لما بتعمل أوردر مخزون وتأكد التوصيل، المواد تضاف تلقائياً</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">حالات المخزون:</span>
              <span className="text-muted-foreground"> In Stock / Low Stock (أقل من 20%) / Depleted (نفد)</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">السحب من المخزون:</span>
              <span className="text-muted-foreground"> لما تعمل أوردر عميل، ممكن تسحب مواد من المخزون بدل الشراء</span>
            </div>
          </div>
          <Tip text="اضغط على أي دفعة لرؤية تفاصيلها: الكمية المتبقية، المورد، الأوردر المصدر." />
        </div>
      ),
      action: "فتح مخزون الشركة",
      route: "/company-inventory",
    },
    {
      id: 9,
      title: "جرد العملاء والتدقيق",
      subtitle: "متابعة المواد المسلّمة للعملاء",
      icon: Warehouse,
      color: "text-violet-500",
      bgColor: "bg-violet-500/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            النظام يتابع كل مادة اتسلّمت لكل عميل، ويتيح عمل جرد وتدقيق دوري.
          </p>
          <div className="grid grid-cols-1 gap-2">
            <StepCard icon={Warehouse} title="جرد العملاء" desc="عرض المواد المسلّمة لكل عميل مع الكميات المتبقية عنده. يتم تحديثه تلقائياً عند تأكيد التوصيل." color="bg-violet-500/10" />
            <StepCard icon={ClipboardCheck} title="التدقيق (Audits)" desc="إجراء جرد فعلي ومقارنته بالسجلات. تسجيل الفروقات والتعديلات." color="bg-pink-500/10" />
            <StepCard icon={Package} title="تخطيط إعادة التعبئة (Refill)" desc="تحديد المواد اللي محتاجة إعادة تعبئة عند العملاء وتخطيط التوصيلات القادمة." color="bg-sky-500/10" />
          </div>
        </div>
      ),
      action: "فتح جرد العملاء",
      route: "/inventory",
    },
    {
      id: 10,
      title: "التحصيل (Collections)",
      subtitle: "متابعة الفواتير وتحصيل المدفوعات",
      icon: Receipt,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            بعد التوصيل، يتم إصدار فواتير ومتابعة التحصيل من العملاء. النظام يتابع حالة كل فاتورة.
          </p>
          <div className="space-y-2">
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">إنشاء فاتورة:</span>
              <span className="text-muted-foreground"> مرتبطة بأوردر، المبلغ الكلي والمدفوع والمتبقي</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">تسجيل دفعة:</span>
              <span className="text-muted-foreground"> تسجيل مبالغ محصّلة (كاملة أو جزئية أو أقساط)</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">حالات التحصيل:</span>
              <span className="text-muted-foreground"> Paid (مكتمل) / Partially Paid (جزئي) / Overdue (متأخر) / Pending (معلق)</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">ربط بالخزينة:</span>
              <span className="text-muted-foreground"> المبالغ المحصّلة بتنزل تلقائياً في حسابات الخزينة</span>
            </div>
          </div>
          {collections.length > 0 && (
            <div>
              <h4 className="font-medium text-xs text-muted-foreground mb-1">آخر الفواتير:</h4>
              {collections.slice(0, 2).map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 bg-muted/30 rounded mb-1">
                  <span className="text-sm">{c.id} — {c.client}</span>
                  <Badge variant="secondary" className="text-[10px]">{c.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
      action: "فتح التحصيل",
      route: "/collections",
    },
    {
      id: 11,
      title: "الخزينة (Treasury)",
      subtitle: "إدارة حسابات الشركة والمعاملات المالية",
      icon: Vault,
      color: "text-yellow-600",
      bgColor: "bg-yellow-500/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            الخزينة هي القلب المالي للنظام. تتابع كل الحسابات البنكية والنقدية والمعاملات المالية.
          </p>
          <div className="space-y-2">
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">حسابات الخزينة:</span>
              <span className="text-muted-foreground"> إنشاء حسابات بنكية أو نقدية ومتابعة الأرصدة</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">المعاملات:</span>
              <span className="text-muted-foreground"> واردات (inflow)، مصروفات (expense)، تحويلات بين الحسابات (transfer)</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">معاملات المؤسسين:</span>
              <span className="text-muted-foreground"> مساهمات، سحوبات، تمويل أوردرات — كلها مسجلة في الخزينة</span>
            </div>
          </div>
        </div>
      ),
      action: "فتح الخزينة",
      route: "/treasury",
    },
    {
      id: 12,
      title: "المؤسسين وأرباح الشركة",
      subtitle: "إدارة المؤسسين، التمويل، والأرباح",
      icon: UserCog,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            النظام يتابع كل ما يخص المؤسسين: مساهماتهم، أرباحهم، وحصصهم من كل أوردر.
          </p>
          <div className="grid grid-cols-1 gap-2">
            <StepCard icon={UserCog} title="المؤسسين (Founders)" desc="إدارة بيانات المؤسسين — الاسم، البريد، الهاتف، إجمالي المساهمات والسحوبات" color="bg-purple-500/10" />
            <StepCard icon={Landmark} title="تمويل المؤسسين (Founder Funding)" desc="تسجيل مساهمات المؤسسين وسحوباتهم وتمويلهم للأوردرات" color="bg-blue-500/10" />
            <StepCard icon={Building2} title="أرباح الشركة (Company Profit)" desc="حساب الأرباح الصافية: الإيرادات - التكاليف - المصروفات. تقسيم الأرباح بين الشركة والمؤسسين" color="bg-green-500/10" />
          </div>
          <div className="p-3 bg-muted/30 rounded-lg text-sm">
            <p className="font-medium mb-1">كيف يتم تقسيم الأرباح؟</p>
            <p className="text-xs text-muted-foreground">
              الربح = سعر البيع - سعر التكلفة. يتم تقسيمه حسب النسب المحددة في الإعدادات بين حصة الشركة وحصة المؤسسين.
            </p>
          </div>
        </div>
      ),
      action: "فتح المؤسسين",
      route: "/founders",
    },
    {
      id: 13,
      title: "التقرير المالي (Financial Report)",
      subtitle: "تقارير مالية شاملة مع رسوم بيانية تفاعلية",
      icon: FileBarChart,
      color: "text-sky-500",
      bgColor: "bg-sky-500/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            التقرير المالي يجمع كل البيانات المالية في مكان واحد مع تحليلات متقدمة:
          </p>
          <div className="space-y-2">
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">تحليل الإيرادات والأرباح:</span>
              <span className="text-muted-foreground"> إيرادات مقابل تكلفة، هامش الربح، اتجاهات شهرية</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">التدفق النقدي:</span>
              <span className="text-muted-foreground"> الواردات مقابل المصروفات من حسابات الخزينة</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">تقسيم الأرباح:</span>
              <span className="text-muted-foreground"> حصة الشركة مقابل حصة المؤسسين شهرياً</span>
            </div>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="font-medium">أفضل العملاء:</span>
              <span className="text-muted-foreground"> ترتيب العملاء حسب الإيرادات والأرباح</span>
            </div>
          </div>
          <Tip text="اضغط على أي شهر في أي رسم بياني عشان تشوف تفاصيل كاملة لذلك الشهر." />
        </div>
      ),
      action: "فتح التقرير المالي",
      route: "/financial-report",
    },
    {
      id: 14,
      title: "النظام والإعدادات",
      subtitle: "التنبيهات، التقارير، الأنشطة، إدارة المستخدمين",
      icon: Shield,
      color: "text-gray-500",
      bgColor: "bg-gray-500/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            أدوات النظام اللي بتساعدك تتابع كل شيء وتدير الصلاحيات:
          </p>
          <div className="grid grid-cols-1 gap-2">
            <StepCard icon={Bell} title="التنبيهات (Alerts)" desc="إشعارات تلقائية: تحصيل متأخر، مخزون منخفض، أوردرات معلقة" color="bg-red-500/10" />
            <StepCard icon={BarChart3} title="التقارير (Reports)" desc="تقارير تفصيلية عن الأداء مع إمكانية التصدير" color="bg-blue-500/10" />
            <StepCard icon={History} title="سجل الأنشطة" desc="تتبع كل عملية تمت على النظام: إنشاء، تعديل، حذف" color="bg-indigo-500/10" />
            <StepCard icon={Users} title="إدارة المستخدمين" desc="إضافة مستخدمين جدد وتحديد صلاحياتهم" color="bg-purple-500/10" />
            <StepCard icon={Settings} title="الإعدادات" desc="إعدادات الشركة: نسب الأرباح، العملة، قواعد العمل" color="bg-gray-500/10" />
          </div>
        </div>
      ),
      action: "فتح التنبيهات",
      route: "/alerts",
    },
    {
      id: 15,
      title: "مسار العمل الكامل",
      subtitle: "ملخص دورة العمل من البداية للنهاية",
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            ممتاز! دلوقتي تعرف كل أقسام النظام. إليك ملخص مسار العمل الأساسي:
          </p>
          <div className="space-y-1">
            {[
              { num: "1", text: "إضافة عملاء ومواد وموردين في النظام", color: "bg-indigo-500" },
              { num: "2", text: "استقبال طلب من عميل ومراجعته", color: "bg-cyan-500" },
              { num: "3", text: "تحويل الطلب لأوردر مع تحديد الأسعار والتمويل", color: "bg-orange-500" },
              { num: "4", text: "توصيل المواد للعميل (كامل أو جزئي)", color: "bg-green-500" },
              { num: "5", text: "إصدار فاتورة وتحصيل المبلغ", color: "bg-rose-500" },
              { num: "6", text: "الأرباح تنزل في الخزينة وتتوزع على المؤسسين", color: "bg-purple-500" },
              { num: "7", text: "متابعة التقارير والمخزون والتنبيهات", color: "bg-blue-500" },
            ].map(step => (
              <div key={step.num} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 transition-colors">
                <div className={`${step.color} text-white h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0`}>
                  {step.num}
                </div>
                <span className="text-sm">{step.text}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={refreshData} className="gap-1 text-xs">
              <RefreshCw className="h-3 w-3" />
              تحديث البيانات
            </Button>
          </div>
        </div>
      ),
      action: "العودة للداشبورد",
      route: "/",
    },
  ];

  const currentStepData = workflowSteps[currentStep];
  const progress = (currentStep / (workflowSteps.length - 1)) * 100;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">دليل استخدام النظام</h1>
        <p className="text-muted-foreground text-sm">شرح شامل لكل أقسام النظام وكيفية استخدامها</p>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{currentStep + 1} من {workflowSteps.length}</span>
          <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card className="mb-6 overflow-hidden">
        <div className={`${currentStepData.bgColor} p-5`}>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-white/90 dark:bg-black/20 flex items-center justify-center shrink-0">
              <currentStepData.icon className={`h-5 w-5 ${currentStepData.color}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold">{currentStepData.title}</h2>
              <p className="text-sm text-muted-foreground">{currentStepData.subtitle}</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          {currentStepData.content}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="gap-2"
          size="sm"
        >
          <ArrowRight className="h-4 w-4" />
          السابق
        </Button>

        <div className="flex items-center gap-2">
          {currentStepData.route && currentStepData.action && (
            <Button
              variant="secondary"
              onClick={() => navigate(currentStepData.route!)}
              className="gap-2"
              size="sm"
            >
              <Eye className="h-4 w-4" />
              {currentStepData.action}
            </Button>
          )}
        </div>

        <Button
          onClick={() => {
            if (currentStep === workflowSteps.length - 1) {
              navigate("/");
            } else {
              setCurrentStep(Math.min(workflowSteps.length - 1, currentStep + 1));
            }
          }}
          className="gap-2"
          size="sm"
        >
          {currentStep === workflowSteps.length - 1 ? "انتهاء" : "التالي"}
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex justify-center mt-6">
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {workflowSteps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(index)}
              title={step.title}
              className={`h-2.5 rounded-full transition-all ${
                index === currentStep
                  ? "w-6 bg-primary"
                  : index < currentStep
                    ? "w-2.5 bg-primary/30"
                    : "w-2.5 bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
