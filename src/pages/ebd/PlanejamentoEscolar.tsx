import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, BookOpen, ShoppingBag, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
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
    setEditDataInicio(new Date(planejamento.data_inicio));
    setEditDataTermino(new Date(planejamento.data_termino));
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

        {/* Revistas de Pedidos Pagos */}
        {revistasPagas && revistasPagas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Revistas Compradas
              </CardTitle>
              <CardDescription>Revistas dos seus pedidos pagos prontas para uso</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {revistasPagas.map((item) => (
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
            </CardContent>
          </Card>
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
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 items-center">
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