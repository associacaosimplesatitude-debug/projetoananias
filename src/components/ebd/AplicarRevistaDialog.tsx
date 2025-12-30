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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  BookOpen, 
  Users, 
  GraduationCap, 
  CalendarIcon, 
  CheckCircle2, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  School,
  ClipboardList
} from "lucide-react";
import { toast } from "sonner";
import { format, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FAIXAS_ETARIAS } from "@/constants/ebdFaixasEtarias";
import { RevistaBaseNaoAplicada } from "@/hooks/useOnboardingProgress";
import { storefrontApiRequest } from "@/lib/shopify";

// Query para buscar produto por título com a descrição HTML
const SEARCH_PRODUCT_WITH_DESCRIPTION = `
  query SearchProductByTitle($query: String!) {
    products(first: 1, query: $query) {
      edges {
        node {
          id
          title
          descriptionHtml
        }
      }
    }
  }
`;

// Função para parsear as lições do HTML
function parseLicoesFromHtml(html: string): string[] {
  if (!html) return [];
  
  // Remover tags HTML e extrair texto de cada parágrafo
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const paragraphs = doc.querySelectorAll('p');
  
  const licoes: string[] = [];
  let skipHeader = true;
  
  paragraphs.forEach((p) => {
    const text = p.textContent?.trim() || '';
    
    // Pular parágrafos vazios
    if (!text) return;
    
    // Pular o header "TÍTULO DAS LIÇÕES" ou similar
    if (skipHeader && (
      text.toUpperCase().includes('TÍTULO') || 
      text.toUpperCase().includes('LIÇÕES') ||
      text.toUpperCase().includes('LICOES')
    )) {
      return;
    }
    
    skipHeader = false;
    
    // Adicionar apenas se parece um título de lição válido
    if (text.length > 2 && text.length < 150 && licoes.length < 13) {
      licoes.push(text);
    }
  });
  
  // Se não encontrou com a lógica de parágrafos, tentar extrair por formato numerado
  if (licoes.length === 0) {
    // Tenta dividir por números (1 - Título, 2 - Título, etc.)
    const matches = html.match(/\d+\s*[–-]\s*[^<\n]+/g);
    if (matches) {
      matches.forEach(match => {
        const titulo = match.replace(/^\d+\s*[–-]\s*/, '').trim();
        if (titulo && licoes.length < 13) licoes.push(titulo);
      });
    }
  }
  
  return licoes.slice(0, 13);
}

interface AplicarRevistaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string | null;
  revistasNaoAplicadas: RevistaBaseNaoAplicada[];
  onComplete: () => void;
  marcarEtapa: (etapaId: number, revistaId?: string) => void;
}

interface Turma {
  id: string;
  nome: string;
  faixa_etaria: string;
  professoresCount?: number;
}

interface Professor {
  id: string;
  nome_completo: string;
  email?: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

const diasSemana = [
  { value: "Domingo", label: "Domingo", dayNumber: 0 },
  { value: "Segunda-feira", label: "Segunda-feira", dayNumber: 1 },
  { value: "Terça-feira", label: "Terça-feira", dayNumber: 2 },
  { value: "Quarta-feira", label: "Quarta-feira", dayNumber: 3 },
  { value: "Quinta-feira", label: "Quinta-feira", dayNumber: 4 },
  { value: "Sexta-feira", label: "Sexta-feira", dayNumber: 5 },
  { value: "Sábado", label: "Sábado", dayNumber: 6 },
];

export function AplicarRevistaDialog({
  open,
  onOpenChange,
  churchId,
  revistasNaoAplicadas,
  onComplete,
  marcarEtapa,
}: AplicarRevistaDialogProps) {
  const queryClient = useQueryClient();
  
  // Estado do wizard
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedRevista, setSelectedRevista] = useState<RevistaBaseNaoAplicada | null>(null);
  
  // Estado etapa 2 - Turma
  const [turmaMode, setTurmaMode] = useState<"select" | "create">("select");
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>("");
  const [novaTurmaNome, setNovaTurmaNome] = useState("");
  const [novaTurmaFaixaEtaria, setNovaTurmaFaixaEtaria] = useState("");
  
