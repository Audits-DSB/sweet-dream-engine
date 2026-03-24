import { Router } from "express";
import { db } from "./db";
import {
  clients, suppliers, materials, founders,
  orders, requests, deliveries, collections,
  inventory, notifications,
  treasuryAccounts, treasuryTransactions,
} from "../shared/schema";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

// ─── CLIENTS ─────────────────────────────────────────────────────────────────
router.get("/clients", async (_req, res) => {
  const rows = await db.select().from(clients);
  res.json(rows);
});

router.post("/clients", async (req, res) => {
  const [row] = await db.insert(clients).values(req.body).returning();
  res.json(row);
});

router.patch("/clients/:id", async (req, res) => {
  const [row] = await db.update(clients).set(req.body).where(eq(clients.id, req.params.id)).returning();
  res.json(row);
});

router.delete("/clients/:id", async (req, res) => {
  await db.delete(clients).where(eq(clients.id, req.params.id));
  res.json({ ok: true });
});

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────
router.get("/suppliers", async (_req, res) => {
  const rows = await db.select().from(suppliers);
  res.json(rows);
});

router.post("/suppliers", async (req, res) => {
  const [row] = await db.insert(suppliers).values(req.body).returning();
  res.json(row);
});

router.patch("/suppliers/:id", async (req, res) => {
  const [row] = await db.update(suppliers).set(req.body).where(eq(suppliers.id, req.params.id)).returning();
  res.json(row);
});

router.delete("/suppliers/:id", async (req, res) => {
  await db.delete(suppliers).where(eq(suppliers.id, req.params.id));
  res.json({ ok: true });
});

// ─── MATERIALS ────────────────────────────────────────────────────────────────
router.get("/materials", async (_req, res) => {
  const rows = await db.select().from(materials);
  res.json(rows);
});

router.post("/materials", async (req, res) => {
  const [row] = await db.insert(materials).values(req.body).returning();
  res.json(row);
});

router.patch("/materials/:code", async (req, res) => {
  const [row] = await db.update(materials).set(req.body).where(eq(materials.code, req.params.code)).returning();
  res.json(row);
});

router.delete("/materials/:code", async (req, res) => {
  await db.delete(materials).where(eq(materials.code, req.params.code));
  res.json({ ok: true });
});

// ─── FOUNDERS ─────────────────────────────────────────────────────────────────
router.get("/founders", async (_req, res) => {
  const rows = await db.select().from(founders);
  res.json(rows);
});

router.post("/founders", async (req, res) => {
  const [row] = await db.insert(founders).values(req.body).returning();
  res.json(row);
});

router.patch("/founders/:id", async (req, res) => {
  const [row] = await db.update(founders).set(req.body).where(eq(founders.id, req.params.id)).returning();
  res.json(row);
});

router.delete("/founders/:id", async (req, res) => {
  await db.delete(founders).where(eq(founders.id, req.params.id));
  res.json({ ok: true });
});

// ─── ORDERS ───────────────────────────────────────────────────────────────────
router.get("/orders", async (_req, res) => {
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  res.json(rows);
});

router.post("/orders", async (req, res) => {
  const [row] = await db.insert(orders).values(req.body).returning();
  // bump client totalOrders
  await db.update(clients).set({ totalOrders: sql`total_orders + 1` }).where(eq(clients.id, req.body.clientId));
  res.json(row);
});

router.patch("/orders/:id", async (req, res) => {
  const [row] = await db.update(orders).set(req.body).where(eq(orders.id, req.params.id)).returning();
  res.json(row);
});

router.delete("/orders/:id", async (req, res) => {
  await db.delete(orders).where(eq(orders.id, req.params.id));
  res.json({ ok: true });
});

// ─── REQUESTS ─────────────────────────────────────────────────────────────────
router.get("/requests", async (_req, res) => {
  const rows = await db.select().from(requests).orderBy(desc(requests.createdAt));
  res.json(rows);
});

router.post("/requests", async (req, res) => {
  const [row] = await db.insert(requests).values(req.body).returning();
  res.json(row);
});

router.patch("/requests/:id", async (req, res) => {
  const [row] = await db.update(requests).set(req.body).where(eq(requests.id, req.params.id)).returning();
  res.json(row);
});

router.delete("/requests/:id", async (req, res) => {
  await db.delete(requests).where(eq(requests.id, req.params.id));
  res.json({ ok: true });
});

