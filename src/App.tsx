import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { DomainBrandingProvider } from "@/contexts/DomainBrandingContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
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
import AdminEBDConteudoBiblico from "./pages/admin/EBDConteudoBiblico";
import AdminOrders from "./pages/admin/Orders";
import AdminEBD from "./pages/admin/AdminEBD";
import AdminEBDPropostasPage from "./pages/admin/AdminEBDPropostasPage";
import AprovacaoFaturamento from "./pages/admin/AprovacaoFaturamento";
import GestaoComissoes from "./pages/admin/GestaoComissoes";
import LeadsLandingPage from "./pages/admin/LeadsLandingPage";
import AdminEBDClientes from "./pages/admin/AdminEBDClientes";
import TransferRequests from "./pages/admin/TransferRequests";
import EBDSystemUsers from "./pages/admin/EBDSystemUsers";
import WhatsAppPanel from "./pages/admin/WhatsAppPanel";
import { AdminEBDLayout } from "@/components/admin/AdminEBDLayout";
import { EBDLayout } from "@/components/ebd/EBDLayout";
import { ProfessorLayout } from "@/components/ebd/ProfessorLayout";
import { AlunoLayout } from "@/components/ebd/aluno/AlunoLayout";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { RoyaltiesAdminLayout } from "@/components/royalties/RoyaltiesAdminLayout";
import { AutorLayout } from "@/components/royalties/AutorLayout";
import { RoyaltiesProtectedRoute } from "@/components/royalties/RoyaltiesProtectedRoute";
import BlingIntegration from "./pages/admin/BlingIntegration";
import ShopifyIntegration from "./pages/admin/ShopifyIntegration";
import PaymentBlocked from "./pages/PaymentBlocked";
import NotFound from "./pages/NotFound";
import DashboardRedirect from "./components/DashboardRedirect";

// Royalties Pages
import RoyaltiesDashboard from "./pages/royalties/Dashboard";
import RoyaltiesAutores from "./pages/royalties/Autores";
import RoyaltiesAutorDetalhes from "./pages/royalties/AutorDetalhes";
import RoyaltiesLivros from "./pages/royalties/Livros";
import RoyaltiesVendas from "./pages/royalties/Vendas";
import RoyaltiesPagamentos from "./pages/royalties/Pagamentos";
import RoyaltiesRelatorios from "./pages/royalties/Relatorios";
import RoyaltiesAfiliados from "./pages/royalties/Afiliados";
import RoyaltiesContratos from "./pages/royalties/Contratos";
import RoyaltiesResgates from "./pages/royalties/Resgates";
import RoyaltiesEmails from "./pages/royalties/Emails";

// Autor Pages
import AutorDashboard from "./pages/autor/Dashboard";
import AutorMeusLivros from "./pages/autor/MeusLivros";
import AutorContratos from "./pages/autor/Contratos";
import AutorExtrato from "./pages/autor/Extrato";
import AutorMeusPagamentos from "./pages/autor/MeusPagamentos";
import AutorPerfil from "./pages/autor/Perfil";
import AutorMeusAfiliados from "./pages/autor/MeusAfiliados";
import AutorLoja from "./pages/autor/Loja";
import AutorMeusResgates from "./pages/autor/MeusResgates";

// Public Landing Pages
import LivroLandingPage from "./pages/public/LivroLandingPage";

// EBD Pages
import EBDIndex from "./pages/ebd/Index";
import EBDDashboard from "./pages/ebd/Dashboard";
import EBDStudents from "./pages/ebd/Students";
import EBDTeachers from "./pages/ebd/Teachers";
import EBDClassrooms from "./pages/ebd/Classrooms";
import EBDQuizzes from "./pages/ebd/Quizzes";
import EBDSchedule from "./pages/ebd/Schedule";
import EBDAtivarRevistas from "./pages/ebd/AtivarRevistas";
import EBDAgeRanges from "./pages/ebd/AgeRanges";
import EBDPlanejamento from "./pages/ebd/PlanejamentoEscolar";
import EBDCatalogo from "./pages/ebd/Catalogo";
import EBDCarrinho from "./pages/ebd/Carrinho";
import EBDCheckout from "./pages/ebd/Checkout";
import EBDCheckoutBling from "./pages/ebd/CheckoutBling";
import EBDCheckoutShopifyMP from "./pages/ebd/CheckoutShopifyMP";
import EBDMyOrders from "./pages/ebd/MyOrders";
import EBDOrderSuccess from "./pages/ebd/OrderSuccess";
import EBDFrequenciaRelatorio from "./pages/ebd/FrequenciaRelatorio";
import EBDAdmin from "./pages/ebd/Admin";
import EBDLancamentoManual from "./pages/ebd/LancamentoManual";
import EBDClassroomForm from "./pages/ebd/ClassroomForm";
import EBDAreaAluno from "./pages/ebd/AreaAluno";
import EBDDesafioBiblico from "./pages/ebd/DesafioBiblico";
import EBDDesafioLiderPlay from "./pages/ebd/DesafioLiderPlay";
import EBDDesafioAcompanhamento from "./pages/ebd/DesafioAcompanhamento";
import EBDDesafioLeituraRelatorio from "./pages/ebd/DesafioLeituraRelatorio";
import EBDAlunoPerfil from "./pages/ebd/AlunoPerfil";
import CadastroAlunoPublico from "./pages/ebd/CadastroAlunoPublico";

