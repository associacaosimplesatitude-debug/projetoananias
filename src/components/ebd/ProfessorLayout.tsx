import { Outlet, useLocation } from "react-router-dom";
import { 
  Home, 
  Calendar, 
  Users, 
  BookOpen, 
  ClipboardList,
  Trophy,
  BarChart3,
  Video
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

function ProfessorSidebar() {
  const location = useLocation();

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const menuItems = [
    { path: "/ebd/professor", label: "Início", icon: Home, end: true },
    { path: "/ebd/professor/escala", label: "Minha Escala", icon: Calendar },
    { path: "/ebd/professor/classe", label: "Minha Classe", icon: Users },
    { path: "/ebd/professor/aulas", label: "Aulas e Materiais", icon: BookOpen },
    { path: "/ebd/professor/lancamentos", label: "Lançamentos", icon: ClipboardList },
    { path: "/ebd/professor/quizzes", label: "Quizzes", icon: Trophy },
    { path: "/ebd/professor/relatorios", label: "Relatórios", icon: BarChart3 },
    { path: "/tutoriais", label: "Tutoriais", icon: Video },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">
            Área do Professor
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col h-full">
        <div className="flex-1">
          {/* Menu Principal */}
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild isActive={isActive(item.path, item.end)}>
                        <RouterNavLink to={item.path} end={item.end}>
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </RouterNavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export function ProfessorLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <ProfessorSidebar />
        
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
