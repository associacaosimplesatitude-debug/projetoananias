import { Navigate } from "react-router-dom";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import { useAuth } from "@/hooks/useAuth";

interface RequireSuperadminProps {
  children: React.ReactNode;
}

export default function RequireSuperadmin({ children }: RequireSuperadminProps) {
  const { user, loading: authLoading } = useAuth();
  const { isSuperadmin, isLoading } = useIsSuperadmin();

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isSuperadmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
