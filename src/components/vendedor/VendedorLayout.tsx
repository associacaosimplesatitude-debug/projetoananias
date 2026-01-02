import { Outlet, NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { 
  Users, 
  Clock, 
  ShoppingCart, 
  AlertTriangle, 
  UserCheck,
  Package,
  LayoutDashboard,
  Video,
  Megaphone
} from "lucide-react";
import { UserProfileDropdown } from "@/components/layout/UserProfileDropdown";
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

const menuItems = [
  { to: "/vendedor", icon: LayoutDashboard, label: "Painel do Vendedor", end: true },
  { to: "/vendedor/clientes", icon: Users, label: "Clientes" },
  { to: "/vendedor/leads-landing", icon: Megaphone, label: "Lead de Landing Page" },
  { to: "/vendedor/pendentes", icon: Clock, label: "Pendentes" },
  { to: "/vendedor/proximas-compras", icon: ShoppingCart, label: "Próximas Compras" },
  { to: "/vendedor/em-risco", icon: AlertTriangle, label: "Em Risco" },
  { to: "/vendedor/leads", icon: UserCheck, label: "Reativação" },
  { to: "/vendedor/pedidos", icon: Package, label: "Pedidos" },
  { to: "/vendedor/tutoriais", icon: Video, label: "Tutoriais" },
];

export function VendedorLayout() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === "/vendedor") {
      return location.pathname === "/vendedor";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Vendedor</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isActive(item.to)}>
                        <RouterNavLink to={item.to} end={item.end}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </RouterNavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
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
