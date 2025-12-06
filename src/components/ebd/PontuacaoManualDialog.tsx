import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Star, Plus, Minus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Aluno {
  id: string;
  nome_completo: string;
  pontos_totais: number;
}

interface PontuacaoManualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alunos: Aluno[];
  turmaId: string;
  churchId: string;
}

const MOTIVOS_PREDEFINIDOS = [
  { label: "Participação em Aula", pontos: 20 },
  { label: "Resposta Correta", pontos: 10 },
  { label: "Ajuda ao Colega", pontos: 15 },
  { label: "Leitura em Voz Alta", pontos: 10 },
  { label: "Comportamento Exemplar", pontos: 25 },
  { label: "Outro", pontos: 0 },
];

export function PontuacaoManualDialog({
  open,
  onOpenChange,
  alunos,
  turmaId,
  churchId,
}: PontuacaoManualDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAluno, setSelectedAluno] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("Participação em Aula");
  const [pontos, setPontos] = useState<number>(20);
  const [motivoCustom, setMotivoCustom] = useState<string>("");

  const adicionarPontos = useMutation({
    mutationFn: async () => {
      const motivoFinal = motivo === "Outro" ? motivoCustom : motivo;
      
      if (!selectedAluno || !motivoFinal || pontos <= 0) {
        throw new Error("Preencha todos os campos");
      }

      const { error } = await supabase.from("ebd_pontuacao_manual").insert({
        aluno_id: selectedAluno,
        turma_id: turmaId,
        church_id: churchId,
        pontos,
        motivo: motivoFinal,
        registrado_por: user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["turma-alunos"] });
      toast.success(`+${pontos} pontos adicionados!`);
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao adicionar pontos");
    },
  });

  const resetForm = () => {
    setSelectedAluno("");
    setMotivo("Participação em Aula");
    setPontos(20);
    setMotivoCustom("");
  };

  const handleMotivoChange = (value: string) => {
    setMotivo(value);
    const motivoPredefinido = MOTIVOS_PREDEFINIDOS.find((m) => m.label === value);
    if (motivoPredefinido && motivoPredefinido.pontos > 0) {
      setPontos(motivoPredefinido.pontos);
    }
  };

  const selectedAlunoData = alunos.find((a) => a.id === selectedAluno);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Lançar Pontuação Manual
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seleção de Aluno */}
          <div className="space-y-2">
            <Label>Aluno</Label>
            <Select value={selectedAluno} onValueChange={setSelectedAluno}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o aluno" />
              </SelectTrigger>
              <SelectContent>
                {alunos.map((aluno) => (
                  <SelectItem key={aluno.id} value={aluno.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{aluno.nome_completo}</span>
                      <span className="text-muted-foreground text-xs ml-2">
                        {aluno.pontos_totais} pts
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select value={motivo} onValueChange={handleMotivoChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_PREDEFINIDOS.map((m) => (
                  <SelectItem key={m.label} value={m.label}>
                    {m.label} {m.pontos > 0 && `(+${m.pontos})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {motivo === "Outro" && (
              <Input
                placeholder="Descreva o motivo"
                value={motivoCustom}
                onChange={(e) => setMotivoCustom(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Pontos */}
          <div className="space-y-2">
            <Label>Pontos</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPontos(Math.max(1, pontos - 5))}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                value={pontos}
                onChange={(e) => setPontos(Math.max(1, parseInt(e.target.value) || 0))}
                className="text-center w-24"
                min={1}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPontos(pontos + 5)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Preview */}
          {selectedAlunoData && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Prévia:</p>
              <p className="font-medium">
                {selectedAlunoData.nome_completo} receberá{" "}
                <span className="text-green-600">+{pontos} pontos</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Novo total: {selectedAlunoData.pontos_totais + pontos} pontos
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => adicionarPontos.mutate()}
              disabled={
                !selectedAluno ||
                pontos <= 0 ||
                (motivo === "Outro" && !motivoCustom) ||
                adicionarPontos.isPending
              }
            >
              <Star className="w-4 h-4 mr-1" />
              Adicionar Pontos
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
