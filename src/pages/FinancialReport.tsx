import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { FileBarChart, DollarSign, TrendingUp, TrendingDown, Wallet, Users, ArrowRightLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToCsv } from "@/lib/exportCsv";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area, Legend } from "recharts";

// Mock profit data (same as CompanyProfit)
const monthlyPnL = [
  { month: "Oct", revenue: 380000, cost: 240000, profit: 140000, companyShare: 21000, founderShare: 119000 },
  { month: "Nov", revenue: 420000, cost: 270000, profit: 150000, companyShare: 22500, founderShare: 127500 },
  { month: "Dec", revenue: 390000, cost: 255000, profit: 135000, companyShare: 20250, founderShare: 114750 },
  { month: "Jan", revenue: 480000, cost: 300000, profit: 180000, companyShare: 27000, founderShare: 153000 },
  { month: "Feb", revenue: 520000, cost: 320000, profit: 200000, companyShare: 30000, founderShare: 170000 },
  { month: "Mar", revenue: 460000, cost: 290000, profit: 170000, companyShare: 25500, founderShare: 144500 },
];

// Mock founder data
const founderDistributions = [
  { name: "أحمد الراشد", share: 50, totalDistributed: 475000, balance: 1250000 },
  { name: "سارة المنصور", share: 25, totalDistributed: 237500, balance: 950000 },
  { name: "عمر خليل", share: 25, totalDistributed: 237500, balance: 757500 },
];

// Mock collections summary
const collectionsSummary = {
  totalInvoiced: 319000,
  totalCollected: 138000,
  totalOutstanding: 181000,
  overdueAmount: 72000,
};

const COLORS = ["hsl(200, 70%, 45%)", "hsl(150, 55%, 45%)", "hsl(38, 90%, 50%)", "hsl(280, 55%, 55%)", "hsl(0, 65%, 55%)"];

type TreasuryAccount = { id: string; name: string; account_type: string; custodian_name: string; balance: number };
type TreasuryTx = { id: string; tx_type: string; amount: number; category: string | null; created_at: string };

