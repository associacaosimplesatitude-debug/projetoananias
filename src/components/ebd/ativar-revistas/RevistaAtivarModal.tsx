import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Save, Check } from "lucide-react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useEbdChurchId } from "@/hooks/useEbdChurchId";
import { ShopifyProduct } from "@/lib/shopify";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RevistaAtivarModalProps {
  produto: ShopifyProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
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

interface AulaConfig {
  numero: number;
  data: Date;
  semAula: boolean;
  professorId1: string;
  professorId2: string;
  tituloLicao: string;
}

// Extrair títulos das lições da descrição do produto
function extrairTitulosLicoes(descricao: string): string[] {
  const titulos: string[] = [];
  if (!descricao) return titulos;

  let texto = descricao
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

  const marcadoresFim = ["especificações técnicas", "especificacoes tecnicas", "formato:", "páginas:", "paginas:", "preço:", "preco:", "sku:", "isbn:"];
  const lower = texto.toLowerCase();
  for (const marcador of marcadoresFim) {
    const idx = lower.indexOf(marcador);
    if (idx !== -1) {
      texto = texto.slice(0, idx).trim();
      break;
    }
  }

  const lowerTexto = texto.toLowerCase();
  const idx = lowerTexto.indexOf("lições");
  const idx2 = idx === -1 ? lowerTexto.indexOf("licoes") : idx;
  const trecho = idx2 === -1 ? texto : texto.slice(idx2);

  const re = /(\d{1,2})\s*[-–—:\.\)]\s*(.+?)(?=\s+\d{1,2}\s*[-–—:\.\)]\s*|$)/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(trecho)) !== null) {
    const numero = parseInt(m[1], 10);
    const titulo = m[2].trim();
    if (numero >= 1 && numero <= 13 && titulo) {
      titulos[numero - 1] = titulo;
    }
  }

  return titulos;
}

