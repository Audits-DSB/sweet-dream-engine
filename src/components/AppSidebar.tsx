import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, ShoppingCart, Package, Truck, Warehouse,
  ClipboardCheck, Receipt, Landmark, UserCog, Building2, Bell,
  BarChart3, Settings, FileText, Boxes, LogOut, ShieldCheck, Factory,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { NavLink } from "@/components/NavLink";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

function useNavItems() {
  const { t } = useLanguage();

  const mainItems = [
    { title: t.dashboard, url: "/", icon: LayoutDashboard },
    { title: t.clients, url: "/clients", icon: Users },
    { title: t.clientRequests, url: "/requests", icon: FileText },
    { title: t.materials, url: "/materials", icon: Boxes },
    { title: t.suppliers, url: "/suppliers", icon: Factory },
    { title: t.orders, url: "/orders", icon: ShoppingCart },
    { title: t.deliveries, url: "/deliveries", icon: Truck },
  ];

  const inventoryItems = [
    { title: t.clientInventory, url: "/inventory", icon: Warehouse },
    { title: t.audits, url: "/audits", icon: ClipboardCheck },
    { title: t.refillPlanning, url: "/refill", icon: Package },
  ];

  const financeItems = [
    { title: t.collections, url: "/collections", icon: Receipt },
    { title: t.founders, url: "/founders", icon: UserCog },
    { title: t.companyProfit, url: "/company-profit", icon: Building2 },
    { title: t.founderFunding, url: "/founder-funding", icon: Landmark },
  ];

  const systemItems = [
    { title: t.alerts, url: "/alerts", icon: Bell },
    { title: t.reports, url: "/reports", icon: BarChart3 },
    { title: t.userManagement, url: "/user-management", icon: ShieldCheck },
    { title: t.settings, url: "/settings", icon: Settings },
  ];

  return { mainItems, inventoryItems, financeItems, systemItems };
}

type NavItem = { title: string; url: string; icon: any };

function NavGroup({ label, items, collapsed }: { label: string; items: NavItem[]; collapsed: boolean }) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <NavLink to={item.url} end={item.url === "/"} className="hover:bg-accent" activeClassName="bg-accent text-accent-foreground font-medium">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { mainItems, inventoryItems, financeItems, systemItems } = useNavItems();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <img src="/images/dsb-logo.png" alt="DSB" className="h-9 w-9 rounded-lg object-contain" />
            <div>
              <h2 className="font-semibold text-sm text-foreground leading-none">Dental Smart Box</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">DSB</p>
            </div>
          </div>
        ) : (
          <img src="/images/dsb-logo.png" alt="DSB" className="h-8 w-8 rounded-lg object-contain mx-auto" />
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        <NavGroup label={t.main} items={mainItems} collapsed={collapsed} />
        <NavGroup label={t.inventoryAudits} items={inventoryItems} collapsed={collapsed} />
        <NavGroup label={t.finance} items={financeItems} collapsed={collapsed} />
        <NavGroup label={t.system} items={systemItems} collapsed={collapsed} />
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border space-y-2">
        {!collapsed && profile?.full_name && (
          <button onClick={() => navigate("/profile")} className="text-xs text-muted-foreground truncate px-1 hover:text-foreground transition-colors text-start w-full">
            {profile.full_name}
          </button>
        )}
        <div className={collapsed ? "flex justify-center gap-1" : "flex items-center justify-between"}>
          <LanguageToggle />
          <ThemeToggle />
          <button onClick={signOut} className="text-muted-foreground hover:text-destructive transition-colors" title={t.signOut}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
