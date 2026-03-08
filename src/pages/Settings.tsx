import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
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
  { id: "1", name: "أحمد (مؤسس)", type: "founder", phone: "+20 100 123 4567", active: true },
  { id: "2", name: "DHL Express", type: "external", phone: "+20 11 234 5678", active: true },
  { id: "3", name: "شركة توصيل سريع", type: "external", phone: "+20 12 345 6789", active: true },
  { id: "4", name: "سارة (مؤسس)", type: "founder", phone: "+20 111 987 6543", active: false },
];

const businessRules = {
  companyProfitPercentage: 15, defaultSplitMode: "equal" as "equal" | "contribution",
  defaultLeadTimeWeeks: 2, defaultCoverageWeeks: 4, defaultSafetyStock: 5,
  subscriptionType: "percentage" as "fixed" | "percentage" | "none", subscriptionValue: 5,
  defaultDeliveryFee: 50, lowStockAlertEnabled: true, expiryAlertDays: 14,
  auditReminderEnabled: true, auditReminderDays: 7,
};

type DialogMode = "founder" | "actor" | "editFounder" | "editActor" | null;

export default function SettingsPage() {
  const { t } = useLanguage();
  const [founders, setFounders] = useState(initialFounders);
  const [actors, setActors] = useState(initialActors);
  const [rules, setRules] = useState(businessRules);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [founderForm, setFounderForm] = useState({ name: "", alias: "", email: "" });
  const [actorForm, setActorForm] = useState({ name: "", type: "external", phone: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const editFounder = (founder: typeof initialFounders[0]) => {
    setEditingId(founder.id);
    setFounderForm({ name: founder.name, alias: founder.alias, email: founder.email });
    setDialogMode("editFounder");
  };

  const saveEditFounder = () => {
    if (!founderForm.name) { toast.error(t.enterFounderName); return; }
    setFounders(founders.map(f => f.id === editingId ? { ...f, name: founderForm.name, alias: founderForm.alias, email: founderForm.email } : f));
    setDialogMode(null); setEditingId(null);
    toast.success(t.founderUpdated);
  };

  const editActor = (actor: typeof initialActors[0]) => {
    setEditingId(actor.id);
    setActorForm({ name: actor.name, type: actor.type, phone: actor.phone });
    setDialogMode("editActor");
  };

  const saveEditActor = () => {
    if (!actorForm.name) { toast.error(t.enterFounderName); return; }
    setActors(actors.map(a => a.id === editingId ? { ...a, name: actorForm.name, type: actorForm.type, phone: actorForm.phone } : a));
    setDialogMode(null); setEditingId(null);
    toast.success(t.actorAdded);
  };

  const addFounder = () => {
    if (!founderForm.name) { toast.error(t.enterFounderName); return; }
    setFounders([...founders, { id: String(Date.now()), name: founderForm.name, alias: founderForm.alias, email: founderForm.email, active: true, totalContributed: 0, totalProfit: 0 }]);
    setFounderForm({ name: "", alias: "", email: "" }); setDialogMode(null);
    toast.success(t.founderAddedSettings);
  };

  const addActor = () => {
    if (!actorForm.name) { toast.error(t.enterFounderName); return; }
    setActors([...actors, { id: String(Date.now()), name: actorForm.name, type: actorForm.type, phone: actorForm.phone, active: true }]);
    setActorForm({ name: "", type: "external", phone: "" }); setDialogMode(null);
    toast.success(t.actorAdded);
  };

  const deleteFounder = (id: string) => { setFounders(founders.filter(f => f.id !== id)); toast.success(t.founderDeleted); };
  const deleteActor = (id: string) => { setActors(actors.filter(a => a.id !== id)); toast.success(t.actorDeleted); };
  const toggleActorStatus = (id: string) => { setActors(actors.map(a => a.id === id ? { ...a, active: !a.active } : a)); };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.settingsTitle}</h1>
        <p className="page-description">{t.settingsDesc}</p>
      </div>

      <Tabs defaultValue="business" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="business"><SettingsIcon className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.businessRules}</TabsTrigger>
          <TabsTrigger value="founders"><Users className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.founders}</TabsTrigger>
          <TabsTrigger value="delivery"><Truck className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.deliveryActors}</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="stat-card space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Percent className="h-4 w-4 text-primary" />{t.profitAndPricing}</h3>
              <div className="space-y-3">
                <div><Label className="text-xs">{t.companyProfitPercent}</Label><Input type="number" value={rules.companyProfitPercentage} onChange={(e) => setRules({ ...rules, companyProfitPercentage: Number(e.target.value) })} className="h-9 mt-1" /></div>
                <div>
                  <Label className="text-xs">{t.defaultSplitMode}</Label>
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" variant={rules.defaultSplitMode === "equal" ? "default" : "outline"} onClick={() => setRules({ ...rules, defaultSplitMode: "equal" })} className="flex-1 h-9">{t.equal}</Button>
                    <Button size="sm" variant={rules.defaultSplitMode === "contribution" ? "default" : "outline"} onClick={() => setRules({ ...rules, defaultSplitMode: "contribution" })} className="flex-1 h-9">{t.byContribution}</Button>
                  </div>
                </div>
                <div><Label className="text-xs">{t.defaultDeliveryFee}</Label><Input type="number" value={rules.defaultDeliveryFee} onChange={(e) => setRules({ ...rules, defaultDeliveryFee: Number(e.target.value) })} className="h-9 mt-1" /></div>
                <div>
                  <Label className="text-xs">{t.subscription}</Label>
                  <div className="flex gap-2 mt-1">
                    {(["none", "fixed", "percentage"] as const).map((tp) => (
                      <Button key={tp} size="sm" variant={rules.subscriptionType === tp ? "default" : "outline"} onClick={() => setRules({ ...rules, subscriptionType: tp })} className="flex-1 h-9">
                        {tp === "none" ? t.none : tp === "fixed" ? t.fixed : t.percentage}
                      </Button>
                    ))}
                  </div>
                  {rules.subscriptionType !== "none" && <Input type="number" value={rules.subscriptionValue} onChange={(e) => setRules({ ...rules, subscriptionValue: Number(e.target.value) })} className="h-9 mt-2" />}
                </div>
              </div>
            </div>
            <div className="stat-card space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />{t.inventoryAndRefill}</h3>
              <div className="space-y-3">
                <div><Label className="text-xs">{t.defaultLeadTime}</Label><Input type="number" value={rules.defaultLeadTimeWeeks} onChange={(e) => setRules({ ...rules, defaultLeadTimeWeeks: Number(e.target.value) })} className="h-9 mt-1" /></div>
                <div><Label className="text-xs">{t.defaultCoverage}</Label><Input type="number" value={rules.defaultCoverageWeeks} onChange={(e) => setRules({ ...rules, defaultCoverageWeeks: Number(e.target.value) })} className="h-9 mt-1" /></div>
                <div><Label className="text-xs">{t.defaultSafetyStock}</Label><Input type="number" value={rules.defaultSafetyStock} onChange={(e) => setRules({ ...rules, defaultSafetyStock: Number(e.target.value) })} className="h-9 mt-1" /></div>
              </div>
            </div>
            <div className="stat-card space-y-4 md:col-span-2">
              <h3 className="font-semibold">{t.alertsAndReminders}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div><p className="text-sm font-medium">{t.lowStockAlert}</p><p className="text-xs text-muted-foreground">{t.lowStockAlertDesc}</p></div>
                  <Switch checked={rules.lowStockAlertEnabled} onCheckedChange={(v) => setRules({ ...rules, lowStockAlertEnabled: v })} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div><p className="text-sm font-medium">{t.expiryAlertSetting}</p><p className="text-xs text-muted-foreground">{rules.expiryAlertDays} {t.daysBeforeExpiry}</p></div>
                  <Switch checked={rules.expiryAlertDays > 0} onCheckedChange={(v) => setRules({ ...rules, expiryAlertDays: v ? 14 : 0 })} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div><p className="text-sm font-medium">{t.auditReminder}</p><p className="text-xs text-muted-foreground">{rules.auditReminderDays} {t.everyXDays}</p></div>
                  <Switch checked={rules.auditReminderEnabled} onCheckedChange={(v) => setRules({ ...rules, auditReminderEnabled: v })} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => toast.success(t.settingsSaved)}><Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t.saveChanges}</Button>
          </div>
        </TabsContent>

        <TabsContent value="founders" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{founders.filter(f => f.active).length} {t.activeFounders}</p>
            <Button size="sm" onClick={() => { setFounderForm({ name: "", alias: "", email: "" }); setDialogMode("founder"); }}><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.addFounderBtn}</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {founders.map((founder) => (
              <div key={founder.id} className="stat-card space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><span className="text-sm font-bold text-primary">{founder.name.charAt(0)}</span></div>
                    <div><p className="font-semibold text-sm">{founder.name}</p><p className="text-xs text-muted-foreground">{founder.alias}</p></div>
                  </div>
                  <Badge variant={founder.active ? "default" : "secondary"} className={founder.active ? "bg-success/10 text-success border-0" : ""}>{founder.active ? t.active : t.inactive}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground">{t.contribution}</p><p className="font-semibold mt-0.5">{founder.totalContributed.toLocaleString()} {t.currency}</p></div>
                  <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground">{t.profits}</p><p className="font-semibold mt-0.5">{founder.totalProfit.toLocaleString()} {t.currency}</p></div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => editFounder(founder)}><Pencil className="h-3 w-3 ltr:mr-1 rtl:ml-1" />{t.edit}</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => deleteFounder(founder.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="delivery" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{actors.length} {t.deliveryActors}</p>
            <Button size="sm" onClick={() => { setActorForm({ name: "", type: "external", phone: "" }); setDialogMode("actor"); }}><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.addActorBtn}</Button>
          </div>
          <div className="stat-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.name}</th>
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.type}</th>
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.phone}</th>
                  <th className="text-start py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
                  <th className="text-end py-2.5 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {actors.map((actor) => (
                  <tr key={actor.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium">{actor.name}</td>
                    <td className="py-2.5 px-3"><Badge variant="secondary" className="text-xs">{actor.type === "founder" ? t.founderType : t.externalType}</Badge></td>
                    <td className="py-2.5 px-3 text-muted-foreground">{actor.phone}</td>
                    <td className="py-2.5 px-3"><Badge variant={actor.active ? "default" : "secondary"} className={actor.active ? "bg-success/10 text-success border-0" : ""}>{actor.active ? t.active : t.inactive}</Badge></td>
                    <td className="py-2.5 px-3 text-end">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => editActor(actor)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleActorStatus(actor.id)}><Switch checked={actor.active} className="scale-75" /></Button>
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
          <DialogHeader><DialogTitle>{t.addFounderBtn}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t.name} *</Label><Input className="h-9 mt-1" value={founderForm.name} onChange={(e) => setFounderForm({ ...founderForm, name: e.target.value })} /></div>
            <div><Label className="text-xs">{t.jobTitle}</Label><Input className="h-9 mt-1" value={founderForm.alias} onChange={(e) => setFounderForm({ ...founderForm, alias: e.target.value })} /></div>
            <div><Label className="text-xs">{t.email}</Label><Input className="h-9 mt-1" type="email" value={founderForm.email} onChange={(e) => setFounderForm({ ...founderForm, email: e.target.value })} /></div>
            <Button className="w-full" onClick={addFounder}>{t.addFounderBtn}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === "actor"} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.addActorLabel}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t.name} *</Label><Input className="h-9 mt-1" value={actorForm.name} onChange={(e) => setActorForm({ ...actorForm, name: e.target.value })} /></div>
            <div><Label className="text-xs">{t.type}</Label>
              <div className="flex gap-2 mt-1">
                <Button size="sm" variant={actorForm.type === "founder" ? "default" : "outline"} onClick={() => setActorForm({ ...actorForm, type: "founder" })} className="flex-1 h-9">{t.founderType}</Button>
                <Button size="sm" variant={actorForm.type === "external" ? "default" : "outline"} onClick={() => setActorForm({ ...actorForm, type: "external" })} className="flex-1 h-9">{t.externalType}</Button>
              </div>
            </div>
            <div><Label className="text-xs">{t.phone}</Label><Input className="h-9 mt-1" value={actorForm.phone} onChange={(e) => setActorForm({ ...actorForm, phone: e.target.value })} /></div>
            <Button className="w-full" onClick={addActor}>{t.addActorBtn}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === "editFounder"} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.edit} {t.founders}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t.name} *</Label><Input className="h-9 mt-1" value={founderForm.name} onChange={(e) => setFounderForm({ ...founderForm, name: e.target.value })} /></div>
            <div><Label className="text-xs">{t.jobTitle}</Label><Input className="h-9 mt-1" value={founderForm.alias} onChange={(e) => setFounderForm({ ...founderForm, alias: e.target.value })} /></div>
            <div><Label className="text-xs">{t.email}</Label><Input className="h-9 mt-1" type="email" value={founderForm.email} onChange={(e) => setFounderForm({ ...founderForm, email: e.target.value })} /></div>
            <Button className="w-full" onClick={saveEditFounder}><Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t.saveChanges}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === "editActor"} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.edit} {t.deliveryActors}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t.name} *</Label><Input className="h-9 mt-1" value={actorForm.name} onChange={(e) => setActorForm({ ...actorForm, name: e.target.value })} /></div>
            <div><Label className="text-xs">{t.type}</Label>
              <div className="flex gap-2 mt-1">
                <Button size="sm" variant={actorForm.type === "founder" ? "default" : "outline"} onClick={() => setActorForm({ ...actorForm, type: "founder" })} className="flex-1 h-9">{t.founderType}</Button>
                <Button size="sm" variant={actorForm.type === "external" ? "default" : "outline"} onClick={() => setActorForm({ ...actorForm, type: "external" })} className="flex-1 h-9">{t.externalType}</Button>
              </div>
            </div>
            <div><Label className="text-xs">{t.phone}</Label><Input className="h-9 mt-1" value={actorForm.phone} onChange={(e) => setActorForm({ ...actorForm, phone: e.target.value })} /></div>
            <Button className="w-full" onClick={saveEditActor}><Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t.saveChanges}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
