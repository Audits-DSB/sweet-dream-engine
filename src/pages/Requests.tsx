import { useState, useEffect } from "react";
import { DataToolbar } from "@/components/DataToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Eye, MoreHorizontal, CheckCircle, XCircle, ArrowRight, X, Search, Package } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clientsList } from "@/data/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type FetchedMaterial = {
  code: string;
  name: string;
  sellingPrice: number;
  image_url?: string | null;
};

type RequestItem = {
  materialCode: string;
  materialName: string;
  qty: number;
  unitPrice: number;
};

type Request = {
  id: string;
  client: string;
  clientId: string;
  date: string;
  items: RequestItem[];
  expectedTotal: string;
  status: string;
  notes: string;
};

const initialRequests: Request[] = [
  { id: "REQ-001", client: "عيادة د. أحمد", clientId: "C001", date: "2025-03-06", items: [{ materialCode: "MAT-1", materialName: "Composite A2", qty: 2, unitPrice: 8000 }, { materialCode: "MAT-2", materialName: "Bonding Agent", qty: 2, unitPrice: 8000 }], expectedTotal: "32,000", status: "Client Requested", notes: "عاجل - المخزون ينفذ" },
  { id: "REQ-002", client: "مركز نور لطب الأسنان", clientId: "C002", date: "2025-03-05", items: [{ materialCode: "MAT-3", materialName: "Alginate", qty: 7, unitPrice: 12143 }], expectedTotal: "85,000", status: "Pending Review", notes: "" },
  { id: "REQ-003", client: "عيادة جرين فالي", clientId: "C003", date: "2025-03-04", items: [{ materialCode: "MAT-4", materialName: "Endo File", qty: 3, unitPrice: 7000 }], expectedTotal: "21,000", status: "Approved", notes: "إعادة تخزين شهرية" },
  { id: "REQ-004", client: "المركز الملكي للأسنان", clientId: "C004", date: "2025-03-03", items: [{ materialCode: "MAT-5", materialName: "Ceramic Block", qty: 5, unitPrice: 9600 }], expectedTotal: "48,000", status: "Converted to Order", notes: "" },
  { id: "REQ-005", client: "عيادة سمايل هاوس", clientId: "C005", date: "2025-03-02", items: [{ materialCode: "MAT-6", materialName: "Impression Tray", qty: 2, unitPrice: 6000 }], expectedTotal: "12,000", status: "Rejected", notes: "العميل غير نشط" },
];

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>(initialRequests);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailReq, setDetailReq] = useState<Request | null>(null);
  const [form, setForm] = useState({ clientId: "", notes: "" });
  const [selectedItems, setSelectedItems] = useState<RequestItem[]>([]);
  const [materials, setMaterials] = useState<FetchedMaterial[]>([]);
  const [matSearch, setMatSearch] = useState("");
  const [loadingMats, setLoadingMats] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const fetchMaterials = async () => {
    if (materials.length > 0) return;
    setLoadingMats(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-external-materials`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
          },
        }
      );
      const json = await res.json();
      if (json.products) {
        setMaterials(json.products.map((p: any) => ({
          code: p.sku || p.id?.slice(0, 8) || "",
          name: p.name,
          sellingPrice: p.price_retail || 0,
          image_url: p.image_url,
        })));
      }
    } catch (err) {
      console.error("Failed to fetch materials:", err);
    }
    setLoadingMats(false);
  };

  const sendNotification = async (title: string, body: string, type: string = "info") => {
    if (!user) return;
    await supabase.from("notifications").insert({ user_id: user.id, title, body, type });
  };

  const filtered = requests.filter((r) => {
    const matchSearch = !search || r.client.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filters.status || filters.status === "all" || r.status === filters.status;
    return matchSearch && matchStatus;
  });

  const calcTotal = (items: RequestItem[]) =>
    items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);

  // Compute expectedTotal dynamically for display
  const getDisplayTotal = (req: Request) => {
    const computed = calcTotal(req.items);
    return computed.toLocaleString();
  };

  const addMaterial = (mat: FetchedMaterial) => {
    const existing = selectedItems.find(i => i.materialCode === mat.code);
    if (existing) {
      setSelectedItems(prev => prev.map(i => i.materialCode === mat.code ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setSelectedItems(prev => [...prev, { materialCode: mat.code, materialName: mat.name, qty: 1, unitPrice: mat.sellingPrice }]);
    }
  };

  const removeMaterial = (code: string) => {
    setSelectedItems(prev => prev.filter(i => i.materialCode !== code));
  };

  const updateQty = (code: string, qty: number) => {
    if (qty < 1) return;
    setSelectedItems(prev => prev.map(i => i.materialCode === code ? { ...i, qty } : i));
  };

  const handleAdd = () => {
    const client = clientsList.find(c => c.id === form.clientId);
    if (!client || selectedItems.length === 0) {
      toast.error(t.treasuryFillRequired);
      return;
    }
    const total = calcTotal(selectedItems);
    const num = requests.length + 1;
    const newReq: Request = {
      id: `REQ-${String(num).padStart(3, "0")}`,
      client: client.name,
      clientId: client.id,
      date: new Date().toISOString().split("T")[0],
      items: [...selectedItems],
      expectedTotal: total.toLocaleString(),
      status: "Client Requested",
      notes: form.notes,
    };
    setRequests([newReq, ...requests]);
    setForm({ clientId: "", notes: "" });
    setSelectedItems([]);
    setDialogOpen(false);
    toast.success(t.materialAdded);
    sendNotification("New request created", `${newReq.id} - ${client.name}`, "info");
  };

  const openDialog = () => {
    setDialogOpen(true);
    fetchMaterials();
  };

  const updateStatus = (id: string, newStatus: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const filteredMats = materials.filter(m =>
    !matSearch || m.name.toLowerCase().includes(matSearch.toLowerCase()) || m.code.toLowerCase().includes(matSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{t.requestsTitle}</h1>
        <p className="page-description">{requests.length} {t.requestCount} · {requests.filter(r => r.status === "Pending Review").length} {t.awaitingReview}</p>
      </div>

      <DataToolbar
        searchPlaceholder={t.searchRequests}
        searchValue={search}
        onSearchChange={setSearch}
        filters={[{ label: t.status, value: "status", options: [
          { label: t.clientRequested, value: "Client Requested" }, { label: t.pendingReview, value: "Pending Review" },
          { label: t.approved, value: "Approved" }, { label: t.rejected, value: "Rejected" },
          { label: t.convertedToOrder, value: "Converted to Order" }, { label: t.cancelled, value: "Cancelled" },
        ]}]}
        filterValues={filters}
        onFilterChange={(key, val) => setFilters({ ...filters, [key]: val })}
        onExport={() => exportToCsv("requests", [t.code, t.client, t.date, t.items, t.expectedTotal, t.status, t.notes], filtered.map(r => [r.id, r.client, r.date, r.items.length, `${r.expectedTotal} ${t.currency}`, r.status, r.notes]))}
        actions={<Button size="sm" className="h-9" onClick={openDialog}><Plus className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.newRequest}</Button>}
      />

      <div className="stat-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.code}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.client}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.date}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.materials || "المواد"}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.expectedTotal}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.status}</th>
              <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.notes}</th>
              <th className="text-end py-3 px-3 text-xs font-medium text-muted-foreground">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((req) => (
              <tr key={req.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetailReq(req)}>
                <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{req.id}</td>
                <td className="py-3 px-3 font-medium hover:text-primary cursor-pointer" onClick={() => navigate(`/clients/${req.clientId}`)}>{req.client}</td>
                <td className="py-3 px-3 text-muted-foreground">{req.date}</td>
                <td className="py-3 px-3">
                  <div className="flex flex-wrap gap-1">
                    {req.items.map((item, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-xs font-normal cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          toast(item.materialName, {
                            description: `الكود: ${item.materialCode} · الكمية: ${item.qty} · السعر: ${item.unitPrice.toLocaleString()} ${t.currency}`,
                            action: {
                              label: "فتح المواد",
                              onClick: () => navigate(`/materials?search=${encodeURIComponent(item.materialName)}`)
                            }
                          });
                        }}
                      >
                        {item.materialName} ×{item.qty}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-3 text-end font-medium">{req.expectedTotal} {t.currency}</td>
                <td className="py-3 px-3"><StatusBadge status={req.status} /></td>
                <td className="py-3 px-3 text-xs text-muted-foreground max-w-[200px] truncate">{req.notes || "—"}</td>
                <td className="py-3 px-3 text-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toast.info(`${t.viewDetails}: ${req.id}`)}><Eye className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.viewDetails}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { updateStatus(req.id, "Approved"); toast.success(`${t.requestApproved}: ${req.id}`); sendNotification(t.requestApproved, `${req.id} - ${req.client}`, "success"); }}><CheckCircle className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.approve}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { updateStatus(req.id, "Rejected"); toast.error(`${t.requestRejected}: ${req.id}`); sendNotification(t.requestRejected, `${req.id} - ${req.client}`, "warning"); }}><XCircle className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.reject}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { updateStatus(req.id, "Converted to Order"); toast.success(`${t.requestConverted}: ${req.id}`); navigate("/orders"); sendNotification(t.requestConverted, `${req.id} - ${req.client}`, "info"); }}><ArrowRight className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" />{t.convertToOrder}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">{t.noResults}</div>}
      </div>

      {/* New Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>{t.newRequest}</DialogTitle></DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pb-2">
              <div>
                <Label className="text-xs">{t.client} *</Label>
                <Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t.selectClientPlaceholder} /></SelectTrigger>
                  <SelectContent>
                    {clientsList.filter(c => c.status === "Active").map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} — {c.city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Material Selector */}
              <div>
                <Label className="text-xs">{t.materials || "المواد"} *</Label>
                <div className="mt-1 relative">
                  <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="ps-9"
                    placeholder={t.searchMaterials || "ابحث عن مادة..."}
                    value={matSearch}
                    onChange={e => setMatSearch(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-52 mt-2 border border-border rounded-md">
                  {loadingMats ? (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-8">جاري التحميل...</div>
                  ) : filteredMats.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-8">{t.noResults}</div>
                  ) : (
                    <div className="p-1 space-y-0.5">
                      {filteredMats.slice(0, 80).map(mat => (
                        <button
                          key={mat.code}
                          type="button"
                          onClick={() => addMaterial(mat)}
                          className="w-full flex items-center gap-2.5 px-2 py-2 text-sm rounded hover:bg-accent/50 transition-colors text-start"
                        >
                          {mat.image_url ? (
                            <img
                              src={mat.image_url}
                              alt={mat.name}
                              className="h-8 w-8 rounded object-cover shrink-0 bg-muted"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                            />
                          ) : null}
                          <Package className={`h-8 w-8 p-1.5 text-muted-foreground shrink-0 rounded bg-muted ${mat.image_url ? 'hidden' : ''}`} />
                          <span className="truncate flex-1">{mat.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{mat.sellingPrice.toLocaleString()} {t.currency}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Selected Items */}
              {selectedItems.length > 0 && (
                <div>
                  <Label className="text-xs">{t.items} ({selectedItems.length})</Label>
                  <div className="mt-1 space-y-1.5 border border-border rounded-md p-2 max-h-48 overflow-y-auto">
                    {selectedItems.map(item => (
                      <div key={item.materialCode} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate">{item.materialName}</span>
                        <Input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={e => updateQty(item.materialCode, Number(e.target.value))}
                          className="w-16 h-7 text-center text-xs"
                        />
                        <span className="text-xs text-muted-foreground w-20 text-end">
                          {(item.qty * item.unitPrice).toLocaleString()} {t.currency}
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeMaterial(item.materialCode)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <div className="border-t border-border pt-1.5 flex justify-between text-xs font-medium">
                      <span>{t.expectedTotal}</span>
                      <span>{calcTotal(selectedItems).toLocaleString()} {t.currency}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs">{t.notes}</Label>
                <Textarea className="mt-1" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={handleAdd}>{t.add || "إضافة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Detail Dialog */}
      <Dialog open={!!detailReq} onOpenChange={() => setDetailReq(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{detailReq?.id}</span>
              {detailReq && <StatusBadge status={detailReq.status} />}
            </DialogTitle>
          </DialogHeader>
          {detailReq && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{t.client}</p>
                  <p className="font-semibold cursor-pointer hover:text-primary" onClick={() => { setDetailReq(null); navigate(`/clients/${detailReq.clientId}`); }}>{detailReq.client}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                  <p className="font-semibold">{detailReq.date}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{t.expectedTotal}</p>
                  <p className="font-semibold">{detailReq.expectedTotal} {t.currency}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{t.status}</p>
                  <StatusBadge status={detailReq.status} />
                </div>
              </div>

              {detailReq.notes && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">{t.notes}</p>
                  <p>{detailReq.notes}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">{t.materials || "المواد"} ({detailReq.items.length})</p>
                <div className="space-y-2">
                  {detailReq.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                      <div>
                        <p className="font-medium text-sm">{item.materialName}</p>
                        <p className="text-xs text-muted-foreground">{t.code}: {item.materialCode}</p>
                      </div>
                      <div className="text-end">
                        <p className="font-semibold text-sm">{(item.qty * item.unitPrice).toLocaleString()} {t.currency}</p>
                        <p className="text-xs text-muted-foreground">{item.qty} × {item.unitPrice.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {detailReq.status !== "Approved" && detailReq.status !== "Converted to Order" && detailReq.status !== "Rejected" && (
                  <>
                    <Button size="sm" className="flex-1" onClick={() => { updateStatus(detailReq.id, "Approved"); setDetailReq({ ...detailReq, status: "Approved" }); toast.success(`${t.requestApproved}: ${detailReq.id}`); }}>
                      <CheckCircle className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.approve}
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => { updateStatus(detailReq.id, "Rejected"); setDetailReq({ ...detailReq, status: "Rejected" }); toast.error(`${t.requestRejected}: ${detailReq.id}`); }}>
                      <XCircle className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.reject}
                    </Button>
                  </>
                )}
                {(detailReq.status === "Approved" || detailReq.status === "Client Requested" || detailReq.status === "Pending Review") && (
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { updateStatus(detailReq.id, "Converted to Order"); setDetailReq(null); navigate("/orders"); toast.success(`${t.requestConverted}: ${detailReq.id}`); }}>
                    <ArrowRight className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t.convertToOrder}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
