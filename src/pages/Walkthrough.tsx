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
      title: t.wtWelcomeTitle,
      subtitle: t.wtWelcomeSubtitle,
      icon: PlayCircle,
      color: "text-primary",
      bgColor: "bg-primary/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            {t.wtWelcomeDesc}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{t.wtRequests}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.wtRequestsDesc}</p>
            </div>
            <div className="bg-warning/10 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="h-4 w-4 text-warning" />
                <span className="font-medium text-sm">{t.wtOrders}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.wtOrdersDesc}</p>
            </div>
            <div className="bg-success/10 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Truck className="h-4 w-4 text-success" />
                <span className="font-medium text-sm">{t.wtDelivery}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.wtDeliveryDesc}</p>
            </div>
            <div className="bg-secondary/10 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="h-4 w-4 text-secondary" />
                <span className="font-medium text-sm">{t.wtCollections}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.wtCollectionsDesc}</p>
            </div>
          </div>
        </div>
      ),
      action: null,
      route: null,
    },
    {
      id: 1,
      title: t.wtRequestsTitle,
      subtitle: t.wtRequestsSubtitle,
      icon: FileText,
      color: "text-info",
      bgColor: "bg-info/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            {t.wtRequestsContent}
          </p>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">{t.wtCurrentRequests}</h4>
            {requests.slice(0, 3).map(req => (
              <div key={req.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3 text-primary" />
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
            <span>{t.wtAvgReviewTime}</span>
          </div>
        </div>
      ),
      action: t.wtViewRequests,
      route: "/requests",
    },
    {
      id: 2,
      title: t.wtOrdersTitle,
      subtitle: t.wtOrdersSubtitle,
      icon: ShoppingCart,
      color: "text-warning",
      bgColor: "bg-warning/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            {t.wtOrdersContent}
          </p>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">{t.wtCurrentOrders}</h4>
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
      action: t.wtViewOrders,
      route: "/orders",
    },
    {
      id: 3,
      title: t.wtDeliveryTitle,
      subtitle: t.wtDeliverySubtitle,
      icon: Truck,
      color: "text-success",
      bgColor: "bg-success/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            {t.wtDeliveryContent}
          </p>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">{t.wtCurrentDeliveries}</h4>
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
      action: t.wtViewDeliveries,
      route: "/deliveries",
    },
    {
      id: 4,
      title: t.wtCollectionsTitle,
      subtitle: t.wtCollectionsSubtitle,
      icon: Receipt,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            {t.wtCollectionsContent}
          </p>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">{t.wtCurrentInvoices}</h4>
            {collections.slice(0, 3).map(collection => (
              <div key={collection.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <div className="flex items-center gap-2">
                  <Receipt className="h-3 w-3 text-secondary" />
                  <span className="text-sm font-medium">{collection.id}</span>
                  <span className="text-sm text-muted-foreground">{collection.client}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{collection.totalAmount.toLocaleString()} {t.currency}</span>
                  <Badge variant="secondary" className="text-xs">
                    {collection.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
      action: t.wtViewCollections,
      route: "/collections",
    },
    {
      id: 5,
      title: t.wtCompleteTitle,
      subtitle: t.wtCompleteSubtitle,
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            {t.wtCompleteDesc}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{t.wtExplore}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.wtExploreDesc}</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-secondary" />
                <span className="font-medium text-sm">{t.wtReset}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.wtResetDesc}</p>
            </div>
          </div>
        </div>
      ),
      action: t.wtBackToDashboard,
      route: "/",
    },
  ];

  const currentStepData = workflowSteps[currentStep];
  const progress = (currentStep / (workflowSteps.length - 1)) * 100;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">{t.wtPageTitle}</h1>
        <p className="text-muted-foreground">{t.wtPageDesc}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-muted-foreground">{t.wtProgress}</span>
          <span className="text-sm font-medium">{currentStep + 1} {t.wtOf} {workflowSteps.length}</span>
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
          {t.wtPrevious}
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
              {t.wtResetData}
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
          {currentStep === workflowSteps.length - 1 ? t.wtFinish : t.wtNext}
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