import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Star,
  Flame,
  Target,
  Medal,
  BookOpen,
  Crown,
  Award,
  Zap,
  Heart,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { AlunoRanking } from "@/components/ebd/aluno/AlunoRanking";

const NIVEIS = [
  { nome: "Bronze", pontos: 0, cor: "bg-amber-700", icon: Medal },
  { nome: "Prata", pontos: 501, cor: "bg-gray-400", icon: Award },
  { nome: "Safira", pontos: 1001, cor: "bg-blue-500", icon: Crown },
];

const CONQUISTAS_DISPONIVEIS = [
  {
    id: "primeiro_acesso",
    nome: "Eis-me Aqui",
    descricao: "Primeira presença na EBD",
    icone: Zap,
    cor: "text-yellow-500",
    criterio: (aluno: any) => aluno.aulas_seguidas >= 1,
  },
  {
    id: "sequencia_5",
    nome: "Fiel",
    descricao: "5 aulas seguidas",
    icone: Flame,
    cor: "text-orange-500",
    criterio: (aluno: any) => aluno.aulas_seguidas >= 5,
  },
  {
    id: "sequencia_10",
    nome: "Dedicado",
    descricao: "10 aulas seguidas",
    icone: Target,
    cor: "text-red-500",
    criterio: (aluno: any) => aluno.aulas_seguidas >= 10,
  },
  {
    id: "leitor_habitual",
    nome: "Leitor Habitual",
    descricao: "7 dias de leitura na semana",
    icone: BookOpen,
    cor: "text-green-500",
    criterio: (aluno: any, stats: any) => stats?.leiturasCompletas >= 7,
  },
  {
    id: "devoto",
    nome: "Devoto",
    descricao: "10 devocionais completados",
    icone: Heart,
    cor: "text-pink-500",
    criterio: (aluno: any, stats: any) => stats?.devocionaisCompletos >= 10,
  },
  {
    id: "pontuador",
    nome: "Destaque",
    descricao: "Alcançou 500 pontos",
    icone: Star,
    cor: "text-yellow-400",
    criterio: (aluno: any) => aluno.pontos_totais >= 500,
  },
  {
    id: "elite",
    nome: "Elite",
    descricao: "Alcançou 1000 pontos",
    icone: Crown,
    cor: "text-purple-500",
    criterio: (aluno: any) => aluno.pontos_totais >= 1000,
  },
];

