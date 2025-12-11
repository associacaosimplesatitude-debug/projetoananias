import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowGerenteEbd?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false, allowGerenteEbd = false }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
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
    const isAdmin = role === 'admin';
    const isGerenteEbd = role === 'gerente_ebd';
    
    // Allow access if user is admin, or if allowGerenteEbd is true and user is gerente_ebd
    if (!isAdmin && !(allowGerenteEbd && isGerenteEbd)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
