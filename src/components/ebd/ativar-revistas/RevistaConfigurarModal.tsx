import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useEbdChurchId } from "@/hooks/useEbdChurchId";
import { RevistaConfig } from "@/pages/ebd/AtivarRevistas";

interface RevistaConfigurarModalProps {
  revista: RevistaConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (config: Partial<RevistaConfig>) => void;
}

const DIAS_SEMANA = [
  { value: 'domingo', label: 'Domingo' },
  { value: 'segunda', label: 'Segunda-feira' },
  { value: 'terça', label: 'Terça-feira' },
  { value: 'quarta', label: 'Quarta-feira' },
  { value: 'quinta', label: 'Quinta-feira' },
  { value: 'sexta', label: 'Sexta-feira' },
  { value: 'sábado', label: 'Sábado' },
];

export function RevistaConfigurarModal({
  revista,
  open,
  onOpenChange,
  onConfirmar,
}: RevistaConfigurarModalProps) {
  const { data: churchData } = useEbdChurchId();
  const churchId = churchData?.id;
  const [turmaId, setTurmaId] = useState(revista.turmaId || "");
  const [diaSemana, setDiaSemana] = useState(revista.diaSemana || "domingo");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(revista.dataInicio);

  // Buscar turmas da igreja
  const { data: turmas, isLoading: loadingTurmas } = useQuery({
    queryKey: ['turmas-ebd', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from('ebd_turmas')
        .select('id, nome')
        .eq('church_id', churchId)
        .eq('is_active', true)
        .order('nome');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!churchId,
  });

  const turmaSelecionada = turmas?.find(t => t.id === turmaId);

  const handleConfirmar = () => {
    if (!turmaId || !dataInicio) return;
    
    onConfirmar({
      turmaId,
      turmaNome: turmaSelecionada?.nome,
      diaSemana,
      dataInicio,
      configurada: true,
    });
  };

  const canConfirmar = turmaId && dataInicio;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Revista</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Imagem da revista */}
          <div className="flex gap-4">
            <div className="w-20 h-28 bg-muted rounded overflow-hidden flex-shrink-0">
              {revista.produto.node.images.edges[0]?.node.url ? (
                <img
                  src={revista.produto.node.images.edges[0].node.url}
                  alt={revista.produto.node.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                  Sem imagem
                </div>
              )}
            </div>
            <div>
              <h4 className="font-medium line-clamp-2">
                {revista.produto.node.title}
              </h4>
            </div>
          </div>

          {/* Seleção de turma */}
          <div className="space-y-2">
            <Label>Turma *</Label>
            <Select value={turmaId} onValueChange={setTurmaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a turma" />
              </SelectTrigger>
              <SelectContent>
                {loadingTurmas ? (
                  <SelectItem value="_loading" disabled>Carregando...</SelectItem>
                ) : !turmas || turmas.length === 0 ? (
                  <SelectItem value="_empty" disabled>Nenhuma turma cadastrada</SelectItem>
                ) : (
                  turmas.map(turma => (
                    <SelectItem key={turma.id} value={turma.id}>
                      {turma.nome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Dia da semana */}
          <div className="space-y-2">
            <Label>Dia da Semana *</Label>
            <Select value={diaSemana} onValueChange={setDiaSemana}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o dia" />
              </SelectTrigger>
              <SelectContent>
                {DIAS_SEMANA.map(dia => (
                  <SelectItem key={dia.value} value={dia.value}>
                    {dia.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data de início */}
          <div className="space-y-2">
            <Label>Data de Início *</Label>
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
                  {dataInicio ? (
                    format(dataInicio, "PPP", { locale: ptBR })
                  ) : (
                    <span>Selecione a data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={setDataInicio}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!canConfirmar}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
