import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AgeRangeDialog from "@/components/ebd/AgeRangeDialog";

export default function EBDAgeRanges() {
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

  // Buscar faixas etárias
  const { data: ageRanges, isLoading } = useQuery({
    queryKey: ["ebd-age-ranges", churchData?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_faixas_etarias")
        .select("*")
        .eq("church_id", churchData!.id)
        .order("idade_min", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!churchData?.id,
  });

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
          <Users2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
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
            <h1 className="text-3xl font-bold">Faixas Etárias</h1>
            <p className="text-muted-foreground">Gerencie as faixas etárias personalizadas</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Faixa Etária
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="w-5 h-5" />
              Faixas Cadastradas
            </CardTitle>
            <CardDescription>Faixas etárias disponíveis para as turmas</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : !ageRanges || ageRanges.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma faixa etária cadastrada</p>
                <p className="text-sm">Comece adicionando faixas etárias</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {ageRanges.map((range) => (
                  <Card key={range.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{range.nome_faixa}</CardTitle>
                      <CardDescription>
                        {range.idade_min} - {range.idade_max} anos
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="secondary" className="text-sm">
                        {range.nome_faixa} {range.idade_min}-{range.idade_max}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AgeRangeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        churchId={churchData.id}
      />
    </div>
  );
}
