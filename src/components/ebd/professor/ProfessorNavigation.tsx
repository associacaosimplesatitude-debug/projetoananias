import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Calendar, 
  Users, 
  BookOpen, 
  ClipboardList,
  Trophy,
  BarChart3
} from "lucide-react";

const menuItems = [
  { path: "/ebd/professor", label: "Início", icon: Home },
  { path: "/ebd/professor/escala", label: "Minha Escala", icon: Calendar },
  { path: "/ebd/professor/classe", label: "Minha Classe", icon: Users },
  { path: "/ebd/professor/aulas", label: "Aulas e Materiais", icon: BookOpen },
  { path: "/ebd/professor/lancamentos", label: "Lançamentos", icon: ClipboardList },
  { path: "/ebd/professor/quizzes", label: "Quizzes", icon: Trophy },
  { path: "/ebd/professor/relatorios", label: "Relatórios", icon: BarChart3 },
];

export function ProfessorNavigation() {
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
