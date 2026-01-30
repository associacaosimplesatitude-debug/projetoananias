import { Outlet, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  BookOpen, 
  FileText, 
  CreditCard, 
  User,
  Pen,
  Link2,
} from "lucide-react";
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

function AutorSidebar() {
  const location = useLocation();

  const menuItems = [
    { to: "/autor", icon: LayoutDashboard, label: "Dashboard", end: true },
    { to: "/autor/livros", icon: BookOpen, label: "Meus Livros" },
    { to: "/autor/extrato", icon: FileText, label: "Extrato" },
    { to: "/autor/pagamentos", icon: CreditCard, label: "Pagamentos" },
    { to: "/autor/afiliados", icon: Link2, label: "Meus Links" },
    { to: "/autor/perfil", icon: User, label: "Meus Dados" },
  ];

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <Pen className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">
            Área do Autor
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
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

export function AutorLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AutorSidebar />
        
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
