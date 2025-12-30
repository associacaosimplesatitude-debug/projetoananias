import { Outlet, useLocation } from "react-router-dom";
import { 
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  ShoppingCart,
  Package,
  Settings,
  BarChart3,
  ClipboardList,
  Layers,
  FileText,
  Gamepad2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DescontoSidebarBadge } from "./DescontoSidebarBadge";
import { UserProfileDropdown } from "@/components/layout/UserProfileDropdown";
import { NavLink as RouterNavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

function EBDSidebar() {
  const location = useLocation();

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">
            Gestão EBD
          </span>
        </div>
      </SidebarHeader>


      <SidebarContent className="flex flex-col h-full">
        <div className="flex-1">
          {/* Visão Geral */}
          <SidebarGroup>
            <SidebarGroupLabel>Visão Geral</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/ebd/dashboard', true)}>
                    <RouterNavLink to="/ebd/dashboard" end>
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Dashboard</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Gestão */}
          <SidebarGroup>
            <SidebarGroupLabel>Gestão</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/ebd/students')}>
                    <RouterNavLink to="/ebd/students">
                      <Users className="h-4 w-4" />
                      <span>Alunos</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/ebd/teachers')}>
                    <RouterNavLink to="/ebd/teachers">
                      <GraduationCap className="h-4 w-4" />
                      <span>Professores</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/ebd/turmas')}>
                    <RouterNavLink to="/ebd/turmas">
                      <Layers className="h-4 w-4" />
                      <span>Turmas</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Aulas */}
          <SidebarGroup>
            <SidebarGroupLabel>Aulas</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/ebd/planejamento')}>
                    <RouterNavLink to="/ebd/planejamento">
                      <ClipboardList className="h-4 w-4" />
                      <span>Planejamento</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/ebd/escala')}>
                    <RouterNavLink to="/ebd/escala">
                      <Calendar className="h-4 w-4" />
                      <span>Escala</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/ebd/lancamento-manual')}>
                    <RouterNavLink to="/ebd/lancamento-manual">
                      <FileText className="h-4 w-4" />
                      <span>Lançamento Manual</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Relatórios */}
          <SidebarGroup>
            <SidebarGroupLabel>Relatórios</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/ebd/frequencia/relatorio')}>
                    <RouterNavLink to="/ebd/frequencia/relatorio">
                      <BarChart3 className="h-4 w-4" />
                      <span>Frequência</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Atividades */}
          <SidebarGroup>
            <SidebarGroupLabel>Atividades</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/ebd/quizzes')}>
                    <RouterNavLink to="/ebd/quizzes">
                      <Gamepad2 className="h-4 w-4" />
                      <span>Quizzes</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/ebd/desafio-biblico')}>
                    <RouterNavLink to="/ebd/desafio-biblico">
                      <Gamepad2 className="h-4 w-4" />
                      <span>Desafio Bíblico</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Loja */}
          <SidebarGroup>
            <SidebarGroupLabel>Loja</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/ebd/catalogo')}>
                    <RouterNavLink to="/ebd/catalogo">
                      <ShoppingCart className="h-4 w-4" />
                      <span>Catálogo</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/ebd/pedidos') || isActive('/ebd/my-orders')}>
                    <RouterNavLink to="/ebd/pedidos">
                      <Package className="h-4 w-4" />
                      <span>Meus Pedidos</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Removido: Faixas Etárias não é mais necessário */}
        </div>

        {/* Botão fixo no rodapé do sidebar */}
        <div className="sticky bottom-0 p-4 bg-background/95 backdrop-blur border-t">
          <DescontoSidebarBadge />
        </div>
      </SidebarContent>
    </Sidebar>

  );
}

export function EBDLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <EBDSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b bg-background h-14 flex items-center px-4 gap-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <UserProfileDropdown />
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
