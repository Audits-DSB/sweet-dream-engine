import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

const router = Router();

// ─── pgPool kept ONLY for migration endpoint (reads old local data) ───────────
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

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
  const { data, error } = await supabaseAdmin.from("supplier_materials").select("*").eq("supplier_id", req.params.id).order("material_name");
  if (error) return res.status(500).json({ error: error.message });
  res.json(camelizeKeys(data));
});
router.post("/suppliers/:id/materials", async (req, res) => {
  const { materialCode, materialName } = req.body;
  const { error } = await supabaseAdmin.from("supplier_materials").upsert(
    { supplier_id: req.params.id, material_code: materialCode, material_name: materialName || "" },
    { onConflict: "supplier_id,material_code", ignoreDuplicates: true }
  );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});
router.delete("/suppliers/:id/materials/:code", async (req, res) => {
  const { error } = await supabaseAdmin.from("supplier_materials").delete().eq("supplier_id", req.params.id).eq("material_code", req.params.code);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
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
    await supabaseAdmin.from("delivery_actors").upsert(
      { id: actorId, name: f.name || "", type: "founder", phone: f.phone || "", email: f.email || "", active: true, founder_id: f.id },
      { onConflict: "id", ignoreDuplicates: true }
    ).catch(() => {});
  }
  sbOk(res, result);
});
router.patch("/founders/:id", async (req, res) => {
  const result = await supabaseAdmin.from("founders").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single();
  if (!result.error && result.data) {
    const f = result.data;
    const actorId = `ACT-F-${f.id}`;
    await supabaseAdmin.from("delivery_actors").update({ name: f.name || "", phone: f.phone || "", email: f.email || "" }).eq("id", actorId).catch(() => {});
  }
  sbOk(res, result);
});
router.delete("/founders/:id", async (req, res) => {
  const { error } = await supabaseAdmin.from("founders").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  await supabaseAdmin.from("delivery_actors").delete().eq("founder_id", req.params.id).catch(() => {});
  res.json({ ok: true });
});

