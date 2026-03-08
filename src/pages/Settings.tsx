import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Save, Users, Building2, Truck, Percent, Settings as SettingsIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const initialFounders = [
  { id: "1", name: "أحمد الراشد", alias: "المدير التنفيذي", email: "ahmed@opshub.com", active: true, totalContributed: 125000, totalProfit: 42500 },
  { id: "2", name: "سارة المنصور", alias: "مدير العمليات", email: "sara@opshub.com", active: true, totalContributed: 95000, totalProfit: 38200 },
  { id: "3", name: "عمر خليل", alias: "المدير المالي", email: "omar@opshub.com", active: true, totalContributed: 80000, totalProfit: 31800 },
];

const initialActors = [
  { id: "1", name: "أحمد (مؤسس)", type: "مؤسس", phone: "+20 100 123 4567", active: true },
  { id: "2", name: "DHL Express", type: "خارجي", phone: "+20 11 234 5678", active: true },
  { id: "3", name: "شركة توصيل سريع", type: "خارجي", phone: "+20 12 345 6789", active: true },
  { id: "4", name: "سارة (مؤسس)", type: "مؤسس", phone: "+20 111 987 6543", active: false },
];

const businessRules = {
  companyProfitPercentage: 15,
  defaultSplitMode: "equal" as "equal" | "contribution",
  defaultLeadTimeWeeks: 2,
  defaultCoverageWeeks: 4,
  defaultSafetyStock: 5,
  subscriptionType: "percentage" as "fixed" | "percentage" | "none",
  subscriptionValue: 5,
  cashbackType: "none" as "fixed" | "percentage" | "none",
  cashbackValue: 0,
  defaultDeliveryFee: 50,
  lowStockAlertEnabled: true,
  expiryAlertDays: 14,
  auditReminderEnabled: true,
  auditReminderDays: 7,
};

type DialogMode = "founder" | "actor" | null;

