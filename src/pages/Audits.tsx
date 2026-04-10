import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { printInvoice } from "@/lib/printInvoice";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/StatCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus, Eye, MoreHorizontal, ClipboardCheck, AlertTriangle, CheckCircle2, XCircle,
  Upload, FileSpreadsheet, Printer, Download, FileText, Package, Loader2, Trash2, Receipt, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { logAudit } from "@/lib/auditLog";

type ComparisonRow = {
  material: string;
  code: string;
  unit: string;
  expected: number;
  actual: number;
  diff: number;
  result: "matched" | "shortage" | "surplus";
  sellingPrice: number;
  storeCost: number;
  imageUrl?: string;
};

type AuditRecord = {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  auditor: string;
  totalItems: number;
  matched: number;
  shortage: number;
  surplus: number;
  notes: string;
  status: string;
  comparison: ComparisonRow[];
  createdAt: string;
};

type InventoryLot = {
  id: string;
  clientId: string;
  clientName: string;
  material: string;
  code: string;
  unit: string;
  remaining: number;
  sellingPrice: number;
  storeCost: number;
  imageUrl?: string;
  sourceOrder?: string;
};

function parseCsvText(text: string): { code: string; name: string; actual: number }[] {
  // Strip BOM if present
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split("\n").filter(l => l.trim());
  const results: { code: string; name: string; actual: number }[] = [];
  // Skip header row if first cell looks like a label
  const start = lines[0]?.match(/code|material|اسم|كود|الكمية|actual|الفعلي/i) ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 2) continue;
    // Positional: col[0]=code, col[1]=material name, last col with a parseable number=actual
    const code = cols[0] || "";
    const name = cols[1] || "";
    // Find the actual quantity: look from the end for the first valid number
    let actual = 0;
    for (let j = cols.length - 1; j >= 0; j--) {
      const n = Number(cols[j]);
      if (!isNaN(n) && cols[j].trim() !== "") { actual = n; break; }
    }
    if (code || name) results.push({ code, name, actual });
  }
  return results;
}

