import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, TrendingUp, Wallet, Pencil, Plus, Loader2, Trash2, ChevronDown, ChevronUp, ExternalLink, ShoppingBag, Clock } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { logAudit } from "@/lib/auditLog";

type Founder = {
  id: string;
  name: string;
  alias: string;
  email: string;
  phone: string;
  active: boolean;
  totalContributed: number;
  totalWithdrawn: number;
};

type FounderTx = {
  id: string;
  founderId: string;
  founderName: string;
  type: "contribution" | "withdrawal" | "funding";
  amount: number;
  method: string;
  orderId: string;
  notes: string;
  date: string;
  createdAt: string;
};

const emptyForm = { name: "", alias: "", email: "", phone: "", totalContributed: "" };

function mapFounder(raw: any): Founder {
  return {
    id: raw.id,
    name: raw.name || "",
    alias: raw.alias || "",
    email: raw.email || "",
    phone: raw.phone || "",
    active: raw.active !== false,
    totalContributed: Number(raw.totalContributed ?? raw.total_contributed ?? 0),
    totalWithdrawn: Number(raw.totalWithdrawn ?? raw.total_withdrawn ?? 0),
  };
}

function typeLabel(type: string) {
  if (type === "funding") return "تمويل طلب";
  if (type === "contribution") return "مساهمة";
  if (type === "withdrawal") return "سحب";
  return type;
}

