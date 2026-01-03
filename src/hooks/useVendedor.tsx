import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
    enabled: !!user?.email,
  });

  const isVendedor = vendedor?.tipo_perfil === 'vendedor';
  const isRepresentante = vendedor?.tipo_perfil === 'representante';

  return {
    vendedor,
    tipoPerfil: vendedor?.tipo_perfil || null,
    isVendedor,
    isRepresentante,
    isLoading: authLoading || vendedorLoading,
    refetch,
  };
}
