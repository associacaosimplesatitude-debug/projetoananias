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
  LucideIcon
} from "lucide-react";
import { UserProfileDropdown } from "@/components/layout/UserProfileDropdown";
import { useVendedor } from "@/hooks/useVendedor";
import { Skeleton } from "@/components/ui/skeleton";
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
  { to: "/vendedor/pedidos", icon: Package, label: "Pedidos" },
  { to: "/vendedor/calculadora-peso", icon: Scale, label: "Orçamento Transportadora" },
  { to: "/vendedor/tutoriais", icon: Video, label: "Tutoriais" },
];

export function VendedorLayout() {
  const location = useLocation();
  const { vendedor, tipoPerfil, isRepresentante, isLoading } = useVendedor();
  
  // Verificar se é vendedor de polo (exemplo: Glorinha - gloria@editoracentralgospel.com)
  const isPolo = vendedor?.email === 'gloria@editoracentralgospel.com';
  
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
      <div className="min-h-screen flex w-full">
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
            <UserProfileDropdown />
          </header>

          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}