  // Estado etapa 3 - Professores
  const [selectedProfessores, setSelectedProfessores] = useState<string[]>([]);
  
  // Estado etapa 4 - Data de início
  const [diaSemana, setDiaSemana] = useState("");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  
  // Estado etapa 5 - Escala
  const [escalas, setEscalas] = useState<Record<number, string>>({});
  const [semAula, setSemAula] = useState<Record<number, boolean>>({});

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setSelectedRevista(null);
      setTurmaMode("select");
      setSelectedTurmaId("");
      setNovaTurmaNome("");
      setNovaTurmaFaixaEtaria("");
      setSelectedProfessores([]);
      setDiaSemana("");
      setDataInicio(undefined);
      setEscalas({});
      setSemAula({});
    }
  }, [open]);

  // Buscar turmas existentes
  const { data: turmas, isLoading: loadingTurmas } = useQuery({
    queryKey: ["ebd-turmas-dialog", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("ebd_turmas")
        .select(`
          id, 
          nome, 
          faixa_etaria,
          ebd_professores_turmas(count)
        `)
        .eq("church_id", churchId)
        .eq("is_active", true)
        .order("nome");
      
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        professoresCount: t.ebd_professores_turmas?.[0]?.count || 0,
      })) as Turma[];
    },
    enabled: !!churchId && open,
  });

  // Buscar professores
  const { data: professores, isLoading: loadingProfessores } = useQuery({
    queryKey: ["ebd-professores-dialog", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("ebd_professores")
        .select("id, nome_completo, email")
        .eq("church_id", churchId)
        .eq("is_active", true)
        .order("nome_completo");
      
      if (error) throw error;
      return data as Professor[];
    },
    enabled: !!churchId && open,
  });

  // Buscar lições da revista selecionada via Shopify
  const { data: licoesRevista, isLoading: loadingLicoes } = useQuery({
    queryKey: ["ebd-licoes-shopify", selectedRevista?.id],
    queryFn: async () => {
      if (!selectedRevista) return [];
      
      try {
        // Extrair palavras-chave do título da revista para busca
        const titulo = selectedRevista.titulo
          .replace(/\d+\s*(un|und|x)\s*/gi, '') // Remove quantidades (10un, 20und, 100x)
          .replace(/revista\s*ebd/gi, '') // Remove "Revista EBD"
          .replace(/professor|mestre|aluno/gi, '') // Remove tipo
          .replace(/nº?\s*\d+/gi, '') // Remove números de edição
          .replace(/jovens\s*e?\s*adultos|juniores|primários|pre-adolescentes|adolescentes/gi, '') // Remove faixa etária
          .replace(/[-–]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Usar apenas palavras principais para a busca
        const palavrasChave = titulo.split(' ').filter(p => p.length > 3).slice(0, 4);
        const searchQuery = palavrasChave.join(' ');
        
        console.log('Buscando lições para:', searchQuery);
        
        const response = await storefrontApiRequest(SEARCH_PRODUCT_WITH_DESCRIPTION, {
          query: searchQuery,
        });
        
        const products = response.data?.products?.edges || [];
        
        if (products.length > 0) {
          const descriptionHtml = products[0].node.descriptionHtml;
          const licoes = parseLicoesFromHtml(descriptionHtml);
          
          console.log('Lições encontradas:', licoes.length, licoes);
          
          if (licoes.length > 0) {
            return licoes;
          }
        }
        
        // Fallback: gerar lições genéricas se não encontrar
        console.log('Nenhuma lição encontrada, usando fallback');
        return Array.from({ length: 13 }, (_, i) => `Lição ${i + 1}`);
      } catch (error) {
        console.error("Erro ao buscar lições do Shopify:", error);
        return Array.from({ length: 13 }, (_, i) => `Lição ${i + 1}`);
      }
    },
    enabled: !!selectedRevista && open && currentStep >= 4, // Começar a buscar antes da etapa 5
    staleTime: 1000 * 60 * 30, // Cache por 30 minutos
  });

  // Calcular datas das aulas
  const numLicoes = selectedRevista ? 13 : 13; // Default 13 lições
  const aulasCalculadas = (() => {
    if (!dataInicio || !diaSemana) return [];
    
    const diaSelecionado = diasSemana.find(d => d.value === diaSemana);
    if (!diaSelecionado) return [];

    const result: Array<{ numero: number; data: Date }> = [];
    let dataAtual = new Date(dataInicio);
    
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
  })();

  const dataTermino = aulasCalculadas.length > 0 
    ? aulasCalculadas[aulasCalculadas.length - 1].data 
    : undefined;

  // Mutation para salvar tudo
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!churchId || !selectedRevista) throw new Error("Dados incompletos");

      let turmaId = selectedTurmaId;

      // Criar turma se necessário
      if (turmaMode === "create") {
        const { data: novaTurma, error: turmaError } = await supabase
          .from("ebd_turmas")
          .insert({
            church_id: churchId,
            nome: novaTurmaNome.trim(),
            faixa_etaria: novaTurmaFaixaEtaria,
          })
          .select("id")
          .single();

        if (turmaError) throw turmaError;
        turmaId = novaTurma.id;
      }

      if (!turmaId) throw new Error("Turma não selecionada");

      // Vincular professores à turma
      if (selectedProfessores.length > 0) {
        // Remover vínculos existentes
        await supabase
          .from("ebd_professores_turmas")
          .delete()
          .eq("turma_id", turmaId);

        // Criar novos vínculos
        const vinculos = selectedProfessores.map(professorId => ({
          turma_id: turmaId,
          professor_id: professorId,
        }));

        const { error: vinculoError } = await supabase
          .from("ebd_professores_turmas")
          .insert(vinculos);

        if (vinculoError) throw vinculoError;
      }

      // Criar planejamento
      if (!dataInicio || !diaSemana || !dataTermino) {
        throw new Error("Data de início não definida");
      }

      const { error: planejamentoError } = await supabase
        .from("ebd_planejamento")
        .insert({
          church_id: churchId,
          revista_id: selectedRevista.id,
          data_inicio: format(dataInicio, "yyyy-MM-dd"),
          dia_semana: diaSemana,
          data_termino: format(dataTermino, "yyyy-MM-dd"),
        });

      if (planejamentoError) throw planejamentoError;

      // Criar escalas
      const escalaData = aulasCalculadas.map((aula) => ({
        church_id: churchId,
        turma_id: turmaId,
        professor_id: semAula[aula.numero] ? null : (escalas[aula.numero] || null),
        data: format(aula.data, "yyyy-MM-dd"),
        tipo: "Aula Regular",
        confirmado: false,
        sem_aula: semAula[aula.numero] || false,
      }));

      const { error: escalaError } = await supabase
        .from("ebd_escalas")
        .insert(escalaData);

      if (escalaError) throw escalaError;

      // Atualizar ebd_clientes
      await supabase
        .from("ebd_clientes")
        .update({
          dia_aula: diaSemana,
          data_inicio_ebd: format(dataInicio, "yyyy-MM-dd"),
        })
        .eq("id", churchId);

      // Marcar etapas como concluídas
      marcarEtapa(1, selectedRevista.id);
      
      // Marcar etapas 2-5 no banco
      for (const etapaId of [2, 3, 4, 5]) {
        await supabase
          .from("ebd_onboarding_progress")
          .upsert({
            church_id: churchId,
            etapa_id: etapaId,
            completada: true,
            completada_em: new Date().toISOString(),
          }, { onConflict: "church_id,etapa_id" });
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ebd-turmas"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-professores"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-planejamentos"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-escalas"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-onboarding-progress"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-revistas-nao-aplicadas"] });
      
      toast.success("Revista configurada com sucesso! 🎉");
      onOpenChange(false);
      onComplete();
    },
    onError: (error: Error) => {
      console.error("Erro ao configurar revista:", error);
      toast.error(error.message || "Erro ao configurar revista");
    },
  });

  // Validação para avançar
  const canAdvance = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!selectedRevista;
      case 2:
        return turmaMode === "select" 
          ? !!selectedTurmaId 
          : (!!novaTurmaNome.trim() && !!novaTurmaFaixaEtaria);
      case 3:
        return selectedProfessores.length > 0;
      case 4:
        return !!diaSemana && !!dataInicio;
      case 5:
        // Verificar se todas as aulas têm professor ou estão marcadas como sem aula
        return aulasCalculadas.every(aula => 
          semAula[aula.numero] || escalas[aula.numero]
        );
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep((currentStep + 1) as Step);
    } else {
      saveMutation.mutate();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  const toggleProfessor = (professorId: string) => {
    setSelectedProfessores(prev =>
      prev.includes(professorId)
        ? prev.filter(id => id !== professorId)
        : [...prev, professorId]
    );
  };

  const stepTitles: Record<Step, string> = {
    1: "Selecionar Revista",
    2: "Configurar Turma",
    3: "Vincular Professores",
    4: "Definir Datas",
    5: "Montar Escala",
  };

  const stepIcons: Record<Step, any> = {
    1: BookOpen,
    2: School,
    3: GraduationCap,
    4: CalendarIcon,
    5: ClipboardList,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {(() => {
              const Icon = stepIcons[currentStep];
              return <Icon className="h-5 w-5 text-primary" />;
            })()}
            {stepTitles[currentStep]}
          </DialogTitle>
          <DialogDescription>
            Etapa {currentStep} de 5 - Configure a revista para sua EBD
          </DialogDescription>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 pt-4">
            {([1, 2, 3, 4, 5] as Step[]).map((step) => {
              const Icon = stepIcons[step];
              const isActive = step === currentStep;
              const isCompleted = step < currentStep;
              
              return (
                <div key={step} className="flex items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                      isCompleted 
                        ? "bg-green-500/20 border-2 border-green-500" 
                        : isActive 
                        ? "bg-primary/20 border-2 border-primary" 
                        : "bg-muted border-2 border-muted-foreground/30"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Icon className={cn(
                        "h-4 w-4",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )} />
                    )}
                  </div>
                  {step < 5 && (
                    <div className={cn(
                      "w-8 h-0.5 mx-1",
                      step < currentStep ? "bg-green-500" : "bg-muted"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="py-4 min-h-[300px]">
            {/* Step 1: Selecionar Revista */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Você tem {revistasNaoAplicadas.length} revista(s) aguardando configuração. Selecione uma para continuar.
                </p>
                
                <div className="grid gap-3">
                  {revistasNaoAplicadas.map((revista) => (
                    <div
                      key={revista.id}
                      onClick={() => setSelectedRevista(revista)}
                      className={cn(
                        "flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all",
                        selectedRevista?.id === revista.id
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "hover:bg-muted/50"
                      )}
                    >
                      {revista.imagemUrl ? (
                        <img
                          src={revista.imagemUrl}
                          alt={revista.titulo}
                          className="w-16 h-20 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-20 bg-muted rounded flex items-center justify-center">
                          <BookOpen className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium">{revista.titulo}</h4>
                        <p className="text-sm text-muted-foreground">
                          Quantidade: {revista.quantidade} unidade(s)
                        </p>
                      </div>
                      {selectedRevista?.id === revista.id && (
                        <CheckCircle2 className="h-6 w-6 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Configurar Turma */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <Tabs value={turmaMode} onValueChange={(v) => setTurmaMode(v as "select" | "create")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="select" className="gap-2">
                      <Users className="h-4 w-4" />
                      Usar Turma Existente
                    </TabsTrigger>
                    <TabsTrigger value="create" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Criar Nova Turma
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="select" className="space-y-4 mt-4">
                    {loadingTurmas ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : turmas && turmas.length > 0 ? (
                      <div className="grid gap-3">
                        {turmas.map((turma) => (
                          <div
                            key={turma.id}
                            onClick={() => setSelectedTurmaId(turma.id)}
                            className={cn(
                              "flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all",
                              selectedTurmaId === turma.id
                                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <div>
                              <h4 className="font-medium">{turma.nome}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary">{turma.faixa_etaria}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {turma.professoresCount || 0} professor(es)
                                </span>
                              </div>
                            </div>
                            {selectedTurmaId === turma.id && (
                              <CheckCircle2 className="h-6 w-6 text-primary" />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <School className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground mt-2">Nenhuma turma cadastrada</p>
                        <Button 
                          variant="outline" 
                          className="mt-4"
                          onClick={() => setTurmaMode("create")}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Criar Nova Turma
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="create" className="space-y-4 mt-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome da Turma *</Label>
                        <Input
                          placeholder="Ex: Cordeirinhos de Cristo"
                          value={novaTurmaNome}
                          onChange={(e) => setNovaTurmaNome(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Faixa Etária *</Label>
                        <Select value={novaTurmaFaixaEtaria} onValueChange={setNovaTurmaFaixaEtaria}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a faixa etária" />
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
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Step 3: Vincular Professores */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Selecione os professores que darão aula para esta turma.
                </p>

                {loadingProfessores ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : professores && professores.length > 0 ? (
                  <div className="space-y-3">
                    {professores.map((professor) => (
                      <div
                        key={professor.id}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <Checkbox
                          id={professor.id}
                          checked={selectedProfessores.includes(professor.id)}
                          onCheckedChange={() => toggleProfessor(professor.id)}
                        />
                        <Label
                          htmlFor={professor.id}
                          className="flex-1 cursor-pointer"
                        >
                          <span className="font-medium">{professor.nome_completo}</span>
                          {professor.email && (
                            <span className="text-muted-foreground ml-2 text-sm">
                              ({professor.email})
                            </span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground mt-2">Nenhum professor cadastrado</p>
                    <p className="text-sm text-muted-foreground">
                      Você precisará cadastrar professores primeiro.
                    </p>
                  </div>
                )}

                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm">
                    <strong>{selectedProfessores.length}</strong> professor(es) selecionado(s)
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Definir Datas */}
            {currentStep === 4 && (
              <div className="space-y-6">
                {selectedRevista && (
                  <div className="flex gap-4 p-4 border rounded-lg bg-muted/30">
                    {selectedRevista.imagemUrl ? (
                      <img
                        src={selectedRevista.imagemUrl}
                        alt={selectedRevista.titulo}
                        className="w-16 h-20 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-20 bg-primary/10 rounded flex items-center justify-center">
                        <BookOpen className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold">{selectedRevista.titulo}</h3>
                      <p className="text-sm text-muted-foreground">{numLicoes} lições</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Dia da Aula *</Label>
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
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {diaSemana && dataInicio && aulasCalculadas.length > 0 && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">
                        ✓ Calendário calculado
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Término: {dataTermino && format(dataTermino, "dd/MM/yyyy")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Montar Escala */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Defina qual professor dará cada aula ou marque como "Sem aula" para feriados.
                </p>

                {loadingLicoes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Carregando lições...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {aulasCalculadas.map((aula) => {
                      const tituloLicao = licoesRevista?.[aula.numero - 1] || `Lição ${aula.numero}`;
                      
                      return (
                        <div key={aula.numero} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-bold text-primary">{aula.numero}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm leading-tight">
                                  {tituloLicao}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(aula.data, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <Checkbox
                                id={`sem-aula-${aula.numero}`}
                                checked={semAula[aula.numero] || false}
                                onCheckedChange={(checked) => {
                                  setSemAula(prev => ({ ...prev, [aula.numero]: checked as boolean }));
                                  if (checked) {
                                    setEscalas(prev => {
                                      const newEscalas = { ...prev };
                                      delete newEscalas[aula.numero];
                                      return newEscalas;
                                    });
                                  }
                                }}
                              />
                              <label
                                htmlFor={`sem-aula-${aula.numero}`}
                                className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap"
                              >
                                Sem aula
                              </label>
                            </div>
                          </div>

                          {!semAula[aula.numero] && (
                            <Select
                              value={escalas[aula.numero] || ""}
                              onValueChange={(value) => setEscalas(prev => ({ ...prev, [aula.numero]: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o professor" />
                              </SelectTrigger>
                              <SelectContent>
                                {professores?.filter(p => selectedProfessores.includes(p.id)).map((professor) => (
                                  <SelectItem key={professor.id} value={professor.id}>
                                    {professor.nome_completo}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-between pt-4 border-t">
          <div>
            {currentStep > 1 && (
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleNext} 
              disabled={!canAdvance() || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : currentStep === 5 ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Finalizar Configuração
                </>
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
