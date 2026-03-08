import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import ClientsPage from "./pages/Clients";
import ClientProfile from "./pages/ClientProfile";
import RequestsPage from "./pages/Requests";
import MaterialsPage from "./pages/Materials";
import OrdersPage from "./pages/Orders";
import OrderDetails from "./pages/OrderDetails";
import DeliveriesPage from "./pages/Deliveries";
import InventoryPage from "./pages/Inventory";
import AuditsPage from "./pages/Audits";
import RefillPage from "./pages/Refill";
import CollectionsPage from "./pages/Collections";
import FoundersPage from "./pages/Founders";
import CompanyProfitPage from "./pages/CompanyProfit";
import FounderFundingPage from "./pages/FounderFunding";
import AlertsPage from "./pages/Alerts";
import ReportsPage from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/clients/:id" element={<ClientProfile />} />
              <Route path="/requests" element={<RequestsPage />} />
              <Route path="/materials" element={<MaterialsPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:id" element={<OrderDetails />} />
              <Route path="/deliveries" element={<DeliveriesPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/audits" element={<AuditsPage />} />
              <Route path="/refill" element={<RefillPage />} />
              <Route path="/collections" element={<CollectionsPage />} />
              <Route path="/founders" element={<FoundersPage />} />
              <Route path="/company-profit" element={<CompanyProfitPage />} />
              <Route path="/founder-funding" element={<FounderFundingPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
