import { Navigate, useLocation } from "react-router-dom";
import { useVendedor } from "@/hooks/useVendedor";
import { Loader2 } from "lucide-react";

interface VendedorProtectedRouteProps {
  children: React.ReactNode;
  vendedorOnly?: boolean; // If true, only vendedor can access, not representante
}

export function VendedorProtectedRoute({ children, vendedorOnly = false }: VendedorProtectedRouteProps) {
  const { vendedor, isRepresentante, isLoading } = useVendedor();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is not a vendedor/representante at all, redirect to auth
  if (!vendedor) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If this route is vendedor-only and user is a representante, redirect to vendedor home
  if (vendedorOnly && isRepresentante) {
    return <Navigate to="/vendedor" replace />;
  }

  return <>{children}</>;
}