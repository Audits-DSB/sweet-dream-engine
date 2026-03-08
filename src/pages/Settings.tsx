import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Save, Users, Building2, Truck, Percent, Settings as SettingsIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const mockFounders = [
  { id: "1", name: "Ahmed Al-Rashid", alias: "CEO", email: "ahmed@opshub.com", active: true, totalContributed: 125000, totalProfit: 42500 },
  { id: "2", name: "Sara Al-Mansour", alias: "COO", email: "sara@opshub.com", active: true, totalContributed: 95000, totalProfit: 38200 },
  { id: "3", name: "Omar Khalil", alias: "CFO", email: "omar@opshub.com", active: true, totalContributed: 80000, totalProfit: 31800 },
];

const mockDeliveryActors = [
  { id: "1", name: "Ahmed (Founder)", type: "Founder", phone: "+966 50 123 4567", active: true },
  { id: "2", name: "DHL Express", type: "External", phone: "+966 11 234 5678", active: true },
  { id: "3", name: "Fast Delivery Co.", type: "External", phone: "+966 12 345 6789", active: true },
  { id: "4", name: "Sara (Founder)", type: "Founder", phone: "+966 50 987 6543", active: false },
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

export default function SettingsPage() {
  const [founders, setFounders] = useState(mockFounders);
  const [actors, setActors] = useState(mockDeliveryActors);
  const [rules, setRules] = useState(businessRules);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Settings</h1>
        <p className="page-description">Configure system settings, founders, delivery actors, and business rules</p>
      </div>

      <Tabs defaultValue="business" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="business"><SettingsIcon className="h-3.5 w-3.5 mr-1.5" />Business Rules</TabsTrigger>
          <TabsTrigger value="founders"><Users className="h-3.5 w-3.5 mr-1.5" />Founders</TabsTrigger>
          <TabsTrigger value="delivery"><Truck className="h-3.5 w-3.5 mr-1.5" />Delivery Actors</TabsTrigger>
        </TabsList>

        {/* Business Rules */}
        <TabsContent value="business" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Profit Settings */}
            <div className="stat-card space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Percent className="h-4 w-4 text-primary" />Profit & Pricing</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Company Profit Percentage (%)</Label>
                  <Input type="number" value={rules.companyProfitPercentage} onChange={(e) => setRules({ ...rules, companyProfitPercentage: Number(e.target.value) })} className="h-9 mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Default Split Mode</Label>
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" variant={rules.defaultSplitMode === "equal" ? "default" : "outline"} onClick={() => setRules({ ...rules, defaultSplitMode: "equal" })} className="flex-1 h-9">Equal</Button>
                    <Button size="sm" variant={rules.defaultSplitMode === "contribution" ? "default" : "outline"} onClick={() => setRules({ ...rules, defaultSplitMode: "contribution" })} className="flex-1 h-9">Contribution</Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Default Delivery Fee (SAR)</Label>
                  <Input type="number" value={rules.defaultDeliveryFee} onChange={(e) => setRules({ ...rules, defaultDeliveryFee: Number(e.target.value) })} className="h-9 mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Subscription</Label>
                  <div className="flex gap-2 mt-1">
                    {(["none", "fixed", "percentage"] as const).map((t) => (
                      <Button key={t} size="sm" variant={rules.subscriptionType === t ? "default" : "outline"} onClick={() => setRules({ ...rules, subscriptionType: t })} className="flex-1 h-9 capitalize">{t}</Button>
                    ))}
                  </div>
                  {rules.subscriptionType !== "none" && (
                    <Input type="number" value={rules.subscriptionValue} onChange={(e) => setRules({ ...rules, subscriptionValue: Number(e.target.value) })} className="h-9 mt-2" placeholder={rules.subscriptionType === "percentage" ? "%" : "SAR"} />
                  )}
                </div>
              </div>
            </div>

            {/* Refill Settings */}
            <div className="stat-card space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Refill & Inventory</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Default Lead Time (weeks)</Label>
                  <Input type="number" value={rules.defaultLeadTimeWeeks} onChange={(e) => setRules({ ...rules, defaultLeadTimeWeeks: Number(e.target.value) })} className="h-9 mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Default Coverage (weeks)</Label>
                  <Input type="number" value={rules.defaultCoverageWeeks} onChange={(e) => setRules({ ...rules, defaultCoverageWeeks: Number(e.target.value) })} className="h-9 mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Default Safety Stock (units)</Label>
                  <Input type="number" value={rules.defaultSafetyStock} onChange={(e) => setRules({ ...rules, defaultSafetyStock: Number(e.target.value) })} className="h-9 mt-1" />
                </div>
              </div>
            </div>

            {/* Alert Settings */}
            <div className="stat-card space-y-4 md:col-span-2">
              <h3 className="font-semibold">Alerts & Reminders</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">Low Stock Alerts</p>
                    <p className="text-xs text-muted-foreground">Notify when below threshold</p>
                  </div>
                  <Switch checked={rules.lowStockAlertEnabled} onCheckedChange={(v) => setRules({ ...rules, lowStockAlertEnabled: v })} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">Expiry Alerts</p>
                    <p className="text-xs text-muted-foreground">{rules.expiryAlertDays} days before expiry</p>
                  </div>
                  <Switch checked={rules.expiryAlertDays > 0} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">Audit Reminders</p>
                    <p className="text-xs text-muted-foreground">Every {rules.auditReminderDays} days</p>
                  </div>
                  <Switch checked={rules.auditReminderEnabled} onCheckedChange={(v) => setRules({ ...rules, auditReminderEnabled: v })} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button><Save className="h-4 w-4 mr-2" />Save Changes</Button>
          </div>
        </TabsContent>

        {/* Founders */}
        <TabsContent value="founders" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{founders.filter(f => f.active).length} active founders</p>
            <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Add Founder</Button>
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
                    {founder.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground">Contributed</p>
                    <p className="font-semibold mt-0.5">SAR {founder.totalContributed.toLocaleString()}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground">Profit</p>
                    <p className="font-semibold mt-0.5">SAR {founder.totalProfit.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs"><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Delivery Actors */}
        <TabsContent value="delivery" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{actors.length} delivery actors</p>
            <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Add Actor</Button>
          </div>
          <div className="stat-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Phone</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {actors.map((actor) => (
                  <tr key={actor.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium">{actor.name}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant="secondary" className="text-xs">{actor.type}</Badge>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{actor.phone}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant={actor.active ? "default" : "secondary"} className={actor.active ? "bg-success/10 text-success border-0" : ""}>
                        {actor.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
