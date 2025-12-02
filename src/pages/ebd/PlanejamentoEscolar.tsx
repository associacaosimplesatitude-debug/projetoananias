import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, BookOpen, ShoppingBag, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RevistaDetailDialog } from "@/components/ebd/RevistaDetailDialog";
import { MontarEscalaDialog } from "@/components/ebd/MontarEscalaDialog";
import { CriarPlanejamentoDialog } from "@/components/ebd/CriarPlanejamentoDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const FAIXAS_ETARIAS = [
  "Jovens e Adultos",
  "Maternal: 2 a 3 Anos",
  "Jardim de Infância: 4 a 6 Anos",
  "Primários: 7 a 8 Anos",
  "Juniores: 9 a 11 Anos",
  "Adolescentes: 12 a 14 Anos",
  "Adolescentes+: 15 a 17 Anos",
] as const;

const diasSemana = [
  { value: "Domingo", label: "Domingo" },
  { value: "Segunda-feira", label: "Segunda-feira" },
  { value: "Terça-feira", label: "Terça-feira" },
  { value: "Quarta-feira", label: "Quarta-feira" },
  { value: "Quinta-feira", label: "Quinta-feira" },
  { value: "Sexta-feira", label: "Sexta-feira" },
  { value: "Sábado", label: "Sábado" },
];

interface Revista {
  id: string;
  titulo: string;
  faixa_etaria_alvo: string;
  sinopse: string | null;
  autor: string | null;
  imagem_url: string | null;
  num_licoes: number;
  preco_cheio: number;
}

interface Planejamento {
  id: string;
  revista_id: string;
  data_inicio: string;
  dia_semana: string;
  data_termino: string;
  ebd_revistas: Revista;
}

interface PedidoItem {
  id: string;
  quantidade: number;
  revista: Revista;
}

