import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookMarked, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TaxaLeituraSemanalCardProps {
  churchId?: string | null;
}

export function TaxaLeituraSemanalCard({ churchId }: TaxaLeituraSemanalCardProps) {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["taxa-leitura-semanal", churchId],
    queryFn: async () => {
      if (!churchId) return null;

      // Get total active participants (alunos + professores)
      const [{ count: totalAlunos }, { count: totalProfessores }] = await Promise.all([
        supabase
          .from("ebd_alunos")
          .select("*", { count: "exact", head: true })
          .eq("church_id", churchId)
          .eq("is_active", true),
        supabase
          .from("ebd_professores")
          .select("*", { count: "exact", head: true })
          .eq("church_id", churchId)
          .eq("is_active", true),
      ]);

      const totalParticipantes = (totalAlunos || 0) + (totalProfessores || 0);
      if (totalParticipantes === 0) return { taxa: 0, lendo: 0, total: 0 };

      // Get users with at least one reading this week
      const { data: leituras } = await supabase
        .from("ebd_desafio_leitura_registro")
        .select("user_id")
        .eq("church_id", churchId);

      const usersLendo = new Set(leituras?.map((l) => l.user_id) || []).size;
      const taxa = Math.round((usersLendo / totalParticipantes) * 100);

      return { taxa, lendo: usersLendo, total: totalParticipantes };
    },
    enabled: !!churchId,
  });

  if (isLoading || !stats) return null;

  return (
    <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookMarked className="h-5 w-5 text-amber-600" />
          Taxa de Leitura Semanal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-amber-600">{stats.taxa}%</p>
            <p className="text-xs text-muted-foreground">
              {stats.lendo} de {stats.total} participantes
            </p>
          </div>
        </div>
        <Progress value={stats.taxa} className="h-2" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-2 text-amber-700 hover:text-amber-800 hover:bg-amber-100/50"
          onClick={() => navigate("/ebd/relatorios/leitura-diaria")}
        >
          Ver Relatório Completo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
