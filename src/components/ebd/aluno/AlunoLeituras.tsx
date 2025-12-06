import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, BookMarked, CheckCircle2, Circle, BookOpen } from "lucide-react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface AlunoLeiturasProps {
  alunoId: string;
  churchId: string;
  turmaId?: string;
}

interface PlanoLeitura {
  dia: number;
  leitura: string;
}

const DIAS_SEMANA = [
  { dia: 0, nome: "Dom", nomeFull: "Domingo" },
  { dia: 1, nome: "Seg", nomeFull: "Segunda" },
  { dia: 2, nome: "Ter", nomeFull: "Terça" },
  { dia: 3, nome: "Qua", nomeFull: "Quarta" },
  { dia: 4, nome: "Qui", nomeFull: "Quinta" },
  { dia: 5, nome: "Sex", nomeFull: "Sexta" },
  { dia: 6, nome: "Sáb", nomeFull: "Sábado" },
];

export function AlunoLeituras({ alunoId, churchId, turmaId }: AlunoLeiturasProps) {
  const queryClient = useQueryClient();
  const hoje = new Date();
  const inicioSemana = startOfWeek(hoje, { weekStartsOn: 0 });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Fetch current lesson's reading plan
  const { data: licaoAtual } = useQuery({
    queryKey: ["licao-atual", turmaId, format(inicioSemana, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!turmaId) return null;

      // First try to get lesson directly linked to the turma
      let query = supabase
        .from("ebd_licoes")
        .select("*, revista:ebd_revistas(titulo)")
        .lte("data_aula", format(addDays(inicioSemana, 6), "yyyy-MM-dd"))
        .gte("data_aula", format(inicioSemana, "yyyy-MM-dd"))
        .not("plano_leitura_semanal", "is", null);

      // Try turma-specific first
      const { data: turmaLicao } = await query
        .eq("turma_id", turmaId)
        .order("data_aula", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (turmaLicao) return turmaLicao;

      // Fallback to global lessons (church_id is null)
      const { data: globalLicao } = await supabase
        .from("ebd_licoes")
        .select("*, revista:ebd_revistas(titulo)")
        .is("church_id", null)
        .lte("data_aula", format(addDays(inicioSemana, 6), "yyyy-MM-dd"))
        .gte("data_aula", format(inicioSemana, "yyyy-MM-dd"))
        .not("plano_leitura_semanal", "is", null)
        .order("data_aula", { ascending: false })
        .limit(1)
        .maybeSingle();

      return globalLicao;
    },
    enabled: !!turmaId,
  });

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
          licao_id: licaoAtual?.id || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aluno-leituras", alunoId] });
      toast.success("Leitura atualizada! +10 pontos");
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

  // Parse reading plan
  const planoLeitura: PlanoLeitura[] = licaoAtual?.plano_leitura_semanal 
    ? (Array.isArray(licaoAtual.plano_leitura_semanal) 
        ? (licaoAtual.plano_leitura_semanal as unknown as PlanoLeitura[])
        : [])
    : [];

  const getLeituraForDay = (diaSemana: number): string | null => {
    const leitura = planoLeitura.find(p => p.dia === diaSemana + 1);
    return leitura?.leitura || null;
  };

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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookMarked className="w-5 h-5" />
            Plano de Leitura Semanal
          </CardTitle>
          {licaoAtual && (
            <p className="text-sm text-muted-foreground">
              Lição: {licaoAtual.titulo}
              {licaoAtual.revista && ` • ${(licaoAtual.revista as { titulo: string }).titulo}`}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progresso da Semana */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso da Semana</span>
              <Badge variant={diasCompletos === 7 ? "default" : "secondary"}>
                {diasCompletos}/7 dias • {diasCompletos * 10} pontos
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
                Parabéns! Você completou todas as leituras da semana! +70 pontos
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
              const isToday = isSameDay(data, hoje);
              const temLeitura = !!getLeituraForDay(dia);

              return (
                <div
                  key={dia}
                  onClick={() => setSelectedDay(selectedDay === dia ? null : dia)}
                  className={`flex flex-col items-center p-3 rounded-lg border transition-colors cursor-pointer ${
                    completo
                      ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                      : passado && !completo
                      ? "bg-red-50/50 border-red-200/50 dark:bg-red-950/20 dark:border-red-800/50"
                      : isToday
                      ? "bg-primary/10 border-primary"
                      : "bg-background hover:bg-muted/50"
                  } ${futuro ? "opacity-50" : ""} ${selectedDay === dia ? "ring-2 ring-primary" : ""}`}
                >
                  <span className="text-xs font-medium text-muted-foreground mb-1">
                    {nome}
                  </span>
                  <span className={`text-lg font-bold mb-2 ${isToday ? "text-primary" : ""}`}>
                    {format(data, "d")}
                  </span>
                  {temLeitura && (
                    <BookOpen className={`w-3 h-3 mb-1 ${completo ? "text-green-600" : "text-muted-foreground"}`} />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!futuro) toggleLeitura.mutate(data);
                    }}
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

          {/* Detalhes da leitura selecionada */}
          {selectedDay !== null && (
            <div className="bg-muted/30 rounded-lg p-4 border animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h4 className="font-medium">
                  {DIAS_SEMANA[selectedDay].nomeFull}, {format(addDays(inicioSemana, selectedDay), "d 'de' MMMM", { locale: ptBR })}
                </h4>
              </div>
              {getLeituraForDay(selectedDay) ? (
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Leitura do dia:</p>
                    <p className="text-base">{getLeituraForDay(selectedDay)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Não há leitura específica cadastrada para este dia.
                </p>
              )}
              {!leiturasPorDia.get(format(addDays(inicioSemana, selectedDay), "yyyy-MM-dd")) && 
               addDays(inicioSemana, selectedDay) <= hoje && (
                <button
                  onClick={() => toggleLeitura.mutate(addDays(inicioSemana, selectedDay))}
                  disabled={toggleLeitura.isPending}
                  className="mt-3 w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  Marcar como Concluída (+10 pontos)
                </button>
              )}
            </div>
          )}

          <p className="text-sm text-muted-foreground text-center">
            Clique nos dias para ver a leitura e marcar como concluída
          </p>
        </CardContent>
      </Card>
    </div>
  );
}