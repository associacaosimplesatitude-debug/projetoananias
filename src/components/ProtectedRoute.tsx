import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowGerenteEbd?: boolean;
  allowFinanceiro?: boolean;
  allowGerenteSorteio?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false, allowGerenteEbd = false, allowFinanceiro = false, allowGerenteSorteio = false }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRole();

  if (authLoading || (requireAdmin && rolesLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requireAdmin) {
    const isAdmin = roles.includes('admin');
    const isGerenteEbd = roles.includes('gerente_ebd');
    const isFinanceiro = roles.includes('financeiro');
    const isGerenteSorteio = roles.includes('gerente_sorteio');
    
    if (!isAdmin && !(allowGerenteEbd && isGerenteEbd) && !(allowFinanceiro && isFinanceiro) && !(allowGerenteSorteio && isGerenteSorteio)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
