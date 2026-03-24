import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

const router = Router();

// ─── EXTERNAL MATERIALS PROXY (queries the Lovable/catalog Supabase project) ──
router.get("/external-materials", async (_req, res) => {
  try {
    const extUrl = process.env.EXTERNAL_SUPABASE_URL;
    const extKey = process.env.EXTERNAL_SUPABASE_ANON_KEY;
    if (!extUrl || !extKey) {
      console.error("External Supabase credentials not configured");
      return res.json({ products: [] });
    }
    const extClient = createClient(extUrl, extKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await extClient.from("products").select("*").order("created_at");
    if (error) {
      console.error("External materials query error:", error.message);
      return res.json({ products: [] });
    }
    res.json({ products: data ?? [], count: data?.length ?? 0 });
  } catch (err: any) {
    console.error("External materials fetch failed:", err.message);
    res.json({ products: [] });
  }
});

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── Local PG pool (for tables created in Replit's PostgreSQL) ────────────────
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Startup: ensure local tables exist ──────────────────────────────────────
pgPool.query(`
  CREATE TABLE IF NOT EXISTS delivery_actors (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT DEFAULT 'external',
    phone       TEXT,
    email       TEXT,
    active      BOOLEAN DEFAULT TRUE,
    founder_id  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )
`).catch((e: any) => console.error("delivery_actors table init error:", e.message));

pgPool.query(`
  CREATE TABLE IF NOT EXISTS order_lines (
    id           SERIAL PRIMARY KEY,
    order_id     TEXT NOT NULL,
    material_code TEXT,
    material_name TEXT,
    image_url    TEXT,
    unit         TEXT DEFAULT 'unit',
    quantity     NUMERIC DEFAULT 1,
    selling_price NUMERIC DEFAULT 0,
    cost_price   NUMERIC DEFAULT 0,
    line_total   NUMERIC DEFAULT 0,
    line_cost    NUMERIC DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW()
  )
`).catch((e: any) => console.error("order_lines table init error:", e.message));

// ─── camelCase ↔ snake_case helpers ──────────────────────────────────────────
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const toSnake = (s: string) => s.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);

function camelizeKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(camelizeKeys);
  if (!obj || typeof obj !== "object") return obj;
  if (obj instanceof Date) return obj.toISOString();
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toCamel(k), camelizeKeys(v)]));
}

function snakifyKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(snakifyKeys);
  if (!obj || typeof obj !== "object") return obj;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toSnake(k), snakifyKeys(v)]));
}

function sbOk(res: any, { data, error }: { data: any; error: any }) {
  if (error) { console.error("[Supabase Error]", error.message); return res.status(500).json({ error: error.message }); }
  return res.json(camelizeKeys(data));
}

