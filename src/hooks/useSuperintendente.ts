import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SuperintendenteContext {
  isLoading: boolean;
  isSuperintendente: boolean;
  clienteId: string | null;
  nomeIgreja: string | null;
  nomeSuperintendente: string | null;
}

export function useSuperintendente(): SuperintendenteContext {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["superintendente", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, nome_superintendente")
        .eq("superintendente_user_id", user!.id)
        .eq("status_ativacao_ebd", true)
        .maybeSingle();
      if (error) {
        console.warn("[useSuperintendente]", error.message);
        return null;
      }
      return data;
    },
  });

  if (!user) {
    return {
      isLoading: false,
      isSuperintendente: false,
      clienteId: null,
      nomeIgreja: null,
      nomeSuperintendente: null,
    };
  }

  return {
    isLoading,
    isSuperintendente: !!data,
    clienteId: data?.id ?? null,
    nomeIgreja: data?.nome_igreja ?? null,
    nomeSuperintendente: (data as any)?.nome_superintendente ?? null,
  };
}
