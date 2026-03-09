import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { 
  requestsList as initialRequests, 
  ordersList as initialOrders,
  deliveriesList as initialDeliveries,
  collectionsList as initialCollections,
  inventoryList as initialInventory,
  notificationsList as initialNotifications
} from "@/data/store";

interface WorkflowContextType {
  requests: typeof initialRequests;
  orders: typeof initialOrders;
  deliveries: typeof initialDeliveries;
  collections: typeof initialCollections;
  inventory: typeof initialInventory;
  notifications: typeof initialNotifications;
  updateRequestStatus: (id: string, status: string) => void;
  updateOrderStatus: (id: string, status: string) => void;
  updateDeliveryStatus: (id: string, status: string) => void;
  updateCollectionStatus: (id: string, status: string) => void;
  refreshData: () => void;
  createOrderFromInventory: (clientId: string, clientName: string, items: Array<{ id: string; name: string; quantity: number; unitPrice: number }>) => any;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState(initialRequests);
  const [orders, setOrders] = useState(initialOrders);
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [collections, setCollections] = useState(initialCollections);
  const [inventory, setInventory] = useState(initialInventory);
  const [notifications, setNotifications] = useState(initialNotifications);

  // Load from localStorage on mount
  useEffect(() => {
    const savedRequests = localStorage.getItem('workflow_requests');
    const savedOrders = localStorage.getItem('workflow_orders');
    const savedDeliveries = localStorage.getItem('workflow_deliveries');
    const savedCollections = localStorage.getItem('workflow_collections');
    
    if (savedRequests) setRequests(JSON.parse(savedRequests));
    if (savedOrders) setOrders(JSON.parse(savedOrders));
    if (savedDeliveries) setDeliveries(JSON.parse(savedDeliveries));
    if (savedCollections) setCollections(JSON.parse(savedCollections));
  }, []);

  const updateRequestStatus = (id: string, status: string) => {
    const updated = requests.map(req => 
      req.id === id ? { ...req, status } : req
    );
    setRequests(updated);
    localStorage.setItem('workflow_requests', JSON.stringify(updated));
    
    // Add notification
    addNotification(`تم تحديث حالة الطلب ${id} إلى: ${status}`, "info");
  };

  const updateOrderStatus = (id: string, status: string) => {
    const updated = orders.map(order => 
      order.id === id ? { ...order, status } : order
    );
    setOrders(updated);
    localStorage.setItem('workflow_orders', JSON.stringify(updated));
    
    addNotification(`تم تحديث حالة الأوردر ${id} إلى: ${status}`, "info");
  };

  const updateDeliveryStatus = (id: string, status: string) => {
    const updated = deliveries.map(delivery => 
      delivery.id === id ? { ...delivery, status } : delivery
    );
    setDeliveries(updated);
    localStorage.setItem('workflow_deliveries', JSON.stringify(updated));
    
    addNotification(`تم تحديث حالة التوصيل ${id} إلى: ${status}`, "info");
  };

  const updateCollectionStatus = (id: string, status: string) => {
    const updated = collections.map(collection => 
      collection.id === id ? { ...collection, status } : collection
    );
    setCollections(updated);
    localStorage.setItem('workflow_collections', JSON.stringify(updated));
    
    addNotification(`تم تحديث حالة التحصيل ${id} إلى: ${status}`, "success");
  };

  const addNotification = (message: string, type: string) => {
    const newNotification = {
      id: `NOT-${Date.now()}`,
      type,
      title: message,
      message: "",
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    setNotifications([newNotification, ...notifications]);
  };

  const refreshData = () => {
    setRequests(initialRequests);
    setOrders(initialOrders);
    setDeliveries(initialDeliveries);
    setCollections(initialCollections);
    setInventory(initialInventory);
    setNotifications(initialNotifications);
    
    localStorage.removeItem('workflow_requests');
    localStorage.removeItem('workflow_orders');
    localStorage.removeItem('workflow_deliveries');
    localStorage.removeItem('workflow_collections');
  };

  return (
    <WorkflowContext.Provider
      value={{
        requests,
        orders,
        deliveries,
        collections,
        inventory,
        notifications,
        updateRequestStatus,
        updateOrderStatus,
        updateDeliveryStatus,
        updateCollectionStatus,
        refreshData,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useWorkflow must be used within WorkflowProvider");
  }
  return context;
}
