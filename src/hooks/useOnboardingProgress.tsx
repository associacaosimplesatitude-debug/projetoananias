import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OnboardingEtapa {
  id: number;
  titulo: string;
  descricao: string;
  completada: boolean;
  completadaEm: string | null;
}

export interface OnboardingProgress {
  etapas: OnboardingEtapa[];
  revistaIdentificadaId: string | null;
  revistaIdentificadaTitulo: string | null;
  progressoPercentual: number;
  concluido: boolean;
  descontoObtido: number | null;
}

const ETAPAS_CONFIG: Omit<OnboardingEtapa, "completada" | "completadaEm">[] = [
  { id: 1, titulo: "Aplicar Revista", descricao: "Clique em 'Aplicar Agora' na revista identificada" },
  { id: 2, titulo: "Cadastrar Turma", descricao: "Cadastre pelo menos 1 turma" },
  { id: 3, titulo: "Cadastrar Professor", descricao: "Cadastre pelo menos 1 professor" },
  { id: 4, titulo: "Definir Data de Início", descricao: "Marque a data de início das aulas" },
  { id: 5, titulo: "Criar Escala", descricao: "Adicione professores às aulas (crie a escala inicial)" },
];

// Função para calcular o desconto baseado no valor da compra
export const calcularDesconto = (valorCompra: number): { percentual: number; valorMaximo: number } => {
  if (valorCompra >= 501) {
    return { percentual: 30, valorMaximo: valorCompra * 0.30 };
  } else if (valorCompra >= 301) {
    return { percentual: 25, valorMaximo: valorCompra * 0.25 };
  } else {
    return { percentual: 20, valorMaximo: Math.min(valorCompra * 0.20, 300 * 0.20) };
  }
};

