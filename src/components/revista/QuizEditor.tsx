import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Pergunta {
  ordem: number;
  pergunta: string;
  opcao_a: string;
  opcao_b: string;
  opcao_c: string;
  resposta_correta: "A" | "B" | "C";
}

interface QuizEditorProps {
  licaoId: string;
  licaoTitulo: string;
  onFechar: () => void;
}

export default function QuizEditor({ licaoId, licaoTitulo, onFechar }: QuizEditorProps) {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadQuiz();
  }, [licaoId]);

  const loadQuiz = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("revista_licao_quiz")
      .select("perguntas")
      .eq("licao_id", licaoId)
      .maybeSingle();

    if (error) {
      toast.error("Erro ao carregar quiz");
      console.error(error);
    } else if (data) {
      setPerguntas((data.perguntas as any) || []);
    }
    setLoading(false);
  };

  const updatePergunta = (idx: number, field: keyof Pergunta, value: string) => {
    setPerguntas((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("revista_licao_quiz")
      .update({ perguntas: perguntas as any })
      .eq("licao_id", licaoId);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Quiz salvo com sucesso!");
    }
    setSaving(false);
  };

  const handleRegenerate = async () => {
    if (!confirm("Isso vai substituir o quiz atual. Confirmar?")) return;
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-quiz-revista", {
        body: { licao_id: licaoId },
      });
      if (error) throw error;
      if (data?.perguntas) {
        setPerguntas(data.perguntas);
        toast.success("Quiz regenerado!");
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao regenerar quiz");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onFechar(); }}>
      <DialogContent className="max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Quiz — {licaoTitulo}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {perguntas.map((p, idx) => (
              <Card key={idx} className="border">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Pergunta {idx + 1}
                    </Label>
                    <Input
                      value={p.pergunta}
                      onChange={(e) => updatePergunta(idx, "pergunta", e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <RadioGroup
                    value={p.resposta_correta}
                    onValueChange={(v) => updatePergunta(idx, "resposta_correta", v)}
                    className="space-y-2"
                  >
                    {(["A", "B", "C"] as const).map((letra) => {
                      const campo = `opcao_${letra.toLowerCase()}` as keyof Pergunta;
                      const isCorrect = p.resposta_correta === letra;
                      return (
                        <div
                          key={letra}
                          className={`flex items-center gap-2 rounded-md border px-3 py-2 transition-colors ${
                            isCorrect ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""
                          }`}
                        >
                          <RadioGroupItem value={letra} id={`q${idx}-${letra}`} />
                          <Label htmlFor={`q${idx}-${letra}`} className="text-xs font-medium w-6">
                            {letra})
                          </Label>
                          <Input
                            value={p[campo] as string}
                            onChange={(e) => updatePergunta(idx, campo, e.target.value)}
                            className="flex-1 h-8 text-sm"
                          />
                        </div>
                      );
                    })}
                  </RadioGroup>
                </CardContent>
              </Card>
            ))}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 gap-2"
                style={{ backgroundColor: "#1B3A5C" }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar alterações
              </Button>
              <Button
                variant="secondary"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="gap-2"
              >
                {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Regenerar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
