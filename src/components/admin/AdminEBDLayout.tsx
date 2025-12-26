import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserProfileDropdown } from "@/components/layout/UserProfileDropdown";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AdminEBDLayout() {
  const { role } = useAuth();
  const location = useLocation();
  const isGerenteEbd = role === 'gerente_ebd';

  // Check if current path is within pedidos
  const isPedidosActive = location.pathname.includes('/admin/ebd/pedidos');

  const pedidosSubItems = [
    { to: "/admin/ebd/pedidos-igrejas", icon: Church, label: "Igrejas" },
    { to: "/admin/ebd/pedidos-online", icon: ShoppingBag, label: "Online" },
    { to: "/admin/ebd/pedidos-advecs", icon: Church, label: "ADVECS" },
    { to: "/admin/ebd/pedidos-atacado", icon: Boxes, label: "Atacado" },
    { to: "/admin/ebd/pedidos-amazon", icon: Package, label: "Amazon" },
    { to: "/admin/ebd/pedidos-shopee", icon: Store, label: "Shopee" },
    { to: "/admin/ebd/pedidos-mercadolivre", icon: ShoppingCart, label: "Mercado Livre" },
  ];

  const menuItems = [
    { to: "/admin/ebd", icon: TrendingUp, label: "Painel Admin", end: true },
    { to: "/admin/ebd/propostas", icon: FileText, label: "Pedidos e Propostas" },
    { to: "/admin/ebd/aprovacao-faturamento", icon: ClipboardCheck, label: "Aprovação Financeira" },
  ];

  const afterPedidosItems = [
    { to: "/admin/ebd/clientes", icon: Users, label: "Clientes EBD" },
    { to: "/admin/ebd/leads", icon: UserX, label: "Leads Reativação" },
    { to: "/admin/ebd/vendedores", icon: User, label: "Vendedores" },
    ...(!isGerenteEbd ? [{ to: "/admin/ebd/catalogo", icon: BookOpen, label: "Catálogo" }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Bar Only */}
      <header className="border-b bg-background">
        <nav className="container mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto py-3">
            {/* Main menu items before Pedidos */}
            {menuItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}

            {/* Pedidos dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                    isPedidosActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Package className="h-4 w-4" />
                  Pedidos
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {pedidosSubItems.map((item) => (
                  <DropdownMenuItem key={item.to} asChild>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2 w-full cursor-pointer",
                          isActive && "bg-accent"
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Menu items after Pedidos */}
            {afterPedidosItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
            
            <div className="ml-auto">
              <UserProfileDropdown />
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