export const useOnboardingProgress = (churchId: string | null) => {
  const queryClient = useQueryClient();

  // Buscar progresso do onboarding
  const { data: progressData, isLoading } = useQuery({
    queryKey: ["ebd-onboarding-progress", churchId],
    queryFn: async () => {
      if (!churchId) return null;

      // Buscar progresso das etapas
      const { data: etapasData, error: etapasError } = await supabase
        .from("ebd_onboarding_progress")
        .select("*")
        .eq("church_id", churchId);

      if (etapasError) throw etapasError;

      // Buscar se onboarding já foi concluído
      const { data: clienteData, error: clienteError } = await supabase
        .from("ebd_clientes")
        .select("onboarding_concluido, desconto_onboarding")
        .eq("id", churchId)
        .maybeSingle();

      // Montar o mapa de etapas completadas
      const etapasMap = new Map<number, { completada: boolean; completadaEm: string | null; revistaId: string | null }>();
      etapasData?.forEach((e: any) => {
        etapasMap.set(e.etapa_id, {
          completada: e.completada,
          completadaEm: e.completada_em,
          revistaId: e.revista_identificada_id,
        });
      });

      // Obter revista identificada (da etapa 1)
      const revistaId = etapasMap.get(1)?.revistaId || null;
      let revistaTitulo: string | null = null;
      
      if (revistaId) {
        const { data: revistaData } = await supabase
          .from("ebd_revistas")
          .select("titulo")
          .eq("id", revistaId)
          .single();
        revistaTitulo = revistaData?.titulo || null;
      }

      // Montar etapas
      const etapas: OnboardingEtapa[] = ETAPAS_CONFIG.map((config) => ({
        ...config,
        completada: etapasMap.get(config.id)?.completada || false,
        completadaEm: etapasMap.get(config.id)?.completadaEm || null,
      }));

      const etapasCompletas = etapas.filter((e) => e.completada).length;
      const progressoPercentual = Math.round((etapasCompletas / 5) * 100);

      return {
        etapas,
        revistaIdentificadaId: revistaId,
        revistaIdentificadaTitulo: revistaTitulo,
        progressoPercentual,
        concluido: clienteData?.onboarding_concluido || false,
        descontoObtido: clienteData?.desconto_onboarding || null,
      } as OnboardingProgress;
    },
    enabled: !!churchId,
  });

  // Identificar revista mais recente do cliente
  const { data: revistaIdentificada } = useQuery({
    queryKey: ["ebd-revista-identificada", churchId],
    queryFn: async () => {
      if (!churchId) return null;

      // Primeiro, tentar pelo cliente_id no ebd_shopify_pedidos
      const { data: pedidoData, error: pedidoError } = await supabase
        .from("ebd_shopify_pedidos")
        .select(`
          id,
          order_date,
          ebd_shopify_pedidos_itens(
            revista_id,
            ebd_revistas(id, titulo, imagem_url)
          )
        `)
        .eq("cliente_id", churchId)
        .eq("status_pagamento", "paid")
        .order("order_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const item = pedidoData?.ebd_shopify_pedidos_itens?.[0] as any;
      if (item?.ebd_revistas) {
        const revista = item.ebd_revistas;
        return {
          id: revista.id,
          titulo: revista.titulo,
          imagemUrl: revista.imagem_url,
        };
      }

      // Fallback: buscar pelo planejamento mais recente
      const { data: planejamentoData } = await supabase
        .from("ebd_planejamento")
        .select(`
          revista:ebd_revistas(id, titulo, imagem_url)
        `)
        .eq("church_id", churchId)
        .order("data_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (planejamentoData?.revista) {
        const revista = planejamentoData.revista as any;
        return {
          id: revista.id,
          titulo: revista.titulo,
          imagemUrl: revista.imagem_url,
        };
      }

      return null;
    },
    enabled: !!churchId,
  });

  // Mutation para marcar etapa como concluída
  const marcarEtapaMutation = useMutation({
    mutationFn: async ({ etapaId, revistaId }: { etapaId: number; revistaId?: string }) => {
      if (!churchId) throw new Error("Church ID não encontrado");

      const { error } = await supabase
        .from("ebd_onboarding_progress")
        .upsert(
          {
            church_id: churchId,
            etapa_id: etapaId,
            completada: true,
            completada_em: new Date().toISOString(),
            revista_identificada_id: etapaId === 1 ? revistaId : undefined,
          },
          { onConflict: "church_id,etapa_id" }
        );

      if (error) throw error;

      // Verificar se todas as etapas foram concluídas
      const { data: todasEtapas } = await supabase
        .from("ebd_onboarding_progress")
        .select("completada")
        .eq("church_id", churchId);

      const etapasCompletas = todasEtapas?.filter((e: any) => e.completada).length || 0;

      // Se todas as 5 etapas foram concluídas, calcular e salvar o desconto
      if (etapasCompletas >= 5) {
        // Calcular desconto baseado no valor do último pedido
        const { data: ultimoPedido } = await supabase
          .from("ebd_shopify_pedidos")
          .select("valor_total")
          .eq("cliente_id", churchId)
          .order("order_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        const valorCompra = ultimoPedido?.valor_total || 300;
        const { percentual } = calcularDesconto(valorCompra);

        await supabase
          .from("ebd_clientes")
          .update({
            onboarding_concluido: true,
            onboarding_concluido_em: new Date().toISOString(),
            desconto_onboarding: percentual,
          })
          .eq("id", churchId);

        return { concluido: true, desconto: percentual };
      }

      return { concluido: false };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ebd-onboarding-progress", churchId] });
      
      if (data.concluido) {
        toast.success(
          `🎉 Parabéns! Você completou o onboarding e ganhou ${data.desconto}% de desconto na próxima compra!`,
          { duration: 8000 }
        );
      }
    },
    onError: (error) => {
      console.error("Erro ao marcar etapa:", error);
    },
  });

  // Verificar e atualizar automaticamente as etapas baseado no estado atual
  const verificarEtapasAutomaticamente = useCallback(async () => {
    if (!churchId || !progressData) return;

    // Etapa 2: Verificar se tem turmas
    if (!progressData.etapas[1]?.completada) {
      const { count: turmasCount } = await supabase
        .from("ebd_turmas")
        .select("*", { count: "exact", head: true })
        .eq("church_id", churchId)
        .eq("is_active", true);

      if (turmasCount && turmasCount > 0) {
        marcarEtapaMutation.mutate({ etapaId: 2 });
      }
    }

    // Etapa 3: Verificar se tem professores
    if (!progressData.etapas[2]?.completada) {
      const { count: professoresCount } = await supabase
        .from("ebd_professores")
        .select("*", { count: "exact", head: true })
        .eq("church_id", churchId)
        .eq("is_active", true);

      if (professoresCount && professoresCount > 0) {
        marcarEtapaMutation.mutate({ etapaId: 3 });
      }
    }

    // Etapa 4: Verificar se tem planejamento com data de início
    if (!progressData.etapas[3]?.completada) {
      const { count: planejamentosCount } = await supabase
        .from("ebd_planejamento")
        .select("*", { count: "exact", head: true })
        .eq("church_id", churchId);

      if (planejamentosCount && planejamentosCount > 0) {
        marcarEtapaMutation.mutate({ etapaId: 4 });
      }
    }

    // Etapa 5: Verificar se tem escalas
    if (!progressData.etapas[4]?.completada) {
      const { count: escalasCount } = await supabase
        .from("ebd_escalas")
        .select("*", { count: "exact", head: true })
        .eq("church_id", churchId);

      if (escalasCount && escalasCount > 0) {
        marcarEtapaMutation.mutate({ etapaId: 5 });
      }
    }
  }, [churchId, progressData, marcarEtapaMutation]);

  // Verificar etapas automaticamente ao carregar
  useEffect(() => {
    if (progressData && !progressData.concluido) {
      verificarEtapasAutomaticamente();
    }
  }, [progressData?.concluido]);

  // Realtime subscription
  useEffect(() => {
    if (!churchId) return;

    const channel = supabase
      .channel(`onboarding-progress-${churchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ebd_onboarding_progress",
          filter: `church_id=eq.${churchId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ebd-onboarding-progress", churchId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [churchId, queryClient]);

  return {
    progress: progressData,
    revistaIdentificada,
    isLoading,
    marcarEtapa: (etapaId: number, revistaId?: string) => 
      marcarEtapaMutation.mutate({ etapaId, revistaId }),
    verificarEtapas: verificarEtapasAutomaticamente,
    isMarking: marcarEtapaMutation.isPending,
  };
};
