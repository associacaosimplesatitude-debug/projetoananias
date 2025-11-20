import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { Navigation } from "@/components/layout/Navigation";
import { PaymentBanner } from "@/components/layout/PaymentBanner";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DiretoriaForm from "./pages/DiretoriaForm";
import Members from "./pages/Members";
import ChurchMembers from "./pages/ChurchMembers";
import ChurchUsers from "./pages/ChurchUsers";
import FinancialEntries from "./pages/FinancialEntries";
import FinancialExpenses from "./pages/FinancialExpenses";
import FinancialDashboard from "./pages/FinancialDashboard";
import MyProfile from "./pages/MyProfile";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminClients from "./pages/admin/Clients";
import AdminClientManagement from "./pages/admin/ClientManagement";
import AdminClientView from "./pages/admin/ClientView";
import AdminTasks from "./pages/admin/Tasks";
import AdminUsers from "./pages/admin/Users";
import AdminAccountsReceivable from "./pages/admin/AccountsReceivable";
import AdminAccountsPayable from "./pages/admin/AccountsPayable";
import AdminFinancialReports from "./pages/admin/FinancialReports";
import AdminStageManagement from "./pages/admin/StageManagement";
import PaymentBlocked from "./pages/PaymentBlocked";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/payment-blocked" element={<PaymentBlocked />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Navigation />
                  <PaymentBanner />
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/my-profile" element={<MyProfile />} />
                    <Route path="/diretoria-form" element={<DiretoriaForm />} />
                    <Route path="/members" element={<Members />} />
                    <Route path="/church-members" element={<ChurchMembers />} />
                    <Route path="/entries" element={<FinancialEntries />} />
                    <Route path="/expenses" element={<FinancialExpenses />} />
                    <Route path="/dashboard" element={<FinancialDashboard />} />
                    <Route path="/settings/users" element={<ChurchUsers />} />
                    
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/clients"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminClients />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/client-view/:id"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminClientView />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/clients/:churchId"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminClientManagement />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/tasks"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminTasks />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/users"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminUsers />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/receivable"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminAccountsReceivable />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/payable"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminAccountsPayable />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/reports"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminFinancialReports />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/stages"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminStageManagement />
                        </ProtectedRoute>
                      }
                    />
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
