import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, BookOpen, CheckCircle2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Revista {
  id: string;
  titulo: string;
  faixa_etaria_alvo: string;
  imagem_url: string | null;
  num_licoes: number;
}

interface DefinirDataInicioDialogProps {
  revista: Revista | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string | null;
  onComplete?: () => void;
}

const diasSemana = [
  { value: "Domingo", label: "Domingo", dayNumber: 0 },
  { value: "Segunda-feira", label: "Segunda-feira", dayNumber: 1 },
  { value: "Terça-feira", label: "Terça-feira", dayNumber: 2 },
  { value: "Quarta-feira", label: "Quarta-feira", dayNumber: 3 },
  { value: "Quinta-feira", label: "Quinta-feira", dayNumber: 4 },
  { value: "Sexta-feira", label: "Sexta-feira", dayNumber: 5 },
  { value: "Sábado", label: "Sábado", dayNumber: 6 },
];

export function DefinirDataInicioDialog({ 
  revista, 
  open, 
  onOpenChange, 
  churchId,
  onComplete 
}: DefinirDataInicioDialogProps) {
  const queryClient = useQueryClient();
  const [diaSemana, setDiaSemana] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);

  // Calcular datas das aulas
  const aulasCalculadas = useMemo(() => {
    if (!dataInicio || !diaSemana || !revista) return [];
    
    const diaSelecionado = diasSemana.find(d => d.value === diaSemana);
    if (!diaSelecionado) return [];

    const numLicoes = revista.num_licoes || 13;
    const result: Array<{ numero: number; data: Date }> = [];
    
    let dataAtual = new Date(dataInicio);
    
    // Encontrar o primeiro dia da semana selecionado a partir da data de início
    while (dataAtual.getDay() !== diaSelecionado.dayNumber) {
      dataAtual = addDays(dataAtual, 1);
    }

    for (let i = 0; i < numLicoes; i++) {
      result.push({
        numero: i + 1,
        data: new Date(dataAtual),
      });
      dataAtual = addDays(dataAtual, 7);
    }

    return result;
  }, [dataInicio, diaSemana, revista]);

  const dataTermino = aulasCalculadas.length > 0 
    ? aulasCalculadas[aulasCalculadas.length - 1].data 
    : undefined;

  // Mutation para salvar o planejamento
  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!churchId || !revista || !diaSemana || !dataInicio || !dataTermino) {
        throw new Error("Dados incompletos");
      }

      // Salvar planejamento básico (sem escalas ainda - escalas serão criadas na etapa 5)
      const { error } = await supabase
        .from('ebd_planejamento')
        .insert({
          church_id: churchId,
          revista_id: revista.id,
          data_inicio: format(dataInicio, 'yyyy-MM-dd'),
          dia_semana: diaSemana,
          data_termino: format(dataTermino, 'yyyy-MM-dd'),
        });

      if (error) throw error;

      // Atualizar ebd_clientes com dia_aula e data_inicio_ebd
      const { error: updateError } = await supabase
        .from('ebd_clientes')
        .update({
          dia_aula: diaSemana,
          data_inicio_ebd: format(dataInicio, 'yyyy-MM-dd'),
        })
        .eq('id', churchId);

      if (updateError) throw updateError;
    },
    onSuccess: async () => {
      // Marcar etapa 4 como concluída
      await supabase
        .from("ebd_onboarding_progress")
        .upsert({
          church_id: churchId,
          etapa_id: 4,
          completada: true,
          completada_em: new Date().toISOString(),
        }, { onConflict: "church_id,etapa_id" });

      queryClient.invalidateQueries({ queryKey: ['ebd-planejamentos'] });
      queryClient.invalidateQueries({ queryKey: ['ebd-onboarding-progress'] });
      toast.success('Data de início definida com sucesso!');
      onOpenChange(false);
      setDiaSemana("");
      setDataInicio(undefined);
      onComplete?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao salvar');
    },
  });

  const handleSalvar = () => {
    if (!diaSemana || !dataInicio) {
      toast.error('Selecione o dia da semana e a data de início');
      return;
    }
    salvarMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Definir Data de Início
          </DialogTitle>
          <DialogDescription>
            Configure o dia da semana e a data de início das aulas para calcular o calendário escolar
          </DialogDescription>
        </DialogHeader>

        {!revista ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                Nenhuma revista foi aplicada ainda. Para definir a data de início, primeiro aplique a revista na etapa 1.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {/* Card da revista */}
              <div className="flex gap-4 p-4 border rounded-lg bg-muted/30">
                {revista.imagem_url ? (
                  <img
                    src={revista.imagem_url}
                    alt={`Revista ${revista.titulo}`}
                    className="w-24 h-32 object-cover rounded-lg shadow-md"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-24 h-32 bg-primary/10 rounded-lg flex items-center justify-center">
                    <BookOpen className="h-8 w-8 text-primary" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{revista.titulo}</h3>
                  <Badge variant="secondary" className="mt-1">
                    {revista.faixa_etaria_alvo}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    {revista.num_licoes || 13} lições
                  </p>
                </div>
              </div>

              {/* Seleção de dia e data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dia da Aula</Label>
                  <Select value={diaSemana} onValueChange={setDiaSemana}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o dia da semana" />
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
                          !dataInicio && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataInicio
                          ? format(dataInicio, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataInicio}
                        onSelect={setDataInicio}
                        initialFocus
                        locale={ptBR}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Resumo das aulas calculadas */}
              {diaSemana && dataInicio && aulasCalculadas.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Calendário das Aulas
                    </h4>
                    <div className="text-sm text-muted-foreground">
                      Término:{" "}
                      <span className="font-semibold text-foreground">
                        {dataTermino && format(dataTermino, "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>

                  <ScrollArea className="h-[200px] border rounded-lg p-3">
                    <div className="space-y-2">
                      {aulasCalculadas.map((aula) => (
                        <div
                          key={aula.numero}
                          className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-bold text-primary">{aula.numero}</span>
                            </div>
                            <span className="text-sm font-medium">Lição {aula.numero}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {format(aula.data, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <span className="text-sm font-medium">Total de Aulas</span>
                    <Badge variant="default">{aulasCalculadas.length} aulas</Badge>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSalvar}
                disabled={salvarMutation.isPending || !diaSemana || !dataInicio}
              >
                {salvarMutation.isPending ? "Salvando..." : "Salvar Data de Início"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
