import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  Truck,
  Warehouse,
  ClipboardCheck,
  Receipt,
  Landmark,
  UserCog,
  Building2,
  Bell,
  BarChart3,
  Settings,
  FileText,
  Boxes,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Client Requests", url: "/requests", icon: FileText },
  { title: "Materials", url: "/materials", icon: Boxes },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "Deliveries", url: "/deliveries", icon: Truck },
];

const inventoryItems = [
  { title: "Client Inventory", url: "/inventory", icon: Warehouse },
  { title: "Audits", url: "/audits", icon: ClipboardCheck },
  { title: "Refill Planning", url: "/refill", icon: Package },
];

const financeItems = [
  { title: "Collections", url: "/collections", icon: Receipt },
  { title: "Founders", url: "/founders", icon: UserCog },
  { title: "Company Profit", url: "/company-profit", icon: Building2 },
  { title: "Founder Funding", url: "/founder-funding", icon: Landmark },
];

const systemItems = [
  { title: "Alerts", url: "/alerts", icon: Bell },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

function NavGroup({ label, items, collapsed }: { label: string; items: typeof mainItems; collapsed: boolean }) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <NavLink
                  to={item.url}
                  end={item.url === "/"}
                  className="hover:bg-accent"
                  activeClassName="bg-accent text-accent-foreground font-medium"
                >
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

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">OP</span>
            </div>
            <div>
              <h2 className="font-semibold text-sm text-foreground leading-none">OpsHub</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Operations Platform</p>
            </div>
          </div>
        ) : (
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-sm">O</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        <NavGroup label="Main" items={mainItems} collapsed={collapsed} />
        <NavGroup label="Inventory & Audits" items={inventoryItems} collapsed={collapsed} />
        <NavGroup label="Finance" items={financeItems} collapsed={collapsed} />
        <NavGroup label="System" items={systemItems} collapsed={collapsed} />
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className={collapsed ? "flex justify-center" : "flex items-center justify-between"}>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
