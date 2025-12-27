import { Outlet, useLocation } from "react-router-dom";
import { 
  TrendingUp, 
  Package, 
  Users, 
  UserX, 
  User,
  BookOpen,
  FileText,
  ShoppingBag,
  ChevronDown,
  Church,
  Store,
  ShoppingCart,
  Boxes,
  ClipboardCheck,
  Video,
  DollarSign,
  Settings,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserProfileDropdown } from "@/components/layout/UserProfileDropdown";
import { useAuth } from "@/hooks/useAuth";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

function AdminSidebar() {
  const { role } = useAuth();
  const location = useLocation();
  const isGerenteEbd = role === 'gerente_ebd';
  const isFinanceiro = role === 'financeiro';
  const isAdmin = role === 'admin';

  const [pedidosOpen, setPedidosOpen] = useState(
    location.pathname.includes('/admin/ebd/pedidos')
  );

  const pedidosSubItems = [
    { to: "/admin/ebd/pedidos-igrejas", icon: Church, label: "Igrejas" },
    { to: "/admin/ebd/pedidos-online", icon: ShoppingBag, label: "Online" },
    { to: "/admin/ebd/pedidos-advecs", icon: Church, label: "ADVECS" },
    { to: "/admin/ebd/pedidos-atacado", icon: Boxes, label: "Atacado" },
    { to: "/admin/ebd/pedidos-amazon", icon: Package, label: "Amazon" },
    { to: "/admin/ebd/pedidos-shopee", icon: Store, label: "Shopee" },
    { to: "/admin/ebd/pedidos-mercadolivre", icon: ShoppingCart, label: "Mercado Livre" },
  ];

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">
            Admin EBD
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Visão Geral */}
        <SidebarGroup>
          <SidebarGroupLabel>Visão Geral</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/admin/ebd', true)}>
                  <RouterNavLink to="/admin/ebd" end>
                    <TrendingUp className="h-4 w-4" />
                    <span>Dashboard</span>
                  </RouterNavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Vendas */}
        <SidebarGroup>
          <SidebarGroupLabel>Vendas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/admin/ebd/propostas')}>
                  <RouterNavLink to="/admin/ebd/propostas">
                    <FileText className="h-4 w-4" />
                    <span>Pedidos e Propostas</span>
                  </RouterNavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Pedidos com submenu */}
              <Collapsible open={pedidosOpen} onOpenChange={setPedidosOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton 
                      isActive={location.pathname.includes('/admin/ebd/pedidos')}
                      className="justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <span>Pedidos</span>
                      </div>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        pedidosOpen && "rotate-180"
                      )} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {pedidosSubItems.map((item) => (
                        <SidebarMenuSubItem key={item.to}>
                          <SidebarMenuSubButton asChild isActive={isActive(item.to)}>
                            <RouterNavLink to={item.to}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </RouterNavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Financeiro - apenas para role financeiro ou admin */}
        {(isFinanceiro || isAdmin) && (
          <SidebarGroup>
            <SidebarGroupLabel>Financeiro</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/admin/ebd/aprovacao-faturamento')}>
                    <RouterNavLink to="/admin/ebd/aprovacao-faturamento">
                      <ClipboardCheck className="h-4 w-4" />
                      <span>Aprovação Faturamento</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Clientes - não mostrar para financeiro */}
        {!isFinanceiro && (
          <SidebarGroup>
            <SidebarGroupLabel>Clientes</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/admin/ebd/clientes')}>
                    <RouterNavLink to="/admin/ebd/clientes">
                      <Users className="h-4 w-4" />
                      <span>Clientes EBD</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/admin/ebd/leads')}>
                    <RouterNavLink to="/admin/ebd/leads">
                      <UserX className="h-4 w-4" />
                      <span>Leads Reativação</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/admin/ebd/vendedores')}>
                    <RouterNavLink to="/admin/ebd/vendedores">
                      <User className="h-4 w-4" />
                      <span>Vendedores</span>
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Configurações - apenas para admin e gerente_ebd */}
        {!isFinanceiro && (
          <SidebarGroup>
            <SidebarGroupLabel>Configurações</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {!isGerenteEbd && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive('/admin/ebd/catalogo')}>
                      <RouterNavLink to="/admin/ebd/catalogo">
                        <BookOpen className="h-4 w-4" />
                        <span>Catálogo</span>
                      </RouterNavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive('/admin/ebd/gestao-tutoriais')}>
                      <RouterNavLink to="/admin/ebd/gestao-tutoriais">
                        <Video className="h-4 w-4" />
                        <span>Tutoriais</span>
                      </RouterNavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

export function AdminEBDLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        
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
