import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardUserContext } from '@/hooks/useDashboardUserContext';

interface ModuleProtectedRouteProps {
  children: React.ReactNode;
  requiredModule: string;
}

export default function ModuleProtectedRoute({ children, requiredModule }: ModuleProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const { context, isLoading, error, refetch } = useDashboardUserContext();

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (error || !context) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted-foreground">Não foi possível carregar seus dados. Tente novamente.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // Admins have access to everything
  if (role === 'admin') {
    return <>{children}</>;
  }

  const isEbd = requiredModule === 'REOBOTE EBD';

  // Vendedores, superintendentes, leads, alunos e professores acessam rotas EBD
  if (
    isEbd &&
    (context.is_vendedor ||
      context.is_superintendente ||
      context.is_lead_reativacao ||
      context.is_aluno ||
      context.is_professor)
  ) {
    return <>{children}</>;
  }

  // Check if user has the required module active
  if (!context.active_modules?.includes(requiredModule)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
