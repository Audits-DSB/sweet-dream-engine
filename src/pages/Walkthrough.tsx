import { useState } from "react";
import { 
  FileText, ShoppingCart, Truck, Receipt, PlayCircle, ArrowRight, 
  ArrowLeft, CheckCircle, Clock, AlertCircle, Eye, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useWorkflow } from "@/contexts/WorkflowContext";

export default function Walkthrough() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { requests, orders, deliveries, collections, refreshData } = useWorkflow();
  const [currentStep, setCurrentStep] = useState(0);

  const workflowSteps = [
    {
      id: 0,
      title: "مرحباً بك في مسار العمل",
      subtitle: "تعرف على كيفية عمل النظام من البداية للنهاية",
      icon: PlayCircle,
      color: "text-primary",
      bgColor: "bg-primary/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            مرحباً بك في نظام إدارة المواد الطبية. سنأخذك في جولة تفاعلية لتتعرف على 
            كيفية سير العمل من استلام طلبات العملاء وحتى تحصيل المدفوعات.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">الطلبات</span>
              </div>
              <p className="text-xs text-muted-foreground">استقبال ومراجعة طلبات العملاء</p>
            </div>
            <div className="bg-warning/10 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="h-4 w-4 text-warning" />
                <span className="font-medium text-sm">الأوردرات</span>
              </div>
              <p className="text-xs text-muted-foreground">تحويل الطلبات لأوردرات فعلية</p>
            </div>
            <div className="bg-success/10 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Truck className="h-4 w-4 text-success" />
                <span className="font-medium text-sm">التوصيل</span>
              </div>
              <p className="text-xs text-muted-foreground">إدارة عملية التوصيل للعملاء</p>
            </div>
            <div className="bg-secondary/10 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="h-4 w-4 text-secondary" />
                <span className="font-medium text-sm">التحصيل</span>
              </div>
              <p className="text-xs text-muted-foreground">متابعة وتحصيل المدفوعات</p>
            </div>
          </div>
        </div>
      ),
      action: null,
      route: null,
    },
    {
      id: 1,
      title: "الطلبات (Requests)",
      subtitle: "نقطة البداية - استقبال طلبات العملاء",
      icon: FileText,
      color: "text-info",
      bgColor: "bg-info/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            هنا تبدأ رحلة كل عملية تجارية. العملاء يرسلون طلباتهم لشراء المواد الطبية،
            ونقوم بمراجعتها وتقييم إمكانية تنفيذها.
          </p>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">الطلبات الحالية:</h4>
            {requests.slice(0, 3).map(req => (
              <div key={req.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3 text-info" />
                  <span className="text-sm font-medium">{req.id}</span>
                  <span className="text-sm text-muted-foreground">{req.client}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {req.status}
                </Badge>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>متوسط وقت المراجعة: 24 ساعة</span>
          </div>
        </div>
      ),
      action: "مشاهدة الطلبات",
      route: "/requests",
    },
    {
      id: 2,
      title: "الأوردرات (Orders)",
      subtitle: "تحويل الطلبات المعتمدة لأوردرات فعلية",
      icon: ShoppingCart,
      color: "text-warning",
      bgColor: "bg-warning/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            بعد مراجعة وقبول الطلب، يتم تحويله لأوردر فعلي. هنا نحدد الكميات النهائية،
            الأسعار، وننسق مع الموردين لتوفير المواد المطلوبة.
          </p>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">الأوردرات الحالية:</h4>
            {orders.slice(0, 3).map(order => (
              <div key={order.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-3 w-3 text-warning" />
                  <span className="text-sm font-medium">{order.id}</span>
                  <span className="text-sm text-muted-foreground">{order.client}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{order.totalSelling}</span>
                  <Badge variant="secondary" className="text-xs">
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
      action: "مشاهدة الأوردرات",
      route: "/orders",
    },
    {
      id: 3,
      title: "التوصيل (Deliveries)",
      subtitle: "إيصال المواد للعملاء",
      icon: Truck,
      color: "text-success",
      bgColor: "bg-success/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            بعد تجهيز الأوردر، ننتقل لمرحلة التوصيل. نقوم بتنسيق مواعيد التسليم مع العملاء
            وإدارة عملية النقل سواء بفريقنا الداخلي أو شركات التوصيل الخارجية.
          </p>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">عمليات التوصيل الحالية:</h4>
            {deliveries.slice(0, 3).map(delivery => (
              <div key={delivery.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <div className="flex items-center gap-2">
                  <Truck className="h-3 w-3 text-success" />
                  <span className="text-sm font-medium">{delivery.id}</span>
                  <span className="text-sm text-muted-foreground">{delivery.client}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{delivery.deliveredBy}</span>
                  <Badge variant="secondary" className="text-xs">
                    {delivery.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
      action: "مشاهدة التوصيل",
      route: "/deliveries",
    },
    {
      id: 4,
      title: "التحصيل (Collections)",
      subtitle: "المرحلة الأخيرة - تحصيل المدفوعات",
      icon: Receipt,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            بعد إتمام التسليم، نقوم بإصدار الفواتير ومتابعة تحصيل المدفوعات من العملاء.
            نتابع المدفوعات المتأخرة ونرسل التذكيرات عند الحاجة.
          </p>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">الفواتير الحالية:</h4>
            {collections.slice(0, 3).map(collection => (
              <div key={collection.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <div className="flex items-center gap-2">
                  <Receipt className="h-3 w-3 text-purple-600" />
                  <span className="text-sm font-medium">{collection.id}</span>
                  <span className="text-sm text-muted-foreground">{collection.client}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{collection.totalAmount.toLocaleString()} ج.م</span>
                  <Badge variant="secondary" className="text-xs">
                    {collection.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
      action: "مشاهدة التحصيل",
      route: "/collections",
    },
    {
      id: 5,
      title: "مبروك! تمت الجولة",
      subtitle: "أنت الآن تعرف كيف يعمل النظام",
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            ممتاز! الآن تعرف كيف يسير العمل في النظام من استقبال الطلب وحتى تحصيل المدفوعات.
            يمكنك البدء في استكشاف النظام بنفسك.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">استكشف النظام</span>
              </div>
              <p className="text-xs text-muted-foreground">تصفح الصفحات المختلفة وتفاعل مع البيانات</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-secondary" />
                <span className="font-medium text-sm">إعادة تعيين</span>
              </div>
              <p className="text-xs text-muted-foreground">إعادة البيانات للحالة الأصلية في أي وقت</p>
            </div>
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
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">مسار العمل التفاعلي</h1>
        <p className="text-muted-foreground">تعرف على كيفية سير العمل في النظام خطوة بخطوة</p>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-muted-foreground">التقدم:</span>
          <span className="text-sm font-medium">{currentStep + 1} من {workflowSteps.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card className="mb-6">
        <div className={`${currentStepData.bgColor} p-6 rounded-t-lg`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center">
              <currentStepData.icon className={`h-6 w-6 ${currentStepData.color}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{currentStepData.title}</h2>
              <p className="text-muted-foreground">{currentStepData.subtitle}</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {currentStepData.content}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          السابق
        </Button>

        <div className="flex items-center gap-3">
          {currentStepData.route && currentStepData.action && (
            <Button
              variant="secondary"
              onClick={() => navigate(currentStepData.route!)}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              {currentStepData.action}
            </Button>
          )}
          
          {currentStep === workflowSteps.length - 1 && (
            <Button
              variant="outline"
              onClick={refreshData}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              إعادة تعيين البيانات
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
        >
          {currentStep === workflowSteps.length - 1 ? "انتهاء" : "التالي"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Step indicators */}
      <div className="flex justify-center mt-8">
        <div className="flex items-center gap-2">
          {workflowSteps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(index)}
              className={`h-3 w-3 rounded-full transition-all ${
                index === currentStep 
                  ? step.bgColor + " " + step.color 
                  : index < currentStep
                    ? "bg-success/20"
                    : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}