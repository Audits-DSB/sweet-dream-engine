import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { WorkflowProvider } from "@/contexts/WorkflowContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import InventoryDetail from "./pages/InventoryDetail";
import AuditsPage from "./pages/Audits";
import RefillPage from "./pages/Refill";
import CollectionsPage from "./pages/Collections";
import FoundersPage from "./pages/Founders";
import CompanyProfitPage from "./pages/CompanyProfit";
import FounderFundingPage from "./pages/FounderFunding";
import AlertsPage from "./pages/Alerts";
import ReportsPage from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import UserManagementPage from "./pages/UserManagement";
import SuppliersPage from "./pages/Suppliers";
import SupplierProfile from "./pages/SupplierProfile";
import TreasuryDashboard from "./pages/Treasury";
import TreasuryAccountsPage from "./pages/TreasuryAccounts";
import TreasuryTransactionsPage from "./pages/TreasuryTransactions";
import FinancialReportPage from "./pages/FinancialReport";
import MonthlyReport from "./pages/MonthlyReport";
import ProfilePage from "./pages/Profile";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import Walkthrough from "./pages/Walkthrough";
import ActivityPage from "./pages/Activity";
import MonthlyDetailPage from "./pages/MonthlyDetail";
import CompanyInventoryPage from "./pages/CompanyInventory";
import InventoryLotDetail from "./pages/InventoryLotDetail";
import ReturnsPage from "./pages/Returns";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>

    <LanguageProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <WorkflowProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/clients/:id" element={<ClientProfile />} />
                <Route path="/requests" element={<RequestsPage />} />
                <Route path="/materials" element={<MaterialsPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/orders/:id" element={<OrderDetails />} />
                <Route path="/deliveries" element={<DeliveriesPage />} />
                <Route path="/returns" element={<ReturnsPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/inventory/:id" element={<InventoryDetail />} />
                <Route path="/audits" element={<AuditsPage />} />
                <Route path="/refill" element={<RefillPage />} />
                <Route path="/collections" element={<CollectionsPage />} />
                <Route path="/founders" element={<FoundersPage />} />
                <Route path="/company-profit" element={<CompanyProfitPage />} />
                <Route path="/founder-funding" element={<FounderFundingPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/suppliers/:id" element={<SupplierProfile />} />
                <Route path="/treasury" element={<TreasuryDashboard />} />
                <Route path="/treasury/accounts" element={<TreasuryAccountsPage />} />
                <Route path="/treasury/transactions" element={<TreasuryTransactionsPage />} />
                <Route path="/financial-report" element={<FinancialReportPage />} />
                <Route path="/monthly-report" element={<MonthlyReport />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/user-management" element={<UserManagementPage />} />
                <Route path="/walkthrough" element={<Walkthrough />} />
                <Route path="/activity" element={<ActivityPage />} />
                <Route path="/monthly/:year/:month" element={<MonthlyDetailPage />} />
                <Route path="/company-inventory" element={<CompanyInventoryPage />} />
                <Route path="/company-inventory/:id" element={<InventoryLotDetail />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </WorkflowProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </LanguageProvider>
  </ThemeProvider>
);

export default App;
