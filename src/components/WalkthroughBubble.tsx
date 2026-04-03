import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, FileText, Boxes, Factory, ShoppingCart, Truck,
  Warehouse, ClipboardCheck, Package, Receipt, Vault, UserCog, Building2,
  Landmark, FileBarChart, Bell, BarChart3, Settings, PlayCircle,
  ArrowRight, ArrowLeft, CheckCircle, Eye, RefreshCw, History,
  TrendingUp, DollarSign, Shield, MousePointerClick, BookOpen, X, ChevronLeft, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useWorkflow } from "@/contexts/WorkflowContext";

function StepCard({ icon: Icon, title, desc, color }: { icon: any; title: string; desc: string; color: string }) {
  return (
    <div className={`${color} p-2.5 rounded-lg`}>
      <div className="flex items-center gap-2 mb-0.5">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-medium text-xs">{title}</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-2 rounded-lg text-[10px] leading-relaxed">
      <MousePointerClick className="h-3 w-3 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

export function WalkthroughBubble() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { requests, orders, deliveries, collections, refreshData } = useWorkflow();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [atTop, setAtTop] = useState(true);
  const isDashboard = location.pathname === "/" || location.pathname === "/dashboard";

  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem("dsb_walkthrough_dismissed") === "true";
  });

  useEffect(() => {
    let target: Element | Window | null = null;
    const findTarget = () => {
      const mainEl = document.querySelector("main");
      return mainEl || window;
    };
    const handleScroll = () => {
      const mainEl = document.querySelector("main");
      const scrollY = mainEl ? mainEl.scrollTop : window.scrollY;
      setAtTop(scrollY <= 60);
    };
    const timer = setTimeout(() => {
      target = findTarget();
      target.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();
    }, 100);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      if (target) target.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (dismissed) localStorage.setItem("dsb_walkthrough_dismissed", "true");
  }, [dismissed]);

  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setDismissed(false);
      setCurrentStep(0);
    };
    window.addEventListener("open-walkthrough", handler);
    return () => window.removeEventListener("open-walkthrough", handler);
  }, []);

  const workflowSteps = [
    {
      title: "مرحباً بك في DSB",
      subtitle: "دليل شامل لاستخدام النظام",
      icon: PlayCircle,
      color: "text-primary",
      bgColor: "bg-primary/10",
      content: (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">
            نظام DSB هو نظام متكامل لإدارة عمليات الشركة. النظام مقسّم لأربعة أقسام:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <StepCard icon={ShoppingCart} title="العمليات" desc="العملاء، الطلبات، المواد، الموردين" color="bg-blue-500/10" />
            <StepCard icon={Warehouse} title="المخزون" desc="مخزون الشركة، جرد العملاء، التدقيق" color="bg-green-500/10" />
            <StepCard icon={DollarSign} title="المالية" desc="التحصيل، الخزينة، المؤسسين، الأرباح" color="bg-orange-500/10" />
            <StepCard icon={Settings} title="النظام" desc="التنبيهات، التقارير، الإعدادات" color="bg-purple-500/10" />
          </div>
        </div>
      ),
      route: null,
    },
    {
      title: "لوحة التحكم",
      subtitle: "نظرة شاملة على أداء الشركة",
      icon: LayoutDashboard,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      content: (
        <div className="space-y-2">
          <div className="flex items-start gap-2 p-2 bg-muted/50 rounded text-xs">
            <TrendingUp className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
            <span>كروت إحصائيات + رسوم بيانية تفاعلية + أعلى العملاء</span>
          </div>
          <Tip text="اضغط على أي شهر في الرسوم البيانية لرؤية التفاصيل." />
        </div>
      ),
      route: "/",
    },
    {
      title: "العملاء",
      subtitle: "إدارة بيانات العملاء",
      icon: Users,
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
      content: (
        <div className="space-y-2 text-xs">
          <p className="text-muted-foreground">إضافة عملاء، بروفايل لكل عميل، بحث وفلترة</p>
          <Tip text="كل عميل له صفحة بروفايل تعرض كل تاريخ تعاملاته." />
        </div>
      ),
      route: "/clients",
    },
    {
      title: "طلبات العملاء",
      subtitle: "استقبال ومراجعة الطلبات",
      icon: FileText,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      content: (
        <div className="space-y-2 text-xs">
          <p className="text-muted-foreground">إنشاء طلب → مراجعة → قبول/رفض → تحويل لأوردر</p>
          {requests.length > 0 && (
            <div className="space-y-1">
              {requests.slice(0, 2).map(req => (
                <div key={req.id} className="flex items-center justify-between p-1.5 bg-muted/30 rounded">
                  <span className="text-[10px]">{req.id} — {req.client}</span>
                  <Badge variant="secondary" className="text-[8px] h-4">{req.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
      route: "/requests",
    },
    {
      title: "المواد والموردين",
      subtitle: "كتالوج المواد وإدارة الموردين",
      icon: Boxes,
      color: "text-teal-500",
      bgColor: "bg-teal-500/10",
      content: (
        <div className="space-y-2 text-xs">
          <p className="text-muted-foreground">كتالوج شامل + استيراد من كتالوج خارجي + ربط الموردين بالمواد</p>
        </div>
      ),
      route: "/materials",
    },
    {
      title: "الأوردرات",
      subtitle: "قلب النظام — إنشاء وإدارة الأوردرات",
      icon: ShoppingCart,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      content: (
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="p-1.5 bg-blue-500/10 rounded border border-blue-500/20 text-[10px]">
              <span className="font-medium text-blue-600">أوردر عميل:</span> بيع مواد لعميل
            </div>
            <div className="p-1.5 bg-green-500/10 rounded border border-green-500/20 text-[10px]">
              <span className="font-medium text-green-600">أوردر مخزون:</span> شراء من مورد
            </div>
          </div>
          <Tip text="اضغط على أي أوردر لرؤية التفاصيل الكاملة." />
        </div>
      ),
      route: "/orders",
    },
    {
      title: "التوصيل",
      subtitle: "إدارة توصيل المواد للعملاء",
      icon: Truck,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      content: (
        <div className="space-y-2 text-xs">
          <p className="text-muted-foreground">توصيل كامل أو جزئي، تأكيد التوصيل يحدث المخزون تلقائياً</p>
        </div>
      ),
      route: "/deliveries",
    },
    {
      title: "المخزون والجرد",
      subtitle: "مخزون الشركة + جرد العملاء + إعادة التعبئة",
      icon: Warehouse,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      content: (
        <div className="space-y-2">
          <StepCard icon={Boxes} title="مخزون الشركة" desc="المواد المخزنة — إضافة يدوية أو تلقائية" color="bg-emerald-500/10" />
          <StepCard icon={ClipboardCheck} title="الجرد والتدقيق" desc="جرد فعلي ومقارنة بالسجلات" color="bg-pink-500/10" />
          <StepCard icon={Package} title="إعادة التعبئة" desc="تخطيط التوصيلات القادمة" color="bg-sky-500/10" />
        </div>
      ),
      route: "/inventory",
    },
    {
      title: "التحصيل والمالية",
      subtitle: "الفواتير والخزينة والمؤسسين والأرباح",
      icon: Receipt,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
      content: (
        <div className="space-y-2">
          <StepCard icon={Receipt} title="التحصيل" desc="فواتير، دفعات كاملة أو جزئية أو أقساط" color="bg-rose-500/10" />
          <StepCard icon={Vault} title="الخزينة" desc="حسابات بنكية ونقدية، واردات ومصروفات" color="bg-yellow-500/10" />
          <StepCard icon={UserCog} title="المؤسسين والأرباح" desc="مساهمات، تمويل أوردرات، تقسيم الأرباح" color="bg-purple-500/10" />
          <StepCard icon={FileBarChart} title="التقرير المالي" desc="تحليلات الإيرادات والأرباح والتدفق النقدي" color="bg-sky-500/10" />
        </div>
      ),
      route: "/collections",
    },
    {
      title: "النظام والإعدادات",
      subtitle: "التنبيهات، التقارير، إدارة المستخدمين",
      icon: Shield,
      color: "text-gray-500",
      bgColor: "bg-gray-500/10",
      content: (
        <div className="space-y-2">
          <StepCard icon={Bell} title="التنبيهات" desc="إشعارات تلقائية: تحصيل متأخر، مخزون منخفض" color="bg-red-500/10" />
          <StepCard icon={BarChart3} title="التقارير" desc="تقارير أداء مع إمكانية التصدير" color="bg-blue-500/10" />
          <StepCard icon={History} title="سجل الأنشطة" desc="تتبع كل عملية على النظام" color="bg-indigo-500/10" />
        </div>
      ),
      route: "/alerts",
    },
    {
      title: "مسار العمل الكامل",
      subtitle: "ملخص من البداية للنهاية",
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      content: (
        <div className="space-y-2">
          {[
            { num: "1", text: "إضافة عملاء ومواد وموردين", color: "bg-indigo-500" },
            { num: "2", text: "استقبال طلب ومراجعته", color: "bg-cyan-500" },
            { num: "3", text: "تحويل لأوردر مع تحديد الأسعار", color: "bg-orange-500" },
            { num: "4", text: "توصيل المواد للعميل", color: "bg-green-500" },
            { num: "5", text: "إصدار فاتورة وتحصيل المبلغ", color: "bg-rose-500" },
            { num: "6", text: "الأرباح تتوزع على المؤسسين", color: "bg-purple-500" },
            { num: "7", text: "متابعة التقارير والتنبيهات", color: "bg-blue-500" },
          ].map(step => (
            <div key={step.num} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 transition-colors">
              <div className={`${step.color} text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0`}>
                {step.num}
              </div>
              <span className="text-xs">{step.text}</span>
            </div>
          ))}
        </div>
      ),
      route: "/",
    },
  ];

  const currentStepData = workflowSteps[currentStep];
  const progress = (currentStep / (workflowSteps.length - 1)) * 100;

  if (dismissed && !open) {
    if (!isDashboard || !atTop) return null;
    return (
      <button
        onClick={() => { setOpen(true); setDismissed(false); }}
        className="fixed bottom-6 left-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center animate-in fade-in duration-300"
        title="دليل استخدام النظام"
      >
        <BookOpen className="h-5 w-5" />
      </button>
    );
  }

  return (
    <>
      {!open && isDashboard && atTop && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 left-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center animate-in fade-in duration-300"
          title="دليل استخدام النظام"
        >
          <BookOpen className="h-5 w-5" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 left-6 z-50 w-[340px] max-h-[520px] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200" dir="rtl">
          <div className={`${currentStepData.bgColor} px-4 py-3 flex items-center gap-3`}>
            <div className="h-9 w-9 rounded-full bg-white/90 dark:bg-black/20 flex items-center justify-center shrink-0">
              <currentStepData.icon className={`h-4 w-4 ${currentStepData.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold truncate">{currentStepData.title}</h3>
              <p className="text-[10px] text-muted-foreground truncate">{currentStepData.subtitle}</p>
            </div>
            <button
              onClick={() => { setOpen(false); setDismissed(true); }}
              className="h-7 w-7 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="px-4 pt-2 pb-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">{currentStep + 1} / {workflowSteps.length}</span>
              <span className="text-[10px] text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
            {currentStepData.content}
          </div>

          <div className="px-4 py-3 border-t flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="h-8 px-2 text-xs gap-1"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              السابق
            </Button>

            {currentStepData.route && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { navigate(currentStepData.route!); setOpen(false); }}
                className="h-8 px-2 text-xs gap-1 text-primary"
              >
                <Eye className="h-3.5 w-3.5" />
                فتح
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => {
                if (currentStep === workflowSteps.length - 1) {
                  setOpen(false);
                  setDismissed(true);
                  navigate("/");
                } else {
                  setCurrentStep(currentStep + 1);
                }
              }}
              className="h-8 px-3 text-xs gap-1"
            >
              {currentStep === workflowSteps.length - 1 ? "انتهاء" : "التالي"}
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex justify-center pb-2 px-4">
            <div className="flex items-center gap-1 flex-wrap justify-center">
              {workflowSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`h-1.5 rounded-full transition-all ${
                    index === currentStep
                      ? "w-4 bg-primary"
                      : index < currentStep
                        ? "w-1.5 bg-primary/30"
                        : "w-1.5 bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