export default function PlanejamentoEscolar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [faixaEtariaSelecionada, setFaixaEtariaSelecionada] = useState<string>("");
  const [revistaDialog, setRevistaDialog] = useState<Revista | null>(null);
  const [planejamentoEscala, setPlanejamentoEscala] = useState<Planejamento | null>(null);
  
  // Estados para edição e exclusão
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPlanejamento, setSelectedPlanejamento] = useState<Planejamento | null>(null);
  const [editDiaSemana, setEditDiaSemana] = useState("");
  const [editDataInicio, setEditDataInicio] = useState<Date | undefined>(undefined);
  const [editDataTermino, setEditDataTermino] = useState<Date | undefined>(undefined);

  // Buscar church_id do usuário
  const { data: churchData } = useQuery({
    queryKey: ['user-church', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('churches')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Buscar revistas de pedidos pagos
  const { data: revistasPagas, isLoading: loadingPagas } = useQuery({
    queryKey: ['ebd-revistas-pagas', churchData?.id],
    queryFn: async () => {
      if (!churchData?.id) return [];
      const { data, error } = await supabase
        .from('ebd_pedidos')
        .select(`
          id,
          ebd_pedidos_itens(
            id,
            quantidade,
            revista:ebd_revistas(*)
          )
        `)
        .eq('church_id', churchData.id)
        .eq('payment_status', 'approved');

      if (error) throw error;
      
      // Flatten items from all orders
      const items: PedidoItem[] = [];
      data?.forEach(pedido => {
        pedido.ebd_pedidos_itens?.forEach(item => {
          if (item.revista) {
            items.push({
              id: item.id,
              quantidade: item.quantidade,
              revista: item.revista as Revista
            });
          }
        });
      });
      return items;
    },
    enabled: !!churchData?.id,
  });

  // Buscar revistas por faixa etária
  const { data: revistas, isLoading: loadingRevistas } = useQuery({
    queryKey: ['ebd-revistas-filtradas', faixaEtariaSelecionada],
    queryFn: async () => {
      if (!faixaEtariaSelecionada) return [];
      const { data, error } = await supabase
        .from('ebd_revistas')
        .select('*')
        .eq('faixa_etaria_alvo', faixaEtariaSelecionada);

      if (error) throw error;
      return data as Revista[];
    },
    enabled: !!faixaEtariaSelecionada,
  });

  // Buscar planejamentos existentes
  const { data: planejamentos } = useQuery({
    queryKey: ['ebd-planejamentos', churchData?.id],
    queryFn: async () => {
      if (!churchData?.id) return [];
      const { data, error } = await supabase
        .from('ebd_planejamento')
        .select(`
          *,
          ebd_revistas (*)
        `)
        .eq('church_id', churchData.id)
        .order('data_inicio', { ascending: false });

      if (error) throw error;
      return data as Planejamento[];
    },
    enabled: !!churchData?.id,
  });

  // Buscar escalas salvas para verificar quais revistas já foram utilizadas
  const { data: escalasSalvas } = useQuery({
    queryKey: ['ebd-escalas-salvas', churchData?.id],
    queryFn: async () => {
      if (!churchData?.id) return [];
      const { data, error } = await supabase
        .from('ebd_escalas')
        .select('turma_id, data')
        .eq('church_id', churchData.id);

      if (error) throw error;
      return data;
    },
    enabled: !!churchData?.id,
  });

  // Separar planejamentos em pendentes e com escala salva
  const planejamentosComEscala = planejamentos?.filter(p => {
    if (!escalasSalvas || escalasSalvas.length === 0) return false;
    // Verificar se existe alguma escala dentro do período do planejamento
    return escalasSalvas.some(escala => {
      const escalaDate = new Date(escala.data);
      const inicio = new Date(p.data_inicio);
      const termino = new Date(p.data_termino);
      return escalaDate >= inicio && escalaDate <= termino;
    });
  }) || [];

  const planejamentosSemEscala = planejamentos?.filter(p => {
    if (!escalasSalvas || escalasSalvas.length === 0) return true;
    // Verificar se NÃO existe escala dentro do período do planejamento
    return !escalasSalvas.some(escala => {
      const escalaDate = new Date(escala.data);
      const inicio = new Date(p.data_inicio);
      const termino = new Date(p.data_termino);
      return escalaDate >= inicio && escalaDate <= termino;
    });
  }) || [];

  // Filtrar revistas pagas - mostrar apenas as que não têm planejamento com escala
  const revistasPendentesPlanejamento = revistasPagas?.filter(item => {
    // Verificar se esta revista NÃO tem planejamento com escala salva
    const temEscalaSalva = planejamentosComEscala.some(
      p => p.revista_id === item.revista.id
    );
    return !temEscalaSalva;
  }) || [];

  // Revistas que já foram utilizadas (têm escala salva)
  const revistasUtilizadas = revistasPagas?.filter(item => {
    const temEscalaSalva = planejamentosComEscala.some(
      p => p.revista_id === item.revista.id
    );
    return temEscalaSalva;
  }) || [];

  // Função para calcular progresso de aulas ministradas
  const calcularProgresso = (planejamento: Planejamento) => {
    const totalLicoes = planejamento.ebd_revistas.num_licoes || 13;
    
    if (!escalasSalvas || escalasSalvas.length === 0) {
      return { ministradas: 0, total: totalLicoes, percentual: 0 };
    }

    // Contar escalas dentro do período do planejamento
    const aulasMinistradasCount = escalasSalvas.filter(escala => {
      const escalaDate = new Date(escala.data);
      const inicio = new Date(planejamento.data_inicio);
      const termino = new Date(planejamento.data_termino);
      return escalaDate >= inicio && escalaDate <= termino;
    }).length;

    // Contar apenas datas únicas (pode haver múltiplas turmas no mesmo dia)
    const datasUnicas = new Set(
      escalasSalvas
        .filter(escala => {
          const escalaDate = new Date(escala.data);
          const inicio = new Date(planejamento.data_inicio);
          const termino = new Date(planejamento.data_termino);
          return escalaDate >= inicio && escalaDate <= termino;
        })
        .map(escala => escala.data)
    ).size;

    const percentual = Math.min(100, Math.round((datasUnicas / totalLicoes) * 100));

    return { ministradas: datasUnicas, total: totalLicoes, percentual };
  };

  // Função para obter a cor do progresso baseada no percentual
  const getProgressColor = (percentual: number) => {
    if (percentual >= 80) return "bg-green-500";
    if (percentual >= 30) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Mutation para editar planejamento
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlanejamento || !editDiaSemana || !editDataInicio || !editDataTermino) {
        throw new Error("Dados incompletos");
      }

      const { error } = await supabase
        .from('ebd_planejamento')
        .update({
          dia_semana: editDiaSemana,
          data_inicio: format(editDataInicio, 'yyyy-MM-dd'),
          data_termino: format(editDataTermino, 'yyyy-MM-dd'),
        })
        .eq('id', selectedPlanejamento.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebd-planejamentos'] });
      toast.success('Planejamento atualizado com sucesso!');
      setEditDialogOpen(false);
      setSelectedPlanejamento(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar planejamento');
    },
  });

  // Mutation para excluir planejamento
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlanejamento) throw new Error("Planejamento não selecionado");

      const { error } = await supabase
        .from('ebd_planejamento')
        .delete()
        .eq('id', selectedPlanejamento.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebd-planejamentos'] });
      toast.success('Planejamento excluído com sucesso!');
      setDeleteDialogOpen(false);
      setSelectedPlanejamento(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir planejamento');
    },
  });

  const handleEdit = (planejamento: Planejamento) => {
    setSelectedPlanejamento(planejamento);
    setEditDiaSemana(planejamento.dia_semana);
    // Adicionar T12:00:00 para evitar problemas de timezone
    setEditDataInicio(new Date(planejamento.data_inicio + 'T12:00:00'));
    setEditDataTermino(new Date(planejamento.data_termino + 'T12:00:00'));
    setEditDialogOpen(true);
  };

  const handleDelete = (planejamento: Planejamento) => {
    setSelectedPlanejamento(planejamento);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Planejamento Escolar</h1>
            <p className="text-muted-foreground">Selecione revistas e monte a escala de professores</p>
          </div>
        </div>

        {/* Tabs para Revistas Compradas e Utilizadas */}
        {revistasPagas && revistasPagas.length > 0 && (
          <Tabs defaultValue="pendentes" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="pendentes" className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Revistas Compradas
                {revistasPendentesPlanejamento.length > 0 && (
                  <span className="ml-1 bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                    {revistasPendentesPlanejamento.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="utilizadas" className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Revistas Utilizadas
                {revistasUtilizadas.length > 0 && (
                  <span className="ml-1 bg-green-500/20 text-green-600 text-xs px-2 py-0.5 rounded-full">
                    {revistasUtilizadas.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pendentes">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5" />
                    Revistas Pendentes de Planejamento
                  </CardTitle>
                  <CardDescription>Revistas que ainda não possuem escala montada e salva</CardDescription>
                </CardHeader>
                <CardContent>
                  {revistasPendentesPlanejamento.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                      <p className="font-medium">Todas as revistas já foram planejadas!</p>
                      <p className="text-sm">Veja suas revistas utilizadas na aba ao lado.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {revistasPendentesPlanejamento.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col items-center gap-2 p-3 border rounded-lg bg-card"
                        >
                          <div className="w-16 h-20 bg-muted rounded overflow-hidden">
                            {item.revista.imagem_url ? (
                              <img
                                src={item.revista.imagem_url}
                                alt={item.revista.titulo}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <BookOpen className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-center font-medium line-clamp-2">{item.revista.titulo}</p>
                          <p className="text-xs text-muted-foreground">{item.revista.faixa_etaria_alvo}</p>
                          <Button 
                            size="sm" 
                            className="text-xs h-7 px-2"
                            onClick={() => setRevistaDialog(item.revista)}
                          >
                            MONTAR ESCALA
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="utilizadas">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Revistas Utilizadas
                  </CardTitle>
                  <CardDescription>Revistas com escala montada e salva</CardDescription>
                </CardHeader>
                <CardContent>
                  {revistasUtilizadas.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">Nenhuma revista utilizada ainda</p>
                      <p className="text-sm">Monte a escala das suas revistas compradas para vê-las aqui.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {revistasUtilizadas.map((item) => {
                        const planejamento = planejamentosComEscala.find(
                          p => p.revista_id === item.revista.id
                        );
                        return (
                          <div
                            key={item.id}
                            className="flex flex-col items-center gap-2 p-3 border rounded-lg bg-card border-green-500/30"
                          >
                            <div className="relative w-16 h-20 bg-muted rounded overflow-hidden">
                              {item.revista.imagem_url ? (
                                <img
                                  src={item.revista.imagem_url}
                                  alt={item.revista.titulo}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <BookOpen className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                              <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                              </div>
                            </div>
                            <p className="text-xs text-center font-medium line-clamp-2">{item.revista.titulo}</p>
                            <p className="text-xs text-muted-foreground">{item.revista.faixa_etaria_alvo}</p>
                            {planejamento && (() => {
                              const progresso = calcularProgresso(planejamento);
                              return (
                                <div className="w-full space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Progresso</span>
                                    <span className="font-medium">{progresso.ministradas}/{progresso.total}</span>
                                  </div>
                                  <Progress 
                                    value={progresso.percentual} 
                                    className="h-1.5" 
                                    indicatorClassName={getProgressColor(progresso.percentual)}
                                  />
                                </div>
                              );
                            })()}
                            {planejamento && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-xs h-7 px-2"
                                onClick={() => setPlanejamentoEscala(planejamento)}
                              >
                                VER ESCALA
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Planejamentos Existentes */}
        {planejamentos && planejamentos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Planejamentos Ativos</CardTitle>
              <CardDescription>Revistas em uso neste período</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {planejamentos.map((planejamento) => (
                <div
                  key={planejamento.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:shadow-sm transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-18 flex-shrink-0 bg-muted rounded-lg overflow-hidden">
                    {planejamento.ebd_revistas.imagem_url ? (
                      <img
                        src={planejamento.ebd_revistas.imagem_url}
                        alt={planejamento.ebd_revistas.titulo}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>

                  {/* Informações em linha */}
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4 items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Faixa Etária</p>
                      <p className="font-medium text-sm truncate">
                        {planejamento.ebd_revistas.faixa_etaria_alvo}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Dia</p>
                      <p className="font-medium text-sm">{planejamento.dia_semana}</p>
                    </div>
                    <div className="hidden md:block">
                      <p className="text-xs text-muted-foreground">Início</p>
                      <p className="font-medium text-sm">
                        {format(new Date(planejamento.data_inicio), "dd/MM/yyyy")}
                      </p>
                    </div>
                    <div className="hidden md:block">
                      <p className="text-xs text-muted-foreground">Término</p>
                      <p className="font-medium text-sm">
                        {format(new Date(planejamento.data_termino), "dd/MM/yyyy")}
                      </p>
                    </div>
                    {/* Progresso */}
                    {(() => {
                      const progresso = calcularProgresso(planejamento);
                      return (
                        <div className="col-span-2 md:col-span-1">
                          <p className="text-xs text-muted-foreground mb-1">Progresso</p>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={progresso.percentual} 
                              className="h-2 flex-1" 
                              indicatorClassName={getProgressColor(progresso.percentual)}
                            />
                            <span className="text-xs font-medium whitespace-nowrap">
                              {progresso.ministradas}/{progresso.total}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Botões de ação */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button 
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(planejamento)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(planejamento)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => setPlanejamentoEscala(planejamento)}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Ver Escala
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Seleção de Faixa Etária */}
        <Card>
          <CardHeader>
            <CardTitle>Selecionar Nova Revista</CardTitle>
            <CardDescription>Escolha uma faixa etária para ver as revistas disponíveis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Faixa Etária</label>
                <Select value={faixaEtariaSelecionada} onValueChange={setFaixaEtariaSelecionada}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma faixa etária" />
                  </SelectTrigger>
                  <SelectContent>
                    {FAIXAS_ETARIAS.map((faixa) => (
                      <SelectItem key={faixa} value={faixa}>
                        {faixa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Grid de Revistas */}
              {faixaEtariaSelecionada && (
                <div>
                  {loadingRevistas ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : !revistas || revistas.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma revista encontrada para esta faixa etária</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
                      {revistas.map((revista) => (
                        <div
                          key={revista.id}
                          className="cursor-pointer group"
                          onClick={() => setRevistaDialog(revista)}
                        >
                          <div className="aspect-[3/4] bg-muted rounded-lg overflow-hidden mb-2 relative">
                            {revista.imagem_url ? (
                              <img
                                src={revista.imagem_url}
                                alt={revista.titulo}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <BookOpen className="w-12 h-12 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <h3 className="text-sm font-medium line-clamp-2">{revista.titulo}</h3>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {revistaDialog && (
          <CriarPlanejamentoDialog
            revista={revistaDialog}
            open={!!revistaDialog}
            onOpenChange={(open) => !open && setRevistaDialog(null)}
            churchId={churchData?.id}
          />
        )}

        {planejamentoEscala && (
          <MontarEscalaDialog
            planejamento={planejamentoEscala}
            open={!!planejamentoEscala}
            onOpenChange={(open) => !open && setPlanejamentoEscala(null)}
            churchId={churchData?.id}
          />
        )}

        {/* Dialog de Edição */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Planejamento</DialogTitle>
              <DialogDescription>
                {selectedPlanejamento?.ebd_revistas.titulo}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Dia da Aula</Label>
                <Select value={editDiaSemana} onValueChange={setEditDiaSemana}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o dia" />
                  </SelectTrigger>
                  <SelectContent>
                    {diasSemana.map((dia) => (
                      <SelectItem key={dia.value} value={dia.value}>
                        {dia.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data de Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editDataInicio && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editDataInicio ? format(editDataInicio, "PPP", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={editDataInicio}
                      onSelect={setEditDataInicio}
                      initialFocus
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Data de Término</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editDataTermino && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editDataTermino ? format(editDataTermino, "PPP", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={editDataTermino}
                      onSelect={setEditDataTermino}
                      initialFocus
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending}
              >
                {editMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação de Exclusão */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Planejamento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o planejamento da revista "{selectedPlanejamento?.ebd_revistas.titulo}"? 
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}