import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";
import { ProfessorNavigation } from "@/components/ebd/professor/ProfessorNavigation";
import { ProfessorDashboard } from "@/components/ebd/professor/ProfessorDashboard";

export default function ProfessorHome() {
  const { user } = useAuth();

  const { data: professor, isLoading: professorLoading } = useQuery({
    queryKey: ["professor-area", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("ebd_professores")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch turmas vinculadas ao professor
  const { data: turmas, isLoading: turmasLoading } = useQuery({
    queryKey: ["professor-turmas", professor?.id],
    queryFn: async () => {
      if (!professor?.id) return [];

      // Buscar turmas via tabela de relacionamento
      const { data: vinculados, error: vinculadosError } = await supabase
        .from("ebd_professores_turmas")
        .select("turma_id")
        .eq("professor_id", professor.id);

      if (vinculadosError) throw vinculadosError;

      const turmaIds = vinculados?.map(v => v.turma_id) || [];
      
      // Adicionar turma principal se existir
      if (professor.turma_id && !turmaIds.includes(professor.turma_id)) {
        turmaIds.push(professor.turma_id);
      }

      if (turmaIds.length === 0) return [];

      const { data: turmasData, error: turmasError } = await supabase
        .from("ebd_turmas")
        .select("id, nome, faixa_etaria")
        .in("id", turmaIds)
        .eq("is_active", true);

      if (turmasError) throw turmasError;
      return turmasData || [];
    },
    enabled: !!professor?.id,
  });

  const isLoading = professorLoading || turmasLoading;

  if (isLoading) {
    return (
      <>
        <ProfessorNavigation />
        <div className="container mx-auto py-6 px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-muted rounded-lg" />
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        </div>
      </>
    );
  }

  if (!professor) {
    return (
      <>
        <ProfessorNavigation />
        <div className="container mx-auto py-6 px-4">
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Área do Professor</h2>
              <p className="text-muted-foreground">
                Você ainda não está cadastrado como professor em nenhuma turma da EBD.
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <ProfessorNavigation />
      <div className="container mx-auto py-6 px-4">
        <ProfessorDashboard professor={professor} turmas={turmas || []} />
      </div>
    </>
  );
}
