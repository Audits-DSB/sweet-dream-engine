import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Landmark, Plus, TrendingUp, Wallet, ArrowUpRight, ArrowDownLeft } from "lucide-react";

const mockTransactions = [
  { id: "TXN-001", date: "2025-03-05", founder: "Ahmed Al-Rashid", type: "Contribution", amount: 15000, method: "Bank Transfer", order: "—", notes: "Monthly capital injection", balance: 125000 },
  { id: "TXN-002", date: "2025-03-05", founder: "Sara Al-Mansour", type: "Contribution", amount: 10000, method: "Bank Transfer", order: "—", notes: "Monthly capital injection", balance: 95000 },
  { id: "TXN-003", date: "2025-03-04", founder: "Ahmed Al-Rashid", type: "Funding", amount: 8500, method: "From Pool", order: "ORD-047", notes: "Noor Restaurant order (50% share)", balance: 110000 },
  { id: "TXN-004", date: "2025-03-04", founder: "Sara Al-Mansour", type: "Funding", amount: 4250, method: "From Pool", order: "ORD-047", notes: "Noor Restaurant order (25%)", balance: 85000 },
  { id: "TXN-005", date: "2025-03-04", founder: "Omar Khalil", type: "Funding", amount: 4250, method: "From Pool", order: "ORD-047", notes: "Noor Restaurant order (25%)", balance: 75750 },
  { id: "TXN-006", date: "2025-03-01", founder: "Ahmed Al-Rashid", type: "Withdrawal", amount: 10000, method: "Bank Transfer", order: "—", notes: "Profit withdrawal", balance: 118500 },
  { id: "TXN-007", date: "2025-02-28", founder: "Omar Khalil", type: "Contribution", amount: 12000, method: "Cash", order: "—", notes: "Capital top-up", balance: 80000 },
  { id: "TXN-008", date: "2025-02-25", founder: "Ahmed Al-Rashid", type: "Funding", amount: 3200, method: "From Pool", order: "ORD-048", notes: "Al Salam order (Equal split)", balance: 128500 },
  { id: "TXN-009", date: "2025-02-25", founder: "Sara Al-Mansour", type: "Funding", amount: 3200, method: "From Pool", order: "ORD-048", notes: "Al Salam order (Equal split)", balance: 89250 },
  { id: "TXN-010", date: "2025-02-25", founder: "Omar Khalil", type: "Funding", amount: 3200, method: "From Pool", order: "ORD-048", notes: "Al Salam order (Equal split)", balance: 68000 },
  { id: "TXN-011", date: "2025-02-20", founder: "Sara Al-Mansour", type: "Withdrawal", amount: 5000, method: "Bank Transfer", order: "—", notes: "Profit withdrawal", balance: 92450 },
];

const typeStyles: Record<string, { icon: typeof ArrowUpRight; color: string }> = {
  "Contribution": { icon: ArrowUpRight, color: "text-success" },
  "Funding": { icon: ArrowDownLeft, color: "text-info" },
  "Withdrawal": { icon: ArrowDownLeft, color: "text-warning" },
};

export default function FounderFundingPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const founders = [...new Set(mockTransactions.map(t => t.founder))];

  const filtered = mockTransactions.filter((t) => {
    const matchSearch = !search || t.founder.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase()) || t.notes.toLowerCase().includes(search.toLowerCase());
    const matchType = !filters.type || filters.type === "all" || t.type === filters.type;
    const matchFounder = !filters.founder || filters.founder === "all" || t.founder === filters.founder;
    return matchSearch && matchType && matchFounder;
  });

  const totalContributions = mockTransactions.filter(t => t.type === "Contribution").reduce((s, t) => s + t.amount, 0);
  const totalFunding = mockTransactions.filter(t => t.type === "Funding").reduce((s, t) => s + t.amount, 0);
  const totalWithdrawals = mockTransactions.filter(t => t.type === "Withdrawal").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Founder Funding</h1>
          <p className="page-description">Track founder capital contributions, order funding, and withdrawals</p>
        </div>
        <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Record Transaction</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Contributions" value={`SAR ${(totalContributions / 1000).toFixed(0)}K`} change={`${mockTransactions.filter(t => t.type === "Contribution").length} transactions`} changeType="positive" icon={Wallet} />
        <StatCard title="Order Funding" value={`SAR ${(totalFunding / 1000).toFixed(1)}K`} change="Deployed to orders" changeType="neutral" icon={Landmark} />
        <StatCard title="Withdrawals" value={`SAR ${(totalWithdrawals / 1000).toFixed(0)}K`} change="Profit taken" changeType="neutral" icon={TrendingUp} />
      </div>

      <DataToolbar
        searchPlaceholder="Search transactions..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "Type", value: "type", options: [
            { label: "Contribution", value: "Contribution" },
            { label: "Funding", value: "Funding" },
            { label: "Withdrawal", value: "Withdrawal" },
          ]},
          { label: "Founder", value: "founder", options: founders.map(f => ({ label: f, value: f })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => {}}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">ID</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Founder</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Type</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Amount</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Method</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Order</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Notes</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Balance</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const style = typeStyles[t.type];
              const Icon = style?.icon || ArrowUpRight;
              return (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3 font-mono text-xs">{t.id}</td>
                  <td className="py-3 px-3 text-muted-foreground">{t.date}</td>
                  <td className="py-3 px-3 font-medium">{t.founder}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${style?.color}`}>
                      <Icon className="h-3 w-3" />{t.type}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold">
                    <span className={style?.color}>
                      {t.type === "Contribution" ? "+" : t.type === "Withdrawal" ? "−" : "−"}SAR {t.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-muted-foreground">{t.method}</td>
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{t.order}</td>
                  <td className="py-3 px-3 text-xs text-muted-foreground max-w-[200px] truncate">{t.notes}</td>
                  <td className="py-3 px-3 text-right font-medium">SAR {t.balance.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
