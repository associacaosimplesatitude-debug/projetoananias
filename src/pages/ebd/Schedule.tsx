import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEbdChurchId } from "@/hooks/useEbdChurchId";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Eye, BookOpen, Pencil, Trash2, ChevronLeft, ChevronRight, User, CheckCircle2, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EditarEscalaDialog } from "@/components/ebd/EditarEscalaDialog";
import { MontarEscalaDialog } from "@/components/ebd/MontarEscalaDialog";
import { Progress } from "@/components/ui/progress";


interface Planejamento {
  id: string;
  revista_id?: string;
  data_inicio: string;
  data_termino: string;
  dia_semana: string;
  revista: {
    id: string;
    titulo: string;
    imagem_url: string | null;
    faixa_etaria_alvo: string;
    num_licoes?: number;
  };
  turma?: {
    id: string;
    nome: string;
    faixa_etaria: string;
  };
  temEscalas?: boolean;
}

interface Escala {
  id: string;
  data: string;
  sem_aula: boolean;
  professor_id: string | null;
  professor_id_2?: string | null;
  turma_id: string;
  tipo: string;
  observacao: string | null;
  professor: {
    nome_completo: string;
    avatar_url: string | null;
  } | null;
  professor2?: {
    nome_completo: string;
    avatar_url: string | null;
  } | null;
  turma: {
    id: string;
    nome: string;
    faixa_etaria: string;
  };
}

