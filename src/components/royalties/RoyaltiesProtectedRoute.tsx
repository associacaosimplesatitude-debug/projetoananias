import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRoyaltiesAuth } from '@/hooks/useRoyaltiesAuth';

interface RoyaltiesProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireAutor?: boolean;
}

export function RoyaltiesProtectedRoute({ 
  children, 
  requireAdmin = false,
  requireAutor = false 
}: RoyaltiesProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasRoyaltiesAccess, isAutor, loading: royaltiesLoading } = useRoyaltiesAuth();

  const isLoading = authLoading || royaltiesLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check access based on requirements
  if (requireAdmin && !hasRoyaltiesAccess) {
    return <Navigate to="/" replace />;
  }

  if (requireAutor && !isAutor && !hasRoyaltiesAccess) {
    return <Navigate to="/" replace />;
  }

  // Default: allow if has admin access OR is an autor
  if (!hasRoyaltiesAccess && !isAutor) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
