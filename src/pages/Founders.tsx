import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Wallet, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";

const initialFounders = [
  { id: "1", name: "أحمد الراشد", alias: "المدير التنفيذي", email: "ahmed@opshub.com", phone: "+20 100 123 4567", active: true, totalContributed: 1250000, totalProfit: 425000, totalWithdrawn: 200000, monthlyProfit: [{ month: "Oct", profit: 62000 }, { month: "Nov", profit: 71000 }, { month: "Dec", profit: 68000 }, { month: "Jan", profit: 75000 }, { month: "Feb", profit: 78000 }, { month: "Mar", profit: 71000 }] },
  { id: "2", name: "سارة المنصور", alias: "مدير العمليات", email: "sara@opshub.com", phone: "+20 111 234 5678", active: true, totalContributed: 950000, totalProfit: 382000, totalWithdrawn: 150000, monthlyProfit: [{ month: "Oct", profit: 58000 }, { month: "Nov", profit: 64000 }, { month: "Dec", profit: 61000 }, { month: "Jan", profit: 69000 }, { month: "Feb", profit: 70000 }, { month: "Mar", profit: 60000 }] },
  { id: "3", name: "عمر خليل", alias: "المدير المالي", email: "omar@opshub.com", phone: "+20 122 345 6789", active: true, totalContributed: 800000, totalProfit: 318000, totalWithdrawn: 100000, monthlyProfit: [{ month: "Oct", profit: 48000 }, { month: "Nov", profit: 53000 }, { month: "Dec", profit: 51000 }, { month: "Jan", profit: 57000 }, { month: "Feb", profit: 58000 }, { month: "Mar", profit: 51000 }] },
];

const emptyFounder = { name: "", alias: "", email: "", phone: "", totalContributed: "" };

export default function FoundersPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [founders, setFounders] = useState(initialFounders);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFounder, setEditingFounder] = useState<typeof initialFounders[0] | null>(null);
  const [editForm, setEditForm] = useState({ name: "", alias: "", email: "", phone: "" });
  const [form, setForm] = useState(emptyFounder);

  const totalContributed = founders.reduce((s, f) => s + f.totalContributed, 0);
  const totalProfit = founders.reduce((s, f) => s + f.totalProfit, 0);
  const totalBalance = founders.reduce((s, f) => s + (f.totalProfit - f.totalWithdrawn), 0);

  const handleAdd = () => {
    if (!form.name) { toast.error(t.enterFounderName); return; }
    const newId = String(founders.length + 1);
    setFounders([...founders, { id: newId, name: form.name, alias: form.alias, email: form.email, phone: form.phone, active: true, totalContributed: Number(form.totalContributed) || 0, totalProfit: 0, totalWithdrawn: 0, monthlyProfit: [{ month: "Mar", profit: 0 }] }]);
    setForm(emptyFounder);
    setDialogOpen(false);
    toast.success(t.founderAdded);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">{t.foundersTitle}</h1>
          <p className="page-description">{t.foundersDesc}</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.addFounder}</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title={t.totalContributions} value={`${(totalContributed / 1000).toFixed(0)} ${t.thousand} ${t.currency}`} change={`${founders.length} ${t.foundersCount}`} changeType="neutral" icon={Wallet} />
        <div className="cursor-pointer" onClick={() => navigate("/company-profit")}><StatCard title={t.totalProfits} value={`${(totalProfit / 1000).toFixed(1)} ${t.thousand} ${t.currency}`} change={t.vsLastQuarter} changeType="positive" icon={TrendingUp} /></div>
        <StatCard title={t.availableBalance} value={`${(totalBalance / 1000).toFixed(1)} ${t.thousand} ${t.currency}`} change={t.afterWithdrawals} changeType="neutral" icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {founders.map((f) => (
          <div key={f.id} className="stat-card space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"><span className="text-lg font-bold text-primary">{f.name.charAt(0)}</span></div>
                <div><p className="font-semibold">{f.name}</p><p className="text-xs text-muted-foreground">{f.alias} · {f.email}</p></div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setEditingFounder(f); setEditForm({ name: f.name, alias: f.alias, email: f.email, phone: f.phone }); setEditDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-muted/50 text-center"><p className="text-muted-foreground">{t.contribution}</p><p className="font-bold mt-0.5">{(f.totalContributed / 1000).toFixed(0)} {t.thousand}</p></div>
              <div className="p-2.5 rounded-lg bg-success/5 text-center"><p className="text-muted-foreground">{t.profits}</p><p className="font-bold text-success mt-0.5">{(f.totalProfit / 1000).toFixed(1)} {t.thousand}</p></div>
              <div className="p-2.5 rounded-lg bg-primary/5 text-center"><p className="text-muted-foreground">{t.balance}</p><p className="font-bold text-primary mt-0.5">{((f.totalProfit - f.totalWithdrawn) / 1000).toFixed(1)} {t.thousand}</p></div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t.monthlyProfits}</p>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={f.monthlyProfit}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                  <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t border-border">
              <span>{t.share}: {((f.totalContributed / totalContributed) * 100).toFixed(1)}%</span>
              <Badge variant="default" className="bg-success/10 text-success border-0">{t.active}</Badge>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
            <Button className="w-full" onClick={handleAdd}>{t.addFounder}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
