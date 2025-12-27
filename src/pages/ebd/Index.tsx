import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function EBDIndex() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: ebdCliente, isLoading } = useQuery({
    queryKey: ["ebd-index-cliente", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("tipo_cliente")
        .eq("superintendente_user_id", user.id)
        .eq("status_ativacao_ebd", true)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (isLoading) return;
    // Revendedor entra direto no catálogo
    if (ebdCliente?.tipo_cliente === "REVENDEDOR") {
      navigate("/ebd/shopify-pedidos", { replace: true });
      return;
    }

    // Demais perfis EBD
    navigate("/ebd/dashboard", { replace: true });
  }, [navigate, ebdCliente?.tipo_cliente, isLoading]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}
