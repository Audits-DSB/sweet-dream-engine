import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Minus, Package, Eye, AlertTriangle, CheckCircle, Clock, ShoppingCart } from "lucide-react";
import { DataToolbar } from "@/components/DataToolbar";
import { StatusBadge } from "@/components/StatusBadge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function Inventory() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { inventory, createOrderFromInventory } = useWorkflow();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState("all");
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertClient, setConvertClient] = useState("");
  const [selectedLots, setSelectedLots] = useState<Record<string, number>>({});

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.material.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClient = selectedClient === "all" || item.client === selectedClient;
    return matchesSearch && matchesClient;
  });

  const clientsWithInventory = [...new Set(inventory.map(item => item.client))];

  const groupedByClient = clientsWithInventory.map(client => ({
    client,
    items: filteredInventory.filter(item => item.client === client)
  }));

  const getUniqueStatuses = (items: typeof inventory) => {
    return [...new Set(items.map(item => item.status))];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Available":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "Low Stock":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "Depleted":
        return <Clock className="h-4 w-4 text-red-600" />;
      default:
        return <Package className="h-4 w-4 text-gray-600" />;
    }
  };

  const openConvertDialog = (clientName: string, items: typeof inventory) => {
    const preSelected: Record<string, number> = {};
    items.forEach(item => {
      if (item.status === "Depleted" || item.status === "Low Stock") {
        preSelected[item.id] = item.delivered;
      }
    });
    setSelectedLots(preSelected);
    setConvertClient(clientName);
    setConvertDialogOpen(true);
  };

  const adjustQuantity = (lotId: string, delta: number) => {
    setSelectedLots(prev => ({
      ...prev,
      [lotId]: Math.max(1, (prev[lotId] || 1) + delta)
    }));
  };

  const toggleLotSelection = (lotId: string, defaultQuantity: number) => {
    setSelectedLots(prev => {
      const newSelected = { ...prev };
      if (newSelected[lotId]) {
        delete newSelected[lotId];
      } else {
        newSelected[lotId] = defaultQuantity;
      }
      return newSelected;
    });
  };

  const handleCreateOrder = () => {
    const selectedItems = inventory.filter(item => selectedLots[item.id]);
    
    if (selectedItems.length === 0) {
      toast.error("يرجى اختيار مادة واحدة على الأقل");
      return;
    }

    const orderItems = selectedItems.map(item => ({
      id: item.id,
      name: item.material,
      quantity: selectedLots[item.id],
      unitPrice: item.storeCost || 15.5
    }));

    const newOrder = createOrderFromInventory(
      convertClient.toLowerCase(),
      convertClient,
      orderItems
    );

    setConvertDialogOpen(false);
    setSelectedLots({});
    
    toast.success(`تم إنشاء الأوردر ${newOrder.id} بنجاح`, {
      action: {
        label: "عرض الأوردر",
        onClick: () => navigate("/orders")
      }
    });
  };

  const getClientItemsToConvert = (clientName: string) => {
    return filteredInventory
      .filter(item => item.client === clientName && (item.status === "Depleted" || item.status === "Low Stock"));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة الجرد</h1>
          <p className="text-muted-foreground">
            {inventory.length} مادة موزعة على {clientsWithInventory.length} عميل
          </p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="البحث في المواد أو العملاء..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>
        <select 
          className="px-4 py-2 border rounded-lg"
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
        >
          <option value="all">جميع العملاء</option>
          {clientsWithInventory.map(client => (
            <option key={client} value={client}>{client}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {groupedByClient.map(({ client, items }) => (
          <Card key={client} className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{client}</h3>
                  <p className="text-sm text-muted-foreground">{items.length} مادة</p>
                </div>
                <div className="flex items-center gap-2">
                  {getClientItemsToConvert(client).length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openConvertDialog(client, getClientItemsToConvert(client))}
                      className="gap-2"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      تحويل لأوردر
                    </Button>
                  )}
                  <div className="flex gap-2">
                    {getUniqueStatuses(items).map((status) => (
                      <StatusBadge key={status} status={status} />
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right py-2 px-3">الكود</th>
                      <th className="text-right py-2 px-3">المادة</th>
                      <th className="text-right py-2 px-3">الوحدة</th>
                      <th className="text-right py-2 px-3">المسلّم</th>
                      <th className="text-right py-2 px-3">المتبقي</th>
                      <th className="text-right py-2 px-3">السعر</th>
                      <th className="text-right py-2 px-3">تاريخ التسليم</th>
                      <th className="text-right py-2 px-3">الحالة</th>
                      <th className="text-right py-2 px-3">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono text-xs">{item.code}</td>
                        <td className="py-2 px-3 font-medium">{item.material}</td>
                        <td className="py-2 px-3">{item.unit}</td>
                        <td className="py-2 px-3">{item.delivered}</td>
                        <td className="py-2 px-3 font-medium">{item.remaining}</td>
                        <td className="py-2 px-3">{item.sellingPrice} ج.م</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{item.deliveryDate}</td>
                        <td className="py-2 px-3">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="py-2 px-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/inventory/${item.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog for converting inventory to order */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تحويل الجرد لأوردر - {convertClient}</DialogTitle>
            <DialogDescription>
              اختر المواد والكميات المطلوبة لإنشاء أوردر جديد
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-4">
              {inventory
                .filter(item => item.client === convertClient && (item.status === "Depleted" || item.status === "Low Stock"))
                .map((item) => {
                  const isSelected = selectedLots[item.id];
                  const quantity = selectedLots[item.id] || item.delivered;
                  
                  return (
                    <div key={item.id} className="flex items-center gap-4 p-3 border rounded-lg">
                      <Checkbox
                        checked={!!isSelected}
                        onCheckedChange={() => toggleLotSelection(item.id, item.delivered)}
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{item.material}</h4>
                          <StatusBadge status={item.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          الكود: {item.code} | الوحدة: {item.unit}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => adjustQuantity(item.id, -1)}
                            disabled={quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-12 text-center font-medium">{quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => adjustQuantity(item.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {isSelected && (
                        <div className="text-left">
                          <div className="text-sm font-medium">
                            {(quantity * (item.storeCost || 15.5)).toLocaleString()} جنيه
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(item.storeCost || 15.5)} × {quantity}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {Object.keys(selectedLots).length > 0 && (
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">الإجمالي:</span>
                <span className="text-lg font-bold text-primary">
                  {Object.entries(selectedLots).reduce((total, [lotId, quantity]) => {
                    const item = inventory.find(i => i.id === lotId);
                    return total + (quantity * (item?.storeCost || 15.5));
                  }, 0).toLocaleString()} جنيه
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreateOrder} disabled={Object.keys(selectedLots).length === 0}>
              إنشاء الأوردر
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}