import { NavLink, Outlet } from "react-router-dom";
import { 
  TrendingUp, 
  Package, 
  Users, 
  UserX, 
  User,
  BookOpen,
  FileText,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserProfileDropdown } from "@/components/layout/UserProfileDropdown";
import { useAuth } from "@/hooks/useAuth";

export function AdminEBDLayout() {
  const { role } = useAuth();
  const isGerenteEbd = role === 'gerente_ebd';

  const menuItems = [
    { to: "/admin/ebd", icon: TrendingUp, label: "Painel Admin", end: true },
    { to: "/admin/ebd/propostas", icon: FileText, label: "Pedidos e Propostas" },
    { to: "/admin/ebd/pedidos-online", icon: Package, label: "Pedidos Igrejas" },
    { to: "/admin/ebd/pedidos-cg", icon: ShoppingBag, label: "Pedidos Online" },
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
