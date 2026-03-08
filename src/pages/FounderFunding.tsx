import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Landmark, Plus, TrendingUp, Wallet, ArrowUpRight, ArrowDownLeft } from "lucide-react";

const mockTransactions = [
  { id: "TXN-001", date: "2025-03-05", founder: "أحمد الراشد", type: "مساهمة", amount: 150000, method: "تحويل بنكي", order: "—", notes: "ضخ رأسمال شهري", balance: 1250000 },
  { id: "TXN-002", date: "2025-03-05", founder: "سارة المنصور", type: "مساهمة", amount: 100000, method: "تحويل بنكي", order: "—", notes: "ضخ رأسمال شهري", balance: 950000 },
  { id: "TXN-003", date: "2025-03-04", founder: "أحمد الراشد", type: "تمويل", amount: 85000, method: "من الصندوق", order: "ORD-047", notes: "طلب مركز نور (50% حصة)", balance: 1100000 },
  { id: "TXN-004", date: "2025-03-04", founder: "سارة المنصور", type: "تمويل", amount: 42500, method: "من الصندوق", order: "ORD-047", notes: "طلب مركز نور (25%)", balance: 850000 },
  { id: "TXN-005", date: "2025-03-04", founder: "عمر خليل", type: "تمويل", amount: 42500, method: "من الصندوق", order: "ORD-047", notes: "طلب مركز نور (25%)", balance: 757500 },
  { id: "TXN-006", date: "2025-03-01", founder: "أحمد الراشد", type: "سحب", amount: 100000, method: "تحويل بنكي", order: "—", notes: "سحب أرباح", balance: 1185000 },
  { id: "TXN-007", date: "2025-02-28", founder: "عمر خليل", type: "مساهمة", amount: 120000, method: "كاش", order: "—", notes: "زيادة رأسمال", balance: 800000 },
  { id: "TXN-008", date: "2025-02-25", founder: "أحمد الراشد", type: "تمويل", amount: 32000, method: "من الصندوق", order: "ORD-048", notes: "طلب د. أحمد (تقسيم متساوي)", balance: 1285000 },
  { id: "TXN-009", date: "2025-02-25", founder: "سارة المنصور", type: "تمويل", amount: 32000, method: "من الصندوق", order: "ORD-048", notes: "طلب د. أحمد (تقسيم متساوي)", balance: 892500 },
  { id: "TXN-010", date: "2025-02-25", founder: "عمر خليل", type: "تمويل", amount: 32000, method: "من الصندوق", order: "ORD-048", notes: "طلب د. أحمد (تقسيم متساوي)", balance: 680000 },
  { id: "TXN-011", date: "2025-02-20", founder: "سارة المنصور", type: "سحب", amount: 50000, method: "تحويل بنكي", order: "—", notes: "سحب أرباح", balance: 924500 },
];

const typeStyles: Record<string, { icon: typeof ArrowUpRight; color: string }> = {
  "مساهمة": { icon: ArrowUpRight, color: "text-success" },
  "تمويل": { icon: ArrowDownLeft, color: "text-info" },
  "سحب": { icon: ArrowDownLeft, color: "text-warning" },
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

  const totalContributions = mockTransactions.filter(t => t.type === "مساهمة").reduce((s, t) => s + t.amount, 0);
  const totalFunding = mockTransactions.filter(t => t.type === "تمويل").reduce((s, t) => s + t.amount, 0);
  const totalWithdrawals = mockTransactions.filter(t => t.type === "سحب").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">تمويل المؤسسين</h1>
          <p className="page-description">تتبع مساهمات رأسمال المؤسسين وتمويل الطلبات والسحوبات</p>
        </div>
        <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />تسجيل معاملة</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="إجمالي المساهمات" value={`${(totalContributions / 1000).toFixed(0)} ألف ج.م`} change={`${mockTransactions.filter(t => t.type === "مساهمة").length} معاملة`} changeType="positive" icon={Wallet} />
        <StatCard title="تمويل الطلبات" value={`${(totalFunding / 1000).toFixed(1)} ألف ج.م`} change="تم توزيعها على الطلبات" changeType="neutral" icon={Landmark} />
        <StatCard title="السحوبات" value={`${(totalWithdrawals / 1000).toFixed(0)} ألف ج.م`} change="أرباح مسحوبة" changeType="neutral" icon={TrendingUp} />
      </div>

      <DataToolbar
        searchPlaceholder="بحث في المعاملات..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { label: "النوع", value: "type", options: [
            { label: "مساهمة", value: "مساهمة" },
            { label: "تمويل", value: "تمويل" },
            { label: "سحب", value: "سحب" },
          ]},
          { label: "المؤسس", value: "founder", options: founders.map(f => ({ label: f, value: f })) },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("founder_funding", ["الكود","التاريخ","المؤسس","النوع","المبلغ","الطريقة","الطلب","ملاحظات","الرصيد"], filtered.map(t => [t.id, t.date, t.founder, t.type, t.amount, t.method, t.order, t.notes, t.balance]))}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">الكود</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">التاريخ</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">المؤسس</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">النوع</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">المبلغ</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">الطريقة</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">الطلب</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">ملاحظات</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">الرصيد</th>
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
                      {t.type === "مساهمة" ? "+" : "−"}{t.amount.toLocaleString()} ج.م
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-muted-foreground">{t.method}</td>
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{t.order}</td>
                  <td className="py-3 px-3 text-xs text-muted-foreground max-w-[200px] truncate">{t.notes}</td>
                  <td className="py-3 px-3 text-right font-medium">{t.balance.toLocaleString()} ج.م</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
