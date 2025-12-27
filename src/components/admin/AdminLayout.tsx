import { Outlet, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Building, 
  UserCog,
  ClipboardList,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  BookOpen,
  Package,
  Link2,
  ShoppingBag,
  Palette,
  ChevronDown,
  Settings,
  BarChart3,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

function AdminSidebar() {
  const location = useLocation();

  const [clientesOpen, setClientesOpen] = useState(
    location.pathname.includes('/admin/clients') || 
    location.pathname.includes('/admin/processos') ||
    location.pathname.includes('/admin/users')
  );

  const [financeiroOpen, setFinanceiroOpen] = useState(
    location.pathname.includes('/admin/receivable') || 
    location.pathname.includes('/admin/payable') ||
    location.pathname.includes('/admin/reports')
  );

  const [catalogosOpen, setCatalogosOpen] = useState(
    location.pathname.includes('/admin/curriculo-ebd') || 
    location.pathname.includes('/admin/orders') ||
    location.pathname.includes('/admin/bling') ||
    location.pathname.includes('/admin/shopify')
  );

  const clientesSubItems = [
    { to: "/admin/clients", icon: Building, label: "Clientes" },
    { to: "/admin/processos", icon: ClipboardList, label: "Etapas" },
    { to: "/admin/users", icon: UserCog, label: "Usuários" },
  ];

  const financeiroSubItems = [
    { to: "/admin/receivable", icon: TrendingUp, label: "A Receber" },
    { to: "/admin/payable", icon: TrendingDown, label: "A Pagar" },
    { to: "/admin/reports", icon: FileText, label: "Relatórios" },
  ];

  const catalogosSubItems = [
    { to: "/admin/curriculo-ebd", icon: BookOpen, label: "Catálogo" },
    { to: "/admin/orders", icon: Package, label: "Pedidos" },
    { to: "/admin/bling", icon: Link2, label: "Bling" },
    { to: "/admin/shopify-pedidos", icon: ShoppingBag, label: "Shopify" },
  ];

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">
            Admin Geral
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
                <SidebarMenuButton asChild isActive={isActive('/admin', true)}>
                  <RouterNavLink to="/admin" end>
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </RouterNavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/admin/ebd')}>
                  <RouterNavLink to="/admin/ebd">
                    <BarChart3 className="h-4 w-4" />
                    <span>Admin EBD</span>
                  </RouterNavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Clientes */}
        <SidebarGroup>
          <SidebarGroupLabel>Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible open={clientesOpen} onOpenChange={setClientesOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton 
                      isActive={clientesSubItems.some(item => isActive(item.to))}
                      className="justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        <span>Clientes</span>
                      </div>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        clientesOpen && "rotate-180"
                      )} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {clientesSubItems.map((item) => (
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

        {/* Financeiro */}
        <SidebarGroup>
          <SidebarGroupLabel>Financeiro</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible open={financeiroOpen} onOpenChange={setFinanceiroOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton 
                      isActive={financeiroSubItems.some(item => isActive(item.to))}
                      className="justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        <span>Financeiro</span>
                      </div>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        financeiroOpen && "rotate-180"
                      )} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {financeiroSubItems.map((item) => (
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

        {/* Catálogos */}
        <SidebarGroup>
          <SidebarGroupLabel>Catálogos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible open={catalogosOpen} onOpenChange={setCatalogosOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton 
                      isActive={catalogosSubItems.some(item => isActive(item.to))}
                      className="justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        <span>Catálogos</span>
                      </div>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        catalogosOpen && "rotate-180"
                      )} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {catalogosSubItems.map((item) => (
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

        {/* Configurações */}
        <SidebarGroup>
          <SidebarGroupLabel>Configurações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/admin/branding')}>
                  <RouterNavLink to="/admin/branding">
                    <Palette className="h-4 w-4" />
                    <span>Personalização</span>
                  </RouterNavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/admin/tutoriais')}>
                  <RouterNavLink to="/admin/tutoriais">
                    <Video className="h-4 w-4" />
                    <span>Tutoriais</span>
                  </RouterNavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export function AdminLayout() {
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