// ─── CLIENTS ─────────────────────────────────────────────────────────────────
router.get("/clients", async (_req, res) => {
  sbOk(res, await supabaseAdmin.from("clients").select("*").order("name"));
});
router.post("/clients", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("clients").insert(snakifyKeys(req.body)).select().single());
});
router.patch("/clients/:id", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("clients").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single());
});
router.delete("/clients/:id", async (req, res) => {
  const { error } = await supabaseAdmin.from("clients").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────
router.get("/suppliers", async (_req, res) => {
  sbOk(res, await supabaseAdmin.from("suppliers").select("*").order("name"));
});
router.post("/suppliers", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("suppliers").insert(snakifyKeys(req.body)).select().single());
});
router.patch("/suppliers/:id", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("suppliers").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single());
});
router.delete("/suppliers/:id", async (req, res) => {
  const { error } = await supabaseAdmin.from("suppliers").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ─── MATERIALS ────────────────────────────────────────────────────────────────
router.get("/materials", async (_req, res) => {
  sbOk(res, await supabaseAdmin.from("materials").select("*").order("name"));
});
router.post("/materials", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("materials").insert(snakifyKeys(req.body)).select().single());
});
router.patch("/materials/:code", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("materials").update(snakifyKeys(req.body)).eq("code", req.params.code).select().single());
});
router.delete("/materials/:code", async (req, res) => {
  const { error } = await supabaseAdmin.from("materials").delete().eq("code", req.params.code);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ─── SUPPLIER MATERIALS ───────────────────────────────────────────────────────
router.get("/suppliers/:id/materials", async (req, res) => {
  try {
    const { rows } = await pgPool.query("SELECT * FROM supplier_materials WHERE supplier_id=$1 ORDER BY material_name", [req.params.id]);
    res.json(rows.map(camelizeKeys));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post("/suppliers/:id/materials", async (req, res) => {
  const { materialCode, materialName } = req.body;
  try {
    await pgPool.query(
      "INSERT INTO supplier_materials (supplier_id, material_code, material_name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
      [req.params.id, materialCode, materialName || ""]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete("/suppliers/:id/materials/:code", async (req, res) => {
  try {
    await pgPool.query("DELETE FROM supplier_materials WHERE supplier_id=$1 AND material_code=$2", [req.params.id, req.params.code]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── FOUNDERS ─────────────────────────────────────────────────────────────────
router.get("/founders", async (_req, res) => {
  sbOk(res, await supabaseAdmin.from("founders").select("*").order("name"));
});
router.post("/founders", async (req, res) => {
  const result = await supabaseAdmin.from("founders").insert(snakifyKeys(req.body)).select().single();
  if (!result.error && result.data) {
    const f = result.data;
    const actorId = `ACT-F-${f.id}`;
    // Auto-create delivery actor for this founder (ignore if already exists)
    await pgPool.query(
      `INSERT INTO delivery_actors (id, name, type, phone, email, active, founder_id)
       VALUES ($1, $2, 'founder', $3, $4, TRUE, $5)
       ON CONFLICT (id) DO NOTHING`,
      [actorId, f.name || "", f.phone || "", f.email || "", f.id]
    ).catch(() => {});
  }
  sbOk(res, result);
});
router.patch("/founders/:id", async (req, res) => {
  const result = await supabaseAdmin.from("founders").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single();
  if (!result.error && result.data) {
    const f = result.data;
    const actorId = `ACT-F-${f.id}`;
    await pgPool.query(
      `UPDATE delivery_actors SET name=$1, phone=$2, email=$3 WHERE id=$4`,
      [f.name || "", f.phone || "", f.email || "", actorId]
    ).catch(() => {});
  }
  sbOk(res, result);
});
router.delete("/founders/:id", async (req, res) => {
  const { error } = await supabaseAdmin.from("founders").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  // Remove associated delivery actor
  await pgPool.query("DELETE FROM delivery_actors WHERE founder_id = $1", [req.params.id]).catch(() => {});
  res.json({ ok: true });
});

// ─── DELIVERY ACTORS ──────────────────────────────────────────────────────────
router.get("/delivery-actors/sync-founders", async (_req, res) => {
  try {
    const { data: founders } = await supabaseAdmin.from("founders").select("id,name,phone,email,active");
    for (const f of founders || []) {
      const actorId = `ACT-F-${f.id}`;
      await pgPool.query(
        `INSERT INTO delivery_actors (id, name, type, phone, email, active, founder_id)
         VALUES ($1,$2,'founder',$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET name=$2, phone=$3, email=$4, active=$5`,
        [actorId, f.name || "", f.phone || "", f.email || "", f.active !== false, f.id]
      ).catch(() => {});
    }
    const { rows } = await pgPool.query("SELECT * FROM delivery_actors ORDER BY type DESC, name");
    res.json(rows.map(camelizeKeys));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get("/delivery-actors", async (_req, res) => {
  try {
    const { rows } = await pgPool.query("SELECT * FROM delivery_actors ORDER BY type DESC, name");
    res.json(rows.map(camelizeKeys));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post("/delivery-actors", async (req, res) => {
  const { id, name, type, phone, email, active, founderId } = req.body;
  const newId = id || `ACT-${Date.now()}`;
  try {
    const { rows } = await pgPool.query(
      `INSERT INTO delivery_actors (id, name, type, phone, email, active, founder_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [newId, name || "", type || "external", phone || "", email || "", active !== false, founderId || null]
    );
    res.json(camelizeKeys(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.patch("/delivery-actors/:id", async (req, res) => {
  const { name, type, phone, email, active } = req.body;
  try {
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (name !== undefined)   { sets.push(`name=$${i++}`);   vals.push(name); }
    if (type !== undefined)   { sets.push(`type=$${i++}`);   vals.push(type); }
    if (phone !== undefined)  { sets.push(`phone=$${i++}`);  vals.push(phone); }
    if (email !== undefined)  { sets.push(`email=$${i++}`);  vals.push(email); }
    if (active !== undefined) { sets.push(`active=$${i++}`); vals.push(active); }
    if (!sets.length) return res.json({ ok: true });
    vals.push(req.params.id);
    const { rows } = await pgPool.query(
      `UPDATE delivery_actors SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, vals
    );
    res.json(camelizeKeys(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete("/delivery-actors/:id", async (req, res) => {
  try {
    await pgPool.query("DELETE FROM delivery_actors WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── ORDERS ───────────────────────────────────────────────────────────────────
router.get("/orders/next-id", async (_req, res) => {
  const { data } = await supabaseAdmin.from("orders").select("id").order("created_at", { ascending: false }).limit(100);
  let max = 0;
  for (const row of data || []) {
    const n = parseInt((row.id as string).replace(/[^0-9]/g, "")) || 0;
    if (n > max) max = n;
  }
  res.json({ nextId: `ORD-${String(max + 1).padStart(3, "0")}` });
});
router.get("/orders", async (_req, res) => {
  const [ordersRes, clientsRes] = await Promise.all([
    supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("clients").select("id,name"),
  ]);
  if (ordersRes.error) return res.status(400).json({ error: ordersRes.error.message });
  const clientMap: Record<string, string> = {};
  for (const c of clientsRes.data || []) clientMap[c.id] = c.name || c.id;
  const orders = (ordersRes.data || []).map(o => ({
    ...o,
    client: clientMap[o.client_id] || o.client_id || "",
  }));
  res.json(camelizeKeys(orders));
});
router.post("/orders", async (req, res) => {
  const { items, ...orderBody } = req.body;
  const data = snakifyKeys(orderBody);
  const result = await supabaseAdmin.from("orders").insert(data).select().single();
  if (result.error) return res.status(400).json({ error: result.error.message });
  if (!result.error && data.client_id) {
    try { await supabaseAdmin.rpc("increment_client_orders", { cid: data.client_id }); } catch { /* ignore */ }
  }
  const orderId = result.data.id;
  if (Array.isArray(items) && items.length > 0) {
    const values = items.map((item: any) => [
      orderId,
      String(item.materialCode || ""),
      String(item.name || ""),
      String(item.imageUrl || ""),
      String(item.unit || "unit"),
      Number(item.quantity) || 1,
      Number(item.sellingPrice) || 0,
      Number(item.costPrice) || 0,
      (Number(item.sellingPrice) || 0) * (Number(item.quantity) || 1),
      (Number(item.costPrice) || 0) * (Number(item.quantity) || 1),
    ]);
    const placeholders = values.map((_, i) =>
      `($${i * 10 + 1},$${i * 10 + 2},$${i * 10 + 3},$${i * 10 + 4},$${i * 10 + 5},$${i * 10 + 6},$${i * 10 + 7},$${i * 10 + 8},$${i * 10 + 9},$${i * 10 + 10})`
    ).join(",");
    try {
      await pgPool.query(
        `INSERT INTO order_lines (order_id,material_code,material_name,image_url,unit,quantity,selling_price,cost_price,line_total,line_cost) VALUES ${placeholders}`,
        values.flat()
      );
    } catch (e: any) {
      console.error("order_lines insert error for", orderId, ":", e.message);
      return res.status(207).json({ ...camelizeKeys(result.data), _linesError: e.message });
    }
  }
  res.json(camelizeKeys(result.data));
});
router.get("/orders/:id/lines", async (req, res) => {
  try {
    const { rows } = await pgPool.query(
      "SELECT * FROM order_lines WHERE order_id = $1 ORDER BY id",
      [req.params.id]
    );
    res.json(rows.map(camelizeKeys));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
router.patch("/orders/:id", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("orders").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single());
});
router.delete("/orders/:id", async (req, res) => {
  const { error } = await supabaseAdmin.from("orders").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  await pgPool.query("DELETE FROM order_lines WHERE order_id = $1", [req.params.id]).catch(() => {});
  res.json({ ok: true });
});

// ─── ALERTS (generated from real data) ───────────────────────────────────────
router.get("/alerts", async (_req, res) => {
  try {
    const today = new Date();
    const alerts: any[] = [];

    const [ordersResult, collectionsResult, clientsResult, inventoryResult] = await Promise.all([
      supabaseAdmin.from("orders").select("id,status,date,client_id,total_selling,created_at"),
      supabaseAdmin.from("collections").select("id,status,due_date,client_id,client_name,amount,total,created_at"),
      supabaseAdmin.from("clients").select("id,name"),
      supabaseAdmin.from("inventory").select("material_code,material_name,quantity,min_quantity,expiry_date"),
    ]);

    const clientMap: Record<string, string> = {};
    for (const c of clientsResult.data || []) clientMap[c.id] = c.name || c.id;

    for (const order of ordersResult.data || []) {
      if (order.status === "Ready for Delivery" || order.status === "Confirmed") {
        const orderDate = new Date(order.date || order.created_at);
        const daysOld = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
        const clientName = clientMap[order.client_id] || order.client_id || "";
        alerts.push({
          id: `delivery-${order.id}`,
          type: "delivery",
          severity: daysOld >= 3 ? "warning" : "info",
          title: `توصيل معلق — ${order.id}`,
          description: clientName ? `${clientName} — ${order.status} منذ ${daysOld} يوم` : `${order.status} منذ ${daysOld} يوم`,
          date: order.date || (order.created_at || "").split("T")[0],
          link: `/orders/${order.id}`,
          clientId: order.client_id,
        });
      }
    }

    for (const col of collectionsResult.data || []) {
      const isOverdue = col.status === "Overdue" || col.status === "overdue" ||
        (col.due_date && new Date(col.due_date) < today && col.status !== "Paid" && col.status !== "paid");
      if (isOverdue) {
        const amount = col.amount || col.total || 0;
        const clientName = col.client_name || clientMap[col.client_id] || col.client_id || "";
        alerts.push({
          id: `overdue-${col.id}`,
          type: "overdue",
          severity: "critical",
          title: `فاتورة متأخرة — ${col.id}`,
          description: clientName ? `${clientName} — ${Number(amount).toLocaleString()} ج.م متأخرة` : `${Number(amount).toLocaleString()} ج.م متأخرة`,
          date: col.due_date || (col.created_at || "").split("T")[0],
          link: "/collections",
          clientId: col.client_id,
        });
      }
    }

    for (const item of inventoryResult.data || []) {
      const qty = Number(item.quantity || 0);
      const minQty = Number(item.min_quantity || 5);
      if (qty <= minQty) {
        alerts.push({
          id: `stock-${item.material_code}`,
          type: "low_stock",
          severity: qty === 0 ? "critical" : "warning",
          title: `مخزون منخفض — ${item.material_name || item.material_code}`,
          description: `متبقي ${qty} وحدة${minQty ? ` (الحد الأدنى: ${minQty})` : ""}`,
          date: today.toISOString().split("T")[0],
          link: "/inventory",
        });
      }
      if (item.expiry_date) {
        const expiry = new Date(item.expiry_date);
        const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 60 && daysLeft >= 0) {
          alerts.push({
            id: `expiry-${item.material_code}`,
            type: "expiry",
            severity: daysLeft <= 14 ? "critical" : "warning",
            title: `قارب على الانتهاء — ${item.material_name || item.material_code}`,
            description: `ينتهي في ${item.expiry_date} (${daysLeft} يوم)`,
            date: today.toISOString().split("T")[0],
            link: "/inventory",
          });
        } else if (daysLeft < 0) {
          alerts.push({
            id: `expired-${item.material_code}`,
            type: "expiry",
            severity: "critical",
            title: `منتهي الصلاحية — ${item.material_name || item.material_code}`,
            description: `انتهى في ${item.expiry_date}`,
            date: today.toISOString().split("T")[0],
            link: "/inventory",
          });
        }
      }
    }

    res.json(alerts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── REQUESTS ─────────────────────────────────────────────────────────────────
router.get("/requests", async (_req, res) => {
  sbOk(res, await supabaseAdmin.from("requests").select("*").order("created_at", { ascending: false }));
});
router.post("/requests", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("requests").insert(snakifyKeys(req.body)).select().single());
});
router.patch("/requests/:id", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("requests").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single());
});
router.delete("/requests/:id", async (req, res) => {
  const { error } = await supabaseAdmin.from("requests").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ─── DELIVERIES ───────────────────────────────────────────────────────────────
router.get("/deliveries", async (_req, res) => {
  sbOk(res, await supabaseAdmin.from("deliveries").select("*").order("created_at", { ascending: false }));
});
router.post("/deliveries", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("deliveries").insert(snakifyKeys(req.body)).select().single());
});
router.patch("/deliveries/:id", async (req, res) => {
  const result = await supabaseAdmin.from("deliveries").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single();
  if (!result.error && req.body.status === "Delivered") {
    const del = result.data;
    const orderId = del.order_id;
    const clientId = del.client_id;
    const deliveryDate = del.date || new Date().toISOString().split("T")[0];
    try {
      // Avoid duplicates: skip if already inserted for this order
      const { rows: existing } = await pgPool.query(
        "SELECT 1 FROM client_inventory WHERE source_order=$1 AND client_id=$2 LIMIT 1",
        [orderId, clientId]
      );
      if (existing.length === 0) {
        // Fetch order lines from local PG
        const { rows: lines } = await pgPool.query(
          "SELECT * FROM order_lines WHERE order_id=$1",
          [orderId]
        );
        // Fetch client name from Supabase
        const { data: clientData } = await supabaseAdmin.from("clients").select("name").eq("id", clientId).single();
        const clientName = clientData?.name || clientId;
        if (lines.length > 0) {
          const vals: any[] = [];
          const placeholders = lines.map((line: any, i: number) => {
            const base = i * 12;
            const id = `CI-${orderId}-${line.material_code || i}-${Date.now()}`;
            vals.push(
              id, clientId, clientName,
              line.material_name || "", line.material_code || "", line.unit || "unit",
              Number(line.quantity) || 0, Number(line.quantity) || 0,
              Number(line.selling_price) || 0, Number(line.cost_price) || 0,
              deliveryDate, orderId
            );
            return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12})`;
          });
          await pgPool.query(
            `INSERT INTO client_inventory
              (id,client_id,client_name,material,code,unit,delivered,remaining,selling_price,store_cost,delivery_date,source_order)
             VALUES ${placeholders.join(",")}`,
            vals
          );
        }
      }
    } catch (e: any) {
      console.error("client_inventory auto-insert error:", e.message);
    }
  }
  sbOk(res, result);
});
router.delete("/deliveries/:id", async (req, res) => {
  const { error } = await supabaseAdmin.from("deliveries").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ─── COLLECTIONS ──────────────────────────────────────────────────────────────
router.get("/collections", async (_req, res) => {
  sbOk(res, await supabaseAdmin.from("collections").select("*").order("created_at", { ascending: false }));
});
router.post("/collections", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("collections").insert(snakifyKeys(req.body)).select().single());
});
router.patch("/collections/:id", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("collections").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single());
});
router.delete("/collections/:id", async (req, res) => {
  const { error } = await supabaseAdmin.from("collections").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ─── INVENTORY ────────────────────────────────────────────────────────────────
router.get("/inventory", async (_req, res) => {
  sbOk(res, await supabaseAdmin.from("inventory").select("*").order("material_name"));
});
router.post("/inventory", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("inventory").insert(snakifyKeys(req.body)).select().single());
});
router.patch("/inventory/:code", async (req, res) => {
  const body = { ...snakifyKeys(req.body), updated_at: new Date().toISOString() };
  sbOk(res, await supabaseAdmin.from("inventory").update(body).eq("material_code", req.params.code).select().single());
});

// ─── CLIENT INVENTORY (local PG) ─────────────────────────────────────────────
function pgOk(res: any, rows: any[]) { return res.json(camelizeKeys(rows)); }
function pgOne(res: any, rows: any[]) {
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  return res.json(camelizeKeys(rows[0]));
}

router.get("/client-inventory", async (req, res) => {
  try {
    const { clientId } = req.query as { clientId?: string };
    const { rows } = clientId
      ? await pgPool.query("SELECT * FROM client_inventory WHERE client_id=$1 ORDER BY created_at DESC", [clientId])
      : await pgPool.query("SELECT * FROM client_inventory ORDER BY created_at DESC");
    pgOk(res, rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get("/client-inventory/:id", async (req, res) => {
  try {
    const { rows } = await pgPool.query("SELECT * FROM client_inventory WHERE id=$1", [req.params.id]);
    pgOne(res, rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post("/client-inventory", async (req, res) => {
  try {
    const body = snakifyKeys(req.body);
    const keys = Object.keys(body);
    const vals = keys.map((_, i) => `$${i + 1}`);
    const { rows } = await pgPool.query(
      `INSERT INTO client_inventory (${keys.join(",")}) VALUES (${vals.join(",")}) RETURNING *`,
      Object.values(body)
    );
    pgOne(res, rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.patch("/client-inventory/:id", async (req, res) => {
  try {
    const body = snakifyKeys(req.body);
    const keys = Object.keys(body);
    const sets = keys.map((k, i) => `${k}=$${i + 1}`);
    const { rows } = await pgPool.query(
      `UPDATE client_inventory SET ${sets.join(",")} WHERE id=$${keys.length + 1} RETURNING *`,
      [...Object.values(body), req.params.id]
    );
    pgOne(res, rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete("/client-inventory/:id", async (req, res) => {
  try {
    const { rows } = await pgPool.query("DELETE FROM client_inventory WHERE id=$1 RETURNING *", [req.params.id]);
    pgOne(res, rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── AUDITS (local PG) ────────────────────────────────────────────────────────
router.get("/audits", async (_req, res) => {
  try {
    const { rows } = await pgPool.query("SELECT * FROM audits ORDER BY created_at DESC");
    pgOk(res, rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get("/audits/next-id", async (_req, res) => {
  try {
    const { rows } = await pgPool.query("SELECT COUNT(*) FROM audits");
    const nextNum = parseInt(rows[0].count, 10) + 1;
    res.json({ nextId: `AUD-${String(nextNum).padStart(3, "0")}` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post("/audits", async (req, res) => {
  try {
    const body = snakifyKeys(req.body);
    const keys = Object.keys(body).map(k => k === "comparison" ? k : k);
    const vals = keys.map((_, i) => `$${i + 1}`);
    const values = Object.keys(body).map(k => {
      const v = body[k];
      return typeof v === "object" && v !== null ? JSON.stringify(v) : v;
    });
    const { rows } = await pgPool.query(
      `INSERT INTO audits (${keys.join(",")}) VALUES (${vals.join(",")}) RETURNING *`,
      values
    );
    pgOne(res, rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.patch("/audits/:id", async (req, res) => {
  try {
    const body = snakifyKeys(req.body);
    const keys = Object.keys(body);
    const sets = keys.map((k, i) => `${k}=$${i + 1}`);
    const values = keys.map(k => {
      const v = body[k];
      return typeof v === "object" && v !== null ? JSON.stringify(v) : v;
    });
    const { rows } = await pgPool.query(
      `UPDATE audits SET ${sets.join(",")} WHERE id=$${keys.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    pgOne(res, rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete("/audits/:id", async (req, res) => {
  try {
    const { rows } = await pgPool.query("DELETE FROM audits WHERE id=$1 RETURNING *", [req.params.id]);
    pgOne(res, rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
router.get("/notifications", async (_req, res) => {
  sbOk(res, await supabaseAdmin.from("notifications").select("*").order("created_at", { ascending: false }));
});
router.post("/notifications", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("notifications").insert(snakifyKeys(req.body)).select().single());
});
router.patch("/notifications/:id", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("notifications").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single());
});
router.patch("/notifications/mark-all-read/:userId", async (req, res) => {
  const { error } = await supabaseAdmin.from("notifications").update({ read: true }).eq("user_id", req.params.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});
router.delete("/notifications/:id", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("notifications").delete().eq("id", req.params.id).select().single());
});

// ─── TREASURY ACCOUNTS ────────────────────────────────────────────────────────
router.get("/treasury/accounts", async (_req, res) => {
  sbOk(res, await supabaseAdmin.from("treasury_accounts").select("*").order("created_at", { ascending: false }));
});
router.post("/treasury/accounts", async (req, res) => {
  const body = snakifyKeys(req.body);
  delete body.id;
  sbOk(res, await supabaseAdmin.from("treasury_accounts").insert(body).select().single());
});
router.patch("/treasury/accounts/:id", async (req, res) => {
  const body = { ...snakifyKeys(req.body), updated_at: new Date().toISOString() };
  sbOk(res, await supabaseAdmin.from("treasury_accounts").update(body).eq("id", req.params.id).select().single());
});

// ─── TREASURY TRANSACTIONS ────────────────────────────────────────────────────
router.get("/treasury/transactions", async (_req, res) => {
  sbOk(res, await supabaseAdmin.from("treasury_transactions").select("*").order("created_at", { ascending: false }));
});
router.post("/treasury/transactions", async (req, res) => {
  const { newBalance, linkedNewBalance, ...rest } = req.body;
  const txData = snakifyKeys(rest);
  delete txData.id;
  const result = await supabaseAdmin.from("treasury_transactions").insert(txData).select().single();
  if (!result.error) {
    if (newBalance !== undefined) {
      await supabaseAdmin.from("treasury_accounts").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", rest.accountId);
    }
    if (linkedNewBalance !== undefined && rest.linkedAccountId) {
      await supabaseAdmin.from("treasury_accounts").update({ balance: linkedNewBalance, updated_at: new Date().toISOString() }).eq("id", rest.linkedAccountId);
    }
  }
  sbOk(res, result);
});

router.delete("/treasury/transactions/:id", async (req, res) => {
  // Fetch the transaction first to reverse its balance effect
  const { data: tx, error: fetchErr } = await supabaseAdmin
    .from("treasury_transactions")
    .select("*")
    .eq("id", req.params.id)
    .single();
  if (fetchErr || !tx) return res.status(404).json({ error: "Transaction not found" });

  const { error } = await supabaseAdmin.from("treasury_transactions").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  // Reverse the balance: add back the amount (which was negative for expenses)
  if (tx.account_id && tx.amount !== null) {
    const { data: acc } = await supabaseAdmin.from("treasury_accounts").select("balance").eq("id", tx.account_id).single();
    if (acc) {
      const restored = Number(acc.balance) - Number(tx.amount); // subtract negative = add back
      await supabaseAdmin.from("treasury_accounts")
        .update({ balance: restored, updated_at: new Date().toISOString() })
        .eq("id", tx.account_id);
    }
  }
  res.json({ ok: true });
});

// ─── FOUNDER TRANSACTIONS (stored in treasury_transactions with special txTypes) ──
// txType: "founder_contribution" | "founder_withdrawal" | "order_funding"
// performedBy = founderId, referenceId = founderName, linkedAccountId = orderId, category = method, description = notes
const FOUNDER_TX_TYPES = ["founder_contribution", "founder_withdrawal", "order_funding"];

router.get("/founder-transactions", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("treasury_transactions")
    .select("*")
    .in("tx_type", FOUNDER_TX_TYPES)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const mapped = (data || []).map((tx: any) => ({
    id: tx.id,
    founderId: tx.performed_by || "",
    founderName: tx.reference_id || "",
    type: tx.tx_type === "founder_contribution" ? "contribution" : tx.tx_type === "founder_withdrawal" ? "withdrawal" : "funding",
    amount: Math.abs(Number(tx.amount)),
    method: tx.category || "bank",
    orderId: tx.linked_account_id || "",
    notes: tx.description || "",
    date: tx.date || (tx.created_at ? tx.created_at.split("T")[0] : ""),
    createdAt: tx.created_at,
  }));
  res.json(mapped);
});

router.post("/founder-transactions", async (req, res) => {
  const { founderId, founderName, type, amount, method, orderId, notes, date } = req.body;
  const txType = type === "contribution" ? "founder_contribution" : type === "withdrawal" ? "founder_withdrawal" : "order_funding";
  const signedAmount = type === "withdrawal" ? -Math.abs(Number(amount)) : Math.abs(Number(amount));
  const txData = {
    tx_type: txType,
    amount: signedAmount,
    balance_after: 0,
    performed_by: founderId || null,
    reference_id: founderName || null,
    linked_account_id: orderId || null,
    category: method || "bank",
    description: notes || null,
    date: date || new Date().toISOString().split("T")[0],
  };
  const { data, error } = await supabaseAdmin.from("treasury_transactions").insert(txData).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({
    id: data.id,
    founderId: data.performed_by || "",
    founderName: data.reference_id || "",
    type,
    amount: Math.abs(Number(data.amount)),
    method: data.category || "bank",
    orderId: data.linked_account_id || "",
    notes: data.description || "",
    date: data.date || data.created_at?.split("T")[0] || "",
    createdAt: data.created_at,
  });
});

router.delete("/founder-transactions/:id", async (req, res) => {
  const { error } = await supabaseAdmin.from("treasury_transactions").delete().eq("id", req.params.id).in("tx_type", FOUNDER_TX_TYPES);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ─── BUSINESS RULES (local PG) ────────────────────────────────────────────────
router.get("/business-rules", async (_req, res) => {
  try {
    const { rows } = await pgPool.query("SELECT * FROM business_rules WHERE id = 'default'");
    if (!rows.length) return res.json({});
    res.json(camelizeKeys(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/business-rules", async (req, res) => {
  try {
    const body = snakifyKeys(req.body);
    delete body.id;
    body.updated_at = new Date().toISOString();
    const keys = Object.keys(body);
    const sets = keys.map((k, i) => `${k}=$${i + 1}`);
    const { rows } = await pgPool.query(
      `UPDATE business_rules SET ${sets.join(",")} WHERE id='default' RETURNING *`,
      Object.values(body)
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(camelizeKeys(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
