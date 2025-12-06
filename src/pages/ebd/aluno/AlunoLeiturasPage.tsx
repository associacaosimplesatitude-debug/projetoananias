import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { AlunoNavigation } from "@/components/ebd/aluno/AlunoNavigation";
import { AlunoLeituras } from "@/components/ebd/aluno/AlunoLeituras";

export default function AlunoLeiturasPage() {
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
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Plano de Leitura</h2>
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
          <h1 className="text-2xl font-bold mb-1">Plano de Leitura</h1>
          <p className="text-muted-foreground">Leituras semanais e histórico de progresso</p>
        </div>

        <AlunoLeituras alunoId={aluno.id} churchId={aluno.church_id} turmaId={aluno.turma_id || undefined} />
      </div>
    </>
  );
}
