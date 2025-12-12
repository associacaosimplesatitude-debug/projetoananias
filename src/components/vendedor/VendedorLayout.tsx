import { NavLink, Outlet } from "react-router-dom";
import { 
  Users, 
  Clock, 
  ShoppingCart, 
  AlertTriangle, 
  UserCheck,
  Package,
  LayoutDashboard,
  Store
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserProfileDropdown } from "@/components/layout/UserProfileDropdown";

const menuItems = [
  { to: "/vendedor", icon: LayoutDashboard, label: "Painel do Vendedor", end: true },
  { to: "/vendedor/clientes", icon: Users, label: "Clientes" },
  { to: "/vendedor/pendentes", icon: Clock, label: "Pendentes" },
  { to: "/vendedor/proximas-compras", icon: ShoppingCart, label: "Próximas Compras" },
  { to: "/vendedor/em-risco", icon: AlertTriangle, label: "Em Risco" },
  { to: "/vendedor/leads", icon: UserCheck, label: "Reativação" },
  { to: "/vendedor/pedidos", icon: Package, label: "Pedidos" },
  { to: "/vendedor/shopify", icon: Store, label: "Fazer Pedido" },
];

export function VendedorLayout() {
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
