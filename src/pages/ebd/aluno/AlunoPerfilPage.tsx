import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Trophy, Star, Flame, Medal, Calendar, Target, Award } from "lucide-react";

const NIVEIS = [
  { nome: "Bronze", pontos: 0, cor: "bg-amber-700", icon: "🥉" },
  { nome: "Prata", pontos: 501, cor: "bg-gray-400", icon: "🥈" },
  { nome: "Safira", pontos: 1001, cor: "bg-blue-500", icon: "💎" },
];

export default function AlunoPerfilPage() {
  const { user } = useAuth();

  const { data: aluno, isLoading } = useQuery({
    queryKey: ["aluno-area", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("ebd_alunos")
        .select(`
          *,
          turma:ebd_turmas(id, nome, church_id)
        `)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get badges
  const { data: badges } = useQuery({
    queryKey: ["aluno-badges", aluno?.id],
    queryFn: async () => {
      if (!aluno?.id) return [];

      const { data, error } = await supabase
        .from("ebd_aluno_badges")
        .select(`
          *,
          badge:ebd_badges(*)
        `)
        .eq("aluno_id", aluno.id)
        .order("conquistado_em", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!aluno?.id,
  });

  // Get stats
  const { data: stats } = useQuery({
    queryKey: ["aluno-stats", aluno?.id],
    queryFn: async () => {
      if (!aluno?.id) return null;

      const [frequencia, leituras, quizzes] = await Promise.all([
        supabase
          .from("ebd_frequencia")
          .select("id", { count: "exact" })
          .eq("aluno_id", aluno.id)
          .eq("presente", true),
        supabase
          .from("ebd_leituras")
          .select("id", { count: "exact" })
          .eq("aluno_id", aluno.id)
          .eq("status", "completo"),
        supabase
          .from("ebd_quiz_respostas")
          .select("id", { count: "exact" })
          .eq("aluno_id", aluno.id)
          .eq("completado", true),
      ]);

      return {
        presencas: frequencia.count || 0,
        leituras: leituras.count || 0,
        quizzes: quizzes.count || 0,
      };
    },
    enabled: !!aluno?.id,
  });

  // Get rank
  const { data: ranking } = useQuery({
    queryKey: ["aluno-rank", aluno?.turma_id],
    queryFn: async () => {
      if (!aluno?.turma_id) return null;
      const { data, error } = await supabase
        .from("ebd_alunos")
        .select("id, pontos_totais")
        .eq("turma_id", aluno.turma_id)
        .eq("is_active", true)
        .order("pontos_totais", { ascending: false });

      if (error) throw error;
      const position = data?.findIndex((a) => a.id === aluno?.id) ?? -1;
      return { position: position + 1, total: data?.length || 0 };
    },
    enabled: !!aluno?.turma_id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-48 bg-muted rounded-lg" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (!aluno) {
    return (
      <div className="container mx-auto py-6 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Meu Perfil</h2>
            <p className="text-muted-foreground">
              Você ainda não está vinculado a nenhuma turma.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nivelAtual = NIVEIS.find((n) => n.nome === aluno.nivel) || NIVEIS[0];
  const proximoNivel = NIVEIS.find((n) => n.pontos > aluno.pontos_totais);
  const progressoNivel = proximoNivel
    ? ((aluno.pontos_totais - nivelAtual.pontos) / (proximoNivel.pontos - nivelAtual.pontos)) * 100
    : 100;

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Profile Header */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="py-8">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-primary">
                <AvatarImage src={aluno.avatar_url || ""} className="object-cover" />
                <AvatarFallback className="text-2xl">
                  {aluno.nome_completo
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className={`absolute -bottom-2 -right-2 w-10 h-10 ${nivelAtual.cor} rounded-full flex items-center justify-center text-xl shadow-lg`}>
                {nivelAtual.icon}
              </div>
            </div>
            <h1 className="text-2xl font-bold mt-4">{aluno.nome_completo}</h1>
            <p className="text-muted-foreground">{aluno.turma?.nome}</p>
            <Badge className="mt-2" variant="secondary">
              Nível {aluno.nivel}
            </Badge>
          </div>

          {/* Progress */}
          {proximoNivel && (
            <div className="mt-6 max-w-md mx-auto">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">
                  Próximo: {proximoNivel.nome}
                </span>
                <span className="font-medium">
                  {aluno.pontos_totais} / {proximoNivel.pontos}
                </span>
              </div>
              <Progress value={progressoNivel} className="h-3" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <Star className="w-8 h-8 mx-auto text-yellow-500 mb-2" />
            <p className="text-2xl font-bold">{aluno.pontos_totais}</p>
            <p className="text-xs text-muted-foreground">Pontos Totais</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <Medal className="w-8 h-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">#{ranking?.position || "-"}</p>
            <p className="text-xs text-muted-foreground">Posição no Ranking</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <Flame className="w-8 h-8 mx-auto text-orange-500 mb-2" />
            <p className="text-2xl font-bold">{aluno.aulas_seguidas}</p>
            <p className="text-xs text-muted-foreground">Aulas Seguidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <Trophy className="w-8 h-8 mx-auto text-amber-500 mb-2" />
            <p className="text-2xl font-bold">{badges?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Conquistas</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-5 h-5" />
            Atividades Completadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-muted/50 rounded-lg">
              <Calendar className="w-6 h-6 mx-auto text-green-500 mb-2" />
              <p className="text-xl font-bold">{stats?.presencas || 0}</p>
              <p className="text-xs text-muted-foreground">Presenças</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <Star className="w-6 h-6 mx-auto text-yellow-500 mb-2" />
              <p className="text-xl font-bold">{stats?.leituras || 0}</p>
              <p className="text-xs text-muted-foreground">Leituras</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <Award className="w-6 h-6 mx-auto text-purple-500 mb-2" />
              <p className="text-xl font-bold">{stats?.quizzes || 0}</p>
              <p className="text-xs text-muted-foreground">Quizzes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      {badges && badges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-5 h-5" />
              Conquistas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {badges.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-muted/50 rounded-lg text-center"
                >
                  <div className="text-3xl mb-2">{item.badge?.icone || "🏆"}</div>
                  <p className="font-medium text-sm">{item.badge?.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    +{item.badge?.pontos} pts
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
