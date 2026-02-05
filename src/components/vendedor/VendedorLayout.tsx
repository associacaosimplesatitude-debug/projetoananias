import { Outlet, NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { 
  Users, 
  Clock, 
  ShoppingCart, 
  AlertTriangle, 
  Package,
  LayoutDashboard,
  Video,
  Megaphone,
  ShoppingBag,
  Scale,
  Store,
  FileText,
  LucideIcon,
  ArrowLeft,
  Eye,
  Wallet,
} from "lucide-react";
import { UserProfileDropdown } from "@/components/layout/UserProfileDropdown";
import { NotificationBell } from "@/components/vendedor/NotificationBell";
import { useVendedor } from "@/hooks/useVendedor";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

interface MenuItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  vendedorOnly?: boolean; // Items only visible to vendedor, not representante
  poloOnly?: boolean; // Items only visible to polo sellers (like Glorinha)
}

// Menu organizado por contexto de Playbook
const allMenuItems: MenuItem[] = [
  { to: "/vendedor", icon: LayoutDashboard, label: "Painel", end: true },
  { to: "/vendedor/clientes", icon: Users, label: "Clientes" },
  // PDV para vendas de balcão (Polo Penha)
  { to: "/vendedor/pdv", icon: Store, label: "PDV Balcão", poloOnly: true },
  // Playbooks - cada um representa um contexto específico
  { to: "/vendedor/pos-venda", icon: ShoppingBag, label: "Pós-Venda E-commerce", vendedorOnly: true },
  { to: "/vendedor/leads-landing", icon: Megaphone, label: "Leads Landing Page", vendedorOnly: true },
  { to: "/vendedor/pendentes", icon: Clock, label: "Ativação Pendente", vendedorOnly: true },
  { to: "/vendedor/proximas-compras", icon: ShoppingCart, label: "Próximas Compras" },
  { to: "/vendedor/em-risco", icon: AlertTriangle, label: "Clientes em Risco", vendedorOnly: true },
  { to: "/vendedor/notas-emitidas", icon: FileText, label: "Notas Emitidas" },
  { to: "/vendedor/pedidos", icon: Package, label: "Pedidos" },
  { to: "/vendedor/parcelas", icon: Wallet, label: "Minhas Parcelas" },
  { to: "/vendedor/calculadora-peso", icon: Scale, label: "Orçamento Transportadora" },
  { to: "/vendedor/tutoriais", icon: Video, label: "Tutoriais" },
];

export function VendedorLayout() {
  const location = useLocation();
  const { vendedor, tipoPerfil, isRepresentante, isLoading, isImpersonating } = useVendedor();
  const { stopImpersonation } = useImpersonation();
  
  // Verificar se é vendedor de polo (campo polo na tabela vendedores)
  const isPolo = !!vendedor?.polo;
  
  const isActive = (path: string) => {
    if (path === "/vendedor") {
      return location.pathname === "/vendedor";
    }
    return location.pathname.startsWith(path);
  };

  // Filter menu items based on profile type
  const menuItems = allMenuItems.filter(item => {
    // If it's a vendedor-only item and user is representante, hide it
    if (item.vendedorOnly && isRepresentante) {
      return false;
    }
    // If it's a polo-only item and user is not from polo, hide it
    if (item.poloOnly && !isPolo) {
      return false;
    }
    return true;
  });

  // Get label based on profile type
  const sidebarLabel = isRepresentante ? "Representante" : "Vendedor";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full flex-col">
        {/* Impersonation Banner */}
        {isImpersonating && (
          <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-between z-50">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span>
                Você está visualizando como: <strong>{vendedor?.nome}</strong>
                {vendedor?.tipo_perfil && (
                  <span className="ml-2 text-orange-100">
                    ({vendedor.tipo_perfil === 'representante' ? 'Representante' : 'Vendedor'})
                  </span>
                )}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={stopImpersonation}
              className="text-white hover:bg-orange-600 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar ao Admin
            </Button>
          </div>
        )}
        
        <div className="flex flex-1">
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>
                  {isLoading ? (
                    <Skeleton className="h-4 w-20" />
                  ) : (
                    sidebarLabel
                  )}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {isLoading ? (
                      // Loading skeleton for menu items
                      Array.from({ length: 5 }).map((_, i) => (
                        <SidebarMenuItem key={i}>
                          <div className="flex items-center gap-2 px-3 py-2">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                        </SidebarMenuItem>
                      ))
                    ) : (
                      menuItems.map((item) => (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton asChild isActive={isActive(item.to)}>
                            <RouterNavLink to={item.to} end={item.end}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </RouterNavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <div className="flex-1 flex flex-col">
            <header className="border-b bg-background px-4 py-3 flex items-center justify-between">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                <NotificationBell />
                <UserProfileDropdown />
              </div>
            </header>

            <main className="flex-1 p-6 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}