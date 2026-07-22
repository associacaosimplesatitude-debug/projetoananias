import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";

interface Props {
  children: React.ReactNode;
}

/**
 * Permite acesso ao relatório de campanha para:
 * - superadmins
 * - role admin
 * - role gerente_ebd
 */
export default function RequireCampaignReportAccess({ children }: Props) {
  const { user, role, loading: authLoading } = useAuth();
  const { isSuperadmin, isLoading } = useIsSuperadmin();

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const allowed = isSuperadmin || role === "admin" || role === "gerente_ebd";
  if (!allowed) return <Navigate to="/" replace />;

  return <>{children}</>;
}
