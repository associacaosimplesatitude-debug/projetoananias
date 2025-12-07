import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ConditionalNavigation } from "@/components/layout/ConditionalNavigation";
import { PaymentBanner } from "@/components/layout/PaymentBanner";
import { EBDTrimesterBanner } from "@/components/ebd/EBDTrimesterBanner";
import ProtectedRoute from "@/components/ProtectedRoute";
import ModuleProtectedRoute from "@/components/ModuleProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DiretoriaForm from "./pages/DiretoriaForm";
import Members from "./pages/Members";
import ChurchMembers from "./pages/ChurchMembers";
import ChurchUsers from "./pages/ChurchUsers";
import FinancialEntries from "./pages/FinancialEntries";
import FinancialExpenses from "./pages/FinancialExpenses";
import FinancialDashboard from "./pages/FinancialDashboard";
import BankAccounts from "./pages/BankAccounts";
import BankTransfers from "./pages/BankTransfers";
import AccountingReports from "./pages/reports/AccountingReports";
import AccountingJournal from "./pages/reports/AccountingJournal";
import IncomeStatement from "./pages/reports/IncomeStatement";
import BalanceSheet from "./pages/reports/BalanceSheet";
import MyProfile from "./pages/MyProfile";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminClients from "./pages/admin/Clients";
import AdminClientManagement from "./pages/admin/ClientManagement";
import AdminClientView from "./pages/admin/ClientView";
import AdminProcessList from "./pages/admin/ProcessList";
import AdminTasks from "./pages/admin/Tasks";
import AdminUsers from "./pages/admin/Users";
import AdminAccountsReceivable from "./pages/admin/AccountsReceivable";
import AdminAccountsPayable from "./pages/admin/AccountsPayable";
import AdminFinancialReports from "./pages/admin/FinancialReports";
import AdminStageManagement from "./pages/admin/StageManagement";
import BrandingCustomization from "./pages/admin/BrandingCustomization";
import ClientModules from "./pages/admin/ClientModules";
import AdminEBDCurriculo from "./pages/admin/EBDCurriculo";
import AdminEBDQuizMestre from "./pages/admin/EBDQuizMestre";
import AdminOrders from "./pages/admin/Orders";
import AdminEBD from "./pages/admin/AdminEBD";
import BlingIntegration from "./pages/admin/BlingIntegration";
import PaymentBlocked from "./pages/PaymentBlocked";
import NotFound from "./pages/NotFound";
import DashboardRedirect from "./components/DashboardRedirect";

// EBD Pages
import EBDIndex from "./pages/ebd/Index";
import EBDDashboard from "./pages/ebd/Dashboard";
import EBDStudents from "./pages/ebd/Students";
import EBDTeachers from "./pages/ebd/Teachers";
import EBDClassrooms from "./pages/ebd/Classrooms";
import EBDQuizzes from "./pages/ebd/Quizzes";
import EBDSchedule from "./pages/ebd/Schedule";
import EBDAgeRanges from "./pages/ebd/AgeRanges";
import EBDPlanejamento from "./pages/ebd/PlanejamentoEscolar";
import EBDCatalogo from "./pages/ebd/Catalogo";
import EBDCarrinho from "./pages/ebd/Carrinho";
import EBDCheckout from "./pages/ebd/Checkout";
import EBDMyOrders from "./pages/ebd/MyOrders";
import EBDOrderSuccess from "./pages/ebd/OrderSuccess";
import EBDFrequenciaRelatorio from "./pages/ebd/FrequenciaRelatorio";
import EBDAdmin from "./pages/ebd/Admin";
import EBDLancamentoManual from "./pages/ebd/LancamentoManual";
import EBDClassroomForm from "./pages/ebd/ClassroomForm";
import EBDAreaAluno from "./pages/ebd/AreaAluno";
import EBDAlunoPerfil from "./pages/ebd/AlunoPerfil";

// Aluno Module Pages
import AlunoHome from "./pages/ebd/aluno/AlunoHome";
import AlunoTurma from "./pages/ebd/aluno/AlunoTurma";
import AlunoAulasPage from "./pages/ebd/aluno/AlunoAulasPage";
import AlunoLeiturasPage from "./pages/ebd/aluno/AlunoLeiturasPage";
import AlunoPerfilPage from "./pages/ebd/aluno/AlunoPerfilPage";

