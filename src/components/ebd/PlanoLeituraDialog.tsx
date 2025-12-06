import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CheckCircle2, Circle } from "lucide-react";
import { Json } from "@/integrations/supabase/types";

interface PlanoLeituraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revistaId: string;
  revistaTitulo: string;
}

interface Licao {
  id: string;
  numero_licao: number | null;
  titulo: string;
  plano_leitura_semanal: string[] | null;
}

const DIAS_SEMANA = [
  "Dia 1 (Domingo)",
  "Dia 2 (Segunda)",
  "Dia 3 (Terça)",
  "Dia 4 (Quarta)",
  "Dia 5 (Quinta)",
  "Dia 6 (Sexta)",
  "Dia 7 (Sábado)",
];

export function PlanoLeituraDialog({
  open,
  onOpenChange,
  revistaId,
  revistaTitulo,
}: PlanoLeituraDialogProps) {
  const queryClient = useQueryClient();
  const [selectedLicao, setSelectedLicao] = useState<string | null>(null);
  const [planoLeitura, setPlanoLeitura] = useState<Record<string, string[]>>({});

  const { data: licoes, isLoading } = useQuery({
    queryKey: ["ebd-licoes-plano", revistaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_licoes")
        .select("id, numero_licao, titulo, plano_leitura_semanal")
        .eq("revista_id", revistaId)
        .order("numero_licao");

      if (error) throw error;
      return data as Licao[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (licoes) {
      const planos: Record<string, string[]> = {};
      licoes.forEach((licao) => {
        if (licao.plano_leitura_semanal && Array.isArray(licao.plano_leitura_semanal)) {
          planos[licao.id] = licao.plano_leitura_semanal;
        } else {
          planos[licao.id] = Array(7).fill("");
        }
      });
      setPlanoLeitura(planos);

      if (!selectedLicao && licoes.length > 0) {
        setSelectedLicao(licoes[0].id);
      }
    }
  }, [licoes, selectedLicao]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(planoLeitura).map(([licaoId, plano]) => ({
        id: licaoId,
        plano_leitura_semanal: plano as unknown as Json,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("ebd_licoes")
          .update({ plano_leitura_semanal: update.plano_leitura_semanal })
          .eq("id", update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ebd-licoes-plano"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-revistas"] });
      toast.success("Plano de leitura salvo com sucesso!");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erro ao salvar plano de leitura");
      console.error(error);
    },
  });

  const handlePlanoChange = (licaoId: string, diaIndex: number, value: string) => {
    setPlanoLeitura((prev) => {
      const newPlano = { ...prev };
      if (!newPlano[licaoId]) {
        newPlano[licaoId] = Array(7).fill("");
      }
      newPlano[licaoId] = [...newPlano[licaoId]];
      newPlano[licaoId][diaIndex] = value;
      return newPlano;
    });
  };

  const isLicaoCompleta = (licaoId: string) => {
    const plano = planoLeitura[licaoId];
    return plano && plano.every((dia) => dia.trim() !== "");
  };

  const totalCompletas = licoes?.filter((l) => isLicaoCompleta(l.id)).length || 0;
  const totalLicoes = licoes?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Plano de Leitura Semanal
          </DialogTitle>
          <DialogDescription>{revistaTitulo}</DialogDescription>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={totalCompletas === totalLicoes ? "default" : "secondary"}>
              {totalCompletas}/{totalLicoes} lições completas
            </Badge>
            {totalCompletas === totalLicoes && totalLicoes > 0 && (
              <Badge className="bg-green-600">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Plano Completo
              </Badge>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !licoes || licoes.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12 text-muted-foreground">
            Nenhuma lição encontrada para esta revista.
          </div>
        ) : (
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Lista de Lições */}
            <ScrollArea className="w-64 border rounded-md">
              <div className="p-2 space-y-1">
                {licoes.map((licao) => (
                  <button
                    key={licao.id}
                    onClick={() => setSelectedLicao(licao.id)}
                    className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-colors ${
                      selectedLicao === licao.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    {isLicaoCompleta(licao.id) ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">
                      Lição {licao.numero_licao}: {licao.titulo}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>

            {/* Formulário do Plano */}
            <div className="flex-1 border rounded-md p-4 overflow-y-auto">
              {selectedLicao && (
                <div className="space-y-4">
                  <h3 className="font-medium text-lg">
                    Lição {licoes.find((l) => l.id === selectedLicao)?.numero_licao}:{" "}
                    {licoes.find((l) => l.id === selectedLicao)?.titulo}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Preencha os 7 dias de leitura para esta lição:
                  </p>

                  <div className="space-y-3">
                    {DIAS_SEMANA.map((dia, index) => (
                      <div key={index} className="space-y-1">
                        <Label htmlFor={`dia-${index}`} className="text-sm">
                          {dia}
                        </Label>
                        <Input
                          id={`dia-${index}`}
                          value={planoLeitura[selectedLicao]?.[index] || ""}
                          onChange={(e) =>
                            handlePlanoChange(selectedLicao, index, e.target.value)
                          }
                          placeholder="Ex: Gênesis 1:1-31 ou Leia as páginas 5-10"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : "Salvar Plano de Leitura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
