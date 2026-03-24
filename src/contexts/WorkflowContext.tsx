import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "@/lib/api";

interface WorkflowContextType {
  requests: any[];
  orders: any[];
  deliveries: any[];
  collections: any[];
  inventory: any[];
  notifications: any[];
  updateRequestStatus: (id: string, status: string) => void;
  updateOrderStatus: (id: string, status: string) => void;
  updateDeliveryStatus: (id: string, status: string) => void;
  updateCollectionStatus: (id: string, status: string) => void;
  refreshData: () => void;
  createOrderFromInventory: (
    clientId: string,
    clientName: string,
    items: Array<{ id: string; name: string; quantity: number; unitPrice: number }>
  ) => any;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [o, r, d, c, n, inv] = await Promise.all([
      api.get<any[]>("/orders"),
      api.get<any[]>("/requests"),
      api.get<any[]>("/deliveries"),
      api.get<any[]>("/collections"),
      api.get<any[]>("/notifications"),
      api.get<any[]>("/inventory"),
    ]);
    setOrders(o);
    setRequests(r);
    setDeliveries(d);
    setCollections(c);
    setNotifications(n);
    setInventory(inv);
  }

  const addNotification = async (title: string, type: string) => {
    const newNotif = {
      id: `NOT-${Date.now()}`,
      type,
      title,
      message: "",
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      read: false,
      userId: "",
    };
    const saved = await api.post<any>("/notifications", newNotif);
    setNotifications((prev) => [saved, ...prev]);
  };

  const updateRequestStatus = async (id: string, status: string) => {
    await api.patch(`/requests/${id}`, { status });
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    addNotification(`تم تحديث حالة الطلب ${id} إلى: ${status}`, "info");
  };

  const updateOrderStatus = async (id: string, status: string) => {
    await api.patch(`/orders/${id}`, { status });
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    addNotification(`تم تحديث حالة الأوردر ${id} إلى: ${status}`, "info");
  };

  const updateDeliveryStatus = async (id: string, status: string) => {
    await api.patch(`/deliveries/${id}`, { status });
    setDeliveries((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
    addNotification(`تم تحديث حالة التوصيل ${id} إلى: ${status}`, "info");
  };

  const updateCollectionStatus = async (id: string, status: string) => {
    await api.patch(`/collections/${id}`, { status });
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    addNotification(`تم تحديث حالة التحصيل ${id} إلى: ${status}`, "success");
  };

  const createOrderFromInventory = async (
    clientId: string,
    clientName: string,
    items: Array<{ id: string; name: string; quantity: number; unitPrice: number }>
  ) => {
    const totalCost = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const totalSelling = Math.round(totalCost * 1.4);
    const newOrder = {
      id: `ORD-${String(orders.length + 50).padStart(3, "0")}`,
      client: clientName,
      clientId,
      date: new Date().toISOString().split("T")[0],
      lines: items.length,
      totalSelling: `${totalSelling.toLocaleString()} ج.م`,
      totalCost: `${totalCost.toLocaleString()} ج.م`,
      splitMode: "متساوي",
      deliveryFee: totalCost > 30000 ? 0 : 500,
      status: "Draft",
      source: "من الجرد",
    };
    const saved = await api.post<any>("/orders", newOrder);
    setOrders((prev) => [saved, ...prev]);
    addNotification(`تم إنشاء أوردر جديد ${newOrder.id} من الجرد`, "success");
    return saved;
  };

  const refreshData = () => loadAll();

  return (
    <WorkflowContext.Provider
      value={{
        requests, orders, deliveries, collections,
        inventory, notifications,
        updateRequestStatus, updateOrderStatus,
        updateDeliveryStatus, updateCollectionStatus,
        refreshData, createOrderFromInventory,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) throw new Error("useWorkflow must be used within WorkflowProvider");
  return context;
}
