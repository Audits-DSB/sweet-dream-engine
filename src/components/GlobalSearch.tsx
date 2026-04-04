import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { Search, Users, ShoppingCart, Package, X } from "lucide-react";

type SearchResult = {
  type: "client" | "order" | "material";
  id: string;
  label: string;
  sub: string;
  url: string;
};

export function GlobalSearch() {
  const { t, dir } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    if (loaded) return;
    try {
      const [c, o, m] = await Promise.all([
        api.get<any[]>("/clients").catch(() => []),
        api.get<any[]>("/orders").catch(() => []),
        api.get<any[]>("/materials").catch(() => []),
      ]);
      setClients((c || []).filter((x: any) => x.name !== "company-inventory"));
      setOrders((o || []).filter((x: any) => (x.client || "") !== "company-inventory"));
      setMaterials(m || []);
      setLoaded(true);
    } catch {}
  }, [loaded]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const q = query.toLowerCase();
    const r: SearchResult[] = [];

    clients.forEach((c: any) => {
      const name = c.name || "";
      const id = c.id || "";
      const contact = c.contact || "";
      if (name.toLowerCase().includes(q) || id.toLowerCase().includes(q) || contact.toLowerCase().includes(q)) {
        r.push({ type: "client", id: c.id, label: name, sub: `${id} · ${contact}`, url: `/clients/${c.id}` });
      }
    });

    orders.forEach((o: any) => {
      const oid = o.id || "";
      const client = o.client || o.clientName || o.client_name || "";
      if (oid.toLowerCase().includes(q) || client.toLowerCase().includes(q)) {
        r.push({ type: "order", id: oid, label: oid, sub: `${client} · ${o.date || ""}`, url: `/orders/${oid}` });
      }
    });

    materials.forEach((m: any) => {
      const name = m.name || "";
      const code = m.code || "";
      if (name.toLowerCase().includes(q) || code.toLowerCase().includes(q)) {
        r.push({ type: "material", id: code, label: name, sub: code, url: `/materials` });
      }
    });

    setResults(r.slice(0, 15));
  }, [query, clients, orders, materials]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
        loadData();
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [loadData]);

  const iconMap = {
    client: Users,
    order: ShoppingCart,
    material: Package,
  };

  const typeLabel = {
    client: t.searchClients,
    order: t.searchOrders,
    material: t.searchMaterials,
  };

  return (
    <div ref={containerRef} className="relative" dir={dir}>
      <div className="relative">
        <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ltr:left-3 rtl:right-3" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={t.searchPlaceholder}
          className="h-9 w-[220px] sm:w-[300px] rounded-lg border border-border bg-background px-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          onFocus={() => { setOpen(true); loadData(); }}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults([]); }} className="absolute top-1/2 -translate-y-1/2 ltr:right-3 rtl:left-3 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute top-full mt-1 w-[320px] sm:w-[400px] bg-card border border-border rounded-xl shadow-xl z-50 max-h-[400px] overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">{t.searchNoResults}</div>
          ) : (
            <div className="py-1">
              {results.map((r, i) => {
                const Icon = iconMap[r.type];
                return (
                  <button
                    key={`${r.type}-${r.id}-${i}`}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent text-start transition-colors"
                    onClick={() => { navigate(r.url); setOpen(false); setQuery(""); }}
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.sub}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{typeLabel[r.type]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
