import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Users, BookOpen, Calendar, User, Video, Menu, X, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { useBrandingSettings } from "@/hooks/useBrandingSettings";
import { useDomainBranding } from "@/hooks/useDomainBranding";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logoAnanias from "@/assets/logo_ananias_horizontal.png";

const menuItems = [
  { path: "/ebd/aluno", label: "Início", icon: Home },
  { path: "/ebd/aluno/turma", label: "Minha Turma", icon: Users },
  { path: "/ebd/aluno/aulas", label: "Aulas", icon: BookOpen },
  { path: "/ebd/aluno/leituras", label: "Leitura", icon: Calendar },
  { path: "/ebd/aluno/perfil", label: "Perfil", icon: User },
  { path: "/tutoriais", label: "Tutoriais", icon: Video },
];

export function AlunoLayout() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: brandingSettings } = useBrandingSettings();
  const domainBranding = useDomainBranding();

  const navBgColor = brandingSettings?.nav_background_color || domainBranding.navBackgroundColor;
  const navTextColor = brandingSettings?.nav_text_color || domainBranding.navTextColor;
  const rawAccentColor = brandingSettings?.accent_color || domainBranding.accentColor;
  const logoUrl = brandingSettings?.nav_logo_url || domainBranding.logoHorizontalUrl || logoAnanias;

  // Check if accent color is too dark and use fallback
  const isColorTooDark = (hex: string): boolean => {
    if (!hex || !hex.startsWith("#")) return false;
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.2;
  };

  const accentColor = isColorTooDark(rawAccentColor) ? "#3b82f6" : rawAccentColor;

  // Get aluno data for avatar
  const { data: aluno } = useQuery({
    queryKey: ["aluno-layout", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("ebd_alunos")
        .select("nome_completo, avatar_url")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const SidebarContent = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="flex flex-col h-full">

      {/* Menu Items */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onItemClick}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "text-white"
                      : "hover:bg-white/10 opacity-80 hover:opacity-100"
                  )}
                  style={{
                    color: navTextColor,
                    backgroundColor: isActive ? accentColor : "transparent",
                  }}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-white/10">
        <div className={cn(
          "flex items-center gap-3 mb-3",
          sidebarCollapsed && "justify-center"
        )}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={aluno?.avatar_url || undefined} className="object-cover" />
            <AvatarFallback style={{ backgroundColor: accentColor, color: navTextColor }}>
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: navTextColor }}>
                {aluno?.nome_completo?.split(" ")[0] || "Aluno"}
              </p>
              <p className="text-xs opacity-70 truncate" style={{ color: navTextColor }}>
                Aluno EBD
              </p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size={sidebarCollapsed ? "icon" : "default"}
          className={cn(
            "w-full hover:bg-white/10",
            sidebarCollapsed && "p-2"
          )}
          style={{ color: navTextColor }}
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {!sidebarCollapsed && <span className="ml-2">Sair</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col transition-all duration-300 sticky top-0 h-screen",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
        style={{ backgroundColor: navBgColor }}
      >
        <SidebarContent />
        
        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-20 h-6 w-6 rounded-full border bg-background shadow-md hover:bg-muted"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>
      </aside>

      {/* Mobile Header + Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header
          className="md:hidden flex items-center justify-between px-4 h-14 border-b sticky top-0 z-40"
          style={{ backgroundColor: navBgColor }}
        >
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" style={{ color: navTextColor }}>
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-64 p-0 border-0"
              style={{ backgroundColor: navBgColor }}
            >
              <SidebarContent onItemClick={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <img src={logoUrl} alt="Logo" className="h-8" />

          <Avatar className="h-8 w-8">
            <AvatarImage src={aluno?.avatar_url || undefined} className="object-cover" />
            <AvatarFallback style={{ backgroundColor: accentColor, color: navTextColor }}>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