// Aluno Module Pages
import AlunoHome from "./pages/ebd/aluno/AlunoHome";
import AlunoTurma from "./pages/ebd/aluno/AlunoTurma";
import AlunoAulasPage from "./pages/ebd/aluno/AlunoAulasPage";
import AlunoLeiturasPage from "./pages/ebd/aluno/AlunoLeiturasPage";
import AlunoPerfilPage from "./pages/ebd/aluno/AlunoPerfilPage";
import AlunoQuizPage from "./pages/ebd/aluno/AlunoQuizPage";

// Professor Module Pages
import ProfessorHome from "./pages/ebd/professor/ProfessorHome";
import ProfessorEscala from "./pages/ebd/professor/ProfessorEscala";
import ProfessorClasse from "./pages/ebd/professor/ProfessorClasse";
import ProfessorAulas from "./pages/ebd/professor/ProfessorAulas";
import ProfessorLancamentos from "./pages/ebd/professor/ProfessorLancamentos";
import ProfessorQuizzes from "./pages/ebd/professor/ProfessorQuizzes";
import ProfessorRelatorios from "./pages/ebd/professor/ProfessorRelatorios";

// Vendedor Pages
import VendedorDashboard from "./pages/vendedor/VendedorDashboard";
import VendedorCatalogo from "./pages/vendedor/VendedorCatalogo";
import VendedorAtivacaoEBD from "./pages/vendedor/VendedorAtivacaoEBD";
import VendedorClientes from "./pages/vendedor/VendedorClientes";
import VendedorPendentes from "./pages/vendedor/VendedorPendentes";
import VendedorProximasCompras from "./pages/vendedor/VendedorProximasCompras";
import VendedorEmRisco from "./pages/vendedor/VendedorEmRisco";
import VendedorPosVenda from "./pages/vendedor/VendedorPosVenda";
import VendedorLeadsPage from "./pages/vendedor/VendedorLeadsPage";
import VendedorLeadsLandingPage from "./pages/vendedor/VendedorLeadsLandingPage";
import VendedorPedidosPage from "./pages/vendedor/VendedorPedidosPage";
import VendedorNotasEmitidas from "./pages/vendedor/VendedorNotasEmitidas";
import VendedorParcelas from "./pages/vendedor/VendedorParcelas";
import { VendedorLayout } from "./components/vendedor/VendedorLayout";
import { VendedorProtectedRoute } from "./components/vendedor/VendedorProtectedRoute";
import VendedorCalculadoraPeso from "./pages/vendedor/VendedorCalculadoraPeso";
import VendedorPDV from "./pages/vendedor/VendedorPDV";
import VendedorEmailsEBD from "./pages/vendedor/VendedorEmailsEBD";

// Shopify Pages
import ShopifyPedidos from "./pages/shopify/ShopifyPedidos";
import PedidosOnline from "./pages/shopify/PedidosOnline";
import PedidosCentralGospel from "./pages/shopify/PedidosCentralGospel";
import PedidosAmazon from "./pages/shopify/PedidosAmazon";
import PedidosShopee from "./pages/shopify/PedidosShopee";
import PedidosMercadoLivre from "./pages/shopify/PedidosMercadoLivre";
import PedidosAdvecs from "./pages/shopify/PedidosAdvecs";
import PedidosAtacado from "./pages/shopify/PedidosAtacado";
import PedidosIgrejaCPF from "./pages/shopify/PedidosIgrejaCPF";
import PedidosIgrejaCNPJ from "./pages/shopify/PedidosIgrejaCNPJ";
import EBDLogin from "./pages/EBDLogin";
import AutorLogin from "./pages/AutorLogin";
import LandingEBD from "./pages/LandingEBD";
import Tutoriais from "./pages/Tutoriais";
import GestaoTutoriais from "./pages/admin/GestaoTutoriais";
import Apresentacao from "./pages/Apresentacao";
import ApresentacaoScreenshots from "./pages/admin/ApresentacaoScreenshots";