export default function FoundersPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [founders, setFounders] = useState<Founder[]>([]);
  const [founderTxs, setFounderTxs] = useState<FounderTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedFounder, setExpandedFounder] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingFounder, setEditingFounder] = useState<Founder | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ name: "", alias: "", email: "", phone: "" });

  const loadData = () =>
    Promise.all([
      api.get<any[]>("/founders"),
      api.get<FounderTx[]>("/founder-transactions").catch(() => []),
    ]).then(([f, txs]) => {
      setFounders((f || []).map(mapFounder));
      setFounderTxs(txs || []);
    });

  useEffect(() => {
    loadData()
      .catch(() => toast.error("تعذّر تحميل بيانات المؤسسين"))
      .finally(() => setLoading(false));
  }, []);

  const totalContributed = founders.reduce((s, f) => s + f.totalContributed, 0);
  const totalWithdrawn = founders.reduce((s, f) => s + f.totalWithdrawn, 0);

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error(t.enterFounderName || "أدخل اسم المؤسس"); return; }
    setSaving(true);
    try {
      const newId = `F${Date.now().toString().slice(-6)}`;
      const payload = {
        id: newId,
        name: form.name.trim(),
        alias: form.alias.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      };
      const saved = await api.post<any>("/founders", payload);
      await logAudit({ entity: "founder", entityId: saved.id || newId, entityName: payload.name, action: "create", snapshot: saved, endpoint: "/founders" });
      setFounders([...founders, mapFounder(saved)]);
      setForm(emptyForm);
      setAddOpen(false);
      toast.success(t.founderAdded || "تمت إضافة المؤسس");
    } catch {
      toast.error("فشل حفظ بيانات المؤسس");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editingFounder || !editForm.name.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/founders/${editingFounder.id}`, editForm);
      await logAudit({ entity: "founder", entityId: editingFounder.id, entityName: editForm.name || editingFounder.name, action: "update", snapshot: { ...editingFounder, ...editForm }, endpoint: "/founders" });
      setFounders(founders.map(f => f.id === editingFounder.id ? { ...f, ...editForm } : f));
      setEditOpen(false);
      toast.success(t.founderUpdated || "تم تحديث بيانات المؤسس");
    } catch {
      toast.error("فشل تحديث بيانات المؤسس");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingFounder) return;
    setSaving(true);
    try {
      await api.delete(`/founders/${editingFounder.id}`);
      await logAudit({ entity: "founder", entityId: editingFounder.id, entityName: editingFounder.name, action: "delete", snapshot: editingFounder as any, endpoint: "/founders" });
      setFounders(founders.filter(f => f.id !== editingFounder.id));
      setDeleteOpen(false);
      setEditOpen(false);
      toast.success("تم حذف المؤسس");
    } catch {
      toast.error("فشل حذف المؤسس");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">{t.foundersTitle}</h1>
          <p className="page-description">{t.foundersDesc}</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.addFounder}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t.totalContributions}
          value={totalContributed > 0 ? `${(totalContributed / 1000).toFixed(0)} ${t.thousand} ${t.currency}` : "—"}
          change={`${founders.length} ${t.foundersCount}`}
          changeType="neutral"
          icon={Wallet}
        />
        <div className="cursor-pointer" onClick={() => navigate("/company-profit")}>
          <StatCard title={t.totalProfits} value="—" change={t.vsLastQuarter} changeType="positive" icon={TrendingUp} />
        </div>
        <StatCard
          title={t.availableBalance}
          value={totalWithdrawn > 0 ? `${(totalWithdrawn / 1000).toFixed(1)} ${t.thousand} ${t.currency}` : "—"}
          change={t.afterWithdrawals}
          changeType="neutral"
          icon={Users}
        />
      </div>

      {founders.length === 0 ? (
        <div className="stat-card py-20 text-center">
          <p className="text-muted-foreground text-sm mb-4">لا يوجد مؤسسون مسجّلون بعد</p>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.addFounder}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {founders.map((f) => {
            // Transactions for this founder (by id or by name)
            const myTxs = founderTxs.filter(tx =>
              (tx.founderId && tx.founderId === f.id) ||
              (tx.founderName && tx.founderName === f.name)
            ).sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

            const orderFundings = myTxs.filter(tx => tx.type === "funding" && tx.orderId);
            const contributions = myTxs.filter(tx => tx.type === "contribution");
            const isExpanded = expandedFounder === f.id;

            // Recompute from transactions (more accurate than stored total)
            const txContribTotal = myTxs.filter(tx => tx.type !== "withdrawal").reduce((s, tx) => s + tx.amount, 0);
            const displayTotal = txContribTotal > 0 ? txContribTotal : f.totalContributed;

            return (
              <div key={f.id} className="stat-card p-0 overflow-hidden">
                {/* ── Card header ── */}
                <div className="flex items-start justify-between p-5">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-primary">{f.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-semibold">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.alias}{f.alias && f.email ? " · " : ""}{f.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className={f.active ? "bg-success/10 text-success border-0" : "bg-muted text-muted-foreground border-0"}>
                      {f.active ? t.active : t.inactive}
                    </Badge>
                    <Button
                      variant="ghost" size="sm" className="h-8 w-8 p-0"
                      onClick={() => {
                        setEditingFounder(f);
                        setEditForm({ name: f.name, alias: f.alias, email: f.email, phone: f.phone });
                        setEditOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* ── Stats row ── */}
                <div className="grid grid-cols-3 gap-0 border-t border-border">
                  <div className="p-3 text-center border-l border-border rtl:border-r rtl:border-l-0">
                    <div className="text-xs text-muted-foreground mb-1">إجمالي المساهمات</div>
                    <div className="font-bold text-sm">
                      {displayTotal > 0 ? `${displayTotal.toLocaleString()}` : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">{t.currency}</div>
                  </div>
                  <div className="p-3 text-center border-l border-border rtl:border-r rtl:border-l-0">
                    <div className="text-xs text-muted-foreground mb-1">تمويل أوردرات</div>
                    <div className="font-bold text-sm text-primary">
                      {orderFundings.length > 0 ? orderFundings.length : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">طلب</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">الحصة من الإجمالي</div>
                    <div className="font-bold text-sm">
                      {totalContributed > 0 ? `${((displayTotal / totalContributed) * 100).toFixed(1)}%` : "—"}
                    </div>
                  </div>
                </div>

                {/* ── Expand/collapse button ── */}
                {myTxs.length > 0 && (
                  <button
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-border text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedFounder(isExpanded ? null : f.id)}
                    data-testid={`button-expand-founder-${f.id}`}
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    {isExpanded ? "إخفاء السجل" : `عرض سجل المشاركات (${myTxs.length})`}
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                )}

                {/* ── Transaction history ── */}
                {isExpanded && myTxs.length > 0 && (
                  <div className="border-t border-border">
                    <ScrollArea className="max-h-72">
                      <div className="divide-y divide-border/50">
                        {myTxs.map((tx) => (
                          <div key={tx.id} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                            {/* Icon */}
                            <div className={`mt-0.5 flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${tx.type === "withdrawal" ? "bg-destructive/10" : "bg-primary/10"}`}>
                              {tx.type === "withdrawal"
                                ? <TrendingUp className="h-3.5 w-3.5 text-destructive rotate-180" />
                                : <Wallet className="h-3.5 w-3.5 text-primary" />}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{typeLabel(tx.type)}</span>
                                {/* Clickable order link */}
                                {tx.orderId && (
                                  <button
                                    className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors"
                                    onClick={() => navigate(`/orders/${tx.orderId}`)}
                                    data-testid={`link-order-${tx.orderId}-${tx.id}`}
                                  >
                                    {tx.orderId}
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">{tx.date}</span>
                                {tx.notes && <span className="text-xs text-muted-foreground truncate">· {tx.notes}</span>}
                              </div>
                            </div>

                            {/* Amount */}
                            <div className={`text-sm font-bold flex-shrink-0 ${tx.type === "withdrawal" ? "text-destructive" : "text-foreground"}`}>
                              {tx.type === "withdrawal" ? "-" : "+"}{tx.amount.toLocaleString()}
                              <span className="text-xs font-normal text-muted-foreground mr-0.5">{t.currency}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    {/* Summary footer */}
                    <div className="flex items-center justify-between px-5 py-2.5 bg-muted/20 border-t border-border text-xs text-muted-foreground">
                      <span>إجمالي المساهمات والتمويل</span>
                      <span className="font-bold text-foreground">
                        {myTxs.filter(tx => tx.type !== "withdrawal").reduce((s, tx) => s + tx.amount, 0).toLocaleString()} {t.currency}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Founder Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.addNewFounder}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t.name} *</Label><Input className="h-9 mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label className="text-xs">{t.jobTitle}</Label><Input className="h-9 mt-1" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t.email}</Label><Input className="h-9 mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label className="text-xs">{t.phone}</Label><Input className="h-9 mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">{t.initialContribution} ({t.currency})</Label><Input className="h-9 mt-1" type="number" value={form.totalContributed} onChange={(e) => setForm({ ...form, totalContributed: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.addFounder}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Founder Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.edit} — {editingFounder?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t.name} *</Label><Input className="h-9 mt-1" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div><Label className="text-xs">{t.jobTitle}</Label><Input className="h-9 mt-1" value={editForm.alias} onChange={(e) => setEditForm({ ...editForm, alias: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t.email}</Label><Input className="h-9 mt-1" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
              <div><Label className="text-xs">{t.phone}</Label><Input className="h-9 mt-1" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button className="flex-1" onClick={handleEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>حذف المؤسس</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف <strong>{editingFounder?.name}</strong>؟ لا يمكن التراجع عن هذا.</p>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
