import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Calendar, User, CheckCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AlunoAulasProps {
  alunoId: string;
  turmaId: string | null;
  churchId: string;
}

interface EscalaAula {
  id: string;
  data: string;
  observacao: string | null;
  sem_aula: boolean;
  professor: {
    id: string;
    nome_completo: string;
    avatar_url: string | null;
  } | null;
}

export function AlunoAulas({ alunoId, turmaId, churchId }: AlunoAulasProps) {
  const hoje = format(new Date(), "yyyy-MM-dd");

  // Buscar aulas da escala (que já tem as 13 lições)
  const { data: aulasEscala, isLoading } = useQuery({
    queryKey: ["aluno-aulas-escala", turmaId],
    queryFn: async () => {
      if (!turmaId) return [];

      const { data: escalas, error } = await supabase
        .from("ebd_escalas")
        .select(`
          id, 
          data, 
          observacao, 
          sem_aula,
          professor:ebd_professores!professor_id(id, nome_completo, avatar_url)
        `)
        .eq("turma_id", turmaId)
        .eq("tipo", "aula")
        .order("data", { ascending: true });

      if (error) throw error;
      return (escalas || []) as EscalaAula[];
    },
    enabled: !!turmaId,
  });

  // Buscar quais aulas o aluno já participou (via frequência)
  const { data: frequencias } = useQuery({
    queryKey: ["aluno-frequencias", alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_frequencia")
        .select("data")
        .eq("aluno_id", alunoId)
        .eq("presente", true);

      if (error) throw error;
      return new Set(data?.map((f) => f.data) || []);
    },
    enabled: !!alunoId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!aulasEscala?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Nenhuma aula programada</h3>
          <p className="text-muted-foreground text-sm">
            As aulas serão exibidas aqui quando a escala for montada.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Encontrar a próxima aula (primeira aula >= hoje que não seja sem_aula)
  const proximaAula = aulasEscala.find((a) => a.data >= hoje && !a.sem_aula);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Aulas do Trimestre ({aulasEscala.length} lições)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-3">
            {aulasEscala.map((aula, index) => {
              const aulaNumero = index + 1;
              const isHoje = aula.data === hoje && !aula.sem_aula;
              const isProximaAula = proximaAula?.id === aula.id && !isHoje;
              const isPast = aula.data < hoje;
              const foiPresente = frequencias?.has(aula.data);

              // Extrair título da observação (remover "Aula X - ")
              const tituloLicao = aula.observacao?.replace(/^Aula \d+ - /, "") || `Lição ${aulaNumero}`;

              return (
                <Card
                  key={aula.id}
                  className={cn(
                    "transition-all",
                    isHoje && "ring-2 ring-primary border-primary bg-primary/5",
                    isProximaAula && "border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20",
                    isPast && !isHoje && "opacity-70",
                    aula.sem_aula && "bg-muted/50 opacity-60"
                  )}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge 
                            variant={isHoje ? "default" : "outline"} 
                            className={cn(
                              "text-xs",
                              isHoje && "bg-primary"
                            )}
                          >
                            Lição {aulaNumero}
                          </Badge>
                          {isHoje && (
                            <Badge className="bg-green-500 text-white">
                              HOJE
                            </Badge>
                          )}
                          {isProximaAula && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                              Próxima
                            </Badge>
                          )}
                          {aula.sem_aula && (
                            <Badge variant="secondary">Sem aula</Badge>
                          )}
                          {foiPresente && !aula.sem_aula && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>

                        <h4 className="font-medium">{tituloLicao}</h4>

                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span className="capitalize">
                            {format(parseISO(aula.data), "EEEE, dd 'de' MMMM", {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Avatar do Professor */}
                      {aula.professor && !aula.sem_aula && (
                        <div className="flex flex-col items-center gap-1 min-w-fit">
                          <Avatar className="h-10 w-10">
                            <AvatarImage 
                              src={aula.professor.avatar_url || undefined} 
                              className="object-cover" 
                            />
                            <AvatarFallback>
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground text-center max-w-[80px] truncate">
                            {aula.professor.nome_completo.split(" ")[0]}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
