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
      // Pode existir mais de um ebd_clientes para o mesmo superintendente_user_id
      // (cadastros duplicados em onboarding). Buscamos todos e priorizamos o que
      // possui licença Multi-Licença (origem='nova_loja_cg').
      const { data: clientes, error } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, nome_superintendente, created_at")
        .eq("superintendente_user_id", user!.id)
        .eq("status_ativacao_ebd", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[useSuperintendente]", error.message);
        return null;
      }
      if (!clientes || clientes.length === 0) return null;

      // Verifica qual desses clientes tem pacote Multi-Licença
      const ids = clientes.map((c) => c.id);
      const { data: licencas } = await supabase
        .from("revista_licencas")
        .select("superintendente_id")
        .in("superintendente_id", ids)
        .eq("origem", "nova_loja_cg")
        .limit(50);

      const comLicenca = new Set((licencas ?? []).map((l) => l.superintendente_id));
      const escolhido =
        clientes.find((c) => comLicenca.has(c.id)) ?? clientes[0];

      return escolhido;
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
