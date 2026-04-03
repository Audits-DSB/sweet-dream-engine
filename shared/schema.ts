import { pgTable, text, integer, numeric, boolean, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  city: text("city").notNull().default(""),
  status: text("status").notNull().default("Active"),
  joinDate: text("join_date").notNull().default(""),
  totalOrders: integer("total_orders").notNull().default(0),
  outstanding: numeric("outstanding", { precision: 14, scale: 2 }).notNull().default("0"),
  lastAudit: text("last_audit").notNull().default(""),
});

export const suppliers = pgTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  website: text("website").notNull().default(""),
  paymentTerms: text("payment_terms").notNull().default("Net 30"),
  active: boolean("active").notNull().default(true),
});

export const materials = pgTable("materials", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default(""),
  unit: text("unit").notNull().default(""),
  sellingPrice: numeric("selling_price", { precision: 14, scale: 2 }).notNull().default("0"),
  storeCost: numeric("store_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  supplier: text("supplier").notNull().default(""),
  supplierId: text("supplier_id").notNull().default(""),
  manufacturer: text("manufacturer").notNull().default(""),
  hasExpiry: boolean("has_expiry").notNull().default(false),
  active: boolean("active").notNull().default(true),
});

export const founders = pgTable("founders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  alias: text("alias").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  client: text("client").notNull(),
  clientId: text("client_id").notNull().default(""),
  date: text("date").notNull().default(""),
  lines: integer("lines").notNull().default(0),
  totalSelling: text("total_selling").notNull().default("0 ج.م"),
  totalCost: text("total_cost").notNull().default("0 ج.م"),
  splitMode: text("split_mode").notNull().default("متساوي"),
  deliveryFee: numeric("delivery_fee", { precision: 14, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("Draft"),
  source: text("source").notNull().default("يدوي"),
  deliveryFeeBearer: text("delivery_fee_bearer").notNull().default("client"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const requests = pgTable("requests", {
  id: text("id").primaryKey(),
  client: text("client").notNull(),
  clientId: text("client_id").notNull().default(""),
  date: text("date").notNull().default(""),
  items: integer("items").notNull().default(0),
  totalValue: text("total_value").notNull().default("0 ج.م"),
  priority: text("priority").notNull().default("Medium"),
  status: text("status").notNull().default("Pending"),
  convertedOrderId: text("converted_order_id"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const deliveries = pgTable("deliveries", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().default(""),
  client: text("client").notNull(),
  clientId: text("client_id").notNull().default(""),
  date: text("date").notNull().default(""),
  scheduledDate: text("scheduled_date").notNull().default(""),
  status: text("status").notNull().default("Scheduled"),
  deliveredBy: text("delivered_by").notNull().default(""),
  deliveryFee: numeric("delivery_fee", { precision: 14, scale: 2 }).notNull().default("0"),
  items: integer("items").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const collections = pgTable("collections", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().default(""),
  client: text("client").notNull(),
  clientId: text("client_id").notNull().default(""),
  invoiceDate: text("invoice_date").notNull().default(""),
  dueDate: text("due_date").notNull().default(""),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  outstanding: numeric("outstanding", { precision: 14, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("Pending"),
  paymentMethod: text("payment_method").notNull().default("-"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const companyInventory = pgTable("company_inventory", {
  id: text("id").primaryKey(),
  materialCode: text("material_code").notNull().default(""),
  materialName: text("material_name").notNull().default(""),
  unit: text("unit").notNull().default(""),
  lotNumber: text("lot_number").notNull().default(""),
  quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull().default("0"),
  remaining: numeric("remaining", { precision: 14, scale: 2 }).notNull().default("0"),
  costPrice: numeric("cost_price", { precision: 14, scale: 2 }).notNull().default("0"),
  sourceOrder: text("source_order").notNull().default(""),
  dateAdded: text("date_added").notNull().default(""),
  status: text("status").notNull().default("In Stock"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const inventory = pgTable("inventory", {
  materialCode: text("material_code").primaryKey(),
  materialName: text("material_name").notNull(),
  category: text("category").notNull().default(""),
  totalStock: integer("total_stock").notNull().default(0),
  reorderPoint: integer("reorder_point").notNull().default(0),
  lots: jsonb("lots").notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const clientInventory = pgTable("client_inventory", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().default(""),
  clientName: text("client_name").notNull().default(""),
  material: text("material").notNull().default(""),
  code: text("code").notNull().default(""),
  unit: text("unit").notNull().default(""),
  delivered: numeric("delivered", { precision: 14, scale: 2 }).notNull().default("0"),
  remaining: numeric("remaining", { precision: 14, scale: 2 }).notNull().default("0"),
  sellingPrice: numeric("selling_price", { precision: 14, scale: 2 }).notNull().default("0"),
  storeCost: numeric("store_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  deliveryDate: text("delivery_date").notNull().default(""),
  expiry: text("expiry").notNull().default(""),
  sourceOrder: text("source_order").notNull().default(""),
  status: text("status").notNull().default("In Stock"),
  avgWeeklyUsage: numeric("avg_weekly_usage", { precision: 14, scale: 2 }).notNull().default("0"),
  leadTimeWeeks: numeric("lead_time_weeks", { precision: 14, scale: 2 }).notNull().default("2"),
  safetyStock: numeric("safety_stock", { precision: 14, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const audits = pgTable("audits", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().default(""),
  clientName: text("client_name").notNull().default(""),
  date: text("date").notNull().default(""),
  auditor: text("auditor").notNull().default(""),
  totalItems: integer("total_items").notNull().default(0),
  matched: integer("matched").notNull().default(0),
  shortage: integer("shortage").notNull().default(0),
  surplus: integer("surplus").notNull().default(0),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("Completed"),
  comparison: jsonb("comparison").notNull().default([]),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  type: text("type").notNull().default("info"),
  title: text("title").notNull(),
  message: text("message").notNull().default(""),
  date: text("date").notNull().default(""),
  time: text("time").notNull().default(""),
  read: boolean("read").notNull().default(false),
  userId: text("user_id").notNull().default(""),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const treasuryAccounts = pgTable("treasury_accounts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  accountType: text("account_type").notNull().default("cashbox"),
  custodianName: text("custodian_name").notNull().default(""),
  custodianUserId: text("custodian_user_id"),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  description: text("description"),
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const treasuryTransactions = pgTable("treasury_transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: uuid("account_id").notNull().references(() => treasuryAccounts.id, { onDelete: "cascade" }),
  txType: text("tx_type").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 14, scale: 2 }).notNull().default("0"),
  category: text("category"),
  description: text("description"),
  referenceId: text("reference_id"),
  linkedAccountId: uuid("linked_account_id"),
  performedBy: text("performed_by"),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const returns = pgTable("returns", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  clientId: text("client_id").notNull().default(""),
  clientName: text("client_name").notNull().default(""),
  returnDate: text("return_date").notNull().default(""),
  reason: text("reason").notNull().default(""),
  status: text("status").notNull().default("pending"),
  totalValue: numeric("total_value", { precision: 14, scale: 2 }).notNull().default("0"),
  totalCost: numeric("total_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  disposition: text("disposition").notNull().default(""),
  refundStatus: text("refund_status").notNull().default("none"),
  refundAmount: numeric("refund_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  items: jsonb("items").notNull().default([]),
  notes: text("notes").notNull().default(""),
  processedBy: text("processed_by").notNull().default(""),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});
