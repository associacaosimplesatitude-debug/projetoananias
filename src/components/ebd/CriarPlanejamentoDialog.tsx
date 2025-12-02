import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, addDays, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

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

interface CriarPlanejamentoDialogProps {
  revista: Revista;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId?: string;
}

interface Licao {
  id: string;
  numero_licao: number;
  titulo: string;
}

interface Professor {
  id: string;
  nome_completo: string;
}

interface Turma {
  id: string;
  nome: string;
  faixa_etaria: string;
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

export function CriarPlanejamentoDialog({ revista, open, onOpenChange, churchId }: CriarPlanejamentoDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [diaSemana, setDiaSemana] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [turmaId, setTurmaId] = useState<string>("");
  const [escalas, setEscalas] = useState<Record<number, string>>({});
  const [semAula, setSemAula] = useState<Record<number, boolean>>({});

  // Buscar lições da revista
  const { data: licoes } = useQuery({
    queryKey: ['ebd-licoes-revista', revista.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_licoes')
        .select('id, numero_licao, titulo')
        .eq('revista_id', revista.id)
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

  // Buscar turmas ativas
  const { data: turmas } = useQuery({
    queryKey: ['ebd-turmas', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from('ebd_turmas')
        .select('id, nome, faixa_etaria')
        .eq('church_id', churchId)
        .eq('is_active', true)
        .order('nome');

      if (error) throw error;
      return data as Turma[];
    },
    enabled: !!churchId && open,
  });

  // Calcular datas das lições
  const licoesComDatas = useMemo(() => {
    if (!dataInicio || !diaSemana) return [];
    
    const diaSelecionado = diasSemana.find(d => d.value === diaSemana);
    if (!diaSelecionado) return [];

    const numLicoes = licoes?.length || revista.num_licoes;
    const result: Array<{ numero: number; titulo: string; data: Date; licaoId?: string }> = [];
    
    let dataAtual = new Date(dataInicio);
    
    // Encontrar o primeiro dia da semana selecionado a partir da data de início
    while (dataAtual.getDay() !== diaSelecionado.dayNumber) {
      dataAtual = addDays(dataAtual, 1);
    }

    for (let i = 0; i < numLicoes; i++) {
      const licao = licoes?.find(l => l.numero_licao === i + 1);
      result.push({
        numero: i + 1,
        titulo: licao?.titulo || `Lição ${i + 1}`,
        data: new Date(dataAtual),
        licaoId: licao?.id,
      });
      dataAtual = addDays(dataAtual, 7);
    }

    return result;
  }, [dataInicio, diaSemana, licoes, revista.num_licoes]);

  const salvarPlanejamentoMutation = useMutation({
    mutationFn: async () => {
      if (!churchId || !diaSemana || !dataInicio || !turmaId) {
        throw new Error("Dados incompletos - selecione a turma");
      }

      // Verificar se todas as lições têm professor (exceto as sem aula)
      const licoesQueNecessitamProfessor = licoesComDatas.filter((_, index) => !semAula[index + 1]);
      const licoesComProfessor = licoesQueNecessitamProfessor.filter((_, index) => {
        const licaoNum = licoesComDatas.indexOf(licoesQueNecessitamProfessor[index]) + 1;
        return escalas[licaoNum];
      });
      
      if (licoesComProfessor.length !== licoesQueNecessitamProfessor.length) {
        throw new Error("Selecione um professor para todas as lições ou marque como 'Sem aula'");
      }

      const dataTermino = licoesComDatas.length > 0 
        ? licoesComDatas[licoesComDatas.length - 1].data 
        : addWeeks(dataInicio, revista.num_licoes - 1);

      // Criar planejamento
      const { data: planejamento, error: planejamentoError } = await supabase
        .from('ebd_planejamento')
        .insert({
          church_id: churchId,
          revista_id: revista.id,
          data_inicio: format(dataInicio, 'yyyy-MM-dd'),
          dia_semana: diaSemana,
          data_termino: format(dataTermino, 'yyyy-MM-dd'),
        })
        .select()
        .single();

      if (planejamentoError) throw planejamentoError;

      // Criar escalas
      const escalaData = licoesComDatas.map((licao) => ({
        church_id: churchId,
        turma_id: turmaId,
        professor_id: semAula[licao.numero] ? (professores?.[0]?.id || escalas[1]) : escalas[licao.numero],
        data: format(licao.data, 'yyyy-MM-dd'),
        tipo: 'Aula Regular',
        confirmado: false,
        sem_aula: semAula[licao.numero] || false,
      })).filter(item => item.professor_id);

      if (escalaData.length > 0) {
        const { error: escalaError } = await supabase
          .from('ebd_escalas')
          .insert(escalaData);

        if (escalaError) throw escalaError;
      }

      return planejamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebd-planejamentos'] });
      queryClient.invalidateQueries({ queryKey: ['ebd-escalas'] });
      toast.success('Escala montada com sucesso!');
      onOpenChange(false);
      // Reset state
      setDiaSemana("");
      setDataInicio(undefined);
      setTurmaId("");
      setEscalas({});
      setSemAula({});
      // Redirecionar para a página de escala
      navigate('/ebd/escala');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar planejamento');
      console.error(error);
    },
  });

  const handleSalvar = () => {
    if (!diaSemana || !dataInicio || !turmaId) {
      toast.error('Selecione a turma, o dia da semana e a data de início');
      return;
    }
    salvarPlanejamentoMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Montar Escala - {revista.titulo}</DialogTitle>
          <DialogDescription>
            Configure o dia e data de início, depois selecione os professores para cada lição
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Configuração inicial */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
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
          </div>

          {/* Lista de lições */}
          {turmaId && diaSemana && dataInicio && licoesComDatas.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Lições ({licoesComDatas.length})</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {licoesComDatas.map((licao) => (
                  <div 
                    key={licao.numero} 
                    className={cn(
                      "border rounded-lg p-4 transition-colors",
                      semAula[licao.numero] ? "bg-muted/50 opacity-70" : "hover:bg-accent/50"
                    )}
                  >
                    <div className="grid grid-cols-12 gap-4 items-start">
                      <div className="col-span-1 text-center">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="font-bold text-primary">{licao.numero}</span>
                        </div>
                      </div>
                      
                      <div className="col-span-11 space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground">{licao.titulo}</p>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <CalendarIcon className="h-3 w-3" />
                              <span>{format(licao.data, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`sem-aula-${licao.numero}`}
                              checked={semAula[licao.numero] || false}
                              onCheckedChange={(checked) => {
                                setSemAula(prev => ({ ...prev, [licao.numero]: checked as boolean }));
                                if (checked) {
                                  setEscalas(prev => {
                                    const newEscalas = { ...prev };
                                    delete newEscalas[licao.numero];
                                    return newEscalas;
                                  });
                                }
                              }}
                            />
                            <label 
                              htmlFor={`sem-aula-${licao.numero}`}
                              className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap"
                            >
                              Sem aula
                            </label>
                          </div>
                        </div>
                        
                        {!semAula[licao.numero] && (
                          <div className="max-w-xs">
                            <Select
                              value={escalas[licao.numero] || ""}
                              onValueChange={(value) => setEscalas({ ...escalas, [licao.numero]: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o professor" />
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
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!turmaId || !diaSemana || !dataInicio) && (
            <div className="text-center py-8 text-muted-foreground">
              Selecione a turma, o dia da semana e a data de início para ver as lições
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={salvarPlanejamentoMutation.isPending || !turmaId || !diaSemana || !dataInicio}
          >
            {salvarPlanejamentoMutation.isPending ? 'Salvando...' : 'Salvar Escala'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
