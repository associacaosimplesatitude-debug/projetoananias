import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Trophy,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Clock,
} from "lucide-react";
import confetti from "canvas-confetti";

interface Questao {
  id: string;
  ordem: number;
  pergunta: string;
  opcao_a: string;
  opcao_b: string;
  opcao_c: string;
  opcao_d: string | null;
  resposta_correta: string;
}

export default function AlunoQuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [finalizado, setFinalizado] = useState(false);
  const [resultado, setResultado] = useState<{
    pontos: number;
    acertos: number;
    total: number;
    detalhes: Array<{ questaoId: string; correta: boolean; respostaCorreta: string }>;
  } | null>(null);

  // Buscar aluno
  const { data: aluno } = useQuery({
    queryKey: ["aluno-quiz-page", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("ebd_alunos")
        .select("id, nome_completo, turma_id, church_id, pontos_totais")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Buscar quiz
  const { data: quiz, isLoading: loadingQuiz } = useQuery({
    queryKey: ["quiz-detalhes", quizId],
    queryFn: async () => {
      if (!quizId) return null;
      const { data, error } = await supabase
        .from("ebd_quizzes")
        .select("id, titulo, descricao, pontos_max, turma_id, data_limite")
        .eq("id", quizId)
        .single();
      if (error) throw error;

      // Buscar campos extras
      const { data: extra } = await supabase
        .from("ebd_quizzes")
        .select("contexto, nivel, hora_liberacao")
        .eq("id", quizId)
        .single();

      return { ...data, ...(extra as any) };
    },
    enabled: !!quizId,
  });

  // Buscar questões
  const { data: questoes, isLoading: loadingQuestoes } = useQuery({
    queryKey: ["quiz-questoes", quizId],
    queryFn: async () => {
      if (!quizId) return [];
      const { data, error } = await supabase
        .from("ebd_quiz_questoes")
        .select("*")
        .eq("quiz_id", quizId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as Questao[];
    },
    enabled: !!quizId,
  });

  // Verificar se já respondeu e buscar respostas salvas
  const { data: jaRespondeu } = useQuery({
    queryKey: ["quiz-ja-respondeu", quizId, aluno?.id],
    queryFn: async () => {
      if (!quizId || !aluno?.id) return null;
      const { data, error } = await supabase
        .from("ebd_quiz_respostas")
        .select("id, pontos_obtidos, completado, respostas")
        .eq("quiz_id", quizId)
        .eq("aluno_id", aluno.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!quizId && !!aluno?.id,
  });

  const questaoAtual = questoes?.[currentIndex];
  const totalQuestoes = questoes?.length || 0;
  const progresso = totalQuestoes > 0 ? ((currentIndex + 1) / totalQuestoes) * 100 : 0;

  // Mutation para salvar resposta
  const finalizarMutation = useMutation({
    mutationFn: async () => {
      if (!quiz || !aluno || !questoes) throw new Error("Dados incompletos");

      // Calcular resultado
      let acertos = 0;
      const detalhes: Array<{ questaoId: string; correta: boolean; respostaCorreta: string }> = [];

      questoes.forEach((q) => {
        const respostaAluno = respostas[q.id];
        const correta = respostaAluno === q.resposta_correta;
        if (correta) acertos++;
        detalhes.push({
          questaoId: q.id,
          correta,
          respostaCorreta: q.resposta_correta,
        });
      });

      const pontos = acertos * 10;

      // Salvar resposta
      const { error: respostaError } = await supabase
        .from("ebd_quiz_respostas")
        .insert([{
          quiz_id: quiz.id,
          aluno_id: aluno.id,
          respostas: respostas,
          pontos_obtidos: pontos,
          completado: true,
        }]);

      if (respostaError) throw respostaError;

      // Buscar pontos ATUAIS do banco antes de somar (evita cache desatualizado)
      const { data: alunoAtual, error: fetchError } = await supabase
        .from("ebd_alunos")
        .select("pontos_totais")
        .eq("id", aluno.id)
        .single();

      if (fetchError) throw fetchError;

      const pontosAtuais = alunoAtual?.pontos_totais || 0;
      const novosPontos = pontosAtuais + pontos;

      // Atualizar pontos do aluno
      const { error: updateError } = await supabase
        .from("ebd_alunos")
        .update({ pontos_totais: novosPontos })
        .eq("id", aluno.id);

      if (updateError) throw updateError;

      return { pontos, acertos, total: questoes.length, detalhes };
    },
    onSuccess: (data) => {
      setResultado(data);
      setFinalizado(true);
      // Invalidar todas as queries relacionadas ao aluno para atualizar pontos no dashboard
      queryClient.invalidateQueries({ queryKey: ["aluno-area"] });
      queryClient.invalidateQueries({ queryKey: ["aluno-layout"] });
      queryClient.invalidateQueries({ queryKey: ["aluno-rank"] });
      queryClient.invalidateQueries({ queryKey: ["quizzes-pendentes"] });
      // Confetti se acertou mais de 70%
      if (data.acertos / data.total >= 0.7) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    },
    onError: (error) => {
      console.error("Erro ao finalizar quiz:", error);
      toast.error("Erro ao salvar respostas");
    },
  });

  const handleSelectResposta = (opcao: string) => {
    if (!questaoAtual) return;
    setRespostas((prev) => ({ ...prev, [questaoAtual.id]: opcao }));
  };

  const handleProxima = () => {
    if (currentIndex < totalQuestoes - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleAnterior = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleFinalizar = () => {
    // Verificar se todas as questões foram respondidas
    const todasRespondidas = questoes?.every((q) => respostas[q.id]);
    if (!todasRespondidas) {
      toast.error("Responda todas as questões antes de finalizar");
      return;
    }
    finalizarMutation.mutate();
  };

  const isLoading = loadingQuiz || loadingQuestoes;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Já respondeu - mostrar resultado detalhado
  if (jaRespondeu?.completado && questoes) {
    const respostasSalvas = (jaRespondeu.respostas || {}) as Record<string, string>;
    
    // Calcular acertos a partir das respostas salvas
    let acertos = 0;
    questoes.forEach((q) => {
      if (respostasSalvas[q.id] === q.resposta_correta) acertos++;
    });
    const percentual = Math.round((acertos / questoes.length) * 100);

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/ebd/aluno")} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Badge variant="secondary">Resultado do Quiz</Badge>
        </div>

        <Card className="text-center border-2 border-primary">
          <CardContent className="py-8">
            <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-2">{quiz?.titulo}</h2>

            <div className="my-6">
              <div className="text-5xl font-bold text-primary mb-2">
                {jaRespondeu.pontos_obtidos} pontos
              </div>
              <p className="text-lg text-muted-foreground">
                {acertos} de {questoes.length} acertos ({percentual}%)
              </p>
            </div>

            <Badge
              variant={percentual >= 70 ? "default" : percentual >= 50 ? "secondary" : "destructive"}
              className="text-lg px-4 py-1"
            >
              {percentual >= 70 ? "Excelente!" : percentual >= 50 ? "Bom trabalho!" : "Continue estudando!"}
            </Badge>
          </CardContent>
        </Card>

        {/* Detalhes das respostas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resultado detalhado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {questoes.map((q, i) => {
              const respostaAluno = respostasSalvas[q.id];
              const correta = respostaAluno === q.resposta_correta;

              return (
                <div
                  key={q.id}
                  className={`p-3 rounded-lg border ${
                    correta ? "bg-green-50 border-green-200 dark:bg-green-950/20" : "bg-red-50 border-red-200 dark:bg-red-950/20"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {correta ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {i + 1}. {q.pergunta}
                      </p>
                      {!correta && (
                        <p className="text-xs mt-1 text-muted-foreground">
                          Sua resposta: {respostaAluno || "—"} | Correta: {q.resposta_correta}
                        </p>
                      )}
                    </div>
                    <Badge variant={correta ? "default" : "destructive"} className="text-xs">
                      {correta ? "+10" : "0"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="text-center">
          <Button onClick={() => navigate("/ebd/aluno")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Tela de resultado
  if (finalizado && resultado) {
    const percentual = Math.round((resultado.acertos / resultado.total) * 100);

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="text-center border-2 border-primary">
          <CardContent className="py-8">
            <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-2">Quiz Finalizado!</h2>

            <div className="my-6">
              <div className="text-5xl font-bold text-primary mb-2">
                {resultado.pontos} pontos
              </div>
              <p className="text-lg text-muted-foreground">
                {resultado.acertos} de {resultado.total} acertos ({percentual}%)
              </p>
            </div>

            <Badge
              variant={percentual >= 70 ? "default" : percentual >= 50 ? "secondary" : "destructive"}
              className="text-lg px-4 py-1"
            >
              {percentual >= 70 ? "Excelente!" : percentual >= 50 ? "Bom trabalho!" : "Continue estudando!"}
            </Badge>
          </CardContent>
        </Card>

        {/* Detalhes das respostas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resultado detalhado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {questoes?.map((q, i) => {
              const detalhe = resultado.detalhes.find((d) => d.questaoId === q.id);
              const respostaAluno = respostas[q.id];

              return (
                <div
                  key={q.id}
                  className={`p-3 rounded-lg border ${
                    detalhe?.correta ? "bg-green-50 border-green-200 dark:bg-green-950/20" : "bg-red-50 border-red-200 dark:bg-red-950/20"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {detalhe?.correta ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {i + 1}. {q.pergunta}
                      </p>
                      {!detalhe?.correta && (
                        <p className="text-xs mt-1 text-muted-foreground">
                          Sua resposta: {respostaAluno} | Correta: {detalhe?.respostaCorreta}
                        </p>
                      )}
                    </div>
                    <Badge variant={detalhe?.correta ? "default" : "destructive"} className="text-xs">
                      {detalhe?.correta ? "+10" : "0"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            +{resultado.pontos} pontos adicionados ao seu perfil!
          </p>
          <Button onClick={() => navigate("/ebd/aluno")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Tela do quiz
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/ebd/aluno")} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Sair
        </Button>
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="font-medium">{quiz?.pontos_max || 0} pts máx</span>
        </div>
      </div>

      {/* Info do Quiz */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{quiz?.titulo}</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {quiz?.nivel && <Badge variant="outline">{quiz.nivel}</Badge>}
            {quiz?.contexto && <span>{quiz.contexto}</span>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progresso</span>
              <span className="font-medium">
                {currentIndex + 1} de {totalQuestoes}
              </span>
            </div>
            <Progress value={progresso} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Questão Atual */}
      {questaoAtual && (
        <Card className="border-2">
          <CardContent className="pt-6 space-y-6">
            <div>
              <Badge variant="secondary" className="mb-3">
                Questão {currentIndex + 1}
              </Badge>
              <p className="text-lg font-medium">{questaoAtual.pergunta}</p>
            </div>

            <RadioGroup
              value={respostas[questaoAtual.id] || ""}
              onValueChange={handleSelectResposta}
              className="space-y-3"
            >
              {[
                { key: "A", value: questaoAtual.opcao_a },
                { key: "B", value: questaoAtual.opcao_b },
                { key: "C", value: questaoAtual.opcao_c },
                ...(questaoAtual.opcao_d ? [{ key: "D", value: questaoAtual.opcao_d }] : []),
              ].map((opcao) => (
                <div
                  key={opcao.key}
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                    respostas[questaoAtual.id] === opcao.key
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50"
                  }`}
                  onClick={() => handleSelectResposta(opcao.key)}
                >
                  <RadioGroupItem value={opcao.key} id={`opcao-${opcao.key}`} />
                  <Label htmlFor={`opcao-${opcao.key}`} className="flex-1 cursor-pointer">
                    <span className="font-medium mr-2">{opcao.key})</span>
                    {opcao.value}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Navegação */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleAnterior}
          disabled={currentIndex === 0}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Anterior
        </Button>

        {currentIndex === totalQuestoes - 1 ? (
          <Button
            onClick={handleFinalizar}
            disabled={finalizarMutation.isPending}
            className="gap-1"
          >
            {finalizarMutation.isPending ? "Finalizando..." : "Finalizar Quiz"}
            <CheckCircle className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleProxima} className="gap-1">
            Próxima
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Indicadores de questões */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {questoes?.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setCurrentIndex(i)}
            className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              i === currentIndex
                ? "bg-primary text-primary-foreground"
                : respostas[q.id]
                ? "bg-green-100 text-green-700 dark:bg-green-900/30"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