// Professor Module Pages
import ProfessorHome from "./pages/ebd/professor/ProfessorHome";
import ProfessorEscala from "./pages/ebd/professor/ProfessorEscala";
import ProfessorClasse from "./pages/ebd/professor/ProfessorClasse";
import ProfessorAulas from "./pages/ebd/professor/ProfessorAulas";
import ProfessorLancamentos from "./pages/ebd/professor/ProfessorLancamentos";
import ProfessorQuizzes from "./pages/ebd/professor/ProfessorQuizzes";
import ProfessorRelatorios from "./pages/ebd/professor/ProfessorRelatorios";

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
                  <ConditionalNavigation>
                    <PaymentBanner />
                    <EBDTrimesterBanner />
                  <Routes>
                    <Route 
                      path="/" 
                      element={<DashboardRedirect />} 
                    />
                    <Route 
                      path="/abertura" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE IGREJAS">
                          <Index />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route path="/my-profile" element={<MyProfile />} />
                    <Route 
                      path="/diretoria-form" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE IGREJAS">
                          <DiretoriaForm />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route path="/members" element={<Members />} />
                    <Route path="/church-members" element={<ChurchMembers />} />
                    <Route 
                      path="/entries" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE IGREJAS">
                          <FinancialEntries />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/expenses" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE IGREJAS">
                          <FinancialExpenses />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/dashboard" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE IGREJAS">
                          <FinancialDashboard />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/bank-accounts" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE IGREJAS">
                          <BankAccounts />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/bank-transfers" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE IGREJAS">
                          <BankTransfers />
                        </ModuleProtectedRoute>
                      } 
                    />
          <Route 
            path="/reports/accounting" 
            element={
              <ModuleProtectedRoute requiredModule="REOBOTE IGREJAS">
                <AccountingReports />
              </ModuleProtectedRoute>
            } 
          />
          <Route 
            path="/reports/journal" 
            element={
              <ModuleProtectedRoute requiredModule="REOBOTE IGREJAS">
                <AccountingJournal />
              </ModuleProtectedRoute>
            } 
          />
          <Route 
            path="/reports/income-statement" 
            element={
              <ModuleProtectedRoute requiredModule="REOBOTE IGREJAS">
                <IncomeStatement />
              </ModuleProtectedRoute>
            } 
          />
          <Route 
            path="/reports/balance-sheet" 
            element={
              <ModuleProtectedRoute requiredModule="REOBOTE IGREJAS">
                <BalanceSheet />
              </ModuleProtectedRoute>
            } 
          />
                    
                    {/* EBD Routes */}
                    <Route 
                      path="/ebd" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDIndex />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/dashboard" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDDashboard />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/students" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDStudents />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/teachers" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDTeachers />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/turmas" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDClassrooms />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/turmas/nova" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDClassroomForm />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/turmas/editar" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDClassroomForm />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/quizzes" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDQuizzes />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/schedule" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDSchedule />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/planejamento" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDPlanejamento />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/escala" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDSchedule />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/catalogo" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDCatalogo />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/carrinho" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDCarrinho />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/checkout" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDCheckout />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/pedidos" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDMyOrders />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/my-orders" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDMyOrders />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/order-success" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDOrderSuccess />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/age-ranges" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDAgeRanges />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/frequencia/relatorio" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDFrequenciaRelatorio />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/admin" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDAdmin />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/lancamento" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDLancamentoManual />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/area-aluno" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDAreaAluno />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/meu-perfil" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDAlunoPerfil />
                        </ModuleProtectedRoute>
                      } 
                    />

                    {/* Aluno Module Routes */}
                    <Route 
                      path="/ebd/aluno" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <AlunoHome />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/aluno/turma" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <AlunoTurma />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/aluno/aulas" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <AlunoAulasPage />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/aluno/leituras" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <AlunoLeiturasPage />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/aluno/perfil" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <AlunoPerfilPage />
                        </ModuleProtectedRoute>
                      } 
                    />

                    {/* Professor Module Routes */}
                    <Route 
                      path="/ebd/professor" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <ProfessorHome />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/professor/escala" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <ProfessorEscala />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/professor/classe" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <ProfessorClasse />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/professor/aulas" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <ProfessorAulas />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/professor/lancamentos" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <ProfessorLancamentos />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/professor/quizzes" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <ProfessorQuizzes />
                        </ModuleProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/ebd/professor/relatorios" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <ProfessorRelatorios />
                        </ModuleProtectedRoute>
                      } 
                    />
                    
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
                      path="/admin/processos"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminProcessList />
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
                    <Route
                      path="/admin/clients/:clientId/modules"
                      element={
                        <ProtectedRoute requireAdmin>
                          <ClientModules />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/branding"
                      element={
                        <ProtectedRoute requireAdmin>
                          <BrandingCustomization />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/curriculo-ebd"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminEBDCurriculo />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/quiz-mestre"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminEBDQuizMestre />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/orders"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminOrders />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/ebd"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminEBD />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/bling"
                      element={
                        <ProtectedRoute requireAdmin>
                          <BlingIntegration />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/superadmin/branding"
                      element={
                        <ProtectedRoute requireAdmin>
                          <BrandingCustomization />
                        </ProtectedRoute>
                      }
                    />
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  </ConditionalNavigation>
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
