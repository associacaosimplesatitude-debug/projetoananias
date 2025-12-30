import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, BookOpen } from "lucide-react";

export default function ProfessorEscala() {
  const { user } = useAuth();

  const { data: professor } = useQuery({
    queryKey: ["professor-escala-info", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("ebd_professores")
        .select("id, nome_completo")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: escalas, isLoading } = useQuery({
    queryKey: ["professor-escala-completa", professor?.id],
    queryFn: async () => {
      if (!professor?.id) return [];

      const { data, error } = await supabase
        .from("ebd_escalas")
        .select(`
          *,
          turma:ebd_turmas(id, nome, faixa_etaria)
        `)
        .eq("professor_id", professor.id)
        .order("data", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!professor?.id,
  });

  // Group by month
  const escalasByMonth = escalas?.reduce((acc, escala) => {
    const month = format(parseISO(escala.data), "MMMM 'de' yyyy", { locale: ptBR });
    if (!acc[month]) {
      acc[month] = [];
    }
    acc[month].push(escala);
    return acc;
  }, {} as Record<string, typeof escalas>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          Minha Escala
        </h1>
        <p className="text-muted-foreground">
          Visualize todas as suas aulas agendadas
        </p>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-32 bg-muted rounded-lg" />
        </div>
      ) : escalas && escalas.length > 0 ? (
        Object.entries(escalasByMonth || {}).map(([month, monthEscalas]) => (
          <Card key={month}>
            <CardHeader>
              <CardTitle className="capitalize">{month}</CardTitle>
              <CardDescription>
                {monthEscalas?.length} aula(s) agendada(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {monthEscalas?.map((escala) => (
                  <div
                    key={escala.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border ${
                      escala.sem_aula 
                        ? "bg-muted/50 border-dashed" 
                        : "bg-background"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center justify-center bg-primary/10 rounded-lg p-2 min-w-[60px]">
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(escala.data), "EEE", { locale: ptBR })}
                        </span>
                        <span className="text-xl font-bold text-primary">
                          {format(parseISO(escala.data), "dd")}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{escala.turma?.nome}</h3>
                          {escala.sem_aula && (
                            <Badge variant="secondary">Sem Aula</Badge>
                          )}
                          {escala.confirmado && (
                            <Badge variant="default">Confirmado</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Faixa: {escala.turma?.faixa_etaria}
                        </p>
                        {escala.observacao && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Obs: {escala.observacao}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 sm:mt-0">
                      <Badge variant="outline">{escala.tipo}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nenhuma aula agendada</h2>
            <p className="text-muted-foreground">
              Você ainda não possui aulas na escala.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
