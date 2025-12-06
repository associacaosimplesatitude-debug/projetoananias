import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Calendar, FileText, PenLine, Heart, Trophy, Flame, Star } from "lucide-react";
import { AlunoAulas } from "@/components/ebd/aluno/AlunoAulas";
import { AlunoLeituras } from "@/components/ebd/aluno/AlunoLeituras";
import { AlunoMateriais } from "@/components/ebd/aluno/AlunoMateriais";
import { AlunoAnotacoes } from "@/components/ebd/aluno/AlunoAnotacoes";
import { AlunoDevocionais } from "@/components/ebd/aluno/AlunoDevocionais";

const NIVEIS = [
  { nome: "Bronze", pontos: 0, cor: "bg-amber-700" },
  { nome: "Prata", pontos: 501, cor: "bg-gray-400" },
  { nome: "Safira", pontos: 1001, cor: "bg-blue-500" },
];

export default function AreaAluno() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("aulas");

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

  const nivelAtual = NIVEIS.find((n) => n.nome === aluno?.nivel) || NIVEIS[0];
  const proximoNivel = NIVEIS.find((n) => n.pontos > (aluno?.pontos_totais || 0));
  const progressoNivel = proximoNivel
    ? ((aluno?.pontos_totais || 0) - nivelAtual.pontos) / (proximoNivel.pontos - nivelAtual.pontos) * 100
    : 100;

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
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
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Área do Aluno</h2>
            <p className="text-muted-foreground">
              Você ainda não está vinculado como aluno em nenhuma turma da EBD.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header com Gamificação */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className={`w-16 h-16 rounded-full ${nivelAtual.cor} flex items-center justify-center`}>
                  <Trophy className="w-8 h-8 text-white" />
                </div>
                <Badge className="absolute -bottom-1 -right-1 bg-background border text-xs">
                  {aluno.nivel || "Bronze"}
                </Badge>
              </div>
              <div>
                <h1 className="text-2xl font-bold">{aluno.nome_completo}</h1>
                <p className="text-muted-foreground">{aluno.turma?.nome}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 bg-background/80 rounded-lg px-4 py-2">
                <Star className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Pontos</p>
                  <p className="font-bold">{aluno.pontos_totais || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-background/80 rounded-lg px-4 py-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Sequência</p>
                  <p className="font-bold">{aluno.aulas_seguidas || 0} aulas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Barra de Progresso do Nível */}
          {proximoNivel && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">
                  Próximo nível: {proximoNivel.nome}
                </span>
                <span className="font-medium">
                  {aluno.pontos_totais || 0} / {proximoNivel.pontos} pts
                </span>
              </div>
              <Progress value={progressoNivel} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs de Conteúdo */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="aulas" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Aulas</span>
          </TabsTrigger>
          <TabsTrigger value="leituras" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Leituras</span>
          </TabsTrigger>
          <TabsTrigger value="materiais" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Materiais</span>
          </TabsTrigger>
          <TabsTrigger value="anotacoes" className="flex items-center gap-2">
            <PenLine className="w-4 h-4" />
            <span className="hidden sm:inline">Anotações</span>
          </TabsTrigger>
          <TabsTrigger value="devocionais" className="flex items-center gap-2">
            <Heart className="w-4 h-4" />
            <span className="hidden sm:inline">Devocionais</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aulas">
          <AlunoAulas alunoId={aluno.id} turmaId={aluno.turma_id} churchId={aluno.church_id} />
        </TabsContent>

        <TabsContent value="leituras">
          <AlunoLeituras alunoId={aluno.id} churchId={aluno.church_id} turmaId={aluno.turma_id || undefined} />
        </TabsContent>

        <TabsContent value="materiais">
          <AlunoMateriais turmaId={aluno.turma_id} />
        </TabsContent>

        <TabsContent value="anotacoes">
          <AlunoAnotacoes alunoId={aluno.id} churchId={aluno.church_id} />
        </TabsContent>

        <TabsContent value="devocionais">
          <AlunoDevocionais alunoId={aluno.id} churchId={aluno.church_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
