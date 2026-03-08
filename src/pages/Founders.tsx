import { useState } from "react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Wallet, Pencil, Plus } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

const founders = [
  {
    id: "1", name: "Ahmed Al-Rashid", alias: "CEO", email: "ahmed@opshub.com", phone: "+966 50 123 4567",
    active: true, totalContributed: 125000, totalProfit: 42500, totalWithdrawn: 20000,
    monthlyProfit: [
      { month: "Oct", profit: 6200 }, { month: "Nov", profit: 7100 }, { month: "Dec", profit: 6800 },
      { month: "Jan", profit: 7500 }, { month: "Feb", profit: 7800 }, { month: "Mar", profit: 7100 },
    ],
  },
  {
    id: "2", name: "Sara Al-Mansour", alias: "COO", email: "sara@opshub.com", phone: "+966 50 234 5678",
    active: true, totalContributed: 95000, totalProfit: 38200, totalWithdrawn: 15000,
    monthlyProfit: [
      { month: "Oct", profit: 5800 }, { month: "Nov", profit: 6400 }, { month: "Dec", profit: 6100 },
      { month: "Jan", profit: 6900 }, { month: "Feb", profit: 7000 }, { month: "Mar", profit: 6000 },
    ],
  },
  {
    id: "3", name: "Omar Khalil", alias: "CFO", email: "omar@opshub.com", phone: "+966 50 345 6789",
    active: true, totalContributed: 80000, totalProfit: 31800, totalWithdrawn: 10000,
    monthlyProfit: [
      { month: "Oct", profit: 4800 }, { month: "Nov", profit: 5300 }, { month: "Dec", profit: 5100 },
      { month: "Jan", profit: 5700 }, { month: "Feb", profit: 5800 }, { month: "Mar", profit: 5100 },
    ],
  },
];

export default function FoundersPage() {
  const totalContributed = founders.reduce((s, f) => s + f.totalContributed, 0);
  const totalProfit = founders.reduce((s, f) => s + f.totalProfit, 0);
  const totalBalance = founders.reduce((s, f) => s + (f.totalProfit - f.totalWithdrawn), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Founders</h1>
          <p className="page-description">Founder profiles, contributions, and profit allocation</p>
        </div>
        <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Add Founder</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Contributed" value={`SAR ${(totalContributed / 1000).toFixed(0)}K`} change={`${founders.length} founders`} changeType="neutral" icon={Wallet} />
        <StatCard title="Total Profit Earned" value={`SAR ${(totalProfit / 1000).toFixed(1)}K`} change="+12% vs last quarter" changeType="positive" icon={TrendingUp} />
        <StatCard title="Available Balance" value={`SAR ${(totalBalance / 1000).toFixed(1)}K`} change="After withdrawals" changeType="neutral" icon={Users} />
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
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                <p className="text-muted-foreground">Contributed</p>
                <p className="font-bold mt-0.5">SAR {(f.totalContributed / 1000).toFixed(0)}K</p>
              </div>
              <div className="p-2.5 rounded-lg bg-success/5 text-center">
                <p className="text-muted-foreground">Profit</p>
                <p className="font-bold text-success mt-0.5">SAR {(f.totalProfit / 1000).toFixed(1)}K</p>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/5 text-center">
                <p className="text-muted-foreground">Balance</p>
                <p className="font-bold text-primary mt-0.5">SAR {((f.totalProfit - f.totalWithdrawn) / 1000).toFixed(1)}K</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Monthly Profit (6 months)</p>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={f.monthlyProfit}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                  <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t border-border">
              <span>Share: {((f.totalContributed / totalContributed) * 100).toFixed(1)}%</span>
              <Badge variant="default" className="bg-success/10 text-success border-0">Active</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
