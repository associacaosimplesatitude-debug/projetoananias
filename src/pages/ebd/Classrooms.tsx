import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, School, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ClassroomDialog from "@/components/ebd/ClassroomDialog";

export default function EBDClassrooms() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { clientId } = useParams();

  // Buscar church_id
  const { data: churchData, isLoading: loadingChurch, error: churchError } = useQuery({
    queryKey: ["church-data", clientId],
    queryFn: async () => {
      if (clientId) {
        const { data, error } = await supabase
          .from("churches")
          .select("*")
          .eq("id", clientId)
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
          .from("churches")
          .select("*")
          .eq("user_id", user.id)
          .single();
        if (error) throw error;
        return data;
      }
    },
  });

  // Buscar turmas com professores
  const { data: turmas, isLoading } = useQuery({
    queryKey: ["ebd-turmas", churchData?.id, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("ebd_turmas")
        .select(`
          *,
          ebd_professores_turmas (
            professor_id,
            ebd_professores (
              id,
              nome_completo
            )
          )
        `)
        .eq("church_id", churchData!.id)
        .eq("is_active", true);

      if (searchTerm) {
        query = query.ilike("nome", `%${searchTerm}%`);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!churchData?.id,
  });

  const filteredTurmas = turmas || [];

  // Loading state
  if (loadingChurch) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (churchError || !churchData) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <School className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-2xl font-bold mb-2">Erro ao carregar dados</h2>
          <p className="text-muted-foreground mb-4">
            {churchError?.message || "Não foi possível carregar os dados da igreja. Tente novamente."}
          </p>
          <Button onClick={() => window.location.reload()}>
            Recarregar Página
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Turmas</h1>
            <p className="text-muted-foreground">Gerencie as turmas da EBD</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Turma
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="w-5 h-5" />
              Turmas Cadastradas
            </CardTitle>
            <CardDescription>Lista de turmas da EBD</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar turma..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredTurmas.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <School className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma turma cadastrada</p>
                <p className="text-sm">Comece adicionando turmas</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTurmas.map((turma) => {
                  const professores = turma.ebd_professores_turmas?.map(
                    (pt: any) => pt.ebd_professores
                  ).filter(Boolean) || [];

                  return (
                    <Card key={turma.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="text-lg">{turma.nome}</CardTitle>
                        <CardDescription>{turma.faixa_etaria}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {turma.descricao && (
                          <p className="text-sm text-muted-foreground">{turma.descricao}</p>
                        )}
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {professores.length} {professores.length === 1 ? "Professor" : "Professores"}
                          </span>
                        </div>

                        {professores.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {professores.map((prof: any) => (
                              <Badge key={prof.id} variant="secondary" className="text-xs">
                                {prof.nome_completo}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ClassroomDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        churchId={churchData.id}
      />
    </div>
  );
}