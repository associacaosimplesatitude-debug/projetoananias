import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar, BookMarked, CheckCircle2, Circle } from "lucide-react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface AlunoLeiturasProps {
  alunoId: string;
  churchId: string;
}

const DIAS_SEMANA = [
  { dia: 0, nome: "Dom" },
  { dia: 1, nome: "Seg" },
  { dia: 2, nome: "Ter" },
  { dia: 3, nome: "Qua" },
  { dia: 4, nome: "Qui" },
  { dia: 5, nome: "Sex" },
  { dia: 6, nome: "Sáb" },
];

export function AlunoLeituras({ alunoId, churchId }: AlunoLeiturasProps) {
  const queryClient = useQueryClient();
  const hoje = new Date();
  const inicioSemana = startOfWeek(hoje, { weekStartsOn: 0 });

  const { data: leituras, isLoading } = useQuery({
    queryKey: ["aluno-leituras", alunoId, format(inicioSemana, "yyyy-MM-dd")],
    queryFn: async () => {
      const fimSemana = addDays(inicioSemana, 6);

      const { data, error } = await supabase
        .from("ebd_leituras")
        .select("*")
        .eq("aluno_id", alunoId)
        .gte("data_leitura", format(inicioSemana, "yyyy-MM-dd"))
        .lte("data_leitura", format(fimSemana, "yyyy-MM-dd"));

      if (error) throw error;
      return data || [];
    },
    enabled: !!alunoId,
  });

  const toggleLeitura = useMutation({
    mutationFn: async (dataLeitura: Date) => {
      const dataFormatada = format(dataLeitura, "yyyy-MM-dd");
      const leituraExistente = leituras?.find(
        (l) => l.data_leitura === dataFormatada
      );

      if (leituraExistente) {
        if (leituraExistente.status === "completo") {
          const { error } = await supabase
            .from("ebd_leituras")
            .update({ status: "incompleto" })
            .eq("id", leituraExistente.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("ebd_leituras")
            .update({ status: "completo" })
            .eq("id", leituraExistente.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("ebd_leituras").insert({
          aluno_id: alunoId,
          church_id: churchId,
          data_leitura: dataFormatada,
          status: "completo",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aluno-leituras", alunoId] });
      toast.success("Leitura atualizada!");
    },
    onError: () => {
      toast.error("Erro ao atualizar leitura");
    },
  });

  const leiturasPorDia = new Map(
    leituras?.map((l) => [l.data_leitura, l.status])
  );

  const diasCompletos = leituras?.filter((l) => l.status === "completo").length || 0;
  const progressoSemana = (diasCompletos / 7) * 100;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded-lg" />
            <div className="grid grid-cols-7 gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="h-16 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookMarked className="w-5 h-5" />
          Leitura Semanal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progresso da Semana */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso da Semana</span>
            <Badge variant={diasCompletos === 7 ? "default" : "secondary"}>
              {diasCompletos}/7 dias
            </Badge>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressoSemana}%` }}
            />
          </div>
          {diasCompletos === 7 && (
            <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Parabéns! Você completou todas as leituras da semana!
            </p>
          )}
        </div>

        {/* Calendário Semanal */}
        <div className="grid grid-cols-7 gap-2">
          {DIAS_SEMANA.map(({ dia, nome }) => {
            const data = addDays(inicioSemana, dia);
            const dataFormatada = format(data, "yyyy-MM-dd");
            const status = leiturasPorDia.get(dataFormatada);
            const completo = status === "completo";
            const passado = data < hoje && !isSameDay(data, hoje);
            const futuro = data > hoje;

            return (
              <div
                key={dia}
                className={`flex flex-col items-center p-3 rounded-lg border transition-colors ${
                  completo
                    ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                    : passado
                    ? "bg-red-50/50 border-red-200/50 dark:bg-red-950/20 dark:border-red-800/50"
                    : "bg-background"
                } ${futuro ? "opacity-50" : ""}`}
              >
                <span className="text-xs font-medium text-muted-foreground mb-1">
                  {nome}
                </span>
                <span className="text-lg font-bold mb-2">
                  {format(data, "d")}
                </span>
                <button
                  onClick={() => !futuro && toggleLeitura.mutate(data)}
                  disabled={futuro || toggleLeitura.isPending}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    completo
                      ? "bg-green-500 text-white"
                      : "bg-muted hover:bg-muted-foreground/20"
                  } ${futuro ? "cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {completo ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Clique nos dias para marcar sua leitura diária
        </p>
      </CardContent>
    </Card>
  );
}
