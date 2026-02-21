import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DoctorAuthProvider } from "@/contexts/DoctorAuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { SuperAdminAuthProvider } from "@/contexts/SuperAdminAuthContext";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { SuperAdminGuard } from "@/components/super-admin/SuperAdminGuard";
import { Loader2 } from "lucide-react";
import { ROUTES } from "@/config/routes";

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ImportXML from "./pages/ImportXML";
import ImportBankStatement from "./pages/ImportBankStatement";
import AllocationList from "./pages/AllocationList";
import Allocation from "./pages/Allocation";
import Payables from "./pages/Payables";
import PayableDetails from "./pages/PayableDetails";
import Doctors from "./pages/Doctors";
import Hospitals from "./pages/Hospitals";
import Issuers from "./pages/Issuers";
import Banks from "./pages/Banks";
import BankStatement from "./pages/BankStatement";
import Users from "./pages/Users";
import Permissions from "./pages/Permissions";
import Settings from "./pages/Settings";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import Expenses from "./pages/Expenses";
import CashFlow from "./pages/CashFlow";
import AccumulatedCashFlow from "./pages/AccumulatedCashFlow";
import ReconcileTransactions from "./pages/ReconcileTransactions";
import ReceiptPaymentAdjustments from "./pages/ReceiptPaymentAdjustments";
import SiegIntegration from "./pages/SiegIntegration";
import AuditLogs from "./pages/AuditLogs";
import NotFound from "./pages/NotFound";

// Doctor Portal Pages
import DoctorLogin from "./pages/doctor-portal/DoctorLogin";
import DoctorChangePassword from "./pages/doctor-portal/DoctorChangePassword";
import DoctorDashboard from "./pages/doctor-portal/DoctorDashboard";

// Super Admin Pages
import SuperAdminLogin from "./pages/super-admin/SuperAdminLogin";
import SuperAdminDashboard from "./pages/super-admin/SuperAdminDashboard";
import TenantsList from "./pages/super-admin/TenantsList";
import TenantForm from "./pages/super-admin/TenantForm";

const queryClient = new QueryClient();

