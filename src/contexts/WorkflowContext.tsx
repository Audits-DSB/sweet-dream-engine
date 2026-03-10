import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  requestsList as initialRequests,
  ordersList as initialOrders,
  deliveriesList as initialDeliveries,
  collectionsList as initialCollections,
  inventoryList as initialInventory,
  notificationsList as initialNotifications,
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
  createOrderFromInventory: (
    clientId: string,
    clientName: string,
    items: Array<{ id: string; name: string; quantity: number; unitPrice: number }>
  ) => any;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

// ─── helpers: map DB row → app shape ────────────────────────────────────────

const mapOrder = (row: any) => ({
  id: row.id,
  client: row.client,
  clientId: row.client_id,
  date: row.date,
  lines: row.lines,
  totalSelling: row.total_selling,
  totalCost: row.total_cost,
  splitMode: row.split_mode,
  deliveryFee: row.delivery_fee,
  status: row.status,
  source: row.source,
});

const mapRequest = (row: any) => ({
  id: row.id,
  client: row.client,
  clientId: row.client_id,
  date: row.date,
  items: row.items,
  totalValue: row.total_value,
  priority: row.priority,
  status: row.status,
  convertedOrderId: row.converted_order_id,
  notes: row.notes,
});

const mapDelivery = (row: any) => ({
  id: row.id,
  orderId: row.order_id,
  client: row.client,
  clientId: row.client_id,
  date: row.date,
  scheduledDate: row.scheduled_date,
  status: row.status,
  deliveredBy: row.delivered_by,
  deliveryFee: row.delivery_fee,
  items: row.items,
  notes: row.notes,
});

const mapCollection = (row: any) => ({
  id: row.id,
  orderId: row.order_id,
  client: row.client,
  clientId: row.client_id,
  invoiceDate: row.invoice_date,
  dueDate: row.due_date,
  totalAmount: row.total_amount,
  paidAmount: row.paid_amount,
  outstanding: row.outstanding,
  status: row.status,
  paymentMethod: row.payment_method,
  notes: row.notes,
});

const mapNotification = (row: any) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  message: row.message,
  date: row.date,
  time: row.time,
  read: row.read,
});

// ─── seed helper: insert initial data if table is empty ─────────────────────

async function seedIfEmpty(table: string, rows: any[]) {
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (count === 0) {
    await supabase.from(table).insert(rows);
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState(initialRequests);
  const [orders, setOrders] = useState(initialOrders);
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [collections, setCollections] = useState(initialCollections);
  const [inventory, setInventory] = useState(initialInventory);
  const [notifications, setNotifications] = useState(initialNotifications);

  // ── on mount: seed + load from Supabase ──────────────────────────────────
  useEffect(() => {
    async function init() {
      // Seed initial mock data if tables are empty
      await seedIfEmpty("orders", initialOrders.map((o) => ({
        id: o.id, client: o.client, client_id: o.clientId,
        date: o.date, lines: o.lines, total_selling: o.totalSelling,
        total_cost: o.totalCost, split_mode: o.splitMode,
        delivery_fee: o.deliveryFee, status: o.status, source: o.source,
      })));

      await seedIfEmpty("requests", initialRequests.map((r) => ({
        id: r.id, client: r.client, client_id: r.clientId,
        date: r.date, items: r.items, total_value: r.totalValue,
        priority: r.priority, status: r.status,
        converted_order_id: r.convertedOrderId, notes: r.notes,
      })));

      await seedIfEmpty("deliveries", initialDeliveries.map((d) => ({
        id: d.id, order_id: d.orderId, client: d.client,
        client_id: d.clientId, date: d.date,
        scheduled_date: d.scheduledDate, status: d.status,
        delivered_by: d.deliveredBy, delivery_fee: d.deliveryFee,
        items: d.items, notes: d.notes,
      })));

      await seedIfEmpty("collections", initialCollections.map((c) => ({
        id: c.id, order_id: c.orderId, client: c.client,
        client_id: c.clientId, invoice_date: c.invoiceDate,
        due_date: c.dueDate, total_amount: c.totalAmount,
        paid_amount: c.paidAmount, outstanding: c.outstanding,
        status: c.status, payment_method: c.paymentMethod, notes: c.notes,
      })));

      await seedIfEmpty("notifications", initialNotifications.map((n) => ({
        id: n.id, type: n.type, title: n.title, message: n.message,
        date: n.date, time: n.time, read: n.read,
      })));

      // Load fresh data from Supabase
      loadAll();
    }
    init();
  }, []);

  async function loadAll() {
    const [ordersRes, requestsRes, deliveriesRes, collectionsRes, notifRes] =
      await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("requests").select("*").order("created_at", { ascending: false }),
        supabase.from("deliveries").select("*").order("created_at", { ascending: false }),
        supabase.from("collections").select("*").order("created_at", { ascending: false }),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }),
      ]);

    if (ordersRes.data) setOrders(ordersRes.data.map(mapOrder) as any);
    if (requestsRes.data) setRequests(requestsRes.data.map(mapRequest) as any);
    if (deliveriesRes.data) setDeliveries(deliveriesRes.data.map(mapDelivery) as any);
    if (collectionsRes.data) setCollections(collectionsRes.data.map(mapCollection) as any);
    if (notifRes.data) setNotifications(notifRes.data.map(mapNotification) as any);
  }

  // ── status updaters ───────────────────────────────────────────────────────

  const updateRequestStatus = async (id: string, status: string) => {
    await supabase.from("requests").update({ status }).eq("id", id);
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    addNotification(`تم تحديث حالة الطلب ${id} إلى: ${status}`, "info");
  };

  const updateOrderStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    addNotification(`تم تحديث حالة الأوردر ${id} إلى: ${status}`, "info");
  };

  const updateDeliveryStatus = async (id: string, status: string) => {
    await supabase.from("deliveries").update({ status }).eq("id", id);
    setDeliveries((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
    addNotification(`تم تحديث حالة التوصيل ${id} إلى: ${status}`, "info");
  };

  const updateCollectionStatus = async (id: string, status: string) => {
    await supabase.from("collections").update({ status }).eq("id", id);
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
    addNotification(`تم تحديث حالة التحصيل ${id} إلى: ${status}`, "success");
  };

  // ── add notification ──────────────────────────────────────────────────────

  const addNotification = async (message: string, type: string) => {
    const newNotif = {
      id: `NOT-${Date.now()}`,
      type,
      title: message,
      message: "",
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      read: false,
    };
    await supabase.from("notifications").insert([newNotif]);
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // ── create order from inventory ───────────────────────────────────────────

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
      client_id: clientId,
      date: new Date().toISOString().split("T")[0],
      lines: items.length,
      total_selling: `${totalSelling.toLocaleString()} ج.م`,
      total_cost: `${totalCost.toLocaleString()} ج.م`,
      split_mode: "متساوي",
      delivery_fee: totalCost > 30000 ? 0 : 500,
      status: "Draft",
      source: "من الجرد",
    };

    await supabase.from("orders").insert([newOrder]);

    const appOrder = mapOrder({ ...newOrder, clientId: newOrder.client_id });
    setOrders((prev) => [appOrder as any, ...prev]);
    addNotification(`تم إنشاء أوردر جديد ${newOrder.id} من الجرد`, "success");

    return appOrder;
  };

  // ── refresh (reload from Supabase) ────────────────────────────────────────

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
