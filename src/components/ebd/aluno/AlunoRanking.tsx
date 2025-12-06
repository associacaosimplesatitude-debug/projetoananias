import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Crown, Medal, Award, Trophy, Flame, Star } from "lucide-react";

interface AlunoRankingProps {
  turmaId: string | null;
  currentAlunoId?: string;
}

const POSITION_STYLES = [
  {
    bg: "bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-950/50 dark:to-amber-900/30",
    border: "border-yellow-400 dark:border-yellow-600",
    icon: Crown,
    iconColor: "text-yellow-500",
    badge: "bg-yellow-500",
  },
  {
    bg: "bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-900/50 dark:to-slate-800/30",
    border: "border-gray-400 dark:border-gray-600",
    icon: Medal,
    iconColor: "text-gray-400",
    badge: "bg-gray-400",
  },
  {
    bg: "bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-950/50 dark:to-orange-900/30",
    border: "border-amber-600 dark:border-amber-700",
    icon: Award,
    iconColor: "text-amber-600",
    badge: "bg-amber-600",
  },
];

export function AlunoRanking({ turmaId, currentAlunoId }: AlunoRankingProps) {
  const { data: ranking, isLoading } = useQuery({
    queryKey: ["turma-ranking", turmaId],
    queryFn: async () => {
      if (!turmaId) return [];

      const { data, error } = await supabase
        .from("ebd_alunos")
        .select("id, nome_completo, pontos_totais, aulas_seguidas, nivel, avatar_url")
        .eq("turma_id", turmaId)
        .eq("is_active", true)
        .order("pontos_totais", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!turmaId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!ranking?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Ranking Vazio</h3>
          <p className="text-muted-foreground text-sm">
            Ainda não há alunos com pontuação nesta turma.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Top 3 podium
  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Ranking da Turma
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Podium */}
        <div className="grid grid-cols-3 gap-4 items-end">
          {/* 2º Lugar */}
          {top3[1] && (
            <div className="order-1">
              <div className="text-center">
                <div className="relative inline-block">
                  <Avatar className="w-16 h-16 mx-auto border-4 border-gray-300">
                    <AvatarImage src={top3[1].avatar_url || ""} />
                    <AvatarFallback>
                      {top3[1].nome_completo
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    2
                  </div>
                </div>
                <p className="font-medium mt-2 text-sm truncate">
                  {top3[1].nome_completo.split(" ")[0]}
                </p>
                <p className="text-sm text-muted-foreground">
                  {top3[1].pontos_totais} pts
                </p>
              </div>
              <div className="h-16 bg-gray-200 dark:bg-gray-800 rounded-t-lg mt-2" />
            </div>
          )}

          {/* 1º Lugar */}
          {top3[0] && (
            <div className="order-2">
              <div className="text-center">
                <Crown className="w-8 h-8 mx-auto text-yellow-500 mb-1" />
                <div className="relative inline-block">
                  <Avatar className="w-20 h-20 mx-auto border-4 border-yellow-400">
                    <AvatarImage src={top3[0].avatar_url || ""} />
                    <AvatarFallback className="text-lg">
                      {top3[0].nome_completo
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-yellow-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    1
                  </div>
                </div>
                <p className="font-bold mt-2 truncate">
                  {top3[0].nome_completo.split(" ")[0]}
                </p>
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  {top3[0].pontos_totais} pts
                </p>
              </div>
              <div className="h-24 bg-yellow-200 dark:bg-yellow-900/50 rounded-t-lg mt-2" />
            </div>
          )}

          {/* 3º Lugar */}
          {top3[2] && (
            <div className="order-3">
              <div className="text-center">
                <div className="relative inline-block">
                  <Avatar className="w-14 h-14 mx-auto border-4 border-amber-500">
                    <AvatarImage src={top3[2].avatar_url || ""} />
                    <AvatarFallback>
                      {top3[2].nome_completo
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    3
                  </div>
                </div>
                <p className="font-medium mt-2 text-sm truncate">
                  {top3[2].nome_completo.split(" ")[0]}
                </p>
                <p className="text-sm text-muted-foreground">
                  {top3[2].pontos_totais} pts
                </p>
              </div>
              <div className="h-12 bg-amber-200 dark:bg-amber-900/50 rounded-t-lg mt-2" />
            </div>
          )}
        </div>

        {/* Lista completa */}
        {rest.length > 0 && (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {rest.map((aluno, index) => {
                const position = index + 4;
                const isCurrentUser = aluno.id === currentAlunoId;

                return (
                  <div
                    key={aluno.id}
                    className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                      isCurrentUser
                        ? "bg-primary/10 border-2 border-primary"
                        : "bg-muted/30 hover:bg-muted/50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
                      {position}
                    </div>
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={aluno.avatar_url || ""} />
                      <AvatarFallback>
                        {aluno.nome_completo
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {aluno.nome_completo}
                        {isCurrentUser && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Você
                          </Badge>
                        )}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3 text-orange-500" />
                          {aluno.aulas_seguidas} seguidas
                        </span>
                        <span>•</span>
                        <span>{aluno.nivel}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 font-bold">
                        <Star className="w-4 h-4 text-yellow-500" />
                        {aluno.pontos_totais}
                      </div>
                      <div className="text-xs text-muted-foreground">pontos</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
