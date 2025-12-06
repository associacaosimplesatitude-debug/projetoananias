import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, Calendar, CheckCircle, BookHeart } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface AlunoDevocionaisProps {
  alunoId: string;
  churchId: string;
}

export function AlunoDevocionais({ alunoId, churchId }: AlunoDevocionaisProps) {
  const queryClient = useQueryClient();

  const { data: devocionais, isLoading } = useQuery({
    queryKey: ["aluno-devocionais", churchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_devocionais")
        .select("*")
        .eq("church_id", churchId)
        .order("data", { ascending: false })
        .limit(30);

      if (error) throw error;
      return data || [];
    },
    enabled: !!churchId,
  });

  const { data: registros } = useQuery({
    queryKey: ["aluno-devocionais-registro", alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_devocional_registro")
        .select("devocional_id, feito_em")
        .eq("aluno_id", alunoId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!alunoId,
  });

  const marcarLido = useMutation({
    mutationFn: async (devocionalId: string) => {
      const { error } = await supabase.from("ebd_devocional_registro").insert({
        aluno_id: alunoId,
        devocional_id: devocionalId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["aluno-devocionais-registro", alunoId],
      });
      toast.success("Devocional marcado como lido!");
    },
    onError: () => {
      toast.error("Erro ao marcar devocional");
    },
  });

  const registrosMap = new Map(
    registros?.map((r) => [r.devocional_id, r.feito_em])
  );

  const devocionaisLidos = registros?.length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!devocionais?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BookHeart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Nenhum devocional disponível</h3>
          <p className="text-muted-foreground text-sm">
            Os devocionais serão exibidos aqui quando forem publicados.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Devocionais
          </CardTitle>
          <Badge variant="secondary">
            {devocionaisLidos} lidos
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {devocionais.map((devocional) => {
              const lido = registrosMap.has(devocional.id);
              return (
                <Card
                  key={devocional.id}
                  className={`transition-colors ${
                    lido
                      ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-2 rounded-full ${
                          lido ? "bg-green-100 dark:bg-green-900" : "bg-muted"
                        }`}
                      >
                        {lido ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Heart className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{devocional.titulo}</h4>
                          {lido && (
                            <Badge variant="outline" className="text-xs text-green-600">
                              Lido
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(new Date(devocional.data), "dd 'de' MMMM", {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {devocional.conteudo}
                        </p>
                        {!lido && (
                          <button
                            onClick={() => marcarLido.mutate(devocional.id)}
                            disabled={marcarLido.isPending}
                            className="mt-3 text-sm text-primary hover:underline"
                          >
                            Marcar como lido
                          </button>
                        )}
                      </div>
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