export function RevistaAtivarModal({
  produto,
  open,
  onOpenChange,
  onSuccess,
}: RevistaAtivarModalProps) {
  const { data: churchData } = useEbdChurchId();
  const churchId = churchData?.id;
  const queryClient = useQueryClient();

  const [turmaId, setTurmaId] = useState("");
  const [diaSemana, setDiaSemana] = useState("domingo");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [aulas, setAulas] = useState<AulaConfig[]>([]);
  const [step, setStep] = useState<'config' | 'escala'>('config');

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
    enabled: !!churchId && open,
  });

  // Buscar professores da igreja
  const { data: professores, isLoading: loadingProfessores } = useQuery({
    queryKey: ['professores-ebd', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from('ebd_professores')
        .select('id, nome_completo, avatar_url')
        .eq('church_id', churchId)
        .eq('is_active', true)
        .order('nome_completo');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!churchId && open,
  });

  // Reset quando fechar modal
  useEffect(() => {
    if (!open) {
      setTurmaId("");
      setDiaSemana("domingo");
      setDataInicio(undefined);
      setAulas([]);
      setStep('config');
    }
  }, [open]);

  // Gerar aulas quando tiver data de início
  useEffect(() => {
    if (dataInicio && produto) {
      const descricao = produto.node.description || '';
      const titulosLicoes = extrairTitulosLicoes(descricao);
      
      const novasAulas: AulaConfig[] = Array.from({ length: 13 }, (_, i) => ({
        numero: i + 1,
        data: addDays(dataInicio, i * 7),
        semAula: false,
        professorId1: '',
        professorId2: '',
        tituloLicao: titulosLicoes[i] || '',
      }));
      
      setAulas(novasAulas);
    }
  }, [dataInicio, produto]);

  const handleAulaChange = (index: number, field: keyof AulaConfig, value: boolean | string) => {
    setAulas(prev => {
      const newAulas = [...prev];
      newAulas[index] = { ...newAulas[index], [field]: value };
      return newAulas;
    });
  };

  const handleAvancar = () => {
    if (!turmaId || !dataInicio) {
      toast.error("Selecione a turma e data de início");
      return;
    }
    setStep('escala');
  };

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!churchId || !produto || !turmaId || !dataInicio) {
        throw new Error("Dados incompletos");
      }

      const dataInicioStr = format(dataInicio, "yyyy-MM-dd");
      const ultimaAula = aulas[aulas.length - 1];
      const dataTermino = format(ultimaAula.data, "yyyy-MM-dd");
      const tituloRevista = produto.node.title;
      const imagemUrl = produto.node.images.edges[0]?.node.url || null;

      // 1) Garantir que existe um registro em ebd_revistas
      const { data: revistaExistente, error: revistaExistenteError } = await supabase
        .from("ebd_revistas")
        .select("id")
        .eq("titulo", tituloRevista)
        .maybeSingle();

      if (revistaExistenteError) throw revistaExistenteError;

      let revistaId = revistaExistente?.id as string | undefined;

      if (!revistaId) {
        const turmaSelecionada = turmas?.find(t => t.id === turmaId);
        const { data: revistaNova, error: revistaNovaError } = await supabase
          .from("ebd_revistas")
          .insert({
            titulo: tituloRevista,
            faixa_etaria_alvo: turmaSelecionada?.nome || "Geral",
            imagem_url: imagemUrl,
          })
          .select("id")
          .single();

        if (revistaNovaError) throw revistaNovaError;
        revistaId = revistaNova.id;
      }

      // 2) Verificar se já existe planejamento para esta revista+turma (sobrescrever)
      const { data: planejamentoExistente, error: planejamentoExistenteError } = await supabase
        .from("ebd_planejamento")
        .select("id")
        .eq("church_id", churchId)
        .eq("revista_id", revistaId)
        .maybeSingle();

      if (planejamentoExistenteError) throw planejamentoExistenteError;

      let planejamentoId: string;

      if (planejamentoExistente?.id) {
        // Atualizar planejamento existente
        const { error: planUpdateError } = await supabase
          .from("ebd_planejamento")
          .update({
            data_inicio: dataInicioStr,
            data_termino: dataTermino,
            dia_semana: diaSemana,
          })
          .eq("id", planejamentoExistente.id);

        if (planUpdateError) throw planUpdateError;
        planejamentoId = planejamentoExistente.id;
      } else {
        // Criar novo planejamento
        const { data: planNovo, error: planInsertError } = await supabase
          .from("ebd_planejamento")
          .insert({
            church_id: churchId,
            revista_id: revistaId,
            data_inicio: dataInicioStr,
            data_termino: dataTermino,
            dia_semana: diaSemana,
          })
          .select("id")
          .single();

        if (planInsertError) throw planInsertError;
        planejamentoId = planNovo.id;
      }

      // 3) Limpar escalas existentes para esta turma no período
      const { error: deleteError } = await supabase
        .from("ebd_escalas")
        .delete()
        .eq("church_id", churchId)
        .eq("turma_id", turmaId)
        .gte("data", dataInicioStr)
        .lte("data", dataTermino);

      if (deleteError) throw deleteError;

      // 4) Criar as escalas
      const aulasParaInserir = aulas.map((aula) => ({
        church_id: churchId,
        turma_id: turmaId,
        data: format(aula.data, "yyyy-MM-dd"),
        tipo: "aula",
        professor_id: aula.semAula ? null : aula.professorId1 || null,
        professor_id_2: aula.semAula ? null : aula.professorId2 || null,
        sem_aula: aula.semAula,
        confirmado: false,
        observacao: `Aula ${aula.numero} - ${tituloRevista}`,
      }));

      const { error: escalaError } = await supabase
        .from("ebd_escalas")
        .insert(aulasParaInserir);

      if (escalaError) throw escalaError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebd-planejamentos-with-turmas'] });
      queryClient.invalidateQueries({ queryKey: ['ebd-escalas'] });
      toast.success("Revista ativada com sucesso!");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao ativar revista. Tente novamente.");
    },
  });

  const turmaSelecionada = turmas?.find(t => t.id === turmaId);
  const canAvancar = turmaId && dataInicio;

  if (!produto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {step === 'config' ? 'Ativar Revista' : 'Montar Escala de Professores'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-180px)] pr-4">
          {step === 'config' ? (
            <div className="py-4 space-y-6">
              {/* Imagem e título da revista */}
              <div className="flex gap-4">
                <div className="w-20 h-28 bg-muted rounded overflow-hidden flex-shrink-0">
                  {produto.node.images.edges[0]?.node.url ? (
                    <img
                      src={produto.node.images.edges[0].node.url}
                      alt={produto.node.title}
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
                    {produto.node.title}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure a turma, dia e data de início
                  </p>
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
          ) : (
            <div className="py-4 space-y-4">
              {/* Resumo da revista e turma */}
              <div className="flex gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="w-12 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                  {produto.node.images.edges[0]?.node.url && (
                    <img
                      src={produto.node.images.edges[0].node.url}
                      alt={produto.node.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="text-sm">
                  <p className="font-medium line-clamp-1">{produto.node.title}</p>
                  <p className="text-muted-foreground">Turma: {turmaSelecionada?.nome}</p>
                  <p className="text-muted-foreground">
                    {diaSemana} | Início: {dataInicio && format(dataInicio, "dd/MM/yyyy")}
                  </p>
                </div>
              </div>

              {/* Lista de aulas com professores */}
              <div className="space-y-2">
                {aulas.map((aula, index) => (
                  <div
                    key={aula.numero}
                    className={cn(
                      "flex flex-wrap items-center gap-3 p-3 rounded-lg border",
                      aula.semAula ? "bg-muted/50" : "bg-background"
                    )}
                  >
                    <div className="min-w-[160px] flex-shrink-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium">Aula {aula.numero}</span>
                        <span className="text-sm text-muted-foreground">
                          {format(aula.data, "dd/MM", { locale: ptBR })}
                        </span>
                      </div>
                      {aula.tituloLicao && (
                        <p className="text-xs text-primary font-medium mt-0.5 line-clamp-1">
                          {aula.tituloLicao}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`sem-aula-${index}`}
                        checked={aula.semAula}
                        onCheckedChange={(checked) =>
                          handleAulaChange(index, 'semAula', !!checked)
                        }
                      />
                      <Label htmlFor={`sem-aula-${index}`} className="text-sm">
                        Sem aula
                      </Label>
                    </div>

                    {!aula.semAula && (
                      <>
                        <div className="flex-1 min-w-[150px]">
                          <Select
                            value={aula.professorId1}
                            onValueChange={(value) =>
                              handleAulaChange(index, 'professorId1', value)
                            }
                            disabled={loadingProfessores}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Professor 1" />
                            </SelectTrigger>
                            <SelectContent>
                              {professores?.map((prof) => (
                                <SelectItem key={prof.id} value={prof.id}>
                                  {prof.nome_completo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex-1 min-w-[150px]">
                          <Select
                            value={aula.professorId2}
                            onValueChange={(value) =>
                              handleAulaChange(index, 'professorId2', value === "_none" ? "" : value)
                            }
                            disabled={loadingProfessores}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Professor 2" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">Nenhum</SelectItem>
                              {professores?.map((prof) => (
                                <SelectItem key={prof.id} value={prof.id}>
                                  {prof.nome_completo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          {step === 'config' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAvancar} disabled={!canAvancar}>
                Próximo: Montar Escala
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('config')}>
                Voltar
              </Button>
              <Button
                onClick={() => salvarMutation.mutate()}
                disabled={salvarMutation.isPending}
              >
                {salvarMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Ativar Revista
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