export default function EBDSchedule() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPlanejamento, setSelectedPlanejamento] = useState<Planejamento | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [escalaToEdit, setEscalaToEdit] = useState<Escala | null>(null);
  const [escalaToDelete, setEscalaToDelete] = useState<Escala | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showMontarEscalaDialog, setShowMontarEscalaDialog] = useState(false);
  const [planejamentoParaMontarEscala, setPlanejamentoParaMontarEscala] = useState<any>(null);

  // Buscar dados da igreja (suporta promoted superintendentes, ebd_clientes e churches)
  const { data: churchData } = useEbdChurchId();


  // Buscar planejamentos com turma via escalas
  const { data: planejamentos } = useQuery({
    queryKey: ['ebd-planejamentos-with-turmas', churchData?.id],
    queryFn: async () => {
      if (!churchData?.id) return [];
      
      // Buscar planejamentos
      const { data: planejamentosData0, error: planError } = await supabase
        .from('ebd_planejamento')
        .select(`
          id,
          revista_id,
          data_inicio,
          data_termino,
          dia_semana,
          revista:ebd_revistas(id, titulo, imagem_url, faixa_etaria_alvo, num_licoes)
        `)
        .eq('church_id', churchData.id)
        .order('created_at', { ascending: false });

      if (planError) throw planError;

      // Buscar escalas para obter turmas associadas e contagem
      const { data: escalasData, error: escError } = await supabase
        .from('ebd_escalas')
        .select(`
          data,
          sem_aula,
          observacao,
          turma:ebd_turmas(id, nome, faixa_etaria)
        `)
        .eq('church_id', churchData.id);

      if (escError) throw escError;

      // Reparar automaticamente casos antigos onde existe ebd_escalas mas não existe ebd_planejamento
      // (por exemplo, escalas criadas via "Ativar Revistas" antes do planejamento ser criado)
      if ((planejamentosData0?.length || 0) === 0 && (escalasData?.length || 0) > 0) {
        const grupos = new Map<string, { titulo: string; turma: any; min: string; max: string }>();

        const extrairTituloDaObservacao = (obs: string | null) => {
          if (!obs) return null;
          const parts = obs.split(' - ');
          if (parts.length >= 2) return parts.slice(1).join(' - ').trim();
          return null;
        };

        for (const e of escalasData || []) {
          const titulo = extrairTituloDaObservacao((e as any).observacao);
          if (!titulo) continue;
          const key = `${(e.turma as any)?.id || 'sem-turma'}::${titulo}`;
          const data = e.data;

          const atual = grupos.get(key);
          if (!atual) {
            grupos.set(key, {
              titulo,
              turma: e.turma,
              min: data,
              max: data,
            });
          } else {
            if (data < atual.min) atual.min = data;
            if (data > atual.max) atual.max = data;
          }
        }

        for (const g of grupos.values()) {
          // 1) Garantir ebd_revistas
          const { data: revistaExistente, error: revErr } = await supabase
            .from('ebd_revistas')
            .select('id')
            .eq('titulo', g.titulo)
            .maybeSingle();
          if (revErr) throw revErr;

          let revistaId = revistaExistente?.id as string | undefined;
          if (!revistaId) {
            const { data: revistaNova, error: revInsErr } = await supabase
              .from('ebd_revistas')
              .insert({
                titulo: g.titulo,
                faixa_etaria_alvo: (g.turma as any)?.faixa_etaria || 'Geral',
              })
              .select('id')
              .single();
            if (revInsErr) throw revInsErr;
            revistaId = revistaNova.id;
          }

          // 2) Garantir ebd_planejamento
          const { data: planExistente, error: planExistErr } = await supabase
            .from('ebd_planejamento')
            .select('id')
            .eq('church_id', churchData.id)
            .eq('revista_id', revistaId)
            .eq('data_inicio', g.min)
            .maybeSingle();
          if (planExistErr) throw planExistErr;

          if (!planExistente?.id) {
            const diaSemana = format(parseISO(g.min), 'EEEE', { locale: ptBR });
            const { error: planInsErr } = await supabase
              .from('ebd_planejamento')
              .insert({
                church_id: churchData.id,
                revista_id: revistaId,
                data_inicio: g.min,
                data_termino: g.max,
                dia_semana: diaSemana,
              });
            if (planInsErr) throw planInsErr;
          }
        }
      }

      // Recarregar planejamentos (caso tenha criado automaticamente acima)
      const { data: planejamentosData, error: planReloadError } = await supabase
        .from('ebd_planejamento')
        .select(`
          id,
          revista_id,
          data_inicio,
          data_termino,
          dia_semana,
          revista:ebd_revistas(id, titulo, imagem_url, faixa_etaria_alvo, num_licoes)
        `)
        .eq('church_id', churchData.id)
        .order('created_at', { ascending: false });

      if (planReloadError) throw planReloadError;

      const hoje = startOfDay(new Date());

      // Mapear turmas para planejamentos baseado nas datas e faixa etária da revista
      const result = planejamentosData?.map(plan => {
        const escalasDoPlan = escalasData?.filter(e => 
          e.data >= plan.data_inicio && e.data <= plan.data_termino
        );
        
        // Encontrar a turma que corresponde à faixa etária da revista
        const faixaRevista = (plan.revista as any)?.faixa_etaria_alvo || '';
        const turmaCorrespondente = escalasDoPlan?.find(e => {
          const turmaFaixa = (e.turma as any)?.faixa_etaria || '';
          // Match exato ou parcial (ex: "15-17 anos" contém "15-17")
          return turmaFaixa === faixaRevista || 
                 turmaFaixa.includes(faixaRevista.split(':')[0]) ||
                 faixaRevista.includes(turmaFaixa.split(':')[0]);
        })?.turma;
        
        const turma = turmaCorrespondente || escalasDoPlan?.[0]?.turma;
        const temEscalas = escalasDoPlan && escalasDoPlan.length > 0;
        
        // Calcular progresso: aulas ministradas (datas passadas sem sem_aula)
        const aulasMinistradas = escalasDoPlan?.filter(e => 
          !e.sem_aula && isBefore(parseISO(e.data), hoje)
        ).length || 0;
        
        const totalLicoes = (plan.revista as any)?.num_licoes || 13;
        const percentual = Math.min(100, Math.round((aulasMinistradas / totalLicoes) * 100));
        
        return {
          ...plan,
          turma,
          temEscalas,
          progresso: { ministradas: aulasMinistradas, total: totalLicoes, percentual }
        };
      });

      return result as unknown as (Planejamento & { 
        revista_id: string;
        temEscalas: boolean;
        progresso: { ministradas: number; total: number; percentual: number } 
      })[];
    },
    enabled: !!churchData?.id,
  });

  // Função para obter a cor do progresso baseada no percentual
  const getProgressColor = (percentual: number) => {
    if (percentual >= 80) return "bg-green-500";
    if (percentual >= 30) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Buscar escalas do planejamento selecionado (filtrado por turma_id)
  const { data: escalas } = useQuery({
    queryKey: ['ebd-escalas-planejamento', selectedPlanejamento?.id, churchData?.id, selectedPlanejamento?.turma?.id],
    queryFn: async () => {
      if (!churchData?.id || !selectedPlanejamento) return [];
      
      let query = supabase
        .from('ebd_escalas')
        .select(`
          id,
          data,
          sem_aula,
          professor_id,
          professor_id_2,
          turma_id,
          tipo,
          observacao,
          professor:ebd_professores!ebd_escalas_professor_id_fkey(nome_completo, avatar_url),
          professor2:ebd_professores!ebd_escalas_professor_id_2_fkey(nome_completo, avatar_url),
          turma:ebd_turmas(id, nome, faixa_etaria)
        `)
        .eq('church_id', churchData.id)
        .gte('data', selectedPlanejamento.data_inicio)
        .lte('data', selectedPlanejamento.data_termino);
      
      // Filtrar por turma_id se disponível para evitar misturar escalas de turmas diferentes
      if (selectedPlanejamento.turma?.id) {
        query = query.eq('turma_id', selectedPlanejamento.turma.id);
      }
      
      const { data, error } = await query.order('data');

      if (error) throw error;
      return data as unknown as Escala[];
    },
    enabled: !!churchData?.id && !!selectedPlanejamento,
  });

  // Mutation para excluir escala individual
  const deleteEscalaMutation = useMutation({
    mutationFn: async (escalaId: string) => {
      const { error } = await supabase
        .from('ebd_escalas')
        .delete()
        .eq('id', escalaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebd-escalas'] });
      queryClient.invalidateQueries({ queryKey: ['ebd-escalas-planejamento'] });
      queryClient.invalidateQueries({ queryKey: ['ebd-planejamentos-with-turmas'] });
      toast.success('Escala excluída com sucesso!');
      setEscalaToDelete(null);
    },
    onError: () => {
      toast.error('Erro ao excluir escala');
    },
  });

  // Mutation para excluir todas as escalas de um planejamento/turma
  const deleteAllEscalasMutation = useMutation({
    mutationFn: async ({ turmaId, dataInicio, dataTermino }: { turmaId: string; dataInicio: string; dataTermino: string }) => {
      const { error } = await supabase
        .from('ebd_escalas')
        .delete()
        .eq('turma_id', turmaId)
        .eq('church_id', churchData!.id)
        .gte('data', dataInicio)
        .lte('data', dataTermino);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebd-escalas'] });
      queryClient.invalidateQueries({ queryKey: ['ebd-escalas-planejamento'] });
      queryClient.invalidateQueries({ queryKey: ['ebd-planejamentos-with-turmas'] });
      toast.success('Todas as escalas foram excluídas!');
      setShowDeleteAllConfirm(false);
      setSelectedPlanejamento(null);
    },
    onError: () => {
      toast.error('Erro ao excluir escalas');
    },
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOfWeek = getDay(monthStart);
  const emptyDays = Array(startDayOfWeek).fill(null);

  const getEscalaForDay = (day: Date) => {
    return escalas?.find(e => isSameDay(parseISO(e.data), day));
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Escalas</h1>
            <p className="text-muted-foreground">Visualize e gerencie as escalas de professores</p>
          </div>
        </div>

        {planejamentos && planejamentos.length > 0 ? (
          (() => {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            
            const isAtiva = (p: Planejamento) => {
              const termino = new Date(p.data_termino + 'T23:59:59');
              return termino >= hoje;
            };
            
            const isFinalizada = (p: Planejamento) => {
              const termino = new Date(p.data_termino + 'T23:59:59');
              return termino < hoje;
            };
            
            const planejamentosAtivos = planejamentos.filter(isAtiva);
            const planejamentosFinalizados = planejamentos.filter(isFinalizada);
            
            return (
              <Tabs defaultValue="ativas" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="ativas" className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Revistas Ativas
                  </TabsTrigger>
                  <TabsTrigger value="finalizadas" className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Revistas Finalizadas
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="ativas" className="space-y-3 mt-4">
                  {planejamentosAtivos.length > 0 ? (
                    planejamentosAtivos.map((planejamento) => (
                      <Card 
                        key={planejamento.id} 
                        className="overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-4 p-4">
                          <div className="w-16 h-20 flex-shrink-0 bg-muted rounded-lg overflow-hidden">
                            {planejamento.revista?.imagem_url ? (
                              <img
                                src={planejamento.revista.imagem_url}
                                alt={planejamento.revista.titulo}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <BookOpen className="w-6 h-6 text-muted-foreground/50" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-4 items-center">
                            <div className="col-span-2 md:col-span-1">
                              <p className="text-xs text-muted-foreground">Turma</p>
                              <p className="font-medium text-sm truncate">{planejamento.turma?.nome || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Faixa Etária</p>
                              <p className="font-medium text-sm truncate">{planejamento.revista?.faixa_etaria_alvo || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Dia</p>
                              <p className="font-medium text-sm">{planejamento.dia_semana}</p>
                            </div>
                            <div className="hidden md:block">
                              <p className="text-xs text-muted-foreground">Início</p>
                              <p className="font-medium text-sm">{format(parseISO(planejamento.data_inicio), "dd/MM/yyyy")}</p>
                            </div>
                            <div className="hidden md:block">
                              <p className="text-xs text-muted-foreground">Término</p>
                              <p className="font-medium text-sm">{format(parseISO(planejamento.data_termino), "dd/MM/yyyy")}</p>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                              <p className="text-xs text-muted-foreground mb-1">Progresso</p>
                              <div className="flex items-center gap-2">
                                <Progress 
                                  value={(planejamento as any).progresso?.percentual || 0} 
                                  className="h-2 flex-1" 
                                  indicatorClassName={getProgressColor((planejamento as any).progresso?.percentual || 0)}
                                />
                                <span className="text-xs font-medium whitespace-nowrap">
                                  {(planejamento as any).progresso?.ministradas || 0}/{(planejamento as any).progresso?.total || 13}
                                </span>
                              </div>
                            </div>
                          </div>
                          {(planejamento as any).temEscalas ? (
                            <Button size="sm" onClick={() => setSelectedPlanejamento(planejamento)} className="flex-shrink-0">
                              <Eye className="w-4 h-4 mr-2" />
                              Ver Escala
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              onClick={() => {
                                setPlanejamentoParaMontarEscala({
                                  id: planejamento.id,
                                  revista_id: (planejamento as any).revista_id,
                                  data_inicio: planejamento.data_inicio,
                                  dia_semana: planejamento.dia_semana,
                                  data_termino: planejamento.data_termino,
                                  ebd_revistas: {
                                    id: planejamento.revista?.id,
                                    titulo: planejamento.revista?.titulo,
                                    num_licoes: planejamento.revista?.num_licoes || 13
                                  }
                                });
                                setShowMontarEscalaDialog(true);
                              }} 
                              className="flex-shrink-0"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Criar Escala
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma revista ativa</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="finalizadas" className="space-y-3 mt-4">
                  {planejamentosFinalizados.length > 0 ? (
                    planejamentosFinalizados.map((planejamento) => (
                      <Card 
                        key={planejamento.id} 
                        className="overflow-hidden hover:shadow-md transition-shadow border-green-200 dark:border-green-800"
                      >
                        <div className="flex items-center gap-4 p-4">
                          <div className="w-16 h-20 flex-shrink-0 bg-muted rounded-lg overflow-hidden relative">
                            {planejamento.revista?.imagem_url ? (
                              <img
                                src={planejamento.revista.imagem_url}
                                alt={planejamento.revista.titulo}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <BookOpen className="w-6 h-6 text-muted-foreground/50" />
                              </div>
                            )}
                            <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5">
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            </div>
                          </div>
                          <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-4 items-center">
                            <div className="col-span-2 md:col-span-1">
                              <p className="text-xs text-muted-foreground">Turma</p>
                              <p className="font-medium text-sm truncate">{planejamento.turma?.nome || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Faixa Etária</p>
                              <p className="font-medium text-sm truncate">{planejamento.revista?.faixa_etaria_alvo || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Dia</p>
                              <p className="font-medium text-sm">{planejamento.dia_semana}</p>
                            </div>
                            <div className="hidden md:block">
                              <p className="text-xs text-muted-foreground">Início</p>
                              <p className="font-medium text-sm">{format(parseISO(planejamento.data_inicio), "dd/MM/yyyy")}</p>
                            </div>
                            <div className="hidden md:block">
                              <p className="text-xs text-muted-foreground">Término</p>
                              <p className="font-medium text-sm">{format(parseISO(planejamento.data_termino), "dd/MM/yyyy")}</p>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                              <p className="text-xs text-muted-foreground mb-1">Progresso</p>
                              <div className="flex items-center gap-2">
                                <Progress 
                                  value={100} 
                                  className="h-2 flex-1" 
                                  indicatorClassName="bg-green-500"
                                />
                                <span className="text-xs font-medium whitespace-nowrap text-green-600">
                                  {(planejamento as any).progresso?.ministradas || 0}/{(planejamento as any).progresso?.total || 13}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => setSelectedPlanejamento(planejamento)} className="flex-shrink-0">
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Escala
                          </Button>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma revista finalizada</p>
                      <p className="text-sm">As revistas com data de término passada aparecerão aqui</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            );
          })()
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Escalas Cadastradas
              </CardTitle>
              <CardDescription>Programação de professores por turma e data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma escala cadastrada</p>
                <p className="text-sm">Monte uma escala a partir do planejamento escolar</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dialog do Calendário */}
        <Dialog open={!!selectedPlanejamento} onOpenChange={() => setSelectedPlanejamento(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="flex flex-row items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Escala - {selectedPlanejamento?.revista?.titulo}
                {selectedPlanejamento?.turma?.nome && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({selectedPlanejamento.turma.nome})
                  </span>
                )}
              </DialogTitle>
              {escalas && escalas.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteAllConfirm(true)}
                  className="ml-4"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Todas
                </Button>
              )}
            </DialogHeader>

            <div className="space-y-4">
              {/* Navegação do mês */}
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={previousMonth}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
                <h3 className="font-semibold text-lg capitalize">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </h3>
                <Button variant="outline" size="sm" onClick={nextMonth}>
                  Próximo
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              {/* Cabeçalho dos dias da semana */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => (
                  <div key={dia} className="p-2 font-medium text-sm text-muted-foreground">
                    {dia}
                  </div>
                ))}
              </div>

              {/* Dias do mês */}
              <div className="grid grid-cols-7 gap-1">
                {emptyDays.map((_, index) => (
                  <div key={`empty-${index}`} className="p-2 min-h-[100px]" />
                ))}
                {daysInMonth.map((day) => {
                  const escala = getEscalaForDay(day);
                  const hasClass = escala && !escala.sem_aula;
                  const noClass = escala?.sem_aula;

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "p-2 min-h-[100px] border rounded-lg text-sm relative group",
                        !isSameMonth(day, currentMonth) && "opacity-50",
                        hasClass && "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
                        noClass && "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                      )}
                    >
                      <div className="font-medium">{format(day, 'd')}</div>
                      {escala && (
                        <>
                          <div className="mt-1">
                            {noClass ? (
                              <span className="text-xs text-red-600 dark:text-red-400 font-semibold tracking-wide">
                                SEM AULA
                              </span>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center justify-center gap-1">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={escala.professor?.avatar_url || undefined} alt={escala.professor?.nome_completo || "Professor"} />
                                    <AvatarFallback className="text-[10px]">
                                      <User className="h-4 w-4" />
                                    </AvatarFallback>
                                  </Avatar>
                                  {escala.professor2 && (
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={escala.professor2?.avatar_url || undefined} alt={escala.professor2?.nome_completo || "Professor"} />
                                      <AvatarFallback className="text-[10px]">
                                        <User className="h-4 w-4" />
                                      </AvatarFallback>
                                    </Avatar>
                                  )}
                                </div>

                                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium line-clamp-2 text-center">
                                  {[escala.professor?.nome_completo, escala.professor2?.nome_completo]
                                    .filter(Boolean)
                                    .join(" / ")}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Botões de ação */}
                          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEscalaToEdit(escala);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEscalaToDelete(escala);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legenda */}
              <div className="flex items-center gap-6 justify-center pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800" />
                  <span className="text-sm">Aula</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800" />
                  <span className="text-sm">SEM AULA</span>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de edição */}
        <EditarEscalaDialog
          escala={escalaToEdit}
          open={!!escalaToEdit}
          onOpenChange={(open) => !open && setEscalaToEdit(null)}
          churchId={churchData?.id}
        />

        {/* Dialog de confirmação de exclusão */}
        <AlertDialog open={!!escalaToDelete} onOpenChange={() => setEscalaToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta escala do dia{' '}
                {escalaToDelete && format(parseISO(escalaToDelete.data), "dd/MM/yyyy")}?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => escalaToDelete && deleteEscalaMutation.mutate(escalaToDelete.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de confirmação para excluir TODAS as escalas */}
        <AlertDialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir todas as escalas?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir TODAS as escalas de{' '}
                <strong>{selectedPlanejamento?.turma?.nome || 'esta turma'}</strong> no período de{' '}
                {selectedPlanejamento && format(parseISO(selectedPlanejamento.data_inicio), "dd/MM/yyyy")} a{' '}
                {selectedPlanejamento && format(parseISO(selectedPlanejamento.data_termino), "dd/MM/yyyy")}?
                <br /><br />
                <span className="text-destructive font-medium">Esta ação não pode ser desfeita.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedPlanejamento?.turma?.id) {
                    deleteAllEscalasMutation.mutate({
                      turmaId: selectedPlanejamento.turma.id,
                      dataInicio: selectedPlanejamento.data_inicio,
                      dataTermino: selectedPlanejamento.data_termino,
                    });
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir Todas
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog para montar escala */}
        {planejamentoParaMontarEscala && (
          <MontarEscalaDialog
            planejamento={planejamentoParaMontarEscala}
            open={showMontarEscalaDialog}
            onOpenChange={(open) => {
              setShowMontarEscalaDialog(open);
              if (!open) setPlanejamentoParaMontarEscala(null);
            }}
            churchId={churchData?.id}
          />
        )}
      </div>
    </div>
  );
}
