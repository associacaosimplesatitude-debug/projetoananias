import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MultiLicencaPacoteContext {
  hasMultiLicencaPacote: boolean;
  isLoading: boolean;
}

/**
 * Verifica se o cliente (ebd_clientes.id) possui pacote ativo do Plano Multi-Licença
 * (revista_licencas com origem='nova_loja_cg').
 */
export function useMultiLicencaPacote(clienteId: string | null | undefined): MultiLicencaPacoteContext {
  const { data, isLoading } = useQuery({
    queryKey: ["multi-licenca-pacote", clienteId],
    enabled: !!clienteId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revista_licencas")
        .select("id")
        .eq("superintendente_id", clienteId!)
        .eq("origem", "nova_loja_cg")
        .limit(1);
      if (error) {
        console.warn("[useMultiLicencaPacote]", error.message);
        return false;
      }
      return (data?.length ?? 0) > 0;
    },
  });

  if (!clienteId) {
    return { hasMultiLicencaPacote: false, isLoading: false };
  }

  return {
    hasMultiLicencaPacote: !!data,
    isLoading,
  };
}
