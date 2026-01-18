import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";
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
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!user?.id,
  });

  // Fetch turmas vinculadas ao professor - busca via escalas + tabela de relacionamento + turma_id
  const { data: turmas, isLoading: turmasLoading } = useQuery({
    queryKey: ["professor-turmas", professor?.id],
    queryFn: async () => {
      if (!professor?.id) return [];

      const turmaIdsSet = new Set<string>();

      // 1. Buscar turmas via tabela de relacionamento
      const { data: vinculados } = await supabase
        .from("ebd_professores_turmas")
        .select("turma_id")
        .eq("professor_id", professor.id);
      
      vinculados?.forEach(v => turmaIdsSet.add(v.turma_id));

      // 2. Adicionar turma principal se existir
      if (professor.turma_id) {
        turmaIdsSet.add(professor.turma_id);
      }

      // 3. Buscar turmas via escalas onde o professor está alocado (como professor_id ou professor_id_2)
      const { data: escalas } = await supabase
        .from("ebd_escalas")
        .select("turma_id")
        .or(`professor_id.eq.${professor.id},professor_id_2.eq.${professor.id}`)
        .eq("sem_aula", false);
      
      escalas?.forEach(e => turmaIdsSet.add(e.turma_id));

      const turmaIds = Array.from(turmaIdsSet);
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
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-muted rounded-lg" />
        <div className="h-64 bg-muted rounded-lg" />
      </div>
    );
  }

  if (!professor) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Área do Professor</h2>
          <p className="text-muted-foreground">
            Você ainda não está cadastrado como professor em nenhuma turma da EBD.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <ProfessorDashboard professor={professor} turmas={turmas || []} />;
}
