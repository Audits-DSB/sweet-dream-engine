import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import { createProxyMiddleware } from "http-proxy-middleware";
import { db } from "./db";
import {
  clients, suppliers, materials, founders,
  orders, requests, deliveries, collections,
  inventory, notifications, treasuryAccounts, treasuryTransactions,
} from "../shared/schema";
import apiRouter from "./routes";
import {
  clientsList, suppliersList, materialsList, foundersList,
  ordersList, requestsList, deliveriesList, collectionsList,
  inventoryList, notificationsList,
} from "../src/data/store";

const app = express();
const PORT = 5000;
const VITE_PORT = 5001;

app.use(cors());
app.use(express.json());

app.use("/api", apiRouter);

async function seedIfEmpty() {
  const existingClients = await db.select().from(clients).limit(1);
  if (existingClients.length > 0) return;

  console.log("🌱 Seeding initial data...");

  await db.insert(clients).values(clientsList.map(c => ({
    id: c.id, name: c.name, contact: c.contact, email: c.email,
    phone: c.phone, city: c.city, status: c.status, joinDate: c.joinDate,
    totalOrders: c.totalOrders, outstanding: String(c.outstanding), lastAudit: c.lastAudit,
  }))).onConflictDoNothing();

  await db.insert(suppliers).values(suppliersList.map(s => ({
    id: s.id, name: s.name, country: s.country, email: s.email,
    phone: s.phone, website: s.website, paymentTerms: s.paymentTerms, active: s.active,
  }))).onConflictDoNothing();

  await db.insert(materials).values(materialsList.map(m => ({
    code: m.code, name: m.name, category: m.category, unit: m.unit,
    sellingPrice: String(m.sellingPrice), storeCost: String(m.storeCost),
    supplier: m.supplier, supplierId: m.supplierId, manufacturer: m.manufacturer,
    hasExpiry: m.hasExpiry, active: m.active,
  }))).onConflictDoNothing();

  await db.insert(founders).values(foundersList.map(f => ({
    id: f.id, name: f.name, alias: f.alias, email: f.email, phone: f.phone,
  }))).onConflictDoNothing();

  await db.insert(orders).values(ordersList.map(o => ({
    id: o.id, client: o.client, clientId: o.clientId, date: o.date,
    lines: o.lines, totalSelling: o.totalSelling, totalCost: o.totalCost,
    splitMode: o.splitMode, deliveryFee: String(o.deliveryFee), status: o.status, source: o.source,
  }))).onConflictDoNothing();

  await db.insert(requests).values(requestsList.map(r => ({
    id: r.id, client: r.client, clientId: r.clientId, date: r.date,
    items: r.items, totalValue: r.totalValue, priority: r.priority,
    status: r.status, convertedOrderId: r.convertedOrderId ?? null, notes: r.notes,
  }))).onConflictDoNothing();

  await db.insert(deliveries).values(deliveriesList.map(d => ({
    id: d.id, orderId: d.orderId, client: d.client, clientId: d.clientId,
    date: d.date, scheduledDate: d.scheduledDate, status: d.status,
    deliveredBy: d.deliveredBy, deliveryFee: String(d.deliveryFee),
    items: d.items, notes: d.notes,
  }))).onConflictDoNothing();

  await db.insert(collections).values(collectionsList.map(c => ({
    id: c.id, orderId: c.orderId, client: c.client, clientId: c.clientId,
    invoiceDate: c.invoiceDate, dueDate: c.dueDate, totalAmount: String(c.totalAmount),
    paidAmount: String(c.paidAmount), outstanding: String(c.outstanding),
    status: c.status, paymentMethod: c.paymentMethod, notes: c.notes,
  }))).onConflictDoNothing();

  await db.insert(inventory).values(inventoryList.map(i => ({
    materialCode: i.materialCode, materialName: i.materialName,
    category: i.category, totalStock: i.totalStock, reorderPoint: i.reorderPoint,
    lots: i.lots,
  }))).onConflictDoNothing();

  await db.insert(notifications).values(notificationsList.map(n => ({
    id: n.id, type: n.type, title: n.title, message: n.message,
    date: n.date, time: n.time, read: n.read, userId: "",
  }))).onConflictDoNothing();

  // Seed treasury accounts
  const acc1Id = "11111111-1111-1111-1111-111111111111";
  const acc2Id = "22222222-2222-2222-2222-222222222222";
  const acc3Id = "33333333-3333-3333-3333-333333333333";
  await db.insert(treasuryAccounts).values([
    { id: acc1Id, name: "الصندوق الرئيسي", accountType: "cashbox", custodianName: "أحمد الراشد", balance: "850000", isActive: true },
    { id: acc2Id, name: "حساب الراتب - سارة", accountType: "cashbox", custodianName: "سارة المنصور", balance: "420000", isActive: true },
    { id: acc3Id, name: "بنك الأهلي", accountType: "bank", custodianName: "عمر خليل", bankName: "البنك الأهلي المصري", balance: "1250000", isActive: true },
  ]).onConflictDoNothing();

  // Seed some treasury transactions
  await db.insert(treasuryTransactions).values([
    { accountId: acc1Id, txType: "inflow", amount: "850000", balanceAfter: "850000", category: "revenue", description: "إيرادات مارس", performedBy: null },
    { accountId: acc2Id, txType: "inflow", amount: "420000", balanceAfter: "420000", category: "revenue", description: "إيرادات فبراير", performedBy: null },
    { accountId: acc3Id, txType: "inflow", amount: "1250000", balanceAfter: "1250000", category: "revenue", description: "إيرادات يناير", performedBy: null },
    { accountId: acc1Id, txType: "expense", amount: "-45000", balanceAfter: "805000", category: "logistics", description: "مصاريف توصيل", performedBy: null },
    { accountId: acc1Id, txType: "expense", amount: "-30000", balanceAfter: "775000", category: "marketing", description: "إعلانات ومسوقون", performedBy: null },
    { accountId: acc2Id, txType: "withdrawal", amount: "-85000", balanceAfter: "335000", category: "salaries", description: "رواتب شهر مارس", performedBy: null },
  ]).onConflictDoNothing();

  console.log("✅ Seeding complete!");
}

const viteProcess = spawn("npx", ["vite", "--port", String(VITE_PORT), "--host", "0.0.0.0"], {
  stdio: "inherit",
  env: { ...process.env },
});

viteProcess.on("error", (err) => console.error("Vite spawn error:", err));

app.use(
  "/",
  createProxyMiddleware({
    target: `http://localhost:${VITE_PORT}`,
    changeOrigin: true,
    ws: true,
    on: {
      error: (_err: any, _req: any, res: any) => {
        if (res && typeof res.status === "function") {
          res.status(502).send("Vite dev server not ready yet. Refresh in a moment.");
        }
      },
    },
  })
);

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await seedIfEmpty();
});
