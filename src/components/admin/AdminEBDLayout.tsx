import { NavLink, Outlet } from "react-router-dom";
import { 
  TrendingUp, 
  Package, 
  Users, 
  UserX, 
  User,
  BookOpen,
  LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserProfileDropdown } from "@/components/layout/UserProfileDropdown";
import { useDomainBranding } from "@/hooks/useDomainBranding";
import { useAuth } from "@/hooks/useAuth";
import logoAnanias from "@/assets/logo_ananias_horizontal.png";

export function AdminEBDLayout() {
  const domainBranding = useDomainBranding();
  const { role } = useAuth();
  const isGerenteEbd = role === 'gerente_ebd';
  const logoUrl = domainBranding.logoHorizontalUrl || logoAnanias;

  const menuItems = [
    { to: "/admin/ebd", icon: TrendingUp, label: "Vendas", end: true },
    { to: "/admin/ebd/pedidos", icon: Package, label: "Pedidos" },
    { to: "/admin/ebd/clientes", icon: Users, label: "Clientes EBD" },
    { to: "/admin/ebd/leads", icon: UserX, label: "Leads Reativação" },
    { to: "/admin/ebd/vendedores", icon: User, label: "Vendedores" },
    ...(!isGerenteEbd ? [{ to: "/admin/ebd/catalogo", icon: BookOpen, label: "Catálogo" }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoUrl} alt={domainBranding.appName} className="h-8" />
            <h1 className="text-xl font-bold">Painel Admin EBD</h1>
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
