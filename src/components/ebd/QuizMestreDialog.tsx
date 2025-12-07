import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Loader2, CheckCircle2 } from "lucide-react";

interface QuizMestreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licaoId: string;
  licaoTitulo: string;
  licaoNumero: number | null;
}

interface Questao {
  id?: string;
  ordem: number;
  pergunta: string;
  opcao_a: string;
  opcao_b: string;
  opcao_c: string;
  resposta_correta: 'A' | 'B' | 'C';
}

const emptyQuestao = (ordem: number): Questao => ({
  ordem,
  pergunta: '',
  opcao_a: '',
  opcao_b: '',
  opcao_c: '',
  resposta_correta: 'A'
});

export function QuizMestreDialog({
  open,
  onOpenChange,
  licaoId,
  licaoTitulo,
  licaoNumero
}: QuizMestreDialogProps) {
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const queryClient = useQueryClient();

  // Buscar questões existentes
  const { data: existingQuestoes, isLoading } = useQuery({
    queryKey: ['quiz-mestre-questoes', licaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_quiz_mestre_questoes')
        .select('*')
        .eq('licao_id', licaoId)
        .order('ordem');

      if (error) throw error;
      return data;
    },
    enabled: open && !!licaoId
  });

  // Inicializar questões quando dados carregarem
  useEffect(() => {
    if (existingQuestoes) {
      // Mapear questões existentes e preencher as faltantes
      const mappedQuestoes: Questao[] = [];
      for (let i = 1; i <= 10; i++) {
        const existing = existingQuestoes.find(q => q.ordem === i);
        if (existing) {
          mappedQuestoes.push({
            id: existing.id,
            ordem: existing.ordem,
            pergunta: existing.pergunta,
            opcao_a: existing.opcao_a,
            opcao_b: existing.opcao_b,
            opcao_c: existing.opcao_c,
            resposta_correta: existing.resposta_correta as 'A' | 'B' | 'C'
          });
        } else {
          mappedQuestoes.push(emptyQuestao(i));
        }
      }
      setQuestoes(mappedQuestoes);
    } else if (open) {
      // Criar array de questões vazias
      setQuestoes(Array.from({ length: 10 }, (_, i) => emptyQuestao(i + 1)));
    }
  }, [existingQuestoes, open]);

  // Mutation para salvar
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validar questões
      const questoesCompletas = questoes.filter(q => 
        q.pergunta.trim() && 
        q.opcao_a.trim() && 
        q.opcao_b.trim() && 
        q.opcao_c.trim()
      );

      if (questoesCompletas.length === 0) {
        throw new Error('Cadastre pelo menos uma pergunta completa');
      }

      // Para cada questão completa, fazer upsert
      for (const questao of questoesCompletas) {
        if (questao.id) {
          // Update
          const { error } = await supabase
            .from('ebd_quiz_mestre_questoes')
            .update({
              pergunta: questao.pergunta.trim(),
              opcao_a: questao.opcao_a.trim(),
              opcao_b: questao.opcao_b.trim(),
              opcao_c: questao.opcao_c.trim(),
              resposta_correta: questao.resposta_correta
            })
            .eq('id', questao.id);

          if (error) throw error;
        } else {
          // Insert
          const { error } = await supabase
            .from('ebd_quiz_mestre_questoes')
            .insert({
              licao_id: licaoId,
              ordem: questao.ordem,
              pergunta: questao.pergunta.trim(),
              opcao_a: questao.opcao_a.trim(),
              opcao_b: questao.opcao_b.trim(),
              opcao_c: questao.opcao_c.trim(),
              resposta_correta: questao.resposta_correta
            });

          if (error) throw error;
        }
      }

      // Deletar questões que foram apagadas (estavam salvas mas agora estão vazias)
      const questoesParaDeletar = questoes.filter(q => 
        q.id && 
        (!q.pergunta.trim() || !q.opcao_a.trim() || !q.opcao_b.trim() || !q.opcao_c.trim())
      );

      for (const questao of questoesParaDeletar) {
        if (questao.id) {
          const { error } = await supabase
            .from('ebd_quiz_mestre_questoes')
            .delete()
            .eq('id', questao.id);

          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-mestre-questoes'] });
      queryClient.invalidateQueries({ queryKey: ['ebd-revistas'] });
      queryClient.invalidateQueries({ queryKey: ['ebd-licoes-revista'] });
      toast.success('Quiz salvo com sucesso!');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao salvar quiz');
    }
  });

  const updateQuestao = (ordem: number, field: keyof Questao, value: string) => {
    setQuestoes(prev => prev.map(q => 
      q.ordem === ordem ? { ...q, [field]: value } : q
    ));
  };

  const questoesCompletas = questoes.filter(q => 
    q.pergunta.trim() && 
    q.opcao_a.trim() && 
    q.opcao_b.trim() && 
    q.opcao_c.trim()
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Quiz Mestre - Lição {licaoNumero}</span>
            <Badge variant={questoesCompletas === 10 ? "default" : "secondary"}>
              {questoesCompletas}/10 perguntas
            </Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{licaoTitulo}</p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6">
              {questoes.map((questao) => {
                const isComplete = questao.pergunta.trim() && 
                  questao.opcao_a.trim() && 
                  questao.opcao_b.trim() && 
                  questao.opcao_c.trim();

                return (
                  <Card key={questao.ordem} className={isComplete ? "border-green-500/50" : ""}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                          {questao.ordem}
                        </span>
                        Pergunta {questao.ordem}
                        {isComplete && (
                          <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor={`pergunta-${questao.ordem}`}>Pergunta</Label>
                        <Textarea
                          id={`pergunta-${questao.ordem}`}
                          placeholder="Digite a pergunta..."
                          value={questao.pergunta}
                          onChange={(e) => updateQuestao(questao.ordem, 'pergunta', e.target.value)}
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor={`opcao-a-${questao.ordem}`}>Opção A</Label>
                          <Input
                            id={`opcao-a-${questao.ordem}`}
                            placeholder="Opção A"
                            value={questao.opcao_a}
                            onChange={(e) => updateQuestao(questao.ordem, 'opcao_a', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`opcao-b-${questao.ordem}`}>Opção B</Label>
                          <Input
                            id={`opcao-b-${questao.ordem}`}
                            placeholder="Opção B"
                            value={questao.opcao_b}
                            onChange={(e) => updateQuestao(questao.ordem, 'opcao_b', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`opcao-c-${questao.ordem}`}>Opção C</Label>
                          <Input
                            id={`opcao-c-${questao.ordem}`}
                            placeholder="Opção C"
                            value={questao.opcao_c}
                            onChange={(e) => updateQuestao(questao.ordem, 'opcao_c', e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Resposta Correta</Label>
                        <RadioGroup
                          value={questao.resposta_correta}
                          onValueChange={(value) => updateQuestao(questao.ordem, 'resposta_correta', value)}
                          className="flex gap-6 mt-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="A" id={`resp-a-${questao.ordem}`} />
                            <Label htmlFor={`resp-a-${questao.ordem}`} className="cursor-pointer">A</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="B" id={`resp-b-${questao.ordem}`} />
                            <Label htmlFor={`resp-b-${questao.ordem}`} className="cursor-pointer">B</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="C" id={`resp-c-${questao.ordem}`} />
                            <Label htmlFor={`resp-c-${questao.ordem}`} className="cursor-pointer">C</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {questoesCompletas === 10 
              ? "✓ Todas as 10 perguntas estão completas!" 
              : `Faltam ${10 - questoesCompletas} perguntas para completar o quiz`
            }
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || questoesCompletas === 0}
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar Quiz
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
