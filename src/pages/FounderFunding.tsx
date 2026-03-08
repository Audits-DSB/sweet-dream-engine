import { useState } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Landmark, Plus, TrendingUp, Wallet, ArrowUpRight, ArrowDownLeft, Eye } from "lucide-react";
import { toast } from "sonner";
import { foundersList, ordersList } from "@/data/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialTransactions = [
  { id: "TXN-001", date: "2025-03-05", founder: "أحمد الراشد", type: "مساهمة", amount: 150000, method: "تحويل بنكي", order: "—", notes: "ضخ رأسمال شهري", balance: 1250000 },
  { id: "TXN-002", date: "2025-03-05", founder: "سارة المنصور", type: "مساهمة", amount: 100000, method: "تحويل بنكي", order: "—", notes: "ضخ رأسمال شهري", balance: 950000 },
  { id: "TXN-003", date: "2025-03-04", founder: "أحمد الراشد", type: "تمويل", amount: 85000, method: "من الصندوق", order: "ORD-047", notes: "طلب مركز نور (50% حصة)", balance: 1100000 },
  { id: "TXN-004", date: "2025-03-04", founder: "سارة المنصور", type: "تمويل", amount: 42500, method: "من الصندوق", order: "ORD-047", notes: "طلب مركز نور (25%)", balance: 850000 },
  { id: "TXN-005", date: "2025-03-04", founder: "عمر خليل", type: "تمويل", amount: 42500, method: "من الصندوق", order: "ORD-047", notes: "طلب مركز نور (25%)", balance: 757500 },
  { id: "TXN-006", date: "2025-03-01", founder: "أحمد الراشد", type: "سحب", amount: 100000, method: "تحويل بنكي", order: "—", notes: "سحب أرباح", balance: 1185000 },
  { id: "TXN-007", date: "2025-02-28", founder: "عمر خليل", type: "مساهمة", amount: 120000, method: "كاش", order: "—", notes: "زيادة رأسمال", balance: 800000 },
];

const typeStyles: Record<string, { icon: typeof ArrowUpRight; color: string }> = {
  "مساهمة": { icon: ArrowUpRight, color: "text-success" },
  "تمويل": { icon: ArrowDownLeft, color: "text-info" },
  "سحب": { icon: ArrowDownLeft, color: "text-warning" },
};

export default function FounderFundingPage() {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<typeof initialTransactions[0] | null>(null);
  const [selectedFounder, setSelectedFounder] = useState("");
  const [txnType, setTxnType] = useState("مساهمة");
  const [txnAmount, setTxnAmount] = useState("");
  const [txnMethod, setTxnMethod] = useState("تحويل بنكي");
  const [txnOrder, setTxnOrder] = useState("");
  const [txnNotes, setTxnNotes] = useState("");

  const founders = [...new Set(transactions.map(t => t.founder))];

  const filtered = transactions.filter((t) => {
    const matchSearch = !search || t.founder.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase()) || t.notes.toLowerCase().includes(search.toLowerCase());
    const matchType = !filters.type || filters.type === "all" || t.type === filters.type;
    const matchFounder = !filters.founder || filters.founder === "all" || t.founder === filters.founder;
    return matchSearch && matchType && matchFounder;
  });

  const totalContributions = transactions.filter(t => t.type === "مساهمة").reduce((s, t) => s + t.amount, 0);
  const totalFunding = transactions.filter(t => t.type === "تمويل").reduce((s, t) => s + t.amount, 0);
  const totalWithdrawals = transactions.filter(t => t.type === "سحب").reduce((s, t) => s + t.amount, 0);

  const handleAdd = () => {
    if (!selectedFounder || !txnAmount) { toast.error("يرجى اختيار المؤسس وإدخال المبلغ"); return; }
    const founder = foundersList.find(f => f.id === selectedFounder);
    if (!founder) return;
    const num = transactions.length + 1;
    const newId = `TXN-${String(num).padStart(3, "0")}`;
    const today = new Date().toISOString().split("T")[0];
    setTransactions([{
      id: newId, date: today, founder: founder.name, type: txnType, amount: Number(txnAmount),
      method: txnMethod, order: txnType === "تمويل" ? txnOrder || "—" : "—", notes: txnNotes, balance: 0,
    }, ...transactions]);
    setSelectedFounder(""); setTxnType("مساهمة"); setTxnAmount(""); setTxnMethod("تحويل بنكي"); setTxnOrder(""); setTxnNotes("");
    setDialogOpen(false);
    toast.success("تم تسجيل المعاملة بنجاح");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">تمويل المؤسسين</h1>
          <p className="page-description">تتبع مساهمات رأسمال المؤسسين وتمويل الطلبات والسحوبات</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />تسجيل معاملة</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="إجمالي المساهمات" value={`${(totalContributions / 1000).toFixed(0)} ألف ج.م`} change={`${transactions.filter(t => t.type === "مساهمة").length} معاملة`} changeType="positive" icon={Wallet} />
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
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetailItem(t)}>
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

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{detailItem?.id} — {detailItem?.founder}</DialogTitle></DialogHeader>
          {detailItem && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">النوع</p><p className="font-semibold">{detailItem.type}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">المبلغ</p><p className="font-semibold">{detailItem.amount.toLocaleString()} ج.م</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">الطريقة</p><p className="font-semibold">{detailItem.method}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">التاريخ</p><p className="font-semibold">{detailItem.date}</p></div>
              </div>
              {detailItem.order !== "—" && (
                <div className="p-3 rounded-lg bg-info/10 text-info text-sm">الطلب المرتبط: {detailItem.order}</div>
              )}
              {detailItem.notes && <p className="text-sm text-muted-foreground">{detailItem.notes}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Transaction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>تسجيل معاملة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">المؤسس *</Label>
              <Select value={selectedFounder} onValueChange={setSelectedFounder}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="اختر المؤسس..." /></SelectTrigger>
                <SelectContent>
                  {foundersList.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name} — {f.alias}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">نوع المعاملة</Label>
                <Select value={txnType} onValueChange={setTxnType}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="مساهمة">مساهمة</SelectItem>
                    <SelectItem value="تمويل">تمويل طلب</SelectItem>
                    <SelectItem value="سحب">سحب</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">المبلغ *</Label><Input className="h-9 mt-1" type="number" value={txnAmount} onChange={(e) => setTxnAmount(e.target.value)} /></div>
            </div>
            <div>
              <Label className="text-xs">طريقة الدفع</Label>
              <Select value={txnMethod} onValueChange={setTxnMethod}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                  <SelectItem value="كاش">كاش</SelectItem>
                  <SelectItem value="من الصندوق">من الصندوق</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {txnType === "تمويل" && (
              <div>
                <Label className="text-xs">الطلب المرتبط</Label>
                <Select value={txnOrder} onValueChange={setTxnOrder}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="اختر الطلب..." /></SelectTrigger>
                  <SelectContent>
                    {ordersList.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.id} — {o.client}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label className="text-xs">ملاحظات</Label><Input className="h-9 mt-1" value={txnNotes} onChange={(e) => setTxnNotes(e.target.value)} /></div>
            <Button className="w-full" onClick={handleAdd}>تسجيل المعاملة</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
