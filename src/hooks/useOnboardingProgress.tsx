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
  revistaIdentificadaFaixaEtaria: string | null;
  revistaIdentificadaNumLicoes: number | null;
  progressoPercentual: number;
  concluido: boolean;
  descontoObtido: number | null;
  dataAniversario: string | null;
  cupomAniversarioDisponivel: boolean;
  modoRecompra: boolean; // Indica se está no modo de recompra (simplificado)
}

// Etapas completas (primeira revista - inclui configurações e aniversário)
const ETAPAS_COMPLETAS: Omit<OnboardingEtapa, "completada" | "completadaEm">[] = [
  { id: 1, titulo: "Aplicar Revista", descricao: "Aplique pelo menos uma das revistas compradas" },
  { id: 2, titulo: "Cadastrar Turma", descricao: "Cadastre pelo menos 1 turma" },
  { id: 3, titulo: "Cadastrar Professor", descricao: "Cadastre pelo menos 1 professor" },
  { id: 4, titulo: "Definir Data de Início", descricao: "Marque a data de início das aulas" },
  { id: 5, titulo: "Criar Escala", descricao: "Adicione professores às aulas (crie a escala inicial)" },
  { id: 7, titulo: "Configurar Lançamento", descricao: "Configure como será feita a chamada e lançamentos" },
  { id: 6, titulo: "Data de Aniversário", descricao: "Informe sua data de aniversário para ganhar um presente especial!" },
];

