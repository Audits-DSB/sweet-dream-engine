import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { Users, Loader2, ArrowLeft, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type ClientData = {
  id: string; name: string; contact: string; status: string;
  joinDate: string; outstanding: number;
};

export default function ClientComparison() {
  const { t, lang, dir } = useLanguage();
  const isEn = lang === "en";
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [client1Id, setClient1Id] = useState("");
  const [client2Id, setClient2Id] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<any[]>("/clients").catch(() => []),
      api.get<any[]>("/orders").catch(() => []),
      api.get<any[]>("/collections").catch(() => []),
      api.get<any[]>("/client-inventory").catch(() => []),
    ]).then(([c, o, col, inv]) => {
      setClients((c || []).filter((x: any) => x.name !== "company-inventory").map((x: any) => ({
        id: x.id, name: x.name || "", contact: x.contact || "", status: x.status || "",
        joinDate: x.joinDate || x.join_date || "", outstanding: Number(x.outstanding || 0),
      })));
      setOrders((o || []).filter((x: any) => (x.client || "") !== "company-inventory").map((x: any) => ({
        id: x.id, clientId: x.clientId || x.client_id || "", date: x.date || "",
        totalSelling: Number(x.totalSelling ?? x.total_selling ?? 0), status: x.status || "",
      })));
      setCollections((col || []).map((x: any) => ({
        clientId: x.clientId || x.client_id || "",
        totalAmount: Number(x.totalAmount ?? x.total_amount ?? 0),
        paidAmount: Number(x.paidAmount ?? x.paid_amount ?? 0),
      })));
      setInventory((inv || []).filter((x: any) => x.status !== "Expired" && x.status !== "Returned").map((x: any) => ({
        clientId: x.clientId || x.client_id || "",
        remaining: Number(x.remaining || 0),
        sellingPrice: Number(x.sellingPrice || x.selling_price || 0),
      })));
    }).finally(() => setLoading(false));
  }, []);

  const cur = (v: number) => `${v.toLocaleString()} ${isEn ? "EGP" : "ج.م"}`;

  function getMetrics(cid: string) {
    const cOrders = orders.filter(o => o.clientId === cid);
    const cCol = collections.filter(c => c.clientId === cid);
    const cInv = inventory.filter(i => i.clientId === cid);
    const totalOrders = cOrders.length;
    const totalRevenue = cOrders.reduce((s, o) => s + o.totalSelling, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalCollAmt = cCol.reduce((s, c) => s + c.totalAmount, 0);
    const totalPaid = cCol.reduce((s, c) => s + c.paidAmount, 0);
    const collectionRate = totalCollAmt > 0 ? (totalPaid / totalCollAmt) * 100 : 0;
    const outstanding = clients.find(c => c.id === cid)?.outstanding || 0;
    const inventoryValue = cInv.reduce((s, i) => s + i.remaining * i.sellingPrice, 0);
    const lastOrder = cOrders.length > 0 ? [...cOrders].sort((a, b) => b.date.localeCompare(a.date))[0].date : "—";
    const joinDate = clients.find(c => c.id === cid)?.joinDate || "—";
    return { totalOrders, totalRevenue, avgOrderValue, collectionRate, outstanding, inventoryValue, lastOrder, joinDate };
  }

  const c1 = client1Id ? getMetrics(client1Id) : null;
  const c2 = client2Id ? getMetrics(client2Id) : null;
  const c1Name = clients.find(c => c.id === client1Id)?.name || "";
  const c2Name = clients.find(c => c.id === client2Id)?.name || "";

  const rows = useMemo(() => {
    if (!c1 || !c2) return [];
    return [
      { label: t.compTotalOrders, v1: String(c1.totalOrders), v2: String(c2.totalOrders), better: c1.totalOrders > c2.totalOrders ? 1 : c2.totalOrders > c1.totalOrders ? 2 : 0 },
      { label: t.compTotalRevenue, v1: cur(c1.totalRevenue), v2: cur(c2.totalRevenue), better: c1.totalRevenue > c2.totalRevenue ? 1 : c2.totalRevenue > c1.totalRevenue ? 2 : 0 },
      { label: t.compAvgOrderValue, v1: cur(Math.round(c1.avgOrderValue)), v2: cur(Math.round(c2.avgOrderValue)), better: c1.avgOrderValue > c2.avgOrderValue ? 1 : c2.avgOrderValue > c1.avgOrderValue ? 2 : 0 },
      { label: t.compCollectionRate, v1: `${c1.collectionRate.toFixed(1)}%`, v2: `${c2.collectionRate.toFixed(1)}%`, better: c1.collectionRate > c2.collectionRate ? 1 : c2.collectionRate > c1.collectionRate ? 2 : 0 },
      { label: t.compOutstanding, v1: cur(c1.outstanding), v2: cur(c2.outstanding), better: c1.outstanding < c2.outstanding ? 1 : c2.outstanding < c1.outstanding ? 2 : 0 },
      { label: t.compInventoryValue, v1: cur(c1.inventoryValue), v2: cur(c2.inventoryValue), better: c1.inventoryValue > c2.inventoryValue ? 1 : c2.inventoryValue > c1.inventoryValue ? 2 : 0 },
      { label: t.compLastOrder, v1: c1.lastOrder, v2: c2.lastOrder, better: c1.lastOrder > c2.lastOrder ? 1 : c2.lastOrder > c1.lastOrder ? 2 : 0 },
      { label: t.compJoinDate, v1: c1.joinDate, v2: c2.joinDate, better: 0 },
    ];
  }, [c1, c2, t]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in" dir={dir}>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/clients")}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="page-header flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> {t.clientComparison}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="stat-card">
          <label className="text-xs text-muted-foreground font-medium mb-2 block">{t.compClient1}</label>
          <select value={client1Id} onChange={e => setClient1Id(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">{t.selectClient}</option>
            {clients.filter(c => c.id !== client2Id).map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
          </select>
        </div>
        <div className="stat-card">
          <label className="text-xs text-muted-foreground font-medium mb-2 block">{t.compClient2}</label>
          <select value={client2Id} onChange={e => setClient2Id(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">{t.selectClient}</option>
            {clients.filter(c => c.id !== client1Id).map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
          </select>
        </div>
      </div>

      {c1 && c2 ? (
        <div className="stat-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-start py-3 px-4 text-muted-foreground font-semibold">{t.compMetric}</th>
                <th className="text-center py-3 px-4 font-semibold text-blue-600">{c1Name}</th>
                <th className="text-center py-3 px-4 font-semibold text-orange-600">{c2Name}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="py-3 px-4 font-medium">{r.label}</td>
                  <td className={`py-3 px-4 text-center font-semibold ${r.better === 1 ? "text-emerald-600" : ""}`}>
                    {r.v1} {r.better === 1 && <Trophy className="inline h-3.5 w-3.5 text-amber-500 ms-1" />}
                  </td>
                  <td className={`py-3 px-4 text-center font-semibold ${r.better === 2 ? "text-emerald-600" : ""}`}>
                    {r.v2} {r.better === 2 && <Trophy className="inline h-3.5 w-3.5 text-amber-500 ms-1" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="stat-card py-12 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{t.compSelectTwo}</p>
        </div>
      )}
    </div>
  );
}
