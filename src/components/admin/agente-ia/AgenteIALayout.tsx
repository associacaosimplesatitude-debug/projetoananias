import { Outlet, NavLink, Navigate, useLocation } from "react-router-dom";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/admin/agente-ia", label: "Início", end: true },
  { to: "/admin/agente-ia/aprovacoes", label: "Aprovações" },
  { to: "/admin/agente-ia/conversas", label: "Conversas" },
  { to: "/admin/agente-ia/escalations", label: "Escalations" },
  { to: "/admin/agente-ia/metricas", label: "Métricas" },
];

export function AgenteIALayout() {
  const { isSuperadmin, isLoading } = useIsSuperadmin();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperadmin) {
    return <Navigate to="/admin" replace state={{ from: location }} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agente IA — Supervisão</h1>
        <p className="text-sm text-muted-foreground">
          Painel exclusivo do superadmin para aprovar, editar ou recusar respostas do agente.
        </p>
      </div>

      <div className="border-b">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted",
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
