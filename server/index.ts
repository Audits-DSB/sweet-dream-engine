import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createClient } from "@supabase/supabase-js";
import apiRouter from "./routes";
import {
  clientsList, suppliersList, materialsList, foundersList,
  ordersList, requestsList, deliveriesList, collectionsList,
  inventoryList, notificationsList,
} from "../src/data/store";

// ─── Environment validation ───────────────────────────────────────────────────
const REQUIRED_ENV = ["VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
  console.error("\n❌ MISSING REQUIRED ENVIRONMENT VARIABLES:");
  missingEnv.forEach(k => console.error("   -", k));
  console.error("\nSet these in Cloud Run: Edit & Deploy → Variables & Secrets\n");
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT || 5000);
const VITE_PORT = 5001;
const isProduction = process.env.NODE_ENV === "production";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "../dist");
const indexPath = path.join(distPath, "index.html");

app.use(cors());
app.use(express.json());
app.use("/api", apiRouter);
app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function seedIfEmpty() {
  const { data: existing } = await supabaseAdmin.from("clients").select("id").limit(1);
  if (existing && existing.length > 0) {
    console.log("✅ Supabase already has data — skipping seed.");
    return;
  }

  console.log("🌱 Seeding initial data into Supabase...");

  await supabaseAdmin.from("clients").upsert(clientsList.map(c => ({
    id: c.id, name: c.name, contact: c.contact, email: c.email,
    phone: c.phone, city: c.city, status: c.status, join_date: c.joinDate,
    total_orders: c.totalOrders, outstanding: String(c.outstanding), last_audit: c.lastAudit,
  })));

  await supabaseAdmin.from("suppliers").upsert(suppliersList.map(s => ({
    id: s.id, name: s.name, country: s.country, email: s.email,
    phone: s.phone, website: s.website, payment_terms: s.paymentTerms, active: s.active,
  })));

  await supabaseAdmin.from("materials").upsert(materialsList.map(m => ({
    code: m.code, name: m.name, category: m.category, unit: m.unit,
    selling_price: String(m.sellingPrice), store_cost: String(m.storeCost),
    supplier: m.supplier, supplier_id: m.supplierId, manufacturer: m.manufacturer,
    has_expiry: m.hasExpiry, active: m.active,
  })));

  await supabaseAdmin.from("orders").upsert(ordersList.map(o => ({
    id: o.id, client: o.client, client_id: o.clientId, date: o.date,
    lines: o.lines, total_selling: o.totalSelling, total_cost: o.totalCost,
    split_mode: o.splitMode, delivery_fee: String(o.deliveryFee), status: o.status, source: o.source,
  })));

  await supabaseAdmin.from("requests").upsert(requestsList.map(r => ({
    id: r.id, client: r.client, client_id: r.clientId, date: r.date,
    items: r.items, total_value: r.totalValue, priority: r.priority,
    status: r.status, converted_order_id: r.convertedOrderId ?? null, notes: r.notes,
  })));

  await supabaseAdmin.from("deliveries").upsert(deliveriesList.map(d => ({
    id: d.id, order_id: d.orderId, client: d.client, client_id: d.clientId,
    date: d.date, scheduled_date: d.scheduledDate, status: d.status,
    delivered_by: d.deliveredBy, delivery_fee: String(d.deliveryFee),
    items: d.items, notes: d.notes,
  })));

  await supabaseAdmin.from("collections").upsert(collectionsList.map(c => ({
    id: c.id, order_id: c.orderId, client: c.client, client_id: c.clientId,
    invoice_date: c.invoiceDate, due_date: c.dueDate, total_amount: String(c.totalAmount),
    paid_amount: String(c.paidAmount), outstanding: String(c.outstanding),
    status: c.status, payment_method: c.paymentMethod, notes: c.notes,
  })));

  await supabaseAdmin.from("inventory").upsert(inventoryList.map(i => ({
    material_code: i.materialCode, material_name: i.materialName,
    category: i.category, total_stock: i.totalStock, reorder_point: i.reorderPoint,
    lots: i.lots,
  })));

  await supabaseAdmin.from("notifications").upsert(notificationsList.map(n => ({
    id: n.id, type: n.type, title: n.title, message: n.message,
    date: n.date, time: n.time, read: n.read, user_id: "",
  })));

  // Seed treasury accounts with fixed UUIDs so we can reference them for transactions
  const acc1Id = "11111111-1111-1111-1111-111111111111";
  const acc2Id = "22222222-2222-2222-2222-222222222222";
  const acc3Id = "33333333-3333-3333-3333-333333333333";

  await supabaseAdmin.from("treasury_accounts").upsert([
    { id: acc1Id, name: "الصندوق الرئيسي", account_type: "cashbox", custodian_name: "أحمد الراشد", balance: 850000, is_active: true },
    { id: acc2Id, name: "حساب الراتب - سارة", account_type: "cashbox", custodian_name: "سارة المنصور", balance: 420000, is_active: true },
    { id: acc3Id, name: "بنك الأهلي", account_type: "bank", custodian_name: "عمر خليل", bank_name: "البنك الأهلي المصري", balance: 1250000, is_active: true },
  ]);

  await supabaseAdmin.from("treasury_transactions").insert([
    { account_id: acc1Id, tx_type: "inflow", amount: 850000, balance_after: 850000, category: "revenue", description: "إيرادات مارس" },
    { account_id: acc2Id, tx_type: "inflow", amount: 420000, balance_after: 420000, category: "revenue", description: "إيرادات فبراير" },
    { account_id: acc3Id, tx_type: "inflow", amount: 1250000, balance_after: 1250000, category: "revenue", description: "إيرادات يناير" },
    { account_id: acc1Id, tx_type: "expense", amount: -45000, balance_after: 805000, category: "logistics", description: "مصاريف توصيل" },
    { account_id: acc1Id, tx_type: "expense", amount: -30000, balance_after: 775000, category: "marketing", description: "إعلانات ومسوقون" },
    { account_id: acc2Id, tx_type: "withdrawal", amount: -85000, balance_after: 335000, category: "salaries", description: "رواتب شهر مارس" },
  ]);

  console.log("✅ Seeding complete!");
}

if (isProduction) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health" || req.method !== "GET") {
      next();
      return;
    }

    res.sendFile(indexPath);
  });
} else {
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
}

async function ensureCompanyInventoryTable() {
  try {
    await supabaseAdmin.rpc("exec_sql", { sql_text: `
      CREATE TABLE IF NOT EXISTS company_inventory (
        id text PRIMARY KEY,
        material_code text NOT NULL DEFAULT '',
        material_name text NOT NULL DEFAULT '',
        unit text NOT NULL DEFAULT '',
        lot_number text NOT NULL DEFAULT '',
        quantity numeric(14,2) NOT NULL DEFAULT 0,
        remaining numeric(14,2) NOT NULL DEFAULT 0,
        cost_price numeric(14,2) NOT NULL DEFAULT 0,
        source_order text NOT NULL DEFAULT '',
        date_added text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'In Stock',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'client';
      ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS from_inventory boolean NOT NULL DEFAULT false;
      ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS inventory_lot_id text DEFAULT '';
    ` });
  } catch {
    try {
      await supabaseAdmin.from("company_inventory").select("id").limit(1);
    } catch {
      console.warn("[startup] company_inventory table may not exist — create it in Supabase SQL editor.");
    }
  }
}

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await ensureCompanyInventoryTable();
  await seedIfEmpty();
});