export default function AlunoPerfil() {
  const { user } = useAuth();

  const { data: aluno, isLoading } = useQuery({
    queryKey: ["aluno-perfil", user?.id],
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
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Buscar posição no ranking
  const { data: rankPosition } = useQuery({
    queryKey: ["aluno-rank", aluno?.turma_id, aluno?.id],
    queryFn: async () => {
      if (!aluno?.turma_id) return null;

      const { data, error } = await supabase
        .from("ebd_alunos")
        .select("id, pontos_totais")
        .eq("turma_id", aluno.turma_id)
        .eq("is_active", true)
        .order("pontos_totais", { ascending: false });

      if (error) throw error;

      const position = data?.findIndex((a) => a.id === aluno.id);
      return position !== undefined ? position + 1 : null;
    },
    enabled: !!aluno?.turma_id,
  });

  // Buscar estatísticas adicionais
  const { data: stats } = useQuery({
    queryKey: ["aluno-stats", aluno?.id],
    queryFn: async () => {
      if (!aluno?.id) return null;

      const [leiturasRes, devocionaisRes] = await Promise.all([
        supabase
          .from("ebd_leituras")
          .select("id")
          .eq("aluno_id", aluno.id)
          .eq("status", "completo"),
        supabase
          .from("ebd_devocional_registro")
          .select("id")
          .eq("aluno_id", aluno.id),
      ]);

      return {
        leiturasCompletas: leiturasRes.data?.length || 0,
        devocionaisCompletos: devocionaisRes.data?.length || 0,
      };
    },
    enabled: !!aluno?.id,
  });

  const nivelAtual = NIVEIS.find((n) => n.nome === aluno?.nivel) || NIVEIS[0];
  const proximoNivel = NIVEIS.find((n) => n.pontos > (aluno?.pontos_totais || 0));
  const progressoNivel = proximoNivel
    ? ((aluno?.pontos_totais || 0) - nivelAtual.pontos) /
      (proximoNivel.pontos - nivelAtual.pontos) *
      100
    : 100;

  const conquistasDesbloqueadas = CONQUISTAS_DISPONIVEIS.filter((c) =>
    c.criterio(aluno || {}, stats)
  );

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-48 bg-muted rounded-lg" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!aluno) {
    return (
      <div className="container mx-auto py-6 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Meu Perfil</h2>
            <p className="text-muted-foreground">
              Você ainda não está vinculado como aluno em nenhuma turma da EBD.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const NivelIcon = nivelAtual.icon;

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header do Perfil */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 p-6 text-primary-foreground">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <Avatar className="w-24 h-24 border-4 border-white/20">
              <AvatarImage src={aluno.avatar_url || ""} />
              <AvatarFallback className="text-2xl bg-primary-foreground/20">
                {aluno.nome_completo
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center md:text-left flex-1">
              <h1 className="text-2xl md:text-3xl font-bold mb-1">
                {aluno.nome_completo}
              </h1>
              <p className="opacity-90 mb-3">{aluno.turma?.nome}</p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <Badge
                  className={`${nivelAtual.cor} text-white border-0 px-3 py-1`}
                >
                  <NivelIcon className="w-4 h-4 mr-1" />
                  {aluno.nivel || "Bronze"}
                </Badge>
                {rankPosition && (
                  <Badge variant="secondary" className="px-3 py-1">
                    #{rankPosition} no Ranking
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold">{aluno.pontos_totais || 0}</div>
              <div className="text-sm opacity-80">pontos totais</div>
            </div>
          </div>
        </div>

        {/* Barra de Progresso do Nível */}
        {proximoNivel && (
          <div className="p-4 bg-muted/30">
            <div className="flex justify-between text-sm mb-2">
              <span className="flex items-center gap-1">
                <nivelAtual.icon className="w-4 h-4" />
                {nivelAtual.nome}
              </span>
              <span className="flex items-center gap-1">
                <proximoNivel.icon className="w-4 h-4" />
                {proximoNivel.nome} ({proximoNivel.pontos} pts)
              </span>
            </div>
            <Progress value={progressoNivel} className="h-3" />
            <p className="text-xs text-muted-foreground mt-1 text-center">
              Faltam {proximoNivel.pontos - (aluno.pontos_totais || 0)} pontos
              para o próximo nível
            </p>
          </div>
        )}
      </Card>

      <Tabs defaultValue="estatisticas" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
          <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
          <TabsTrigger value="conquistas">Conquistas</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        {/* Estatísticas */}
        <TabsContent value="estatisticas">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
              <CardContent className="p-4 text-center">
                <Flame className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {aluno.aulas_seguidas || 0}
                </div>
                <div className="text-sm text-orange-700 dark:text-orange-300">
                  Aulas Seguidas
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-4 text-center">
                <Star className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {aluno.pontos_totais || 0}
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  Total de Pontos
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4 text-center">
                <NivelIcon className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {aluno.nivel || "Bronze"}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  Nível Atual
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  #{rankPosition || "-"}
                </div>
                <div className="text-sm text-purple-700 dark:text-purple-300">
                  Rank na Turma
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Estatísticas Adicionais */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <BookOpen className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {stats?.leiturasCompletas || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Leituras Completadas
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                  <Heart className="w-6 h-6 text-pink-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {stats?.devocionaisCompletos || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Devocionais Lidos
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Conquistas */}
        <TabsContent value="conquistas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Minhas Conquistas ({conquistasDesbloqueadas.length}/
                {CONQUISTAS_DISPONIVEIS.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {CONQUISTAS_DISPONIVEIS.map((conquista) => {
                  const desbloqueada = conquistasDesbloqueadas.includes(conquista);
                  const Icon = conquista.icone;

                  return (
                    <div
                      key={conquista.id}
                      className={`p-4 rounded-lg border-2 text-center transition-all ${
                        desbloqueada
                          ? "bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-900/20 border-yellow-300 dark:border-yellow-700"
                          : "bg-muted/30 border-muted opacity-50 grayscale"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${
                          desbloqueada
                            ? "bg-yellow-100 dark:bg-yellow-900/50"
                            : "bg-muted"
                        }`}
                      >
                        <Icon
                          className={`w-6 h-6 ${
                            desbloqueada ? conquista.cor : "text-muted-foreground"
                          }`}
                        />
                      </div>
                      <h4 className="font-semibold text-sm mb-1">
                        {conquista.nome}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {conquista.descricao}
                      </p>
                      {desbloqueada && (
                        <Badge className="mt-2 bg-yellow-500 text-white text-xs">
                          Desbloqueada!
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ranking */}
        <TabsContent value="ranking">
          <AlunoRanking turmaId={aluno.turma_id} currentAlunoId={aluno.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
