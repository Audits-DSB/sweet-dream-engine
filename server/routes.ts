import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

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

// ─── camelCase ↔ snake_case helpers ──────────────────────────────────────────
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const toSnake = (s: string) => s.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);

function camelizeKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(camelizeKeys);
  if (!obj || typeof obj !== "object") return obj;
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

// ─── FOUNDERS ─────────────────────────────────────────────────────────────────
router.get("/founders", async (_req, res) => {
  sbOk(res, await supabaseAdmin.from("founders").select("*").order("name"));
});
router.post("/founders", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("founders").insert(snakifyKeys(req.body)).select().single());
});
router.patch("/founders/:id", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("founders").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single());
});
router.delete("/founders/:id", async (req, res) => {
  const { error } = await supabaseAdmin.from("founders").delete().eq("id", req.params.id);
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
  sbOk(res, await supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false }));
});
router.post("/orders", async (req, res) => {
  const data = snakifyKeys(req.body);
  const result = await supabaseAdmin.from("orders").insert(data).select().single();
  if (!result.error && data.client_id) {
    try { await supabaseAdmin.rpc("increment_client_orders", { cid: data.client_id }); } catch { /* ignore */ }
  }
  sbOk(res, result);
});
router.patch("/orders/:id", async (req, res) => {
  sbOk(res, await supabaseAdmin.from("orders").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single());
});
router.delete("/orders/:id", async (req, res) => {
  const { error } = await supabaseAdmin.from("orders").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
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
  sbOk(res, await supabaseAdmin.from("deliveries").update(snakifyKeys(req.body)).eq("id", req.params.id).select().single());
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

export default router;
