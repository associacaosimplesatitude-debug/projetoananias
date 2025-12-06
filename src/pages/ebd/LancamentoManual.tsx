import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, CalendarIcon, Users, CheckCircle, DollarSign, BookOpen, UserPlus, Save, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChurchData } from "@/hooks/useChurchData";
import { useClassroomPermissions } from "@/hooks/useClassroomPermissions";

interface Aluno {
  id: string;
  nome_completo: string;
  avatar_url?: string | null;
}

interface FrequenciaState {
  [alunoId: string]: boolean;
}

export default function LancamentoManual() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { churchId, loading: loadingChurch } = useChurchData();

  const turmaIdParam = searchParams.get("turma");
  const dataParam = searchParams.get("data");
  
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>(turmaIdParam || "");
  const [selectedDate, setSelectedDate] = useState<Date>(
    dataParam ? parseISO(dataParam) : new Date()
  );
  const [frequencia, setFrequencia] = useState<FrequenciaState>({});
  const [valorOfertas, setValorOfertas] = useState<string>("0");
  const [numVisitantes, setNumVisitantes] = useState<number>(0);
  const [numBiblias, setNumBiblias] = useState<number>(0);
  const [numRevistas, setNumRevistas] = useState<number>(0);

  const { 
    canRegisterChamada, 
    canRegisterDadosAula,
    isSuperintendente,
    loading: loadingPermissions 
  } = useClassroomPermissions({ 
    turmaId: selectedTurmaId, 
    churchId: churchId || undefined 
  });

  // Buscar turmas
  const { data: turmas, isLoading: loadingTurmas } = useQuery({
    queryKey: ["ebd-turmas-lancamento", churchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_turmas")
        .select("id, nome, faixa_etaria, responsavel_chamada, responsavel_dados_aula, permite_lancamento_ofertas, permite_lancamento_revistas, permite_lancamento_biblias")
        .eq("church_id", churchId!)
        .eq("is_active", true)
        .order("nome");

      if (error) throw error;
      return data;
    },
    enabled: !!churchId,
  });

  // Obter turma selecionada
  const selectedTurma = useMemo(() => {
    return turmas?.find(t => t.id === selectedTurmaId);
  }, [turmas, selectedTurmaId]);

  // Buscar alunos da turma selecionada
  const { data: alunos, isLoading: loadingAlunos } = useQuery({
    queryKey: ["ebd-alunos-turma", selectedTurmaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_alunos")
        .select("id, nome_completo, avatar_url")
        .eq("turma_id", selectedTurmaId)
        .eq("is_active", true)
        .order("nome_completo");

      if (error) throw error;
      return data as Aluno[];
    },
    enabled: !!selectedTurmaId,
  });

  // Buscar frequência existente para a data
  const { data: frequenciaExistente } = useQuery({
    queryKey: ["ebd-frequencia-existente", selectedTurmaId, format(selectedDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_frequencia")
        .select("aluno_id, presente")
        .eq("turma_id", selectedTurmaId)
        .eq("data", format(selectedDate, "yyyy-MM-dd"));

      if (error) throw error;
      return data;
    },
    enabled: !!selectedTurmaId,
  });

  // Buscar dados da aula existentes
  const { data: dadosAulaExistente } = useQuery({
    queryKey: ["ebd-dados-aula-existente", selectedTurmaId, format(selectedDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_dados_aula")
        .select("*")
        .eq("turma_id", selectedTurmaId)
        .eq("data", format(selectedDate, "yyyy-MM-dd"))
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedTurmaId,
  });

  // Inicializar frequência quando alunos ou dados existentes mudam
  useEffect(() => {
    if (alunos) {
      const frequenciaInicial: FrequenciaState = {};
      alunos.forEach(aluno => {
        const existente = frequenciaExistente?.find(f => f.aluno_id === aluno.id);
        frequenciaInicial[aluno.id] = existente?.presente || false;
      });
      setFrequencia(frequenciaInicial);
    }
  }, [alunos, frequenciaExistente]);

  // Inicializar dados da aula quando dados existentes mudam
  useEffect(() => {
    if (dadosAulaExistente) {
      setValorOfertas(dadosAulaExistente.valor_ofertas?.toString() || "0");
      setNumVisitantes(dadosAulaExistente.num_visitantes || 0);
      setNumBiblias(dadosAulaExistente.num_biblias || 0);
      setNumRevistas(dadosAulaExistente.num_revistas || 0);
    } else {
      setValorOfertas("0");
      setNumVisitantes(0);
      setNumBiblias(0);
      setNumRevistas(0);
    }
  }, [dadosAulaExistente]);

  const togglePresenca = (alunoId: string) => {
    setFrequencia(prev => ({
      ...prev,
      [alunoId]: !prev[alunoId]
    }));
  };

  const marcarTodosPresentes = () => {
    if (!alunos) return;
    const novaFrequencia: FrequenciaState = {};
    alunos.forEach(aluno => {
      novaFrequencia[aluno.id] = true;
    });
    setFrequencia(novaFrequencia);
  };

  const presentes = useMemo(() => {
    return Object.values(frequencia).filter(Boolean).length;
  }, [frequencia]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!churchId || !selectedTurmaId) throw new Error("Dados incompletos");
      
      const dataFormatada = format(selectedDate, "yyyy-MM-dd");

      // Salvar frequência se tiver permissão
      if (canRegisterChamada && alunos) {
        // Deletar frequência existente para esta data/turma
        await supabase
          .from("ebd_frequencia")
          .delete()
          .eq("turma_id", selectedTurmaId)
          .eq("data", dataFormatada);

        // Inserir nova frequência
        const frequenciaRecords = alunos.map(aluno => ({
          church_id: churchId,
          turma_id: selectedTurmaId,
          aluno_id: aluno.id,
          data: dataFormatada,
          presente: frequencia[aluno.id] || false,
        }));

        const { error: freqError } = await supabase
          .from("ebd_frequencia")
          .insert(frequenciaRecords);

        if (freqError) throw freqError;
      }

      // Salvar dados da aula se tiver permissão
      if (canRegisterDadosAula) {
        const dadosAula = {
          church_id: churchId,
          turma_id: selectedTurmaId,
          data: dataFormatada,
          valor_ofertas: parseFloat(valorOfertas.replace(",", ".")) || 0,
          num_visitantes: numVisitantes,
          num_biblias: numBiblias,
          num_revistas: numRevistas,
        };

        const { error: dadosError } = await supabase
          .from("ebd_dados_aula")
          .upsert(dadosAula, { 
            onConflict: "turma_id,data",
            ignoreDuplicates: false 
          });

        if (dadosError) throw dadosError;
      }
    },
    onSuccess: () => {
      toast.success("Lançamento salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ebd-frequencia"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-dados-aula"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao salvar lançamento:", error);
      toast.error("Erro ao salvar lançamento: " + error.message);
    },
  });

  if (loadingChurch) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const hasAnyPermission = canRegisterChamada || canRegisterDadosAula || isSuperintendente;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Lançamento Manual</h1>
          <p className="text-muted-foreground">Registre presença e dados da aula</p>
        </div>
      </div>

      {/* Seletores de Turma e Data */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Turma</Label>
              <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {turmas?.map(turma => (
                    <SelectItem key={turma.id} value={turma.id}>
                      {turma.nome} ({turma.faixa_etaria})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data da Aula</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedTurmaId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Selecione uma turma para iniciar o lançamento</p>
          </CardContent>
        </Card>
      ) : loadingAlunos || loadingPermissions ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : !hasAnyPermission ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Você não tem permissão para fazer lançamentos nesta turma.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Seção de Chamada */}
          {canRegisterChamada && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-primary" />
                      Chamada (Presença)
                    </CardTitle>
                    <CardDescription>
                      {presentes} de {alunos?.length || 0} presentes
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={marcarTodosPresentes}>
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Marcar Todos
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!alunos || alunos.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum aluno cadastrado nesta turma
                  </p>
                ) : (
                  <div className="space-y-2">
                    {alunos.map((aluno) => (
                      <div
                        key={aluno.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer",
                          frequencia[aluno.id] 
                            ? "bg-green-500/10 border-green-500/30" 
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => togglePresenca(aluno.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={frequencia[aluno.id] || false}
                            onCheckedChange={() => togglePresenca(aluno.id)}
                          />
                          <span className="font-medium">{aluno.nome_completo}</span>
                        </div>
                        {frequencia[aluno.id] && (
                          <span className="text-sm text-green-600 font-medium">
                            Presente
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Seção de Dados da Aula */}
          {canRegisterDadosAula && (selectedTurma?.permite_lancamento_ofertas || selectedTurma?.permite_lancamento_revistas || selectedTurma?.permite_lancamento_biblias) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Dados da Aula
                </CardTitle>
                <CardDescription>
                  Registre as ofertas e estatísticas da aula
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {selectedTurma?.permite_lancamento_ofertas && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        Ofertas (R$)
                      </Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={valorOfertas}
                        onChange={(e) => setValorOfertas(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-blue-600" />
                      Visitantes
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={numVisitantes}
                      onChange={(e) => setNumVisitantes(parseInt(e.target.value) || 0)}
                    />
                  </div>

                  {selectedTurma?.permite_lancamento_biblias && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-purple-600" />
                        Bíblias
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={numBiblias}
                        onChange={(e) => setNumBiblias(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  )}

                  {selectedTurma?.permite_lancamento_revistas && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-orange-600" />
                        Revistas
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={numRevistas}
                        onChange={(e) => setNumRevistas(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botão Salvar */}
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            <Save className="h-5 w-5 mr-2" />
            {saveMutation.isPending ? "Salvando..." : "Salvar Lançamento"}
          </Button>
        </div>
      )}
    </div>
  );
}
