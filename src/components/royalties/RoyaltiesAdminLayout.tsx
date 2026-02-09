import { Outlet, useLocation, Link } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  ShoppingCart, 
  CreditCard, 
  FileText,
  BookOpenText,
  Link2,
  ScrollText,
  Package,
  Mail,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

function RoyaltiesSidebar() {
  const location = useLocation();

  const menuItems = [
    { to: "/royalties", icon: LayoutDashboard, label: "Dashboard", end: true },
    { to: "/royalties/autores", icon: Users, label: "Autores" },
    { to: "/royalties/livros", icon: BookOpen, label: "Livros" },
    { to: "/royalties/vendas", icon: ShoppingCart, label: "Vendas" },
    { to: "/royalties/pagamentos", icon: CreditCard, label: "Pagamentos" },
    { to: "/royalties/resgates", icon: Package, label: "Resgates" },
    { to: "/royalties/afiliados", icon: Link2, label: "Afiliados" },
    { to: "/royalties/contratos", icon: ScrollText, label: "Contratos" },
    { to: "/royalties/emails", icon: Mail, label: "Emails" },
    { to: "/royalties/relatorios", icon: FileText, label: "Relatórios" },
  ];

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <BookOpenText className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">
            Royalties
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to, item.end)}>
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
  );
}

export function RoyaltiesAdminLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <RoyaltiesSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b bg-background h-14 flex items-center px-4 gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/ebd">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Link>
            </Button>
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
