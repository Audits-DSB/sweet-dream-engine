import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { quickProfit, founderSplit } from "../src/lib/orderProfit";

const router = Router();

router.post("/migrate/company-inventory", async (_req, res) => {
  const results: string[] = [];

  const { error: tableErr } = await supabaseAdmin.from("company_inventory").select("id").limit(1);
  const tableExists = !tableErr;

  const { error: colErr } = await supabaseAdmin.from("orders").select("order_type").limit(1);
  const orderTypeExists = !colErr;

  const { error: col2Err } = await supabaseAdmin.from("order_lines").select("from_inventory").limit(1);
  const fromInvExists = !col2Err;

  const { error: supColErr } = await supabaseAdmin.from("company_inventory").select("supplier_id").limit(1);
  const supplierColExists = !supColErr;

  if (tableExists) results.push("✅ company_inventory table exists");
  else results.push("❌ company_inventory table missing");

  if (orderTypeExists) results.push("✅ order_type column exists on orders");
  else results.push("❌ order_type column missing on orders");

  if (fromInvExists) results.push("✅ from_inventory column exists on order_lines");
  else results.push("❌ from_inventory column missing on order_lines");

  if (supplierColExists) results.push("✅ supplier_id column exists on company_inventory");
  else results.push("❌ supplier_id column missing on company_inventory");

  if (!tableExists || !orderTypeExists || !fromInvExists) {
    results.push("Run the following in your Supabase SQL Editor:");
    if (!tableExists) results.push(`CREATE TABLE IF NOT EXISTS public.company_inventory (id text PRIMARY KEY, material_code text NOT NULL DEFAULT '', material_name text NOT NULL DEFAULT '', unit text NOT NULL DEFAULT '', lot_number text NOT NULL DEFAULT '', quantity numeric(14,2) NOT NULL DEFAULT 0, remaining numeric(14,2) NOT NULL DEFAULT 0, cost_price numeric(14,2) NOT NULL DEFAULT 0, source_order text NOT NULL DEFAULT '', date_added text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'In Stock', supplier_id text DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()); ALTER TABLE public.company_inventory ENABLE ROW LEVEL SECURITY; CREATE POLICY "service_role_all" ON public.company_inventory FOR ALL TO service_role USING (true) WITH CHECK (true);`);
    if (!orderTypeExists) results.push(`ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'client';`);
    if (!fromInvExists) results.push(`ALTER TABLE public.order_lines ADD COLUMN IF NOT EXISTS from_inventory boolean NOT NULL DEFAULT false; ALTER TABLE public.order_lines ADD COLUMN IF NOT EXISTS inventory_lot_id text DEFAULT '';`);
  }

  if (!supplierColExists && tableExists) {
    try {
      await supabaseAdmin.rpc("exec_sql", { sql: "ALTER TABLE public.company_inventory ADD COLUMN IF NOT EXISTS supplier_id text DEFAULT '';" });
      results.push("✅ Added supplier_id column via RPC");
    } catch {
      results.push("⚠️ Could not add supplier_id automatically. Run: ALTER TABLE public.company_inventory ADD COLUMN IF NOT EXISTS supplier_id text DEFAULT '';");
    }
  }

  res.json({ ok: tableExists && orderTypeExists && fromInvExists, allReady: tableExists && orderTypeExists && fromInvExists && supplierColExists, results });
});

