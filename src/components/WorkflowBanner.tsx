import { useState, useRef, useEffect } from "react";
import { Play, ArrowLeft, FileText, ShoppingCart, Truck, Receipt, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { Progress } from "@/components/ui/progress";

export function WorkflowBanner() {
  return null;
}

export function WorkflowFab() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { requests, orders, deliveries, collections } = useWorkflow();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const workflowSteps = [
    {
      id: 1,
      title: "الطلبات",
      icon: FileText,
      route: "/requests",
      count: requests.filter(r => r.status === "Under Review").length,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      borderColor: "border-blue-200 dark:border-blue-800",
    },
    {
      id: 2,
      title: "الأوردرات",
      icon: ShoppingCart,
      route: "/orders",
      count: orders.filter(o => ["Processing", "Draft", "Confirmed", "Ready for Delivery"].includes(o.status)).length,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
      borderColor: "border-orange-200 dark:border-orange-800",
    },
    {
      id: 3,
      title: "التوصيل",
      icon: Truck,
      route: "/deliveries",
      count: deliveries.filter(d => ["Scheduled", "In Transit"].includes(d.status)).length,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      borderColor: "border-green-200 dark:border-green-800",
    },
    {
      id: 4,
      title: "التحصيل",
      icon: Receipt,
      route: "/collections",
      count: collections.filter(c => ["Pending", "Partially Paid"].includes(c.status)).length,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      borderColor: "border-purple-200 dark:border-purple-800",
    },
  ];

  const totalItems = workflowSteps.reduce((sum, step) => sum + step.count, 0);
  const completedPercentage = totalItems > 0
    ? ((collections.filter(c => c.status === "Paid").length / totalItems) * 100)
    : 0;

  return (
    <div className="fixed bottom-6 left-6 z-50" ref={panelRef}>
      {open && (
        <div className="absolute bottom-16 left-0 w-72 bg-card border border-border rounded-xl shadow-2xl p-4 animate-in slide-in-from-bottom-3 fade-in duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">مسار العمل</h3>
            </div>
            <button onClick={() => setOpen(false)} className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Progress value={completedPercentage} className="flex-1 h-1.5" />
            <span className="text-[10px] font-medium text-muted-foreground">{Math.round(completedPercentage)}%</span>
          </div>

          <div className="space-y-2">
            {workflowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg ${step.bgColor} border ${step.borderColor} cursor-pointer hover:shadow-sm transition-all`}
                  onClick={() => { navigate(step.route); setOpen(false); }}
                >
                  <Icon className={`h-4 w-4 ${step.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{step.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {step.count > 0 && (
                      <span className={`text-xs font-bold ${step.color} bg-white dark:bg-background px-1.5 py-0.5 rounded-full`}>
                        {step.count}
                      </span>
                    )}
                    <ArrowLeft className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>

          <button
            className="w-full mt-3 text-xs text-primary hover:underline flex items-center justify-center gap-1 py-1.5"
            onClick={() => { window.dispatchEvent(new CustomEvent("open-walkthrough")); setOpen(false); }}
          >
            <Play className="h-3 w-3" /> جولة تفاعلية
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen(prev => !prev)}
        className={`h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 ${
          open ? "bg-muted border border-border" : "bg-primary text-primary-foreground"
        }`}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <div className="relative">
            <Play className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </div>
        )}
      </button>
    </div>
  );
}