export default function FinancialReportPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [txs, setTxs] = useState<TreasuryTx[]>([]);
  const [period, setPeriod] = useState("6m");

  useEffect(() => {
    Promise.all([
      supabase.from("treasury_accounts").select("id, name, account_type, custodian_name, balance").eq("is_active", true),
      supabase.from("treasury_transactions").select("id, tx_type, amount, category, created_at").order("created_at", { ascending: false }).limit(100),
    ]).then(([accRes, txRes]) => {
      if (accRes.data) setAccounts(accRes.data as TreasuryAccount[]);
      if (txRes.data) setTxs(txRes.data as TreasuryTx[]);
    });
  }, []);

  const fmtMoney = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");
  const treasuryBalance = useMemo(() => accounts.reduce((s, a) => s + Number(a.balance), 0), [accounts]);
  const treasuryInflows = useMemo(() => txs.filter(t => t.tx_type === "inflow").reduce((s, t) => s + Number(t.amount), 0), [txs]);
  const treasuryExpenses = useMemo(() => txs.filter(t => t.tx_type === "expense" || t.tx_type === "withdrawal").reduce((s, t) => s + Number(t.amount), 0), [txs]);

  const totalRevenue = monthlyPnL.reduce((s, m) => s + m.revenue, 0);
  const totalProfit = monthlyPnL.reduce((s, m) => s + m.profit, 0);
  const totalCompanyShare = monthlyPnL.reduce((s, m) => s + m.companyShare, 0);
  const totalFounderShare = monthlyPnL.reduce((s, m) => s + m.founderShare, 0);

  const founderPieData = founderDistributions.map(f => ({ name: f.name, value: f.totalDistributed }));

  const expenseByCat = useMemo(() => {
    const map: Record<string, number> = {};
    txs.filter(tx => tx.tx_type === "expense" || tx.tx_type === "withdrawal").forEach(tx => {
      const cat = tx.category ? (t[("treasury_cat_" + tx.category) as keyof typeof t] as string || tx.category) : t.treasury_cat_other;
      map[cat] = (map[cat] || 0) + Number(tx.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [txs, t]);

  const handleExport = () => {
    const rows = [
      [t.finReportRevenue, fmtMoney(totalRevenue)],
      [t.finReportProfit, fmtMoney(totalProfit)],
      [t.companyShare, fmtMoney(totalCompanyShare)],
      [t.finReportFounderDist, fmtMoney(totalFounderShare)],
      [t.treasuryTotalBalance, fmtMoney(treasuryBalance)],
      [t.treasuryInflows, fmtMoney(treasuryInflows)],
      [t.treasuryOutflows, fmtMoney(treasuryExpenses)],
      [t.totalCollected, `${fmtMoney(collectionsSummary.totalCollected)}`],
      [t.outstandingAmount, `${fmtMoney(collectionsSummary.totalOutstanding)}`],
    ];
    exportToCsv("financial_report", [t.finReportMetric, t.amount], rows);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileBarChart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="page-header">{t.finReportTitle}</h1>
            <p className="page-description">{t.finReportDesc}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">{t.finReport3m}</SelectItem>
              <SelectItem value="6m">{t.finReport6m}</SelectItem>
              <SelectItem value="1y">{t.finReport1y}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 me-1" />{t.export}</Button>
        </div>
      </div>

      {/* Top Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="stat-card text-center cursor-pointer" onClick={() => navigate("/company-profit")}>
          <DollarSign className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-[10px] text-muted-foreground">{t.totalRevenue}</p>
          <p className="text-lg font-bold">{(totalRevenue / 1000).toFixed(0)}<span className="text-[10px] font-normal text-muted-foreground ms-0.5">{t.thousand}</span></p>
        </div>
        <div className="stat-card text-center cursor-pointer" onClick={() => navigate("/company-profit")}>
          <TrendingUp className="h-5 w-5 mx-auto text-success mb-1" />
          <p className="text-[10px] text-muted-foreground">{t.finReportProfit}</p>
          <p className="text-lg font-bold text-success">{(totalProfit / 1000).toFixed(0)}<span className="text-[10px] font-normal text-muted-foreground ms-0.5">{t.thousand}</span></p>
        </div>
        <div className="stat-card text-center cursor-pointer" onClick={() => navigate("/treasury")}>
          <Wallet className="h-5 w-5 mx-auto text-info mb-1" />
          <p className="text-[10px] text-muted-foreground">{t.treasuryTotalBalance}</p>
          <p className="text-lg font-bold">{fmtMoney(treasuryBalance)}<span className="text-[10px] font-normal text-muted-foreground ms-0.5">{t.egp}</span></p>
        </div>
        <div className="stat-card text-center cursor-pointer" onClick={() => navigate("/collections")}>
          <TrendingUp className="h-5 w-5 mx-auto text-success mb-1" />
          <p className="text-[10px] text-muted-foreground">{t.totalCollected}</p>
          <p className="text-lg font-bold text-success">{(collectionsSummary.totalCollected / 1000).toFixed(0)}<span className="text-[10px] font-normal text-muted-foreground ms-0.5">{t.thousand}</span></p>
        </div>
        <div className="stat-card text-center cursor-pointer" onClick={() => navigate("/collections")}>
          <TrendingDown className="h-5 w-5 mx-auto text-destructive mb-1" />
          <p className="text-[10px] text-muted-foreground">{t.outstandingAmount}</p>
          <p className="text-lg font-bold text-destructive">{(collectionsSummary.totalOutstanding / 1000).toFixed(0)}<span className="text-[10px] font-normal text-muted-foreground ms-0.5">{t.thousand}</span></p>
        </div>
        <div className="stat-card text-center cursor-pointer" onClick={() => navigate("/founder-funding")}>
          <Users className="h-5 w-5 mx-auto text-warning mb-1" />
          <p className="text-[10px] text-muted-foreground">{t.finReportFounderDist}</p>
          <p className="text-lg font-bold">{(totalFounderShare / 1000).toFixed(0)}<span className="text-[10px] font-normal text-muted-foreground ms-0.5">{t.thousand}</span></p>
        </div>
      </div>

      {/* Revenue vs Profit Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-3">{t.finReportRevVsProfit}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={monthlyPnL}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${fmtMoney(v)} ${t.egp}`} />
              <Legend />
              <Area type="monotone" dataKey="revenue" name={t.revenue} fill="hsl(200, 70%, 45%)" fillOpacity={0.15} stroke="hsl(200, 70%, 45%)" strokeWidth={2} />
              <Area type="monotone" dataKey="profit" name={t.profit} fill="hsl(150, 55%, 45%)" fillOpacity={0.15} stroke="hsl(150, 55%, 45%)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Company vs Founder Split */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-3">{t.finReportProfitSplit}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyPnL}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${fmtMoney(v)} ${t.egp}`} />
              <Legend />
              <Bar dataKey="companyShare" name={t.companyShare} fill="hsl(200, 70%, 45%)" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="founderShare" name={t.finReportFounderDist} fill="hsl(38, 90%, 50%)" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Treasury + Founder Distribution Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Treasury Accounts */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t.treasuryAccounts}</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate("/treasury")}>{t.viewAll}</Button>
          </div>
          {accounts.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">{t.treasuryNoAccounts}</p>
          ) : (
            <div className="space-y-2">
              {accounts.map(a => (
                <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/treasury/accounts")}>
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground">{a.custodian_name}</p>
                  </div>
                  <p className="text-sm font-semibold">{fmtMoney(Number(a.balance))} {t.egp}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Founder Distributions */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t.finReportFounderDist}</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate("/founder-funding")}>{t.viewAll}</Button>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={founderPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={60} label={({ name, percent }) => `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`}>
                {founderPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `${fmtMoney(v)} ${t.egp}`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {founderDistributions.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />
                  <span>{f.name}</span>
                  <span className="text-muted-foreground">({f.share}%)</span>
                </div>
                <span className="font-medium">{fmtMoney(f.totalDistributed)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expense Categories */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-3">{t.treasuryByCategory}</h3>
          {expenseByCat.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">{t.treasuryNoTx}</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={expenseByCat} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {expenseByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${fmtMoney(v)} ${t.egp}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Collections Summary */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">{t.finReportCollections}</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate("/collections")}>{t.viewAll}</Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 text-center">
            <p className="text-[10px] text-muted-foreground">{t.finReportTotalInvoiced}</p>
            <p className="text-lg font-bold">{fmtMoney(collectionsSummary.totalInvoiced)}</p>
          </div>
          <div className="p-3 rounded-lg bg-success/10 text-center">
            <p className="text-[10px] text-muted-foreground">{t.totalCollected}</p>
            <p className="text-lg font-bold text-success">{fmtMoney(collectionsSummary.totalCollected)}</p>
          </div>
          <div className="p-3 rounded-lg bg-warning/10 text-center">
            <p className="text-[10px] text-muted-foreground">{t.outstandingAmount}</p>
            <p className="text-lg font-bold text-warning">{fmtMoney(collectionsSummary.totalOutstanding)}</p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/10 text-center">
            <p className="text-[10px] text-muted-foreground">{t.overdueAmount}</p>
            <p className="text-lg font-bold text-destructive">{fmtMoney(collectionsSummary.overdueAmount)}</p>
          </div>
        </div>
        {/* Collection rate bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">{t.finReportCollectionRate}</span>
            <span className="font-medium">{((collectionsSummary.totalCollected / collectionsSummary.totalInvoiced) * 100).toFixed(0)}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(collectionsSummary.totalCollected / collectionsSummary.totalInvoiced) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
