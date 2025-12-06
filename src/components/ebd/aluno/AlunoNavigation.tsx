import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Users, BookOpen, Calendar, User } from "lucide-react";

const menuItems = [
  { path: "/ebd/aluno", label: "Início", icon: Home },
  { path: "/ebd/aluno/turma", label: "Minha Turma", icon: Users },
  { path: "/ebd/aluno/aulas", label: "Aulas", icon: BookOpen },
  { path: "/ebd/aluno/leituras", label: "Leitura", icon: Calendar },
  { path: "/ebd/aluno/perfil", label: "Perfil", icon: User },
];

export function AlunoNavigation() {
  const location = useLocation();

  return (
    <nav className="bg-card border-b sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 overflow-x-auto">
          <div className="flex items-center gap-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