// Etapas para revistas adicionais (mesma compra - sem configurações e aniversário)
const ETAPAS_REVISTA_ADICIONAL: Omit<OnboardingEtapa, "completada" | "completadaEm">[] = [
  { id: 1, titulo: "Aplicar Revista", descricao: "Aplique a revista comprada" },
  { id: 2, titulo: "Cadastrar Turma", descricao: "Cadastre a turma para esta revista" },
  { id: 3, titulo: "Cadastrar Professor", descricao: "Adicione professores para a turma" },
  { id: 4, titulo: "Definir Data de Início", descricao: "Defina a data de início das aulas" },
  { id: 5, titulo: "Criar Escala", descricao: "Monte a escala de professores" },
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

      // Buscar revistas lançadas manualmente
      const { data: historicoManual } = await supabase
        .from("ebd_historico_revistas_manual")
        .select(`
          revista_id,
          ebd_revistas(id, titulo, imagem_url)
        `)
        .eq("cliente_id", churchId);

      // Buscar revistas já aplicadas (que têm planejamento)
      const { data: planejamentosData } = await supabase
        .from("ebd_planejamento")
        .select("revista_id")
        .eq("church_id", churchId);

      const revistasAplicadas = new Set(planejamentosData?.map(p => p.revista_id) || []);

      const revistasBase: RevistaBaseNaoAplicada[] = [];
      const revistasProcessadas = new Set<string>();

      // Processar revistas de pedidos
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

      // Processar revistas lançadas manualmente
      if (historicoManual) {
        for (const item of historicoManual) {
          const revista = (item as any).ebd_revistas;
          if (revista && revista.titulo) {
            const tipo = identificarTipoRevista(revista.titulo);
            // Apenas revistas BASE que não foram aplicadas e não foram processadas ainda
            if (tipo === "BASE" && !revistasAplicadas.has(revista.id) && !revistasProcessadas.has(revista.id)) {
              revistasProcessadas.add(revista.id);
              revistasBase.push({
                id: revista.id,
                titulo: revista.titulo,
                imagemUrl: revista.imagem_url,
                quantidade: 1,
              });
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

      // Buscar revistas lançadas manualmente
      const { data: historicoManualProgress } = await supabase
        .from("ebd_historico_revistas_manual")
        .select(`
          revista_id,
          ebd_revistas(id, titulo)
        `)
        .eq("cliente_id", churchId);

      const { data: planejamentosData } = await supabase
        .from("ebd_planejamento")
        .select("revista_id")
        .eq("church_id", churchId);

      const revistasAplicadas = new Set(planejamentosData?.map(p => p.revista_id) || []);
      
      // Verificar se há revistas BASE não aplicadas (de pedidos)
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

      // Verificar também revistas lançadas manualmente
      if (!temRevistaBaseNaoAplicada && historicoManualProgress) {
        for (const item of historicoManualProgress) {
          const revista = (item as any).ebd_revistas;
          if (revista && revista.titulo) {
            const tipo = identificarTipoRevista(revista.titulo);
            if (tipo === "BASE" && !revistasAplicadas.has(revista.id)) {
              temRevistaBaseNaoAplicada = true;
              break;
            }
          }
        }
      }

      // Verificar se já completou as etapas 6 e 7 (configurações e aniversário)
      // Se sim, para revistas adicionais mostramos apenas etapas 1-5
      const etapa6Completada = etapasData?.some((e: any) => e.etapa_id === 6 && e.completada) || false;
      const etapa7Completada = etapasData?.some((e: any) => e.etapa_id === 7 && e.completada) || false;
      const configuracoesJaFeitas = etapa6Completada && etapa7Completada;
      
      // Se já fez configurações (etapas 6 e 7) e tem revistas não aplicadas, usa etapas simplificadas
      const usarEtapasSimplificadas = configuracoesJaFeitas && temRevistaBaseNaoAplicada;

      // Selecionar configuração de etapas baseado no modo
      const etapasConfig = usarEtapasSimplificadas ? ETAPAS_REVISTA_ADICIONAL : ETAPAS_COMPLETAS;
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

      // Se está no modo revista adicional e tem revistas não aplicadas,
      // resetar as etapas 1-5 no BANCO DE DADOS para forçar nova configuração
      if (usarEtapasSimplificadas && temRevistaBaseNaoAplicada) {
        // Verificar se a etapa 1 ainda está marcada como completa (precisa resetar)
        const etapa1AindaCompleta = etapasMap.get(1)?.completada === true;
        
        if (etapa1AindaCompleta) {
          // Resetar etapas 1-5 no banco
          await supabase
            .from("ebd_onboarding_progress")
            .update({ completada: false, completada_em: null, revista_identificada_id: null })
            .eq("church_id", churchId)
            .in("etapa_id", [1, 2, 3, 4, 5]);
          
          // Atualizar o mapa local
          [1, 2, 3, 4, 5].forEach(etapaId => {
            etapasMap.set(etapaId, { completada: false, completadaEm: null, revistaId: null });
          });
        }
      }

      // Obter revista identificada (da etapa 1)
      const revistaId = etapasMap.get(1)?.revistaId || null;
      let revistaTitulo: string | null = null;
      let revistaImagem: string | null = null;
      let revistaFaixaEtaria: string | null = null;
      let revistaNumLicoes: number | null = null;
      
      if (revistaId) {
        const { data: revistaData } = await supabase
          .from("ebd_revistas")
          .select("titulo, imagem_url, faixa_etaria_alvo, num_licoes")
          .eq("id", revistaId)
          .single();
        revistaTitulo = revistaData?.titulo || null;
        revistaImagem = revistaData?.imagem_url || null;
        revistaFaixaEtaria = revistaData?.faixa_etaria_alvo || null;
        revistaNumLicoes = revistaData?.num_licoes || 13;
      }

      // Montar etapas
      const etapas: OnboardingEtapa[] = etapasConfig.map((config) => ({
        ...config,
        completada: etapasMap.get(config.id)?.completada || false,
        completadaEm: etapasMap.get(config.id)?.completadaEm || null,
      }));

      const etapasCompletas = etapas.filter((e) => e.completada).length;
      const progressoPercentual = Math.round((etapasCompletas / totalEtapas) * 100);

      // Se todas as etapas foram concluídas, mas o cliente ainda não foi marcado como concluído,
      // sincronizar para evitar loops de verificação/toast.
      let concluidoCliente = clienteData?.onboarding_concluido || false;
      let descontoCliente = clienteData?.desconto_onboarding || null;

      // IMPORTANTE: se o cliente JÁ está marcado como concluído no banco, respeitar esse estado
      // (evita problema de clientes antigos que foram concluídos antes do bloqueio de data)
      if (concluidoCliente) {
        // Já está concluído, não forçar como pendente
      } else if (!usarEtapasSimplificadas && etapasCompletas >= totalEtapas) {
        // Só considerar "setup concluído" se a data de aniversário (etapa final) foi salva.
        if (!clienteData?.data_aniversario_superintendente) {
          // Mantém como pendente até o superintendente informar a data.
          return {
            etapas,
            revistaIdentificadaId: revistaId,
            revistaIdentificadaTitulo: revistaTitulo,
            revistaIdentificadaImagem: revistaImagem,
            revistaIdentificadaFaixaEtaria: revistaFaixaEtaria,
            revistaIdentificadaNumLicoes: revistaNumLicoes,
            progressoPercentual,
            concluido: false,
            descontoObtido: descontoCliente,
            dataAniversario: null,
            cupomAniversarioDisponivel: false,
            modoRecompra: usarEtapasSimplificadas,
          } as OnboardingProgress;
        }

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

        concluidoCliente = true;
        descontoCliente = percentual;
      }
      // Verificar se cupom de aniversário está disponível
      const anoAtual = new Date().getFullYear();
      const dataAniversario = clienteData?.data_aniversario_superintendente || null;
      const cupomUsadoEsteAno = clienteData?.cupom_aniversario_ano === anoAtual && clienteData?.cupom_aniversario_usado;
      const ehAniversario = verificarAniversario(dataAniversario);
      const cupomAniversarioDisponivel = ehAniversario && !cupomUsadoEsteAno;

      // No modo revista adicional, considerar concluído apenas se todas as etapas estão feitas
      const concluido = usarEtapasSimplificadas ? etapas.every(e => e.completada) : concluidoCliente;

      return {
        etapas,
        revistaIdentificadaId: revistaId,
        revistaIdentificadaTitulo: revistaTitulo,
        revistaIdentificadaImagem: revistaImagem,
        revistaIdentificadaFaixaEtaria: revistaFaixaEtaria,
        revistaIdentificadaNumLicoes: revistaNumLicoes,
        progressoPercentual,
        concluido,
        descontoObtido: descontoCliente,
        dataAniversario,
        cupomAniversarioDisponivel,
        modoRecompra: usarEtapasSimplificadas, // Renomeado internamente mas mantém compatibilidade com UI
      } as OnboardingProgress;
    },
    enabled: !!churchId,
  });

  // Mutation para marcar etapa como concluída
  const marcarEtapaMutation = useMutation({
    mutationFn: async ({ etapaId, revistaId, dataAniversario }: { etapaId: number; revistaId?: string; dataAniversario?: string }) => {
      if (!churchId) throw new Error("Church ID não encontrado");

      const payload: any = {
        church_id: churchId,
        etapa_id: etapaId,
        completada: true,
        completada_em: new Date().toISOString(),
        ...(etapaId === 1 && revistaId ? { revista_identificada_id: revistaId } : {}),
      };

      const { error } = await supabase
        .from("ebd_onboarding_progress")
        .upsert(payload, { onConflict: "church_id,etapa_id" });

      if (error) throw error;

      // Se é a etapa 6 (aniversário), salvar a data
      if (etapaId === 6 && dataAniversario) {
        const { error: birthdayError } = await supabase
          .from("ebd_clientes")
          .update({ data_aniversario_superintendente: dataAniversario })
          .eq("id", churchId);
        if (birthdayError) throw birthdayError;
      }

      const usarSimplificadas = progressData?.modoRecompra || false;
      const etapasConfig = usarSimplificadas ? ETAPAS_REVISTA_ADICIONAL : ETAPAS_COMPLETAS;
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
        // No modo completo (primeiro setup), só concluir se a data de aniversário foi salva
        if (!usarSimplificadas) {
          const { data: clienteCheck, error: clienteCheckError } = await supabase
            .from("ebd_clientes")
            .select("data_aniversario_superintendente")
            .eq("id", churchId)
            .maybeSingle();

          if (clienteCheckError) throw clienteCheckError;

          if (!clienteCheck?.data_aniversario_superintendente) {
            return { concluido: false, modoRecompra: usarSimplificadas };
          }
        }

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

        return { concluido: true, desconto: percentual, modoRecompra: usarSimplificadas };
      }

      return { concluido: false, modoRecompra: usarSimplificadas };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ebd-onboarding-progress", churchId] });
      queryClient.invalidateQueries({ queryKey: ["ebd-revistas-nao-aplicadas", churchId] });

      // Aviso removido: não exibir toast automático de "Parabéns".
      void data;
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

    const usarSimplificadas = progressData.modoRecompra; // revista adicional

    // No modo revista adicional, verificar etapas 2-5 apenas com base em dados CRIADOS após aplicar a revista
    // (evita puxar turmas/professores/escalas antigas e marcar tudo como concluído)
    if (usarSimplificadas) {
      const inicioConfiguracao = progressData.etapas.find(e => e.id === 1)?.completadaEm;
      const revistaIdAtual = progressData.revistaIdentificadaId;

      if (!inicioConfiguracao) return;

      // Etapa 2: Turmas criadas após o início
      if (!progressData.etapas.find(e => e.id === 2)?.completada) {
        const { count: turmasCount, data: turmasData } = await supabase
          .from("ebd_turmas")
          .select("id", { count: "exact" })
          .eq("church_id", churchId)
          .eq("is_active", true)
          .gte("created_at", inicioConfiguracao);

        if (turmasCount && turmasCount > 0) {
          marcarEtapaMutation.mutate({ etapaId: 2 });
        }

        // Etapa 3: Professores criados após o início (ou vinculados a turmas novas)
        if (!progressData.etapas.find(e => e.id === 3)?.completada) {
          const turmaIds = (turmasData || []).map((t: any) => t.id).filter(Boolean);

          const professoresQuery = supabase
            .from("ebd_professores")
            .select("id", { count: "exact" })
            .eq("church_id", churchId)
            .eq("is_active", true)
            .gte("created_at", inicioConfiguracao);

          const { count: professoresCount } = await professoresQuery;

          if ((professoresCount && professoresCount > 0) || turmaIds.length > 0) {
            // Se criou turma nova, o próximo passo é professor; mas só marcamos professor quando existir pelo menos 1 professor novo.
            if (professoresCount && professoresCount > 0) {
              marcarEtapaMutation.mutate({ etapaId: 3 });
            }
          }
        }
      }

      // Etapa 4: Planejamento da revista atual criado após o início
      if (!progressData.etapas.find(e => e.id === 4)?.completada && revistaIdAtual) {
        const { count: planejamentosCount } = await supabase
          .from("ebd_planejamento")
          .select("*", { count: "exact", head: true })
          .eq("church_id", churchId)
          .eq("revista_id", revistaIdAtual)
          .gte("created_at", inicioConfiguracao);

        if (planejamentosCount && planejamentosCount > 0) {
          marcarEtapaMutation.mutate({ etapaId: 4 });
        }
      }

      // Etapa 5: Escalas criadas após o início
      if (!progressData.etapas.find(e => e.id === 5)?.completada) {
        const { count: escalasCount } = await supabase
          .from("ebd_escalas")
          .select("*", { count: "exact", head: true })
          .eq("church_id", churchId)
          .gte("created_at", inicioConfiguracao);

        if (escalasCount && escalasCount > 0) {
          marcarEtapaMutation.mutate({ etapaId: 5 });
        }
      }

      return;
    }

    // Modo completo (primeira configuração) - verificar todas as etapas

    // Etapa 1: Verificar se aplicou pelo menos uma revista
    if (!progressData.etapas.find(e => e.id === 1)?.completada) {
      const { data: planejamentos } = await supabase
        .from("ebd_planejamento")
        .select("revista_id")
        .eq("church_id", churchId);
      
      if (planejamentos && planejamentos.length > 0) {
        if (!revistasNaoAplicadas || revistasNaoAplicadas.length === 0) {
          marcarEtapaMutation.mutate({ etapaId: 1 });
        }
      }
    }

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

    // Etapa 7: Verificar se configurou lançamento
    // Essa etapa deve ser marcada MANUALMENTE pelo usuário ao abrir o dialog de configuração
    // Não verificar automaticamente baseado em turmas - isso era um bug que marcava 
    // a etapa 7 junto com a etapa 2 (ambas verificavam turmas)
  }, [churchId, progressData, revistasNaoAplicadas, marcarEtapaMutation]);

  // Verificar etapas automaticamente ao carregar e quando mudar dados relevantes
  useEffect(() => {
    if (progressData && !progressData.concluido && churchId && !marcarEtapaMutation.isPending) {
      // Adicionar pequeno delay para garantir que os dados foram salvos
      const timer = setTimeout(() => {
        verificarEtapasAutomaticamente();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [progressData?.concluido, progressData?.modoRecompra, churchId, verificarEtapasAutomaticamente, marcarEtapaMutation.isPending]);

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
