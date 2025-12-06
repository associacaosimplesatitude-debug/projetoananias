import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfessorNavigation } from "@/components/ebd/professor/ProfessorNavigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BookOpen, Upload, FileText, Plus } from "lucide-react";

export default function ProfessorAulas() {
  const { user } = useAuth();

  const { data: professor } = useQuery({
    queryKey: ["professor-aulas-info", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("ebd_professores")
        .select("id, nome_completo, turma_id, church_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch turmas vinculadas
  const { data: turmaIds } = useQuery({
    queryKey: ["professor-aulas-turma-ids", professor?.id],
    queryFn: async () => {
      if (!professor?.id) return [];

      const { data: vinculados } = await supabase
        .from("ebd_professores_turmas")
        .select("turma_id")
        .eq("professor_id", professor.id);

      const ids = vinculados?.map(v => v.turma_id) || [];
      if (professor.turma_id && !ids.includes(professor.turma_id)) {
        ids.push(professor.turma_id);
      }
      return ids;
    },
    enabled: !!professor?.id,
  });

  // Fetch lições das turmas
  const { data: licoes, isLoading } = useQuery({
    queryKey: ["professor-licoes", turmaIds],
    queryFn: async () => {
      if (!turmaIds?.length) return [];

      const { data, error } = await supabase
        .from("ebd_licoes")
        .select(`
          *,
          turma:ebd_turmas(id, nome),
          revista:ebd_revistas(id, titulo)
        `)
        .in("turma_id", turmaIds)
        .order("data_aula", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: turmaIds && turmaIds.length > 0,
  });

  // Fetch materiais das turmas
  const { data: materiais } = useQuery({
    queryKey: ["professor-materiais", turmaIds],
    queryFn: async () => {
      if (!turmaIds?.length) return [];

      const { data, error } = await supabase
        .from("ebd_materiais")
        .select(`
          *,
          turma:ebd_turmas(id, nome)
        `)
        .in("turma_id", turmaIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: turmaIds && turmaIds.length > 0,
  });

  return (
    <>
      <ProfessorNavigation />
      <div className="container mx-auto py-6 px-4">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen className="h-6 w-6" />
                Aulas e Materiais
              </h1>
              <p className="text-muted-foreground">
                Gerencie suas aulas e materiais de apoio
              </p>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Aula
            </Button>
          </div>

          {/* Lições */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Lições
              </CardTitle>
              <CardDescription>
                {licoes?.length || 0} lição(ões) cadastrada(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-muted rounded-lg" />
                  ))}
                </div>
              ) : licoes && licoes.length > 0 ? (
                <div className="space-y-3">
                  {licoes.map((licao) => (
                    <div
                      key={licao.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{licao.titulo}</h3>
                          {licao.publicada ? (
                            <Badge variant="default">Publicada</Badge>
                          ) : (
                            <Badge variant="secondary">Rascunho</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {licao.turma?.nome} • {format(parseISO(licao.data_aula), "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                        {licao.revista && (
                          <p className="text-xs text-muted-foreground">
                            Revista: {licao.revista.titulo}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        <Button variant="outline" size="sm">
                          Editar
                        </Button>
                        {licao.plano_leitura_semanal && (
                          <Badge variant="outline" className="text-green-600">
                            Plano de Leitura
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma lição cadastrada ainda.
                  </p>
                  <Button variant="outline" className="mt-4 gap-2">
                    <Plus className="h-4 w-4" />
                    Criar Primeira Lição
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Materiais */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Materiais de Apoio
                </CardTitle>
                <CardDescription>
                  {materiais?.length || 0} material(is) disponível(is)
                </CardDescription>
              </div>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </CardHeader>
            <CardContent>
              {materiais && materiais.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {materiais.map((material) => (
                    <div
                      key={material.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-background"
                    >
                      <div className="p-2 bg-muted rounded">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{material.titulo}</h4>
                        <p className="text-sm text-muted-foreground truncate">
                          {material.turma?.nome} • {material.tipo}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhum material cadastrado ainda.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