async function softDelete(entityType: string, entityId: string, entityName: string, snapshot: any, relatedData: any = {}) {
  const id = `DEL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    await supabaseAdmin.from("deleted_items").insert({
      id,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      snapshot: snapshot,
      related_data: relatedData,
      deleted_by: "",
      deleted_at: new Date().toISOString(),
    });
  } catch (e: any) {
    console.warn("[softDelete] Could not save to trash:", e.message);
  }
  return id;
}

// ─── EXTERNAL MATERIALS PROXY (queries the Lovable/catalog Supabase project) ──
function getExtClient() {
  const extUrl = process.env.EXTERNAL_SUPABASE_URL;
  const extKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY || process.env.EXTERNAL_SUPABASE_ANON_KEY;
  if (!extUrl || !extKey) return null;
  return createClient(extUrl, extKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

router.get("/external-materials", async (_req, res) => {
  try {
    const ext = getExtClient();
    if (!ext) return res.json({ products: [] });
    const { data, error } = await ext.from("products").select("*").order("created_at");
    if (error) { console.error("External materials query error:", error.message); return res.json({ products: [] }); }
    res.json({ products: data ?? [], count: data?.length ?? 0 });
  } catch (err: any) {
    console.error("External materials fetch failed:", err.message);
    res.json({ products: [] });
  }
});

router.post("/external-materials", async (req, res) => {
  try {
    const ext = getExtClient();
    if (!ext) return res.status(500).json({ error: "External Supabase not configured" });
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const rows = items.map((item: any) => ({
      sku: item.sku || "",
      name: item.name || "",
      category: item.category || "",
      description: item.description || "",
      price_retail: Number(item.price_retail) || 0,
      price_wholesale: Number(item.price_wholesale) || 0,
      stock_quantity: Number(item.stock_quantity) || 0,
      image_url: item.image_url || null,
      barcode: item.barcode || null,
    }));
    const { data, error } = await ext.from("products").insert(rows).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ products: data, count: data?.length ?? 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/external-materials/export", async (_req, res) => {
  try {
    const ext = getExtClient();
    if (!ext) return res.status(500).json({ error: "External Supabase not configured" });
    const { data, error } = await ext.from("products").select("*").order("created_at");
    if (error) return res.status(500).json({ error: error.message });
    const headers = ["sku", "name", "category", "description", "price_retail", "price_wholesale", "stock_quantity", "barcode", "image_url"];
    const csvRows = [headers.join(",")];
    for (const row of data || []) {
      csvRows.push(headers.map(h => {
        const val = (row as any)[h];
        if (val === null || val === undefined) return "";
        const str = String(val);
        let safe = str;
        if (/^[=+\-@\t\r]/.test(safe)) safe = "'" + safe;
        return safe.includes(",") || safe.includes('"') || safe.includes("\n") ? `"${safe.replace(/"/g, '""')}"` : safe;
      }).join(","));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=materials_export.csv");
    res.send("\uFEFF" + csvRows.join("\n"));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/external-materials/:id", async (req, res) => {
  try {
    const ext = getExtClient();
    if (!ext) return res.status(500).json({ error: "External Supabase not configured" });
    const { data: existing } = await ext.from("products").select("*").eq("id", req.params.id).single();
    if (existing) {
      await softDelete("external-material", existing.id, existing.name || existing.sku || req.params.id, existing);
    }
    const { error } = await ext.from("products").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/external-materials/:id", async (req, res) => {
  try {
    const ext = getExtClient();
    if (!ext) return res.status(500).json({ error: "External Supabase not configured" });
    const updates: any = {};
    const allowed = ["sku", "name", "category", "description", "price_retail", "price_wholesale", "stock_quantity", "image_url", "barcode"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (["price_retail", "price_wholesale", "stock_quantity"].includes(key)) {
          updates[key] = Number(req.body[key]) || 0;
        } else {
          updates[key] = req.body[key];
        }
      }
    }
    const { data, error } = await ext.from("products").update(updates).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
  sbOk(res, await supabaseAdmin.from("clients").select("*").neq("id", "company-inventory").order("name"));
});
router.post("/clients", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("clients").insert(snakifyKeys(req.body)).select().single());
});
router.patch("/clients/:id", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("clients").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single());
});
router.delete("/clients/:id", async (req, res) => {
  const { data: snap } = await supabaseAdmin.from("clients").select("*").eq("id", req.params.id).single();
  if (snap) await softDelete("client", req.params.id, snap.name || req.params.id, snap);
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
  const { data: snap } = await supabaseAdmin.from("suppliers").select("*").eq("id", req.params.id).single();
  const { data: mats } = await supabaseAdmin.from("supplier_materials").select("*").eq("supplier_id", req.params.id);
  if (snap) await softDelete("supplier", req.params.id, snap.name || req.params.id, snap, { supplierMaterials: mats || [] });
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
  const { data: snap } = await supabaseAdmin.from("materials").select("*").eq("code", req.params.code).single();
  if (snap) await softDelete("material", req.params.code, snap.name || req.params.code, snap);
  const { error } = await supabaseAdmin.from("materials").delete().eq("code", req.params.code);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ─── SUPPLIER PROFILE (aggregated data) ──────────────────────────────────────
router.get("/suppliers/:id/profile", async (req, res) => {
  try {
    const sid = req.params.id;
    const [supRes, matsRes, ordersRes, invRes] = await Promise.all([
      supabaseAdmin.from("suppliers").select("*").eq("id", sid).single(),
      supabaseAdmin.from("supplier_materials").select("*").eq("supplier_id", sid).order("material_name"),
      supabaseAdmin.from("orders").select("*").eq("supplier_id", sid).order("date", { ascending: false }),
      supabaseAdmin.from("company_inventory").select("*").eq("supplier_id", sid).order("date_added", { ascending: false }),
    ]);
    if (supRes.error) return res.status(404).json({ error: "Supplier not found" });
    if (ordersRes.error) return res.status(500).json({ error: ordersRes.error.message });
    if (invRes.error) return res.status(500).json({ error: invRes.error.message });

    const orders = ordersRes.data || [];
    const inventory = invRes.data || [];
    const totalPurchases = orders.reduce((s: number, o: any) => s + (parseFloat(o.total_cost) || 0), 0);
    const totalOrders = orders.length;
    const lastOrderDate = orders.length > 0 ? orders[0].date : null;

    const totalLots = inventory.length;
    const totalUnitsSupplied = inventory.reduce((s: number, lot: any) => s + (parseFloat(lot.quantity) || 0), 0);
    const totalRemainingUnits = inventory.reduce((s: number, lot: any) => s + (parseFloat(lot.remaining) || 0), 0);

    res.json(camelizeKeys({
      supplier: supRes.data,
      materials: matsRes.data || [],
      orders,
      inventory,
      stats: {
        total_purchases: totalPurchases,
        total_orders: totalOrders,
        last_order_date: lastOrderDate,
        total_lots: totalLots,
        total_units_supplied: totalUnitsSupplied,
        total_remaining_units: totalRemainingUnits,
        materials_count: (matsRes.data || []).length,
      },
    }));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SUPPLIER STATS (summary for all suppliers) ─────────────────────────────
router.get("/suppliers-stats", async (_req, res) => {
  try {
    const [ordersRes, invRes, matsRes] = await Promise.all([
      supabaseAdmin.from("orders").select("id, supplier_id, total_cost, date").not("supplier_id", "is", null).not("supplier_id", "eq", ""),
      supabaseAdmin.from("company_inventory").select("supplier_id, quantity, remaining"),
      supabaseAdmin.from("supplier_materials").select("supplier_id, material_code"),
    ]);
    if (ordersRes.error || invRes.error || matsRes.error) {
      return res.status(500).json({ error: (ordersRes.error || invRes.error || matsRes.error)!.message });
    }
    const orders = ordersRes.data || [];
    const inventory = invRes.data || [];
    const mats = matsRes.data || [];

    const statsMap: Record<string, any> = {};
    orders.forEach((o: any) => {
      if (!o.supplier_id) return;
      if (!statsMap[o.supplier_id]) statsMap[o.supplier_id] = { totalOrders: 0, totalPurchases: 0, lastOrderDate: null, materialsCount: 0, totalLots: 0 };
      statsMap[o.supplier_id].totalOrders++;
      statsMap[o.supplier_id].totalPurchases += parseFloat(o.total_cost) || 0;
      if (!statsMap[o.supplier_id].lastOrderDate || o.date > statsMap[o.supplier_id].lastOrderDate) {
        statsMap[o.supplier_id].lastOrderDate = o.date;
      }
    });
    inventory.forEach((lot: any) => {
      if (!lot.supplier_id) return;
      if (!statsMap[lot.supplier_id]) statsMap[lot.supplier_id] = { totalOrders: 0, totalPurchases: 0, lastOrderDate: null, materialsCount: 0, totalLots: 0 };
      statsMap[lot.supplier_id].totalLots++;
    });
    mats.forEach((m: any) => {
      if (!m.supplier_id) return;
      if (!statsMap[m.supplier_id]) statsMap[m.supplier_id] = { totalOrders: 0, totalPurchases: 0, lastOrderDate: null, materialsCount: 0, totalLots: 0 };
      statsMap[m.supplier_id].materialsCount++;
    });

    res.json(statsMap);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
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

// ─── MATERIAL LAST SUPPLIERS ──────────────────────────────────────────────────
router.get("/material-last-suppliers", async (_req, res) => {
  const { data: lines } = await supabaseAdmin
    .from("order_lines")
    .select("material_code, supplier_id, cost_price, order_id, id")
    .order("id", { ascending: false });
  if (!lines) return res.json({});
  const { data: suppliers } = await supabaseAdmin.from("suppliers").select("id, name");
  const supMap: Record<string, string> = {};
  (suppliers || []).forEach((s: any) => { supMap[s.id] = s.name; });
  const orderIds = [...new Set(lines.map(l => l.order_id).filter(Boolean))];
  const { data: orders } = await supabaseAdmin.from("orders").select("id, date, status").in("id", orderIds.slice(0, 500));
  const orderMap: Record<string, { date: string; status: string }> = {};
  (orders || []).forEach((o: any) => { orderMap[o.id] = { date: o.date, status: o.status }; });
  const result: Record<string, { supplierId: string; supplierName: string; lastCostPrice: number; lastOrderDate: string }> = {};
  const pendingOrders: Record<string, Set<string>> = {};
  for (const l of lines) {
    const o = orderMap[l.order_id];
    if (!result[l.material_code]) {
      result[l.material_code] = {
        supplierId: l.supplier_id && supMap[l.supplier_id] ? l.supplier_id : "",
        supplierName: l.supplier_id && supMap[l.supplier_id] ? supMap[l.supplier_id] : "",
        lastCostPrice: Number(l.cost_price) || 0,
        lastOrderDate: o?.date || "",
      };
    }
    if (o && ["Draft", "Processing", "Confirmed", "Awaiting Purchase"].includes(o.status)) {
      if (!pendingOrders[l.material_code]) pendingOrders[l.material_code] = new Set();
      pendingOrders[l.material_code].add(l.order_id);
    }
  }
  const pending: Record<string, string[]> = {};
  for (const [code, ids] of Object.entries(pendingOrders)) {
    pending[code] = [...ids];
  }
  res.json({ materials: result, pending });
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
    try {
      await supabaseAdmin.from("delivery_actors").upsert(
        { id: actorId, name: f.name || "", type: "founder", phone: f.phone || "", email: f.email || "", active: true, founder_id: f.id },
        { onConflict: "id", ignoreDuplicates: true }
      );
    } catch { /* ignore */ }
  }
  sbOk(res, result);
});
router.patch("/founders/:id", async (req, res) => {
  const result = await supabaseAdmin.from("founders").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single();
  if (!result.error && result.data) {
    const f = result.data;
    const actorId = `ACT-F-${f.id}`;
    await supabaseAdmin.from("delivery_actors").update({ name: f.name || "", phone: f.phone || "", email: f.email || "" }).eq("id", actorId).then(() => {}).catch(() => {});
  }
  sbOk(res, result);
});
router.delete("/founders/:id", async (req, res) => {
  const { data: snap } = await supabaseAdmin.from("founders").select("*").eq("id", req.params.id).single();
  if (snap) await softDelete("founder", req.params.id, snap.name || req.params.id, snap);
  const { error } = await supabaseAdmin.from("founders").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  await supabaseAdmin.from("delivery_actors").delete().eq("founder_id", req.params.id).then(() => {}).catch(() => {});
  res.json({ ok: true });
});

// ─── DELIVERY ACTORS ──────────────────────────────────────────────────────────
router.get("/delivery-actors/sync-founders", async (_req, res) => {
  const { data: founders } = await supabaseAdmin.from("founders").select("id,name,phone,email,active");
  for (const f of founders || []) {
    const actorId = `ACT-F-${f.id}`;
    try {
      await supabaseAdmin.from("delivery_actors").upsert(
        { id: actorId, name: f.name || "", type: "founder", phone: f.phone || "", email: f.email || "", active: f.active !== false, founder_id: f.id },
        { onConflict: "id" }
      );
    } catch { /* ignore */ }
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
  const { data: snap } = await supabaseAdmin.from("delivery_actors").select("*").eq("id", req.params.id).single();
  if (snap) await softDelete("delivery-actor", req.params.id, snap.name || req.params.id, snap);
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
  const [ordersRes, clientsRes, contribRes, linesRes] = await Promise.all([
    supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("clients").select("id,name"),
    supabaseAdmin.from("order_founder_contributions").select("order_id,contributions"),
    supabaseAdmin.from("order_lines").select("order_id,line_cost"),
  ]);
  if (ordersRes.error) return res.status(400).json({ error: ordersRes.error.message });
  const clientMap: Record<string, string> = {};
  for (const c of clientsRes.data || []) clientMap[c.id] = c.name || c.id;
  const contribMap: Record<string, any[]> = {};
  for (const r of contribRes.data || []) contribMap[r.order_id] = r.contributions || [];
  // Compute total_cost per order from order_lines (sum of line_cost)
  const costMap: Record<string, number> = {};
  for (const l of linesRes.data || []) {
    costMap[l.order_id] = (costMap[l.order_id] || 0) + (Number(l.line_cost) || 0);
  }
  const orders = (ordersRes.data || []).map(o => ({
    ...o,
    client: clientMap[o.client_id] || o.client_id || "",
    founder_contributions: contribMap[o.id] || [],
    total_cost: costMap[o.id] || 0,
  }));
  res.json(camelizeKeys(orders));
});
router.get("/orders/:id", async (req, res) => {
  const [orderRes, contribRes] = await Promise.all([
    supabaseAdmin.from("orders").select("*").eq("id", req.params.id).single(),
    supabaseAdmin.from("order_founder_contributions").select("contributions").eq("order_id", req.params.id).maybeSingle(),
  ]);
  if (orderRes.error) return res.status(404).json({ error: orderRes.error.message });
  const clientId = orderRes.data.client_id;
  let clientName = clientId;
  if (clientId) {
    const { data: cRow } = await supabaseAdmin.from("clients").select("name").eq("id", clientId).single();
    if (cRow?.name) clientName = cRow.name;
  }
  res.json(camelizeKeys({ ...orderRes.data, client: clientName, founderContributions: contribRes.data?.contributions || [] }));
});
router.post("/orders", async (req, res) => {
  const { items, founderContributions, client, supplierId, ...orderBody } = req.body;
  const data = snakifyKeys(orderBody);
  if (supplierId) data.supplier_id = supplierId;
  const result = await supabaseAdmin.from("orders").insert(data).select().single();
  if (result.error) return res.status(400).json({ error: result.error.message });
  if (!result.error && data.client_id && data.order_type !== "inventory") {
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
      from_inventory: item.fromInventory === true,
      inventory_lot_id: String(item.inventoryLotId || ""),
      supplier_id: String(item.supplierId || ""),
    }));
    const { error: linesErr } = await supabaseAdmin.from("order_lines").insert(lineRows);
    if (linesErr) {
      console.error("order_lines insert error for", orderId, ":", linesErr.message);
      return res.status(207).json({ ...camelizeKeys(result.data), _linesError: linesErr.message });
    }
  }
  // Save founderContributions to Supabase
  if (Array.isArray(founderContributions) && founderContributions.length > 0) {
    try {
      await supabaseAdmin.from("order_founder_contributions").upsert(
        { order_id: orderId, contributions: founderContributions, updated_at: new Date().toISOString() },
        { onConflict: "order_id" }
      );
    } catch (e: any) { console.error("founder_contributions insert error:", e.message); }
  }
  if (Array.isArray(items)) {
    const inventoryPulls = items.filter((item: any) => item.fromInventory && item.inventoryLotId);
    for (const item of inventoryPulls) {
      try {
        const { data: lot } = await supabaseAdmin.from("company_inventory").select("*").eq("id", item.inventoryLotId).single();
        if (lot) {
          const remaining = Number(lot.remaining) || 0;
          const qty = Number(item.quantity) || 0;
          if (qty > 0 && qty <= remaining) {
            const newRemaining = remaining - qty;
            const newStatus = newRemaining <= 0 ? "Depleted" : newRemaining < Number(lot.quantity) * 0.2 ? "Low Stock" : "In Stock";
            await supabaseAdmin.from("company_inventory").update({ remaining: newRemaining, status: newStatus }).eq("id", item.inventoryLotId);
          }
        }
      } catch (e: any) { console.error("inventory withdraw error:", e.message); }
    }
  }

  res.json({ ...camelizeKeys(result.data), founderContributions: founderContributions || [] });
});
router.get("/orders/:id/lines", async (req, res) => {
  const { data, error } = await supabaseAdmin.from("order_lines").select("*").eq("order_id", req.params.id).order("id");
  if (error) return res.status(500).json({ error: error.message });
  res.json(camelizeKeys(data));
});
router.post("/orders/:id/lines", async (req, res) => {
  const orderId = req.params.id;
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "No items provided" });
  const lineRows = items.map((item: any) => ({
    order_id: orderId,
    material_code: String(item.materialCode || ""),
    material_name: String(item.materialName || item.name || ""),
    image_url: String(item.imageUrl || ""),
    unit: String(item.unit || "unit"),
    quantity: Number(item.quantity) || 1,
    selling_price: Number(item.sellingPrice) || 0,
    cost_price: Number(item.costPrice) || 0,
    line_total: (Number(item.sellingPrice) || 0) * (Number(item.quantity) || 1),
    line_cost: (Number(item.costPrice) || 0) * (Number(item.quantity) || 1),
    from_inventory: item.fromInventory === true,
    inventory_lot_id: String(item.inventoryLotId || ""),
    supplier_id: String(item.supplierId || ""),
  }));
  const { data, error } = await supabaseAdmin.from("order_lines").insert(lineRows).select();
  if (error) return res.status(500).json({ error: error.message });

  for (const item of items) {
    if (item.fromInventory && item.inventoryLotId) {
      const qty = Number(item.quantity) || 1;
      const { data: lot } = await supabaseAdmin.from("company_inventory").select("remaining, quantity").eq("id", item.inventoryLotId).single();
      if (lot) {
        const newRemaining = Math.max(0, Number(lot.remaining) - qty);
        const totalQty = Number(lot.quantity) || 1;
        const status = newRemaining <= 0 ? "Depleted" : newRemaining < totalQty * 0.2 ? "Low Stock" : "In Stock";
        await supabaseAdmin.from("company_inventory").update({
          remaining: newRemaining, status,
        }).eq("id", item.inventoryLotId);
      }
    }
  }

  const { data: orderData } = await supabaseAdmin.from("orders").select("order_type, date").eq("id", orderId).single();
  if (orderData?.order_type === "inventory") {
    const { data: existingInv } = await supabaseAdmin.from("company_inventory").select("id").eq("source_order", orderId).limit(1);
    const { data: confirmedDeliveries } = await supabaseAdmin.from("deliveries").select("id").eq("order_id", orderId).in("status", ["Delivered", "تم التسليم", "مُسلَّم"]);
    const hasExistingInventory = existingInv && existingInv.length > 0;
    const hasConfirmedDelivery = confirmedDeliveries && confirmedDeliveries.length > 0;
    if (hasExistingInventory || hasConfirmedDelivery) {
      const ts = Date.now();
      const orderDate = orderData.date || new Date().toISOString().split("T")[0];
      const companyRows = (data || []).map((line: any) => ({
        id: `CI-edit-${line.id}-${ts}`,
        material_code: line.material_code || "",
        material_name: line.material_name || "",
        unit: line.unit || "unit",
        lot_number: `LOT-edit-${orderId}-${ts}`,
        quantity: Number(line.quantity) || 0,
        remaining: Number(line.quantity) || 0,
        cost_price: Number(line.cost_price) || 0,
        source_order: orderId,
        date_added: orderDate,
        status: "In Stock",
      }));
      if (companyRows.length > 0) {
        await supabaseAdmin.from("company_inventory").insert(companyRows).then(r => r).catch(e => console.warn("[add-lines] company_inventory insert:", e.message));
      }
    }
  }

  res.json(camelizeKeys(data));
});
router.delete("/order-lines/:id", async (req, res) => {
  const { data: snap } = await supabaseAdmin.from("order_lines").select("*").eq("id", req.params.id).single();
  if (snap && snap.from_inventory && snap.inventory_lot_id) {
    try {
      const { data: lot } = await supabaseAdmin.from("company_inventory").select("remaining, quantity").eq("id", snap.inventory_lot_id).single();
      if (lot) {
        const newRemaining = Math.min(Number(lot.quantity), Number(lot.remaining) + Number(snap.quantity));
        const newStatus = newRemaining <= 0 ? "Depleted" : newRemaining < Number(lot.quantity) * 0.2 ? "Low Stock" : "In Stock";
        await supabaseAdmin.from("company_inventory").update({ remaining: newRemaining, status: newStatus }).eq("id", snap.inventory_lot_id);
      }
    } catch (e: any) { console.warn("[delete-line] inventory restore error:", e.message); }
  }
  if (snap) {
    const { data: orderData } = await supabaseAdmin.from("orders").select("order_type").eq("id", snap.order_id).single();
    if (orderData?.order_type === "inventory") {
      try {
        await supabaseAdmin.from("company_inventory").delete().like("id", `CI-edit-${snap.id}-%`);
        await supabaseAdmin.from("company_inventory").delete().like("id", `CI-%-${snap.material_code}-%`).eq("source_order", snap.order_id).eq("quantity", snap.quantity);
      } catch (e: any) { console.warn("[delete-line] company_inventory cleanup:", e.message); }
    }
  }
  const { error } = await supabaseAdmin.from("order_lines").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, deleted: snap ? camelizeKeys(snap) : null });
});
router.patch("/order-lines/:id", async (req, res) => {
  const { quantity, sellingPrice, costPrice, supplierId } = req.body;
  const lineTotal = (quantity ?? 0) * (sellingPrice ?? 0);
  const lineCost = (quantity ?? 0) * (costPrice ?? 0);
  const { data: oldLine } = await supabaseAdmin.from("order_lines").select("*").eq("id", req.params.id).single();
  const updateFields: Record<string, any> = { quantity, selling_price: sellingPrice, cost_price: costPrice, line_total: lineTotal, line_cost: lineCost };
  if (supplierId !== undefined) updateFields.supplier_id = supplierId;
  const { data, error } = await supabaseAdmin.from("order_lines").update(updateFields).eq("id", req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  if (oldLine && data && oldLine.from_inventory && oldLine.inventory_lot_id) {
    const oldQtyInv = Number(oldLine.quantity) || 0;
    const newQtyInv = Number(quantity) || 0;
    if (oldQtyInv !== newQtyInv) {
      const diff = oldQtyInv - newQtyInv;
      const { data: lotData } = await supabaseAdmin.from("company_inventory").select("remaining, quantity").eq("id", oldLine.inventory_lot_id).single();
      if (lotData) {
        const newRemaining = Math.max(0, Math.min(Number(lotData.quantity), Number(lotData.remaining) + diff));
        const totalQty = Number(lotData.quantity) || 1;
        const status = newRemaining <= 0 ? "Depleted" : newRemaining < totalQty * 0.2 ? "Low Stock" : "In Stock";
        await supabaseAdmin.from("company_inventory").update({ remaining: newRemaining, status }).eq("id", oldLine.inventory_lot_id);
      }
    }
  }

  if (oldLine && data) {
    const orderId = oldLine.order_id;
    const { data: orderData } = await supabaseAdmin.from("orders").select("order_type").eq("id", orderId).single();
    if (orderData?.order_type === "inventory") {
      const oldQty = Number(oldLine.quantity) || 0;
      const newQty = Number(quantity) || 0;
      const oldCost = Number(oldLine.cost_price) || 0;
      const newCost = Number(costPrice) || 0;
      if (oldQty !== newQty || Math.abs(oldCost - newCost) > 0.001) {
        const { data: ciRows } = await supabaseAdmin.from("company_inventory").select("*").eq("source_order", orderId).eq("material_code", oldLine.material_code);
        const matchRow = (ciRows || []).find((r: any) => r.material_code === oldLine.material_code);
        if (matchRow) {
          const updateFields: any = { cost_price: newCost };
          if (oldQty !== newQty) {
            const diff = newQty - oldQty;
            const newRemaining = Math.max(0, Number(matchRow.remaining) + diff);
            const newTotal = Math.max(0, Number(matchRow.quantity) + diff);
            updateFields.quantity = newTotal;
            updateFields.remaining = newRemaining;
            updateFields.status = newRemaining <= 0 ? "Depleted" : newRemaining < newTotal * 0.2 ? "Low Stock" : "In Stock";
          }
          await supabaseAdmin.from("company_inventory").update(updateFields).eq("id", matchRow.id);
        }
      }
    }
  }

  res.json(camelizeKeys(data || {}));
});
router.patch("/orders/:id", async (req, res) => {
  const { founderContributions, client, ...rest } = req.body;
  // Update Supabase contributions if provided
  if (Array.isArray(founderContributions)) {
    try {
      await supabaseAdmin.from("order_founder_contributions").upsert(
        { order_id: req.params.id, contributions: founderContributions, updated_at: new Date().toISOString() },
        { onConflict: "order_id" }
      );
    } catch (e: any) { console.error("patch founder_contributions error:", e.message); }
  }
  // Only send non-empty rest to Supabase
  if (Object.keys(rest).length === 0) {
    const [contribRes, orderRes] = await Promise.all([
      supabaseAdmin.from("order_founder_contributions").select("contributions").eq("order_id", req.params.id).single(),
      supabaseAdmin.from("orders").select("*").eq("id", req.params.id).single(),
    ]);
    const cid = orderRes.data?.client_id;
    let cName = cid;
    if (cid) { const { data: cr } = await supabaseAdmin.from("clients").select("name").eq("id", cid).single(); if (cr?.name) cName = cr.name; }
    return res.json({ ...camelizeKeys(orderRes.data || {}), client: cName || "", id: req.params.id, founderContributions: contribRes.data?.contributions || [] });
  }
  const { data, error } = await supabaseAdmin.from("orders").update(snakifyKeys(rest)).eq("id", req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  if (rest.date && data?.order_type === "inventory") {
    try {
      await supabaseAdmin.from("company_inventory").update({ date_added: rest.date }).eq("source_order", req.params.id);
    } catch (e: any) { console.warn("[order-patch] sync inventory date:", e.message); }
  }

  if (rest.totalCost !== undefined) {
    try {
      const { data: fundingTxs } = await supabaseAdmin
        .from("treasury_transactions")
        .select("id,description,performed_by,reference_id,amount")
        .eq("tx_type", "order_funding");
      const orderId = req.params.id;
      const linkedTxs = (fundingTxs || []).filter((tx: any) => {
        const parsed = parseFounderDesc(tx.description);
        return parsed.orderId === orderId;
      });
      if (linkedTxs.length > 0) {
        const { data: contribRow } = await supabaseAdmin
          .from("order_founder_contributions")
          .select("contributions")
          .eq("order_id", orderId)
          .single();
        const contribs: any[] = contribRow?.contributions || founderContributions || [];
        for (const tx of linkedTxs) {
          const founderName = tx.reference_id || "";
          const founderId = tx.performed_by || "";
          const match = contribs.find((c: any) =>
            (c.founderId && c.founderId === founderId) ||
            (c.founder && c.founder === founderName)
          );
          if (match) {
            const oldAmt = Math.abs(Number(tx.amount));
            const newAmt = Number(match.amount) || 0;
            if (Math.abs(oldAmt - newAmt) > 0.01) {
              const { data: fRow } = await supabaseAdmin.from("founders").select("total_contributed").eq("id", founderId || "___").single();
              if (fRow) {
                const newContrib = Math.max(0, Number(fRow.total_contributed || 0) - oldAmt + newAmt);
                await supabaseAdmin.from("founders").update({ total_contributed: newContrib }).eq("id", founderId);
              }
              await supabaseAdmin.from("treasury_transactions").update({ amount: newAmt }).eq("id", tx.id);
            }
          }
        }
      }
    } catch (e: any) { console.warn("[order-patch] sync funding txs error:", e.message); }
  }

  // Enrich with contributions + client name
  const [contribData, clientData] = await Promise.all([
    supabaseAdmin.from("order_founder_contributions").select("contributions").eq("order_id", req.params.id).single(),
    supabaseAdmin.from("clients").select("name").eq("id", data.client_id).single(),
  ]);
  return res.json({ ...camelizeKeys(data), client: clientData.data?.name || data.client_id || "", founderContributions: contribData?.data?.contributions || founderContributions || [] });
});
router.delete("/orders/:id", async (req, res) => {
  const orderId = req.params.id;

  // ── Step 0: fetch all related data for the snapshot (before deleting) ──
  const [orderRes, linesRes, contribRes, deliveriesRes, collectionsRes, inventoryRes, companyInvRes, auditsRes] = await Promise.all([
    supabaseAdmin.from("orders").select("*").eq("id", orderId).single(),
    supabaseAdmin.from("order_lines").select("*").eq("order_id", orderId),
    supabaseAdmin.from("order_founder_contributions").select("*").eq("order_id", orderId),
    supabaseAdmin.from("deliveries").select("*").eq("order_id", orderId),
    supabaseAdmin.from("collections").select("*").eq("order_id", orderId),
    supabaseAdmin.from("client_inventory").select("*").eq("source_order", orderId),
    supabaseAdmin.from("company_inventory").select("*").eq("source_order", orderId).then(r => r).catch(() => ({ data: [], error: null })),
    supabaseAdmin.from("audits").select("*").eq("order_id", orderId),
  ]);

  const relatedSnapshot = {
    orderLines: linesRes.data || [],
    founderContributions: contribRes.data || [],
    deliveries: deliveriesRes.data || [],
    collections: collectionsRes.data || [],
    clientInventory: inventoryRes.data || [],
    companyInventory: (companyInvRes as any)?.data || [],
    audits: auditsRes.data || [],
  };

  const inventoryLines = (linesRes.data || []).filter((l: any) => l.from_inventory && l.inventory_lot_id);
  for (const line of inventoryLines) {
    try {
      const { data: lot } = await supabaseAdmin.from("company_inventory").select("remaining, quantity").eq("id", line.inventory_lot_id).single();
      if (lot) {
        const newRemaining = Math.min(Number(lot.quantity), Number(lot.remaining) + Number(line.quantity));
        const newStatus = newRemaining <= 0 ? "Depleted" : newRemaining < Number(lot.quantity) * 0.2 ? "Low Stock" : "In Stock";
        await supabaseAdmin.from("company_inventory").update({ remaining: newRemaining, status: newStatus }).eq("id", line.inventory_lot_id);
      }
    } catch (e: any) { console.warn("[delete-order] inventory restore error:", e.message); }
  }

  const childDeletes = await Promise.allSettled([
    supabaseAdmin.from("order_lines").delete().eq("order_id", orderId),
    supabaseAdmin.from("order_founder_contributions").delete().eq("order_id", orderId),
    supabaseAdmin.from("deliveries").delete().eq("order_id", orderId),
    supabaseAdmin.from("collections").delete().eq("order_id", orderId),
    supabaseAdmin.from("client_inventory").delete().eq("source_order", orderId),
    supabaseAdmin.from("company_inventory").delete().eq("source_order", orderId).then(r => r).catch(() => ({ data: null, error: null })),
    supabaseAdmin.from("audits").delete().eq("order_id", orderId),
  ]);

  childDeletes.forEach((r, i) => {
    const names = ["order_lines", "order_founder_contributions", "deliveries", "collections", "client_inventory", "company_inventory", "audits"];
    if (r.status === "fulfilled" && (r.value as any).error) {
      console.warn(`[delete-order] ${names[i]} error:`, (r.value as any).error.message);
    }
  });

  // ── Step 2: soft-delete snapshot (before physical delete) ──
  if (orderRes.data) await softDelete("order", orderId, `${orderId} — ${orderRes.data.client || ""}`, orderRes.data, relatedSnapshot);

  // ── Step 3: delete the order itself ──
  const { error } = await supabaseAdmin.from("orders").delete().eq("id", orderId);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true, relatedSnapshot });
});

router.post("/orders/:id/cascade-restore", async (req, res) => {
  const orderId = req.params.id;
  const { order, orderLines, founderContributions, deliveries, collections, clientInventory, audits } = req.body;

  if (!order) return res.status(400).json({ error: "No order data provided" });

  const safeOrder = { ...order, id: orderId };

  try {
    const { error: orderErr } = await supabaseAdmin.from("orders").upsert(safeOrder, { onConflict: "id" });
    if (orderErr) return res.status(500).json({ error: `Order restore failed: ${orderErr.message}` });

    const restoreOps: Array<{ name: string; op: Promise<any> }> = [];

    if (Array.isArray(orderLines) && orderLines.length > 0) {
      const safe = orderLines.map((r: any) => ({ ...r, order_id: orderId }));
      restoreOps.push({ name: "order_lines", op: supabaseAdmin.from("order_lines").upsert(safe, { onConflict: "id" }) });
    }
    if (Array.isArray(founderContributions) && founderContributions.length > 0) {
      const safe = founderContributions.map((r: any) => ({ ...r, order_id: orderId }));
      restoreOps.push({ name: "founder_contributions", op: supabaseAdmin.from("order_founder_contributions").upsert(safe, { onConflict: "order_id" }) });
    }
    if (Array.isArray(deliveries) && deliveries.length > 0) {
      const safe = deliveries.map((r: any) => ({ ...r, order_id: orderId }));
      restoreOps.push({ name: "deliveries", op: supabaseAdmin.from("deliveries").upsert(safe, { onConflict: "id" }) });
    }
    if (Array.isArray(collections) && collections.length > 0) {
      const safe = collections.map((r: any) => ({ ...r, order_id: orderId }));
      restoreOps.push({ name: "collections", op: supabaseAdmin.from("collections").upsert(safe, { onConflict: "id" }) });
    }
    if (Array.isArray(clientInventory) && clientInventory.length > 0) {
      const safe = clientInventory.map((r: any) => ({ ...r, source_order: orderId }));
      restoreOps.push({ name: "client_inventory", op: supabaseAdmin.from("client_inventory").upsert(safe, { onConflict: "id" }) });
    }
    if (Array.isArray(audits) && audits.length > 0) {
      const safe = audits.map((r: any) => ({ ...r, order_id: orderId }));
      restoreOps.push({ name: "audits", op: supabaseAdmin.from("audits").upsert(safe, { onConflict: "id" }) });
    }

    const results = await Promise.allSettled(restoreOps.map(r => r.op));
    const errors: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && (r as any).value?.error) {
        errors.push(`${restoreOps[i].name}: ${(r as any).value.error.message}`);
      } else if (r.status === "rejected") {
        errors.push(`${restoreOps[i].name}: ${String((r as PromiseRejectedResult).reason)}`);
      }
    });

    if (errors.length > 0) {
      console.warn("[cascade-restore] partial errors:", errors);
      return res.status(207).json({ ok: false, errors });
    }

    res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── ALERTS (generated from real data) ───────────────────────────────────────
router.get("/alerts", async (_req, res) => {
  try {
    const today = new Date();
    const alerts: any[] = [];

    const [ordersResult, collectionsResult, clientsResult, inventoryResult, clientInventoryResult] = await Promise.all([
      supabaseAdmin.from("orders").select("id,status,date,client_id,total_selling,created_at"),
      supabaseAdmin.from("collections").select("id,status,due_date,client_id,client_name,amount,total,created_at"),
      supabaseAdmin.from("clients").select("id,name"),
      supabaseAdmin.from("inventory").select("material_code,material_name,quantity,min_quantity,expiry_date"),
      supabaseAdmin.from("client_inventory").select("id,client_id,client_name,material,code,unit,remaining,avg_weekly_usage,lead_time_weeks,safety_stock,status"),
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

    for (const ci of clientInventoryResult.data || []) {
      const remaining = Number(ci.remaining || 0);
      const avgWeekly = Number(ci.avg_weekly_usage || 0);
      const leadTime = Number(ci.lead_time_weeks || 2);
      const safetyStock = Number(ci.safety_stock || 0);
      if (avgWeekly <= 0) continue;
      const coverageWeeks = remaining / avgWeekly;
      const reorderPoint = (avgWeekly * leadTime) + safetyStock;
      if (remaining > reorderPoint) continue;
      const isCritical = coverageWeeks <= leadTime * 0.5;
      const isUrgent = coverageWeeks <= leadTime;
      if (!isCritical && !isUrgent) continue;
      const clientName = ci.client_name || clientMap[ci.client_id] || ci.client_id || "";
      const suggestedQty = Math.max(0, Math.ceil((avgWeekly * leadTime * 2) + safetyStock - remaining));
      alerts.push({
        id: `refill-${ci.id}`,
        type: "refill",
        severity: isCritical ? "critical" : "warning",
        title: `${isCritical ? "⚠ إعادة طلب عاجل" : "إعادة طلب"} — ${ci.material || ci.code}`,
        description: `${clientName} — متبقي ${remaining} ${ci.unit || "وحدة"} (يكفي ${coverageWeeks.toFixed(1)} أسبوع) — الكمية المقترحة: ${suggestedQty}`,
        date: today.toISOString().split("T")[0],
        link: "/refill",
        clientId: ci.client_id,
      });
    }

    const depleted = (clientInventoryResult.data || []).filter((ci: any) => {
      const remaining = Number(ci.remaining || 0);
      return remaining === 0 && (ci.status === "Depleted" || ci.status === "نفد");
    });
    for (const ci of depleted) {
      const clientName = ci.client_name || clientMap[ci.client_id] || ci.client_id || "";
      alerts.push({
        id: `depleted-${ci.id}`,
        type: "refill",
        severity: "critical",
        title: `نفد المخزون — ${ci.material || ci.code}`,
        description: `${clientName} — المخزون صفر — يحتاج إعادة طلب فوراً`,
        date: today.toISOString().split("T")[0],
        link: "/refill",
        clientId: ci.client_id,
      });
    }

    alerts.sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      return (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2);
    });

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
  const { data: snap } = await supabaseAdmin.from("requests").select("*").eq("id", req.params.id).single();
  if (snap) await softDelete("request", req.params.id, `${req.params.id} — ${snap.client || ""}`, snap);
  const { error } = await supabaseAdmin.from("requests").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ─── DELIVERIES ───────────────────────────────────────────────────────────────
router.get("/deliveries", async (req, res) => {
  const orderId = req.query.orderId ? String(req.query.orderId) : null;
  const result = orderId
    ? await supabaseAdmin.from("deliveries").select("*").eq("order_id", orderId).order("created_at", { ascending: false })
    : await supabaseAdmin.from("deliveries").select("*").order("created_at", { ascending: false });
  sbOk(res, result);
});
router.post("/deliveries", async (req, res) => {
  const result = await supabaseAdmin.from("deliveries").insert(snakifyKeys(req.body)).select().single();
  if (!result.error && result.data) {
    const del = result.data;
    const orderId = del.order_id;
    if (orderId) {
      try {
        const { data: order } = await supabaseAdmin.from("orders").select("status").eq("id", orderId).single();
        if (order && ["Draft", "Confirmed", "Awaiting Purchase"].includes(order.status)) {
          await supabaseAdmin.from("orders").update({ status: "Processing" }).eq("id", orderId);
        }
      } catch (e: any) { console.error("delivery-create order-status sync error:", e.message); }
    }
  }
  sbOk(res, result);
});
router.patch("/deliveries/:id", async (req, res) => {
  const result = await supabaseAdmin.from("deliveries").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single();
  if (!result.error && req.body.status === "Delivered") {
    const del = result.data;
    const orderId = del.order_id;
    const clientId = del.client_id;
    const deliveryId = del.id;
    const deliveryDate = del.date || new Date().toISOString().split("T")[0];
    try {
      const { data: orderData } = await supabaseAdmin.from("orders").select("order_type, supplier_id").eq("id", orderId).single();
      const orderType = orderData?.order_type || "client";
      const orderSupplierId = orderData?.supplier_id || "";

      const { data: existingForDelivery } = await supabaseAdmin.from(orderType === "inventory" ? "company_inventory" : "client_inventory").select("id").like("id", `CI-${deliveryId}-%`).limit(1);
      if (!existingForDelivery || existingForDelivery.length === 0) {
        const { data: lines } = await supabaseAdmin.from("order_lines").select("*").eq("order_id", orderId);
        const { data: clientData } = await supabaseAdmin.from("clients").select("name").eq("id", clientId).single();
        const clientName = clientData?.name || clientId;

        let parsedNotes: any = null;
        try { parsedNotes = typeof del.notes === "string" ? JSON.parse(del.notes) : null; } catch {}
        const isPartial = parsedNotes && Array.isArray(parsedNotes.items) && parsedNotes.items.length > 0;

        const ciRows: any[] = [];
        const ts = Date.now();

        if (isPartial) {
          const lineMap: Record<string, any> = {};
          (lines || []).forEach((l: any) => { lineMap[String(l.id)] = l; });
          for (const item of parsedNotes.items) {
            const line = lineMap[String(item.lineId)];
            const qty = Number(item.qty) || 0;
            if (qty <= 0) continue;
            ciRows.push({
              id: `CI-${deliveryId}-${item.materialCode || item.lineId}-${ts}`,
              client_id: clientId,
              client_name: clientName,
              material: item.materialName || line?.material_name || "",
              code: item.materialCode || line?.material_code || "",
              unit: item.unit || line?.unit || "unit",
              delivered: qty,
              remaining: qty,
              selling_price: Number(line?.selling_price) || 0,
              store_cost: Number(line?.cost_price) || 0,
              delivery_date: deliveryDate,
              source_order: orderId,
            });
          }
        } else if (lines && lines.length > 0) {
          const { data: priorDeliveries } = await supabaseAdmin
            .from("deliveries").select("notes, status").eq("order_id", orderId).neq("id", deliveryId);
          const deliveredStatuses = ["Delivered", "تم التسليم", "مُسلَّم"];
          const alreadyDelivered: Record<string, number> = {};
          for (const pd of (priorDeliveries || [])) {
            if (!deliveredStatuses.includes(pd.status)) continue;
            try {
              const pn = typeof pd.notes === "string" ? JSON.parse(pd.notes) : null;
              if (pn && Array.isArray(pn.items)) {
                for (const pi of pn.items) {
                  const key = String(pi.lineId || pi.materialCode || "");
                  if (key) alreadyDelivered[key] = (alreadyDelivered[key] || 0) + (Number(pi.qty) || 0);
                }
              }
            } catch {}
          }

          for (const line of lines) {
            const totalQty = Number(line.quantity) || 0;
            const prevDelivered = alreadyDelivered[String(line.id)] || alreadyDelivered[line.material_code] || 0;
            const qty = Math.max(0, totalQty - prevDelivered);
            if (qty <= 0) continue;
            ciRows.push({
              id: `CI-${deliveryId}-${line.material_code || line.id}-${ts}`,
              client_id: clientId,
              client_name: clientName,
              material: line.material_name || "",
              code: line.material_code || "",
              unit: line.unit || "unit",
              delivered: qty,
              remaining: qty,
              selling_price: Number(line.selling_price) || 0,
              store_cost: Number(line.cost_price) || 0,
              delivery_date: deliveryDate,
              source_order: orderId,
            });
          }
        }

        if (ciRows.length > 0) {
          if (orderType === "inventory") {
            const companyRows = ciRows.map(row => ({
              id: row.id,
              material_code: row.code,
              material_name: row.material,
              unit: row.unit,
              lot_number: `LOT-${deliveryId}-${Date.now()}`,
              quantity: row.delivered,
              remaining: row.remaining,
              cost_price: row.store_cost,
              source_order: row.source_order,
              date_added: row.delivery_date,
              status: "In Stock",
              supplier_id: orderSupplierId,
            }));
            await supabaseAdmin.from("company_inventory").insert(companyRows);
          } else {
            await supabaseAdmin.from("client_inventory").insert(ciRows);
          }
        }
      }
    } catch (e: any) {
      console.error("inventory auto-insert error:", e.message);
    }

    // Auto-sync order status based on delivery progress
    try {
      const { data: allDeliveries } = await supabaseAdmin
        .from("deliveries").select("*").eq("order_id", orderId);
      const { data: orderLines } = await supabaseAdmin
        .from("order_lines").select("*").eq("order_id", orderId);

      if (orderLines && orderLines.length > 0 && allDeliveries) {
        const deliveredQtyMap: Record<string, number> = {};
        orderLines.forEach((l: any) => { deliveredQtyMap[String(l.id)] = 0; });

        for (const d of allDeliveries.filter((d: any) => d.status === "Delivered")) {
          let parsed: any = null;
          try { parsed = typeof d.notes === "string" ? JSON.parse(d.notes) : null; } catch {}
          if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
            for (const item of parsed.items) {
              const key = String(item.lineId);
              if (deliveredQtyMap[key] !== undefined) {
                deliveredQtyMap[key] += Number(item.qty) || 0;
              }
            }
          } else {
            const noteStr = typeof d.notes === "string" ? d.notes.trim() : "";
            let isFull = !noteStr || noteStr === "كامل" || noteStr.toLowerCase() === "full";
            if (!isFull && parsed && Array.isArray(parsed.items) && parsed.items.length === 0) {
              isFull = true;
            }
            if (isFull) {
              orderLines.forEach((l: any) => {
                deliveredQtyMap[String(l.id)] = Number(l.quantity) || 0;
              });
            }
          }
        }

        const allFullyDelivered = orderLines.every((l: any) =>
          (deliveredQtyMap[String(l.id)] || 0) >= (Number(l.quantity) || 0)
        );
        const anyDelivered = Object.values(deliveredQtyMap).some(q => q > 0);

        const newStatus = allFullyDelivered ? "Delivered" : anyDelivered ? "Partially Delivered" : null;
        if (newStatus) {
          await supabaseAdmin.from("orders").update({ status: newStatus }).eq("id", orderId);
        }
      }
    } catch (e: any) {
      console.error("order status sync error:", e.message);
    }
  }
  sbOk(res, result);
});
router.delete("/deliveries/:id", async (req, res) => {
  const deliveryId = req.params.id;
  const { data: snap } = await supabaseAdmin.from("deliveries").select("*").eq("id", deliveryId).single();
  if (!snap) return res.status(404).json({ error: "Delivery not found" });

  const orderId = snap.order_id || "";

  if (snap) await softDelete("delivery", deliveryId, `${deliveryId} — ${snap.client || ""}`, snap);

  // Remove client_inventory rows created by this delivery (IDs start with CI-<deliveryId>-)
  try {
    await supabaseAdmin.from("client_inventory").delete().like("id", `CI-${deliveryId}-%`);
  } catch (e: any) { console.error("cleanup client_inventory on delivery delete:", e.message); }

  // Remove company_inventory rows created by this delivery
  try {
    await supabaseAdmin.from("company_inventory").delete().like("id", `CI-${deliveryId}-%`);
  } catch (e: any) { console.error("cleanup company_inventory on delivery delete:", e.message); }

  // Delete the delivery itself
  const { error } = await supabaseAdmin.from("deliveries").delete().eq("id", deliveryId);
  if (error) return res.status(500).json({ error: error.message });

  // Re-sync order status after removing this delivery
  if (orderId) {
    try {
      const { data: remainingDeliveries } = await supabaseAdmin
        .from("deliveries").select("*").eq("order_id", orderId);
      const { data: orderLines } = await supabaseAdmin
        .from("order_lines").select("*").eq("order_id", orderId);

      if (orderLines && orderLines.length > 0) {
        const deliveredQtyMap: Record<string, number> = {};
        orderLines.forEach((l: any) => { deliveredQtyMap[String(l.id)] = 0; });

        if (remainingDeliveries && remainingDeliveries.length > 0) {
          for (const d of remainingDeliveries.filter((d: any) => d.status === "Delivered")) {
            let parsed: any = null;
            try { parsed = typeof d.notes === "string" ? JSON.parse(d.notes) : null; } catch {}
            if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
              for (const item of parsed.items) {
                const key = String(item.lineId);
                if (deliveredQtyMap[key] !== undefined) {
                  deliveredQtyMap[key] += Number(item.qty) || 0;
                }
              }
            } else {
              const noteStr = typeof d.notes === "string" ? d.notes.trim() : "";
              let isFull = !noteStr || noteStr === "كامل" || noteStr.toLowerCase() === "full";
              if (!isFull && parsed && Array.isArray(parsed.items) && parsed.items.length === 0) {
                isFull = true;
              }
              if (isFull) {
                orderLines.forEach((l: any) => {
                  deliveredQtyMap[String(l.id)] = Number(l.quantity) || 0;
                });
              }
            }
          }
        }

        const allFullyDelivered = orderLines.every((l: any) =>
          (deliveredQtyMap[String(l.id)] || 0) >= (Number(l.quantity) || 0)
        );
        const anyDelivered = Object.values(deliveredQtyMap).some(q => q > 0);

        let newStatus: string;
        if (allFullyDelivered && remainingDeliveries && remainingDeliveries.length > 0) {
          newStatus = "Delivered";
        } else if (anyDelivered) {
          newStatus = "Partially Delivered";
        } else {
          newStatus = "Processing";
        }
        await supabaseAdmin.from("orders").update({ status: newStatus }).eq("id", orderId);
      }
    } catch (e: any) {
      console.error("order status re-sync on delivery delete:", e.message);
    }
  }

  res.json({ ok: true });
});

// ─── COLLECTIONS ──────────────────────────────────────────────────────────────
router.get("/collections", async (_req, res) => {
  sbOk(res, await supabaseAdmin.from("collections").select("*").order("created_at", { ascending: false }));
});
router.post("/collections", async (req, res) => {
  const body = { ...req.body };
  if (!body.id) body.id = `COL-${Date.now()}`;
  sbOk(res, await supabaseAdmin.from("collections").insert(snakifyKeys(body)).select().single());
});
router.patch("/collections/:id", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("collections").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single());
});
router.delete("/collections/:id", async (req, res) => {
  const { data: snap } = await supabaseAdmin.from("collections").select("*").eq("id", req.params.id).single();
  if (snap) await softDelete("collection", req.params.id, `${req.params.id} — ${snap.client || ""}`, snap);
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

// ─── COMPANY INVENTORY (Supabase) ────────────────────────────────────────────

async function syncInventoryRemaining() {
  const { data: lots } = await supabaseAdmin.from("company_inventory").select("id, quantity");
  if (!lots || lots.length === 0) return;
  const { data: pulledLines } = await supabaseAdmin.from("order_lines").select("inventory_lot_id, quantity").eq("from_inventory", true).neq("inventory_lot_id", "");
  const usedMap: Record<string, number> = {};
  for (const line of (pulledLines || [])) {
    const lid = line.inventory_lot_id;
    usedMap[lid] = (usedMap[lid] || 0) + Number(line.quantity);
  }
  const updates: Promise<any>[] = [];
  for (const lot of lots) {
    const totalQty = Number(lot.quantity) || 0;
    const used = usedMap[lot.id] || 0;
    const newRemaining = Math.max(0, totalQty - used);
    const status = newRemaining <= 0 ? "Depleted" : newRemaining < totalQty * 0.2 ? "Low Stock" : "In Stock";
    updates.push(
      supabaseAdmin.from("company_inventory").update({ remaining: newRemaining, status }).eq("id", lot.id)
    );
  }
  await Promise.all(updates);
}

router.get("/company-inventory", async (_req, res) => {
  try { await syncInventoryRemaining(); } catch (e: any) { console.warn("[sync-inventory]", e.message); }
  const { data, error } = await supabaseAdmin.from("company_inventory").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(camelizeKeys(data || []));
});

router.get("/company-inventory/:id", async (req, res) => {
  const { data, error } = await supabaseAdmin.from("company_inventory").select("*").eq("id", req.params.id).single();
  if (error) {
    if (error.code === "PGRST116") return res.status(404).json({ error: "Lot not found" });
    return res.status(500).json({ error: error.message });
  }
  res.json(camelizeKeys(data));
});

router.post("/company-inventory", async (req, res) => {
  const body = snakifyKeys(req.body);
  const { data, error } = await supabaseAdmin.from("company_inventory").insert(body).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(camelizeKeys(data));
});

router.patch("/company-inventory/:id", async (req, res) => {
  const { data, error } = await supabaseAdmin.from("company_inventory").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(camelizeKeys(data));
});

router.delete("/company-inventory/:id", async (req, res) => {
  const { error } = await supabaseAdmin.from("company_inventory").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.post("/company-inventory/withdraw", async (req, res) => {
  const { lotId, quantity } = req.body;
  if (!lotId || !quantity) return res.status(400).json({ error: "lotId and quantity required" });
  const { data: lot, error: lotErr } = await supabaseAdmin.from("company_inventory").select("*").eq("id", lotId).single();
  if (lotErr || !lot) return res.status(404).json({ error: "Lot not found" });
  const remaining = Number(lot.remaining) || 0;
  const withdrawQty = Number(quantity);
  if (withdrawQty <= 0 || withdrawQty > remaining) return res.status(400).json({ error: `Cannot withdraw ${withdrawQty}. Available: ${remaining}` });
  const newRemaining = remaining - withdrawQty;
  const newStatus = newRemaining <= 0 ? "Depleted" : newRemaining < Number(lot.quantity) * 0.2 ? "Low Stock" : "In Stock";
  const { data, error } = await supabaseAdmin.from("company_inventory")
    .update({ remaining: newRemaining, status: newStatus })
    .eq("id", lotId).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(camelizeKeys(data));
});

// ─── CLIENT INVENTORY (Supabase) ─────────────────────────────────────────────
router.get("/client-inventory", async (req, res) => {
  const { clientId, sourceOrder } = req.query as { clientId?: string; sourceOrder?: string };
  let q = supabaseAdmin.from("client_inventory").select("*").order("created_at", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);
  if (sourceOrder) q = q.eq("source_order", sourceOrder);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  const items = data || [];
  const orderIds = [...new Set(items.map((r: any) => r.source_order).filter(Boolean))] as string[];
  const imgBySku: Record<string, string> = {};
  const imgByName: Record<string, string> = {};
  if (orderIds.length > 0) {
    const { data: lines } = await supabaseAdmin
      .from("order_lines")
      .select("order_id, material_code, image_url")
      .in("order_id", orderIds);
    (lines || []).forEach((l: any) => {
      if (l.material_code && l.image_url) imgBySku[l.material_code] = l.image_url;
    });
  }
  try {
    const ext = getExtClient();
    const { data: extProducts } = await ext.from("products").select("sku, name, image_url");
    (extProducts || []).forEach((p: any) => {
      const img = p.image_url || "";
      if (!img.startsWith("http")) return;
      if (p.sku && !imgBySku[p.sku]) imgBySku[p.sku] = img;
      if (p.name) imgByName[p.name.toLowerCase().trim()] = img;
    });
  } catch {}
  const enriched = items.map((r: any) => {
    const code = r.code || "";
    const matName = r.material || "";
    return { ...r, image_url: imgBySku[code] || imgByName[matName.toLowerCase().trim()] || "" };
  });
  res.json(camelizeKeys(enriched));
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
  const { data: snap } = await supabaseAdmin.from("client_inventory").select("*").eq("id", req.params.id).single();
  if (snap) await softDelete("client-inventory", req.params.id, `${snap.material || ""} — ${snap.client_name || ""}`, snap);
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
  const { data: snap } = await supabaseAdmin.from("audits").select("*").eq("id", req.params.id).single();
  if (snap) await softDelete("audit", req.params.id, `${req.params.id} — ${snap.client_name || ""}`, snap);
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
router.delete("/treasury/accounts/:id", async (req, res) => {
  const { data: snap } = await supabaseAdmin.from("treasury_accounts").select("*").eq("id", req.params.id).single();
  const { data: txns } = await supabaseAdmin.from("treasury_transactions").select("*").eq("account_id", req.params.id);
  if (snap) await softDelete("treasury-account", req.params.id, snap.name || req.params.id, snap, { transactions: txns || [] });
  const { error } = await supabaseAdmin.from("treasury_accounts").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
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

  if (tx) await softDelete("treasury-transaction", req.params.id, `${tx.description || tx.tx_type || req.params.id}`, tx);

  const { error } = await supabaseAdmin.from("treasury_transactions").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  if (tx.account_id && tx.amount !== null) {
    const { data: acc } = await supabaseAdmin.from("treasury_accounts").select("balance").eq("id", tx.account_id).single();
    if (acc) {
      const restored = Number(acc.balance) - Number(tx.amount);
      await supabaseAdmin.from("treasury_accounts")
        .update({ balance: restored, updated_at: new Date().toISOString() })
        .eq("id", tx.account_id);
    }
  }
  res.json({ ok: true });
});

// ─── FOUNDER TRANSACTIONS ────────────────────────────────────────────────────
// txTypes: contribution | withdrawal | order_funding | capital_return | capital_withdrawal
// performedBy = founderId, referenceId = founderName
// description = JSON string for capital_return, "[orderId:X] notes" for others
const FOUNDER_TX_TYPES = [
  "founder_contribution", "founder_withdrawal", "order_funding",
  "capital_return", "capital_withdrawal"
];

function parseFounderDesc(desc: string | null): { orderId: string; collectionId: string; clientName: string; notes: string } {
  if (!desc) return { orderId: "", collectionId: "", clientName: "", notes: "" };
  // JSON format (capital_return)
  if (desc.trim().startsWith("{")) {
    try {
      const j = JSON.parse(desc);
      return { orderId: j.orderId || "", collectionId: j.collectionId || "", clientName: j.clientName || "", notes: j.notes || "" };
    } catch {}
  }
  // Legacy format: [orderId:X] notes
  const match = desc.match(/^\[orderId:([^\]]*)\]\s*(.*)/s);
  if (match) return { orderId: match[1] || "", collectionId: "", clientName: "", notes: match[2] || "" };
  return { orderId: "", collectionId: "", clientName: "", notes: desc };
}
function encodeFounderDesc(orderId: string | null, notes: string | null, extra?: { collectionId?: string; clientName?: string }): string | null {
  if (extra?.collectionId) {
    return JSON.stringify({ orderId: orderId || "", collectionId: extra.collectionId, clientName: extra.clientName || "", notes: notes || "" });
  }
  if (!orderId && !notes) return null;
  if (!orderId) return notes || null;
  return `[orderId:${orderId}] ${notes || ""}`.trim();
}

// ── Company Profit Summary (total company profit from collections minus expenses) ──
router.get("/company-profit-summary", async (_req, res) => {
  try {
    const [colsRes, ordsRes, rulesRes, contribRes, lineRes, txRes] = await Promise.all([
      supabaseAdmin.from("collections").select("*"),
      supabaseAdmin.from("orders").select("*"),
      supabaseAdmin.from("business_rules").select("*").eq("id", "default").maybeSingle(),
      supabaseAdmin.from("order_founder_contributions").select("order_id,contributions"),
      supabaseAdmin.from("order_lines").select("order_id,line_cost"),
      supabaseAdmin.from("treasury_transactions").select("*").in("tx_type", ["expense", "withdrawal"]),
    ]);
    if (colsRes.error || ordsRes.error) return res.status(500).json({ error: (colsRes.error || ordsRes.error)!.message });

    const globalPct = Number(rulesRes.data?.company_profit_percentage ?? 40);
    const contribMap: Record<string, any[]> = {};
    for (const r of contribRes.data || []) contribMap[r.order_id] = r.contributions || [];
    const costMap: Record<string, number> = {};
    for (const l of lineRes.data || []) costMap[l.order_id] = (costMap[l.order_id] || 0) + (Number(l.line_cost) || 0);

    const orderMap: Record<string, any> = {};
    (ordsRes.data || []).forEach(o => {
      orderMap[o.id] = {
        ...o,
        founder_contributions: contribMap[o.id] || [],
        total_cost: costMap[o.id] || 0,
      };
    });

    const getOrderPct = (oid: string): number => {
      const o = orderMap[oid];
      if (!o) return globalPct;
      const ca = Array.isArray(o.founder_contributions) ? o.founder_contributions : [];
      return ca[0]?.companyProfitPercentage ?? globalPct;
    };

    let totalCompanyProfit = 0;

    (colsRes.data || []).forEach((col: any) => {
      const paid = Number(col.paid_amount || 0);
      if (paid <= 0) return;
      const primaryOrderId = col.order_id || "";

      let notesMeta: any = {};
      try { notesMeta = typeof col.notes === "object" ? (col.notes || {}) : JSON.parse(col.notes || "{}"); } catch {}
      const lineItems: any[] = notesMeta.lineItems || [];

      if (lineItems.length > 0 && lineItems.some((li: any) => li.sourceOrderId)) {
        let totalItemsSelling = 0;
        lineItems.forEach((li: any) => {
          totalItemsSelling += Number(li.sellingPrice ?? li.selling_price ?? 0) * Number(li.quantity ?? 1);
        });
        const payRatio = totalItemsSelling > 0 ? Math.min(paid / totalItemsSelling, 1) : 0;
        lineItems.forEach((li: any) => {
          const oid = li.sourceOrderId || primaryOrderId;
          if (!orderMap[oid]) return;
          const order = orderMap[oid];
          const lineSelling = Number(li.sellingPrice ?? li.selling_price ?? 0) * Number(li.quantity ?? 1);
          const lineCost = Number(li.costPrice ?? li.cost_price ?? li.cost ?? 0) * Number(li.quantity ?? 1);
          const pct = getOrderPct(oid);
          const normPct = pct >= 2 ? pct / 100 : pct;
          let lineProfit = lineSelling - lineCost;
          if (order.delivery_fee_bearer === "company") {
            const orderTotal = Number(order.total_selling || 0);
            const delFee = Number(order.delivery_fee || 0);
            if (orderTotal > 0 && delFee > 0) {
              lineProfit -= delFee * (lineSelling / orderTotal);
            }
          }
          totalCompanyProfit += lineProfit * payRatio * normPct;
        });
      } else {
        const srcOrders: string[] = (notesMeta.sourceOrders?.length > 0
          ? notesMeta.sourceOrders.filter((oid: string) => orderMap[oid])
          : (primaryOrderId && orderMap[primaryOrderId] ? [primaryOrderId] : []));
        if (srcOrders.length === 0) return;

        let allSelling = 0;
        srcOrders.forEach((oid: string) => { allSelling += Number(orderMap[oid].total_selling || 0); });

        srcOrders.forEach((oid: string) => {
          const order = orderMap[oid];
          const oSelling = Number(order.total_selling || 0);
          const oCost = Number(order.total_cost || 0);
          const share = allSelling > 0 ? oSelling / allSelling : 1 / srcOrders.length;
          const oPaid = paid * share;
          const pct = getOrderPct(oid);
          const delFeeDeduction = order.delivery_fee_bearer === "company" ? Number(order.delivery_fee || 0) : 0;
          const qp = quickProfit({ orderTotal: oSelling, totalCost: oCost, paidValue: oPaid, companyProfitPct: pct, deliveryFeeDeduction: delFeeDeduction });
          totalCompanyProfit += qp.companyProfit;
        });
      }
    });

    let totalExpenses = 0;
    (txRes.data || []).forEach((tx: any) => {
      totalExpenses += Math.abs(Number(tx.amount || 0));
    });

    const netProfit = Math.round(totalCompanyProfit) - totalExpenses;

    const { data: companyAcc } = await supabaseAdmin
      .from("treasury_accounts").select("id,balance").eq("name", "حساب الشركة").maybeSingle();
    if (companyAcc && Number(companyAcc.balance) !== netProfit) {
      await supabaseAdmin.from("treasury_accounts")
        .update({ balance: netProfit, updated_at: new Date().toISOString() })
        .eq("id", companyAcc.id);
    }

    res.json({ totalCompanyProfit: Math.round(totalCompanyProfit), totalExpenses, netProfit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Founder capital balances (mirrors TreasuryAccounts logic) ──
router.get("/founder-balances", async (_req, res) => {
  try {
    const [{ data: founders }, { data: txData }, { data: cols }, { data: ords }, { data: rulesRows }, { data: contribRows }, { data: lineRows }] = await Promise.all([
      supabaseAdmin.from("founders").select("id,name"),
      supabaseAdmin.from("treasury_transactions").select("*").in("tx_type", FOUNDER_TX_TYPES),
      supabaseAdmin.from("collections").select("id,order_id,paid_amount,total_amount,notes"),
      supabaseAdmin.from("orders").select("*"),
      supabaseAdmin.from("business_rules").select("*").eq("id", "default").maybeSingle(),
      supabaseAdmin.from("order_founder_contributions").select("order_id,contributions"),
      supabaseAdmin.from("order_lines").select("order_id,line_cost"),
    ]);
    const fList = (founders || []) as { id: string; name: string }[];
    const txList = (txData || []) as any[];
    const colList = (cols || []) as any[];
    const ordList = (ords || []) as any[];
    const globalPct = Number(rulesRows?.company_profit_percentage ?? 40);

    const contribMap: Record<string, any[]> = {};
    for (const r of contribRows || []) contribMap[r.order_id] = r.contributions || [];
    const costMap: Record<string, number> = {};
    for (const l of lineRows || []) costMap[l.order_id] = (costMap[l.order_id] || 0) + (Number(l.line_cost) || 0);

    const orderMap: Record<string, any> = {};
    ordList.forEach(o => {
      orderMap[o.id] = {
        ...o,
        founder_contributions: contribMap[o.id] || [],
        total_cost: costMap[o.id] || 0,
      };
    });

    const autoCapital: Record<string, number> = {};
    const autoProfit: Record<string, number> = {};
    fList.forEach(f => { autoCapital[f.id] = 0; autoProfit[f.id] = 0; });
    colList.forEach(col => {
      const order = orderMap[col.order_id];
      if (!order) return;
      const paid = Number(col.paid_amount ?? 0);
      const totalSelling = Number(order.total_selling ?? 0);
      const totalCost = Number(order.total_cost ?? 0);
      if (totalSelling <= 0 || paid <= 0) return;
      let contribs: any[] = [];
      const rawC = order.founder_contributions;
      if (Array.isArray(rawC)) contribs = rawC;
      else if (typeof rawC === "string") { try { contribs = JSON.parse(rawC); } catch { contribs = []; } }
      const companyPct = globalPct;
      const delFeeDeduction = order.delivery_fee_bearer === "company" ? Number(order.delivery_fee || 0) : 0;
      const qp = quickProfit({ orderTotal: totalSelling, totalCost, paidValue: paid, companyProfitPct: companyPct, deliveryFeeDeduction: delFeeDeduction });
      const capitalReturn = Math.round(qp.recoveredCapital);
      const foundersProfit = qp.foundersProfit;
      const sm = order.split_mode || "equal";
      const isWeighted = sm.includes("مساهمة") || sm.toLowerCase().includes("contribution") || sm === "weighted";
      const splits = founderSplit(foundersProfit, capitalReturn, contribs, isWeighted ? "weighted" : "equal");
      fList.forEach(f => {
        let capShare = 0;
        let profShare = 0;
        if (contribs.length > 0) {
          const match = splits.find((s: any) => s.id === f.id || s.name === f.name);
          if (match) { capShare = match.capitalShare; profShare = match.profit; }
        } else {
          capShare = capitalReturn / (fList.length || 1);
          profShare = foundersProfit / (fList.length || 1);
        }
        if (capShare > 0) autoCapital[f.id] = (autoCapital[f.id] || 0) + Math.round(capShare);
        if (profShare > 0) autoProfit[f.id] = (autoProfit[f.id] || 0) + Math.round(profShare);
      });
    });

    const balances = fList.map(f => {
      const myTxs = txList.filter((tx: any) => tx.performed_by === f.id || tx.reference_id === f.name);
      const manualReturn = myTxs.filter((tx: any) => tx.tx_type === "capital_return").reduce((s: number, tx: any) => s + Math.abs(Number(tx.amount)), 0);
      const withdrawn = myTxs.filter((tx: any) => tx.tx_type === "capital_withdrawal").reduce((s: number, tx: any) => s + Math.abs(Number(tx.amount)), 0);
      return {
        founderId: f.id,
        founderName: f.name,
        balance: (autoCapital[f.id] || 0) + (autoProfit[f.id] || 0) + manualReturn - withdrawn,
      };
    });
    res.json(balances);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/founder-transactions", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("treasury_transactions")
    .select("*")
    .in("tx_type", FOUNDER_TX_TYPES)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const mapped = (data || []).map((tx: any) => {
    const { orderId, collectionId, clientName, notes } = parseFounderDesc(tx.description);
    const typeMap: Record<string, string> = {
      founder_contribution: "contribution",
      founder_withdrawal: "withdrawal",
      order_funding: "funding",
      capital_return: "capital_return",
      capital_withdrawal: "capital_withdrawal",
    };
    return {
      id: tx.id,
      founderId: tx.performed_by || "",
      founderName: tx.reference_id || "",
      type: typeMap[tx.tx_type] || "funding",
      amount: Math.abs(Number(tx.amount)),
      method: tx.category || "bank",
      orderId,
      collectionId,
      clientName,
      notes,
      date: tx.date || (tx.created_at ? tx.created_at.split("T")[0] : ""),
      createdAt: tx.created_at,
    };
  });
  res.json(mapped);
});

router.post("/founder-transactions", async (req, res) => {
  const { founderId, founderName, type, amount, method, orderId, collectionId, clientName, notes, date } = req.body;
  const txTypeMap: Record<string, string> = {
    contribution: "founder_contribution",
    withdrawal: "founder_withdrawal",
    funding: "order_funding",
    capital_return: "capital_return",
    capital_withdrawal: "capital_withdrawal",
  };
  const txType = txTypeMap[type] || "order_funding";
  const isNegative = type === "withdrawal" || type === "capital_withdrawal";
  const signedAmount = isNegative ? -Math.abs(Number(amount)) : Math.abs(Number(amount));
  const txData = {
    tx_type: txType,
    amount: signedAmount,
    balance_after: 0,
    performed_by: founderId || null,
    reference_id: founderName || null,
    category: method || "bank",
    description: encodeFounderDesc(orderId || null, notes || null, { collectionId: collectionId || undefined, clientName: clientName || undefined }),
    date: date || new Date().toISOString().split("T")[0],
  };
  const { data, error } = await supabaseAdmin.from("treasury_transactions").insert(txData).select().single();
  if (error) return res.status(500).json({ error: error.message });

  // ── Sync totals to founders table (contributions/fundings/withdrawals only) ──
  if (founderId) {
    try {
      const { data: f } = await supabaseAdmin.from("founders").select("total_contributed,total_withdrawn").eq("id", founderId).single();
      if (f) {
        const patch: Record<string, number> = {};
        if (type === "contribution" || type === "funding") {
          patch.total_contributed = Number(f.total_contributed || 0) + Math.abs(Number(amount));
        } else if (type === "withdrawal") {
          patch.total_withdrawn = Number(f.total_withdrawn || 0) + Math.abs(Number(amount));
        }
        // capital_return / capital_withdrawal are tracked separately in their own txs
        if (Object.keys(patch).length > 0) {
          await supabaseAdmin.from("founders").update(patch).eq("id", founderId);
        }
      }
    } catch (e: any) { console.warn("[founder-tx] sync totals error:", e.message); }
  }

  const parsed = parseFounderDesc(data.description);
  res.json({
    id: data.id, founderId: data.performed_by || "", founderName: data.reference_id || "",
    type, amount: Math.abs(Number(data.amount)), method: data.category || "bank",
    orderId: parsed.orderId, collectionId: parsed.collectionId, clientName: parsed.clientName, notes: parsed.notes,
    date: data.date || data.created_at?.split("T")[0] || "", createdAt: data.created_at,
  });
});

router.delete("/founder-transactions/:id", async (req, res) => {
  const { data: tx } = await supabaseAdmin.from("treasury_transactions").select("*").eq("id", req.params.id).single();
  if (tx) await softDelete("founder-transaction", req.params.id, `${tx.description || tx.tx_type || req.params.id}`, tx);
  const { error } = await supabaseAdmin.from("treasury_transactions").delete().eq("id", req.params.id).in("tx_type", FOUNDER_TX_TYPES);
  if (error) return res.status(500).json({ error: error.message });

  // ── Reverse founder totals (only for contribution/funding/withdrawal) ──
  if (tx && tx.performed_by) {
    try {
      const { data: f } = await supabaseAdmin.from("founders").select("total_contributed,total_withdrawn").eq("id", tx.performed_by).single();
      if (f) {
        const absAmt = Math.abs(Number(tx.amount));
        const patch: Record<string, number> = {};
        if (tx.tx_type === "founder_contribution" || tx.tx_type === "order_funding") {
          patch.total_contributed = Math.max(0, Number(f.total_contributed || 0) - absAmt);
        } else if (tx.tx_type === "founder_withdrawal") {
          patch.total_withdrawn = Math.max(0, Number(f.total_withdrawn || 0) - absAmt);
        }
        if (Object.keys(patch).length > 0) {
          await supabaseAdmin.from("founders").update(patch).eq("id", tx.performed_by);
        }
      }
    } catch (e: any) { console.warn("[founder-tx] reverse totals error:", e.message); }
  }
  res.json({ ok: true });
});

// ─── FOUNDER FUNDING UNDO ──────────────────────────────────────────────────────
router.post("/founder-funding-undo", async (req, res) => {
  const { orderId, founderName, founderId, performedBy } = req.body;
  if (!orderId || !founderName) return res.status(400).json({ error: "orderId and founderName required" });

  try {
    const { data: contribRow } = await supabaseAdmin
      .from("order_founder_contributions")
      .select("contributions")
      .eq("order_id", orderId)
      .single();
    const contribs: any[] = contribRow?.contributions || [];
    const target = contribs.find((c: any) => c.founder === founderName);
    if (!target || !target.paid) return res.status(400).json({ error: "Founder not found or not paid" });

    const snapshotBefore = JSON.parse(JSON.stringify(target));

    const { data: allTxs } = await supabaseAdmin
      .from("treasury_transactions")
      .select("*")
      .in("tx_type", ["order_funding", "capital_withdrawal"])
      .or(`performed_by.eq.${founderId || "___"},reference_id.eq.${founderName}`);

    const orderTxs = (allTxs || []).filter((tx: any) => {
      const parsed = parseFounderDesc(tx.description);
      return parsed.orderId === orderId;
    });

    for (const tx of orderTxs) {
      const absAmt = Math.abs(Number(tx.amount));
      if (tx.performed_by) {
        const { data: f } = await supabaseAdmin.from("founders").select("total_contributed,total_withdrawn").eq("id", tx.performed_by).single();
        if (f) {
          const patch: Record<string, number> = {};
          if (tx.tx_type === "order_funding") {
            patch.total_contributed = Math.max(0, Number(f.total_contributed || 0) - absAmt);
          } else if (tx.tx_type === "capital_withdrawal") {
            patch.total_withdrawn = Math.max(0, Number(f.total_withdrawn || 0) - absAmt);
          }
          if (Object.keys(patch).length > 0) {
            await supabaseAdmin.from("founders").update(patch).eq("id", tx.performed_by);
          }
        }
      }
      await softDelete("founder-transaction", tx.id, `تراجع: ${tx.description || tx.tx_type}`, tx);
      await supabaseAdmin.from("treasury_transactions").delete().eq("id", tx.id);
    }

    const updatedContribs = contribs.map((c: any) =>
      c.founder === founderName ? { ...c, paid: false, paidAt: undefined } : c
    );
    await supabaseAdmin.from("order_founder_contributions").upsert(
      { order_id: orderId, contributions: updatedContribs, updated_at: new Date().toISOString() },
      { onConflict: "order_id" }
    );

    res.json({
      ok: true,
      snapshotBefore,
      deletedTxCount: orderTxs.length,
      updatedContributions: updatedContribs,
    });
  } catch (e: any) {
    console.error("[founder-funding-undo] error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── FOUNDER SPLIT EDIT ────────────────────────────────────────────────────────
router.post("/founder-split-edit", async (req, res) => {
  const { orderId, newContributions, performedBy } = req.body;
  if (!orderId || !Array.isArray(newContributions)) return res.status(400).json({ error: "orderId and newContributions required" });

  const totalPct = newContributions.reduce((s: number, c: any) => s + (Number(c.percentage) || 0), 0);
  if (Math.abs(totalPct - 100) > 0.1) return res.status(400).json({ error: `Percentages must sum to 100% (currently ${totalPct}%)` });

  try {
    const { data: contribRow } = await supabaseAdmin
      .from("order_founder_contributions")
      .select("contributions")
      .eq("order_id", orderId)
      .single();
    const oldContribs: any[] = contribRow?.contributions || [];
    const hasPaid = oldContribs.some((c: any) => c.paid);
    if (hasPaid) return res.status(400).json({ error: "Cannot edit split while founders have paid. Undo payments first." });

    const { data: orderData } = await supabaseAdmin.from("orders").select("total_cost").eq("id", orderId).single();
    const { data: linesData } = await supabaseAdmin.from("order_lines").select("line_cost").eq("order_id", orderId);
    const totalCost = (linesData || []).reduce((s: number, l: any) => s + (Number(l.line_cost) || 0), 0) || Number(orderData?.total_cost || 0);

    const finalContribs = newContributions.map((c: any) => ({
      founder: c.founder,
      founderId: c.founderId || "",
      percentage: Number(c.percentage) || 0,
      amount: Math.round(totalCost * (Number(c.percentage) || 0) / 100),
      paid: false,
    }));

    await supabaseAdmin.from("order_founder_contributions").upsert(
      { order_id: orderId, contributions: finalContribs, updated_at: new Date().toISOString() },
      { onConflict: "order_id" }
    );

    res.json({
      ok: true,
      oldContributions: oldContribs,
      newContributions: finalContribs,
      totalCost,
    });
  } catch (e: any) {
    console.error("[founder-split-edit] error:", e.message);
    res.status(500).json({ error: e.message });
  }
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

// ─── TRASH / DELETED ITEMS ────────────────────────────────────────────────────
const ENTITY_TABLE_MAP: Record<string, { table: string; idField: string }> = {
  client: { table: "clients", idField: "id" },
  supplier: { table: "suppliers", idField: "id" },
  material: { table: "materials", idField: "code" },
  founder: { table: "founders", idField: "id" },
  "delivery-actor": { table: "delivery_actors", idField: "id" },
  order: { table: "orders", idField: "id" },
  request: { table: "requests", idField: "id" },
  delivery: { table: "deliveries", idField: "id" },
  collection: { table: "collections", idField: "id" },
  "client-inventory": { table: "client_inventory", idField: "id" },
  audit: { table: "audits", idField: "id" },
  "treasury-account": { table: "treasury_accounts", idField: "id" },
  "treasury-transaction": { table: "treasury_transactions", idField: "id" },
  "founder-transaction": { table: "treasury_transactions", idField: "id" },
  "external-material": { table: "products", idField: "id" },
};

router.get("/trash", async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from("deleted_items").select("*").order("deleted_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e: any) {
    res.json([]);
  }
});

router.get("/trash/count", async (_req, res) => {
  try {
    const { count, error } = await supabaseAdmin.from("deleted_items").select("*", { count: "exact", head: true });
    if (error) return res.json({ count: 0 });
    res.json({ count: count || 0 });
  } catch {
    res.json({ count: 0 });
  }
});

router.post("/trash/:id/restore", async (req, res) => {
  try {
    const { data: items, error: fetchErr } = await supabaseAdmin.from("deleted_items").select("*").eq("id", req.params.id);
    if (fetchErr || !items || items.length === 0) return res.status(404).json({ error: "Item not found in trash" });

    const item = items[0];
    const entityType = item.entity_type;
    const snapshot = typeof item.snapshot === "string" ? JSON.parse(item.snapshot) : item.snapshot;
    const relatedData = typeof item.related_data === "string" ? JSON.parse(item.related_data) : item.related_data;
    const mapping = ENTITY_TABLE_MAP[entityType];

    if (!mapping) return res.status(400).json({ error: `Unknown entity type: ${entityType}` });

    if (entityType === "order") {
      const { error: orderErr } = await supabaseAdmin.from(mapping.table).upsert(snapshot, { onConflict: mapping.idField });
      if (orderErr) return res.status(500).json({ error: `Restore order failed: ${orderErr.message}` });

      const restoreOps: Promise<any>[] = [];
      if (relatedData.orderLines?.length) restoreOps.push(supabaseAdmin.from("order_lines").upsert(relatedData.orderLines, { onConflict: "id" }));
      if (relatedData.founderContributions?.length) restoreOps.push(supabaseAdmin.from("order_founder_contributions").upsert(relatedData.founderContributions, { onConflict: "order_id" }));
      if (relatedData.deliveries?.length) restoreOps.push(supabaseAdmin.from("deliveries").upsert(relatedData.deliveries, { onConflict: "id" }));
      if (relatedData.collections?.length) restoreOps.push(supabaseAdmin.from("collections").upsert(relatedData.collections, { onConflict: "id" }));
      if (relatedData.clientInventory?.length) restoreOps.push(supabaseAdmin.from("client_inventory").upsert(relatedData.clientInventory, { onConflict: "id" }));
      if (relatedData.audits?.length) restoreOps.push(supabaseAdmin.from("audits").upsert(relatedData.audits, { onConflict: "id" }));
      await Promise.allSettled(restoreOps);
    } else if (entityType === "supplier") {
      const { error: supErr } = await supabaseAdmin.from(mapping.table).upsert(snapshot, { onConflict: mapping.idField });
      if (supErr) return res.status(500).json({ error: `Restore failed: ${supErr.message}` });
      if (relatedData.supplierMaterials?.length) {
        await supabaseAdmin.from("supplier_materials").upsert(relatedData.supplierMaterials, { onConflict: "supplier_id,material_code" });
      }
    } else if (entityType === "treasury-account") {
      const { error: accErr } = await supabaseAdmin.from(mapping.table).upsert(snapshot, { onConflict: mapping.idField });
      if (accErr) return res.status(500).json({ error: `Restore failed: ${accErr.message}` });
      if (relatedData.transactions?.length) {
        await supabaseAdmin.from("treasury_transactions").upsert(relatedData.transactions, { onConflict: "id" });
      }
    } else if (entityType === "founder") {
      const { error: fErr } = await supabaseAdmin.from(mapping.table).upsert(snapshot, { onConflict: mapping.idField });
      if (fErr) return res.status(500).json({ error: `Restore failed: ${fErr.message}` });
      const actorId = `ACT-F-${snapshot.id}`;
      await supabaseAdmin.from("delivery_actors").upsert(
        { id: actorId, name: snapshot.name || "", type: "founder", phone: snapshot.phone || "", email: snapshot.email || "", active: true, founder_id: snapshot.id },
        { onConflict: "id", ignoreDuplicates: true }
      ).catch(() => {});
    } else if (entityType === "external-material") {
      const ext = getExtClient();
      if (!ext) return res.status(500).json({ error: "External Supabase not configured" });
      const { error: extErr } = await ext.from("products").upsert(snapshot, { onConflict: "id" });
      if (extErr) return res.status(500).json({ error: `Restore failed: ${extErr.message}` });
    } else {
      const { error: restoreErr } = await supabaseAdmin.from(mapping.table).upsert(snapshot, { onConflict: mapping.idField });
      if (restoreErr) return res.status(500).json({ error: `Restore failed: ${restoreErr.message}` });
    }

    await supabaseAdmin.from("deleted_items").delete().eq("id", req.params.id);
    res.json({ ok: true, entityType, entityId: item.entity_id });
  } catch (e: any) {
    console.error("[trash/restore]", e.message);
    res.status(500).json({ error: e.message });
  }
});

router.delete("/trash/:id", async (req, res) => {
  try {
    await supabaseAdmin.from("deleted_items").delete().eq("id", req.params.id);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/trash", async (_req, res) => {
  try {
    const { data } = await supabaseAdmin.from("deleted_items").select("id");
    if (data && data.length > 0) {
      const ids = data.map((r: any) => r.id);
      await supabaseAdmin.from("deleted_items").delete().in("id", ids);
    }
    res.json({ ok: true, deleted: data?.length || 0 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

const SUPER_ADMIN_EMAIL = "drseifelshamy@gmail.com";

router.get("/admin/users", async (req, res) => {
  const auth = await verifySuperAdmin(req);
  if ("error" in auth) {
    console.log("[admin/users] Access denied. Auth result:", JSON.stringify(auth));
    return res.status(403).json({ error: auth.error });
  }
  const user = auth.user;
  const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, full_name, avatar_url, created_at");
  const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
  const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
  const emailMap: Record<string, string> = {};
  (authUsers || []).forEach((u: any) => { emailMap[u.id] = u.email || ""; });
  const result = (profiles || []).map((p: any) => ({
    ...p,
    email: emailMap[p.user_id] || "",
    roles: (roles || []).filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role),
  }));
  res.json(result);
});

async function verifySuperAdmin(req: any): Promise<{ user: any } | { error: string }> {
  const authHeader = req.headers.authorization;
  if (!authHeader) { console.log("[verifySuperAdmin] No auth header"); return { error: "Unauthorized" }; }
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error) { console.log("[verifySuperAdmin] Token error:", error.message); return { error: "Only the super admin can manage users" }; }
  if (!user) { console.log("[verifySuperAdmin] No user from token"); return { error: "Only the super admin can manage users" }; }
  if (user.email !== SUPER_ADMIN_EMAIL) { console.log("[verifySuperAdmin] Email mismatch:", user.email, "vs", SUPER_ADMIN_EMAIL); return { error: "Only the super admin can manage users" }; }
  return { user };
}

router.patch("/admin/users/:userId/role", async (req, res) => {
  const auth = await verifySuperAdmin(req);
  if ("error" in auth) return res.status(403).json({ error: auth.error });
  const { userId } = req.params;
  const { role } = req.body;
  if (!["admin", "founder", "viewer"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  const { error: deleteError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  if (deleteError) return res.status(500).json({ error: deleteError.message });
  const { error: insertError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
  if (insertError) return res.status(500).json({ error: insertError.message });
  res.json({ ok: true });
});

router.patch("/admin/users/:userId/password", async (req, res) => {
  const auth = await verifySuperAdmin(req);
  if ("error" in auth) return res.status(403).json({ error: auth.error });
  const { userId } = req.params;
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.patch("/admin/users/:userId/profile", async (req, res) => {
  const auth = await verifySuperAdmin(req);
  if ("error" in auth) return res.status(403).json({ error: auth.error });
  const { userId } = req.params;
  const { full_name, phone, email } = req.body;
  const profileUpdates: any = {};
  if (full_name !== undefined) profileUpdates.full_name = full_name;
  if (phone !== undefined) profileUpdates.phone = phone;
  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await supabaseAdmin.from("profiles").update(profileUpdates).eq("user_id", userId);
    if (error) return res.status(500).json({ error: error.message });
  }
  if (email) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { email });
    if (error) return res.status(500).json({ error: error.message });
  }
  res.json({ ok: true });
});

router.post("/admin/users", async (req, res) => {
  const auth = await verifySuperAdmin(req);
  if ("error" in auth) return res.status(403).json({ error: auth.error });
  const { email, password, full_name, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  const validRole = ["admin", "founder", "viewer"].includes(role) ? role : "viewer";
  const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || "" },
  });
  if (createErr) return res.status(500).json({ error: createErr.message });
  const userId = newUser.user.id;
  await supabaseAdmin.from("profiles").upsert({
    user_id: userId,
    full_name: full_name || "",
  }, { onConflict: "user_id" });
  await supabaseAdmin.from("user_roles").upsert({
    user_id: userId,
    role: validRole,
  }, { onConflict: "user_id,role" });
  res.json({ ok: true, userId });
});

router.delete("/admin/users/:userId", async (req, res) => {
  const auth = await verifySuperAdmin(req);
  if ("error" in auth) return res.status(403).json({ error: auth.error });
  const { userId } = req.params;
  if (userId === auth.user.id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
