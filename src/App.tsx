import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { Navigation } from "@/components/layout/Navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DiretoriaForm from "./pages/DiretoriaForm";
import Members from "./pages/Members";
import FinancialEntries from "./pages/FinancialEntries";
import FinancialExpenses from "./pages/FinancialExpenses";
import FinancialDashboard from "./pages/FinancialDashboard";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminClients from "./pages/admin/Clients";
import AdminTasks from "./pages/admin/Tasks";
import AdminUsers from "./pages/admin/Users";
import AdminAccountsReceivable from "./pages/admin/AccountsReceivable";
import AdminAccountsPayable from "./pages/admin/AccountsPayable";
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
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Navigation />
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/diretoria-form" element={<DiretoriaForm />} />
                    <Route path="/members" element={<Members />} />
                    <Route path="/entries" element={<FinancialEntries />} />
                    <Route path="/expenses" element={<FinancialExpenses />} />
                    <Route path="/dashboard" element={<FinancialDashboard />} />
                    
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
