import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, BookOpen, User } from "lucide-react";

interface EscalaGeralProps {
  churchId: string | undefined;
}

interface EscalaGeralItem {
  id: string;
  data: string;
  sem_aula: boolean;
  observacao: string | null;
  turma: { id: string; nome: string; faixa_etaria: string };
  professor_id: string | null;
  professor_id_2: string | null;
}

interface ProfessorInfo {
  id: string;
  nome_completo: string;
  avatar_url: string | null;
}

export function EscalaGeral({ churchId }: EscalaGeralProps) {
  const { data: escalaGeral, isLoading } = useQuery({
    queryKey: ["ebd-escala-geral", churchId],
    queryFn: async () => {
      if (!churchId) return [];

      const { data: escalasData, error } = await supabase
        .from("ebd_escalas")
        .select(`
          id, data, sem_aula, observacao, professor_id, professor_id_2,
          turma:ebd_turmas(id, nome, faixa_etaria)
        `)
        .eq("church_id", churchId)
        .order("data", { ascending: true });

      if (error) throw error;
      if (!escalasData || escalasData.length === 0) return [];

      // Collect professor IDs
      const profIds = new Set<string>();
      escalasData.forEach((e: any) => {
        if (e.professor_id) profIds.add(e.professor_id);
        if (e.professor_id_2) profIds.add(e.professor_id_2);
      });

      let professoresMap = new Map<string, ProfessorInfo>();
      if (profIds.size > 0) {
        const { data: profsData } = await supabase
          .from("ebd_professores")
          .select("id, nome_completo, avatar_url")
          .in("id", Array.from(profIds));

        professoresMap = new Map(profsData?.map((p) => [p.id, p]) || []);
      }

      // Group by date
      const grouped: Record<string, Array<EscalaGeralItem & { professor?: ProfessorInfo | null; professor2?: ProfessorInfo | null; numeroAula: number | null }>> = {};

      escalasData.forEach((escala: any) => {
        const matchAula = escala.observacao?.match(/Aula (\d+)/i);
        const numeroAula = matchAula ? parseInt(matchAula[1]) : null;

        const item = {
          ...escala,
          professor: escala.professor_id ? professoresMap.get(escala.professor_id) || null : null,
          professor2: escala.professor_id_2 ? professoresMap.get(escala.professor_id_2) || null : null,
          numeroAula,
        };

        if (!grouped[escala.data]) grouped[escala.data] = [];
        grouped[escala.data].push(item);
      });

      return Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([data, turmas]) => ({ data, turmas }));
    },
    enabled: !!churchId,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-muted rounded-lg" />
        <div className="h-32 bg-muted rounded-lg" />
      </div>
    );
  }

  if (!escalaGeral || escalaGeral.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma escala cadastrada</p>
        <p className="text-sm">As escalas de todas as turmas aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {escalaGeral.map(({ data, turmas }) => (
        <Card key={data}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="capitalize">
                {format(parseISO(data), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y">
              {turmas.map((item) => (
                <div key={item.id} className={`py-3 first:pt-0 last:pb-0 ${item.sem_aula ? "opacity-60" : ""}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    {/* Turma + Aula */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{item.turma?.nome}</span>
                          {item.numeroAula && (
                            <Badge variant="secondary" className="text-xs">
                              Aula {item.numeroAula}
                            </Badge>
                          )}
                          {item.sem_aula && (
                            <Badge variant="destructive" className="text-xs">
                              Sem Aula
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.turma?.faixa_etaria}
                        </p>
                      </div>
                    </div>

                    {/* Professores */}
                    {!item.sem_aula && (item.professor || item.professor2) && (
                      <div className="flex items-center gap-2">
                        {item.professor && (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-7 w-7 border-2 border-primary">
                              <AvatarImage src={item.professor.avatar_url || undefined} />
                              <AvatarFallback className="text-xs bg-primary/10">
                                {item.professor.nome_completo?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm whitespace-nowrap">{item.professor.nome_completo?.split(" ").slice(0, 2).join(" ")}</span>
                          </div>
                        )}
                        {item.professor2 && (
                          <>
                            <span className="text-muted-foreground">/</span>
                            <div className="flex items-center gap-1.5">
                              <Avatar className="h-7 w-7 border-2 border-secondary">
                                <AvatarImage src={item.professor2.avatar_url || undefined} />
                                <AvatarFallback className="text-xs bg-secondary/10">
                                  {item.professor2.nome_completo?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm whitespace-nowrap">{item.professor2.nome_completo?.split(" ").slice(0, 2).join(" ")}</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