// ─── DELIVERY ACTORS ──────────────────────────────────────────────────────────
router.get("/delivery-actors/sync-founders", async (_req, res) => {
  const { data: founders } = await supabaseAdmin.from("founders").select("id,name,phone,email,active");
  for (const f of founders || []) {
    const actorId = `ACT-F-${f.id}`;
    await supabaseAdmin.from("delivery_actors").upsert(
      { id: actorId, name: f.name || "", type: "founder", phone: f.phone || "", email: f.email || "", active: f.active !== false, founder_id: f.id },
      { onConflict: "id" }
    ).catch(() => {});
  }
  const { data, error } = await supabaseAdmin.from("delivery_actors").select("*").order("type", { ascending: false }).order("name");
  if (error) return res.status(500).json({ error: error.message });
  res.json(camelizeKeys(data));
});
router.get("/delivery-actors", async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("delivery_actors").select("*").order("type", { ascending: false }).order("name");
  if (error) return res.status(500).json({ error: error.message });
  res.json(camelizeKeys(data));
});
router.post("/delivery-actors", async (req, res) => {
  const { id, name, type, phone, email, active, founderId } = req.body;
  const newId = id || `ACT-${Date.now()}`;
  const { data, error } = await supabaseAdmin.from("delivery_actors").insert(
    { id: newId, name: name || "", type: type || "external", phone: phone || "", email: email || "", active: active !== false, founder_id: founderId || null }
  ).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(camelizeKeys(data));
});
router.patch("/delivery-actors/:id", async (req, res) => {
  const { name, type, phone, email, active } = req.body;
  const updates: any = {};
  if (name !== undefined)   updates.name = name;
  if (type !== undefined)   updates.type = type;
  if (phone !== undefined)  updates.phone = phone;
  if (email !== undefined)  updates.email = email;
  if (active !== undefined) updates.active = active;
  if (!Object.keys(updates).length) return res.json({ ok: true });
  const { data, error } = await supabaseAdmin.from("delivery_actors").update(updates).eq("id", req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(camelizeKeys(data));
});
router.delete("/delivery-actors/:id", async (req, res) => {
  const { error } = await supabaseAdmin.from("delivery_actors").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
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
  const [ordersRes, clientsRes, contribRes] = await Promise.all([
    supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("clients").select("id,name"),
    supabaseAdmin.from("order_founder_contributions").select("order_id,contributions"),
  ]);
  if (ordersRes.error) return res.status(400).json({ error: ordersRes.error.message });
  const clientMap: Record<string, string> = {};
  for (const c of clientsRes.data || []) clientMap[c.id] = c.name || c.id;
  const contribMap: Record<string, any[]> = {};
  for (const r of contribRes.data || []) contribMap[r.order_id] = r.contributions || [];
  const orders = (ordersRes.data || []).map(o => ({
    ...o,
    client: clientMap[o.client_id] || o.client_id || "",
    founder_contributions: contribMap[o.id] || [],
  }));
  res.json(camelizeKeys(orders));
});
router.post("/orders", async (req, res) => {
  const { items, founderContributions, ...orderBody } = req.body;
  const data = snakifyKeys(orderBody);
  const result = await supabaseAdmin.from("orders").insert(data).select().single();
  if (result.error) return res.status(400).json({ error: result.error.message });
  if (!result.error && data.client_id) {
    try { await supabaseAdmin.rpc("increment_client_orders", { cid: data.client_id }); } catch { /* ignore */ }
  }
  const orderId = result.data.id;
  if (Array.isArray(items) && items.length > 0) {
    const lineRows = items.map((item: any) => ({
      order_id: orderId,
      material_code: String(item.materialCode || ""),
      material_name: String(item.name || ""),
      image_url: String(item.imageUrl || ""),
      unit: String(item.unit || "unit"),
      quantity: Number(item.quantity) || 1,
      selling_price: Number(item.sellingPrice) || 0,
      cost_price: Number(item.costPrice) || 0,
      line_total: (Number(item.sellingPrice) || 0) * (Number(item.quantity) || 1),
      line_cost: (Number(item.costPrice) || 0) * (Number(item.quantity) || 1),
    }));
    const { error: linesErr } = await supabaseAdmin.from("order_lines").insert(lineRows);
    if (linesErr) {
      console.error("order_lines insert error for", orderId, ":", linesErr.message);
      return res.status(207).json({ ...camelizeKeys(result.data), _linesError: linesErr.message });
    }
  }
  // Save founderContributions to Supabase
  if (Array.isArray(founderContributions) && founderContributions.length > 0) {
    await supabaseAdmin.from("order_founder_contributions").upsert(
      { order_id: orderId, contributions: founderContributions, updated_at: new Date().toISOString() },
      { onConflict: "order_id" }
    ).catch((e: any) => console.error("founder_contributions insert error:", e.message));
  }
  res.json({ ...camelizeKeys(result.data), founderContributions: founderContributions || [] });
});
router.get("/orders/:id/lines", async (req, res) => {
  const { data, error } = await supabaseAdmin.from("order_lines").select("*").eq("order_id", req.params.id).order("id");
  if (error) return res.status(500).json({ error: error.message });
  res.json(camelizeKeys(data));
});
router.patch("/order-lines/:id", async (req, res) => {
  const { quantity, sellingPrice, costPrice } = req.body;
  const lineTotal = (quantity ?? 0) * (sellingPrice ?? 0);
  const lineCost = (quantity ?? 0) * (costPrice ?? 0);
  const { data, error } = await supabaseAdmin.from("order_lines").update(
    { quantity, selling_price: sellingPrice, cost_price: costPrice, line_total: lineTotal, line_cost: lineCost }
  ).eq("id", req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(camelizeKeys(data || {}));
});
router.patch("/orders/:id", async (req, res) => {
  const { founderContributions, ...rest } = req.body;
  // Update Supabase contributions if provided
  if (Array.isArray(founderContributions)) {
    await supabaseAdmin.from("order_founder_contributions").upsert(
      { order_id: req.params.id, contributions: founderContributions, updated_at: new Date().toISOString() },
      { onConflict: "order_id" }
    ).catch((e: any) => console.error("patch founder_contributions error:", e.message));
  }
  // Only send non-empty rest to Supabase
  if (Object.keys(rest).length === 0) {
    const { data: contribData } = await supabaseAdmin.from("order_founder_contributions").select("contributions").eq("order_id", req.params.id).single();
    return res.json({ id: req.params.id, founderContributions: contribData?.contributions || [] });
  }
  const { data, error } = await supabaseAdmin.from("orders").update(snakifyKeys(rest)).eq("id", req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  // Enrich with contributions
  const { data: contribData } = await supabaseAdmin.from("order_founder_contributions").select("contributions").eq("order_id", req.params.id).single();
  return res.json({ ...camelizeKeys(data), founderContributions: contribData?.contributions || founderContributions || [] });
});
router.delete("/orders/:id", async (req, res) => {
  const { error } = await supabaseAdmin.from("orders").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  await Promise.all([
    supabaseAdmin.from("order_lines").delete().eq("order_id", req.params.id).catch(() => {}),
    supabaseAdmin.from("order_founder_contributions").delete().eq("order_id", req.params.id).catch(() => {}),
  ]);
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
      const { data: existing } = await supabaseAdmin.from("client_inventory").select("id").eq("source_order", orderId).eq("client_id", clientId).limit(1);
      if (!existing || existing.length === 0) {
        // Fetch order lines from Supabase
        const { data: lines } = await supabaseAdmin.from("order_lines").select("*").eq("order_id", orderId);
        // Fetch client name from Supabase
        const { data: clientData } = await supabaseAdmin.from("clients").select("name").eq("id", clientId).single();
        const clientName = clientData?.name || clientId;
        if (lines && lines.length > 0) {
          const ciRows = lines.map((line: any) => ({
            id: `CI-${orderId}-${line.material_code || line.id}-${Date.now()}`,
            client_id: clientId,
            client_name: clientName,
            material: line.material_name || "",
            code: line.material_code || "",
            unit: line.unit || "unit",
            delivered: Number(line.quantity) || 0,
            remaining: Number(line.quantity) || 0,
            selling_price: Number(line.selling_price) || 0,
            store_cost: Number(line.cost_price) || 0,
            delivery_date: deliveryDate,
            source_order: orderId,
          }));
          await supabaseAdmin.from("client_inventory").insert(ciRows);
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

// ─── CLIENT INVENTORY (Supabase) ─────────────────────────────────────────────
router.get("/client-inventory", async (req, res) => {
  const { clientId } = req.query as { clientId?: string };
  let q = supabaseAdmin.from("client_inventory").select("*").order("created_at", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(camelizeKeys(data));
});
router.get("/client-inventory/:id", async (req, res) => {
  const { data, error } = await supabaseAdmin.from("client_inventory").select("*").eq("id", req.params.id).single();
  if (error) return res.status(error.code === "PGRST116" ? 404 : 500).json({ error: error.message });
  res.json(camelizeKeys(data));
});
router.post("/client-inventory", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("client_inventory").insert(snakifyKeys(req.body)).select().single());
});
router.patch("/client-inventory/:id", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("client_inventory").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single());
});
router.delete("/client-inventory/:id", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("client_inventory").delete().eq("id", req.params.id).select().single());
});

// ─── AUDITS (Supabase) ────────────────────────────────────────────────────────
router.get("/audits", async (_req, res) => {
  sbOk(res, await supabaseAdmin.from("audits").select("*").order("created_at", { ascending: false }));
});
router.get("/audits/next-id", async (_req, res) => {
  const { count, error } = await supabaseAdmin.from("audits").select("*", { count: "exact", head: true });
  if (error) return res.status(500).json({ error: error.message });
  const nextNum = (count || 0) + 1;
  res.json({ nextId: `AUD-${String(nextNum).padStart(3, "0")}` });
});
router.post("/audits", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("audits").insert(snakifyKeys(req.body)).select().single());
});
router.patch("/audits/:id", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("audits").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single());
});
router.delete("/audits/:id", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("audits").delete().eq("id", req.params.id).select().single());
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

