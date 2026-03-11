import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Trophy } from "lucide-react";
import { toast } from "sonner";

interface Pergunta {
  ordem: number;
  pergunta: string;
  opcao_a: string;
  opcao_b: string;
  opcao_c: string;
  resposta_correta: string;
}

interface RevistaQuizProps {
  licaoId: string;
  onClose: () => void;
}

export default function RevistaQuiz({ licaoId, onClose }: RevistaQuizProps) {
  const { user } = useAuth();
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [result, setResult] = useState<{ acertos: number; pontos: number } | null>(null);

  const { data: quiz } = useQuery({
    queryKey: ["revista-quiz", licaoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("revista_licao_quiz")
        .select("*")
        .eq("licao_id", licaoId)
        .maybeSingle();
      return data;
    },
  });

  const { data: previousAnswer } = useQuery({
    queryKey: ["revista-quiz-resposta", quiz?.id, user?.id],
    queryFn: async () => {
      if (!quiz?.id || !user?.id) return null;
      const { data } = await supabase
        .from("revista_licao_quiz_respostas")
        .select("*")
        .eq("quiz_id", quiz.id)
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!quiz?.id && !!user?.id,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!quiz || !user) throw new Error("Quiz ou usuário não encontrado");
      const perguntas = quiz.perguntas as unknown as Pergunta[];
      let acertos = 0;
      perguntas.forEach((p) => {
        if (respostas[p.ordem] === p.resposta_correta) acertos++;
      });
      const pontos = acertos * 10;

      const { error } = await supabase
        .from("revista_licao_quiz_respostas")
        .insert({
          quiz_id: quiz.id,
          user_id: user.id,
          respostas,
          acertos,
          pontos_ganhos: pontos,
        });
      if (error) throw error;

      // Update student points
      const { data: aluno } = await supabase
        .from("ebd_alunos")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (aluno && pontos > 0) {
        await supabase.rpc("adicionar_pontos_aluno", {
          p_aluno_id: aluno.id,
          p_pontos: pontos,
          p_motivo: "Quiz Revista Virtual",
        });
      }

      return { acertos, pontos };
    },
    onSuccess: (data) => {
      setResult(data);
      setSubmitted(true);
      toast.success(`Você acertou ${data.acertos} de 5! +${data.pontos} pontos`);
    },
    onError: (e: any) => {
      if (e.message?.includes("duplicate") || e.code === "23505") {
        toast.error("Você já respondeu este quiz.");
      } else {
        toast.error(e.message);
      }
    },
  });

  if (!quiz) return null;

  const perguntas = quiz.perguntas as unknown as Pergunta[];
  const alreadyAnswered = !!previousAnswer;
  const displayResult = alreadyAnswered ? previousAnswer : result ? { acertos: result.acertos, pontos_ganhos: result.pontos, respostas: respostas } : null;

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {displayResult ? (
        <div className="space-y-4">
          <div className="text-center space-y-3 py-4">
            <Trophy className="h-12 w-12 mx-auto text-orange-500" />
            <h3 className="text-xl font-bold">Resultado do Quiz</h3>
            <div className="flex items-center justify-center gap-4">
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-primary">{displayResult.acertos}/5</p>
                <p className="text-xs text-muted-foreground">Acertos</p>
              </div>
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-orange-500">+{displayResult.pontos_ganhos}</p>
                <p className="text-xs text-muted-foreground">Pontos</p>
              </div>
            </div>
            {alreadyAnswered && (
              <p className="text-sm text-muted-foreground">Você já respondeu este quiz anteriormente.</p>
            )}
          </div>

          {showErrors && (
            <div className="space-y-4">
              {perguntas.map((p) => {
                const userAnswer = (displayResult as any).respostas?.[p.ordem];
                const isCorrect = userAnswer === p.resposta_correta;
                return (
                  <div key={p.ordem} className={`p-3 rounded-lg border ${isCorrect ? "border-green-300 bg-green-50 dark:bg-green-950/20" : "border-red-300 bg-red-50 dark:bg-red-950/20"}`}>
                    <div className="flex items-start gap-2">
                      {isCorrect ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />}
                      <div>
                        <p className="font-medium text-sm">{p.ordem}. {p.pergunta}</p>
                        {!isCorrect && (
                          <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                            Resposta correta: {p.resposta_correta}) {p[`opcao_${p.resposta_correta.toLowerCase()}` as keyof Pergunta]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowErrors(!showErrors)} className="flex-1">
              {showErrors ? "Ocultar erros" : "Ver erros"}
            </Button>
            <Button onClick={onClose} className="flex-1">Fechar</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-center">Quiz da Lição</h3>
          <p className="text-sm text-muted-foreground text-center">Cada pergunta correta vale 10 pontos</p>
          
          {perguntas.map((p) => (
            <div key={p.ordem} className="space-y-2 p-4 rounded-lg bg-muted/50">
              <p className="font-medium text-sm">{p.ordem}. {p.pergunta}</p>
              <RadioGroup
                value={respostas[p.ordem] || ""}
                onValueChange={(v) => setRespostas(prev => ({ ...prev, [p.ordem]: v }))}
              >
                {(["A", "B", "C"] as const).map((letter) => (
                  <div key={letter} className="flex items-center space-x-2">
                    <RadioGroupItem value={letter} id={`q${p.ordem}-${letter}`} />
                    <Label htmlFor={`q${p.ordem}-${letter}`} className="text-sm cursor-pointer">
                      {letter}) {p[`opcao_${letter.toLowerCase()}` as keyof Pergunta]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ))}

          <Button
            onClick={() => submitMutation.mutate()}
            disabled={Object.keys(respostas).length < 5 || submitMutation.isPending}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            {submitMutation.isPending ? "Enviando..." : "Enviar Respostas"}
          </Button>
        </div>
      )}
    </div>
  );
}
