import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEbdChurchId } from "@/hooks/useEbdChurchId";
import { parseQuizText, validateParsedQuiz, ParsedQuiz } from "@/lib/quizParser";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, XCircle, AlertTriangle, Clock, Sparkles } from "lucide-react";

interface CriarQuizAulaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CriarQuizAulaDialog({ open, onOpenChange }: CriarQuizAulaDialogProps) {
  const { user } = useAuth();
  const { data: churchData } = useEbdChurchId();
  const churchId = churchData?.id;
  const queryClient = useQueryClient();

  const [turmaId, setTurmaId] = useState<string>("");
  const [escalaId, setEscalaId] = useState<string>("");
  const [horaLiberacao, setHoraLiberacao] = useState("09:00");
  const [textoPerguntas, setTextoPerguntas] = useState("");

  // Buscar turmas
  const { data: turmas } = useQuery({
    queryKey: ["turmas-quiz", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("ebd_turmas")
        .select("id, nome")
        .eq("church_id", churchId)
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: !!churchId && open,
  });

  // Buscar aulas da escala da turma selecionada
  const { data: aulas } = useQuery({
    queryKey: ["aulas-escala-quiz", turmaId],
    queryFn: async () => {
      if (!turmaId) return [];
      const { data, error } = await supabase
        .from("ebd_escalas")
        .select("id, data, observacao, sem_aula")
        .eq("turma_id", turmaId)
        .eq("tipo", "aula")
        .eq("sem_aula", false)
        .order("data", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!turmaId,
  });

  // Parsear texto das perguntas
  const parsedQuiz = useMemo(() => {
    if (!textoPerguntas.trim()) return null;
    return parseQuizText(textoPerguntas);
  }, [textoPerguntas]);

  const validation = useMemo(() => {
    if (!parsedQuiz) return null;
    return validateParsedQuiz(parsedQuiz);
  }, [parsedQuiz]);

  // Aula selecionada
  const aulaSelecionada = aulas?.find((a) => a.id === escalaId);

  // Mutation para criar quiz
  const createQuizMutation = useMutation({
    mutationFn: async () => {
      if (!parsedQuiz || !validation?.valid || !turmaId || !escalaId || !aulaSelecionada) {
        throw new Error("Dados incompletos");
      }

      // Criar quiz - usando type assertion pois as novas colunas ainda não estão nos tipos gerados
      const { data: quiz, error: quizError } = await supabase
        .from("ebd_quizzes")
        .insert([{
          turma_id: turmaId,
          titulo: parsedQuiz.titulo,
          descricao: parsedQuiz.descricao || null,
          data_limite: aulaSelecionada.data,
          pontos_max: parsedQuiz.perguntas.length * 10,
          is_active: true,
          // Campos novos - cast para any
          escala_id: escalaId,
          contexto: parsedQuiz.contexto || null,
          nivel: parsedQuiz.nivel || "Médio",
          hora_liberacao: horaLiberacao,
        } as any])
        .select()
        .single();

      if (quizError) throw quizError;

      // Criar questões
      const questoes = parsedQuiz.perguntas.map((p) => ({
        quiz_id: quiz.id,
        ordem: p.ordem,
        pergunta: p.pergunta,
        opcao_a: p.opcao_a,
        opcao_b: p.opcao_b,
        opcao_c: p.opcao_c,
        opcao_d: p.opcao_d || null,
        resposta_correta: p.resposta_correta,
      }));

      const { error: questoesError } = await supabase
        .from("ebd_quiz_questoes")
        .insert(questoes);

      if (questoesError) throw questoesError;

      return quiz;
    },
    onSuccess: () => {
      toast.success("Quiz criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao criar quiz:", error);
      toast.error("Erro ao criar quiz");
    },
  });

  const resetForm = () => {
    setTurmaId("");
    setEscalaId("");
    setHoraLiberacao("09:00");
    setTextoPerguntas("");
  };

  const canCreate =
    turmaId &&
    escalaId &&
    parsedQuiz &&
    validation?.valid &&
    !createQuizMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Criar Quiz para Aula
          </DialogTitle>
          <DialogDescription>
            Cole as perguntas no formato padrão e configure quando o quiz será liberado
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Seleção de Turma e Aula */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Turma</Label>
                <Select value={turmaId} onValueChange={(v) => { setTurmaId(v); setEscalaId(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a turma" />
                  </SelectTrigger>
                  <SelectContent>
                    {turmas?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Aula</Label>
                <Select value={escalaId} onValueChange={setEscalaId} disabled={!turmaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a aula" />
                  </SelectTrigger>
                  <SelectContent>
                    {aulas?.map((a, i) => (
                      <SelectItem key={a.id} value={a.id}>
                        Aula {i + 1} - {format(parseISO(a.data), "dd/MM")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Data e Horário */}
            {aulaSelecionada && (
              <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Data da aula: {format(parseISO(aulaSelecionada.data), "EEEE, dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    O quiz será liberado nesta data no horário escolhido
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Horário</Label>
                  <Select value={horaLiberacao} onValueChange={setHoraLiberacao}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["07:00", "08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"].map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Textarea para colar perguntas */}
            <div className="space-y-2">
              <Label>Cole as perguntas no formato padrão</Label>
              <Textarea
                value={textoPerguntas}
                onChange={(e) => setTextoPerguntas(e.target.value)}
                placeholder={`Questionário: Título do Quiz

Nível: Médio | Contexto: Escola da Palavra

1. Primeira pergunta aqui?
A) Opção A
B) Opção B
C) Opção C
Resposta Certa: B

2. Segunda pergunta...`}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>

            {/* Preview do parsing */}
            {parsedQuiz && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Preview</h4>
                    {validation?.valid ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {parsedQuiz.perguntas.length} perguntas detectadas
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Erros encontrados
                      </Badge>
                    )}
                  </div>

                  {parsedQuiz.titulo && (
                    <div>
                      <p className="text-sm text-muted-foreground">Título</p>
                      <p className="font-medium">{parsedQuiz.titulo}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {parsedQuiz.nivel && <Badge variant="outline">{parsedQuiz.nivel}</Badge>}
                    {parsedQuiz.contexto && <Badge variant="secondary">{parsedQuiz.contexto}</Badge>}
                  </div>

                  {parsedQuiz.perguntas.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Perguntas</p>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {parsedQuiz.perguntas.map((p, i) => (
                          <div key={i} className="text-sm p-2 bg-muted rounded">
                            <span className="font-medium">{p.ordem}.</span> {p.pergunta.substring(0, 80)}...
                            <span className="text-green-600 ml-2">[{p.resposta_correta}]</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-sm font-medium text-primary">
                    Pontuação máxima: {parsedQuiz.perguntas.length * 10} pontos
                  </div>

                  {validation && !validation.valid && (
                    <div className="space-y-1">
                      {validation.errors.map((e, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {e}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createQuizMutation.mutate()}
            disabled={!canCreate}
          >
            {createQuizMutation.isPending ? "Criando..." : "Criar Quiz"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