router.delete("/treasury/transactions/all", async (req, res) => {
  const FOUNDER_TYPES = ["founder_contribution", "founder_withdrawal", "order_funding"];
  const { data: txns } = await supabaseAdmin
    .from("treasury_transactions")
    .select("id,account_id,amount,tx_type")
    .not("tx_type", "in", `(${FOUNDER_TYPES.map(t => `"${t}"`).join(",")})`);
  const ids = (txns || []).map((t: any) => t.id);
  if (ids.length === 0) return res.json({ deleted: 0 });
  const { error } = await supabaseAdmin.from("treasury_transactions").delete().in("id", ids);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: ids.length });
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

// ─── BUSINESS RULES (Supabase) ────────────────────────────────────────────────
router.get("/business-rules", async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("business_rules").select("*").eq("id", "default").single();
  if (error && error.code !== "PGRST116") return res.status(500).json({ error: error.message });
  res.json(camelizeKeys(data || {}));
});

router.put("/business-rules", async (req, res) => {
  const body = { ...snakifyKeys(req.body), id: "default", updated_at: new Date().toISOString() };
  sbOk(res, await supabaseAdmin.from("business_rules").upsert(body, { onConflict: "id" }).select().single());
});

// ─── DATA MIGRATION: copy all local pgPool tables → Supabase ─────────────────
// Run once after creating tables in Supabase SQL editor
router.post("/migrate-to-supabase", async (req, res) => {
  const results: Record<string, any> = {};
  try {
    // 1. order_lines
    const { rows: lines } = await pgPool.query("SELECT * FROM order_lines").catch(() => ({ rows: [] }));
    if (lines.length > 0) {
      const { error } = await supabaseAdmin.from("order_lines").upsert(lines, { onConflict: "id" });
      results.order_lines = error ? `error: ${error.message}` : `migrated ${lines.length}`;
    } else results.order_lines = "empty or table missing";

    // 2. order_founder_contributions
    const { rows: contribs } = await pgPool.query("SELECT * FROM order_founder_contributions").catch(() => ({ rows: [] }));
    if (contribs.length > 0) {
      const { error } = await supabaseAdmin.from("order_founder_contributions").upsert(contribs, { onConflict: "order_id" });
      results.order_founder_contributions = error ? `error: ${error.message}` : `migrated ${contribs.length}`;
    } else results.order_founder_contributions = "empty or table missing";

    // 3. client_inventory
    const { rows: ci } = await pgPool.query("SELECT * FROM client_inventory").catch(() => ({ rows: [] }));
    if (ci.length > 0) {
      const { error } = await supabaseAdmin.from("client_inventory").upsert(ci, { onConflict: "id" });
      results.client_inventory = error ? `error: ${error.message}` : `migrated ${ci.length}`;
    } else results.client_inventory = "empty or table missing";

    // 4. delivery_actors
    const { rows: da } = await pgPool.query("SELECT * FROM delivery_actors").catch(() => ({ rows: [] }));
    if (da.length > 0) {
      const { error } = await supabaseAdmin.from("delivery_actors").upsert(da, { onConflict: "id" });
      results.delivery_actors = error ? `error: ${error.message}` : `migrated ${da.length}`;
    } else results.delivery_actors = "empty or table missing";

    // 5. supplier_materials
    const { rows: sm } = await pgPool.query("SELECT * FROM supplier_materials").catch(() => ({ rows: [] }));
    if (sm.length > 0) {
      const { error } = await supabaseAdmin.from("supplier_materials").upsert(sm, { onConflict: "supplier_id,material_code" });
      results.supplier_materials = error ? `error: ${error.message}` : `migrated ${sm.length}`;
    } else results.supplier_materials = "empty or table missing";

    // 6. audits
    const { rows: au } = await pgPool.query("SELECT * FROM audits").catch(() => ({ rows: [] }));
    if (au.length > 0) {
      const { error } = await supabaseAdmin.from("audits").upsert(au, { onConflict: "id" });
      results.audits = error ? `error: ${error.message}` : `migrated ${au.length}`;
    } else results.audits = "empty or table missing";

    // 7. business_rules
    const { rows: br } = await pgPool.query("SELECT * FROM business_rules").catch(() => ({ rows: [] }));
    if (br.length > 0) {
      const { error } = await supabaseAdmin.from("business_rules").upsert(br, { onConflict: "id" });
      results.business_rules = error ? `error: ${error.message}` : `migrated ${br.length}`;
    } else results.business_rules = "empty or table missing";

    res.json({ ok: true, results });
  } catch (e: any) {
    res.status(500).json({ error: e.message, results });
  }
});

export default router;
