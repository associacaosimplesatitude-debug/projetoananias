import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SorteioEvento {
  id: string;
  nome: string;
  slug: string | null;
  ativo: boolean;
  banner_url: string | null;
  titulo: string | null;
  subtitulo: string | null;
  descricao: string | null;
  premio_destaque: string | null;
  cor_primaria: string | null;
  texto_botao_cta: string | null;
  mostrar_campo_embaixadora: boolean;
  data_inicio: string | null;
  data_fim: string | null;
  created_at: string;
  updated_at: string;
}

export function useSorteioEventoAtivo() {
  return useQuery({
    queryKey: ["sorteio-evento-ativo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sorteio_eventos" as any)
        .select("*")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SorteioEvento | null;
    },
    refetchInterval: 60_000,
  });
}