// ─── DELIVERIES ───────────────────────────────────────────────────────────────
router.get("/deliveries", async (_req, res) => {
  const rows = await db.select().from(deliveries).orderBy(desc(deliveries.createdAt));
  res.json(rows);
});

router.post("/deliveries", async (req, res) => {
  const [row] = await db.insert(deliveries).values(req.body).returning();
  res.json(row);
});

router.patch("/deliveries/:id", async (req, res) => {
  const [row] = await db.update(deliveries).set(req.body).where(eq(deliveries.id, req.params.id)).returning();
  res.json(row);
});

router.delete("/deliveries/:id", async (req, res) => {
  await db.delete(deliveries).where(eq(deliveries.id, req.params.id));
  res.json({ ok: true });
});

// ─── COLLECTIONS ──────────────────────────────────────────────────────────────
router.get("/collections", async (_req, res) => {
  const rows = await db.select().from(collections).orderBy(desc(collections.createdAt));
  res.json(rows);
});

router.post("/collections", async (req, res) => {
  const [row] = await db.insert(collections).values(req.body).returning();
  res.json(row);
});

router.patch("/collections/:id", async (req, res) => {
  const [row] = await db.update(collections).set(req.body).where(eq(collections.id, req.params.id)).returning();
  res.json(row);
});

router.delete("/collections/:id", async (req, res) => {
  await db.delete(collections).where(eq(collections.id, req.params.id));
  res.json({ ok: true });
});

// ─── INVENTORY ────────────────────────────────────────────────────────────────
router.get("/inventory", async (_req, res) => {
  const rows = await db.select().from(inventory);
  res.json(rows);
});

router.post("/inventory", async (req, res) => {
  const [row] = await db.insert(inventory).values(req.body).returning();
  res.json(row);
});

router.patch("/inventory/:code", async (req, res) => {
  const [row] = await db.update(inventory).set({ ...req.body, updatedAt: new Date() }).where(eq(inventory.materialCode, req.params.code)).returning();
  res.json(row);
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
router.get("/notifications", async (_req, res) => {
  const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt));
  res.json(rows);
});

router.post("/notifications", async (req, res) => {
  const [row] = await db.insert(notifications).values(req.body).returning();
  res.json(row);
});

router.patch("/notifications/:id", async (req, res) => {
  const [row] = await db.update(notifications).set(req.body).where(eq(notifications.id, req.params.id)).returning();
  res.json(row);
});

router.patch("/notifications/mark-all-read/:userId", async (req, res) => {
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, req.params.userId));
  res.json({ ok: true });
});

// ─── TREASURY ACCOUNTS ────────────────────────────────────────────────────────
router.get("/treasury/accounts", async (_req, res) => {
  const rows = await db.select().from(treasuryAccounts).orderBy(desc(treasuryAccounts.createdAt));
  res.json(rows);
});

router.post("/treasury/accounts", async (req, res) => {
  const [row] = await db.insert(treasuryAccounts).values(req.body).returning();
  res.json(row);
});

router.patch("/treasury/accounts/:id", async (req, res) => {
  const [row] = await db.update(treasuryAccounts).set({ ...req.body, updatedAt: new Date() }).where(eq(treasuryAccounts.id, req.params.id)).returning();
  res.json(row);
});

// ─── TREASURY TRANSACTIONS ────────────────────────────────────────────────────
router.get("/treasury/transactions", async (_req, res) => {
  const rows = await db.select().from(treasuryTransactions).orderBy(desc(treasuryTransactions.createdAt));
  res.json(rows);
});

router.post("/treasury/transactions", async (req, res) => {
  const { newBalance, linkedNewBalance, ...txData } = req.body;
  const [row] = await db.insert(treasuryTransactions).values(txData).returning();
  // Update account balance
  if (newBalance !== undefined) {
    await db.update(treasuryAccounts).set({ balance: String(newBalance), updatedAt: new Date() }).where(eq(treasuryAccounts.id, txData.accountId));
  }
  if (linkedNewBalance !== undefined && txData.linkedAccountId) {
    await db.update(treasuryAccounts).set({ balance: String(linkedNewBalance), updatedAt: new Date() }).where(eq(treasuryAccounts.id, txData.linkedAccountId));
  }
  res.json(row);
});

export default router;
