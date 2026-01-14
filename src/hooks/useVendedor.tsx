import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useImpersonation } from "@/contexts/ImpersonationContext";

export type TipoPerfil = 'vendedor' | 'representante';

interface Vendedor {
  id: string;
  nome: string;
  email: string;
  email_bling: string | null;
  comissao_percentual: number;
  meta_mensal_valor: number;
  tipo_perfil: TipoPerfil;
  status: string;
  foto_url: string | null;
}

export function useVendedor() {
  const { user, loading: authLoading } = useAuth();
  const { impersonatedVendedor, isImpersonating } = useImpersonation();

  const { data: vendedor, isLoading: vendedorLoading, refetch } = useQuery({
    queryKey: ["vendedor", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data, error } = await supabase
        .from("vendedores")
        .select("*")
        .eq("email", user.email)
        .maybeSingle();
      if (error) throw error;
      return data as Vendedor | null;
    },
    enabled: !!user?.email && !isImpersonating,
  });

  // If impersonating, use impersonated vendedor data
  const activeVendedor = isImpersonating ? impersonatedVendedor : vendedor;

  const isVendedor = activeVendedor?.tipo_perfil === 'vendedor';
  const isRepresentante = activeVendedor?.tipo_perfil === 'representante';

  return {
    vendedor: activeVendedor,
    tipoPerfil: activeVendedor?.tipo_perfil || null,
    isVendedor,
    isRepresentante,
    isLoading: authLoading || (!isImpersonating && vendedorLoading),
    isImpersonating,
    refetch,
  };
}
