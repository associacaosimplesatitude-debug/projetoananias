import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MontarEscalaDialogProps {
  planejamento: {
    id: string;
    revista_id: string;
    data_inicio: string;
    dia_semana: string;
    data_termino: string;
    ebd_revistas: {
      id: string;
      titulo: string;
      num_licoes: number;
    };
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId?: string;
}

interface Licao {
  id: string;
  numero_licao: number;
  titulo: string;
  data_aula: string;
}

interface Professor {
  id: string;
  nome_completo: string;
}

interface EscalaItem {
  licao_id: string;
  professor_id: string;
  data: string;
}

const diasSemanaMap: Record<string, number> = {
  "Domingo": 0,
  "Segunda-feira": 1,
  "Terça-feira": 2,
  "Quarta-feira": 3,
  "Quinta-feira": 4,
  "Sexta-feira": 5,
  "Sábado": 6,
};

export function MontarEscalaDialog({ planejamento, open, onOpenChange, churchId }: MontarEscalaDialogProps) {
  const queryClient = useQueryClient();
  const [escalas, setEscalas] = useState<Record<string, string>>({});

  // Buscar lições da revista
  const { data: licoes } = useQuery({
    queryKey: ['ebd-licoes-revista', planejamento.revista_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_licoes')
        .select('*')
        .eq('revista_id', planejamento.revista_id)
        .order('numero_licao');

      if (error) throw error;
      return data as Licao[];
    },
    enabled: open,
  });

  // Buscar professores ativos
  const { data: professores } = useQuery({
    queryKey: ['ebd-professores', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from('ebd_professores')
        .select('id, nome_completo')
        .eq('church_id', churchId)
        .eq('is_active', true)
        .order('nome_completo');

      if (error) throw error;
      return data as Professor[];
    },
    enabled: !!churchId && open,
  });

  // Calcular datas das aulas baseado no dia da semana
  const calcularDatasAulas = () => {
    if (!licoes) return [];
    
    const dataInicio = parseISO(planejamento.data_inicio);
    const diaSemanaNumero = diasSemanaMap[planejamento.dia_semana];
    const datas: Date[] = [];

    let dataAtual = dataInicio;
    for (let i = 0; i < licoes.length; i++) {
      // Encontrar o próximo dia da semana especificado
      while (dataAtual.getDay() !== diaSemanaNumero) {
        dataAtual = addDays(dataAtual, 1);
      }
      datas.push(new Date(dataAtual));
      dataAtual = addDays(dataAtual, 7); // Próxima semana
    }

    return datas;
  };

  const datasAulas = calcularDatasAulas();

  const salvarEscalaMutation = useMutation({
    mutationFn: async () => {
      if (!churchId || !licoes) {
        throw new Error("Dados incompletos");
      }

      // Verificar se todas as lições têm professor
      const licoesComProfessor = Object.keys(escalas).length;
      if (licoesComProfessor !== licoes.length) {
        throw new Error("Selecione um professor para todas as lições");
      }

      // Criar registros de escala
      const escalaData = licoes.map((licao, index) => ({
        church_id: churchId,
        turma_id: null, // Pode ser ajustado futuramente para associar a uma turma
        professor_id: escalas[licao.id],
        data: format(datasAulas[index], 'yyyy-MM-dd'),
        tipo: 'Aula Regular',
        confirmado: false,
      }));

      const { error } = await supabase
        .from('ebd_escalas')
        .insert(escalaData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebd-escalas'] });
      toast.success('Escala montada com sucesso!');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao montar escala');
      console.error(error);
    },
  });

  const handleSalvarEscala = () => {
    salvarEscalaMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Montar Escala de Professores</DialogTitle>
          <DialogDescription>
            {planejamento.ebd_revistas.titulo} - {planejamento.dia_semana}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Selecione um professor para cada lição:
          </div>

          {!licoes || licoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma lição encontrada para esta revista.
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {licoes.map((licao, index) => (
                <div key={licao.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1 text-center">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-bold text-primary">{licao.numero_licao}</span>
                      </div>
                    </div>
                    <div className="col-span-6">
                      <div>
                        <p className="font-medium text-foreground">{licao.titulo}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          📅 {format(datasAulas[index], "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="col-span-5">
                      <Label htmlFor={`professor-${licao.id}`} className="text-xs text-muted-foreground mb-1 block">
                        Professor
                      </Label>
                      <Select
                        value={escalas[licao.id] || ""}
                        onValueChange={(value) => setEscalas({ ...escalas, [licao.id]: value })}
                      >
                        <SelectTrigger id={`professor-${licao.id}`}>
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {professores?.map((professor) => (
                            <SelectItem key={professor.id} value={professor.id}>
                              {professor.nome_completo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvarEscala}
            disabled={salvarEscalaMutation.isPending}
          >
            {salvarEscalaMutation.isPending ? 'Salvando...' : 'Salvar Escala'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
