import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EditarPlanejamentoDialogProps {
  planejamento: {
    id: string;
    data_inicio: string;
    data_termino: string;
    dia_semana: string;
    turma_id?: string;
    turma?: {
      id: string;
      nome: string;
      faixa_etaria: string;
    };
    revista?: {
      titulo: string;
      faixa_etaria_alvo: string;
    };
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId?: string;
}

const diasSemana = [
  { value: "domingo", label: "Domingo" },
  { value: "segunda", label: "Segunda-feira" },
  { value: "terca", label: "Terça-feira" },
  { value: "quarta", label: "Quarta-feira" },
  { value: "quinta", label: "Quinta-feira" },
  { value: "sexta", label: "Sexta-feira" },
  { value: "sabado", label: "Sábado" },
];

export function EditarPlanejamentoDialog({
  planejamento,
  open,
  onOpenChange,
  churchId,
}: EditarPlanejamentoDialogProps) {
  const queryClient = useQueryClient();
  const [turmaId, setTurmaId] = useState<string>("");
  const [diaSemana, setDiaSemana] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataTermino, setDataTermino] = useState<Date | undefined>(undefined);

  // Buscar turmas da igreja
  const { data: turmas } = useQuery({
    queryKey: ["ebd-turmas", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("ebd_turmas")
        .select("id, nome, faixa_etaria")
        .eq("church_id", churchId)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!churchId && open,
  });

  // Guardar turma_id original para atualizar apenas as escalas corretas
  const [originalTurmaId, setOriginalTurmaId] = useState<string>("");

  // Atualizar estados quando o planejamento mudar
  useEffect(() => {
    if (planejamento) {
      const turmaIdValue = planejamento.turma_id || planejamento.turma?.id || "";
      setTurmaId(turmaIdValue);
      setOriginalTurmaId(turmaIdValue); // Guardar o turma_id original
      setDiaSemana(planejamento.dia_semana || "");
      setDataInicio(planejamento.data_inicio ? parseISO(planejamento.data_inicio) : undefined);
      setDataTermino(planejamento.data_termino ? parseISO(planejamento.data_termino) : undefined);
    }
  }, [planejamento]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!planejamento?.id || !turmaId || !diaSemana || !dataInicio) {
        throw new Error("Dados incompletos");
      }

      // Atualizar o planejamento
      const { error: planError } = await supabase
        .from("ebd_planejamento")
        .update({
          turma_id: turmaId,
          dia_semana: diaSemana,
          data_inicio: format(dataInicio, "yyyy-MM-dd"),
          data_termino: dataTermino ? format(dataTermino, "yyyy-MM-dd") : null,
        })
        .eq("id", planejamento.id);

      if (planError) throw planError;

      // Atualizar turma_id nas escalas associadas - APENAS as que pertencem ao turma_id original
      if (originalTurmaId && turmaId !== originalTurmaId) {
        const { error: escalaError } = await supabase
          .from("ebd_escalas")
          .update({ turma_id: turmaId })
          .eq("church_id", churchId)
          .eq("turma_id", originalTurmaId) // Filtrar apenas escalas do turma_id original
          .gte("data", planejamento.data_inicio) // Usar datas originais do planejamento
          .lte("data", planejamento.data_termino);

        if (escalaError) {
          console.error("Erro ao atualizar escalas:", escalaError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ebd-planejamentos"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-planejamentos-with-turmas"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-escalas"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-escalas-planejamento"] });
      toast.success("Planejamento atualizado com sucesso!");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao atualizar planejamento:", error);
      toast.error("Erro ao atualizar planejamento");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Planejamento</DialogTitle>
          <DialogDescription>
            {planejamento?.revista?.titulo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Turma */}
          <div className="space-y-2">
            <Label>Turma</Label>
            <Select value={turmaId} onValueChange={setTurmaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a turma" />
              </SelectTrigger>
              <SelectContent>
                {turmas?.map((turma) => (
                  <SelectItem key={turma.id} value={turma.id}>
                    {turma.nome} ({turma.faixa_etaria})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dia da Aula */}
          <div className="space-y-2">
            <Label>Dia da Aula</Label>
            <Select value={diaSemana} onValueChange={setDiaSemana}>
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

          {/* Data de Início */}
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
                  {dataInicio ? format(dataInicio, "PPP", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={setDataInicio}
                  initialFocus
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Data de Término */}
          <div className="space-y-2">
            <Label>Data de Término</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataTermino && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataTermino ? format(dataTermino, "PPP", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataTermino}
                  onSelect={setDataTermino}
                  initialFocus
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !turmaId || !diaSemana || !dataInicio}
          >
            {updateMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
