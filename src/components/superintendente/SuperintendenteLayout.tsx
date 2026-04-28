import { Link, Outlet, useLocation } from "react-router-dom";
import { Home, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useSuperintendente } from "@/hooks/useSuperintendente";
import { cn } from "@/lib/utils";

const NAV_BG = "#1B3A5C";
const NAV_TEXT = "#FFFFFF";
const ACCENT = "#FFC107";

const menuItems = [
  { path: "/superintendente", label: "Início", icon: Home, exact: true },
];

export function SuperintendenteLayout() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { nomeIgreja, nomeSuperintendente } = useSuperintendente();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const NavList = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex flex-col md:flex-row md:items-center gap-1">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path, item.exact);
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClick}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              active ? "text-[color:var(--se-text)]" : "opacity-80 hover:opacity-100"
            )}
            style={{
              backgroundColor: active ? ACCENT : "transparent",
              color: active ? "#1B3A5C" : NAV_TEXT,
            }}
          >
            <Icon className="w-4 h-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header
        className="sticky top-0 z-40 border-b"
        style={{ backgroundColor: NAV_BG, color: NAV_TEXT }}
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden hover:bg-white/10"
                  style={{ color: NAV_TEXT }}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-4" style={{ backgroundColor: NAV_BG }}>
                <div className="mb-6">
                  <p className="text-sm font-bold" style={{ color: NAV_TEXT }}>
                    Editora Central Gospel
                  </p>
                  <p className="text-xs opacity-70" style={{ color: NAV_TEXT }}>
                    Portal do Superintendente
                  </p>
                </div>
                <NavList onClick={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight truncate">
                Editora Central Gospel
              </p>
              <p className="text-[11px] opacity-70 leading-tight truncate">
                Portal do Superintendente
              </p>
            </div>
          </div>

          <div className="hidden md:block">
            <NavList />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right min-w-0">
              <p className="text-xs font-medium leading-tight truncate max-w-[180px]">
                {nomeSuperintendente || "Superintendente"}
              </p>
              <p className="text-[11px] opacity-70 leading-tight truncate max-w-[180px]">
                {nomeIgreja || "—"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="hover:bg-white/10"
              style={{ color: NAV_TEXT }}
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
