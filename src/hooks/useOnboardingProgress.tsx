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

export interface RevistaBaseNaoAplicada {
  id: string;
  titulo: string;
  imagemUrl: string | null;
  quantidade: number;
}

export interface OnboardingProgress {
  etapas: OnboardingEtapa[];
  revistaIdentificadaId: string | null;
  revistaIdentificadaTitulo: string | null;
  revistaIdentificadaImagem: string | null;
  progressoPercentual: number;
  concluido: boolean;
  descontoObtido: number | null;
  dataAniversario: string | null;
  cupomAniversarioDisponivel: boolean;
  modoRecompra: boolean; // Indica se está no modo de recompra (simplificado)
}

// Etapas do primeiro onboarding (completo)
const ETAPAS_PRIMEIRO_ONBOARDING: Omit<OnboardingEtapa, "completada" | "completadaEm">[] = [
  { id: 1, titulo: "Aplicar Revista", descricao: "Aplique pelo menos uma das revistas compradas" },
  { id: 2, titulo: "Cadastrar Turma", descricao: "Cadastre pelo menos 1 turma" },
  { id: 3, titulo: "Cadastrar Professor", descricao: "Cadastre pelo menos 1 professor" },
  { id: 4, titulo: "Definir Data de Início", descricao: "Marque a data de início das aulas" },
  { id: 5, titulo: "Criar Escala", descricao: "Adicione professores às aulas (crie a escala inicial)" },
  { id: 6, titulo: "Data de Aniversário", descricao: "Informe sua data de aniversário para ganhar um presente especial!" },
];

