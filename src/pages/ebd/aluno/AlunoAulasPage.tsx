import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, FileText, PenLine, Heart } from "lucide-react";
import { AlunoNavigation } from "@/components/ebd/aluno/AlunoNavigation";
import { AlunoAulas } from "@/components/ebd/aluno/AlunoAulas";
import { AlunoMateriais } from "@/components/ebd/aluno/AlunoMateriais";
import { AlunoAnotacoes } from "@/components/ebd/aluno/AlunoAnotacoes";
import { AlunoDevocionais } from "@/components/ebd/aluno/AlunoDevocionais";

export default function AlunoAulasPage() {
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

  if (isLoading) {
    return (
      <>
        <AlunoNavigation />
        <div className="container mx-auto py-6 px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        </div>
      </>
    );
  }

  if (!aluno) {
    return (
      <>
        <AlunoNavigation />
        <div className="container mx-auto py-6 px-4">
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Aulas</h2>
              <p className="text-muted-foreground">
                Você ainda não está vinculado a nenhuma turma.
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <AlunoNavigation />
      <div className="container mx-auto py-6 px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Aulas</h1>
          <p className="text-muted-foreground">Histórico de lições, materiais e anotações</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="aulas" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Lições</span>
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
    </>
  );
}
