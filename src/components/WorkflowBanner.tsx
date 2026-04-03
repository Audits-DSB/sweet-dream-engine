import { Play, ArrowRight, FileText, ShoppingCart, Truck, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { Progress } from "@/components/ui/progress";

export function WorkflowBanner() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { requests, orders, deliveries, collections } = useWorkflow();

  const workflowSteps = [
    {
      id: 1,
      title: "الطلبات",
      icon: FileText,
      route: "/requests",
      count: requests.filter(r => r.status === "Under Review").length,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      id: 2,
      title: "الأوردرات",
      icon: ShoppingCart,
      route: "/orders",
      count: orders.filter(o => ["Processing", "Draft", "Confirmed", "Ready for Delivery"].includes(o.status)).length,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      id: 3,
      title: "التوصيل",
      icon: Truck,
      route: "/deliveries",
      count: deliveries.filter(d => ["Scheduled", "In Transit"].includes(d.status)).length,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      id: 4,
      title: "التحصيل",
      icon: Receipt,
      route: "/collections",
      count: collections.filter(c => ["Pending", "Partially Paid"].includes(c.status)).length,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  const totalItems = workflowSteps.reduce((sum, step) => sum + step.count, 0);
  const completedPercentage = totalItems > 0 ? 
    ((collections.filter(c => c.status === "Paid").length / totalItems) * 100) : 0;

  return (
    <div className="bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Play className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">مسار العمل التفاعلي</h3>
            <p className="text-xs text-muted-foreground">تتبع خطوات العملية من الطلب للتحصيل</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => window.dispatchEvent(new CustomEvent("open-walkthrough"))}
          className="gap-2"
        >
          <Play className="h-3 w-3" />
          جولة تفاعلية
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-muted-foreground">التقدم الإجمالي:</span>
        <Progress value={completedPercentage} className="flex-1 h-2" />
        <span className="text-xs font-medium text-muted-foreground">
          {Math.round(completedPercentage)}%
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {workflowSteps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className="relative cursor-pointer group"
              onClick={() => navigate(step.route)}
            >
              <div className={`${step.bgColor} border border-border rounded-lg p-3 hover:shadow-sm transition-all group-hover:scale-105`}>
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`h-4 w-4 ${step.color}`} />
                  {step.count > 0 && (
                    <span className={`text-xs font-bold ${step.color} bg-white px-1.5 py-0.5 rounded-full`}>
                      {step.count}
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground">
                  {step.count} عنصر نشط
                </p>
              </div>
              
              {index < workflowSteps.length - 1 && (
                <ArrowRight className="absolute top-1/2 -right-2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground z-10" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}