// Etapas da gamificação de recompra (simplificada)
const ETAPAS_RECOMPRA: Omit<OnboardingEtapa, "completada" | "completadaEm">[] = [
  { id: 1, titulo: "Aplicar Nova Revista", descricao: "Aplique a nova revista comprada" },
  { id: 4, titulo: "Definir Data de Início", descricao: "Defina a data de início das aulas para a nova revista" },
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

// Verificar se é o aniversário do superintendente
export const verificarAniversario = (dataAniversario: string | null): boolean => {
  if (!dataAniversario) return false;
  
  const hoje = new Date();
  const [ano, mes, dia] = dataAniversario.split("-").map(Number);
  
  return hoje.getDate() === dia && (hoje.getMonth() + 1) === mes;
};

// Função para identificar se é revista BASE (Aluno) ou SUPORTE (Professor)
export const identificarTipoRevista = (titulo: string): "BASE" | "SUPORTE" => {
  const tituloUpper = titulo.toUpperCase();
  if (tituloUpper.includes("PROFESSOR") || tituloUpper.includes("MESTRE")) {
    return "SUPORTE";
  }
  return "BASE"; // Padrão é BASE (Aluno)
};

export const useOnboardingProgress = (churchId: string | null) => {
  const queryClient = useQueryClient();

  // Buscar todas as revistas BASE não aplicadas
  const { data: revistasNaoAplicadas } = useQuery({
    queryKey: ["ebd-revistas-nao-aplicadas", churchId],
    queryFn: async (): Promise<RevistaBaseNaoAplicada[]> => {
      if (!churchId) return [];

      // Buscar todas as revistas BASE dos pedidos pagos
      const { data: pedidosData } = await supabase
        .from("ebd_shopify_pedidos")
        .select(`
          id,
          order_date,
          ebd_shopify_pedidos_itens(
            revista_id,
            quantidade,
            ebd_revistas(id, titulo, imagem_url)
          )
        `)
        .eq("cliente_id", churchId)
        .eq("status_pagamento", "paid")
        .order("order_date", { ascending: false });

      // Buscar revistas já aplicadas (que têm planejamento)
      const { data: planejamentosData } = await supabase
        .from("ebd_planejamento")
        .select("revista_id")
        .eq("church_id", churchId);

      const revistasAplicadas = new Set(planejamentosData?.map(p => p.revista_id) || []);

      const revistasBase: RevistaBaseNaoAplicada[] = [];
      const revistasProcessadas = new Set<string>();

      if (pedidosData) {
        for (const pedido of pedidosData) {
          const itens = (pedido as any).ebd_shopify_pedidos_itens || [];
          for (const item of itens) {
            const revista = item.ebd_revistas;
            if (revista && revista.titulo) {
              const tipo = identificarTipoRevista(revista.titulo);
              // Apenas revistas BASE que não foram aplicadas e não foram processadas ainda
              if (tipo === "BASE" && !revistasAplicadas.has(revista.id) && !revistasProcessadas.has(revista.id)) {
                revistasProcessadas.add(revista.id);
                revistasBase.push({
                  id: revista.id,
                  titulo: revista.titulo,
                  imagemUrl: revista.imagem_url,
                  quantidade: item.quantidade || 1,
                });
              }
            }
          }
        }
      }

      return revistasBase;
    },
    enabled: !!churchId,
  });

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

      // Buscar dados do cliente
      const { data: clienteData } = await supabase
        .from("ebd_clientes")
        .select("onboarding_concluido, desconto_onboarding, data_aniversario_superintendente, cupom_aniversario_usado, cupom_aniversario_ano")
        .eq("id", churchId)
        .maybeSingle();

      // Verificar se há revistas BASE não aplicadas (indica recompra)
      const { data: pedidosData } = await supabase
        .from("ebd_shopify_pedidos")
        .select(`
          id,
          ebd_shopify_pedidos_itens(
            revista_id,
            ebd_revistas(id, titulo)
          )
        `)
        .eq("cliente_id", churchId)
        .eq("status_pagamento", "paid");

      const { data: planejamentosData } = await supabase
        .from("ebd_planejamento")
        .select("revista_id")
        .eq("church_id", churchId);

      const revistasAplicadas = new Set(planejamentosData?.map(p => p.revista_id) || []);
      
      // Verificar se há revistas BASE não aplicadas
      let temRevistaBaseNaoAplicada = false;
      if (pedidosData) {
        for (const pedido of pedidosData) {
          const itens = (pedido as any).ebd_shopify_pedidos_itens || [];
          for (const item of itens) {
            const revista = item.ebd_revistas;
            if (revista && revista.titulo) {
              const tipo = identificarTipoRevista(revista.titulo);
              if (tipo === "BASE" && !revistasAplicadas.has(revista.id)) {
                temRevistaBaseNaoAplicada = true;
                break;
              }
            }
          }
          if (temRevistaBaseNaoAplicada) break;
        }
      }

      // Determinar se é modo recompra: onboarding já foi concluído uma vez E tem nova revista não aplicada
      const primeiroOnboardingConcluido = clienteData?.onboarding_concluido === true;
      const modoRecompra = primeiroOnboardingConcluido && temRevistaBaseNaoAplicada;

      // Selecionar configuração de etapas baseado no modo
      const etapasConfig = modoRecompra ? ETAPAS_RECOMPRA : ETAPAS_PRIMEIRO_ONBOARDING;
      const totalEtapas = etapasConfig.length;

      // Montar o mapa de etapas completadas
      const etapasMap = new Map<number, { completada: boolean; completadaEm: string | null; revistaId: string | null }>();
      etapasData?.forEach((e: any) => {
        etapasMap.set(e.etapa_id, {
          completada: e.completada,
          completadaEm: e.completada_em,
          revistaId: e.revista_identificada_id,
        });
      });

      // Se é modo recompra, resetar progresso das etapas 1 e 4 se não aplicou a nova revista
      if (modoRecompra) {
        // Verificar se etapa 1 (aplicar revista) está "concluída" mas ainda tem revistas não aplicadas
        // Nesse caso, resetar para forçar aplicação das novas revistas
        if (temRevistaBaseNaoAplicada) {
          etapasMap.set(1, { completada: false, completadaEm: null, revistaId: null });
          etapasMap.set(4, { completada: false, completadaEm: null, revistaId: null });
        }
      }

      // Obter revista identificada (da etapa 1)
      const revistaId = etapasMap.get(1)?.revistaId || null;
      let revistaTitulo: string | null = null;
      let revistaImagem: string | null = null;
      
      if (revistaId) {
        const { data: revistaData } = await supabase
          .from("ebd_revistas")
          .select("titulo, imagem_url")
          .eq("id", revistaId)
          .single();
        revistaTitulo = revistaData?.titulo || null;
        revistaImagem = revistaData?.imagem_url || null;
      }

      // Montar etapas
      const etapas: OnboardingEtapa[] = etapasConfig.map((config) => ({
        ...config,
        completada: etapasMap.get(config.id)?.completada || false,
        completadaEm: etapasMap.get(config.id)?.completadaEm || null,
      }));

      const etapasCompletas = etapas.filter((e) => e.completada).length;
      const progressoPercentual = Math.round((etapasCompletas / totalEtapas) * 100);

      // Verificar se cupom de aniversário está disponível
      const anoAtual = new Date().getFullYear();
      const dataAniversario = clienteData?.data_aniversario_superintendente || null;
      const cupomUsadoEsteAno = clienteData?.cupom_aniversario_ano === anoAtual && clienteData?.cupom_aniversario_usado;
      const ehAniversario = verificarAniversario(dataAniversario);
      const cupomAniversarioDisponivel = ehAniversario && !cupomUsadoEsteAno;

      // No modo recompra, considerar concluído apenas se todas as etapas de recompra estão feitas
      const concluido = modoRecompra 
        ? etapas.every(e => e.completada)
        : (clienteData?.onboarding_concluido || false);

      return {
        etapas,
        revistaIdentificadaId: revistaId,
        revistaIdentificadaTitulo: revistaTitulo,
        revistaIdentificadaImagem: revistaImagem,
        progressoPercentual,
        concluido,
        descontoObtido: clienteData?.desconto_onboarding || null,
        dataAniversario,
        cupomAniversarioDisponivel,
        modoRecompra,
      } as OnboardingProgress;
    },
    enabled: !!churchId,
  });

  // Mutation para marcar etapa como concluída
  const marcarEtapaMutation = useMutation({
    mutationFn: async ({ etapaId, revistaId, dataAniversario }: { etapaId: number; revistaId?: string; dataAniversario?: string }) => {
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

      // Se é a etapa 6 (aniversário), salvar a data
      if (etapaId === 6 && dataAniversario) {
        await supabase
          .from("ebd_clientes")
          .update({ data_aniversario_superintendente: dataAniversario })
          .eq("id", churchId);
      }

      const modoRecompra = progressData?.modoRecompra || false;
      const etapasConfig = modoRecompra ? ETAPAS_RECOMPRA : ETAPAS_PRIMEIRO_ONBOARDING;
      const totalEtapas = etapasConfig.length;

      // Verificar se todas as etapas foram concluídas
      const { data: todasEtapas } = await supabase
        .from("ebd_onboarding_progress")
        .select("etapa_id, completada")
        .eq("church_id", churchId);

      // Contar apenas as etapas relevantes para o modo atual
      const etapasRelevantes = etapasConfig.map(e => e.id);
      const etapasCompletas = todasEtapas?.filter((e: any) => 
        e.completada && etapasRelevantes.includes(e.etapa_id)
      ).length || 0;

      // Se todas as etapas foram concluídas
      if (etapasCompletas >= totalEtapas) {
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

        return { concluido: true, desconto: percentual, modoRecompra };
      }

      return { concluido: false, modoRecompra };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ebd-onboarding-progress", churchId] });
      queryClient.invalidateQueries({ queryKey: ["ebd-revistas-nao-aplicadas", churchId] });
      
      if (data.concluido) {
        const mensagem = data.modoRecompra 
          ? `🎉 Parabéns! Você configurou a nova revista e ganhou ${data.desconto}% de desconto na próxima compra!`
          : `🎉 Parabéns! Você completou o onboarding e ganhou ${data.desconto}% de desconto na próxima compra!`;
        toast.success(mensagem, { duration: 8000 });
      }
    },
    onError: (error) => {
      console.error("Erro ao marcar etapa:", error);
    },
  });

  // Mutation para usar cupom de aniversário
  const usarCupomAniversarioMutation = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("Church ID não encontrado");

      const anoAtual = new Date().getFullYear();
      
      await supabase
        .from("ebd_clientes")
        .update({
          cupom_aniversario_usado: true,
          cupom_aniversario_ano: anoAtual,
        })
        .eq("id", churchId);

      return { sucesso: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ebd-onboarding-progress", churchId] });
      toast.success("🎂 Cupom de aniversário de R$50 aplicado! Aproveite sua compra!", { duration: 6000 });
    },
  });

  // Verificar e atualizar automaticamente as etapas baseado no estado atual
  const verificarEtapasAutomaticamente = useCallback(async () => {
    if (!churchId || !progressData) return;

    const modoRecompra = progressData.modoRecompra;

    if (modoRecompra) {
      // No modo recompra, verificar apenas etapas 1 e 4
      // Etapa 1: Verificar se aplicou pelo menos uma nova revista
      if (!progressData.etapas.find(e => e.id === 1)?.completada) {
        const { data: planejamentos } = await supabase
          .from("ebd_planejamento")
          .select("revista_id")
          .eq("church_id", churchId);
        
        // Se tem planejamento, a etapa 1 está completa
        if (planejamentos && planejamentos.length > 0) {
          // Mas precisamos verificar se ainda tem revistas não aplicadas
          // Se não tem mais revistas não aplicadas, marcar como concluída
          if (!revistasNaoAplicadas || revistasNaoAplicadas.length === 0) {
            marcarEtapaMutation.mutate({ etapaId: 1 });
          }
        }
      }

      // Etapa 4: Verificar se tem planejamento com data de início
      if (!progressData.etapas.find(e => e.id === 4)?.completada) {
        const { count: planejamentosCount } = await supabase
          .from("ebd_planejamento")
          .select("*", { count: "exact", head: true })
          .eq("church_id", churchId);

        if (planejamentosCount && planejamentosCount > 0) {
          marcarEtapaMutation.mutate({ etapaId: 4 });
        }
      }
    } else {
      // Modo completo (primeiro onboarding)
      
      // Etapa 2: Verificar se tem turmas
      if (!progressData.etapas.find(e => e.id === 2)?.completada) {
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
      if (!progressData.etapas.find(e => e.id === 3)?.completada) {
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
      if (!progressData.etapas.find(e => e.id === 4)?.completada) {
        const { count: planejamentosCount } = await supabase
          .from("ebd_planejamento")
          .select("*", { count: "exact", head: true })
          .eq("church_id", churchId);

        if (planejamentosCount && planejamentosCount > 0) {
          marcarEtapaMutation.mutate({ etapaId: 4 });
        }
      }

      // Etapa 5: Verificar se tem escalas
      if (!progressData.etapas.find(e => e.id === 5)?.completada) {
        const { count: escalasCount } = await supabase
          .from("ebd_escalas")
          .select("*", { count: "exact", head: true })
          .eq("church_id", churchId);

        if (escalasCount && escalasCount > 0) {
          marcarEtapaMutation.mutate({ etapaId: 5 });
        }
      }

      // Etapa 6: Verificar se tem data de aniversário cadastrada
      if (!progressData.etapas.find(e => e.id === 6)?.completada && progressData.dataAniversario) {
        marcarEtapaMutation.mutate({ etapaId: 6 });
      }
    }
  }, [churchId, progressData, revistasNaoAplicadas, marcarEtapaMutation]);

  // Verificar etapas automaticamente ao carregar
  useEffect(() => {
    if (progressData && !progressData.concluido) {
      verificarEtapasAutomaticamente();
    }
  }, [progressData?.concluido, progressData?.modoRecompra]);

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
          queryClient.invalidateQueries({ queryKey: ["ebd-revistas-nao-aplicadas", churchId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [churchId, queryClient]);

  return {
    progress: progressData,
    revistasNaoAplicadas: revistasNaoAplicadas || [],
    isLoading,
    marcarEtapa: (etapaId: number, revistaId?: string, dataAniversario?: string) => 
      marcarEtapaMutation.mutate({ etapaId, revistaId, dataAniversario }),
    verificarEtapas: verificarEtapasAutomaticamente,
    isMarking: marcarEtapaMutation.isPending,
    usarCupomAniversario: usarCupomAniversarioMutation.mutate,
    isUsandoCupom: usarCupomAniversarioMutation.isPending,
  };
};
