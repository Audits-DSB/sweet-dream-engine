import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Wallet, Pencil, Plus, Loader2, Trash2 } from "lucide-react";
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

export default function FoundersPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [founders, setFounders] = useState<Founder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingFounder, setEditingFounder] = useState<Founder | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ name: "", alias: "", email: "", phone: "" });

  useEffect(() => {
    api.get<any[]>("/founders")
      .then((data) => setFounders((data || []).map(mapFounder)))
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {founders.map((f) => (
            <div key={f.id} className="stat-card space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">{f.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-semibold">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{f.alias}{f.alias && f.email ? " · " : ""}{f.email}</p>
                  </div>
                </div>
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

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                  <p className="text-muted-foreground">{t.contribution}</p>
                  <p className="font-bold mt-0.5">
                    {f.totalContributed > 0 ? `${(f.totalContributed / 1000).toFixed(0)} ${t.thousand}` : "—"}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-success/5 text-center">
                  <p className="text-muted-foreground">{t.profits}</p>
                  <p className="font-bold text-success mt-0.5">—</p>
                </div>
                <div className="p-2.5 rounded-lg bg-primary/5 text-center">
                  <p className="text-muted-foreground">{t.balance}</p>
                  <p className="font-bold text-primary mt-0.5">—</p>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t border-border">
                <span>
                  {totalContributed > 0
                    ? `${t.share}: ${((f.totalContributed / totalContributed) * 100).toFixed(1)}%`
                    : f.phone || f.id}
                </span>
                <Badge variant="default" className={f.active ? "bg-success/10 text-success border-0" : "bg-muted text-muted-foreground border-0"}>
                  {f.active ? t.active : t.inactive}
                </Badge>
              </div>
            </div>
          ))}
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
