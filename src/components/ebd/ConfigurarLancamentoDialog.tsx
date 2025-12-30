import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

type ResponsavelChamada = "Professor" | "Aluno";

interface Turma {
  id: string;
  nome: string;
  faixa_etaria: string;
  responsavel_chamada: string;
  permite_lancamento_ofertas: boolean;
  permite_lancamento_revistas: boolean;
  permite_lancamento_biblias: boolean;
}

interface ConfigurarLancamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
}

export function ConfigurarLancamentoDialog({
  open,
  onOpenChange,
  churchId,
}: ConfigurarLancamentoDialogProps) {
  const queryClient = useQueryClient();
  const [turmaId, setTurmaId] = useState<string>("");
  const [responsavelChamada, setResponsavelChamada] = useState<ResponsavelChamada>("Professor");
  const [permiteRevistas, setPermiteRevistas] = useState(true);
  const [permiteBiblias, setPermiteBiblias] = useState(true);
  const [permiteOfertas, setPermiteOfertas] = useState(true);

  const { data: turmas, isLoading: loadingTurmas } = useQuery({
    queryKey: ["ebd-turmas-config-lancamento", churchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_turmas")
        .select(
          "id, nome, faixa_etaria, responsavel_chamada, permite_lancamento_ofertas, permite_lancamento_revistas, permite_lancamento_biblias"
        )
        .eq("church_id", churchId)
        .eq("is_active", true)
        .order("nome");

      if (error) throw error;
      return (data || []) as Turma[];
    },
    enabled: open && !!churchId,
  });

  const turmaSelecionada = useMemo(() => {
    if (!turmas || !turmaId) return null;
    return turmas.find((t) => t.id === turmaId) || null;
  }, [turmas, turmaId]);

  // Ao escolher turma, carregar configurações atuais
  useEffect(() => {
    if (!turmaSelecionada) return;
    setResponsavelChamada((turmaSelecionada.responsavel_chamada as ResponsavelChamada) || "Professor");
    setPermiteRevistas(turmaSelecionada.permite_lancamento_revistas ?? true);
    setPermiteBiblias(turmaSelecionada.permite_lancamento_biblias ?? true);
    setPermiteOfertas(turmaSelecionada.permite_lancamento_ofertas ?? true);
  }, [turmaSelecionada]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!turmaId) throw new Error("Selecione uma turma");

      const { error } = await supabase
        .from("ebd_turmas")
        .update({
          responsavel_chamada: responsavelChamada,
          permite_lancamento_revistas: permiteRevistas,
          permite_lancamento_biblias: permiteBiblias,
          permite_lancamento_ofertas: permiteOfertas,
        })
        .eq("id", turmaId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações de lançamento salvas!");
      queryClient.invalidateQueries({ queryKey: ["ebd-turmas"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-turmas-config-lancamento", churchId] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err?.message || "Erro ao salvar configurações");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurar Lançamento</DialogTitle>
          <DialogDescription>
            Defina quem fará a chamada e quais dados serão lançados na turma.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Turma *</Label>
            <Select value={turmaId} onValueChange={setTurmaId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingTurmas ? "Carregando..." : "Selecione a turma"} />
              </SelectTrigger>
              <SelectContent className="bg-background z-[100]" position="popper">
                {turmas?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome} - {t.faixa_etaria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Responsável pela chamada</Label>
              <p className="text-xs text-muted-foreground">
                {responsavelChamada === "Aluno"
                  ? "O professor gerará um PIN para o aluno registrar a presença automaticamente."
                  : "Professor/secretário fará a chamada manualmente."}
              </p>
            </div>

            <Select
              value={responsavelChamada}
              onValueChange={(v) => setResponsavelChamada(v as ResponsavelChamada)}
              disabled={!turmaId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="bg-background z-[100]">
                <SelectItem value="Professor">Professor/Secretário (Manual)</SelectItem>
                <SelectItem value="Aluno">Aluno (Automático)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <Label className="text-sm font-medium">Dados para lançar (na aula)</Label>

            <div className="flex items-start gap-3">
              <Checkbox
                checked={permiteRevistas}
                onCheckedChange={(c) => setPermiteRevistas(Boolean(c))}
                disabled={!turmaId}
              />
              <div className="space-y-0.5">
                <p className="text-sm">Contar Revistas</p>
                <p className="text-xs text-muted-foreground">Registrar quantos alunos trouxeram revista.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                checked={permiteBiblias}
                onCheckedChange={(c) => setPermiteBiblias(Boolean(c))}
                disabled={!turmaId}
              />
              <div className="space-y-0.5">
                <p className="text-sm">Contar Bíblias</p>
                <p className="text-xs text-muted-foreground">Registrar quantos alunos trouxeram Bíblia.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                checked={permiteOfertas}
                onCheckedChange={(c) => setPermiteOfertas(Boolean(c))}
                disabled={!turmaId}
              />
              <div className="space-y-0.5">
                <p className="text-sm">Lançar Ofertas</p>
                <p className="text-xs text-muted-foreground">Registrar valor das ofertas da aula.</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !turmaId}>
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
