import { useState } from "react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Wallet, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, Tooltip,
} from "recharts";

const initialFounders = [
  {
    id: "1", name: "أحمد الراشد", alias: "المدير التنفيذي", email: "ahmed@opshub.com", phone: "+20 100 123 4567",
    active: true, totalContributed: 1250000, totalProfit: 425000, totalWithdrawn: 200000,
    monthlyProfit: [
      { month: "أكت", profit: 62000 }, { month: "نوف", profit: 71000 }, { month: "ديس", profit: 68000 },
      { month: "ينا", profit: 75000 }, { month: "فبر", profit: 78000 }, { month: "مار", profit: 71000 },
    ],
  },
  {
    id: "2", name: "سارة المنصور", alias: "مدير العمليات", email: "sara@opshub.com", phone: "+20 111 234 5678",
    active: true, totalContributed: 950000, totalProfit: 382000, totalWithdrawn: 150000,
    monthlyProfit: [
      { month: "أكت", profit: 58000 }, { month: "نوف", profit: 64000 }, { month: "ديس", profit: 61000 },
      { month: "ينا", profit: 69000 }, { month: "فبر", profit: 70000 }, { month: "مار", profit: 60000 },
    ],
  },
  {
    id: "3", name: "عمر خليل", alias: "المدير المالي", email: "omar@opshub.com", phone: "+20 122 345 6789",
    active: true, totalContributed: 800000, totalProfit: 318000, totalWithdrawn: 100000,
    monthlyProfit: [
      { month: "أكت", profit: 48000 }, { month: "نوف", profit: 53000 }, { month: "ديس", profit: 51000 },
      { month: "ينا", profit: 57000 }, { month: "فبر", profit: 58000 }, { month: "مار", profit: 51000 },
    ],
  },
];

const emptyFounder = { name: "", alias: "", email: "", phone: "", totalContributed: "" };

export default function FoundersPage() {
  const [founders, setFounders] = useState(initialFounders);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyFounder);

  const totalContributed = founders.reduce((s, f) => s + f.totalContributed, 0);
  const totalProfit = founders.reduce((s, f) => s + f.totalProfit, 0);
  const totalBalance = founders.reduce((s, f) => s + (f.totalProfit - f.totalWithdrawn), 0);

  const handleAdd = () => {
    if (!form.name) { toast.error("يرجى إدخال اسم المؤسس"); return; }
    const newId = String(founders.length + 1);
    setFounders([...founders, {
      id: newId, name: form.name, alias: form.alias, email: form.email, phone: form.phone,
      active: true, totalContributed: Number(form.totalContributed) || 0, totalProfit: 0, totalWithdrawn: 0,
      monthlyProfit: [{ month: "مار", profit: 0 }],
    }]);
    setForm(emptyFounder);
    setDialogOpen(false);
    toast.success("تم إضافة المؤسس بنجاح");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">المؤسسون</h1>
          <p className="page-description">ملفات المؤسسين والمساهمات وتوزيع الأرباح</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />إضافة مؤسس</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="إجمالي المساهمات" value={`${(totalContributed / 1000).toFixed(0)} ألف ج.م`} change={`${founders.length} مؤسسين`} changeType="neutral" icon={Wallet} />
        <StatCard title="إجمالي الأرباح" value={`${(totalProfit / 1000).toFixed(1)} ألف ج.م`} change="+12% مقارنة بالربع السابق" changeType="positive" icon={TrendingUp} />
        <StatCard title="الرصيد المتاح" value={`${(totalBalance / 1000).toFixed(1)} ألف ج.م`} change="بعد السحوبات" changeType="neutral" icon={Users} />
      </div>

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
                  <p className="text-xs text-muted-foreground">{f.alias} · {f.email}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toast.info(`تعديل ${f.name}`)}><Pencil className="h-3.5 w-3.5" /></Button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                <p className="text-muted-foreground">المساهمة</p>
                <p className="font-bold mt-0.5">{(f.totalContributed / 1000).toFixed(0)} ألف ج.م</p>
              </div>
              <div className="p-2.5 rounded-lg bg-success/5 text-center">
                <p className="text-muted-foreground">الأرباح</p>
                <p className="font-bold text-success mt-0.5">{(f.totalProfit / 1000).toFixed(1)} ألف ج.م</p>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/5 text-center">
                <p className="text-muted-foreground">الرصيد</p>
                <p className="font-bold text-primary mt-0.5">{((f.totalProfit - f.totalWithdrawn) / 1000).toFixed(1)} ألف ج.م</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">الأرباح الشهرية (6 أشهر)</p>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={f.monthlyProfit}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                  <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t border-border">
              <span>الحصة: {((f.totalContributed / totalContributed) * 100).toFixed(1)}%</span>
              <Badge variant="default" className="bg-success/10 text-success border-0">نشط</Badge>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>إضافة مؤسس جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">الاسم *</Label><Input className="h-9 mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label className="text-xs">المسمى الوظيفي</Label><Input className="h-9 mt-1" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">البريد</Label><Input className="h-9 mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label className="text-xs">الهاتف</Label><Input className="h-9 mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">المساهمة الأولية (ج.م)</Label><Input className="h-9 mt-1" type="number" value={form.totalContributed} onChange={(e) => setForm({ ...form, totalContributed: e.target.value })} /></div>
            <Button className="w-full" onClick={handleAdd}>إضافة المؤسس</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
