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
const __filename = typeof __dirname !== "undefined" ? __dirname + "/index.ts" : fileURLToPath(import.meta.url);
const __dirnameResolved = typeof __dirname !== "undefined" ? __dirname : path.dirname(__filename);
const distPath = path.resolve(__dirnameResolved, "../dist");
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

async function reloadSupabaseSchemaCache() {
  try {
    await supabaseAdmin.rpc("exec_sql", { sql_text: "NOTIFY pgrst, 'reload schema'" });
    console.log("✅ Supabase schema cache reloaded via NOTIFY.");
  } catch (e1) {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql_text: "NOTIFY pgrst, 'reload schema'" }),
      });
      if (resp.ok) console.log("✅ Supabase schema cache reloaded via fetch.");
      else console.warn("⚠️ Schema cache reload returned:", resp.status);
    } catch {
      console.warn("⚠️ Could not reload Supabase schema cache. Run in SQL Editor: NOTIFY pgrst, 'reload schema';");
    }
  }
}

async function ensureDeliveryFeePaidByFounderColumn() {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" };
  try {
    const checkResp = await fetch(`${url}/rest/v1/orders?select=delivery_fee_paid_by_founder&limit=1`, { headers });
    if (checkResp.ok) {
      console.log("✅ delivery_fee_paid_by_founder column already exists on orders");
    } else {
      const sqlResp = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ sql_text: "ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee_paid_by_founder text DEFAULT NULL;" }),
      });
      if (sqlResp.ok) {
        console.log("✅ Added delivery_fee_paid_by_founder column to orders via RPC");
        await reloadSupabaseSchemaCache();
      } else {
        console.warn("⚠️ Could not add delivery_fee_paid_by_founder to orders automatically. Run in Supabase SQL Editor: ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee_paid_by_founder text DEFAULT NULL;");
      }
    }
  } catch (e: any) {
    console.warn("⚠️ delivery_fee_paid_by_founder column check failed:", e.message);
  }
}

async function ensureOrderCostPaidByFounderColumn() {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" };
  try {
    const checkResp = await fetch(`${url}/rest/v1/orders?select=order_cost_paid_by_founder&limit=1`, { headers });
    if (checkResp.ok) {
      console.log("✅ order_cost_paid_by_founder column already exists on orders");
    } else {
      const sqlResp = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ sql_text: "ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_cost_paid_by_founder text DEFAULT NULL;" }),
      });
      if (sqlResp.ok) {
        console.log("✅ Added order_cost_paid_by_founder column to orders via RPC");
        await reloadSupabaseSchemaCache();
      } else {
        console.warn("⚠️ Could not add order_cost_paid_by_founder to orders automatically. Run in Supabase SQL Editor: ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_cost_paid_by_founder text DEFAULT NULL;");
      }
    }
  } catch (e: any) {
    console.warn("⚠️ order_cost_paid_by_founder column check failed:", e.message);
  }
}

async function ensureSupplierIdColumn() {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" };
  try {
    const checkResp = await fetch(`${url}/rest/v1/company_inventory?select=supplier_id&limit=1`, { headers });
    if (checkResp.ok) {
      console.log("✅ supplier_id column already exists on company_inventory");
    } else {
      const sqlResp = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ sql_text: "ALTER TABLE public.company_inventory ADD COLUMN IF NOT EXISTS supplier_id text DEFAULT '';" }),
      });
      if (sqlResp.ok) console.log("✅ Added supplier_id column to company_inventory via RPC");
      else console.warn("⚠️ Could not add supplier_id to company_inventory automatically.");
    }
  } catch (e: any) {
    console.warn("⚠️ supplier_id column check failed:", e.message);
  }
  try {
    const checkResp2 = await fetch(`${url}/rest/v1/order_lines?select=supplier_id&limit=1`, { headers });
    if (checkResp2.ok) {
      console.log("✅ supplier_id column already exists on order_lines");
    } else {
      const sqlResp2 = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ sql_text: "ALTER TABLE public.order_lines ADD COLUMN IF NOT EXISTS supplier_id text DEFAULT '';" }),
      });
      if (sqlResp2.ok) {
        console.log("✅ Added supplier_id column to order_lines via RPC");
        await reloadSupabaseSchemaCache();
      } else {
        console.warn("⚠️ Could not add supplier_id to order_lines automatically. Run in Supabase SQL Editor: ALTER TABLE public.order_lines ADD COLUMN IF NOT EXISTS supplier_id text DEFAULT '';");
      }
    }
  } catch (e: any) {
    console.warn("⚠️ order_lines supplier_id check failed:", e.message);
  }
}

async function ensureReturnsTable() {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers: Record<string, string> = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", "Content-Type": "application/json", Prefer: "return=minimal" };
  try {
    const checkResp = await fetch(`${url}/rest/v1/returns?select=id&limit=1`, { headers });
    if (checkResp.ok) {
      console.log("✅ returns table already exists");
      return;
    }

    const sqlStatements = [
      `CREATE TABLE IF NOT EXISTS public.returns (id text PRIMARY KEY, order_id text NOT NULL, client_id text NOT NULL DEFAULT '', client_name text NOT NULL DEFAULT '', return_date text NOT NULL DEFAULT '', reason text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'pending', total_value numeric(14,2) NOT NULL DEFAULT 0, total_cost numeric(14,2) NOT NULL DEFAULT 0, disposition text NOT NULL DEFAULT '', refund_status text NOT NULL DEFAULT 'none', refund_amount numeric(14,2) NOT NULL DEFAULT 0, items jsonb NOT NULL DEFAULT '[]'::jsonb, notes text NOT NULL DEFAULT '', processed_by text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now())`,
      `ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY`,
      `CREATE POLICY "service_role_all_returns" ON public.returns FOR ALL TO service_role USING (true) WITH CHECK (true)`,
    ];

    let created = false;
    for (const rpcName of ["exec_sql", "execute_sql", "run_sql"]) {
      for (const paramName of ["sql_text", "sql", "query"]) {
        try {
          const { error } = await supabaseAdmin.rpc(rpcName, { [paramName]: sqlStatements[0] });
          if (!error) {
            for (let i = 1; i < sqlStatements.length; i++) {
              await supabaseAdmin.rpc(rpcName, { [paramName]: sqlStatements[i] }).catch(() => {});
            }
            console.log(`✅ Created returns table via RPC ${rpcName}(${paramName})`);
            await reloadSupabaseSchemaCache();
            created = true;
            break;
          }
        } catch {}
      }
      if (created) break;
    }

    if (!created) {
      const mgmtUrl = url.replace(".supabase.co", ".supabase.co").replace("https://", "");
      const projectRef = mgmtUrl.split(".")[0];
      console.warn(`⚠️ Could not create returns table automatically.`);
      console.warn(`   Please run this SQL in your Supabase SQL Editor (project: ${projectRef}):`);
      console.warn(`   ${sqlStatements[0]};`);
      console.warn(`   ${sqlStatements[1]};`);
      console.warn(`   ${sqlStatements[2]};`);
    }
  } catch (e: any) {
    console.warn("⚠️ returns table check failed:", e.message);
  }
}

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await reloadSupabaseSchemaCache();
  await ensureReturnsTable();
  await ensureDeliveryFeePaidByFounderColumn();
  await ensureOrderCostPaidByFounderColumn();
  await ensureSupplierIdColumn();
  await seedIfEmpty();
});
