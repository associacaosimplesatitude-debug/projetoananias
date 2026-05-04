import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ImplementacaoTipo = "nova_funcao" | "correcao";

export interface Implementacao {
  id: string;
  tipo: ImplementacaoTipo;
  titulo: string;
  descricao_curta: string;
  descricao_completa: string | null;
  versao: string | null;
  categoria: string | null;
  data_publicacao: string;
  ativo: boolean;
  audience_type: string;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  lida: boolean;
  lido_em: string | null;
}

export function useImplementacoes() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["implementacoes-feed", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_implementacoes_for_user")
        .select("*")
        .order("data_publicacao", { ascending: false });
      if (error) throw error;
      return (data || []) as Implementacao[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel("implementacoes_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "implementacoes" },
        () => qc.invalidateQueries({ queryKey: ["implementacoes-feed"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, qc]);

  const lista = query.data || [];
  const naoLidas = lista.filter((n) => !n.lida);
  const naoLidasCount = naoLidas.length;
  const totalPorTipo = {
    nova_funcao: lista.filter((n) => n.tipo === "nova_funcao").length,
    correcao: lista.filter((n) => n.tipo === "correcao").length,
  };

  const marcarComoLida = useMutation({
    mutationFn: async (implId: string) => {
      if (!user?.id) return;
      const { error } = await (supabase as any)
        .from("implementacoes_reads")
        .upsert(
          { implementacao_id: implId, user_id: user.id },
          { onConflict: "implementacao_id,user_id", ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["implementacoes-feed"] }),
  });

  const marcarTodasComoLidas = useMutation({
    mutationFn: async () => {
      if (!user?.id || naoLidas.length === 0) return;
      const rows = naoLidas.map((n) => ({ implementacao_id: n.id, user_id: user.id }));
      const { error } = await (supabase as any)
        .from("implementacoes_reads")
        .upsert(rows, { onConflict: "implementacao_id,user_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["implementacoes-feed"] }),
  });

  return {
    novidades: lista,
    naoLidasCount,
    totalPorTipo,
    isLoading: query.isLoading,
    marcarComoLida,
    marcarTodasComoLidas,
  };
}