export default function SettingsPage() {
  const [founders, setFounders] = useState(initialFounders);
  const [actors, setActors] = useState(initialActors);
  const [rules, setRules] = useState(businessRules);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [founderForm, setFounderForm] = useState({ name: "", alias: "", email: "" });
  const [actorForm, setActorForm] = useState({ name: "", type: "خارجي", phone: "" });

  const addFounder = () => {
    if (!founderForm.name) { toast.error("يرجى إدخال الاسم"); return; }
    setFounders([...founders, { id: String(Date.now()), name: founderForm.name, alias: founderForm.alias, email: founderForm.email, active: true, totalContributed: 0, totalProfit: 0 }]);
    setFounderForm({ name: "", alias: "", email: "" });
    setDialogMode(null);
    toast.success("تم إضافة المؤسس");
  };

  const addActor = () => {
    if (!actorForm.name) { toast.error("يرجى إدخال الاسم"); return; }
    setActors([...actors, { id: String(Date.now()), name: actorForm.name, type: actorForm.type, phone: actorForm.phone, active: true }]);
    setActorForm({ name: "", type: "خارجي", phone: "" });
    setDialogMode(null);
    toast.success("تم إضافة منفذ التوصيل");
  };

  const deleteFounder = (id: string) => { setFounders(founders.filter(f => f.id !== id)); toast.success("تم حذف المؤسس"); };
  const deleteActor = (id: string) => { setActors(actors.filter(a => a.id !== id)); toast.success("تم حذف منفذ التوصيل"); };
  const toggleActorStatus = (id: string) => { setActors(actors.map(a => a.id === id ? { ...a, active: !a.active } : a)); };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">الإعدادات</h1>
        <p className="page-description">إعداد النظام والمؤسسين ومنفذي التوصيل وقواعد العمل</p>
      </div>

      <Tabs defaultValue="business" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="business"><SettingsIcon className="h-3.5 w-3.5 mr-1.5" />قواعد العمل</TabsTrigger>
          <TabsTrigger value="founders"><Users className="h-3.5 w-3.5 mr-1.5" />المؤسسون</TabsTrigger>
          <TabsTrigger value="delivery"><Truck className="h-3.5 w-3.5 mr-1.5" />منفذو التوصيل</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="stat-card space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Percent className="h-4 w-4 text-primary" />الأرباح والتسعير</h3>
              <div className="space-y-3">
                <div><Label className="text-xs">نسبة ربح الشركة (%)</Label><Input type="number" value={rules.companyProfitPercentage} onChange={(e) => setRules({ ...rules, companyProfitPercentage: Number(e.target.value) })} className="h-9 mt-1" /></div>
                <div>
                  <Label className="text-xs">نظام التقسيم الافتراضي</Label>
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" variant={rules.defaultSplitMode === "equal" ? "default" : "outline"} onClick={() => setRules({ ...rules, defaultSplitMode: "equal" })} className="flex-1 h-9">متساوي</Button>
                    <Button size="sm" variant={rules.defaultSplitMode === "contribution" ? "default" : "outline"} onClick={() => setRules({ ...rules, defaultSplitMode: "contribution" })} className="flex-1 h-9">بالمساهمة</Button>
                  </div>
                </div>
                <div><Label className="text-xs">رسوم التوصيل الافتراضية (ج.م)</Label><Input type="number" value={rules.defaultDeliveryFee} onChange={(e) => setRules({ ...rules, defaultDeliveryFee: Number(e.target.value) })} className="h-9 mt-1" /></div>
                <div>
                  <Label className="text-xs">الاشتراك</Label>
                  <div className="flex gap-2 mt-1">
                    {(["none", "fixed", "percentage"] as const).map((t) => (
                      <Button key={t} size="sm" variant={rules.subscriptionType === t ? "default" : "outline"} onClick={() => setRules({ ...rules, subscriptionType: t })} className="flex-1 h-9">
                        {t === "none" ? "بدون" : t === "fixed" ? "ثابت" : "نسبة"}
                      </Button>
                    ))}
                  </div>
                  {rules.subscriptionType !== "none" && (
                    <Input type="number" value={rules.subscriptionValue} onChange={(e) => setRules({ ...rules, subscriptionValue: Number(e.target.value) })} className="h-9 mt-2" placeholder={rules.subscriptionType === "percentage" ? "%" : "ج.م"} />
                  )}
                </div>
              </div>
            </div>

            <div className="stat-card space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />إعادة التعبئة والمخزون</h3>
              <div className="space-y-3">
                <div><Label className="text-xs">وقت التوريد الافتراضي (أسابيع)</Label><Input type="number" value={rules.defaultLeadTimeWeeks} onChange={(e) => setRules({ ...rules, defaultLeadTimeWeeks: Number(e.target.value) })} className="h-9 mt-1" /></div>
                <div><Label className="text-xs">التغطية الافتراضية (أسابيع)</Label><Input type="number" value={rules.defaultCoverageWeeks} onChange={(e) => setRules({ ...rules, defaultCoverageWeeks: Number(e.target.value) })} className="h-9 mt-1" /></div>
                <div><Label className="text-xs">حد الأمان الافتراضي (وحدات)</Label><Input type="number" value={rules.defaultSafetyStock} onChange={(e) => setRules({ ...rules, defaultSafetyStock: Number(e.target.value) })} className="h-9 mt-1" /></div>
              </div>
            </div>

            <div className="stat-card space-y-4 md:col-span-2">
              <h3 className="font-semibold">التنبيهات والتذكيرات</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div><p className="text-sm font-medium">تنبيه المخزون المنخفض</p><p className="text-xs text-muted-foreground">إشعار عند انخفاض المخزون</p></div>
                  <Switch checked={rules.lowStockAlertEnabled} onCheckedChange={(v) => setRules({ ...rules, lowStockAlertEnabled: v })} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div><p className="text-sm font-medium">تنبيه انتهاء الصلاحية</p><p className="text-xs text-muted-foreground">{rules.expiryAlertDays} يوم قبل الانتهاء</p></div>
                  <Switch checked={rules.expiryAlertDays > 0} onCheckedChange={(v) => setRules({ ...rules, expiryAlertDays: v ? 14 : 0 })} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div><p className="text-sm font-medium">تذكير الجرد</p><p className="text-xs text-muted-foreground">كل {rules.auditReminderDays} أيام</p></div>
                  <Switch checked={rules.auditReminderEnabled} onCheckedChange={(v) => setRules({ ...rules, auditReminderEnabled: v })} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => toast.success("تم حفظ الإعدادات")}><Save className="h-4 w-4 mr-2" />حفظ التغييرات</Button>
          </div>
        </TabsContent>

        <TabsContent value="founders" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{founders.filter(f => f.active).length} مؤسسين نشطين</p>
            <Button size="sm" onClick={() => { setFounderForm({ name: "", alias: "", email: "" }); setDialogMode("founder"); }}><Plus className="h-3.5 w-3.5 mr-1.5" />إضافة مؤسس</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {founders.map((founder) => (
              <div key={founder.id} className="stat-card space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{founder.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{founder.name}</p>
                      <p className="text-xs text-muted-foreground">{founder.alias}</p>
                    </div>
                  </div>
                  <Badge variant={founder.active ? "default" : "secondary"} className={founder.active ? "bg-success/10 text-success border-0" : ""}>
                    {founder.active ? "نشط" : "غير نشط"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground">المساهمة</p><p className="font-semibold mt-0.5">{founder.totalContributed.toLocaleString()} ج.م</p></div>
                  <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground">الأرباح</p><p className="font-semibold mt-0.5">{founder.totalProfit.toLocaleString()} ج.م</p></div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => toast.info(`تعديل ${founder.name}`)}><Pencil className="h-3 w-3 mr-1" />تعديل</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => deleteFounder(founder.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="delivery" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{actors.length} منفذ توصيل</p>
            <Button size="sm" onClick={() => { setActorForm({ name: "", type: "خارجي", phone: "" }); setDialogMode("actor"); }}><Plus className="h-3.5 w-3.5 mr-1.5" />إضافة منفذ</Button>
          </div>
          <div className="stat-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">الاسم</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">النوع</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">الهاتف</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">الحالة</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {actors.map((actor) => (
                  <tr key={actor.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium">{actor.name}</td>
                    <td className="py-2.5 px-3"><Badge variant="secondary" className="text-xs">{actor.type}</Badge></td>
                    <td className="py-2.5 px-3 text-muted-foreground">{actor.phone}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant={actor.active ? "default" : "secondary"} className={actor.active ? "bg-success/10 text-success border-0" : ""}>
                        {actor.active ? "نشط" : "غير نشط"}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleActorStatus(actor.id)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteActor(actor.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogMode === "founder"} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>إضافة مؤسس</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">الاسم *</Label><Input className="h-9 mt-1" value={founderForm.name} onChange={(e) => setFounderForm({ ...founderForm, name: e.target.value })} /></div>
            <div><Label className="text-xs">المسمى الوظيفي</Label><Input className="h-9 mt-1" value={founderForm.alias} onChange={(e) => setFounderForm({ ...founderForm, alias: e.target.value })} /></div>
            <div><Label className="text-xs">البريد الإلكتروني</Label><Input className="h-9 mt-1" type="email" value={founderForm.email} onChange={(e) => setFounderForm({ ...founderForm, email: e.target.value })} /></div>
            <Button className="w-full" onClick={addFounder}>إضافة المؤسس</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === "actor"} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>إضافة منفذ توصيل</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">الاسم *</Label><Input className="h-9 mt-1" value={actorForm.name} onChange={(e) => setActorForm({ ...actorForm, name: e.target.value })} /></div>
            <div><Label className="text-xs">النوع</Label>
              <div className="flex gap-2 mt-1">
                <Button size="sm" variant={actorForm.type === "مؤسس" ? "default" : "outline"} onClick={() => setActorForm({ ...actorForm, type: "مؤسس" })} className="flex-1 h-9">مؤسس</Button>
                <Button size="sm" variant={actorForm.type === "خارجي" ? "default" : "outline"} onClick={() => setActorForm({ ...actorForm, type: "خارجي" })} className="flex-1 h-9">خارجي</Button>
              </div>
            </div>
            <div><Label className="text-xs">الهاتف</Label><Input className="h-9 mt-1" value={actorForm.phone} onChange={(e) => setActorForm({ ...actorForm, phone: e.target.value })} /></div>
            <Button className="w-full" onClick={addActor}>إضافة المنفذ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