// Public Pages
import PropostaDigital from "./pages/PropostaDigital";
import EBDLandingRedirect from "./components/EBDLandingRedirect";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DomainBrandingProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ImpersonationProvider>
            <Routes>
              <Route path="/auth" element={
                <EBDLandingRedirect>
                  <Auth />
                </EBDLandingRedirect>
              } />
              <Route path="/login/ebd" element={<EBDLogin />} />
              <Route path="/login/autor" element={<AutorLogin />} />
              <Route path="/gestao-ebd" element={<LandingEBD />} />
              <Route path="/apresentacao" element={<Apresentacao />} />
              <Route path="/proposta/:token" element={<PropostaDigital />} />
              <Route path="/ebd/checkout-shopify-mp" element={<EBDCheckoutShopifyMP />} />
              <Route path="/cadastro-aluno/:churchId" element={<CadastroAlunoPublico />} />
              <Route path="/livro/:slug" element={<LivroLandingPage />} />
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
                    <Route path="/tutoriais" element={<Tutoriais />} />
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
                    
                    {/* EBD Index Route (redirect) */}
                    <Route 
                      path="/ebd" 
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDIndex />
                        </ModuleProtectedRoute>
                      } 
                    />
                    
                    {/* EBD Superintendent Routes with Sidebar Layout */}
                    <Route
                      path="/ebd"
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <EBDLayout />
                        </ModuleProtectedRoute>
                      }
                    >
                      <Route path="dashboard" element={<EBDDashboard />} />
                      <Route path="students" element={<EBDStudents />} />
                      <Route path="teachers" element={<EBDTeachers />} />
                      <Route path="turmas" element={<EBDClassrooms />} />
                      <Route path="turmas/nova" element={<EBDClassroomForm />} />
                      <Route path="turmas/editar" element={<EBDClassroomForm />} />
                      <Route path="quizzes" element={<EBDQuizzes />} />
                      <Route path="schedule" element={<EBDSchedule />} />
                      <Route path="planejamento" element={<EBDPlanejamento />} />
                      <Route path="escala" element={<EBDSchedule />} />
                      <Route path="ativar-revistas" element={<EBDAtivarRevistas />} />
                      <Route path="catalogo" element={<EBDCatalogo />} />
                      <Route path="carrinho" element={<EBDCarrinho />} />
                      <Route path="checkout" element={<EBDCheckout />} />
                      <Route path="checkout-bling" element={<EBDCheckoutBling />} />
                      <Route path="checkout-shopify-mp" element={<EBDCheckoutShopifyMP />} />
                      <Route path="pedidos" element={<EBDMyOrders />} />
                      <Route path="my-orders" element={<EBDMyOrders />} />
                      <Route path="order-success" element={<EBDOrderSuccess />} />
                      <Route path="age-ranges" element={<EBDAgeRanges />} />
                      <Route path="frequencia/relatorio" element={<EBDFrequenciaRelatorio />} />
                      <Route path="relatorios/leitura-diaria" element={<EBDDesafioLeituraRelatorio />} />
                      <Route path="admin" element={<EBDAdmin />} />
                      <Route path="lancamento" element={<EBDLancamentoManual />} />
                      <Route path="lancamento-manual" element={<EBDLancamentoManual />} />
                      <Route path="area-aluno" element={<EBDAreaAluno />} />
                      <Route path="meu-perfil" element={<EBDAlunoPerfil />} />
                      <Route path="desafio-biblico" element={<EBDDesafioBiblico />} />
                      <Route path="desafio-biblico/:desafioId/jogar" element={<EBDDesafioLiderPlay />} />
                      <Route path="desafio-biblico/:desafioId/acompanhar" element={<EBDDesafioAcompanhamento />} />
                      <Route path="shopify-pedidos" element={<ShopifyPedidos />} />
                    </Route>

                    {/* Aluno Module Routes with Sidebar Layout */}
                    <Route
                      path="/ebd/aluno"
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <AlunoLayout />
                        </ModuleProtectedRoute>
                      }
                    >
                      <Route index element={<AlunoHome />} />
                      <Route path="turma" element={<AlunoTurma />} />
                      <Route path="aulas" element={<AlunoAulasPage />} />
                      <Route path="leituras" element={<AlunoLeiturasPage />} />
                      <Route path="perfil" element={<AlunoPerfilPage />} />
                      <Route path="quiz/:quizId" element={<AlunoQuizPage />} />
                    </Route>

                    {/* Professor Module Routes with Sidebar Layout */}
                    <Route
                      path="/ebd/professor"
                      element={
                        <ModuleProtectedRoute requiredModule="REOBOTE EBD">
                          <ProfessorLayout />
                        </ModuleProtectedRoute>
                      }
                    >
                      <Route index element={<ProfessorHome />} />
                      <Route path="escala" element={<ProfessorEscala />} />
                      <Route path="classe" element={<ProfessorClasse />} />
                      <Route path="aulas" element={<ProfessorAulas />} />
                      <Route path="lancamentos" element={<ProfessorLancamentos />} />
                      <Route path="quizzes" element={<ProfessorQuizzes />} />
                      <Route path="relatorios" element={<ProfessorRelatorios />} />
                    </Route>
                    
                    <Route path="/settings/users" element={<ChurchUsers />} />
                    
                    {/* Admin Routes with Layout */}
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<AdminDashboard />} />
                      <Route path="clients" element={<AdminClients />} />
                      <Route path="processos" element={<AdminProcessList />} />
                      <Route path="client-view/:id" element={<AdminClientView />} />
                      <Route path="clients/:churchId" element={<AdminClientManagement />} />
                      <Route path="tasks" element={<AdminTasks />} />
                      <Route path="users" element={<AdminUsers />} />
                      <Route path="receivable" element={<AdminAccountsReceivable />} />
                      <Route path="payable" element={<AdminAccountsPayable />} />
                      <Route path="reports" element={<AdminFinancialReports />} />
                      <Route path="stages" element={<AdminStageManagement />} />
                      <Route path="clients/:clientId/modules" element={<ClientModules />} />
                      <Route path="branding" element={<BrandingCustomization />} />
                      <Route path="curriculo-ebd" element={<AdminEBDCurriculo />} />
                      <Route path="quiz-mestre" element={<AdminEBDQuizMestre />} />
                      <Route path="orders" element={<AdminOrders />} />
                      <Route path="bling" element={<BlingIntegration />} />
                      <Route path="shopify-pedidos" element={<ShopifyPedidos />} />
                      <Route path="tutoriais" element={<GestaoTutoriais />} />
                      <Route path="apresentacao" element={<ApresentacaoScreenshots />} />
                    </Route>
                    <Route
                      path="/admin/ebd"
                      element={
                        <ProtectedRoute requireAdmin allowGerenteEbd allowFinanceiro>
                          <AdminEBDLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<AdminEBD />} />
                      <Route path="propostas" element={<AdminEBDPropostasPage />} />
                      <Route path="aprovacao-faturamento" element={<AprovacaoFaturamento />} />
                      <Route path="comissoes" element={<GestaoComissoes />} />
                      <Route path="pedidos-igrejas" element={<PedidosOnline />} />
                      <Route path="pedidos-online" element={<PedidosCentralGospel />} />
                      <Route path="pedidos-igreja-cpf" element={<PedidosIgrejaCPF />} />
                      <Route path="pedidos-igreja-cnpj" element={<PedidosIgrejaCNPJ />} />
                      <Route path="pedidos-advecs" element={<PedidosAdvecs />} />
                      <Route path="pedidos-atacado" element={<PedidosAtacado />} />
                      <Route path="pedidos-amazon" element={<PedidosAmazon />} />
                      <Route path="pedidos-shopee" element={<PedidosShopee />} />
                      <Route path="pedidos-mercadolivre" element={<PedidosMercadoLivre />} />
                      <Route path="clientes" element={<AdminEBDClientes />} />
                      <Route path="leads" element={<AdminEBD />} />
                      <Route path="leads-landing" element={<LeadsLandingPage />} />
                      <Route path="vendedores" element={<AdminEBD />} />
                      <Route path="transferencias" element={<TransferRequests />} />
                      <Route path="catalogo" element={<AdminEBD />} />
                      <Route path="gestao-tutoriais" element={<GestaoTutoriais />} />
                      <Route path="tutoriais" element={<Tutoriais />} />
                      <Route path="shopify" element={<ShopifyIntegration />} />
                      <Route path="conteudo-biblico" element={<AdminEBDConteudoBiblico />} />
                      <Route path="usuarios" element={<EBDSystemUsers />} />
                      <Route path="whatsapp" element={<WhatsAppPanel />} />
                    </Route>
                    <Route
                      path="/superadmin/branding"
                      element={
                        <ProtectedRoute requireAdmin>
                          <BrandingCustomization />
                        </ProtectedRoute>
                      }
                    />
                    
                    {/* Vendedor Routes with Layout */}
                    <Route path="/vendedor" element={<VendedorLayout />}>
                      <Route index element={<VendedorDashboard />} />
                      <Route path="clientes" element={<VendedorClientes />} />
                      <Route path="pdv" element={<VendedorPDV />} />
                      <Route path="pos-venda" element={
                        <VendedorProtectedRoute vendedorOnly>
                          <VendedorPosVenda />
                        </VendedorProtectedRoute>
                      } />
                      <Route path="leads-landing" element={
                        <VendedorProtectedRoute vendedorOnly>
                          <VendedorLeadsLandingPage />
                        </VendedorProtectedRoute>
                      } />
                      <Route path="pendentes" element={
                        <VendedorProtectedRoute vendedorOnly>
                          <VendedorPendentes />
                        </VendedorProtectedRoute>
                      } />
                      <Route path="proximas-compras" element={<VendedorProximasCompras />} />
                      <Route path="em-risco" element={
                        <VendedorProtectedRoute vendedorOnly>
                          <VendedorEmRisco />
                        </VendedorProtectedRoute>
                      } />
                      <Route path="leads" element={
                        <VendedorProtectedRoute vendedorOnly>
                          <VendedorLeadsPage />
                        </VendedorProtectedRoute>
                      } />
                      <Route path="pedidos" element={<VendedorPedidosPage />} />
                      <Route path="notas-emitidas" element={<VendedorNotasEmitidas />} />
                      <Route path="parcelas" element={<VendedorParcelas />} />
                      <Route path="calculadora-peso" element={<VendedorCalculadoraPeso />} />
                      <Route path="shopify" element={<ShopifyPedidos />} />
                      <Route path="emails-ebd" element={<VendedorEmailsEBD />} />
                      <Route path="tutoriais" element={<Tutoriais />} />
                    </Route>
                    <Route path="/vendedor/catalogo" element={<VendedorCatalogo />} />
                    <Route path="/vendedor/ativacao" element={
                      <VendedorProtectedRoute vendedorOnly>
                        <VendedorAtivacaoEBD />
                      </VendedorProtectedRoute>
                    } />
                    
                    {/* Royalties Admin Routes */}
                    <Route
                      path="/royalties"
                      element={
                        <RoyaltiesProtectedRoute requireAdmin>
                          <RoyaltiesAdminLayout />
                        </RoyaltiesProtectedRoute>
                      }
                    >
                      <Route index element={<RoyaltiesDashboard />} />
                      <Route path="autores" element={<RoyaltiesAutores />} />
                      <Route path="autores/:id" element={<RoyaltiesAutorDetalhes />} />
                      <Route path="livros" element={<RoyaltiesLivros />} />
                      <Route path="vendas" element={<RoyaltiesVendas />} />
                      <Route path="pagamentos" element={<RoyaltiesPagamentos />} />
                      <Route path="resgates" element={<RoyaltiesResgates />} />
                      <Route path="afiliados" element={<RoyaltiesAfiliados />} />
                      <Route path="contratos" element={<RoyaltiesContratos />} />
                      <Route path="emails" element={<RoyaltiesEmails />} />
                      <Route path="relatorios" element={<RoyaltiesRelatorios />} />
                    </Route>

                    {/* Autor Routes */}
                    <Route
                      path="/autor"
                      element={
                        <RoyaltiesProtectedRoute requireAutor>
                          <AutorLayout />
                        </RoyaltiesProtectedRoute>
                      }
                    >
                      <Route index element={<AutorDashboard />} />
                      <Route path="livros" element={<AutorMeusLivros />} />
                      <Route path="contrato" element={<AutorContratos />} />
                      <Route path="extrato" element={<AutorExtrato />} />
                      <Route path="pagamentos" element={<AutorMeusPagamentos />} />
                      <Route path="loja" element={<AutorLoja />} />
                      <Route path="resgates" element={<AutorMeusResgates />} />
                      <Route path="afiliados" element={<AutorMeusAfiliados />} />
                      <Route path="perfil" element={<AutorPerfil />} />
                    </Route>
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  </ConditionalNavigation>
                </ProtectedRoute>
              }
            />
          </Routes>
            </ImpersonationProvider>
          </AuthProvider>
      </BrowserRouter>
      </DomainBrandingProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
