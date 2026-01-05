import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DescontosCategoriaRepresentante } from "@/lib/descontosShopify";

export function useDescontosRepresentante(clienteId: string | null) {
  return useQuery({
    queryKey: ["descontos-categoria-representante", clienteId],
    queryFn: async (): Promise<DescontosCategoriaRepresentante> => {
      if (!clienteId) return {};

      const { data, error } = await supabase
        .from("ebd_descontos_categoria_representante")
        .select("categoria, percentual_desconto")
        .eq("cliente_id", clienteId);

      if (error) {
        console.error("Erro ao buscar descontos:", error);
        return {};
      }

      const descontosMap: DescontosCategoriaRepresentante = {};
      data?.forEach((d) => {
        descontosMap[d.categoria] = Number(d.percentual_desconto);
      });

      return descontosMap;
    },
    enabled: !!clienteId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
