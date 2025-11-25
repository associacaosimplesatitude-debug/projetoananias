import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function EBDIndex() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redireciona automaticamente para o dashboard do EBD
    navigate('/ebd/dashboard', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}