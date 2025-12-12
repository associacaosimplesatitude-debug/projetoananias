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
import { useDomainBranding } from "@/hooks/useDomainBranding";
import logoAnanias from "@/assets/logo_ananias_horizontal.png";

const menuItems = [
  { to: "/vendedor", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/vendedor/clientes", icon: Users, label: "Clientes" },
  { to: "/vendedor/pendentes", icon: Clock, label: "Pendentes" },
  { to: "/vendedor/proximas-compras", icon: ShoppingCart, label: "Próximas Compras" },
  { to: "/vendedor/em-risco", icon: AlertTriangle, label: "Em Risco" },
  { to: "/vendedor/leads", icon: UserCheck, label: "Reativação" },
  { to: "/vendedor/pedidos", icon: Package, label: "Pedidos" },
  { to: "/vendedor/shopify", icon: Store, label: "Fazer Pedido" },
];

export function VendedorLayout() {
  const domainBranding = useDomainBranding();
  const logoUrl = domainBranding.logoHorizontalUrl || logoAnanias;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoUrl} alt={domainBranding.appName} className="h-8" />
            <h1 className="text-xl font-bold">{domainBranding.appName === 'Gestão EBD' ? 'Painel do Vendedor EBD' : 'Painel do Vendedor'}</h1>
          </div>
          <UserProfileDropdown />
        </div>
        
        {/* Menu Navigation */}
        <nav className="container mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
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
