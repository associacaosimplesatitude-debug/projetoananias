import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type NovidadeTipo = "nova_funcao" | "correcao";

export interface Novidade {
  id: string;
  tipo: NovidadeTipo;
  titulo: string;
  descricao_curta: string;
  descricao_completa: string;
  versao: string | null;
  data_publicacao: string;
  ativo: boolean;
  audience_type: string;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  lida: boolean;
  lido_em: string | null;
}

export function useNovidades() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["system-news", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_system_news_for_user" as any)
        .select("*")
        .order("data_publicacao", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Novidade[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  // Realtime: invalida ao publicar/atualizar
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel("system_news_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_news" },
        () => qc.invalidateQueries({ queryKey: ["system-news"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, qc]);

  const novidades = query.data || [];
  const naoLidas = novidades.filter((n) => !n.lida);
  const naoLidasCount = naoLidas.length;
  const naoLidasPorTipo = {
    nova_funcao: naoLidas.filter((n) => n.tipo === "nova_funcao").length,
    correcao: naoLidas.filter((n) => n.tipo === "correcao").length,
  };
  const totalPorTipo = {
    nova_funcao: novidades.filter((n) => n.tipo === "nova_funcao").length,
    correcao: novidades.filter((n) => n.tipo === "correcao").length,
  };

  const marcarComoLida = useMutation({
    mutationFn: async (newsId: string) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("system_news_reads")
        .upsert(
          { news_id: newsId, user_id: user.id },
          { onConflict: "news_id,user_id", ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-news"] }),
  });

  const marcarTodasComoLidas = useMutation({
    mutationFn: async () => {
      if (!user?.id || naoLidas.length === 0) return;
      const rows = naoLidas.map((n) => ({ news_id: n.id, user_id: user.id }));
      const { error } = await supabase
        .from("system_news_reads")
        .upsert(rows, { onConflict: "news_id,user_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-news"] }),
  });

  return {
    novidades,
    naoLidasCount,
    naoLidasPorTipo,
    totalPorTipo,
    isLoading: query.isLoading,
    marcarComoLida,
    marcarTodasComoLidas,
  };
}
