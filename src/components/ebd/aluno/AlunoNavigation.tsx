import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Users, BookOpen, Calendar, User } from "lucide-react";
import { useBrandingSettings } from "@/hooks/useBrandingSettings";
import { useDomainBranding } from "@/hooks/useDomainBranding";
import { UserProfileDropdown } from "@/components/layout/UserProfileDropdown";
import logoAnanias from "@/assets/logo_ananias_horizontal.png";

const menuItems = [
  { path: "/ebd/aluno", label: "Início", icon: Home },
  { path: "/ebd/aluno/turma", label: "Minha Turma", icon: Users },
  { path: "/ebd/aluno/aulas", label: "Aulas", icon: BookOpen },
  { path: "/ebd/aluno/leituras", label: "Leitura", icon: Calendar },
  { path: "/ebd/aluno/perfil", label: "Perfil", icon: User },
];

export function AlunoNavigation() {
  const location = useLocation();
  const { data: brandingSettings } = useBrandingSettings();
  const domainBranding = useDomainBranding();

  // Use domain branding as primary, fallback to DB settings
  const navBgColor = brandingSettings?.nav_background_color || domainBranding.navBackgroundColor;
  const navTextColor = brandingSettings?.nav_text_color || domainBranding.navTextColor;
  const accentColor = brandingSettings?.accent_color || domainBranding.accentColor;
  const logoUrl = brandingSettings?.nav_logo_url || domainBranding.logoHorizontalUrl || logoAnanias;

  return (
    <nav 
      className="border-b sticky top-0 z-40"
      style={{ backgroundColor: navBgColor, color: navTextColor }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <img src={logoUrl} alt="Logo" className="h-10" />
          </div>

          {/* Menu Items */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const navItemId = `aluno-nav-${item.path.replace(/\//g, "-")}`;

              return (
                <div key={item.path}>
                  <style>
                    {`
                      #${navItemId}.active {
                        background-color: ${accentColor} !important;
                        opacity: 1 !important;
                      }
                    `}
                  </style>
                  <Link
                    id={navItemId}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap hover:bg-white/10",
                      isActive ? "active" : ""
                    )}
                    style={{ color: navTextColor, opacity: isActive ? 1 : 0.8 }}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                </div>
              );
            })}
          </div>

          {/* User Profile */}
          <div className="flex items-center">
            <UserProfileDropdown />
          </div>
        </div>
      </div>
    </nav>
  );
}