const Router = BrowserRouter;

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={ROUTES.auth} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.auth} element={<Auth />} />
      <Route path="/" element={<Navigate to={ROUTES.dashboard} replace />} />
      
      {/* Main App Routes - Portuguese URLs */}
      <Route
        path={ROUTES.dashboard}
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.import}
        element={
          <ProtectedRoute>
            <ImportXML />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.siegIntegration}
        element={
          <ProtectedRoute>
            <SiegIntegration />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.importStatement}
        element={
          <ProtectedRoute>
            <ImportBankStatement />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.allocation}
        element={
          <ProtectedRoute>
            <AllocationList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rateio/:invoiceId"
        element={
          <ProtectedRoute>
            <Allocation />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.payables}
        element={
          <ProtectedRoute>
            <Payables />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lancamentos/:payableId"
        element={
          <ProtectedRoute>
            <PayableDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.doctors}
        element={
          <ProtectedRoute>
            <Doctors />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.hospitals}
        element={
          <ProtectedRoute>
            <Hospitals />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.issuers}
        element={
          <ProtectedRoute>
            <Issuers />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.users}
        element={
          <ProtectedRoute>
            <Users />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.permissions}
        element={
          <ProtectedRoute>
            <Permissions />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.banks}
        element={
          <ProtectedRoute>
            <Banks />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.settings}
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.chartOfAccounts}
        element={
          <ProtectedRoute>
            <ChartOfAccounts />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.expenseCategories}
        element={<Navigate to={ROUTES.chartOfAccounts} replace />}
      />
      <Route
        path={ROUTES.expenses}
        element={
          <ProtectedRoute>
            <Expenses />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.cashFlow}
        element={
          <ProtectedRoute>
            <CashFlow />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.accumulatedCashFlow}
        element={
          <ProtectedRoute>
            <AccumulatedCashFlow />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.reconcileTransactions}
        element={
          <ProtectedRoute>
            <ReconcileTransactions />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.receiptPaymentAdjustments}
        element={
          <ProtectedRoute>
            <ReceiptPaymentAdjustments />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.auditLogs}
        element={
          <ProtectedRoute>
            <AuditLogs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/extrato-bancario/:bankId"
        element={
          <ProtectedRoute>
            <BankStatement />
          </ProtectedRoute>
        }
      />
      
      {/* Doctor Portal Routes - Portuguese URLs */}
      <Route path={ROUTES.doctorPortal.login} element={<DoctorLogin />} />
      <Route path={ROUTES.doctorPortal.changePassword} element={<DoctorChangePassword />} />
      <Route path={ROUTES.doctorPortal.dashboard} element={<DoctorDashboard />} />
      <Route path={ROUTES.doctorPortal.root} element={<Navigate to={ROUTES.doctorPortal.login} replace />} />
      
      {/* Super Admin Portal Routes */}
      <Route path={ROUTES.superAdmin.login} element={<SuperAdminLogin />} />
      <Route
        path={ROUTES.superAdmin.dashboard}
        element={
          <SuperAdminGuard>
            <SuperAdminDashboard />
          </SuperAdminGuard>
        }
      />
      <Route
        path={ROUTES.superAdmin.tenants}
        element={
          <SuperAdminGuard>
            <TenantsList />
          </SuperAdminGuard>
        }
      />
      <Route
        path={ROUTES.superAdmin.tenantNew}
        element={
          <SuperAdminGuard>
            <TenantForm />
          </SuperAdminGuard>
        }
      />
      <Route
        path="/super-admin/tenants/:id/edit"
        element={
          <SuperAdminGuard>
            <TenantForm />
          </SuperAdminGuard>
        }
      />
      
      {/* Legacy Redirects - Keep old URLs working */}
      <Route path={ROUTES.legacy.dashboard} element={<Navigate to={ROUTES.dashboard} replace />} />
      <Route path={ROUTES.legacy.import} element={<Navigate to={ROUTES.import} replace />} />
      <Route path={ROUTES.legacy.allocation} element={<Navigate to={ROUTES.allocation} replace />} />
      <Route path="/allocation/:invoiceId" element={<Navigate to={ROUTES.allocation} replace />} />
      <Route path={ROUTES.legacy.payables} element={<Navigate to={ROUTES.payables} replace />} />
      <Route path="/payables/:payableId" element={<Navigate to={ROUTES.payables} replace />} />
      <Route path={ROUTES.legacy.receipts} element={<Navigate to={ROUTES.payables} replace />} />
      <Route path={ROUTES.legacy.expenses} element={<Navigate to={ROUTES.expenses} replace />} />
      <Route path={ROUTES.legacy.expenseCategories} element={<Navigate to={ROUTES.chartOfAccounts} replace />} />
      <Route path={ROUTES.legacy.doctors} element={<Navigate to={ROUTES.doctors} replace />} />
      <Route path={ROUTES.legacy.hospitals} element={<Navigate to={ROUTES.hospitals} replace />} />
      <Route path={ROUTES.legacy.banks} element={<Navigate to={ROUTES.banks} replace />} />
      <Route path="/bank-statement/:bankId" element={<Navigate to={ROUTES.banks} replace />} />
      <Route path={ROUTES.legacy.users} element={<Navigate to={ROUTES.users} replace />} />
      <Route path={ROUTES.legacy.permissions} element={<Navigate to={ROUTES.permissions} replace />} />
      <Route path={ROUTES.legacy.settings} element={<Navigate to={ROUTES.settings} replace />} />
      <Route path={ROUTES.legacy.doctorPortalLogin} element={<Navigate to={ROUTES.doctorPortal.login} replace />} />
      <Route path={ROUTES.legacy.doctorPortalDashboard} element={<Navigate to={ROUTES.doctorPortal.dashboard} replace />} />
      <Route path={ROUTES.legacy.doctorPortalChangePassword} element={<Navigate to={ROUTES.doctorPortal.changePassword} replace />} />
      <Route path="/doctor-portal" element={<Navigate to={ROUTES.doctorPortal.login} replace />} />
      <Route path={ROUTES.legacy.reconcileTransactions} element={<Navigate to={ROUTES.reconcileTransactions} replace />} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AppContent() {
  return (
    <>
      <ImpersonationBanner />
      <AppRoutes />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router>
        <SuperAdminAuthProvider>
          <AuthProvider>
            <TenantProvider>
              <DoctorAuthProvider>
                <AppContent />
              </DoctorAuthProvider>
            </TenantProvider>
          </AuthProvider>
        </SuperAdminAuthProvider>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
