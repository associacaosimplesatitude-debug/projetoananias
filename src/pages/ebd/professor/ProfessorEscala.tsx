import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, BookOpen } from "lucide-react";

export default function ProfessorEscala() {
  const { user } = useAuth();

  // Primeiro, buscar o church_id correto do contexto do usuário
  const { data: churchContext } = useQuery({
    queryKey: ["professor-escala-church-context", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // 1) Verificar se é superintendente promovido
      const { data: promotedRole } = await supabase
        .from("ebd_user_roles")
        .select("church_id")
        .eq("user_id", user.id)
        .eq("role", "superintendente")
        .maybeSingle();

      if (promotedRole?.church_id) return promotedRole.church_id;

      // 2) Verificar se é superintendente legacy
      const { data: ebdCliente } = await supabase
        .from("ebd_clientes")
        .select("id")
        .eq("superintendente_user_id", user.id)
        .eq("status_ativacao_ebd", true)
        .maybeSingle();

      if (ebdCliente?.id) return ebdCliente.id;

      // 3) Buscar o church_id do professor mais recente
      const { data: professorRecord } = await supabase
        .from("ebd_professores")
        .select("church_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return professorRecord?.church_id || null;
    },
    enabled: !!user?.id,
  });

  // Buscar o professor usando o church_id correto
  const { data: professor } = useQuery({
    queryKey: ["professor-escala-info", user?.id, churchContext],
    queryFn: async () => {
      if (!user?.id || !churchContext) return null;

      const { data, error } = await supabase
        .from("ebd_professores")
        .select("id, nome_completo")
        .eq("user_id", user.id)
        .eq("church_id", churchContext)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!churchContext,
  });

  // Buscar escalas onde o professor é professor_id OU professor_id_2
  const { data: escalas, isLoading } = useQuery({
    queryKey: ["professor-escala-completa", professor?.id],
    queryFn: async () => {
      if (!professor?.id) return [];

      const { data, error } = await supabase
        .from("ebd_escalas")
        .select(`
          *,
          turma:ebd_turmas(id, nome, faixa_etaria),
          professor:ebd_professores!ebd_escalas_professor_id_fkey(id, nome_completo, avatar_url),
          professor2:ebd_professores!ebd_escalas_professor_id_2_fkey(id, nome_completo, avatar_url)
        `)
        .or(`professor_id.eq.${professor.id},professor_id_2.eq.${professor.id}`)
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
                    className={`flex flex-col p-4 rounded-lg border ${
                      escala.sem_aula 
                        ? "bg-muted/50 border-dashed" 
                        : "bg-background"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Data */}
                      <div className="flex flex-col items-center justify-center bg-primary/10 rounded-lg p-2 min-w-[60px]">
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(escala.data), "EEE", { locale: ptBR })}
                        </span>
                        <span className="text-xl font-bold text-primary">
                          {format(parseISO(escala.data), "dd")}
                        </span>
                      </div>

                      {/* Conteúdo principal */}
                      <div className="flex-1 space-y-2">
                        {/* Turma e Status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{escala.turma?.nome}</h3>
                          {escala.sem_aula && (
                            <Badge variant="destructive">Sem Aula</Badge>
                          )}
                          {escala.confirmado && (
                            <Badge variant="default">Confirmado</Badge>
                          )}
                          <Badge variant="outline">{escala.tipo}</Badge>
                        </div>

                        <p className="text-sm text-muted-foreground">
                          Faixa: {escala.turma?.faixa_etaria}
                        </p>

                        {/* Lição/Revista (do campo observacao) */}
                        {escala.observacao && (
                          <div className="flex items-start gap-2 bg-primary/5 p-2 rounded">
                            <BookOpen className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span className="text-sm">{escala.observacao}</span>
                          </div>
                        )}

                        {/* Professores */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">Professores:</span>
                          <div className="flex items-center gap-2">
                            {/* Professor 1 */}
                            {escala.professor && (
                              <div className="flex items-center gap-1.5">
                                <Avatar className="h-7 w-7 border-2 border-primary">
                                  <AvatarImage src={escala.professor.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs bg-primary/10">
                                    {escala.professor.nome_completo?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{escala.professor.nome_completo?.split(' ')[0]}</span>
                              </div>
                            )}
                            
                            {/* Professor 2 (se existir) */}
                            {escala.professor2 && (
                              <>
                                <span className="text-muted-foreground">/</span>
                                <div className="flex items-center gap-1.5">
                                  <Avatar className="h-7 w-7 border-2 border-secondary">
                                    <AvatarImage src={escala.professor2.avatar_url || undefined} />
                                    <AvatarFallback className="text-xs bg-secondary/10">
                                      {escala.professor2.nome_completo?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{escala.professor2.nome_completo?.split(' ')[0]}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
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
