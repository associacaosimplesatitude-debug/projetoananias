import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Calendar, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AlunoAulasProps {
  alunoId: string;
  turmaId: string | null;
  churchId: string;
}

export function AlunoAulas({ alunoId, turmaId, churchId }: AlunoAulasProps) {
  const { data: licoes, isLoading } = useQuery({
    queryKey: ["aluno-licoes", turmaId, churchId],
    queryFn: async () => {
      if (!turmaId) return [];

      const { data, error } = await supabase
        .from("ebd_licoes")
        .select("*")
        .or(`turma_id.eq.${turmaId},and(church_id.is.null,publicada.eq.true)`)
        .order("data_aula", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!turmaId,
  });

  const { data: acessos } = useQuery({
    queryKey: ["aluno-licoes-acesso", alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_licoes_acesso")
        .select("licao_id, acessado_em")
        .eq("aluno_id", alunoId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!alunoId,
  });

  const acessosMap = new Map(acessos?.map((a) => [a.licao_id, a.acessado_em]));

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

  if (!licoes?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Nenhuma aula disponível</h3>
          <p className="text-muted-foreground text-sm">
            As lições serão exibidas aqui quando forem publicadas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Aulas Disponíveis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {licoes.map((licao) => {
              const acessado = acessosMap.has(licao.id);
              return (
                <Card
                  key={licao.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    acessado ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : ""
                  }`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {licao.numero_licao && (
                            <Badge variant="outline" className="text-xs">
                              Lição {licao.numero_licao}
                            </Badge>
                          )}
                          {acessado && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <h4 className="font-medium truncate">{licao.titulo}</h4>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(new Date(licao.data_aula), "dd 'de' MMMM", {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    {licao.conteudo && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {licao.conteudo}
                      </p>
                    )}
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