export default function AuditsPage() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const _userName = profile?.full_name || "مستخدم";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlAuditId = searchParams.get("auditId") || "";
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedAudit, setSelectedAudit] = useState<AuditRecord | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AuditRecord | null>(null);
  const [deleteLinkedCollection, setDeleteLinkedCollection] = useState<any>(null);
  const [checkingLinkedCollection, setCheckingLinkedCollection] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedAuditor, setSelectedAuditor] = useState("");
  const [auditDate, setAuditDate] = useState("");
  const [auditNotes, setAuditNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>([]);
  const [step, setStep] = useState<"form" | "compare">("form");
  const [saving, setSaving] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AuditRecord | null>(null);
  const [editRows, setEditRows] = useState<ComparisonRow[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const { data: rawAudits = [], isLoading } = useQuery<AuditRecord[]>({ queryKey: ["/api/audits"], queryFn: () => api.get<AuditRecord[]>("/audits") });
  const { data: clients = [] } = useQuery<{ id: string; name: string; city: string }[]>({ queryKey: ["/api/clients"], queryFn: () => api.get("/clients") });
  const { data: founders = [] } = useQuery<{ id: string; name: string; alias: string }[]>({ queryKey: ["/api/founders"], queryFn: () => api.get("/founders") });
  const { data: rawLots = [] } = useQuery<InventoryLot[]>({ queryKey: ["/api/client-inventory"], queryFn: () => api.get<InventoryLot[]>("/client-inventory") });
  const { data: collections = [] } = useQuery<any[]>({ queryKey: ["/api/collections"], queryFn: () => api.get<any[]>("/collections") });

  const auditIdsWithCollection = useMemo(() => {
    const ids = new Set<string>();
    (collections || []).forEach((c: any) => {
      try {
        const notes = typeof c.notes === "string" ? JSON.parse(c.notes) : c.notes;
        if (notes?.auditId) ids.add(notes.auditId);
      } catch {}
    });
    return ids;
  }, [collections]);

  const audits: AuditRecord[] = rawAudits.map(a => ({
    ...a,
    comparison: Array.isArray(a.comparison) ? a.comparison : [],
  }));

  const lots: InventoryLot[] = rawLots.map(l => ({
    ...l,
    remaining: Number(l.remaining),
    sellingPrice: Number(l.sellingPrice),
    storeCost: Number(l.storeCost),
  }));

  useEffect(() => {
    if (urlAuditId && !autoOpened && audits.length > 0) {
      const target = audits.find(a => a.id === urlAuditId);
      if (target) { setSelectedAudit(target); setAutoOpened(true); }
    }
  }, [urlAuditId, audits, autoOpened]);

  // Build code→imageUrl lookup from all inventory lots (already enriched by server)
  const imageByCode = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const lot of lots) {
      if (lot.imageUrl && lot.code) map[lot.code] = lot.imageUrl;
    }
    return map;
  }, [lots]);

  const handleDeleteClick = async (audit: AuditRecord) => {
    setCheckingLinkedCollection(true);
    setDeleteTarget(audit);
    try {
      const linked = await api.get(`/audits/${audit.id}/linked-collection`);
      setDeleteLinkedCollection(linked || null);
    } catch {
      setDeleteLinkedCollection(null);
    }
    setCheckingLinkedCollection(false);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/audits/${id}`),
    onSuccess: async (_, id) => {
      const target = audits.find(a => a.id === id);
      if (target) {
        await logAudit({ entity: "audits", entityId: id, entityName: `${target.id} — ${target.clientName}`, action: "delete", snapshot: target, endpoint: "/api/audits", idField: "id", performedBy: _userName });
      }
      qc.invalidateQueries({ queryKey: ["/api/audits"] });
      qc.invalidateQueries({ queryKey: ["/api/collections"] });
      qc.invalidateQueries({ queryKey: ["/api/client-inventory"] });
      setDeleteTarget(null);
      setDeleteLinkedCollection(null);
      toast.success("تم حذف الجرد وتم إرجاع المخزون");
    },
    onError: () => toast.error("فشل الحذف"),
  });

  const clientInventory = useMemo(() => {
    if (!selectedClientId) return [];
    return lots.filter(l => l.clientId === selectedClientId && l.status !== "Returned" && Number(l.remaining) > 0);
  }, [selectedClientId, lots]);

  const filtered = audits.filter((a) => {
    const matchSearch = !search || a.clientName.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase()) || a.auditor.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || a.status === filters.status;
    const matchClient = !filters.client || filters.client === "all" || a.clientName === filters.client;
    return matchSearch && matchStatus && matchClient;
  });

  const completedCount = audits.filter(a => a.status === "Completed").length;
  const discrepancyCount = audits.filter(a => a.status === "Discrepancy").length;
  const scheduledCount = audits.filter(a => a.status === "Scheduled" || a.status === "In Progress").length;
  const auditClientNames = [...new Set(audits.map(a => a.clientName))];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { const text = ev.target?.result as string; buildComparison(parseCsvText(text)); };
    reader.readAsText(file);
    e.target.value = "";
  };

  const normalize = (s: string) => s.toLowerCase().replace(/[-_\s]/g, "");

  const buildComparison = (uploadedData: { code: string; name: string; actual: number }[]) => {
    // ── Step 1: merge uploaded CSV rows by code (sum actuals for duplicate codes) ──
    const uploadedMerged = new Map<string, { name: string; actual: number }>();
    for (const u of uploadedData) {
      const key = normalize(u.code || u.name);
      if (uploadedMerged.has(key)) {
        uploadedMerged.get(key)!.actual += u.actual;
      } else {
        uploadedMerged.set(key, { name: u.name, actual: u.actual });
      }
    }

    // ── Step 2: merge clientInventory lots by code (sum remaining) ──
    // Keep lots sorted oldest-first for FIFO tracking
    type MergedInv = { material: string; unit: string; expected: number; sellingPrice: number; storeCost: number; lots: InventoryLot[] };
    const invMerged = new Map<string, MergedInv>();
    for (const inv of clientInventory) {
      const key = normalize(inv.code);
      if (invMerged.has(key)) {
        invMerged.get(key)!.expected += inv.remaining;
        invMerged.get(key)!.lots.push(inv);
      } else {
        invMerged.set(key, { material: inv.material, unit: inv.unit, expected: inv.remaining, sellingPrice: inv.sellingPrice, storeCost: inv.storeCost, lots: [inv] });
      }
    }

    // ── Step 3: build one ComparisonRow per unique material code ──
    const rows: ComparisonRow[] = [];
    for (const [normCode, inv] of invMerged.entries()) {
      // Find actual: try code match first, then name match
      let actualEntry = uploadedMerged.get(normCode);
      if (!actualEntry) {
        // try name-based match
        for (const [, u] of uploadedMerged.entries()) {
          const uName = u.name.toLowerCase();
          const invName = inv.material.toLowerCase();
          if (invName.includes(uName) || uName.includes(invName)) { actualEntry = u; break; }
        }
      }
      const actual = actualEntry ? actualEntry.actual : inv.expected;
      const diff = actual - inv.expected;
      const result: ComparisonRow["result"] = diff === 0 ? "matched" : diff < 0 ? "shortage" : "surplus";
      // Use original code (not normalized) from first lot
      rows.push({ material: inv.material, code: inv.lots[0].code, unit: inv.unit, expected: inv.expected, actual, diff, result, sellingPrice: inv.sellingPrice, storeCost: inv.storeCost, imageUrl: inv.lots[0].imageUrl || "" });
    }

    setComparisonRows(rows);
    setStep("compare");
  };

  const handleManualActual = (idx: number, value: number) => {
    setComparisonRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const diff = value - r.expected;
      return { ...r, actual: value, diff, result: diff === 0 ? "matched" : diff < 0 ? "shortage" : "surplus" };
    }));
  };

  const handleSaveAudit = async () => {
    if (!selectedClientId || !selectedAuditor) { toast.error(t.selectClientAndAuditor); return; }
    const client = clients.find(c => c.id === selectedClientId);
    const auditor = founders.find(f => f.id === selectedAuditor);
    if (!client) return;
    const today = auditDate || new Date().toISOString().split("T")[0];
    const matchedCount = comparisonRows.filter(r => r.result === "matched").length;
    const shortageCount = comparisonRows.filter(r => r.result === "shortage").length;
    const surplusCount = comparisonRows.filter(r => r.result === "surplus").length;
    const status = shortageCount > 0 || surplusCount > 0 ? "Discrepancy" : "Completed";

    setSaving(true);
    try {
      const { nextId } = await api.get<{ nextId: string }>("/audits/next-id");
      const newAudit = {
        id: nextId || `AUD-${String(audits.length + 1).padStart(3, "0")}`,
        clientId: client.id,
        clientName: client.name,
        date: today,
        auditor: auditor?.name || selectedAuditor,
        totalItems: comparisonRows.length,
        matched: matchedCount,
        shortage: shortageCount,
        surplus: surplusCount,
        notes: auditNotes,
        status,
        comparison: comparisonRows,
      };
      await api.post("/audits", newAudit);

      // 1. Update client inventory using FIFO: distribute actual qty across lots oldest-first
      //    Shortage → "Needs Refill"; Surplus/Matched → "In Stock"
      const clientLots = (rawLots as any[])
        .filter(l => l.clientId === selectedClientId || l.client_id === selectedClientId)
        .sort((a, b) => new Date(a.createdAt || a.created_at || 0).getTime() - new Date(b.createdAt || b.created_at || 0).getTime());

      const nonMatchedRows = comparisonRows.filter(r => r.result !== "matched");
      if (nonMatchedRows.length > 0 && clientLots.length > 0) {
        await Promise.allSettled(nonMatchedRows.map(async (r) => {
          // Find all lots for this material code (may be >1 from different orders)
          const materialLots = clientLots.filter(l => normalize(l.code || "") === normalize(r.code));
          if (materialLots.length === 0) return;

          if (materialLots.length === 1) {
            // Simple single-lot update
            const patch: Record<string, unknown> = { remaining: r.actual };
            patch.status = r.result === "shortage" ? "Needs Refill" : "In Stock";
            patch.shortageQty = r.result === "shortage" ? Math.abs(r.diff) : 0;
            await api.patch(`/client-inventory/${materialLots[0].id}`, patch);
          } else {
            // FIFO: fill oldest lots first, newest lot absorbs remainder
            let remaining = r.actual;
            await Promise.allSettled(materialLots.map(async (lot, idx) => {
              const lotExpected = Number(lot.remaining ?? 0);
              let lotActual: number;
              if (idx < materialLots.length - 1) {
                // Fill this lot first (up to its original remaining), then carry over
                lotActual = Math.min(remaining, lotExpected);
                remaining = Math.max(0, remaining - lotExpected);
              } else {
                // Last (newest) lot gets whatever is left
                lotActual = remaining;
              }
              const patch: Record<string, unknown> = { remaining: lotActual };
              if (lotActual < lotExpected) {
                patch.status = "Needs Refill";
                patch.shortageQty = lotExpected - lotActual;
              } else {
                patch.status = "In Stock";
                patch.shortageQty = 0;
              }
              await api.patch(`/client-inventory/${lot.id}`, patch);
            }));
          }
        }));
        qc.invalidateQueries({ queryKey: ["/api/client-inventory"] });
      }

      // 2. Refill planning reads client_inventory; "Needs Refill" items will surface automatically.

      qc.invalidateQueries({ queryKey: ["/api/audits"] });
      resetDialog();

      const shortagesCount = comparisonRows.filter(r => r.result === "shortage").length;
      if (shortagesCount > 0) {
        toast.success(`${t.auditScheduled} — تم تحديث المخزون (${nonMatchedRows.length} مادة). تحقق من خطة إعادة التوريد.`);
      } else {
        toast.success(t.auditScheduled);
      }
      setSelectedAudit({ ...newAudit, createdAt: new Date().toISOString() });
    } catch {
      toast.error("فشل حفظ الجرد");
    } finally {
      setSaving(false);
    }
  };

  const resetDialog = () => {
    setSelectedClientId(""); setSelectedAuditor(""); setAuditDate(""); setAuditNotes("");
    setComparisonRows([]); setStep("form"); setDialogOpen(false);
  };

  const handleCreateCollection = async (audit: AuditRecord) => {
    if (auditIdsWithCollection.has(audit.id)) { toast.error("تم إنشاء تحصيل لهذا الجرد بالفعل"); return; }
    const shortages = audit.comparison.filter(r => r.result === "shortage");
    if (shortages.length === 0) { toast.info("لا توجد نواقص في هذا الجرد لإنشاء تحصيل"); return; }
    setCreatingCollection(audit.id);
    try {
      const extData = await api.get<{ products: any[] }>("/external-materials").catch(() => ({ products: [] }));
      const imgMap: Record<string, string> = {};
      (extData?.products || []).forEach((p: any) => { if (p.sku) imgMap[p.sku] = p.image_url || ""; });

      const clientInvData = await api.get<any[]>(`/client-inventory?clientId=${audit.clientId}`).catch(() => []);

      // Map materialCode → sourceOrder from actual client inventory (only relevant entries)
      const codeToSourceOrder: Record<string, string> = {};
      (clientInvData || []).forEach((i: any) => {
        const code = i.materialCode || i.material_code || i.code || "";
        const srcOrd = i.sourceOrder || i.source_order || "";
        if (code && srcOrd && !codeToSourceOrder[code]) codeToSourceOrder[code] = srcOrd;
      });

      // Only include orders that actually have shortage items (not all client orders)
      const relevantOrderIds = [...new Set(shortages.map(r => codeToSourceOrder[r.code]).filter(Boolean))];

      // Fetch companyProfitPercentage snapshot per relevant order
      const orderPctMap: Record<string, number> = {};
      const orderDeliveryInfoMap: Record<string, { deliveryFee: number; deliveryFeeBearer: string; deliveryFeePaidByFounder: string }> = {};
      await Promise.all(relevantOrderIds.map(async ordId => {
        try {
          const o = await api.get<any>(`/orders/${ordId}`);
          let contribs: any[] = [];
          const raw = o?.founderContributions ?? o?.founder_contributions;
          if (Array.isArray(raw)) contribs = raw;
          else if (typeof raw === "string") { try { contribs = JSON.parse(raw); } catch { contribs = []; } }
          const snapped = (contribs[0] as any)?.companyProfitPercentage;
          orderPctMap[ordId] = snapped ?? o?.companyProfitPercentage ?? o?.company_profit_percentage ?? 40;
          orderDeliveryInfoMap[ordId] = {
            deliveryFee: Number(o?.deliveryFee ?? o?.delivery_fee ?? 0),
            deliveryFeeBearer: o?.deliveryFeeBearer ?? o?.delivery_fee_bearer ?? "client",
            deliveryFeePaidByFounder: o?.deliveryFeePaidByFounder ?? o?.delivery_fee_paid_by_founder ?? "",
          };
        } catch { orderPctMap[ordId] = 40; }
      }));

      const lineItems = shortages.map(r => {
        const srcOrd = codeToSourceOrder[r.code] || "";
        const companyProfitPct = orderPctMap[srcOrd] ?? 40;
        const delInfo = orderDeliveryInfoMap[srcOrd];
        return {
          code: r.code, material: r.material,
          imageUrl: imgMap[r.code] || "",
          unit: r.unit, quantity: Math.abs(r.diff),
          sellingPrice: r.sellingPrice,
          costPrice: r.storeCost || 0,
          lineTotal: Math.abs(r.diff) * r.sellingPrice,
          sourceOrderId: srcOrd,
          companyProfitPct,
          deliveryFeePaidByFounder: delInfo?.deliveryFeePaidByFounder || "",
        };
      });

      // sourceOrders = only orders that appear in shortages
      const sourceOrders = [...new Set(lineItems.map(l => l.sourceOrderId).filter(Boolean))];
      const primarySourceOrder = sourceOrders[0] || "";
      const total = lineItems.reduce((s, l) => s + l.lineTotal, 0);
      const today = new Date().toISOString().split("T")[0];

      const notesPayload = JSON.stringify({
        auditId: audit.id,
        auditDate: audit.date,
        sourceOrders,
        lineItems,
      });
      const saved = await api.post<any>("/collections", {
        clientId: audit.clientId,
        orderId: primarySourceOrder || null,
        totalAmount: total,
        paidAmount: 0,
        outstanding: total,
        invoiceDate: today,
        dueDate: today,
        status: "Awaiting Confirmation",
        notes: notesPayload,
      });
      await logAudit({ entity: "collection", entityId: saved.id, entityName: `${saved.id} - ${audit.clientName}`, action: "create", snapshot: { ...saved, auditId: audit.id }, endpoint: "/collections", performedBy: _userName });

      await api.patch(`/audits/${audit.id}`, { status: "تم التحصيل" }).catch(() => {});
      await logAudit({ entity: "audits", entityId: audit.id, entityName: `${audit.id} — ${audit.clientName}`, action: "update", snapshot: { ...audit, status: "تم التحصيل", collectionId: saved.id }, endpoint: "/api/audits", performedBy: _userName });

      qc.invalidateQueries({ queryKey: ["/api/collections"] });
      qc.invalidateQueries({ queryKey: ["/api/audits"] });
      toast.success(`تم إنشاء التحصيل ${saved.id} — ${audit.clientName} (${total.toLocaleString()} ج.م)`);
      navigate("/collections");
    } catch (err: any) {
      toast.error(err?.message || "فشل إنشاء التحصيل");
    } finally {
      setCreatingCollection(null);
    }
  };

  const printClientInvoice = async (audit: AuditRecord) => {
    const rows = audit.comparison;
    const shortages = rows.filter(r => r.result === "shortage");
    if (shortages.length === 0) { toast.info(t.noResults); return; }
    const loadingToast = toast.loading("جارٍ تحميل صور المواد...");

    // Fetch external material images and convert to base64 for reliable printing
    const extData = await api.get<{ products: any[] }>("/external-materials").catch(() => ({ products: [] }));
    const imgUrlMap: Record<string, string> = {};
    (extData?.products || []).forEach((p: any) => { if (p.sku && p.image_url) imgUrlMap[p.sku] = p.image_url; });

    const toBase64 = async (url: string): Promise<string> => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
      } catch { return ''; }
    };

    const b64Map: Record<string, string> = {};
    await Promise.all(shortages.map(async (r) => {
      if (imgUrlMap[r.code]) b64Map[r.code] = await toBase64(imgUrlMap[r.code]);
    }));

    toast.dismiss(loadingToast);
    printInvoice({
      title: "فاتورة مواد جديدة للعميل", companyName: "DSB", subtitle: `جرد ${audit.id} — مواد مطلوب توصيلها`,
      clientName: audit.clientName, invoiceNumber: `INV-${audit.id}`, date: audit.date,
      columns: ["الصورة", t.material, t.codeCol, t.unit, t.qtyRequired, `${t.priceColon} (${t.currency})`, `${t.total} (${t.currency})`],
      rows: shortages.map(r => [
        b64Map[r.code]
          ? `<img src="${b64Map[r.code]}" class="item-img" alt="${r.material}" />`
          : `<div style="width:42px;height:42px;background:#f1f5f9;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:18px;">📦</div>`,
        r.material, r.code, r.unit, Math.abs(r.diff), r.sellingPrice,
        (Math.abs(r.diff) * r.sellingPrice).toLocaleString(),
      ]),
      totals: [
        { label: t.totalShortageItems, value: String(shortages.length) },
        { label: t.totalCostForClient, value: `${shortages.reduce((s, r) => s + Math.abs(r.diff) * r.sellingPrice, 0).toLocaleString()} ${t.currency}` },
      ],
      footer: `${t.auditor}: ${audit.auditor} — ${audit.date}`,
    });
  };

  const exportPurchaseSheet = (audit: AuditRecord) => {
    const shortages = audit.comparison.filter(r => r.result === "shortage");
    if (shortages.length === 0) { toast.info(t.noResults); return; }
    exportToCsv(`purchase_list_${audit.id}`,
      [t.material, t.codeCol, t.unit, t.qtyRequired, `${t.storeCostColon} (${t.currency})`, `${t.total} (${t.currency})`, t.client],
      shortages.map(r => [r.material, r.code, r.unit, Math.abs(r.diff), r.storeCost, (Math.abs(r.diff) * r.storeCost).toLocaleString(), audit.clientName])
    );
    toast.success(t.purchaseListExported);
  };

  const resultLabel = (r: string) => r === "matched" ? t.matched : r === "shortage" ? t.shortage : t.surplus;
  const statusLabel = (s: string) => ({ "Completed": t.completed, "Discrepancy": t.discrepancy, "Scheduled": t.scheduled, "In Progress": t.inProgress, "تم التحصيل": "تم التحصيل" }[s] || s);

  const handleEditClick = (audit: AuditRecord) => {
    setEditTarget(audit);
    setEditRows((audit.comparison || []).map(r => ({ ...r })));
    setEditDialogOpen(true);
  };

  const handleEditActual = (idx: number, value: number) => {
    setEditRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const diff = value - r.expected;
      return { ...r, actual: value, diff, result: diff === 0 ? "matched" : diff < 0 ? "shortage" : "surplus" };
    }));
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const matchedCount = editRows.filter(r => r.result === "matched").length;
      const shortageCount = editRows.filter(r => r.result === "shortage").length;
      const surplusCount = editRows.filter(r => r.result === "surplus").length;
      const status = shortageCount > 0 || surplusCount > 0 ? "Discrepancy" : "Completed";

      await api.patch(`/audits/${editTarget.id}`, {
        comparison: editRows,
        matched: matchedCount,
        shortage: shortageCount,
        surplus: surplusCount,
        totalItems: editRows.length,
        status,
      });

      const clientLots = (rawLots as any[])
        .filter(l => l.clientId === editTarget.clientId || l.client_id === editTarget.clientId)
        .sort((a, b) => new Date(a.createdAt || a.created_at || 0).getTime() - new Date(b.createdAt || b.created_at || 0).getTime());

      let inventoryFailed = false;
      if (clientLots.length > 0) {
        const results = await Promise.allSettled(editRows.map(async (r) => {
          const materialLots = clientLots.filter(l => normalize(l.code || "") === normalize(r.code));
          if (materialLots.length === 0) return;

          if (materialLots.length === 1) {
            const patch: Record<string, unknown> = { remaining: r.actual };
            patch.status = r.result === "shortage" ? "Needs Refill" : "In Stock";
            patch.shortageQty = r.result === "shortage" ? Math.abs(r.diff) : 0;
            await api.patch(`/client-inventory/${materialLots[0].id}`, patch);
          } else {
            let remaining = r.actual;
            const lotResults = await Promise.allSettled(materialLots.map(async (lot, idx) => {
              const lotExpected = Number(lot.remaining ?? 0);
              let lotActual: number;
              if (idx < materialLots.length - 1) {
                lotActual = Math.min(remaining, lotExpected);
                remaining = Math.max(0, remaining - lotExpected);
              } else {
                lotActual = remaining;
              }
              const patch: Record<string, unknown> = { remaining: lotActual };
              if (lotActual < lotExpected) {
                patch.status = "Needs Refill";
                patch.shortageQty = lotExpected - lotActual;
              } else {
                patch.status = "In Stock";
                patch.shortageQty = 0;
              }
              await api.patch(`/client-inventory/${lot.id}`, patch);
            }));
            if (lotResults.some(r => r.status === "rejected")) inventoryFailed = true;
          }
        }));
        if (results.some(r => r.status === "rejected")) inventoryFailed = true;
        qc.invalidateQueries({ queryKey: ["/api/client-inventory"] });
      }

      await logAudit({ entity: "audits", entityId: editTarget.id, entityName: `${editTarget.id} — ${editTarget.clientName}`, action: "update", snapshot: { ...editTarget, comparison: editRows, matched: matchedCount, shortage: shortageCount, surplus: surplusCount, status }, endpoint: "/api/audits", idField: "id", performedBy: _userName });

      qc.invalidateQueries({ queryKey: ["/api/audits"] });
      setEditDialogOpen(false);
      setEditTarget(null);
      setEditRows([]);
      if (selectedAudit?.id === editTarget.id) {
        setSelectedAudit({ ...editTarget, comparison: editRows, matched: matchedCount, shortage: shortageCount, surplus: surplusCount, status });
      }
      if (inventoryFailed) {
        toast.warning("تم تحديث الجرد لكن بعض تحديثات المخزون فشلت — يرجى مراجعة مخزون العميل");
      } else {
        toast.success("تم تحديث الجرد بنجاح");
      }
    } catch {
      toast.error("فشل تحديث الجرد");
    } finally {
      setEditSaving(false);
    }
  };

  const initManualEntry = () => {
    if (clientInventory.length === 0) { toast.error(t.noInventoryForClient); return; }
    // Merge lots with the same code — show one row per unique material
    const merged = new Map<string, { material: string; unit: string; expected: number; sellingPrice: number; storeCost: number; code: string; imageUrl: string }>();
    for (const inv of clientInventory) {
      const key = normalize(inv.code);
      if (merged.has(key)) {
        merged.get(key)!.expected += inv.remaining;
      } else {
        merged.set(key, { material: inv.material, code: inv.code, unit: inv.unit, expected: inv.remaining, sellingPrice: inv.sellingPrice, storeCost: inv.storeCost, imageUrl: imageByCode[inv.code] || inv.imageUrl || "" });
      }
    }
    setComparisonRows(Array.from(merged.values()).map(inv => ({
      material: inv.material, code: inv.code, unit: inv.unit,
      expected: inv.expected, actual: inv.expected, diff: 0,
      result: "matched" as const, sellingPrice: inv.sellingPrice, storeCost: inv.storeCost,
      imageUrl: inv.imageUrl,
    })));
    setStep("compare");
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.auditsTitle}</h1>
        <p className="page-description">{t.auditsDesc}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="cursor-pointer" onClick={() => setFilters({ ...filters, status: "Completed" })}>
          <StatCard title={t.completedAudits} value={completedCount} change={t.thisQuarter} changeType="neutral" icon={CheckCircle2} />
        </div>
        <div className="cursor-pointer" onClick={() => setFilters({ ...filters, status: "Discrepancy" })}>
          <StatCard title={t.discrepancies} value={discrepancyCount} change={audits.length > 0 ? `${((discrepancyCount / audits.length) * 100).toFixed(0)}% ${t.ofAudits}` : "0%"} changeType="negative" icon={AlertTriangle} />
        </div>
        <div className="cursor-pointer" onClick={() => setFilters({ ...filters, status: "Scheduled" })}>
          <StatCard title={t.scheduledInProgress} value={scheduledCount} change={t.upcoming} changeType="neutral" icon={ClipboardCheck} />
        </div>
      </div>

      <DataToolbar
        searchPlaceholder={t.searchAudits}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: t.status, value: "status", options: [{ label: t.completed, value: "Completed" }, { label: t.discrepancy, value: "Discrepancy" }, { label: "تم التحصيل", value: "تم التحصيل" }, { label: t.scheduled, value: "Scheduled" }, { label: t.inProgress, value: "In Progress" }] },
          { label: t.client, value: "client", options: auditClientNames.map(c => ({ label: c, value: c })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("audits", [t.code, t.client, t.date, t.auditor, t.itemsCol, t.matched, t.shortage, t.surplus, t.status, t.notes], filtered.map(a => [a.id, a.clientName, a.date, a.auditor, a.totalItems, a.matched, a.shortage, a.surplus, a.status, a.notes]))}
        actions={<Button size="sm" className="h-9" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.newAudit}</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.code}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.date}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.auditor}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.itemsCol}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.matched}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.shortage}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.surplus}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((audit) => (
              <tr key={audit.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedAudit(audit)}>
                <td className="py-3 px-3 font-mono text-xs font-medium">{audit.id}</td>
                <td className="py-3 px-3 font-medium hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${audit.clientId}`); }}>{audit.clientName}</td>
                <td className="py-3 px-3 text-muted-foreground">{audit.date}</td>
                <td className="py-3 px-3">{audit.auditor}</td>
                <td className="py-3 px-3 text-end">{audit.totalItems}</td>
                <td className="py-3 px-3 text-end text-success font-medium">{audit.matched}</td>
                <td className="py-3 px-3 text-end">{audit.shortage > 0 ? <span className="text-destructive font-medium">{audit.shortage}</span> : "—"}</td>
                <td className="py-3 px-3 text-end">{audit.surplus > 0 ? <span className="text-warning font-medium">{audit.surplus}</span> : "—"}</td>
                <td className="py-3 px-3"><StatusBadge status={statusLabel(audit.status)} /></td>
                <td className="py-3 px-3 text-end" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedAudit(audit)}><Eye className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.viewDetails}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditClick(audit)}><Pencil className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.edit}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => printClientInvoice(audit)}><Printer className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.clientInvoice}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportPurchaseSheet(audit)}><FileSpreadsheet className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.purchaseListLabel}</DropdownMenuItem>
                      {audit.shortage > 0 && (
                        <DropdownMenuItem
                          onClick={() => handleCreateCollection(audit)}
                          disabled={creatingCollection === audit.id || auditIdsWithCollection.has(audit.id)}
                        >
                          <Receipt className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2 text-primary" />
                          {auditIdsWithCollection.has(audit.id) ? "تم إنشاء التحصيل ✓" : creatingCollection === audit.id ? "جارٍ الإنشاء..." : "إنشاء تحصيل"}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(audit)}><Trash2 className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />حذف</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length === 0 && <tfoot><tr><td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">{t.noResults}</td></tr></tfoot>}
        </table>
      </div>

      {/* Audit Detail Dialog */}
      <Dialog open={!!selectedAudit} onOpenChange={() => setSelectedAudit(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>{selectedAudit?.id} — {selectedAudit?.clientName}</DialogTitle></DialogHeader>
          {selectedAudit && (
            <ScrollArea className="max-h-[75vh]">
              <div className="space-y-4 pe-2">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div><span className="text-muted-foreground">{t.date}:</span> <span className="font-medium">{selectedAudit.date}</span></div>
                  <div><span className="text-muted-foreground">{t.auditor}:</span> <span className="font-medium">{selectedAudit.auditor}</span></div>
                  <div className="cursor-pointer" onClick={() => { setSelectedAudit(null); navigate(`/clients/${selectedAudit.clientId}`); }}>
                    <span className="text-muted-foreground">{t.client}:</span> <span className="font-medium text-primary">{selectedAudit.clientName}</span>
                  </div>
                  <StatusBadge status={statusLabel(selectedAudit.status)} />
                </div>
                {selectedAudit.notes && (
                  <div className="p-3 rounded-lg bg-warning/10 text-warning text-sm flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{selectedAudit.notes}
                  </div>
                )}
                {(() => {
                  const details = selectedAudit.comparison;
                  const shortages = details.filter(r => r.result === "shortage");
                  const shortageTotal = shortages.reduce((s, r) => s + Math.abs(r.diff) * r.sellingPrice, 0);
                  const purchaseTotal = shortages.reduce((s, r) => s + Math.abs(r.diff) * r.storeCost, 0);
                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xs text-muted-foreground">{t.matched}</p><p className="text-lg font-bold text-success">{details.filter(r => r.result === "matched").length}</p></div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xs text-muted-foreground">{t.shortage}</p><p className="text-lg font-bold text-destructive">{shortages.length}</p></div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xs text-muted-foreground">{t.surplus}</p><p className="text-lg font-bold text-warning">{details.filter(r => r.result === "surplus").length}</p></div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xs text-muted-foreground">{t.totalShortageCost}</p><p className="text-lg font-bold">{shortageTotal.toLocaleString()} <span className="text-xs font-normal">{t.currency}</span></p></div>
                      </div>
                      {details.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="py-2 px-3 w-14"></th>
                                <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>
                                <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.codeCol}</th>
                                <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.expected}</th>
                                <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.actual}</th>
                                <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.differenceCol}</th>
                                <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.result}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {details.map((d, i) => (
                                <tr key={i} className={`border-b border-border/50 ${d.result === "shortage" ? "bg-destructive/5" : d.result === "surplus" ? "bg-warning/5" : ""}`}>
                                  <td className="py-2 px-3">
                                    {(d.imageUrl || imageByCode[d.code]) ? (
                                      <img src={d.imageUrl || imageByCode[d.code]} alt={d.material} className="h-12 w-12 rounded-lg object-cover border border-border shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    ) : (
                                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center border border-border"><Package className="h-5 w-5 text-muted-foreground" /></div>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 font-medium">{d.material}</td>
                                  <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{d.code}</td>
                                  <td className="py-2 px-3 text-end">{d.expected}</td>
                                  <td className="py-2 px-3 text-end font-medium">{d.actual}</td>
                                  <td className="py-2 px-3 text-end font-medium">{d.diff === 0 ? "—" : <span className={d.diff < 0 ? "text-destructive" : "text-warning"}>{d.diff > 0 ? "+" : ""}{d.diff}</span>}</td>
                                  <td className="py-2 px-3">
                                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${d.result === "matched" ? "text-success" : d.result === "shortage" ? "text-destructive" : "text-warning"}`}>
                                      {d.result === "matched" ? <CheckCircle2 className="h-3 w-3" /> : d.result === "shortage" ? <XCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                      {resultLabel(d.result)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button variant="default" size="sm" onClick={() => printClientInvoice(selectedAudit)}>
                          <Printer className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.printClientInvoice}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportPurchaseSheet(selectedAudit)}>
                          <FileSpreadsheet className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.exportPurchaseListBtn}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          printInvoice({
                            title: t.exportInvoice, companyName: "DSB", subtitle: t.auditsTitle,
                            clientName: selectedAudit.clientName, invoiceNumber: selectedAudit.id, date: selectedAudit.date,
                            columns: [t.material, t.codeCol, t.expected, t.actual, t.differenceCol, t.result],
                            rows: details.map(d => [d.material, d.code, d.expected, d.actual, d.diff, resultLabel(d.result)]),
                            totals: [
                              { label: t.matched, value: String(details.filter(d => d.result === "matched").length) },
                              { label: t.shortage, value: String(shortages.length) },
                              { label: t.shortagesCostForClient, value: `${shortageTotal.toLocaleString()} ${t.currency}` },
                              { label: t.purchaseCost, value: `${purchaseTotal.toLocaleString()} ${t.currency}` },
                            ],
                            footer: `${t.auditor}: ${selectedAudit.auditor} — ${selectedAudit.date}`,
                          });
                        }}>
                          <FileText className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.printAuditReport}
                        </Button>
                        {shortages.length > 0 && (
                          <Button
                            size="sm"
                            className={auditIdsWithCollection.has(selectedAudit.id) ? "bg-green-600 text-white hover:bg-green-700" : "bg-primary text-primary-foreground hover:bg-primary/90"}
                            disabled={creatingCollection === selectedAudit.id || auditIdsWithCollection.has(selectedAudit.id)}
                            onClick={() => handleCreateCollection(selectedAudit)}
                          >
                            {auditIdsWithCollection.has(selectedAudit.id)
                              ? <><CheckCircle2 className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />تم إنشاء التحصيل ✓</>
                              : creatingCollection === selectedAudit.id
                              ? <><Loader2 className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5 animate-spin" />جارٍ الإنشاء...</>
                              : <><Receipt className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />إنشاء تحصيل ({shortageTotal.toLocaleString()} ج.م)</>}
                          </Button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* New Audit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{step === "form" ? t.scheduleAudit : t.reviewComparison}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh]">
            <div className="space-y-4 pe-2">
              {step === "form" ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">{t.selectClient}</Label>
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={t.selectClientPlaceholder} /></SelectTrigger>
                        <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.city}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{t.selectAuditor}</Label>
                      <Select value={selectedAuditor} onValueChange={setSelectedAuditor}>
                        <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={t.selectAuditorPlaceholder} /></SelectTrigger>
                        <SelectContent>{founders.map(f => <SelectItem key={f.id} value={f.id}>{f.name} — {f.alias}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">{t.date}</Label><Input className="h-9 mt-1" type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} /></div>
                    <div><Label className="text-xs">{t.notes}</Label><Input className="h-9 mt-1" value={auditNotes} onChange={(e) => setAuditNotes(e.target.value)} /></div>
                  </div>
                  {selectedClientId && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-2"><Package className="h-4 w-4 text-primary" />{t.currentClientInventory} ({clientInventory.length} {t.itemCount})</h4>
                      {clientInventory.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">{t.noInventoryForClient}</p>
                      ) : (
                        <div className="overflow-x-auto border border-border rounded-lg">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border bg-muted/30">
                                <th className="py-2 px-2.5 w-14"></th>
                                <th className="text-start py-2 px-2.5 font-medium">{t.material}</th>
                                <th className="text-start py-2 px-2.5 font-medium">{t.codeCol}</th>
                                <th className="text-start py-2 px-2.5 font-medium">الطلب</th>
                                <th className="text-end py-2 px-2.5 font-medium">{t.remaining}</th>
                                <th className="text-start py-2 px-2.5 font-medium">{t.unit}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clientInventory.map(inv => (
                                <tr key={inv.id} className="border-b border-border/50">
                                  <td className="py-1.5 px-2.5">
                                    {inv.imageUrl ? (
                                      <img src={inv.imageUrl} alt={inv.material} className="h-12 w-12 rounded-xl object-contain bg-white border border-border shadow-sm p-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    ) : (
                                      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center border border-border"><Package className="h-5 w-5 text-muted-foreground" /></div>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-2.5 font-medium">{inv.material}</td>
                                  <td className="py-1.5 px-2.5 font-mono text-muted-foreground">{inv.code}</td>
                                  <td className="py-1.5 px-2.5">
                                    {inv.sourceOrder ? (
                                      <button className="font-mono text-[11px] text-primary hover:text-primary/80 hover:underline bg-primary/5 px-1.5 py-0.5 rounded" onClick={() => navigate(`/orders/${inv.sourceOrder}`)}>{inv.sourceOrder}</button>
                                    ) : <span className="text-muted-foreground">—</span>}
                                  </td>
                                  <td className="py-1.5 px-2.5 text-end font-medium">{inv.remaining}</td>
                                  <td className="py-1.5 px-2.5 text-muted-foreground">{inv.unit}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedClientId && clientInventory.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">{t.uploadAuditFileTitle}</h4>
                      <p className="text-xs text-muted-foreground">{t.uploadAuditFileDesc}</p>
                      <div className="flex gap-2">
                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.txt" onChange={handleFileUpload} />
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.uploadCsv}</Button>
                        <Button variant="outline" size="sm" onClick={initManualEntry}><ClipboardCheck className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.manualEntryBtn}</Button>
                        <Button variant="outline" size="sm" onClick={() => { exportToCsv(`audit_template_${selectedClientId}`, [t.codeCol, t.material, t.actual], clientInventory.map(inv => [inv.code, inv.material, ""])); toast.success(t.templateExported); }}>
                          <Download className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.downloadTemplate}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-success/10"><p className="text-xs text-muted-foreground">{t.matched}</p><p className="text-xl font-bold text-success">{comparisonRows.filter(r => r.result === "matched").length}</p></div>
                    <div className="p-3 rounded-lg bg-destructive/10"><p className="text-xs text-muted-foreground">{t.shortage}</p><p className="text-xl font-bold text-destructive">{comparisonRows.filter(r => r.result === "shortage").length}</p></div>
                    <div className="p-3 rounded-lg bg-warning/10"><p className="text-xs text-muted-foreground">{t.surplus}</p><p className="text-xl font-bold text-warning">{comparisonRows.filter(r => r.result === "surplus").length}</p></div>
                  </div>
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="py-2 px-3 w-14"></th>
                          <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>
                          <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.expected}</th>
                          <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.actual}</th>
                          <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.differenceCol}</th>
                          <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.result}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonRows.map((r, i) => (
                          <tr key={i} className={`border-b border-border/50 ${r.result === "shortage" ? "bg-destructive/5" : r.result === "surplus" ? "bg-warning/5" : ""}`}>
                            <td className="py-2 px-3">
                              {r.imageUrl ? (
                                <img src={r.imageUrl} alt={r.material} className="h-12 w-12 rounded-lg object-cover border border-border shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center border border-border"><Package className="h-5 w-5 text-muted-foreground" /></div>
                              )}
                            </td>
                            <td className="py-2 px-3 font-medium">{r.material} <span className="text-xs text-muted-foreground">({r.unit})</span></td>
                            <td className="py-2 px-3 text-end text-muted-foreground">{r.expected}</td>
                            <td className="py-2 px-3 text-end">
                              <Input type="number" className="h-7 w-20 text-end text-sm ms-auto" value={r.actual} onChange={e => handleManualActual(i, Number(e.target.value))} />
                            </td>
                            <td className="py-2 px-3 text-end font-medium">{r.diff === 0 ? "—" : <span className={r.diff < 0 ? "text-destructive" : "text-warning"}>{r.diff > 0 ? "+" : ""}{r.diff}</span>}</td>
                            <td className="py-2 px-3">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium ${r.result === "matched" ? "text-success" : r.result === "shortage" ? "text-destructive" : "text-warning"}`}>
                                {r.result === "matched" ? <CheckCircle2 className="h-3 w-3" /> : r.result === "shortage" ? <XCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                {resultLabel(r.result)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStep("form")}>← رجوع</Button>
                    <Button size="sm" onClick={handleSaveAudit} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.saveAuditBtn}</>}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) { setEditDialogOpen(false); setEditTarget(null); setEditRows([]); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>تعديل الجرد — {editTarget?.id} — {editTarget?.clientName}</DialogTitle></DialogHeader>
          {editTarget && (
            <ScrollArea className="max-h-[75vh]">
              <div className="space-y-4 pe-2">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div><span className="text-muted-foreground">{t.date}:</span> <span className="font-medium">{editTarget.date}</span></div>
                  <div><span className="text-muted-foreground">{t.auditor}:</span> <span className="font-medium">{editTarget.auditor}</span></div>
                  <div><span className="text-muted-foreground">{t.client}:</span> <span className="font-medium">{editTarget.clientName}</span></div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-success/10"><p className="text-xs text-muted-foreground">{t.matched}</p><p className="text-xl font-bold text-success">{editRows.filter(r => r.result === "matched").length}</p></div>
                  <div className="p-3 rounded-lg bg-destructive/10"><p className="text-xs text-muted-foreground">{t.shortage}</p><p className="text-xl font-bold text-destructive">{editRows.filter(r => r.result === "shortage").length}</p></div>
                  <div className="p-3 rounded-lg bg-warning/10"><p className="text-xs text-muted-foreground">{t.surplus}</p><p className="text-xl font-bold text-warning">{editRows.filter(r => r.result === "surplus").length}</p></div>
                </div>
                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="py-2 px-3 w-14"></th>
                        <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.material}</th>
                        <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.expected}</th>
                        <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.actual}</th>
                        <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">{t.differenceCol}</th>
                        <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">{t.result}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editRows.map((r, i) => (
                        <tr key={i} className={`border-b border-border/50 ${r.result === "shortage" ? "bg-destructive/5" : r.result === "surplus" ? "bg-warning/5" : ""}`}>
                          <td className="py-2 px-3">
                            {(r.imageUrl || imageByCode[r.code]) ? (
                              <img src={r.imageUrl || imageByCode[r.code]} alt={r.material} className="h-12 w-12 rounded-lg object-cover border border-border shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center border border-border"><Package className="h-5 w-5 text-muted-foreground" /></div>
                            )}
                          </td>
                          <td className="py-2 px-3 font-medium">{r.material} <span className="text-xs text-muted-foreground">({r.unit})</span></td>
                          <td className="py-2 px-3 text-end text-muted-foreground">{r.expected}</td>
                          <td className="py-2 px-3 text-end">
                            <Input type="number" className="h-7 w-20 text-end text-sm ms-auto" value={r.actual} onChange={e => handleEditActual(i, Number(e.target.value))} />
                          </td>
                          <td className="py-2 px-3 text-end font-medium">{r.diff === 0 ? "—" : <span className={r.diff < 0 ? "text-destructive" : "text-warning"}>{r.diff > 0 ? "+" : ""}{r.diff}</span>}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${r.result === "matched" ? "text-success" : r.result === "shortage" ? "text-destructive" : "text-warning"}`}>
                              {r.result === "matched" ? <CheckCircle2 className="h-3 w-3" /> : r.result === "shortage" ? <XCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                              {resultLabel(r.result)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditDialogOpen(false); setEditTarget(null); setEditRows([]); }}>إلغاء</Button>
                  <Button size="sm" onClick={handleSaveEdit} disabled={editSaving}>
                    {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />حفظ التعديلات</>}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget && !checkingLinkedCollection}
        onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteLinkedCollection(null); } }}
        title={deleteLinkedCollection ? "تحذير: حذف الجرد سيحذف التحصيل المرتبط" : "تأكيد حذف الجرد"}
        description={
          deleteLinkedCollection
            ? `سيتم حذف الجرد "${deleteTarget?.id}" وكذلك التحصيل المرتبط به "${deleteLinkedCollection.id}" (${Number(deleteLinkedCollection.total_amount || 0).toLocaleString()} ج.م) لأنهم مبنيين على بعض. هل تريد المتابعة؟`
            : `هل أنت متأكد من حذف الجرد "${deleteTarget?.id} — ${deleteTarget?.clientName}"؟ يمكنك استعادته لاحقاً من سجل الأنشطة.`
        }
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
